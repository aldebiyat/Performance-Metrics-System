import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, AuthContextType, AuthTokens } from '../types';
import { api, setAccessToken, setRefreshToken, getRefreshToken } from '../api/client';

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
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        await api.post('/api/auth/logout', { refreshToken }, false);
      } catch {
        // Ignore logout errors
      }
    }
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    const initAuth = async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        setIsLoading(false);
        return;
      }

      try {
        // Try to refresh the token
        const response = await api.post<AuthTokens>('/api/auth/refresh', { refreshToken }, false);

        if (response.success && response.data) {
          setAccessToken(response.data.accessToken);
          setRefreshToken(response.data.refreshToken);

          // Fetch user data
          const userResponse = await api.get<User>('/api/auth/me');
          if (userResponse.success && userResponse.data) {
            setUser(userResponse.data);
          }
        } else {
          // Token refresh failed, clear tokens
          setRefreshToken(null);
        }
      } catch (error) {
        console.error('Auth initialization failed:', error);
        setRefreshToken(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // Listen for logout events from API client
    const handleLogout = () => {
      setUser(null);
      setAccessToken(null);
      setRefreshToken(null);
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
    setRefreshToken(tokens.refreshToken);
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
    setRefreshToken(tokens.refreshToken);
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
