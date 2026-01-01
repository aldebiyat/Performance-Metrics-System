import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, AuthContextType, AuthTokens } from '../types';
import { api, setAccessToken } from '../api/client';

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(async () => {
    try {
      // Refresh token is sent automatically via httpOnly cookie
      await api.post('/api/auth/logout', {}, false);
    } catch {
      // Ignore logout errors
    }
    setAccessToken(null);
    setUser(null);
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Try to refresh the token - refresh token is sent via httpOnly cookie
        const response = await api.post<AuthTokens>('/api/auth/refresh', {}, false);

        if (response.success && response.data) {
          setAccessToken(response.data.accessToken);

          // Fetch user data
          const userResponse = await api.get<User>('/api/auth/me');
          if (userResponse.success && userResponse.data) {
            setUser(userResponse.data);
          }
        }
        // If refresh fails, user simply remains logged out (no token in cookie)
      } catch (error) {
        // Auth initialization failed - user is not logged in
        console.error('Auth initialization failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // Listen for logout events from API client
    const handleLogout = () => {
      setUser(null);
      setAccessToken(null);
    };

    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, []);

  const login = async (email: string, password: string) => {
    const response = await api.post<User & { tokens: AuthTokens }>(
      '/api/auth/login',
      { email, password },
      false
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Login failed');
    }

    const { tokens, ...userData } = response.data;
    setAccessToken(tokens.accessToken);
    // Refresh token is set via httpOnly cookie by the server
    setUser(userData as User);
  };

  const register = async (email: string, password: string, name?: string) => {
    const response = await api.post<User & { tokens: AuthTokens }>(
      '/api/auth/register',
      { email, password, name },
      false
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Registration failed');
    }

    const { tokens, ...userData } = response.data;
    setAccessToken(tokens.accessToken);
    // Refresh token is set via httpOnly cookie by the server
    setUser(userData as User);
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
