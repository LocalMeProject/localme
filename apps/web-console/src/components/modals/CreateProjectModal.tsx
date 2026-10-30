import React, { useState } from 'react';
import { X, FolderPlus, Server } from 'lucide-react';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: {
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
  const [enablePassword, setEnablePassword] = useState(false);

  if (!isOpen) return null;

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    const generated = val
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 32);
    setSlug(generated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;

    onCreate({
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim(),
      region,
      password: enablePassword && password.trim() ? password.trim() : undefined,
    });

    setName('');
    setSlug('');
    setDescription('');
    setPassword('');
    setEnablePassword(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-project-modal-title"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 text-slate-800 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
              <FolderPlus className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 id="create-project-modal-title" className="text-base font-bold text-slate-900">
                ایجاد پروژه ابری جدید
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                تخصیص پایگاه داده و زیرساخت اختصاصی ابری
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
            <label className="block text-slate-700 font-medium mb-1.5">نام پروژه</label>
            <input
              type="text"
              required
              placeholder="مثال: فروشگاه آنلاین"
              value={name}
              onChange={handleNameChange}
              className="w-full px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:outline-none text-slate-900"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1.5">
              شناسه یکتا (Slug)
            </label>
            <input
              type="text"
              required
              placeholder="my-project"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              dir="ltr"
              className="w-full px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:outline-none text-slate-900 font-mono"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              دامنه پیش‌فرض: <span className="text-emerald-700 font-mono" dir="ltr">{slug || 'my-project'}.localme.ir</span>
            </span>
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1.5">موقعیت زیرساخت</label>
            <div className="relative">
              <Server className="w-4 h-4 text-slate-400 absolute right-3.5 top-2.5" />
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full pr-10 pl-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:outline-none text-slate-800"
              >
                <option value="ir-teh-1 (آسیاتک برج میلاد)">آسیاتک برج میلاد (تهران)</option>
                <option value="ir-teh-2 (زیرساخت امام)">زیرساخت امام (تهران)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1.5">توضیحات کوتاه</label>
            <textarea
              rows={2}
              placeholder="توضیحات اختیاری درباره کارکرد این پروژه..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:outline-none text-slate-800 leading-relaxed"
            />
          </div>

          <div className="pt-2 border-t border-slate-100 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enablePassword}
                onChange={(e) => setEnablePassword(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-slate-700 font-medium">تنظیم رمز عبور اختصاصی برای پروژه</span>
            </label>

            {enablePassword && (
              <div className="pt-1">
                <input
                  type="password"
                  placeholder="رمز عبور پروژه"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  dir="ltr"
                  className="w-full px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:outline-none text-slate-900"
                />
              </div>
            )}
          </div>

          {/* Action Buttons */}
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
              ایجاد پروژه
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
