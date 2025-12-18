import { useState, useEffect, useCallback } from 'react';

interface User {
  userId: string;
  email: string;
  name: string;
  plan?: 'free' | 'pro';
  entitlements?: string[];
}

// Development bypass
const isDev = import.meta.env.DEV;
const mockUser: User = {
  userId: 'dev-user-123',
  email: 'dev@example.com',
  name: 'Dev User',
};

const CACHE_KEY = 'auth_cached_user';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCachedUser = useCallback((): User | null => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.expiresAt || Date.now() > parsed.expiresAt) {
        localStorage.removeItem(CACHE_KEY);
        return null;
      }
      return parsed.user as User;
    } catch (error) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
  }, []);

  const cacheUser = useCallback((u: User | null) => {
    try {
      if (!u) {
        localStorage.removeItem(CACHE_KEY);
        return;
      }
      const payload = {
        user: u,
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    } catch (error) {
      localStorage.removeItem(CACHE_KEY);
    }
  }, []);

  const checkAuth = useCallback(async () => {
    if (isDev) {
      setUser(mockUser);
      setLoading(false);
      cacheUser(mockUser);
      return;
    }

    setLoading(true);
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get('token');

      if (urlToken) {
        localStorage.setItem('auth_token', urlToken);
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      const token = localStorage.getItem('auth_token');
      if (!token) {
        setUser(null);
        cacheUser(null);
        return;
      }

      const cached = loadCachedUser();
      if (cached) {
        setUser(cached);
      }

      const response = await fetch('/api/auth/user', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        cacheUser(userData);
      } else {
        localStorage.removeItem('auth_token');
        cacheUser(null);
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('auth_token');
      cacheUser(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [cacheUser, loadCachedUser]);

  useEffect(() => {
    const handleLogout = () => {
      localStorage.removeItem('auth_token');
      cacheUser(null);
      setUser(null);
      setLoading(false);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'auth_token' && !event.newValue) {
        cacheUser(null);
        setUser(null);
        setLoading(false);
      }
    };

    window.addEventListener('trace:auth:logout', handleLogout as EventListener);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('trace:auth:logout', handleLogout as EventListener);
      window.removeEventListener('storage', handleStorage);
    };
  }, [cacheUser]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token');
    cacheUser(null);
    window.dispatchEvent(new Event('trace:auth:logout'));
  }, [cacheUser]);

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  if (isDev) {
    return {
      user: mockUser,
      loading: false,
      logout,
      getAuthHeaders,
      refresh: checkAuth,
      isAuthenticated: true,
    };
  }

  return {
    user,
    loading,
    logout,
    getAuthHeaders,
    refresh: checkAuth,
    isAuthenticated: Boolean(user),
  };
}