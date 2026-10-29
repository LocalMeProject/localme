import React, { useState } from 'react';
import { Project, DeploymentRelease, CustomDomain } from '../types';
import {
  Globe,
  ExternalLink,
  ShieldCheck,
  RotateCcw,
  Plus,
  Trash2,
} from 'lucide-react';

interface HostingViewProps {
  project: Project;
  onOpenDeployModal: () => void;
  onOpenAddDomainModal: () => void;
}

const INITIAL_DEPLOYMENTS: DeploymentRelease[] = [];
const INITIAL_DOMAINS: CustomDomain[] = [];

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
    alert(`بازگشت به نسخه ${depId} با موفقیت انجام شد.`);
  };

  const handleRemoveDomain = (domainName: string) => {
    if (!confirm(`آیا از حذف دامنه ${domainName} اطمینان دارید؟`)) return;
    setDomains((prev) => prev.filter((d) => d.domain !== domainName));
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              میزبانی وب و دامنه‌ها
            </span>
            <span className="text-xs text-slate-400 font-mono" dir="ltr">
              {project.slug}
            </span>
          </div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Globe className="w-5 h-5 text-emerald-600" />
            استقرار وب‌سایت و مدیریت دامنه‌ها
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            استقرار مستقیم وب‌سایت‌ها، صدور خودکار گواهی امنیتی و اتصال دامنه‌های اختصاصی ir و بین‌المللی.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenDeployModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>استقرار نسخه جدید</span>
          </button>
        </div>
      </div>

      {/* Subdomain Live Banner */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <div>
            <div className="text-[11px] text-slate-500">نشانی اینترنتی فعال پروژه:</div>
            <a
              href={`https://${project.slug}.localme.ir`}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-bold font-mono text-emerald-700 hover:underline flex items-center gap-1.5 mt-0.5"
              dir="ltr"
            >
              https://{project.slug}.localme.ir
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>گواهی امنیتی فعال</span>
        </div>
      </div>

      {/* Deployments Releases Table */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <span className="text-xs font-bold text-slate-900">
            تاریخچه نسخه‌های مستقر شده ({deployments.length})
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-right text-xs" dir="rtl">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                <th className="py-2.5 px-3">شناسه نسخه</th>
                <th className="py-2.5 px-3 text-center">زمان استقرار</th>
                <th className="py-2.5 px-3 text-center">توضیحات</th>
                <th className="py-2.5 px-3 text-center">وضعیت</th>
                <th className="py-2.5 px-3 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {deployments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-xs text-slate-400">
                    هنوز نسخه‌ای در این پروژه مستقر نشده است.
                  </td>
                </tr>
              ) : (
                deployments.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800" dir="ltr">
                      {d.id}
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-500 text-[11px]">
                      {d.deployedAt}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-600" dir="ltr">
                      {d.commitSha}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {d.status === 'READY' ? 'فعال' : d.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => handleRollback(d.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>بازگشت به این نسخه</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Custom Domains Manager */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <span className="text-xs font-bold text-slate-900">
              دامنه‌های اختصاصی ({domains.length})
            </span>
            <div className="text-[11px] text-slate-400 mt-0.5">
              اتصال دامنه اختصاصی با رکورد CNAME یا A
            </div>
          </div>

          <button
            onClick={onOpenAddDomainModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-medium text-xs transition border border-emerald-200"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>افزودن دامنه اختصاصی</span>
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-right text-xs" dir="rtl">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                <th className="py-2.5 px-3">دامنه</th>
                <th className="py-2.5 px-3 text-center">وضعیت تایید</th>
                <th className="py-2.5 px-3 text-center">گواهی امنیتی</th>
                <th className="py-2.5 px-3 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {domains.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-xs text-slate-400">
                    هیچ دامنه اختصاصی برای این پروژه ثبت نشده است.
                  </td>
                </tr>
              ) : (
                domains.map((dom) => (
                  <tr key={dom.domain} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800" dir="ltr">
                      {dom.domain}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {dom.isVerified ? 'تایید شده' : 'در انتظار بررسی'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        فعال
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => handleRemoveDomain(dom.domain)}
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="حذف دامنه"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
