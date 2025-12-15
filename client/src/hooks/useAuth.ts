import { useState, useEffect } from 'react';

interface User {
  userId: string;
  email: string;
  name: string;
  plan?: 'free' | 'pro';
  entitlements?: string[];
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleLogout = () => {
      localStorage.removeItem('auth_token');
      setUser(null);
      setLoading(false);
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'auth_token' && !e.newValue) {
        handleLogout();
      }
    };

    window.addEventListener('trace:auth:logout', handleLogout as EventListener);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('trace:auth:logout', handleLogout as EventListener);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    checkAuth();
  }, []);

  const loadCachedUser = (): User | null => {
    try {
      const raw = localStorage.getItem('auth_cached_user');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.expiresAt || Date.now() > parsed.expiresAt) {
        localStorage.removeItem('auth_cached_user');
        return null;
      }
      return parsed.user as User;
    } catch {
      return null;
    }
  };

  const cacheUser = (u: User | null) => {
    try {
      if (!u) {
        localStorage.removeItem('auth_cached_user');
        return;
      }
      const ttlMs = 5 * 60 * 1000; // 5 minutes
      const payload = { user: u, expiresAt: Date.now() + ttlMs };
      localStorage.setItem('auth_cached_user', JSON.stringify(payload));
    } catch {
      // ignore cache errors
    }
  };

  const checkAuth = async () => {
    try {
      // Check for token in URL first (for mobile testing)
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get('token');
      
      if (urlToken) {
        localStorage.setItem('auth_token', urlToken);
        // Remove token from URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setUser(null);
        setLoading(false);
        cacheUser(null);
        return;
      }

      // optimistic: use cached user while fetching fresh
      const cached = loadCachedUser();
      if (cached) {
        setUser(cached);
      }

      const response = await fetch('/api/auth/user', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        cacheUser(userData);
      } else {
        // Invalid token, remove it
        localStorage.removeItem('auth_token');
        cacheUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('auth_token');
      cacheUser(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    window.dispatchEvent(new Event('trace:auth:logout'));
  };

  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  return {
    user,
    loading,
    logout,
    getAuthHeaders,
    refresh: checkAuth,
    isAuthenticated: !!user
  };
}