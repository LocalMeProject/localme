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
      <div className="p-5 rounded-2xl bg-[#171717] border border-[#242424] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-[#3ECF8E]/10 text-[#3ECF8E] border border-[#3ECF8E]/30">
              IDAAS & SMS GATEWAY
            </span>
            <span className="text-xs text-zinc-400 font-mono">
              SCHEMA: auth_{project.slug}
            </span>
          </div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-[#3ECF8E]" />
            احراز هویت جامع کاربران اپلیکیشن (IDaaS)
          </h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-2xl leading-relaxed">
            ورود پیامکی OTP با خطوط خدماتی، توکن‌های امن Ed25519/Argon2id و رمزنگاری گذرواژه.
          </p>
        </div>

        <button
          onClick={onOpenAddUserModal}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#3ECF8E] hover:bg-[#34b27b] text-black font-semibold text-xs transition shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>افزودن کاربر جدید</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Users Table */}
        <div className="lg:col-span-8 p-5 rounded-2xl bg-[#171717] border border-[#242424] space-y-3">
          <div className="flex items-center justify-between border-b border-[#242424] pb-3">
            <span className="text-xs font-bold text-white">
              کاربران ثبت‌نام شده ({users.length})
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">
              PostgreSQL 18
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#242424]">
            <table className="w-full text-left text-xs font-mono" dir="ltr">
              <thead>
                <tr className="border-b border-[#242424] bg-[#1a1a1a] text-zinc-400">
                  <th className="py-2.5 px-3">Full Name</th>
                  <th className="py-2.5 px-3">Provider</th>
                  <th className="py-2.5 px-3">Contact</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#242424]">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-zinc-500 font-sans" dir="rtl">
                      هیچ کاربری ثبت نام نکرده است
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="hover:bg-[#1f1f1f] transition">
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-white">{u.fullName}</div>
                        {u.username && <div className="text-[10px] text-zinc-500">@{u.username}</div>}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#1f1f1f] text-zinc-300 font-bold border border-[#2e2e2e]">
                          {u.provider}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-zinc-300">{u.phone || u.email}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.isConfirmed
                              ? 'bg-[#3ECF8E]/10 text-[#3ECF8E] border border-[#3ECF8E]/30'
                              : 'bg-[#1f1f1f] text-zinc-500 border border-[#2e2e2e]'
                          }`}
                        >
                          {u.isConfirmed ? 'CONFIRMED' : 'PENDING'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleToggleUserStatus(u.id)}
                            className="px-2.5 py-1 rounded-full text-[10px] bg-[#1f1f1f] hover:bg-[#282828] text-zinc-300 border border-[#2e2e2e] transition"
                          >
                            {u.isConfirmed ? 'Suspend' : 'Activate'}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="p-1 rounded-full text-zinc-500 hover:text-red-400 hover:bg-[#1f1f1f] transition"
                            title="Delete"
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
          <div className="p-4 rounded-2xl bg-[#171717] border border-[#242424] space-y-3">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-[#3ECF8E]" />
              تست ارسال پیامک تایید (OTP Simulator)
            </h4>

            <form onSubmit={handleSendTestOtp} className="space-y-3">
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">ارائه‌دهنده پیامک</label>
                <select
                  value={otpProvider}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setOtpProvider(e.target.value as OtpProvider)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#0f0f0f] border border-[#242424] text-xs text-zinc-200 focus:outline-none focus:border-[#3ECF8E]"
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
                  className="w-full px-3 py-1.5 rounded-lg bg-[#0f0f0f] border border-[#242424] font-mono text-xs text-zinc-200 focus:outline-none focus:border-[#3ECF8E]"
                  dir="ltr"
                />
              </div>

              <button
                type="submit"
                disabled={isSendingOtp}
                className="w-full py-2 rounded-full bg-[#3ECF8E] hover:bg-[#34b27b] text-black font-semibold text-xs transition shadow-sm disabled:opacity-50"
              >
                {isSendingOtp ? 'در حال ارسال پیامک...' : 'ارسال کد آزمایشی'}
              </button>

              {otpSentFeedback && (
                <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-[11px] text-[#3ECF8E] leading-relaxed flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>{otpSentFeedback}</span>
                </div>
              )}
            </form>
          </div>

          {/* Security Policies */}
          <div className="p-4 rounded-2xl bg-[#171717] border border-[#242424] space-y-3">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-[#3ECF8E]" />
              سیاست‌های امنیتی و نشست‌ها
            </h4>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">طول کد تایید پیامک:</span>
                <select
                  value={otpLength}
                  onChange={(e) => setOtpLength(e.target.value)}
                  className="px-2.5 py-1 rounded-full bg-[#0f0f0f] border border-[#242424] text-zinc-200 font-mono text-xs focus:outline-none focus:border-[#3ECF8E]"
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
                  className="px-2.5 py-1 rounded-full bg-[#0f0f0f] border border-[#242424] text-zinc-200 font-mono text-xs focus:outline-none focus:border-[#3ECF8E]"
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
                  <div className="w-8 h-4 bg-[#242424] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#3ECF8E]"></div>
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
                  <div className="w-8 h-4 bg-[#242424] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#3ECF8E]"></div>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
