import React, { useState, useEffect, useCallback } from 'react';
import { Project, ProjectUser } from '../types';
import {
  Users,
  Trash2,
  KeyRound,
  Plus,
  RefreshCw,
  Search,
  Save,
} from 'lucide-react';
import { ConfirmModal } from '../components/modals/ConfirmModal';
import { ResetPasswordModal } from '../components/modals/ResetPasswordModal';

interface AuthViewProps {
  project: Project;
  onOpenAddUserModal: () => void;
  activeSubView?: string;
  onSubViewChange?: (subView: string) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({
  project,
  onOpenAddUserModal,
  activeSubView = 'users',
}) => {
  const [users, setUsers] = useState<ProjectUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [userToResetPassword, setUserToResetPassword] = useState<ProjectUser | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Security Policies State
  const [jwtExpiryHours, setJwtExpiryHours] = useState('72');
  const [minPasswordLength, setMinPasswordLength] = useState('8');
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
              provider: String(u.provider || u.Provider || 'email'),
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
          if (data.jwtExpiryHours) setJwtExpiryHours(String(data.jwtExpiryHours));
          if (data.minPasswordLength) setMinPasswordLength(String(data.minPasswordLength));
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
          jwt_expiry_hours: jwtExpiryHours,
          min_password_length: minPasswordLength,
          allow_password_auth: allowPasswordAuth ? 'true' : 'false',
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
      (u.email || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.phone || '').includes(q)
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
            {activeSubView === 'policies'
              ? 'سیاست‌های امنیتی و دسترسی'
              : 'مدیریت کاربران و دسترسی‌ها'}
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            {activeSubView === 'policies'
              ? 'پیکربندی حداقل طول کلمه عبور، زمان انقضای توکن‌ها و الزامات امنیتی ورود به سامانه.'
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

      {/* Sub-View: Security Policies */}
      {activeSubView === 'policies' && (
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs max-w-2xl space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <KeyRound className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">سیاست‌های امنیتی و اعتبار توکن‌های ورود</h3>
          </div>

          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="font-semibold text-slate-800">حداقل طول کلمه عبور (Argon2id)</div>
                <div className="text-[11px] text-slate-400">حداقل کاراکتر مجاز برای رمزهای عبور کاربران</div>
              </div>
              <select
                value={minPasswordLength}
                onChange={(e) => setMinPasswordLength(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 font-mono text-xs focus:outline-none focus:border-emerald-500 shadow-xs"
                dir="ltr"
              >
                <option value="8">8 کاراکتر (حداقل مجاز)</option>
                <option value="10">10 کاراکتر</option>
                <option value="12">12 کاراکتر (توصیه شده)</option>
                <option value="16">16 کاراکتر (امنیت سازمانی)</option>
              </select>
            </div>

            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="font-semibold text-slate-800">زمان انقضای توکن دسترسی JWT (ساعت)</div>
                <div className="text-[11px] text-slate-400">مدت اعتبار کلید دسترسی قبل از نیاز به توکن تازه‌سازی (Refresh Token)</div>
              </div>
              <select
                value={jwtExpiryHours}
                onChange={(e) => setJwtExpiryHours(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 font-mono text-xs focus:outline-none focus:border-emerald-500 shadow-xs"
                dir="ltr"
              >
                <option value="1">1 ساعت</option>
                <option value="24">24 ساعت (1 روز)</option>
                <option value="72">72 ساعت (استاندارد)</option>
                <option value="168">168 ساعت (1 هفته)</option>
              </select>
            </div>

            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="font-semibold text-slate-800">احراز هویت با کلمه عبور</div>
                <div className="text-[11px] text-slate-400">ورود امن کاربران از طریق هشینگ Argon2id و کلیدهای Ed25519</div>
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
      {(activeSubView === 'users' || (!activeSubView && activeSubView !== 'policies')) && (
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
                placeholder="جستجوی کاربر یا ایمیل..."
                className="w-full pr-8 pl-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 shadow-xs"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-right text-xs" dir="rtl">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                  <th className="py-2.5 px-3">شناسه و نام</th>
                  <th className="py-2.5 px-3 text-center">ایمیل / نام کاربری</th>
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
                        {u.email || u.username || u.phone || '-'}
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
                            onClick={() => setUserToResetPassword(u)}
                            className="p-1 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition"
                            title="تغییر رمز عبور کاربر"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
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

      {/* Reset Password Modal */}
      <ResetPasswordModal
        isOpen={Boolean(userToResetPassword)}
        user={userToResetPassword}
        projectSlug={project.slug}
        onClose={() => setUserToResetPassword(null)}
        onSuccess={(msg) => {
          setToastMessage(msg);
          setTimeout(() => setToastMessage(null), 4000);
        }}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 shadow-xl text-white text-xs font-medium flex items-center gap-2 animate-in slide-in-from-bottom-2">
          <span>{toastMessage}</span>
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
