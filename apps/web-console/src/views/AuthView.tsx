import React, { useState } from 'react';
import { Project, ProjectUser } from '../types';
import {
  Users,
  Smartphone,
  Trash2,
  KeyRound,
  Plus,
  CheckCircle2,
} from 'lucide-react';

interface AuthViewProps {
  project: Project;
  onOpenAddUserModal: () => void;
}

const INITIAL_USERS: ProjectUser[] = [];

export type OtpProvider = 'kavenegar' | 'melipayamak';

export const AuthView: React.FC<AuthViewProps> = ({ project, onOpenAddUserModal }) => {
  const [users, setUsers] = useState<ProjectUser[]>(INITIAL_USERS);
  const [testPhone, setTestPhone] = useState('09121112233');
  const [otpProvider, setOtpProvider] = useState<OtpProvider>('kavenegar');
  const [otpSentFeedback, setOtpSentFeedback] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  // Security Policies
  const [otpExpiry, setOtpExpiry] = useState('120');
  const [otpLength, setOtpLength] = useState('6');
  const [enableCaptcha, setEnableCaptcha] = useState(false);
  const [allowPasswordAuth, setAllowPasswordAuth] = useState(true);

  const handleSendTestOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSendingOtp(true);
    setOtpSentFeedback(null);

    setTimeout(() => {
      setIsSendingOtp(false);
      setOtpSentFeedback(`کد تایید با موفقیت برای شماره ${testPhone} ارسال شد.`);
    }, 400);
  };

  const handleToggleUserStatus = (userId: string) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, isConfirmed: !u.isConfirmed } : u))
    );
  };

  const handleDeleteUser = (userId: string) => {
    if (!confirm('آیا از حذف این کاربر اطمینان دارید؟')) return;
    setUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              کاربران و احراز هویت
            </span>
            <span className="text-xs text-slate-400 font-mono" dir="ltr">
              {project.slug}
            </span>
          </div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            مدیریت کاربران و ورود پیامکی
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            مدیریت حساب‌های کاربری، ارسال کدهای ورود یکبار مصرف پیامکی و پیکربندی سیاست‌های دسترسی امنیتی.
          </p>
        </div>

        <button
          onClick={onOpenAddUserModal}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>افزودن کاربر جدید</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Users Table */}
        <div className="lg:col-span-8 p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="text-xs font-bold text-slate-900">
              فهرست کاربران ({users.length})
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-right text-xs" dir="rtl">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                  <th className="py-2.5 px-3">نام و نام‌خانوادگی</th>
                  <th className="py-2.5 px-3 text-center">روش ورود</th>
                  <th className="py-2.5 px-3 text-center">اطلاعات تماس</th>
                  <th className="py-2.5 px-3 text-center">وضعیت</th>
                  <th className="py-2.5 px-3 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-xs text-slate-400">
                      هنوز کاربری در این پروژه ثبت‌نام نکرده است.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-800">{u.fullName}</div>
                        {u.username && (
                          <div className="text-[10px] text-slate-400 font-mono" dir="ltr">
                            @{u.username}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700 font-medium">
                          {u.provider === 'sms' ? 'پیامک' : 'گذرواژه'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-700" dir="ltr">
                        {u.phone || u.email}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            u.isConfirmed
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}
                        >
                          {u.isConfirmed ? 'فعال' : 'در انتظار'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleToggleUserStatus(u.id)}
                            className="px-2.5 py-1 rounded-md text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                          >
                            {u.isConfirmed ? 'تعلیق' : 'فعال‌سازی'}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="حذف کاربر"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* SMS OTP Test Studio & Policies */}
        <div className="lg:col-span-4 space-y-4">
          {/* SMS OTP Simulator */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-emerald-600" />
              ارسال پیامک آزمایشی
            </h3>

            <form onSubmit={handleSendTestOtp} className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-600 font-medium block mb-1">
                  ارائه‌دهنده سرویس پیامک
                </label>
                <select
                  value={otpProvider}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setOtpProvider(e.target.value as OtpProvider)
                  }
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                >
                  <option value="kavenegar">کاوه‌نگار (خط خدماتی)</option>
                  <option value="melipayamak">ملی‌پیامک (وب‌سرویس خدماتی)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-600 font-medium block mb-1">
                  شماره موبایل دریافت‌کننده
                </label>
                <input
                  type="text"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                  dir="ltr"
                />
              </div>

              <button
                type="submit"
                disabled={isSendingOtp}
                className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition shadow-xs disabled:opacity-50"
              >
                {isSendingOtp ? 'در حال ارسال پیامک...' : 'ارسال کد پیامکی آزمایشی'}
              </button>

              {otpSentFeedback && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 leading-relaxed flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{otpSentFeedback}</span>
                </div>
              )}
            </form>
          </div>

          {/* Security Policies */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-emerald-600" />
              سیاست‌های امنیتی و ورود
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">طول کد تایید:</span>
                <select
                  value={otpLength}
                  onChange={(e) => setOtpLength(e.target.value)}
                  className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 font-mono text-xs focus:outline-none focus:border-emerald-500"
                  dir="ltr"
                >
                  <option value="4">4 digits</option>
                  <option value="5">5 digits</option>
                  <option value="6">6 digits</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600">زمان اعتبار کد (ثانیه):</span>
                <select
                  value={otpExpiry}
                  onChange={(e) => setOtpExpiry(e.target.value)}
                  className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 font-mono text-xs focus:outline-none focus:border-emerald-500"
                  dir="ltr"
                >
                  <option value="60">60s</option>
                  <option value="120">120s</option>
                  <option value="300">300s</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600">کپچای امنیتی:</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableCaptcha}
                    onChange={(e) => setEnableCaptcha(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-[11px] text-slate-500">
                    {enableCaptcha ? 'فعال' : 'غیرفعال'}
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600">ورود با کلمه عبور:</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowPasswordAuth}
                    onChange={(e) => setAllowPasswordAuth(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-[11px] text-slate-500">
                    {allowPasswordAuth ? 'مجاز' : 'غیرمجاز'}
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
