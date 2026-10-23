import React, { useState } from 'react';
import { Project } from '../types';
import {
  Settings,
  Key,
  Trash2,
  Copy,
  RotateCw,
  Lock,
  CheckCircle2,
} from 'lucide-react';

interface SettingsViewProps {
  project: Project;
  onUpdateProject: (updated: Partial<Project>) => void;
  onDeleteProject: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  project,
  onUpdateProject,
  onDeleteProject,
}) => {
  const [name, setName] = useState(project.name);
  const [slug, setSlug] = useState(project.slug);
  const [desc, setDesc] = useState(project.description);
  const [projectPassword, setProjectPassword] = useState('');
  const [hasPassword, setHasPassword] = useState(project.hasPassword);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [apiKeys, setApiKeys] = useState<Record<string, string>>({
    database: `lm_db_${project.id.slice(0, 8)}_live_99a8b7`,
    auth: `lm_auth_${project.id.slice(0, 8)}_live_44c3d2`,
    storage: `lm_str_${project.id.slice(0, 8)}_live_77e6f5`,
    functions: `lm_fn_${project.id.slice(0, 8)}_live_11g2h3`,
  });

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProject({ name, slug, description: desc });
    alert('مشخصات عمومی پروژه ذخیره شد.');
  };

  const handleSetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectPassword || projectPassword.length < 4) {
      alert('رمز عبور پروژه باید حداقل ۴ کاراکتر باشد.');
      return;
    }
    setHasPassword(true);
    setProjectPassword('');
    alert('رمز عبور اختصاصی پروژه با موفقیت تنظیم گردید.');
  };

  const handleRemovePassword = () => {
    if (!confirm('آیا از حذف رمز عبور اختصاصی پروژه اطمینان دارید؟')) return;
    setHasPassword(false);
    alert('رمز عبور اختصاصی پروژه حذف شد.');
  };

  const handleCopyKey = (keyName: string, val: string) => {
    navigator.clipboard.writeText(val);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleRegenerateKey = (keyName: string) => {
    if (!confirm(`آیا از صدور مجدد کلید سرویس ${keyName} اطمینان دارید؟ کلید قبلی بلافاصله باطل خواهد شد.`)) return;
    const newKey = `lm_${keyName.slice(0, 3)}_${project.id.slice(0, 8)}_live_${Math.random().toString(36).slice(2, 8)}`;
    setApiKeys((prev) => ({ ...prev, [keyName]: newKey }));
    alert(`کلید جدید سرویس ${keyName} صادر گردید.`);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-400" />
            تنظیمات عمومی، کلیدهای دسترسی و امنیت پروژه
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            پیکربندی هویت پروژه، صدور کلیدهای API سرویس‌ها و مدیریت دسترسی اختصاصی با اسلاگ.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* General Settings */}
        <div className="lg:col-span-6 p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-4">
          <h4 className="text-xs font-bold text-zinc-200 border-b border-zinc-800/80 pb-3">
            مشخصات عمومی پروژه
          </h4>

          <form onSubmit={handleSaveGeneral} className="space-y-3.5">
            <div>
              <label className="text-[11px] text-zinc-400 block mb-1">نام پروژه</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 font-semibold"
              />
            </div>

            <div>
              <label className="text-[11px] text-zinc-400 block mb-1">اسلاگ یکتا (Slug)</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-amber-400 font-mono"
              />
            </div>

            <div>
              <label className="text-[11px] text-zinc-400 block mb-1">توضیحات پروژه</label>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={3}
                className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 resize-none"
              />
            </div>

            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs transition"
            >
              ذخیره تغییرات عمومی
            </button>
          </form>
        </div>

        {/* Project Password (Scoped Credential) */}
        <div className="lg:col-span-6 p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <h4 className="text-xs font-bold text-zinc-200 flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400" />
              رمز عبور اختصاصی پروژه (Project-Scoped Access)
            </h4>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                hasPassword
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-zinc-800 text-zinc-500'
              }`}
            >
              {hasPassword ? 'رمز فعال است' : 'رمز تنظیم نشده'}
            </span>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            با تنظیم رمز عبور اختصاصی، توسعه‌دهندگان می‌توانند با وارد کردن اسلاگ پروژه ({project.slug}) و این کلمه‌عبور، بدون نیاز به دسترسی حساب اصلی مستقیماً به کنسول متصل شوند.
          </p>

          <form onSubmit={handleSetPassword} className="space-y-3">
            <div>
              <label className="text-[11px] text-zinc-400 block mb-1">کلمه عبور جدید پروژه</label>
              <input
                type="password"
                placeholder="حداقل ۴ کاراکتر"
                value={projectPassword}
                onChange={(e) => setProjectPassword(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-200"
              />
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs transition"
              >
                ثبت رمز عبور اختصاصی
              </button>
              {hasPassword && (
                <button
                  type="button"
                  onClick={handleRemovePassword}
                  className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold border border-red-500/20 transition"
                >
                  حذف رمز پروژه
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Per-Service API Keys Management */}
      <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-4">
        <div className="border-b border-zinc-800/80 pb-3 flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-zinc-200 flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-400" />
              کلیدهای دسترسی تفکیک‌شده سرویس‌ها (Per-Service API Keys)
            </h4>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              جهت رعایت اصل حداقل دسترسی (Least Privilege)، هر سرویس دارای کلید API مستقل با امضای محرمانه است.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(apiKeys).map(([service, keyVal]) => (
            <div key={service} className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase font-mono text-amber-400">
                  سرویس {service}
                </span>
                <button
                  onClick={() => handleRegenerateKey(service)}
                  className="flex items-center space-x-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition"
                >
                  <RotateCw className="w-3 h-3" />
                  <span>صدور مجدد</span>
                </button>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={keyVal}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 font-mono text-xs text-zinc-300 select-all"
                />
                <button
                  onClick={() => handleCopyKey(service, keyVal)}
                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-zinc-300 transition"
                  title="کپی کلید"
                >
                  {copiedKey === service ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="p-5 rounded-2xl bg-red-950/20 border border-red-500/30 space-y-3">
        <h4 className="text-xs font-bold text-red-400 flex items-center gap-2">
          <Trash2 className="w-4 h-4" />
          حذف دائمی پروژه (Danger Zone)
        </h4>
        <p className="text-xs text-zinc-400 leading-relaxed">
          با حذف پروژه، تمامی داده‌های پایگاه داده، جداول، کاربران، باکت‌ها و فایل‌ها و توابع لبه به صورت برگشت‌ناپذیر پاکسازی خواهند شد.
        </p>
        <button
          onClick={onDeleteProject}
          className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition shadow-sm"
        >
          حذف دائمی این پروژه
        </button>
      </div>
    </div>
  );
};
