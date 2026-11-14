import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  KeyRound, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ShieldCheck,
  Server,
  Lock,
  ArrowRight
} from 'lucide-react';
import { api } from '../../utils/apiClient';
import { useAuth } from '../../components/auth/AuthGuard';

type AuthTab = 'credentials' | 'project';

export function LoginView() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshUser } = useAuth();

  const [activeTab, setActiveTab] = useState<AuthTab>('credentials');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Username & Password State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Project Scoped Login State
  const [projectSlug, setProjectSlug] = useState('');
  const [projectPassword, setProjectPassword] = useState('');

  // Parse return URL
  const searchParams = new URLSearchParams(location.search);
  const rawReturnUrl = searchParams.get('returnUrl') || searchParams.get('redirect') || '/panel';
  const returnUrl = rawReturnUrl.toLowerCase().startsWith('/login') || rawReturnUrl.toLowerCase().startsWith('/auth')
    ? '/panel'
    : rawReturnUrl;

  const handleCompleteAuth = async (tokens: { accessToken: string }, user: any) => {
    localStorage.setItem('localme_token', tokens.accessToken);
    localStorage.setItem('localme_user', JSON.stringify(user));
    try {
      await refreshUser();
    } catch {
      // ignore
    }
    
    const target = returnUrl.startsWith('/login') || returnUrl.startsWith('/auth') ? '/panel' : returnUrl;
    navigate(target, { replace: true });
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError('لطفاً نام کاربری و کلمه عبور را وارد نمایید.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/_baas/v1/auth/login', {
        username: username.trim(),
        password,
      });

      if (res.tokens) {
        await handleCompleteAuth(res.tokens, res.user);
      } else {
        setError('پاسخ نامعتبر از سرور دریافت شد.');
      }
    } catch (err: any) {
      setError(err.message || 'نام کاربری یا کلمه عبور نادرست است.');
    } finally {
      setLoading(false);
    }
  };

  const handleProjectLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!projectSlug.trim() || !projectPassword) {
      setError('لطفاً شناسه پروژه و رمز عبور اختصاصی آن را وارد نمایید.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/_baas/v1/auth/project-login', {
        projectSlug: projectSlug.trim().toLowerCase(),
        password: projectPassword,
      });

      if (res.tokens) {
        await handleCompleteAuth(res.tokens, res.project ? { fullName: res.project.name, role: 2 } : { role: 2 });
      } else {
        setError('شناسه یا کلمه عبور پروژه اشتباه است.');
      }
    } catch (err: any) {
      setError(err.message || 'شناسه پروژه یا کلمه عبور نامعتبر است.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center items-center p-4 selection:bg-emerald-500/20 selection:text-emerald-800" dir="rtl">
      {/* Main Card */}
      <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-2xl shadow-sm p-6 sm:p-8">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-3">
            <img src="/favicon.svg" alt="LocalMe" className="w-7 h-7 object-contain" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">ورود به سکوی لوکال می</h1>
          <p className="text-xs text-slate-500 mt-1">مدیریت ابر پایگاه‌داده، احراز هویت و توابع لبه سرور</p>
        </div>

        {/* Auth Mode Tabs */}
        <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl mb-6 border border-slate-200/70">
          <button
            type="button"
            onClick={() => { setActiveTab('credentials'); setError(null); }}
            className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition ${
              activeTab === 'credentials'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
            <span>رمز عبور توسعه‌دهنده</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('project'); setError(null); }}
            className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition ${
              activeTab === 'project'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-emerald-600" />
            <span>ورود پروژه اختصاصی</span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Tab 1: Username & Password */}
        {activeTab === 'credentials' && (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                ایمیل یا نام کاربری
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin یا developer@example.com"
                  dir="ltr"
                  required
                  autoFocus
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white focus:ring-1 focus:ring-emerald-600 transition font-mono"
                />
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  کلمه عبور
                </label>
                <Link
                  to="/reset-password"
                  className="text-[11px] font-medium text-emerald-700 hover:text-emerald-800 transition"
                >
                  فراموشی رمز عبور؟
                </Link>
              </div>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  dir="ltr"
                  required
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white focus:ring-1 focus:ring-emerald-600 transition font-mono"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>ورود با شناسه و رمز عبور</span>
                  <CheckCircle2 className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Tab 2: Project-Scoped Direct Access */}
        {activeTab === 'project' && (
          <form onSubmit={handleProjectLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                شناسه پروژه (Project Slug)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={projectSlug}
                  onChange={(e) => setProjectSlug(e.target.value)}
                  placeholder="my-cool-project"
                  dir="ltr"
                  required
                  autoFocus
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white focus:ring-1 focus:ring-emerald-600 transition font-mono"
                />
                <Server className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                شناسه یکتای پروژه در هنگام ساخت آن تعریف شده است.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                کلمه عبور اختصاصی پروژه
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={projectPassword}
                  onChange={(e) => setProjectPassword(e.target.value)}
                  placeholder="••••••••"
                  dir="ltr"
                  required
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white focus:ring-1 focus:ring-emerald-600 transition font-mono"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>ورود اختصاصی به کنسول پروژه</span>
                  <CheckCircle2 className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Register Link */}
        <div className="mt-5 text-center text-xs text-slate-500">
          حساب کاربری توسعه‌دهنده ندارید؟{' '}
          <Link to="/register" className="font-semibold text-emerald-700 hover:text-emerald-800 transition inline-flex items-center gap-0.5">
            <span>ثبت‌نام در لوکال می</span>
            <ArrowRight className="w-3 h-3 rotate-180" />
          </Link>
        </div>

        {/* Security Badge Footer */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>اتصال امن رمزنگاری‌شده TLS 1.3</span>
          </div>
          <span className="font-mono text-[10px] text-slate-400">لوکال می v1.0.0</span>
        </div>

      </div>
    </div>
  );
}
