import React, { useState } from 'react';
import { Project, ComplianceSettings } from '../types';
import {
  Award,
  ExternalLink,
  ShieldCheck,
  Smartphone,
  Save,
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
      <div className="p-5 rounded-2xl bg-[#171717] border border-[#242424] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-[#3ECF8E]" />
            مرکز انطباق قوانین ملی ایران (Regulatory & e-Namad Compliance)
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            پاسخ‌دهنده خودکار هدلس نماد اعتماد الکترونیکی (اینماد)، ساماندهی، و گواهی‌های اتصال عمیق اپلیکیشن (Deep Linking).
          </p>
        </div>

        {isSaved && (
          <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#3ECF8E]/10 border border-[#3ECF8E]/20 text-[#3ECF8E] text-xs font-medium animate-fadeIn">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>تنظیمات ذخیره شد</span>
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* e-Namad & Samandehi Form */}
        <div className="lg:col-span-6 p-5 rounded-2xl bg-[#171717] border border-[#242424] space-y-4">
          <h4 className="text-xs font-bold text-zinc-200 flex items-center gap-2 border-b border-[#242424] pb-3">
            <ShieldCheck className="w-4 h-4 text-[#3ECF8E]" />
            نمادهای قانونی کسب‌وکار الکترونیکی
          </h4>

          <form onSubmit={handleSave} className="space-y-3.5">
            <div>
              <label className="text-[11px] text-zinc-400 block mb-1">
                توکن اختصاصی اینماد (enamad.txt Token)
              </label>
              <input
                type="text"
                value={compliance.enamadToken}
                onChange={(e) => setCompliance({ ...compliance, enamadToken: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-[#0f0f0f] border border-[#242424] font-mono text-xs text-zinc-200 focus:border-[#3ECF8E] focus:outline-none"
                placeholder="e.g. enamad_9876543210"
                dir="ltr"
              />
              <span className="text-[10px] text-zinc-500 mt-1 block">
                به صورت خودکار در مسیر <span className="text-[#3ECF8E] font-mono">/enamad.txt</span> منتشر می‌گردد.
              </span>
            </div>

            <div>
              <label className="text-[11px] text-zinc-400 block mb-1">
                کد رهگیری یا اینلاین نماد اینماد
              </label>
              <input
                type="text"
                value={compliance.enamadSymbolCode}
                onChange={(e) => setCompliance({ ...compliance, enamadSymbolCode: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-[#0f0f0f] border border-[#242424] font-mono text-xs text-zinc-200 focus:border-[#3ECF8E] focus:outline-none"
                placeholder="کد نماد الکترونیکی"
                dir="ltr"
              />
            </div>

            <div>
              <label className="text-[11px] text-zinc-400 block mb-1">
                کد احراز رسانه‌های دیجیتال ساماندهی (samandehi.txt)
              </label>
              <input
                type="text"
                value={compliance.samandehiCode}
                onChange={(e) => setCompliance({ ...compliance, samandehiCode: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-[#0f0f0f] border border-[#242424] font-mono text-xs text-zinc-200 focus:border-[#3ECF8E] focus:outline-none"
                placeholder="کد اختصاصی ساماندهی"
                dir="ltr"
              />
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center space-x-1.5 py-2.5 rounded-full bg-[#3ECF8E] hover:bg-[#34b27b] text-[#0f0f0f] font-medium text-xs transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>ذخیره و انتشار مجوزهای قانونی</span>
            </button>
          </form>

          {/* Quick Links */}
          <div className="pt-2 border-t border-[#242424] flex items-center gap-3 text-xs">
            <a
              href={`https://${project.slug}.localme.ir/enamad.txt`}
              target="_blank"
              rel="noreferrer"
              className="text-[#3ECF8E] hover:underline flex items-center gap-1 font-mono text-[11px]"
              dir="ltr"
            >
              مشاهده /enamad.txt
              <ExternalLink className="w-3 h-3" />
            </a>
            <span className="text-zinc-600">•</span>
            <a
              href={`https://${project.slug}.localme.ir/samandehi.txt`}
              target="_blank"
              rel="noreferrer"
              className="text-[#3ECF8E] hover:underline flex items-center gap-1 font-mono text-[11px]"
              dir="ltr"
            >
              مشاهده /samandehi.txt
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Mobile Deep Linking Form */}
        <div className="lg:col-span-6 p-5 rounded-2xl bg-[#171717] border border-[#242424] space-y-4">
          <h4 className="text-xs font-bold text-zinc-200 flex items-center gap-2 border-b border-[#242424] pb-3">
            <Smartphone className="w-4 h-4 text-[#3ECF8E]" />
            دیپ‌لینک اپلیکیشن‌های موبایل (Android & iOS Deep Linking)
          </h4>

          <div className="space-y-3.5">
            <div>
              <label className="text-[11px] text-zinc-400 block mb-1">
                نام پکیج اندروید (Android Package Name)
              </label>
              <input
                type="text"
                value={compliance.androidPackageName}
                onChange={(e) => setCompliance({ ...compliance, androidPackageName: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-[#0f0f0f] border border-[#242424] font-mono text-xs text-zinc-200 focus:border-[#3ECF8E] focus:outline-none"
                placeholder="ir.localme.app"
                dir="ltr"
              />
            </div>

            <div>
              <label className="text-[11px] text-zinc-400 block mb-1">
                اثر انگشت SHA-256 گواهی امضای اندروید (SHA-256 Fingerprint)
              </label>
              <input
                type="text"
                value={compliance.androidSha256Fingerprint}
                onChange={(e) => setCompliance({ ...compliance, androidSha256Fingerprint: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-[#0f0f0f] border border-[#242424] font-mono text-xs text-zinc-200 focus:border-[#3ECF8E] focus:outline-none"
                placeholder="14:6D:E9:..."
                dir="ltr"
              />
              <span className="text-[10px] text-zinc-500 mt-1 block">
                در مسیر <span className="text-[#3ECF8E] font-mono">/.well-known/assetlinks.json</span> تولید می‌شود.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">
                  شناسه تیم اپل (Team ID)
                </label>
                <input
                  type="text"
                  value={compliance.appleTeamId}
                  onChange={(e) => setCompliance({ ...compliance, appleTeamId: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#0f0f0f] border border-[#242424] font-mono text-xs text-zinc-200 focus:border-[#3ECF8E] focus:outline-none"
                  placeholder="9JA6EQ..."
                  dir="ltr"
                />
              </div>
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">
                  شناسه باندل iOS
                </label>
                <input
                  type="text"
                  value={compliance.appleAppBundleId}
                  onChange={(e) => setCompliance({ ...compliance, appleAppBundleId: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#0f0f0f] border border-[#242424] font-mono text-xs text-zinc-200 focus:border-[#3ECF8E] focus:outline-none"
                  placeholder="ir.localme.ios"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-[#242424] flex items-center gap-3 text-xs">
              <a
                href={`https://${project.slug}.localme.ir/.well-known/assetlinks.json`}
                target="_blank"
                rel="noreferrer"
                className="text-[#3ECF8E] hover:underline flex items-center gap-1 font-mono text-[11px]"
                dir="ltr"
              >
                مشاهده assetlinks.json
                <ExternalLink className="w-3 h-3" />
              </a>
              <span className="text-zinc-600">•</span>
              <a
                href={`https://${project.slug}.localme.ir/.well-known/apple-app-site-association`}
                target="_blank"
                rel="noreferrer"
                className="text-[#3ECF8E] hover:underline flex items-center gap-1 font-mono text-[11px]"
                dir="ltr"
              >
                مشاهده Apple Association
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
