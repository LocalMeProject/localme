import React, { useState } from 'react';
import { Project, ComplianceSettings } from '../types';
import {
  Award,
  ShieldCheck,
  Smartphone,
  CheckCircle2,
} from 'lucide-react';

interface ComplianceViewProps {
  project: Project;
}

const INITIAL_COMPLIANCE: ComplianceSettings = {
  enamadToken: '',
  enamadSymbolCode: '',
  samandehiCode: '',
  androidPackageName: '',
  androidSha256Fingerprint: '',
  appleTeamId: '',
  appleAppBundleId: '',
};

export const ComplianceView: React.FC<ComplianceViewProps> = ({ project }) => {
  const [compliance, setCompliance] = useState<ComplianceSettings>(INITIAL_COMPLIANCE);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              اینماد و نمادهای ملی
            </span>
            <span className="text-xs text-slate-400 font-mono" dir="ltr">
              {project.slug}
            </span>
          </div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-600" />
            انطباق قوانین ملی و نمادهای اعتماد
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            تنظیم توکن‌های اینماد، ساماندهی و فایل‌های احراز هویت دامنه‌ها و اتصال مستقیم اپلیکیشن‌های موبایل.
          </p>
        </div>

        {isSaved && (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>تنظیمات ذخیره شد</span>
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* e-Namad & Samandehi Form */}
        <div className="lg:col-span-6 p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            نمادهای قانونی و مجوزهای وب
          </h3>

          <form onSubmit={handleSave} className="space-y-3.5">
            <div>
              <label className="text-[11px] text-slate-600 font-medium block mb-1">
                توکن اختصاصی تاییدیه اینماد
              </label>
              <input
                type="text"
                value={compliance.enamadToken}
                onChange={(e) => setCompliance({ ...compliance, enamadToken: e.target.value })}
                className="w-full px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xs text-slate-800 focus:border-emerald-500 focus:outline-none"
                placeholder="مثال: enamad_12345678"
                dir="ltr"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                به صورت خودکار در نشانی <span className="text-emerald-700 font-mono" dir="ltr">/enamad.txt</span> منتشر می‌شود.
              </span>
            </div>

            <div>
              <label className="text-[11px] text-slate-600 font-medium block mb-1">
                کد رهگیری نماد اعتماد
              </label>
              <input
                type="text"
                value={compliance.enamadSymbolCode}
                onChange={(e) => setCompliance({ ...compliance, enamadSymbolCode: e.target.value })}
                className="w-full px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xs text-slate-800 focus:border-emerald-500 focus:outline-none"
                placeholder="کد رهگیری نماد"
                dir="ltr"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-600 font-medium block mb-1">
                کد احراز رسانه‌های دیجیتال ساماندهی
              </label>
              <input
                type="text"
                value={compliance.samandehiCode}
                onChange={(e) => setCompliance({ ...compliance, samandehiCode: e.target.value })}
                className="w-full px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xs text-slate-800 focus:border-emerald-500 focus:outline-none"
                placeholder="کد ساماندهی"
                dir="ltr"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                به صورت خودکار در نشانی <span className="text-emerald-700 font-mono" dir="ltr">/samandehi.txt</span> قرار می‌گیرد.
              </span>
            </div>

            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition shadow-xs"
            >
              ذخیره تنظیمات نمادها
            </button>
          </form>
        </div>

        {/* Mobile App Deep Links Form */}
        <div className="lg:col-span-6 p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Smartphone className="w-4 h-4 text-emerald-600" />
            احراز هویت و اتصال عمیق اپلیکیشن‌های موبایل
          </h3>

          <form onSubmit={handleSave} className="space-y-3.5">
            <div>
              <label className="text-[11px] text-slate-600 font-medium block mb-1">
                نام بسته اپلیکیشن اندروید (Package Name)
              </label>
              <input
                type="text"
                value={compliance.androidPackageName}
                onChange={(e) => setCompliance({ ...compliance, androidPackageName: e.target.value })}
                className="w-full px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xs text-slate-800 focus:border-emerald-500 focus:outline-none"
                placeholder="ir.localme.app"
                dir="ltr"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-600 font-medium block mb-1">
                اثر انگشت کلید امضای اندروید (SHA-256)
              </label>
              <input
                type="text"
                value={compliance.androidSha256Fingerprint}
                onChange={(e) => setCompliance({ ...compliance, androidSha256Fingerprint: e.target.value })}
                className="w-full px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xs text-slate-800 focus:border-emerald-500 focus:outline-none"
                placeholder="AA:BB:CC:DD..."
                dir="ltr"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                تولید خودکار فایل <span className="text-emerald-700 font-mono" dir="ltr">/.well-known/assetlinks.json</span>
              </span>
            </div>

            <div>
              <label className="text-[11px] text-slate-600 font-medium block mb-1">
                شناسه تیم اپل (Apple Team ID)
              </label>
              <input
                type="text"
                value={compliance.appleTeamId}
                onChange={(e) => setCompliance({ ...compliance, appleTeamId: e.target.value })}
                className="w-full px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xs text-slate-800 focus:border-emerald-500 focus:outline-none"
                placeholder="10 رقمی"
                dir="ltr"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition shadow-xs"
            >
              ذخیره تنظیمات اپلیکیشن
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
