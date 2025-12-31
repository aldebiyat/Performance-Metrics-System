import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { query } from '../config/database';
import { User, AuthTokens, TokenPayload } from '../types';
import { generateAccessToken, generateRefreshToken, verifyToken } from '../middleware/auth';
import { Errors } from '../middleware/errorHandler';
import { emailService } from './emailService';

const SALT_ROUNDS = 12;

export const authService = {
  async register(email: string, password: string, name?: string): Promise<{ user: Omit<User, 'password_hash'>; tokens: AuthTokens }> {
    // Check if user exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      throw Errors.conflict('Email already registered');
    }

    // Validate password strength
    if (password.length < 8) {
      throw Errors.validation('Password must be at least 8 characters');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
    const verificationTokenExpires = new Date();
    verificationTokenExpires.setHours(verificationTokenExpires.getHours() + 24); // 24 hours expiry

    // Insert user with verification token
    const result = await query(
      `INSERT INTO users (email, password_hash, name, role, email_verified, verification_token, verification_token_expires)
       VALUES ($1, $2, $3, 'viewer', false, $4, $5)
       RETURNING id, email, name, role, is_active, email_verified, created_at, updated_at`,
      [email.toLowerCase(), passwordHash, name || null, verificationTokenHash, verificationTokenExpires]
    );

    const user = result.rows[0];

    // Send verification email
    try {
      await emailService.sendVerificationEmail(user.email, verificationToken);
    } catch (error) {
      // Log error but don't fail registration
      console.error('Failed to send verification email:', error);
    }

    // Generate tokens
    const tokenPayload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const tokens = await this.createTokens(tokenPayload);

    return { user, tokens };
  },

  async login(email: string, password: string): Promise<{ user: Omit<User, 'password_hash'>; tokens: AuthTokens }> {
    // Find user
    const result = await query(
      `SELECT id, email, password_hash, name, role, is_active
       FROM users
       WHERE email = $1 AND deleted_at IS NULL`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      throw Errors.unauthorized('Invalid email or password');
    }

    const user = result.rows[0];

    if (!user.is_active) {
      throw Errors.unauthorized('Account is deactivated');
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw Errors.unauthorized('Invalid email or password');
    }

    // Generate tokens
    const tokenPayload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const tokens = await this.createTokens(tokenPayload);

    // Remove password_hash from response
    const { password_hash, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, tokens };
  },

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    // Verify the refresh token
    let decoded: TokenPayload;
    try {
      decoded = verifyToken(refreshToken);
    } catch {
      throw Errors.unauthorized('Invalid refresh token');
    }

    // Hash the token to check against stored hash
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    // Check if token exists and is valid
    const result = await query(
      `SELECT rt.id, u.id as user_id, u.email, u.role, u.is_active
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1 AND rt.expires_at > NOW() AND u.deleted_at IS NULL`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      throw Errors.unauthorized('Invalid or expired refresh token');
    }

    const user = result.rows[0];

    if (!user.is_active) {
      throw Errors.unauthorized('Account is deactivated');
    }

    // Delete old refresh token
    await query('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);

    // Create new tokens
    const tokenPayload: TokenPayload = {
      userId: user.user_id,
      email: user.email,
      role: user.role,
    };

    return this.createTokens(tokenPayload);
  },

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await query('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);
  },

  async logoutAll(userId: number): Promise<void> {
    await query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
  },

  async createTokens(payload: TokenPayload): Promise<AuthTokens> {
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Store refresh token hash
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [payload.userId, tokenHash, expiresAt]
    );

    // Clean up expired tokens for this user
    await query(
      'DELETE FROM refresh_tokens WHERE user_id = $1 AND expires_at < NOW()',
      [payload.userId]
    );

    return { accessToken, refreshToken };
  },

  async getCurrentUser(userId: number): Promise<Omit<User, 'password_hash'> | null> {
    const result = await query(
      `SELECT id, email, name, role, is_active, email_verified, created_at, updated_at
       FROM users
       WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );

    return result.rows[0] || null;
  },

  async verifyEmail(token: string): Promise<{ message: string }> {
    // Hash the token to compare with stored hash
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with this verification token that hasn't expired
    const result = await query(
      `SELECT id, email, email_verified
       FROM users
       WHERE verification_token = $1
         AND verification_token_expires > NOW()
         AND deleted_at IS NULL`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      throw Errors.badRequest('Invalid or expired verification token');
    }

    const user = result.rows[0];

    if (user.email_verified) {
      return { message: 'Email already verified' };
    }

    // Update user to mark email as verified and clear token
    await query(
      `UPDATE users
       SET email_verified = true,
           verification_token = NULL,
           verification_token_expires = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [user.id]
    );

    return { message: 'Email verified successfully' };
  },

  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    // Find user by email
    const result = await query(
      `SELECT id, email, email_verified
       FROM users
       WHERE email = $1 AND deleted_at IS NULL`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      // Don't reveal if email exists
      return { message: 'If the email exists, a verification email has been sent' };
    }

    const user = result.rows[0];

    if (user.email_verified) {
      return { message: 'Email is already verified' };
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
    const verificationTokenExpires = new Date();
    verificationTokenExpires.setHours(verificationTokenExpires.getHours() + 24); // 24 hours expiry

    // Update user with new verification token
    await query(
      `UPDATE users
       SET verification_token = $1,
           verification_token_expires = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [verificationTokenHash, verificationTokenExpires, user.id]
    );

    // Send verification email
    try {
      await emailService.sendVerificationEmail(user.email, verificationToken);
    } catch (error) {
      console.error('Failed to send verification email:', error);
      throw Errors.internal('Failed to send verification email');
    }

    return { message: 'Verification email sent' };
  },
};

export default authService;
