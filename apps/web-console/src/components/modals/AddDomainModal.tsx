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
    if (!domain.trim()) return;
    onAdd({
      domain: domain.trim().toLowerCase(),
      cnameTarget: 'edge.localme.ir',
    });
    setDomain('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-domain-modal-title"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-[#171717] border border-[#242424] shadow-2xl p-6 text-zinc-100 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-[#242424]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#3ECF8E]/10 border border-[#3ECF8E]/20 flex items-center justify-center text-[#3ECF8E]">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h3 id="add-domain-modal-title" className="text-base font-bold text-white">اتصال دامنه اختصاصی (.ir / .com)</h3>
              <p className="text-xs text-zinc-400">صدور خودکار گواهی SSL رایگان Let's Encrypt</p>
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
            <label className="block text-zinc-300 font-medium mb-1.5">نام دامنه *</label>
            <input
              type="text"
              required
              value={domain}
              onChange={(e) => setDomain(e.target.value.toLowerCase())}
              placeholder="shop.example.ir"
              className="w-full px-3.5 py-2 rounded-xl bg-[#0f0f0f] border border-[#242424] focus:border-[#3ECF8E] focus:outline-none text-zinc-100 font-mono"
              dir="ltr"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-[#0f0f0f] border border-[#242424] space-y-2">
            <div className="flex items-center space-x-2 text-zinc-300 font-semibold">
              <ShieldCheck className="w-4 h-4 text-[#3ECF8E]" />
              <span>تنظیمات DNS مورد نیاز در ارائه‌دهنده دامنه</span>
            </div>
            <div className="text-[11px] text-zinc-400 leading-relaxed">
              رکورد <code className="px-1.5 py-0.5 rounded bg-[#171717] border border-[#242424] text-[#3ECF8E] font-mono">CNAME</code> زیر را در پنل کلودفلر، ابرآروان یا ایرنیک تنظیم نمایید:
            </div>
            <div className="p-2.5 rounded-lg bg-[#171717] border border-[#242424] font-mono text-[11px] text-zinc-200 flex justify-between items-center" dir="ltr">
              <span>CNAME target:</span>
              <span className="text-[#3ECF8E] font-bold">edge.localme.ir</span>
            </div>
          </div>

          <div className="flex items-start space-x-2 p-3 rounded-xl bg-[#3ECF8E]/5 border border-[#3ECF8E]/20 text-zinc-300 text-[11px]">
            <AlertCircle className="w-4 h-4 text-[#3ECF8E] shrink-0 mt-0.5" />
            <span>گواهی Let's Encrypt ظرف ۳۰ ثانیه پس از شناسایی CNAME صادر و فعال خواهد شد.</span>
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
              ثبت و استقرار دامنه
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
