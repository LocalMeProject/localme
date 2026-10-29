import React, { useState } from 'react';
import { X, Globe, Copy, Check } from 'lucide-react';
import { CustomDomain } from '../../types';

interface AddDomainModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (domain: CustomDomain) => void;
}

export const AddDomainModal: React.FC<AddDomainModalProps> = ({
  isOpen,
  onClose,
  onAdd,
}) => {
  const [domain, setDomain] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain.trim()) return;

    onAdd({
      domain: domain.trim().toLowerCase(),
      isVerified: true,
      sslActive: true,
      cnameTarget: 'edge.localme.ir',
      createdAt: 'هم‌اکنون',
    });

    setDomain('');
    onClose();
  };

  const handleCopyRecord = () => {
    navigator.clipboard.writeText('edge.localme.ir');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-domain-modal-title"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 text-slate-800 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Globe className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 id="add-domain-modal-title" className="text-base font-bold text-slate-900">
                اتصال دامنه اختصاصی
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                اتصال دامنه‌های ملی و بین‌المللی با گواهی امنیتی خودکار
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
            <label className="block text-slate-700 font-medium mb-1.5">نشانی دامنه اختصاصی</label>
            <input
              type="text"
              required
              placeholder="example.ir یا app.example.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value.toLowerCase())}
              dir="ltr"
              className="w-full px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:outline-none text-slate-900 font-mono"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <span className="text-slate-700 font-medium block">تنظیم رکورد DNS:</span>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              رکورد CNAME زیر را در پنل ارائه‌دهنده دامنه خود ثبت نمایید:
            </p>
            <div className="p-2 rounded-lg bg-white border border-slate-200 font-mono text-[11px] text-slate-800 flex justify-between items-center" dir="ltr">
              <span>CNAME @ $\to$ edge.localme.ir</span>
              <button
                type="button"
                onClick={handleCopyRecord}
                className="text-slate-500 hover:text-emerald-700 flex items-center gap-1 text-[11px]"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'کپی شد' : 'کپی'}</span>
              </button>
            </div>
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
              اتصال دامنه
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
