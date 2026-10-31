import React, { useState, useEffect, useCallback } from 'react';
import { Project, ProjectUser } from '../types';
import {
  Users,
  Smartphone,
  Trash2,
  KeyRound,
  Plus,
  CheckCircle2,
  RefreshCw,
  Search,
  Save,
} from 'lucide-react';
import { ConfirmModal } from '../components/modals/ConfirmModal';

interface AuthViewProps {
  project: Project;
  onOpenAddUserModal: () => void;
  activeSubView?: string;
  onSubViewChange?: (subView: string) => void;
}

export type OtpProvider = 'kavenegar' | 'melipayamak';

export const AuthView: React.FC<AuthViewProps> = ({
  project,
  onOpenAddUserModal,
  activeSubView = 'users',
}) => {
  const [users, setUsers] = useState<ProjectUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  // SMS OTP Test State
  const [testPhone, setTestPhone] = useState('09121112233');
  const [otpProvider, setOtpProvider] = useState<OtpProvider>('kavenegar');
  const [otpSentFeedback, setOtpSentFeedback] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  // Security Policies State
  const [otpExpiry, setOtpExpiry] = useState('120');
  const [otpLength, setOtpLength] = useState('6');
  const [enableCaptcha, setEnableCaptcha] = useState(false);
  const [allowPasswordAuth, setAllowPasswordAuth] = useState(true);
  const [policyFeedback, setPolicyFeedback] = useState<string | null>(null);
  const [isSavingPolicies, setIsSavingPolicies] = useState(false);

  // Real API: Fetch Users
  const fetchUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const res = await fetch(`/_baas/v1/${project.slug}/auth/users`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setUsers(
            data.map((u: Record<string, unknown>) => ({
              id: String(u.id || u.Id || ''),
              phone: String(u.phone || u.Phone || ''),
              email: String(u.email || u.Email || ''),
              username: String(u.username || u.Username || ''),
              fullName: String(u.fullName || u.name || u.FullName || ''),
              provider: String(u.provider || u.Provider || 'sms'),
              role: String(u.role || u.Role || 'user'),
              isConfirmed: Boolean(u.isConfirmed ?? u.IsConfirmed ?? true),
              createdAt: String(u.createdAt || u.CreatedAt || new Date().toISOString()),
            }))
          );
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingUsers(false);
    }
  }, [project.slug]);

  // Real API: Fetch Policies
  const fetchPolicies = useCallback(async () => {
    try {
      const res = await fetch(`/_baas/v1/${project.slug}/auth/policies`);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          if (data.otpExpirySeconds) setOtpExpiry(String(data.otpExpirySeconds));
          if (data.otpLength) setOtpLength(String(data.otpLength));
          if (typeof data.enableCaptcha === 'boolean') setEnableCaptcha(data.enableCaptcha);
          if (typeof data.allowPasswordAuth === 'boolean') setAllowPasswordAuth(data.allowPasswordAuth);
        }
      }
    } catch {
      // ignore
    }
  }, [project.slug]);

  useEffect(() => {
    fetchUsers();
    fetchPolicies();
  }, [fetchUsers, fetchPolicies]);

  // Real API: Send OTP
  const handleSendTestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSendingOtp(true);
    setOtpSentFeedback(null);

    try {
      const res = await fetch(`/_baas/v1/${project.slug}/auth/otp/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone, provider: otpProvider }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setOtpSentFeedback(
          data.message || `کد تایید با موفقیت از طریق ${otpProvider === 'kavenegar' ? 'کاوه‌نگار' : 'ملی‌پیامک'} برای شماره ${testPhone} ارسال شد.`
        );
      } else {
        setOtpSentFeedback(`خطا در ارسال پیامک: ${data.error || res.statusText}`);
      }
    } catch {
      setOtpSentFeedback('خطا در برقراری ارتباط با درگاه پیامک.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Real API: Toggle User Status
  const handleToggleUserStatus = async (user: ProjectUser) => {
    const nextStatus = !user.isConfirmed;
    try {
      const res = await fetch(`/_baas/v1/${project.slug}/auth/users/${user.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isConfirmed: nextStatus }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, isConfirmed: nextStatus } : u))
        );
      }
    } catch {
      // ignore
    }
  };

  // Real API: Delete User
  const handleDeleteUser = (userId: string) => {
    setUserToDelete(userId);
  };

  const executeDeleteUser = async (userId: string) => {
    setUserToDelete(null);
    try {
      const res = await fetch(`/_baas/v1/${project.slug}/auth/users/${userId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
      }
    } catch {
      // ignore
    }
  };

  // Real API: Save Security Policies
  const handleSavePolicies = async () => {
    setIsSavingPolicies(true);
    setPolicyFeedback(null);
    try {
      const res = await fetch(`/_baas/v1/${project.slug}/auth/policies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          otpExpirySeconds: parseInt(otpExpiry, 10),
          otpLength: parseInt(otpLength, 10),
          enableCaptcha,
          allowPasswordAuth,
        }),
      });
      if (res.ok) {
        setPolicyFeedback('سیاست‌های امنیتی با موفقیت در سرور ذخیره گردید.');
      } else {
        setPolicyFeedback('خطا در ذخیره سیاست‌های امنیتی.');
      }
    } catch {
      setPolicyFeedback('خطا در برقراری ارتباط با سرور.');
    } finally {
      setIsSavingPolicies(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return (
      (u.fullName || '').toLowerCase().includes(q) ||
      (u.phone || '').includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q)
    );
  });

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
            {activeSubView === 'sms'
              ? 'سرویس پیامک و ورود یکبار مصرف'
              : activeSubView === 'policies'
              ? 'سیاست‌های امنیتی و دسترسی'
              : 'مدیریت کاربران و دسترسی‌ها'}
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            {activeSubView === 'sms'
              ? 'تست خطوط خدماتی کاوه‌نگار و ملی‌پیامک و بررسی دریافت پیامک‌های حاوی کد اعتبارسنجی.'
              : activeSubView === 'policies'
              ? 'پیکربندی طول کدهای احراز هویت، زمان انقضا و الزامات امنیتی ورود به سامانه.'
              : 'مشاهده فهرست کاربران فعال، نقش‌های سازمانی و صدور دسترسی به صورت لحظه‌ای.'}
          </p>
        </div>

        {activeSubView === 'users' && (
          <div className="flex items-center gap-2">
            <button
              onClick={fetchUsers}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition shadow-xs"
              title="بازخوانی کاربران"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingUsers ? 'animate-spin' : ''}`} />
              <span>بازخوانی</span>
            </button>
            <button
              onClick={onOpenAddUserModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>افزودن کاربر جدید</span>
            </button>
          </div>
        )}
      </div>

      {/* Sub-View: SMS OTP Simulator */}
      {activeSubView === 'sms' && (
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs max-w-2xl space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Smartphone className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">ارسال پیامک آزمایشی به شماره همراه</h3>
          </div>

          <form onSubmit={handleSendTestOtp} className="space-y-4">
            <div>
              <label className="text-xs text-slate-700 font-medium block mb-1.5">
                ارائه‌دهنده سرویس پیامک
              </label>
              <select
                value={otpProvider}
                onChange={(e) => setOtpProvider(e.target.value as OtpProvider)}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 shadow-xs"
              >
                <option value="kavenegar">کاوه‌نگار (خط خدماتی اختصاصی)</option>
                <option value="melipayamak">ملی‌پیامک (وب‌سرویس خدماتی)</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-700 font-medium block mb-1.5">
                شماره همراه گیرنده
              </label>
              <input
                type="text"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xs text-slate-800 focus:outline-none focus:border-emerald-500 shadow-xs"
                placeholder="09121112233"
                dir="ltr"
              />
            </div>

            <button
              type="submit"
              disabled={isSendingOtp}
              className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition shadow-xs disabled:opacity-50 inline-flex items-center gap-2"
            >
              {isSendingOtp ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>در حال ارسال پیامک...</span>
                </>
              ) : (
                <>
                  <Smartphone className="w-4 h-4" />
                  <span>ارسال کد پیامکی آزمایشی</span>
                </>
              )}
            </button>

            {otpSentFeedback && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 leading-relaxed flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{otpSentFeedback}</span>
              </div>
            )}
          </form>
        </div>
      )}

      {/* Sub-View: Security Policies */}
      {activeSubView === 'policies' && (
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs max-w-2xl space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <KeyRound className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">سیاست‌های امنیتی و اعتبار کدهای ورود</h3>
          </div>

          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="font-semibold text-slate-800">طول کد تایید پیامکی</div>
                <div className="text-[11px] text-slate-400">تعداد ارقام رمز یکبار مصرف ارسالی برای کاربر</div>
              </div>
              <select
                value={otpLength}
                onChange={(e) => setOtpLength(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 font-mono text-xs focus:outline-none focus:border-emerald-500 shadow-xs"
                dir="ltr"
              >
                <option value="4">4 digits</option>
                <option value="5">5 digits</option>
                <option value="6">6 digits</option>
              </select>
            </div>

            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="font-semibold text-slate-800">مدت زمان اعتبار کد (ثانیه)</div>
                <div className="text-[11px] text-slate-400">مدت زمانی که کاربر فرصت دارد کد را وارد نماید</div>
              </div>
              <select
                value={otpExpiry}
                onChange={(e) => setOtpExpiry(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 font-mono text-xs focus:outline-none focus:border-emerald-500 shadow-xs"
                dir="ltr"
              >
                <option value="60">60 ثانیه</option>
                <option value="120">120 ثانیه (استاندارد)</option>
                <option value="300">300 ثانیه</option>
              </select>
            </div>

            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="font-semibold text-slate-800">کپچای امنیتی هوشمند</div>
                <div className="text-[11px] text-slate-400">جلوگیری از ارسال انبوه درخواست‌های پیامکی توسط ربات‌ها</div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableCaptcha}
                  onChange={(e) => setEnableCaptcha(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span className="text-xs text-slate-600">
                  {enableCaptcha ? 'فعال' : 'غیرفعال'}
                </span>
              </label>
            </div>

            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="font-semibold text-slate-800">احراز هویت با کلمه عبور</div>
                <div className="text-[11px] text-slate-400">امکان ورود با پسورد ثابت علاوه بر کد پیامکی</div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowPasswordAuth}
                  onChange={(e) => setAllowPasswordAuth(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span className="text-xs text-slate-600">
                  {allowPasswordAuth ? 'مجاز' : 'غیرمجاز'}
                </span>
              </label>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                onClick={handleSavePolicies}
                disabled={isSavingPolicies}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition shadow-xs disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingPolicies ? 'در حال ذخیره‌سازی...' : 'ذخیره تغییرات سیاست‌ها'}</span>
              </button>

              {policyFeedback && (
                <span className="text-xs text-emerald-700 font-medium">
                  {policyFeedback}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sub-View: Users Table (Default) */}
      {(activeSubView === 'users' || (!activeSubView && activeSubView !== 'sms' && activeSubView !== 'policies')) && (
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">
                فهرست کاربران ({filteredUsers.length})
              </span>
            </div>

            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="جستجوی کاربر یا شماره..."
                className="w-full pr-8 pl-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 shadow-xs"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-right text-xs" dir="rtl">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                  <th className="py-2.5 px-3">شناسه و نام</th>
                  <th className="py-2.5 px-3 text-center">شماره همراه / ایمیل</th>
                  <th className="py-2.5 px-3 text-center">نقش</th>
                  <th className="py-2.5 px-3 text-center">وضعیت حساب</th>
                  <th className="py-2.5 px-3 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoadingUsers ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-xs text-slate-500">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                        <span>در حال بارگذاری کاربران از سرور...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-xs text-slate-400">
                      هنوز کاربری در این پروژه ثبت نشده است. برای ثبت اولین کاربر، روی دکمه «افزودن کاربر جدید» کلیک کنید.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-800">{u.fullName || 'کاربر بدون نام'}</div>
                        <div className="text-[10px] text-slate-400 font-mono" dir="ltr">
                          {u.id}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-700" dir="ltr">
                        {u.phone || u.email || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700 font-medium">
                          {u.role === 'admin' ? 'مدیر' : 'کاربر'}
                        </span>
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
                            onClick={() => handleToggleUserStatus(u)}
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
      )}

      {/* Accessible Confirm Modal for User Deletion */}
      <ConfirmModal
        isOpen={Boolean(userToDelete)}
        title="حذف حساب کاربر"
        message="آیا از حذف دائم این حساب کاربری اطمینان دارید؟ تمام دسترسی‌های کاربر لغو خواهد شد."
        confirmLabel="حذف کاربر"
        isDanger={true}
        onConfirm={() => {
          if (userToDelete) executeDeleteUser(userToDelete);
        }}
        onCancel={() => setUserToDelete(null)}
      />
    </div>
  );
};
