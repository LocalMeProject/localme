import React, { useState } from 'react';
import { Project, ProjectUser } from '../types';
import {
  Users,
  Smartphone,
  Trash2,
  KeyRound,
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
      setOtpSentFeedback(`کد تایید ۶ رقمی به شماره ${testPhone} از طریق وب‌سرویس ${otpProvider} با موفقیت ارسال شد.`);
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
      <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-400" />
            احراز هویت جامع کاربران اپلیکیشن (IDaaS)
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            ورود پیامکی OTP با خطوط اختصاصی، توکن‌های امن Ed25519/Argon2id و رمزنگاری گذرواژه.
          </p>
        </div>

        <button
          onClick={onOpenAddUserModal}
          className="px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs transition shadow-sm"
        >
          + افزودن کاربر جدید
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Users Table */}
        <div className="lg:col-span-8 p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <span className="text-xs font-bold text-zinc-200">
              کاربران ثبت‌نام شده ({users.length})
            </span>
            <span className="text-[10px] text-zinc-400 font-mono">
              PostgreSQL 18: auth_{project.slug}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-zinc-800/60 text-zinc-400">
                  <th className="py-2.5 px-3">نام و مشخصات</th>
                  <th className="py-2.5 px-3">روش ورود</th>
                  <th className="py-2.5 px-3">شناسه تماس</th>
                  <th className="py-2.5 px-3">وضعیت</th>
                  <th className="py-2.5 px-3 text-right">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-zinc-500">
                      هیچ کاربری ثبت نام نکرده است
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                  <tr key={u.id} className="hover:bg-zinc-850/30">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-zinc-200">{u.fullName}</div>
                      {u.username && <div className="text-[10px] text-zinc-500">@{u.username}</div>}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-300 font-bold border border-zinc-700/60">
                        {u.provider}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-zinc-300">{u.phone || u.email}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.isConfirmed
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-zinc-800 text-zinc-500'
                        }`}
                      >
                        {u.isConfirmed ? 'فعال و تاییدشده' : 'معلق'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => handleToggleUserStatus(u.id)}
                          className="px-2 py-1 rounded text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                        >
                          {u.isConfirmed ? 'تعلیق' : 'فعال‌سازی'}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          className="p-1 rounded text-red-400 hover:bg-zinc-800"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SMS OTP Test Studio & Policies */}
        <div className="lg:col-span-4 space-y-4">
          {/* SMS OTP Simulator */}
          <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-3">
            <h4 className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-amber-400" />
              تست ارسال پیامک تایید (OTP Simulator)
            </h4>

            <form onSubmit={handleSendTestOtp} className="space-y-3">
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">ارائه‌دهنده پیامک</label>
                <select
                  value={otpProvider}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setOtpProvider(e.target.value as OtpProvider)}
                  className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:outline-none"
                >
                  <option value="kavenegar">کاوه‌نگار (خط ۳۰۰۰۷۷۷)</option>
                  <option value="melipayamak">ملی‌پیامک (وب‌سرویس خدماتی)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">شماره موبایل تست</label>
                <input
                  type="text"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-200"
                />
              </div>

              <button
                type="submit"
                disabled={isSendingOtp}
                className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition"
              >
                {isSendingOtp ? 'در حال ارسال پیامک...' : 'ارسال کد آزمایشی'}
              </button>

              {otpSentFeedback && (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400 leading-relaxed">
                  {otpSentFeedback}
                </div>
              )}
            </form>
          </div>

          {/* Security Policies */}
          <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-3">
            <h4 className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-amber-400" />
              سیاست‌های امنیتی و نشست‌ها
            </h4>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">طول کد تایید پیامک:</span>
                <select
                  value={otpLength}
                  onChange={(e) => setOtpLength(e.target.value)}
                  className="px-2 py-1 rounded bg-zinc-950 border border-zinc-800 text-zinc-200 font-mono text-xs focus:outline-none"
                >
                  <option value="4">۴ رقم</option>
                  <option value="5">۵ رقم</option>
                  <option value="6">۶ رقم (پیش‌فرض)</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">زمان انقضای کد OTP:</span>
                <select
                  value={otpExpiry}
                  onChange={(e) => setOtpExpiry(e.target.value)}
                  className="px-2 py-1 rounded bg-zinc-950 border border-zinc-800 text-zinc-200 font-mono text-xs focus:outline-none"
                >
                  <option value="60">۶۰ ثانیه</option>
                  <option value="120">۱۲۰ ثانیه</option>
                  <option value="300">۳۰۰ ثانیه</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">کپچای ضدروبات:</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableCaptcha}
                    onChange={(e) => setEnableCaptcha(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">ورود با کلمه عبور:</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowPasswordAuth}
                    onChange={(e) => setAllowPasswordAuth(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
