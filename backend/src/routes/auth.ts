import { Router, Request, Response } from 'express';
import { authService } from '../services/authService';
import { asyncHandler, Errors } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';
import { ApiResponse } from '../types';
import { validate, registerSchema, loginSchema, refreshTokenSchema } from '../validators';

const router = Router();

// Register new user
router.post(
  '/register',
  validate(registerSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password, name } = req.body;

    const { user, tokens } = await authService.register(email, password, name);

    const response: ApiResponse<typeof user & { tokens: typeof tokens }> = {
      success: true,
      data: { ...user, tokens },
    };

    res.status(201).json(response);
  })
);

// Login
router.post(
  '/login',
  validate(loginSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    const { user, tokens } = await authService.login(email, password);

    const response: ApiResponse<typeof user & { tokens: typeof tokens }> = {
      success: true,
      data: { ...user, tokens },
    };

    res.json(response);
  })
);

// Refresh tokens
router.post(
  '/refresh',
  validate(refreshTokenSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    const tokens = await authService.refreshTokens(refreshToken);

    const response: ApiResponse<typeof tokens> = {
      success: true,
      data: tokens,
    };

    res.json(response);
  })
);

// Logout
router.post(
  '/logout',
  asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await authService.logout(refreshToken);
    }

    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: 'Logged out successfully' },
    };

    res.json(response);
  })
);

// Get current user (protected)
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

// Logout from all devices (protected)
router.post(
  '/logout-all',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    await authService.logoutAll(req.user!.userId);

    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: 'Logged out from all devices' },
    };

    res.json(response);
  })
);

export default router;
