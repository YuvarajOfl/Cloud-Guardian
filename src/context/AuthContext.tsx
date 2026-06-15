import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithGoogleToken: (googleToken: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Define VITE_API_URL dynamically or default to FastAPI server running on localhost:8000
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Auto-login session recovery check on app boot
  useEffect(() => {
    async function checkSession() {
      const storedToken = localStorage.getItem('cg_auth_token');
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${storedToken}`
          }
        });

        if (response.ok) {
          const userData: User = await response.json();
          setUser(userData);
          setToken(storedToken);
          setIsAuthenticated(true);
        } else {
          // Token is either expired or invalid - clear client credentials
          localStorage.removeItem('cg_auth_token');
        }
      } catch (err) {
        console.error('Session validation error during auto-login:', err);
      } finally {
        setIsLoading(false);
      }
    }

    checkSession();
  }, []);

  const loginWithGoogleToken = async (googleToken: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ google_token: googleToken }),
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.detail || 'Google Login failed on backend');
      }

      const data: { access_token: string; user: User } = await response.json();

      localStorage.setItem('cg_auth_token', data.access_token);
      setToken(data.access_token);
      setUser(data.user);
      setIsAuthenticated(true);
    } catch (err) {
      console.error('Auth Context Google login error:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    const storedToken = token || localStorage.getItem('cg_auth_token');

    if (storedToken) {
      try {
        // Notify the backend about session invalidation
        await fetch(`${API_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${storedToken}`
          }
        });
      } catch (err) {
        console.error('Auth Context Backend logout error:', err);
      }
    }

    // Always clear local storage state regardless of backend outcome
    localStorage.removeItem('cg_auth_token');
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    setIsLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, isLoading, loginWithGoogleToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
