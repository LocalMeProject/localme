import React, { useState } from 'react';
import { X, Globe, ShieldCheck, AlertCircle } from 'lucide-react';
import { CustomDomain } from '../../types';

interface AddDomainModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (domain: Omit<CustomDomain, 'isVerified' | 'sslActive' | 'createdAt'>) => void;
}

export const AddDomainModal: React.FC<AddDomainModalProps> = ({
  isOpen,
  onClose,
  onAdd,
}) => {
  const [domain, setDomain] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain.trim()) return;
    onAdd({
      domain: domain.trim().toLowerCase(),
      cnameTarget: 'edge.localme.ir',
    });
    setDomain('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl p-6 text-zinc-100 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100">اتصال دامنه اختصاصی (.ir / .com)</h3>
              <p className="text-xs text-zinc-400">صدور خودکار گواهی SSL رایگان Let's Encrypt</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-zinc-300 font-medium mb-1.5">نام دامنه *</label>
            <input
              type="text"
              required
              value={domain}
              onChange={(e) => setDomain(e.target.value.toLowerCase())}
              placeholder="shop.example.ir"
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 focus:border-amber-500 focus:outline-none text-zinc-100 font-mono"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
            <div className="flex items-center space-x-2 text-zinc-300 font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>تنظیمات DNS مورد نیاز در ارائه‌دهنده دامنه</span>
            </div>
            <div className="text-[11px] text-zinc-400 leading-relaxed">
              رکورد <code className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-amber-400 font-mono">CNAME</code> زیر را در پنل کلودفلر، ابرآروان یا ایرنیک تنظیم نمایید:
            </div>
            <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800/80 font-mono text-[11px] text-zinc-200 flex justify-between items-center">
              <span>CNAME target:</span>
              <span className="text-amber-400 font-bold">edge.localme.ir</span>
            </div>
          </div>

          <div className="flex items-start space-x-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-amber-300/80 text-[11px]">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>گواهی Let's Encrypt ظرف ۳۰ ثانیه پس از شناسایی CNAME صادر و فعال خواهد شد.</span>
          </div>

          <div className="pt-4 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-300 font-medium transition"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold transition shadow-lg shadow-amber-500/10"
            >
              ثبت و استقرار دامنه
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
