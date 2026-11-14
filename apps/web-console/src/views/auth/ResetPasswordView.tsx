import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  KeyRound, 
  Mail, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ShieldCheck,
  Lock,
  ArrowRight,
  Check
} from 'lucide-react';
import { api } from '../../utils/apiClient';

export function ResetPasswordView() {
  const [step, setStep] = useState<'request' | 'confirm' | 'success'>('request');
  const [identifier, setIdentifier] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFeedback(null);

    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier) {
      setError('لطفاً آدرس ایمیل یا نام کاربری خود را وارد نمایید.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/_baas/v1/auth/password-reset/request', {
        identifier: cleanIdentifier,
      });

      if (res.resetToken) {
        setResetToken(res.resetToken);
      }
      setFeedback(res.message || 'دستورالعمل بازیابی کلمه عبور آماده گردید.');
      setStep('confirm');
    } catch (err: any) {
      setError(err.message || 'خطا در ثبت درخواست بازیابی کلمه عبور.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newPassword || newPassword.length < 6) {
      setError('کلمه عبور جدید باید حداقل ۶ کاراکتر باشد.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('کلمه عبور جدید و تکرار آن همخوانی ندارند.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/_baas/v1/auth/password-reset/confirm', {
        identifier: identifier.trim(),
        token: resetToken.trim(),
        newPassword,
      });

      if (res.success) {
        setStep('success');
      } else {
        setError(res.error || 'خطا در به‌روزرسانی کلمه عبور.');
      }
    } catch (err: any) {
      setError(err.message || 'خطا در ثبت کلمه عبور جدید.');
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
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">بازیابی کلمه عبور</h1>
          <p className="text-xs text-slate-500 mt-1">تغییر و تنظیم مجدد رمز عبور حساب توسعه‌دهنده در لوکال می</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Info Feedback */}
        {feedback && step === 'confirm' && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{feedback}</span>
          </div>
        )}

        {/* STEP 1: Request Reset */}
        {step === 'request' && (
          <form onSubmit={handleRequestReset} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                ایمیل یا نام کاربری ثبت‌شده
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="developer@example.com یا admin"
                  dir="ltr"
                  required
                  autoFocus
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white focus:ring-1 focus:ring-emerald-600 transition font-mono"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              </div>
              <span className="text-[11px] text-slate-500 mt-1.5 block leading-relaxed">
                شناسه یا آدرس ایمیلی را که در هنگام ساخت حساب کاربری استفاده نموده‌اید وارد فرمایید.
              </span>
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
                  <span>ارسال پیوند بازیابی کلمه عبور</span>
                  <ArrowRight className="w-4 h-4 rotate-180" />
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 2: Confirm & Set New Password */}
        {step === 'confirm' && (
          <form onSubmit={handleConfirmReset} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                کد تایید / توکن بازیابی
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  placeholder="توکن بازیابی"
                  dir="ltr"
                  required
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white focus:ring-1 focus:ring-emerald-600 transition font-mono"
                />
                <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                کلمه عبور جدید <span className="text-[10px] text-slate-400 font-normal">(حداقل ۶ کاراکتر)</span>
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  dir="ltr"
                  required
                  autoFocus
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white focus:ring-1 focus:ring-emerald-600 transition font-mono"
                />
                <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                تکرار کلمه عبور جدید
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
                  <span>ثبت کلمه عبور جدید</span>
                  <Check className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 3: Success Screen */}
        {step === 'success' && (
          <div className="text-center py-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-600">
              <Check className="w-6 h-6" />
            </div>
            <h2 className="text-sm font-bold text-slate-900">کلمه عبور با موفقیت تغییر یافت</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              رمز عبور جدید حساب کاربری شما با الگوریتم Argon2id ایمن گردید. اکنون می‌توانید با کلمه عبور جدید وارد شوید.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition shadow-xs"
            >
              <span>ورود به پنل با رمز عبور جدید</span>
              <ArrowRight className="w-4 h-4 rotate-180" />
            </Link>
          </div>
        )}

        {/* Navigation back to Login */}
        {step !== 'success' && (
          <div className="mt-5 text-center text-xs text-slate-500">
            بازگشت به{' '}
            <Link to="/login" className="font-semibold text-emerald-700 hover:text-emerald-800 transition inline-flex items-center gap-0.5">
              <span>صفحه ورود</span>
              <ArrowRight className="w-3 h-3 rotate-180" />
            </Link>
          </div>
        )}

        {/* Security Badge Footer */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>رمزنگاری نامتقارن Ed25519</span>
          </div>
          <span className="font-mono text-[10px] text-slate-400">لوکال می v1.0.0</span>
        </div>

      </div>
    </div>
  );
}
