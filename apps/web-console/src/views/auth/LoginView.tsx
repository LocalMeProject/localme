import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  KeyRound, 
  Smartphone, 
  Layers, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ShieldCheck,
  Server,
  Lock
} from 'lucide-react';
import { api } from '../../utils/apiClient';
import { toPersianDigits } from '../../utils/persian';
import { useAuth } from '../../components/auth/AuthGuard';

type AuthTab = 'otp' | 'credentials' | 'project';

export function LoginView() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshUser } = useAuth();

  const [activeTab, setActiveTab] = useState<AuthTab>('otp');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // OTP State
  const [phone, setPhone] = useState('');
  const [otpStep, setOtpStep] = useState<'request' | 'verify'>('request');
  const [otpCode, setOtpCode] = useState('');
  const [timerSeconds, setTimerSeconds] = useState(120);
  const [timerActive, setTimerActive] = useState(false);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);
  const otpInputRef = useRef<HTMLInputElement>(null);

  // Username & Password State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Project Scoped Login State
  const [projectSlug, setProjectSlug] = useState('');
  const [projectPassword, setProjectPassword] = useState('');

  // Parse return URL
  const searchParams = new URLSearchParams(location.search);
  const returnUrl = searchParams.get('returnUrl') || searchParams.get('redirect') || '/panel';

  // Timer countdown
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (timerActive && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev - 1);
      }, 1000);
    } else if (timerSeconds === 0) {
      setTimerActive(false);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerActive, timerSeconds]);

  // Focus OTP input when step changes
  useEffect(() => {
    if (otpStep === 'verify' && otpInputRef.current) {
      otpInputRef.current.focus();
    }
  }, [otpStep]);

  const handleCompleteAuth = async (tokens: { accessToken: string }, user: any) => {
    localStorage.setItem('localme_token', tokens.accessToken);
    localStorage.setItem('localme_user', JSON.stringify(user));
    await refreshUser();
    
    // Redirect to returnUrl (or /panel)
    const target = returnUrl.startsWith('/login') || returnUrl.startsWith('/auth') ? '/panel' : returnUrl;
    navigate(target, { replace: true });
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanedPhone = phone.trim().replace(/\s+/g, '');
    if (!cleanedPhone.match(/^09\d{9}$/)) {
      setError('شماره موبایل وارد شده باید ۱۱ رقمی و با ۰۹ آغاز شود.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/_baas/v1/auth/otp/request', { phone: cleanedPhone });
      if (res.codeForTesting) {
        setDevOtpHint(res.codeForTesting);
      }
      setOtpStep('verify');
      setTimerSeconds(120);
      setTimerActive(true);
    } catch (err: any) {
      setError(err.message || 'خطا در ارسال پیامک کد تایید.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanedPhone = phone.trim().replace(/\s+/g, '');
    const cleanedCode = otpCode.trim();

    if (cleanedCode.length < 4) {
      setError('لطفا کد تایید معتبر را وارد نمایید.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/_baas/v1/auth/otp/verify', {
        phone: cleanedPhone,
        code: cleanedCode,
      });

      if (res.tokens) {
        await handleCompleteAuth(res.tokens, res.user);
      } else {
        setError('پاسخ نامعتبر از سرور دریافت شد.');
      }
    } catch (err: any) {
      setError(err.message || 'کد تایید اشتباه است یا منقضی شده است.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError('لطفا نام کاربری و کلمه عبور را وارد نمایید.');
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
      setError('لطفا شناسه پروژه و رمز عبور اختصاصی آن را وارد نمایید.');
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

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainder = sec % 60;
    return `${toPersianDigits(mins)}:${toPersianDigits(remainder < 10 ? '0' + remainder : remainder)}`;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden" dir="rtl">
      {/* Background Glow Orbs */}
      <div className="absolute top-1/4 -right-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -left-24 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Card */}
      <div className="w-full max-w-md bg-slate-800/90 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl p-6 sm:p-8 z-10">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3 shadow-inner">
            <img src="/favicon.svg" alt="LocalMe" className="w-9 h-9 object-contain" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">ورود به سکوی لوکال می</h1>
          <p className="text-xs text-slate-400 mt-1">مدیریت ابر پایگاه‌داده، احراز هویت و توابع لبه سرور</p>
        </div>

        {/* Auth Mode Tabs */}
        <div className="grid grid-cols-3 gap-1 bg-slate-900/70 p-1 rounded-xl mb-6 border border-slate-700/50">
          <button
            type="button"
            onClick={() => { setActiveTab('otp'); setError(null); }}
            className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition ${
              activeTab === 'otp'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>پیامک سریع</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('credentials'); setError(null); }}
            className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition ${
              activeTab === 'credentials'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>رمز عبور</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('project'); setError(null); }}
            className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition ${
              activeTab === 'project'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>ورود پروژه</span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2 animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Tab 1: OTP Authentication */}
        {activeTab === 'otp' && (
          <div>
            {otpStep === 'request' ? (
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    شماره تلفن همراه
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                      dir="ltr"
                      required
                      autoFocus
                      className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition font-mono"
                    />
                    <Smartphone className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    کد یک‌بار مصرف ۶ رقمی برای این شماره ارسال خواهد شد.
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-emerald-950/40"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>ارسال کد تایید</span>
                      <ArrowLeft className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="text-center mb-2">
                  <div className="text-xs text-slate-300">
                    کد تایید ارسال شده به شماره <span className="font-mono text-emerald-400 font-bold" dir="ltr">{phone}</span> را وارد نمایید.
                  </div>
                  <button
                    type="button"
                    onClick={() => { setOtpStep('request'); setOtpCode(''); setDevOtpHint(null); }}
                    className="text-[11px] text-emerald-400 hover:underline mt-1 inline-block"
                  >
                    تغییر شماره موبایل
                  </button>
                </div>

                {devOtpHint && (
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center justify-between">
                    <span>کد محیط توسعه / آزمایشی:</span>
                    <button
                      type="button"
                      onClick={() => setOtpCode(devOtpHint)}
                      className="font-mono font-bold bg-emerald-600/30 px-2 py-0.5 rounded text-white hover:bg-emerald-600/50 transition"
                      dir="ltr"
                    >
                      {devOtpHint} (درج خودکار)
                    </button>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5 text-center">
                    کد تایید ۶ رقمی
                  </label>
                  <input
                    ref={otpInputRef}
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="______"
                    dir="ltr"
                    required
                    className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-3.5 py-3 text-center text-xl font-bold tracking-widest text-emerald-400 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition font-mono"
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400">
                  {timerActive ? (
                    <span className="flex items-center gap-1">
                      <span>زمان باقی‌مانده:</span>
                      <span className="font-mono text-white font-semibold">{formatTimer(timerSeconds)}</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRequestOtp}
                      className="text-emerald-400 hover:text-emerald-300 transition text-xs font-medium"
                    >
                      ارسال مجدد پیامک کد تایید
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-emerald-950/40"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>تایید و ورود به پنل</span>
                      <CheckCircle2 className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Tab 2: Username & Password */}
        {activeTab === 'credentials' && (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                نام کاربری یا شماره همراه
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin یا ۰۹۱۲۳۴۵۶۷۸۹"
                  dir="ltr"
                  required
                  autoFocus
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition font-mono"
                />
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                کلمه عبور
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  dir="ltr"
                  required
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition font-mono"
                />
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-emerald-950/40"
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

        {/* Tab 3: Project-Scoped Direct Access */}
        {activeTab === 'project' && (
          <form onSubmit={handleProjectLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
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
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition font-mono"
                />
                <Server className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                شناسه یکتای پروژه در هنگام ساخت آن تعریف شده است.
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
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
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition font-mono"
                />
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-emerald-950/40"
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

        {/* Security Badge Footer */}
        <div className="mt-6 pt-4 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>اتصال امن رمزنگاری‌شده TLS 1.3</span>
          </div>
          <span className="font-mono text-[10px] text-slate-500">v1.0.0-pure-pg</span>
        </div>

      </div>
    </div>
  );
}
