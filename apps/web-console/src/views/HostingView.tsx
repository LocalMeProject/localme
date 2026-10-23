import React, { useState } from 'react';
import { Project, DeploymentRelease, CustomDomain } from '../types';
import {
  Globe,
  ExternalLink,
  ShieldCheck,
  RotateCcw,
  Zap,
  Trash2,
} from 'lucide-react';

interface HostingViewProps {
  project: Project;
  onOpenDeployModal: () => void;
  onOpenAddDomainModal: () => void;
}

const INITIAL_DEPLOYMENTS: DeploymentRelease[] = [
  {
    id: 'dep-401',
    branch: 'main',
    commitSha: '9a8b7c6',
    domain: 'digikala-clone.localme.ir',
    status: 'READY',
    sizeBytes: 1048576 * 4.2,
    deployedAt: '۱۴۰۳/۰۷/۱۶ - ۱۴:۰۰',
    previewUrl: 'https://digikala-clone.localme.ir',
  },
  {
    id: 'dep-400',
    branch: 'feat/checkout',
    commitSha: '3d2e1f0',
    domain: 'dep-400.digikala-clone.localme.ir',
    status: 'READY',
    sizeBytes: 1048576 * 4.1,
    deployedAt: '۱۴۰۳/۰۷/۱۵ - ۱۸:۳۰',
    previewUrl: 'https://digikala-clone.localme.ir',
  },
];

const INITIAL_DOMAINS: CustomDomain[] = [
  {
    domain: 'shop.mycompany.ir',
    isVerified: true,
    sslActive: true,
    cnameTarget: 'cname.localme.ir',
    createdAt: '۱۴۰۳/۰۷/۰۵',
  },
];

export const HostingView: React.FC<HostingViewProps> = ({
  project,
  onOpenDeployModal,
  onOpenAddDomainModal,
}) => {
  const [deployments, setDeployments] = useState<DeploymentRelease[]>(INITIAL_DEPLOYMENTS);
  const [domains, setDomains] = useState<CustomDomain[]>(INITIAL_DOMAINS);

  const handleRollback = (depId: string) => {
    setDeployments((prev) =>
      prev.map((d) => (d.id === depId ? { ...d, status: 'READY' } : d))
    );
    alert(`درخواست بازگشت (Rollback) به نسخه ${depId} با موفقیت در پروژه ${project.name} اعمال شد.`);
  };

  const handleRemoveDomain = (domainName: string) => {
    if (!confirm(`آیا از حذف دامنه ${domainName} اطمینان دارید؟`)) return;
    setDomains((prev) => prev.filter((d) => d.domain !== domainName));
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <Globe className="w-5 h-5 text-amber-400" />
            استقرار وب‌سایت و مدیریت دامنه‌ها (Web Hosting & Anycast CDN)
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            هاستینگ محتوامحور تغییرناپذیر (Immutable Content-Addressed) با صدور خودکار SSL و تزریق متای نمادهای قانونی.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onOpenDeployModal}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs transition shadow-sm"
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>+ استقرار نسخه جدید</span>
          </button>
        </div>
      </div>

      {/* Subdomain Live Banner */}
      <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <div>
            <div className="text-[11px] text-zinc-400">آدرس زنده پروژه روی شبکه ملی توزیع محتوا:</div>
            <a
              href={`https://${project.slug}.localme.ir`}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-bold font-mono text-amber-400 hover:underline flex items-center gap-1.5 mt-0.5"
            >
              https://{project.slug}.localme.ir
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono">
          <span className="px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-300 border border-zinc-700">
            گواهی امنیتی: <strong className="text-emerald-400">Let's Encrypt SSL</strong>
          </span>
        </div>
      </div>

      {/* Deployments Releases Table */}
      <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-3">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
          <span className="text-xs font-bold text-zinc-200">
            تاریخچه نسخه‌های مستقر شده ({deployments.length})
          </span>
          <span className="text-[10px] text-zinc-400 font-mono">
            YARP Reverse Proxy
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-zinc-800/60 text-zinc-400">
                <th className="py-2.5 px-3">شناسه استقرار</th>
                <th className="py-2.5 px-3">شاخه گیت</th>
                <th className="py-2.5 px-3">کامیت</th>
                <th className="py-2.5 px-3">دامنه فعال</th>
                <th className="py-2.5 px-3">حجم بیلد</th>
                <th className="py-2.5 px-3">وضعیت</th>
                <th className="py-2.5 px-3">تاریخ استقرار</th>
                <th className="py-2.5 px-3 text-right">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40">
              {deployments.map((dep) => (
                <tr key={dep.id} className="hover:bg-zinc-850/30">
                  <td className="py-2.5 px-3 font-bold text-zinc-200">{dep.id}</td>
                  <td className="py-2.5 px-3 text-zinc-300">{dep.branch}</td>
                  <td className="py-2.5 px-3 text-amber-400">{dep.commitSha}</td>
                  <td className="py-2.5 px-3 text-zinc-400">{dep.domain}</td>
                  <td className="py-2.5 px-3 text-zinc-300">{(dep.sizeBytes / (1024 * 1024)).toFixed(1)} MB</td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                      {dep.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-zinc-500">{dep.deployedAt}</td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end space-x-1.5">
                      <a
                        href={dep.previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-1 rounded text-[11px] bg-zinc-800 hover:bg-zinc-750 text-zinc-200"
                      >
                        پیش‌نمایش
                      </a>
                      <button
                        onClick={() => handleRollback(dep.id)}
                        className="p-1 rounded text-zinc-400 hover:text-amber-400 hover:bg-zinc-800"
                        title="Rollback"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Custom Domains Manager */}
      <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-3">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
          <div>
            <span className="text-xs font-bold text-zinc-200">
              دامنه‌های اختصاصی متصل (Custom Domains)
            </span>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              رکورد CNAME دامنه خود را به <span className="font-mono text-amber-400">cname.localme.ir</span> متصل کنید.
            </div>
          </div>

          <button
            onClick={onOpenAddDomainModal}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition"
          >
            + اتصال دامنه اختصاصی
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-zinc-800/60 text-zinc-400">
                <th className="py-2.5 px-3">دامنه</th>
                <th className="py-2.5 px-3">مقصد CNAME</th>
                <th className="py-2.5 px-3">احراز مالکیت DNS</th>
                <th className="py-2.5 px-3">گواهی SSL</th>
                <th className="py-2.5 px-3">تاریخ اتصال</th>
                <th className="py-2.5 px-3 text-right">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40">
              {domains.map((dom) => (
                <tr key={dom.domain} className="hover:bg-zinc-850/30">
                  <td className="py-2.5 px-3 font-bold text-amber-400">{dom.domain}</td>
                  <td className="py-2.5 px-3 text-zinc-400">{dom.cnameTarget}</td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                      تایید شده
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20 flex items-center gap-1 w-max">
                      <ShieldCheck className="w-3 h-3" />
                      فعال (Auto-Renew)
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-zinc-500">{dom.createdAt}</td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => handleRemoveDomain(dom.domain)}
                      className="p-1 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition"
                      title="حذف دامنه"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
