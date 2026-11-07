import { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  ShieldCheck, 
  ShieldAlert, 
  Shield, 
  RefreshCw, 
  Edit2, 
  AlertCircle,
  Wallet,
  PlusCircle,
  MinusCircle,
  UserPlus,
  Key,
  LogIn,
  FolderGit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  CheckCircle2,
  Copy,
  ExternalLink
} from 'lucide-react';
import { api } from '../../utils/apiClient';
import { formatToman, toPersianDigits } from '../../utils/persian';

interface PlatformUserItem {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  username?: string;
  role: number | string; // 0: Superadmin, 1: Operator, 2: Developer
  walletBalanceIrr: number;
  isActive?: boolean;
  createdAtUtc: string;
}

interface UserProjectItem {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAtUtc: string;
}

export function UsersPermissionsView() {
  const [users, setUsers] = useState<PlatformUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Role Edit Modal
  const [editingUser, setEditingUser] = useState<PlatformUserItem | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('Developer');
  const [savingRole, setSavingRole] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);

  // Credit Adjustment Modal
  const [creditUser, setCreditUser] = useState<PlatformUserItem | null>(null);
  const [creditAction, setCreditAction] = useState<'add' | 'deduct'>('add');
  const [creditAmountToman, setCreditAmountToman] = useState<number>(50000);
  const [savingCredit, setSavingCredit] = useState(false);
  const [creditError, setCreditError] = useState<string | null>(null);

  // Create User Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('Developer');
  const [creatingUser, setCreatingUser] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Reset Password Modal
  const [pwdUser, setPwdUser] = useState<PlatformUserItem | null>(null);
  const [newPwd, setNewPwd] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);

  // Impersonate Modal / Status
  const [impersonateToken, setImpersonateToken] = useState<string | null>(null);
  const [impersonateUser, setImpersonateUser] = useState<PlatformUserItem | null>(null);

  // User Projects Modal
  const [projectsUser, setProjectsUser] = useState<PlatformUserItem | null>(null);
  const [userProjects, setUserProjects] = useState<UserProjectItem[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Delete User Confirmation
  const [deletingUser, setDeletingUser] = useState<PlatformUserItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/_baas/v1/users');
      if (Array.isArray(res)) {
        setUsers(res);
      }
    } catch (err) {
      console.error('Failed to load users', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const getRoleLabel = (role: number | string) => {
    const r = String(role).toLowerCase();
    if (r === '0' || r === 'superadmin' || r === 'admin') {
      return { label: 'مدیر ارشد (Superadmin)', color: 'bg-rose-50 text-rose-700 border-rose-200', icon: ShieldAlert };
    }
    if (r === '1' || r === 'operator') {
      return { label: 'اپراتور سامانه (Operator)', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: ShieldCheck };
    }
    return { label: 'توسعه‌دهنده (Developer)', color: 'bg-slate-100 text-slate-700 border-slate-200', icon: Shield };
  };

  const openRoleModal = (u: PlatformUserItem) => {
    setEditingUser(u);
    const r = String(u.role).toLowerCase();
    if (r === '0' || r === 'superadmin' || r === 'admin') {
      setSelectedRole('Superadmin');
    } else if (r === '1' || r === 'operator') {
      setSelectedRole('Operator');
    } else {
      setSelectedRole('Developer');
    }
    setRoleError(null);
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setSavingRole(true);
    setRoleError(null);

    try {
      await api.put(`/_baas/v1/users/${encodeURIComponent(editingUser.id)}/role`, {
        role: selectedRole,
      });

      setUsers((prev) =>
        prev.map((u) => (u.id === editingUser.id ? { ...u, role: selectedRole } : u))
      );
      setEditingUser(null);
    } catch (err: any) {
      setRoleError(err.message || 'خطا در تغییر سطح دسترسی کاربر.');
    } finally {
      setSavingRole(false);
    }
  };

  const openCreditModal = (u: PlatformUserItem) => {
    setCreditUser(u);
    setCreditAction('add');
    setCreditAmountToman(50000);
    setCreditError(null);
  };

  const handleSaveCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creditUser) return;

    setSavingCredit(true);
    setCreditError(null);

    const deltaIrr = creditAction === 'add' 
      ? creditAmountToman * 10 
      : -1 * creditAmountToman * 10;

    try {
      await api.post(`/_baas/v1/users/${encodeURIComponent(creditUser.id)}/credit`, {
        deltaIrr,
      });

      setUsers((prev) =>
        prev.map((u) =>
          u.id === creditUser.id
            ? { ...u, walletBalanceIrr: Math.max(0, u.walletBalanceIrr + deltaIrr) }
            : u
        )
      );
      setCreditUser(null);
    } catch (err: any) {
      setCreditError(err.message || 'خطا در تنظیم موجودی کاربر.');
    } finally {
      setSavingCredit(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingUser(true);
    setCreateError(null);

    try {
      const res = await api.post('/_baas/v1/admin/users', {
        fullName: newFullName.trim(),
        phone: newPhone.trim(),
        email: newEmail.trim() || undefined,
        username: newUsername.trim() || undefined,
        password: newPassword,
        role: newRole
      });

      if (res.user) {
        setUsers((prev) => [res.user, ...prev]);
        setIsCreateOpen(false);
        setNewFullName('');
        setNewPhone('');
        setNewEmail('');
        setNewUsername('');
        setNewPassword('');
      }
    } catch (err: any) {
      setCreateError(err.message || 'خطا در ایجاد کاربر جدید');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwdUser || !newPwd) return;

    setSavingPwd(true);
    setPwdError(null);
    setPwdSuccess(null);

    try {
      await api.post(`/_baas/v1/admin/users/${encodeURIComponent(pwdUser.id)}/reset-password`, {
        newPassword: newPwd
      });
      setPwdSuccess('کلمه عبور با موفقیت به‌روزرسانی شد.');
      setTimeout(() => {
        setPwdUser(null);
        setNewPwd('');
        setPwdSuccess(null);
      }, 1500);
    } catch (err: any) {
      setPwdError(err.message || 'خطا در تغییر کلمه عبور');
    } finally {
      setSavingPwd(false);
    }
  };

  const handleImpersonate = async (u: PlatformUserItem) => {
    try {
      const res = await api.post(`/_baas/v1/admin/users/${encodeURIComponent(u.id)}/impersonate`, {});
      if (res.tokens?.accessToken) {
        setImpersonateToken(res.tokens.accessToken);
        setImpersonateUser(u);
      }
    } catch (err: any) {
      alert(`خطا در جعل هویت: ${err.message}`);
    }
  };

  const handleToggleStatus = async (u: PlatformUserItem) => {
    const nextStatus = !(u.isActive ?? true);
    try {
      await api.put(`/_baas/v1/users/${encodeURIComponent(u.id)}/status`, {
        isActive: nextStatus
      });
      setUsers((prev) => prev.map((item) => item.id === u.id ? { ...item, isActive: nextStatus } : item));
    } catch (err: any) {
      alert(`خطا در تغییر وضعیت حساب: ${err.message}`);
    }
  };

  const handleOpenProjects = async (u: PlatformUserItem) => {
    setProjectsUser(u);
    setLoadingProjects(true);
    try {
      const res = await api.get(`/_baas/v1/users/${encodeURIComponent(u.id)}/projects`);
      if (Array.isArray(res)) {
        setUserProjects(res);
      }
    } catch (err: any) {
      console.error('Failed to load user projects', err);
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    try {
      await api.delete(`/_baas/v1/admin/users/${encodeURIComponent(deletingUser.id)}`);
      setUsers((prev) => prev.filter((item) => item.id !== deletingUser.id));
      setDeletingUser(null);
    } catch (err: any) {
      alert(`خطا در حذف کاربر: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      u.fullName?.toLowerCase().includes(q) ||
      u.phone?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">مدیریت کاربران، کیف پول و کنترل دسترسی (RBAC)</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
              {toPersianDigits(users.length)} کاربر
            </span>
          </div>
          <p className="text-xs text-slate-500">
            ایجاد کاربر جدید، کنترل نقش‌های امنیتی، جعل هویت (Impersonate)، تغییر رمز عبور و تنظیم اعتبار کیف پول.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو با نام، موبایل، ایمیل..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:border-emerald-500 focus:bg-white transition"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
          </div>

          {/* Create User Button */}
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition shadow-xs whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4" />
            <span>کاربر جدید</span>
          </button>
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <RefreshCw className="w-6 h-6 animate-spin text-emerald-600 mb-2" />
          <span className="text-xs text-slate-500">در حال دریافت فهرست کاربران...</span>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700 mb-1">کاربری یافت نشد</h3>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold select-none">
                <tr>
                  <th className="py-3 px-4">مشخصات کاربر</th>
                  <th className="py-3 px-4">شماره همراه</th>
                  <th className="py-3 px-4">نقش امنیتی</th>
                  <th className="py-3 px-4">وضعیت حساب</th>
                  <th className="py-3 px-4">موجودی کیف پول</th>
                  <th className="py-3 px-4 text-left">عملیات مدیریت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => {
                  const roleInfo = getRoleLabel(u.role);
                  const Icon = roleInfo.icon;
                  const isActive = u.isActive ?? true;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{u.fullName || 'کاربر بدون نام'}</div>
                        <div className="font-mono text-[11px] text-slate-400 mt-0.5" dir="ltr">
                          {u.email || u.id}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-mono text-slate-700" dir="ltr">
                          {u.phone || '—'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${roleInfo.color}`}>
                          <Icon className="w-3 h-3" />
                          <span>{roleInfo.label}</span>
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleToggleStatus(u)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                          title="کلیک برای فعال/غیرفعال کردن کاربر"
                        >
                          {isActive ? <ToggleRight className="w-3.5 h-3.5 text-emerald-600" /> : <ToggleLeft className="w-3.5 h-3.5 text-rose-600" />}
                          <span>{isActive ? 'فعال' : 'مسدود'}</span>
                        </button>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-800">
                          {formatToman(u.walletBalanceIrr)}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-left">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Impersonate */}
                          <button
                            onClick={() => handleImpersonate(u)}
                            title="ورود به جای کاربر (Impersonate)"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition"
                          >
                            <LogIn className="w-4 h-4" />
                          </button>

                          {/* Projects */}
                          <button
                            onClick={() => handleOpenProjects(u)}
                            title="مشاهده پروژه‌های تحت مالکیت"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
                          >
                            <FolderGit2 className="w-4 h-4" />
                          </button>

                          {/* Reset Password */}
                          <button
                            onClick={() => {
                              setPwdUser(u);
                              setNewPwd('');
                              setPwdError(null);
                              setPwdSuccess(null);
                            }}
                            title="تغییر کلمه عبور"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition"
                          >
                            <Key className="w-4 h-4" />
                          </button>

                          {/* Wallet credit */}
                          <button
                            onClick={() => openCreditModal(u)}
                            title="تنظیم موجودی کیف پول"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition"
                          >
                            <Wallet className="w-4 h-4" />
                          </button>

                          {/* Role edit */}
                          <button
                            onClick={() => openRoleModal(u)}
                            title="تغییر نقش امنیتی"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => setDeletingUser(u)}
                            title="حذف حساب کاربر"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE USER MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs" dir="rtl">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-emerald-600" />
                <span>تعریف کاربر جدید در پلتفرم</span>
              </h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {createError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">نام و نام خانوادگی:</label>
                <input
                  type="text"
                  required
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="مثال: علی رضایی"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">شماره همراه:</label>
                  <input
                    type="text"
                    required
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="09121234567"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono focus:outline-hidden focus:border-emerald-500"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">ایمیل (اختیاری):</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono focus:outline-hidden focus:border-emerald-500"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">نام کاربری (اختیاری):</label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="username"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono focus:outline-hidden focus:border-emerald-500"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">نقش اولیه:</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-hidden focus:border-emerald-500"
                  >
                    <option value="Developer">توسعه‌دهنده (Developer)</option>
                    <option value="Operator">اپراتور (Operator)</option>
                    <option value="Admin">مدیر ارشد (Admin)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">کلمه عبور اولیه:</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="حداقل ۶ کاراکتر"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono focus:outline-hidden focus:border-emerald-500"
                  dir="ltr"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition disabled:opacity-50 shadow-xs"
                >
                  {creatingUser ? 'در حال ایجاد...' : 'ایجاد حساب کاربری'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {pwdUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs" dir="rtl">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Key className="w-4 h-4 text-amber-600" />
                <span>تنظیم کلمه عبور کاربر</span>
              </h3>
              <button onClick={() => setPwdUser(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {pwdError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{pwdError}</span>
              </div>
            )}

            {pwdSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{pwdSuccess}</span>
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-4 text-xs">
              <div>
                <span className="block font-medium text-slate-500 mb-1">کاربر:</span>
                <span className="font-bold text-slate-800">{pwdUser.fullName} ({pwdUser.phone})</span>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">کلمه عبور جدید:</label>
                <input
                  type="password"
                  required
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder="رمز عبور جدید را وارد کنید..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono focus:outline-hidden focus:border-emerald-500"
                  dir="ltr"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPwdUser(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={savingPwd}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold transition disabled:opacity-50 shadow-xs"
                >
                  {savingPwd ? 'در حال ثبت...' : 'به‌روزرسانی رمز عبور'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IMPERSONATION MODAL */}
      {impersonateToken && impersonateUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs" dir="rtl">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <LogIn className="w-4 h-4 text-indigo-600" />
                <span>جعل هویت کاربر (Impersonation)</span>
              </h3>
              <button onClick={() => { setImpersonateToken(null); setImpersonateUser(null); }} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <p className="text-xs text-slate-600">
              توکن دسترسی معتبر برای کاربر <span className="font-bold text-slate-900">{impersonateUser.fullName}</span> با نقش <span className="font-mono text-indigo-700 font-bold">{impersonateUser.role}</span> صادر شد.
            </p>

            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block mb-1">JWT Bearer Token:</span>
              <div className="font-mono text-[10px] text-emerald-400 break-all max-h-24 overflow-y-auto" dir="ltr">
                {impersonateToken}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(impersonateToken);
                  alert('توکن در کلیپ‌بورد کپی شد.');
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>کپی توکن</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  localStorage.setItem('localme_auth_token', impersonateToken);
                  window.open('/panel', '_blank');
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>باز کردن پنل به عنوان این کاربر</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* USER PROJECTS DRAWER */}
      {projectsUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs" dir="rtl">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg p-6 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <FolderGit2 className="w-4 h-4 text-emerald-600" />
                <span>پروژه‌های تحت مالکیت {projectsUser.fullName}</span>
              </h3>
              <button onClick={() => setProjectsUser(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {loadingProjects ? (
              <div className="py-8 text-center text-xs text-slate-500">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto text-emerald-600 mb-2" />
                <span>در حال دریافت پروژه‌ها...</span>
              </div>
            ) : userProjects.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                این کاربر تاکنون پروژه‌ای ایجاد نکرده است.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {userProjects.map((p) => (
                  <div key={p.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-900">{p.name}</div>
                      <div className="font-mono text-[11px] text-slate-400" dir="ltr">{p.slug}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {p.status}
                      </span>
                      <a
                        href={`/panel/${p.slug}/database/dashboard`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                        title="مشاهده استودیو پروژه"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs" dir="rtl">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
              <AlertCircle className="w-5 h-5" />
              <span>تایید حذف کاربر</span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              آیا از حذف دائم حساب کاربری <span className="font-bold text-slate-900">{deletingUser.fullName}</span> ({deletingUser.phone}) اطمینان دارید؟ این عمل غیرقابل بازگشت است.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={isDeleting}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold transition disabled:opacity-50 shadow-xs"
              >
                {isDeleting ? 'در حال حذف...' : 'حذف کاربر'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs" dir="rtl">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-900">
                تغییر سطح دسترسی کاربر
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {roleError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{roleError}</span>
              </div>
            )}

            <form onSubmit={handleSaveRole} className="space-y-4">
              <div>
                <span className="block text-xs font-semibold text-slate-700 mb-1">
                  کاربر:
                </span>
                <div className="text-xs text-slate-800 font-bold">
                  {editingUser.fullName || editingUser.phone}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  نقش امنیتی جدید:
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:border-emerald-500"
                >
                  <option value="Developer">توسعه‌دهنده (Developer)</option>
                  <option value="Operator">اپراتور سامانه (Operator)</option>
                  <option value="Superadmin">مدیر ارشد (Superadmin)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={savingRole}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition disabled:opacity-50 shadow-xs"
                >
                  {savingRole ? 'در حال ثبت...' : 'ذخیره تغییرات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credit Adjustment Modal */}
      {creditUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs" dir="rtl">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-emerald-600" />
                <span>تنظیم موجودی کیف پول کاربر</span>
              </h3>
              <button
                onClick={() => setCreditUser(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {creditError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{creditError}</span>
              </div>
            )}

            <form onSubmit={handleSaveCredit} className="space-y-4">
              <div>
                <span className="block text-xs font-semibold text-slate-700 mb-1">
                  کاربر و موجودی فعلی:
                </span>
                <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  <span className="font-bold text-slate-900">{creditUser.fullName || creditUser.phone}</span>
                  <span className="font-mono text-emerald-700 font-semibold">{formatToman(creditUser.walletBalanceIrr)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  نوع عملیات:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCreditAction('add')}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition ${
                      creditAction === 'add'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>افزایش اعتبار</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreditAction('deduct')}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition ${
                      creditAction === 'deduct'
                        ? 'bg-rose-50 text-rose-700 border-rose-300'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    <MinusCircle className="w-3.5 h-3.5" />
                    <span>کسر اعتبار</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  مبلغ (تومان):
                </label>
                <input
                  type="number"
                  value={creditAmountToman}
                  onChange={(e) => setCreditAmountToman(Math.max(1000, Number(e.target.value)))}
                  step={1000}
                  min={1000}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-mono focus:bg-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreditUser(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={savingCredit}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition disabled:opacity-50 shadow-xs"
                >
                  {savingCredit ? 'در حال اعمال...' : 'ثبت در کیف پول'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
