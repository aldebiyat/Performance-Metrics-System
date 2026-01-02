import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { config } from '../config/constants';
import { query } from '../config/database';
import { asyncHandler, Errors } from '../middleware/errorHandler';
import { passwordResetLimiter } from '../middleware/rateLimiter';
import { emailService } from '../services/emailService';
import { auditService } from '../services/auditService';
import { ApiResponse } from '../types';
import { validate } from '../validators';
import { z } from 'zod';
import logger from '../config/logger';

const router = Router();

// Validation schemas
const forgotPasswordSchema = z.object({
  email: z.string().trim().max(255).email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(
      /[!@#$%^&*(),.?":{}|<>]/,
      'Password must contain at least one special character (!@#$%^&*(),.?":{}|<>)'
    ),
});

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request a password reset email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *     responses:
 *       200:
 *         description: Password reset email sent (always returns success for security)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *       429:
 *         description: Too many requests
 */
router.post(
  '/forgot-password',
  passwordResetLimiter,
  validate(forgotPasswordSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;

    // Find user by email
    const userResult = await query(
      `SELECT id, email FROM users WHERE email = $1 AND deleted_at IS NULL AND is_active = true`,
      [email.toLowerCase()]
    );

    // Always return success for security (don't reveal if email exists)
    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: 'If an account with that email exists, a password reset link has been sent.' },
    };

    if (userResult.rows.length === 0) {
      // Log but don't reveal to user
      logger.info('Password reset requested for non-existent email', { email });
      res.json(response);
      return;
    }

    const user = userResult.rows[0];

    // Invalidate any existing reset tokens for this user
    await query(
      `UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND used_at IS NULL`,
      [user.id]
    );

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + config.passwordResetTokenHours);

    // Store hashed token
    await query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt]
    );

    // Send email
    try {
      await emailService.sendPasswordResetEmail(user.email, resetToken);
    } catch (error) {
      logger.error('Failed to send password reset email', { email, error });
      // Don't expose email sending failure to user
    }

    res.json(response);
  })
);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset password using token from email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token:
 *                 type: string
 *                 description: Password reset token from email
 *               password:
 *                 type: string
 *                 minLength: 12
 *                 description: New password (minimum 12 characters, must include uppercase, lowercase, number, and special character)
 *     responses:
 *       200:
 *         description: Password reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *       400:
 *         description: Invalid or expired token
 *       429:
 *         description: Too many requests
 */
router.post(
  '/reset-password',
  passwordResetLimiter,
  validate(resetPasswordSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { token, password } = req.body;

    // Hash the provided token
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find valid token
    const tokenResult = await query(
      `SELECT prt.id, prt.user_id, u.email
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token_hash = $1
         AND prt.expires_at > NOW()
         AND prt.used_at IS NULL
         AND u.deleted_at IS NULL
         AND u.is_active = true`,
      [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      throw Errors.badRequest('Invalid or expired reset token');
    }

    const resetRecord = tokenResult.rows[0];

    // Hash new password
    const passwordHash = await bcrypt.hash(password, config.saltRounds);

    // Update password
    await query(
      `UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [passwordHash, resetRecord.user_id]
    );

    // Mark token as used
    await query(
      `UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [resetRecord.id]
    );

    // Invalidate all refresh tokens for this user (force re-login)
    await query(
      `DELETE FROM refresh_tokens WHERE user_id = $1`,
      [resetRecord.user_id]
    );

    await auditService.log({
      userId: resetRecord.user_id,
      action: 'PASSWORD_RESET',
      entityType: 'user',
      entityId: resetRecord.user_id,
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.get('user-agent'),
    });

    logger.info('Password reset successful', { userId: resetRecord.user_id, email: resetRecord.email });

    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: 'Password has been reset successfully. Please login with your new password.' },
    };

    res.json(response);
  })
);

export default router;
