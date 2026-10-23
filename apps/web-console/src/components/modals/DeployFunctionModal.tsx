import React, { useState } from 'react';
import { X, Terminal, Cpu, Clock } from 'lucide-react';
import { EdgeFunction } from '../../types';

interface DeployFunctionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeploy: (fn: Omit<EdgeFunction, 'id' | 'invocationsCount' | 'lastExecutedAt' | 'createdAt'>) => void;
}

export const DeployFunctionModal: React.FC<DeployFunctionModalProps> = ({
  isOpen,
  onClose,
  onDeploy,
}) => {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [memoryLimitMb, setMemoryLimitMb] = useState(32);
  const [timeoutSeconds, setTimeoutSeconds] = useState(5);
  const [script, setScript] = useState(`// LocalMe Sandboxed Jint Edge Function
function handler(context) {
  const req = context.request || {};
  
  return {
    status: 200,
    message: "درود از تابع لبه LocalMe!",
    payload: req,
    timestamp: new Date().toISOString()
  };
}

handler(context);`);

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
    if (!name.trim() || !slug.trim()) return;
    onDeploy({
      name: name.trim(),
      slug: slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      memoryLimitMb,
      timeoutSeconds,
      runtime: 'Jint 4.x (Managed C#)',
      script,
    });
    setName('');
    setSlug('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deploy-function-modal-title"
    >
      <div className="relative w-full max-w-2xl rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl p-6 text-zinc-100 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h3 id="deploy-function-modal-title" className="text-base font-bold text-zinc-100">استقرار تابع سرورلس لبه (Jint 4.x)</h3>
              <p className="text-xs text-zinc-400">اجرای ایزوله در هسته C# .NET 10 با تاخیر زیر ۵ میلی‌ثانیه</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="بستن"
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:outline-none transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-300 font-medium mb-1.5">نام تابع *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slug) {
                    setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
                  }
                }}
                placeholder="مثال: اعتبارسنجی کارت شتاب"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 focus:border-amber-500 focus:outline-none text-zinc-100 placeholder-zinc-600"
              />
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1.5">شناسه مسیر URL (Slug) *</label>
              <div className="flex items-center rounded-xl bg-zinc-950 border border-zinc-800 px-3 focus-within:border-amber-500">
                <span className="text-zinc-500 font-mono text-[11px]">/functions/</span>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  placeholder="validate-shetab"
                  className="w-full py-2.5 bg-transparent border-0 focus:outline-none text-zinc-100 font-mono text-xs"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-300 font-medium mb-1.5 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-zinc-400" />
                <span>محدودیت رم ایزوله (Memory Limit)</span>
              </label>
              <select
                value={memoryLimitMb}
                onChange={(e) => setMemoryLimitMb(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 focus:border-amber-500 focus:outline-none text-zinc-100 font-mono"
              >
                <option value={16}>16 مگابایت (توابع سبک و OTP)</option>
                <option value={32}>32 مگابایت (پیش‌فرض پیشنهادی)</option>
                <option value={64}>64 مگابایت (پردازش داده و امضای دیجیتال)</option>
                <option value={128}>128 مگابایت (محاسبات سنگین)</option>
              </select>
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-zinc-400" />
                <span>سقف زمان اجرا (Timeout)</span>
              </label>
              <select
                value={timeoutSeconds}
                onChange={(e) => setTimeoutSeconds(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 focus:border-amber-500 focus:outline-none text-zinc-100 font-mono"
              >
                <option value={3}>3 ثانیه (سریع‌ترین)</option>
                <option value={5}>5 ثانیه (استاندارد وب‌هوک)</option>
                <option value={10}>10 ثانیه</option>
                <option value={30}>30 ثانیه (سقف مجاز)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1.5">کد جاوااسکریپت تابع</label>
            <textarea
              rows={8}
              value={script}
              onChange={(e) => setScript(e.target.value)}
              className="w-full p-3 rounded-xl bg-zinc-950 border border-zinc-800 focus:border-amber-500 focus:outline-none font-mono text-xs text-zinc-200"
            />
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
              استقرار تابع
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
