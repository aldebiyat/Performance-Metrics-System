import { Router, Request, Response } from 'express';
import { authService } from '../services/authService';
import { auditService } from '../services/auditService';
import { sessionService } from '../services/sessionService';
import { asyncHandler, Errors } from '../middleware/errorHandler';
import { authenticate, verifyToken } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';
import { generateCsrfToken, setCsrfCookie } from '../middleware/csrf';
import { ApiResponse } from '../types';
import { validate, registerSchema, loginSchema, refreshTokenSchema } from '../validators';

const router = Router();

// Cookie options for refresh token
const REFRESH_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/api/auth',
};

// Helper function to set refresh token cookie
const setRefreshTokenCookie = (res: Response, refreshToken: string) => {
  res.cookie('refreshToken', refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);
};

// Helper function to clear refresh token cookie
const clearRefreshTokenCookie = (res: Response) => {
  res.clearCookie('refreshToken', { path: '/api/auth' });
};

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 description: User's password (minimum 8 characters)
 *               name:
 *                 type: string
 *                 description: User's display name
 *     responses:
 *       201:
 *         description: User registered successfully
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
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     name:
 *                       type: string
 *                     accessToken:
 *                       type: string
 *                       description: JWT access token (refresh token is set as httpOnly cookie)
 *       400:
 *         description: Validation error or user already exists
 *       429:
 *         description: Too many requests
 */
router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password, name } = req.body;

    const { user, tokens } = await authService.register(email, password, name);

    await auditService.log({
      userId: user.id,
      action: 'USER_REGISTERED',
      entityType: 'user',
      entityId: user.id,
      newValues: { email: user.email, name: user.name },
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.get('user-agent'),
    });

    // Set refresh token as httpOnly cookie
    setRefreshTokenCookie(res, tokens.refreshToken);

    // Generate and set CSRF token for authenticated session
    const csrfToken = generateCsrfToken();
    setCsrfCookie(res, csrfToken);

    const response: ApiResponse<typeof user & { accessToken: string; csrfToken: string }> = {
      success: true,
      data: { ...user, accessToken: tokens.accessToken, csrfToken },
    };

    res.status(201).json(response);
  })
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *               password:
 *                 type: string
 *                 description: User's password
 *     responses:
 *       200:
 *         description: Login successful
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
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     name:
 *                       type: string
 *                     accessToken:
 *                       type: string
 *                       description: JWT access token (refresh token is set as httpOnly cookie)
 *       401:
 *         description: Invalid credentials
 *       429:
 *         description: Too many requests
 */
router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

    const { user, tokens } = await authService.login(email, password, ipAddress);

    // Enforce concurrent session limit - invalidates oldest session if at limit
    await sessionService.createSessionWithLimit(user.id, tokens.refreshToken);

    await auditService.log({
      userId: user.id,
      action: 'USER_LOGIN',
      entityType: 'user',
      entityId: user.id,
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.get('user-agent'),
    });

    // Set refresh token as httpOnly cookie
    setRefreshTokenCookie(res, tokens.refreshToken);

    // Generate and set CSRF token for authenticated session
    const csrfToken = generateCsrfToken();
    setCsrfCookie(res, csrfToken);

    const response: ApiResponse<typeof user & { accessToken: string; csrfToken: string }> = {
      success: true,
      data: { ...user, accessToken: tokens.accessToken, csrfToken },
    };

    res.json(response);
  })
);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token using refresh token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Valid refresh token
 *     responses:
 *       200:
 *         description: Tokens refreshed successfully
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
 *                     accessToken:
 *                       type: string
 *                       description: New JWT access token (new refresh token is set as httpOnly cookie)
 *       401:
 *         description: Invalid or expired refresh token
 *       429:
 *         description: Too many requests
 */
router.post(
  '/refresh',
  authLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    // Accept refresh token from cookie OR body for backward compatibility
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!refreshToken) {
      throw Errors.badRequest('Refresh token is required');
    }

    const tokens = await authService.refreshTokens(refreshToken);

    // Set new refresh token as httpOnly cookie
    setRefreshTokenCookie(res, tokens.refreshToken);

    const response: ApiResponse<{ accessToken: string }> = {
      success: true,
      data: { accessToken: tokens.accessToken },
    };

    res.json(response);
  })
);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout and invalidate refresh token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Refresh token to invalidate
 *     responses:
 *       200:
 *         description: Logged out successfully
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
 */
router.post(
  '/logout',
  asyncHandler(async (req: Request, res: Response) => {
    // Accept refresh token from cookie OR body for backward compatibility
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    let userId: number | undefined;
    if (refreshToken) {
      try {
        const decoded = verifyToken(refreshToken);
        userId = decoded.userId;
      } catch {
        // Token might be invalid, but we still want to complete logout
      }
      await authService.logout(refreshToken);
    }

    // Clear the refresh token cookie
    clearRefreshTokenCookie(res);

    if (userId) {
      await auditService.log({
        userId,
        action: 'USER_LOGOUT',
        entityType: 'user',
        entityId: userId,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
      });
    }

    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: 'Logged out successfully' },
    };

    res.json(response);
  })
);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current authenticated user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user details
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
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     name:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: User not found
 */
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.getCurrentUser(req.user!.userId);

    if (!user) {
      throw Errors.notFound('User not found');
    }

    const response: ApiResponse<typeof user> = {
      success: true,
      data: user,
    };

    res.json(response);
  })
);

/**
 * @swagger
 * /api/auth/logout-all:
 *   post:
 *     summary: Logout from all devices
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out from all devices successfully
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
 *       401:
 *         description: Unauthorized - Invalid or missing token
 */
router.post(
  '/logout-all',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    await authService.logoutAll(req.user!.userId);

    // Clear the refresh token cookie
    clearRefreshTokenCookie(res);

    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: 'Logged out from all devices' },
    };

    res.json(response);
  })
);

/**
 * @swagger
 * /api/auth/verify-email:
 *   get:
 *     summary: Verify email address
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Verification token from email
 *     responses:
 *       200:
 *         description: Email verified successfully
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
 */
router.get(
  '/verify-email',
  asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      throw Errors.badRequest('Verification token is required');
    }

    const result = await authService.verifyEmail(token);

    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
    };

    res.json(response);
  })
);

/**
 * @swagger
 * /api/auth/resend-verification:
 *   post:
 *     summary: Resend verification email
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
 *         description: Verification email sent (if email exists)
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
  '/resend-verification',
  authLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      throw Errors.badRequest('Email is required');
    }

    const result = await authService.resendVerificationEmail(email);

    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
    };

    res.json(response);
  })
);

/**
 * @swagger
 * /api/auth/csrf-token:
 *   get:
 *     summary: Get a new CSRF token
 *     description: Issues a new CSRF token. The token is returned in the response body and also set as a cookie. Use this endpoint to refresh the CSRF token for authenticated sessions.
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: CSRF token issued successfully
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
 *                     csrfToken:
 *                       type: string
 *                       description: CSRF token to include in X-CSRF-Token header for state-changing requests
 */
router.get(
  '/csrf-token',
  asyncHandler(async (_req: Request, res: Response) => {
    const csrfToken = generateCsrfToken();
    setCsrfCookie(res, csrfToken);

    const response: ApiResponse<{ csrfToken: string }> = {
      success: true,
      data: { csrfToken },
    };

    res.json(response);
  })
);

export default router;
