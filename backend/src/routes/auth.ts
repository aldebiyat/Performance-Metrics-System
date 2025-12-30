import { Router, Request, Response } from 'express';
import { authService } from '../services/authService';
import { asyncHandler, Errors } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';
import { ApiResponse } from '../types';

const router = Router();

// Register new user
router.post(
  '/register',
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password, name } = req.body;

    if (!email || !password) {
      throw Errors.validation('Email and password are required');
    }

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
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
      throw Errors.validation('Email and password are required');
    }

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
  asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw Errors.validation('Refresh token is required');
    }

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
