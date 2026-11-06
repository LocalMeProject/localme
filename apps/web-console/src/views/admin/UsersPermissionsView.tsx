import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  ShieldCheck, 
  ShieldAlert, 
  Shield, 
  RefreshCw, 
  Edit2, 
  AlertCircle 
} from 'lucide-react';
import { api } from '../../utils/apiClient';
import { formatToman } from '../../utils/persian';

interface PlatformUserItem {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  role: number | string; // 0: Superadmin, 1: Operator, 2: Developer
  walletBalanceIrr: number;
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

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      u.fullName?.toLowerCase().includes(q) ||
      u.phone?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">مدیریت کاربران پلتفرم و سطوح دسترسی (RBAC)</h2>
          </div>
          <p className="text-xs text-slate-500">
            فهرست حساب‌های کاربری، کنترل نقش‌های امنیتی و موجودی کیف پول کاربران سکوی لوکال می.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجو با نام، موبایل یا ایمیل..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
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
                  <th className="py-3 px-4">نام و مشخصات کاربر</th>
                  <th className="py-3 px-4">شماره همراه</th>
                  <th className="py-3 px-4">نقش امنیتی</th>
                  <th className="py-3 px-4">اعتبار کیف پول</th>
                  <th className="py-3 px-4 text-left">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => {
                  const roleInfo = getRoleLabel(u.role);
                  const Icon = roleInfo.icon;

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
                        <span className="font-medium text-slate-800">
                          {formatToman(u.walletBalanceIrr)}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-left">
                        <button
                          onClick={() => openRoleModal(u)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition font-medium text-[11px]"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                          <span>تغییر نقش</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Role Change Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" dir="rtl">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-900">تغییر سطح دسترسی کاربر</h3>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <p className="text-xs text-slate-600 mb-4">
              تغییر نقش امنیتی برای «<span className="font-bold text-slate-900">{editingUser.fullName}</span>»:
            </p>

            {roleError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{roleError}</span>
              </div>
            )}

            <form onSubmit={handleSaveRole} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  نقش امنیتی جدید
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                >
                  <option value="Developer">توسعه‌دهنده (Developer) — دسترسی عادی به پروژه‌ها</option>
                  <option value="Operator">اپراتور (Operator) — دسترسی به گزارش‌ها و مانیتورینگ</option>
                  <option value="Superadmin">مدیر ارشد (Superadmin) — کنترل کامل کلاستر و تنظیمات</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={savingRole}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition disabled:opacity-50 shadow-xs"
                >
                  {savingRole && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>ثبت تغییرات</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
