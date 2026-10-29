import React, { useState } from 'react';
import { X, Users, Smartphone, Mail } from 'lucide-react';
import { ProjectUser } from '../../types';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (user: Omit<ProjectUser, 'id' | 'createdAt'>) => void;
}

export type UserAuthProvider = 'sms_otp' | 'password' | 'samandehi_sso';

export const AddUserModal: React.FC<AddUserModalProps> = ({
  isOpen,
  onClose,
  onAdd,
}) => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [provider, setProvider] = useState<UserAuthProvider>('sms_otp');

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || (!phone.trim() && !email.trim())) return;
    onAdd({
      fullName: fullName.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      provider,
      isConfirmed: true,
    });
    setFullName('');
    setPhone('');
    setEmail('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-user-modal-title"
    >
      <div className="relative w-full max-w-md rounded-2xl bg-[#171717] border border-[#242424] shadow-2xl p-6 text-zinc-100 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-[#242424]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#3ECF8E]/10 border border-[#3ECF8E]/20 flex items-center justify-center text-[#3ECF8E]">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 id="add-user-modal-title" className="text-base font-bold text-white">افزودن کاربر جدید</h3>
              <p className="text-xs text-zinc-400">ثبت مستقیم کاربر در دیتابیس ایزوله احراز هویت IDaaS</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="بستن"
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1f1f1f] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-zinc-300 font-medium mb-1.5">نام و نام خانوادگی *</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="مثال: علی رضایی"
              className="w-full px-3.5 py-2 rounded-xl bg-[#0f0f0f] border border-[#242424] focus:border-[#3ECF8E] focus:outline-none text-zinc-100"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1.5 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-zinc-400" />
              <span>شماره همراه ایران (OTP)</span>
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0912xxxxxxx"
              className="w-full px-3.5 py-2 rounded-xl bg-[#0f0f0f] border border-[#242424] focus:border-[#3ECF8E] focus:outline-none text-zinc-100 font-mono"
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1.5 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-zinc-400" />
              <span>پست الکترونیک (اختیاری)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-3.5 py-2 rounded-xl bg-[#0f0f0f] border border-[#242424] focus:border-[#3ECF8E] focus:outline-none text-zinc-100 font-mono"
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1.5">روش احراز هویت اولیه</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as UserAuthProvider)}
              className="w-full px-3.5 py-2 rounded-xl bg-[#0f0f0f] border border-[#242424] focus:border-[#3ECF8E] focus:outline-none text-zinc-100 font-mono"
            >
              <option value="sms_otp">کاوه‌نگار / ملی پیامک (OTP SMS)</option>
              <option value="password">نام کاربری و رمز عبور (Argon2id)</option>
              <option value="samandehi_sso">پنجره ملی خدمات دولت / ساماندهی</option>
            </select>
          </div>

          <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-[#242424]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-[#242424] hover:bg-[#2e2e2e] text-[#ededed] border border-[#2e2e2e] font-medium text-xs px-4 py-2 transition-colors"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-full bg-[#3ECF8E] hover:bg-[#34b27b] text-[#0f0f0f] font-medium text-xs px-5 py-2 transition-colors"
            >
              افزودن کاربر
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
