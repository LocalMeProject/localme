import React, { useState } from 'react';
import { X, UserPlus } from 'lucide-react';
import { ProjectUser } from '../../types';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (user: ProjectUser) => void;
}

export const AddUserModal: React.FC<AddUserModalProps> = ({
  isOpen,
  onClose,
  onAdd,
}) => {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [provider, setProvider] = useState<'sms' | 'credentials'>('sms');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;

    onAdd({
      id: `usr-${Date.now()}`,
      fullName: fullName.trim(),
      username: username.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      provider,
      isConfirmed: true,
      createdAt: 'هم‌اکنون',
    });

    setFullName('');
    setUsername('');
    setPhone('');
    setEmail('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-user-modal-title"
    >
      <div className="relative w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 text-slate-800 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
              <UserPlus className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 id="add-user-modal-title" className="text-base font-bold text-slate-900">
                افزودن کاربر جدید
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                ثبت دستی کاربر در پایگاه داده احراز هویت
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="بستن"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-medium mb-1.5">نام و نام‌خانوادگی</label>
            <input
              type="text"
              required
              placeholder="مثال: علی احمدی"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:outline-none text-slate-900"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1.5">شماره تلفن همراه</label>
            <input
              type="tel"
              placeholder="09121112233"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              dir="ltr"
              className="w-full px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:outline-none text-slate-900 font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1.5">ایمیل (اختیاری)</label>
            <input
              type="email"
              placeholder="ali@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              dir="ltr"
              className="w-full px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:outline-none text-slate-900 font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1.5">روش احراز هویت</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as 'sms' | 'credentials')}
              className="w-full px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:outline-none text-slate-800"
            >
              <option value="sms">ورود با کد تایید پیامک (OTP)</option>
              <option value="credentials">نام کاربری و گذرواژه</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition shadow-xs"
            >
              افزودن کاربر
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
