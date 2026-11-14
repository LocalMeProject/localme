import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  KeyRound, 
  Mail, 
  User, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ShieldCheck,
  Lock,
  ArrowRight
} from 'lucide-react';
import { api } from '../../utils/apiClient';
import { useAuth } from '../../components/auth/AuthGuard';

export function RegisterView() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('لطفاً یک آدرس ایمیل معتبر وارد نمایید.');
      return;
    }

    if (!password || password.length < 6) {
      setError('کلمه عبور باید حداقل ۶ کاراکتر باشد.');
      return;
    }

    if (password !== confirmPassword) {
      setError('کلمه عبور و تکرار آن یکسان نیستند.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/_baas/v1/auth/register', {
        fullName: fullName.trim() || undefined,
        email: cleanEmail,
        username: username.trim() || undefined,
        password,
      });

      if (res.tokens) {
        localStorage.setItem('localme_token', res.tokens.accessToken);
        localStorage.setItem('localme_user', JSON.stringify(res.user));
        try {
          await refreshUser();
        } catch {
          // ignore
        }
        navigate('/panel', { replace: true });
      } else {
        setError('پاسخ نامعتبر از سرور دریافت شد.');
      }
    } catch (err: any) {
      setError(err.message || 'خطا در ثبت‌نام کاربر. لطفاً مجدداً تلاش نمایید.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center items-center p-4 selection:bg-emerald-500/20 selection:text-emerald-800" dir="rtl">
      {/* Container */}
      <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-2xl shadow-sm p-6 sm:p-8">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-3">
            <img src="/favicon.svg" alt="LocalMe" className="w-7 h-7 object-contain" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">ثبت‌نام در لوکال می</h1>
          <p className="text-xs text-slate-500 mt-1">ایجاد حساب توسعه‌دهنده برای مدیریت دیتابیس، توابع لبه و احراز هویت</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Register Form */}
        <form onSubmit={handleRegister} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              نام و نام خانوادگی
            </label>
            <div className="relative">
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="مثلاً سهراب تهرانی"
                required
                autoFocus
                className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white focus:ring-1 focus:ring-emerald-600 transition"
              />
              <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              آدرس ایمیل
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="developer@example.com"
                dir="ltr"
                required
                className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white focus:ring-1 focus:ring-emerald-600 transition font-mono"
              />
              <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              نام کاربری <span className="text-[10px] text-slate-400 font-normal">(اختیاری)</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="sohrab_dev"
                dir="ltr"
                className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white focus:ring-1 focus:ring-emerald-600 transition font-mono"
              />
              <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              کلمه عبور <span className="text-[10px] text-slate-400 font-normal">(حداقل ۶ کاراکتر)</span>
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                dir="ltr"
                required
                className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white focus:ring-1 focus:ring-emerald-600 transition font-mono"
              />
              <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              تکرار کلمه عبور
            </label>
            <div className="relative">
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                dir="ltr"
                required
                className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white focus:ring-1 focus:ring-emerald-600 transition font-mono"
              />
              <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>تکمیل ثبت‌نام و ورود</span>
                <CheckCircle2 className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Navigation to Login */}
        <div className="mt-5 text-center text-xs text-slate-500">
          حساب کاربری دارید؟{' '}
          <Link to="/login" className="font-semibold text-emerald-700 hover:text-emerald-800 transition inline-flex items-center gap-0.5">
            <span>ورود به پنل</span>
            <ArrowRight className="w-3 h-3 rotate-180" />
          </Link>
        </div>

        {/* Security Badge Footer */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>هشینگ سازمانی Argon2id</span>
          </div>
          <span className="font-mono text-[10px] text-slate-400">لوکال می v1.0.0</span>
        </div>

      </div>
    </div>
  );
}
