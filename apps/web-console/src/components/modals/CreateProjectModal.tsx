import React, { useState } from 'react';
import { X, Sparkles, Server } from 'lucide-react';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (project: {
    name: string;
    slug: string;
    description: string;
    region: string;
    password?: string;
  }) => void;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [region, setRegion] = useState('ir-teh-1 (آسیاتک برج میلاد)');
  const [password, setPassword] = useState('');

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
    onCreate({
      name: name.trim(),
      slug: slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      description: description.trim(),
      region,
      password: password || undefined,
    });
    setName('');
    setSlug('');
    setDescription('');
    setPassword('');
    onClose();
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (!slug || slug === name.toLowerCase().replace(/[^a-z0-9-]/g, '-')) {
      setSlug(
        val
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '')
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-project-modal-title"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-[#171717] border border-[#242424] shadow-2xl p-6 text-zinc-100 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-[#242424]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#3ECF8E]/10 border border-[#3ECF8E]/20 flex items-center justify-center text-[#3ECF8E]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 id="create-project-modal-title" className="text-base font-bold text-white">ساخت پروژه ابری جدید</h3>
              <p className="text-xs text-zinc-400">یک فضای ایزوله BaaS + PaaS با زیردامنه اختصاصی و اسکیما مجزا</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="بستن"
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1f1f1f] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-zinc-300 font-medium mb-1.5">نام پروژه *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="مثال: دیجی‌کالا یا اسنپ کلون"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0f0f0f] border border-[#242424] focus:border-[#3ECF8E] focus:outline-none text-zinc-100 placeholder-zinc-600"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1.5">شناسه یکتا (Slug) *</label>
            <div className="flex items-center rounded-xl bg-[#0f0f0f] border border-[#242424] focus-within:border-[#3ECF8E] px-3">
              <span className="text-zinc-500 font-mono text-xs">https://</span>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                placeholder="my-cool-app"
                className="w-full py-2.5 bg-transparent border-0 focus:outline-none text-zinc-100 font-mono text-xs"
              />
              <span className="text-zinc-500 font-mono text-xs">.localme.ir</span>
            </div>
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1.5">توضیحات کوتاه</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="هدف یا سرویس اصلی پروژه"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0f0f0f] border border-[#242424] focus:border-[#3ECF8E] focus:outline-none text-zinc-100 placeholder-zinc-600"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1.5">دیتاسنتر و منطقه ابری</label>
            <div className="relative">
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0f0f0f] border border-[#242424] focus:border-[#3ECF8E] focus:outline-none text-zinc-100 appearance-none font-mono"
              >
                <option value="ir-teh-1 (آسیاتک برج میلاد)">ir-teh-1 (آسیاتک برج میلاد - Egress NAT)</option>
                <option value="ir-teh-2 (زیرساخت امام)">ir-teh-2 (زیرساخت امام - اینترانت ملی)</option>
                <option value="ir-mhd-1 (شاتل مشهد)">ir-mhd-1 (شاتل مشهد - لبه شرق)</option>
                <option value="eu-fra-1 (هتزنر فرانکفورت)">eu-fra-1 (هتزنر فرانکفورت - تونل TLS 1.3)</option>
              </select>
              <Server className="w-4 h-4 text-zinc-500 absolute left-3 top-3 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1.5">گذرواژه امنیتی پروژه (اختیاری)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="برای حفاظت از کنسول و تغییر تنظیمات حساس"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0f0f0f] border border-[#242424] focus:border-[#3ECF8E] focus:outline-none text-zinc-100 placeholder-zinc-600"
            />
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
              ایجاد و راه‌اندازی پروژه
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
