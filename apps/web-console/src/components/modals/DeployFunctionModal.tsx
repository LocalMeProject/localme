import React, { useState } from 'react';
import { X, Terminal } from 'lucide-react';
import { EdgeFunction } from '../../types';

interface DeployFunctionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeploy: (fn: EdgeFunction) => void;
}

export const DeployFunctionModal: React.FC<DeployFunctionModalProps> = ({
  isOpen,
  onClose,
  onDeploy,
}) => {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [trigger, setTrigger] = useState<'HTTP' | 'DATABASE_WEBHOOK' | 'SCHEDULED'>('HTTP');
  const [script, setScript] = useState(`// نمونه تابع ابری جاوااسکریپت
function handleRequest(context) {
  return {
    success: true,
    message: "درخواست با موفقیت در لبه پردازش گردید."
  };
}`);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;

    onDeploy({
      id: `fn-${Date.now()}`,
      name: name.trim(),
      slug: slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      runtime: 'js',
      script,
      memoryLimitMb: 16,
      timeoutSeconds: 3,
      invocationsCount: 0,
      createdAt: 'هم‌اکنون',
    });

    setName('');
    setSlug('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deploy-function-modal-title"
    >
      <div className="relative w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 text-slate-800 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Terminal className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 id="deploy-function-modal-title" className="text-base font-bold text-slate-900">
                استقرار تابع ابری جدید
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                ثبت و اجرای کدهای بدون سرور با پاسخ‌دهی سریع
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1.5">نام تابع</label>
              <input
                type="text"
                required
                placeholder="ارسال پیامک خوش‌آمدگویی"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSlug(e.target.value.toLowerCase().replace(/[^a-zA-Z0-9]/g, '-').slice(0, 24));
                }}
                className="w-full px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:outline-none text-slate-900"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1.5">شناسه مسیر (Slug)</label>
              <input
                type="text"
                required
                placeholder="send-welcome-sms"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                dir="ltr"
                className="w-full px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:outline-none text-slate-900 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1.5">نوع محرک اجرایی (Trigger)</label>
            <select
              value={trigger}
              onChange={(e) => setTrigger(e.target.value as 'HTTP' | 'DATABASE_WEBHOOK' | 'SCHEDULED')}
              className="w-full px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:outline-none text-slate-800"
            >
              <option value="HTTP">درخواست اینترنتی (HTTP Endpoint)</option>
              <option value="DATABASE_WEBHOOK">وب‌هوک تغییرات پایگاه داده (Table Mutation)</option>
              <option value="SCHEDULED">زمان‌بندی دوره‌ای (Cron Schedule)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1.5">کد تابع (JavaScript)</label>
            <textarea
              rows={8}
              value={script}
              onChange={(e) => setScript(e.target.value)}
              dir="ltr"
              className="w-full p-3 rounded-xl bg-slate-900 text-emerald-400 font-mono text-xs focus:outline-none leading-relaxed"
            />
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
              استقرار تابع
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
