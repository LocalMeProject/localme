import React, { useState } from 'react';
import { Project } from '../types';
import {
  Settings,
  Key,
  Trash2,
  Copy,
  RotateCw,
  Check,
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
    alert('مشخصات عمومی پروژه با موفقیت ذخیره گردید.');
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
    if (!confirm(`آیا از صدور مجدد کلید این سرویس اطمینان دارید؟ کلید قبلی بلافاصله باطل خواهد شد.`)) return;
    const newKey = `lm_${keyName.slice(0, 3)}_${project.id.slice(0, 8)}_live_${Math.random().toString(36).slice(2, 8)}`;
    setApiKeys((prev) => ({ ...prev, [keyName]: newKey }));
    alert(`کلید جدید سرویس صادر گردید.`);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              تنظیمات و دسترسی‌ها
            </span>
            <span className="text-xs text-slate-400 font-mono" dir="ltr">
              {project.slug}
            </span>
          </div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-600" />
            تنظیمات عمومی، کلیدهای دسترسی و امنیت پروژه
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            ویرایش اطلاعات پروژه، صدور و مدیریت کلیدهای دسترسی API و تنظیم رمز عبور اختصاصی.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* General Settings */}
        <div className="lg:col-span-6 p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-slate-900 border-b border-slate-100 pb-3">
            مشخصات عمومی پروژه
          </h3>

          <form onSubmit={handleSaveGeneral} className="space-y-3.5">
            <div>
              <label className="text-[11px] text-slate-600 font-medium block mb-1">نام پروژه</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 font-medium focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-600 font-medium block mb-1">شناسه یکتا (Slug)</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 font-mono focus:border-emerald-500 focus:outline-none"
                dir="ltr"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-600 font-medium block mb-1">توضیحات پروژه</label>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={3}
                className="w-full px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none leading-relaxed"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition shadow-xs"
            >
              ذخیره تغییرات عمومی
            </button>
          </form>
        </div>

        {/* Access Protection */}
        <div className="lg:col-span-6 p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-slate-900 border-b border-slate-100 pb-3">
            امنیت و رمز عبور اختصاصی
          </h3>

          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-800">حفاظت با رمز عبور</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {hasPassword ? 'پروژه دارای رمز عبور اختصاصی است.' : 'بدون رمز عبور اختصاصی'}
                </div>
              </div>
              <span
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  hasPassword
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {hasPassword ? 'فعال' : 'غیرفعال'}
              </span>
            </div>

            <form onSubmit={handleSetPassword} className="space-y-2">
              <label className="text-[11px] text-slate-600 font-medium block">
                {hasPassword ? 'تغییر رمز عبور پروژه' : 'تنظیم رمز عبور جدید'}
              </label>
              <input
                type="password"
                value={projectPassword}
                onChange={(e) => setProjectPassword(e.target.value)}
                placeholder="حداقل ۴ کاراکتر"
                className="w-full px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none"
                dir="ltr"
              />
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition shadow-xs"
                >
                  {hasPassword ? 'به‌روزرسانی رمز' : 'ثبت رمز عبور'}
                </button>
                {hasPassword && (
                  <button
                    type="button"
                    onClick={handleRemovePassword}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs transition"
                  >
                    حذف رمز
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* API Keys */}
        <div className="lg:col-span-12 p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
            <Key className="w-4 h-4 text-emerald-600" />
            <span>کلیدهای دسترسی API سرویس‌ها</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {Object.entries(apiKeys).map(([srv, keyVal]) => {
              const srvLabels: Record<string, string> = {
                database: 'پایگاه داده رابطه‌ای',
                auth: 'احراز هویت پیامکی',
                storage: 'فضای ذخیره‌سازی ابری',
                functions: 'توابع بدون سرور',
              };
              const isCopied = copiedKey === srv;
              return (
                <div key={srv} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{srvLabels[srv] || srv}</span>
                    <button
                      onClick={() => handleRegenerateKey(srv)}
                      className="text-[11px] text-slate-400 hover:text-emerald-700 flex items-center gap-1 transition"
                      title="صدور مجدد کلید"
                    >
                      <RotateCw className="w-3 h-3" />
                      <span>صدور مجدد</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      readOnly
                      value={keyVal}
                      dir="ltr"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 font-mono text-[11px] text-slate-700 select-all"
                    />
                    <button
                      onClick={() => handleCopyKey(srv, keyVal)}
                      className="p-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 transition"
                      title="کپی کلید"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="lg:col-span-12 p-5 rounded-2xl bg-white border border-rose-200 shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-rose-700">منطقه حساس و حذف پروژه</h3>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
              با حذف این پروژه، تمام جداول پایگاه داده، فایل‌ها و کاربران به صورت غیرقابل بازگشت پاکسازی خواهند شد.
            </p>
            <button
              onClick={onDeleteProject}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-medium text-xs transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>حذف دائمی این پروژه</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
