import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export interface UserSession {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  role: number | string; // 0: Admin, 1: Operator, 2: Developer
  walletBalanceIrr: number;
  username?: string;
}

interface AuthContextType {
  user: UserSession | null;
  loading: boolean;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: () => {},
  refreshUser: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/_baas/v1/users/me');
      if (res.ok) {
        const u = await res.json();
        setUser(u);
        localStorage.setItem('localme_user', JSON.stringify(u));
        return u;
      } else {
        setUser(null);
        localStorage.removeItem('localme_user');
        return null;
      }
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const logout = () => {
    localStorage.removeItem('localme_token');
    localStorage.removeItem('localme_user');
    // Clear cookie
    document.cookie = 'localme_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    setUser(null);
    navigate('/login');
  };

  useEffect(() => {
    if (loading) return;

    const path = location.pathname.toLowerCase();
    const isAuthRoute = path === '/login' || path === '/register' || path.startsWith('/auth');
    const isAdminRoute = path === '/admin' || path.startsWith('/admin/');
    const isPanelRoute = path === '/panel' || path.startsWith('/panel/') || path === '/console' || path.startsWith('/console/') || path === '/projects';

    const searchParams = new URLSearchParams(location.search);
    const returnUrl = searchParams.get('returnUrl') || searchParams.get('redirect');

    if (user) {
      // Authenticated user on auth page -> redirect to panel or returnUrl
      if (isAuthRoute) {
        navigate(returnUrl && !returnUrl.startsWith('/login') ? returnUrl : '/panel', { replace: true });
        return;
      }

      // Developer trying to access admin
      if (isAdminRoute) {
        const roleStr = String(user.role).toLowerCase();
        const isAdmin = roleStr === '0' || roleStr === 'admin' || roleStr === '1' || roleStr === 'operator';
        if (!isAdmin) {
          navigate('/panel', { replace: true });
          return;
        }
      }
    } else {
      // Unauthenticated user on protected route -> redirect to login with returnUrl
      if (isAdminRoute || isPanelRoute) {
        const target = location.pathname + location.search;
        navigate(`/login?returnUrl=${encodeURIComponent(target)}`, { replace: true });
        return;
      }
    }
  }, [user, loading, location.pathname, location.search, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
          <span className="text-sm text-slate-400 font-medium">در حال بررسی احراز هویت...</span>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, logout, refreshUser: fetchCurrentUser }}>
      {children}
    </AuthContext.Provider>
  );
}
