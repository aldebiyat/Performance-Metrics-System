import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { query } from '../config/database';
import { User, AuthTokens, TokenPayload } from '../types';
import { generateAccessToken, generateRefreshToken, verifyToken } from '../middleware/auth';
import { Errors } from '../middleware/errorHandler';

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

    // Insert user
    const result = await query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, 'viewer')
       RETURNING id, email, name, role, is_active, created_at, updated_at`,
      [email.toLowerCase(), passwordHash, name || null]
    );

    const user = result.rows[0];

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
      `SELECT id, email, name, role, is_active, created_at, updated_at
       FROM users
       WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );

    return result.rows[0] || null;
  },
};

export default authService;
