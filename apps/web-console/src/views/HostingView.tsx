import React, { useState, useEffect, useCallback } from 'react';
import { Project, DeploymentRelease, CustomDomain } from '../types';
import {
  Globe,
  ExternalLink,
  ShieldCheck,
  Plus,
  Trash2,
  Link2,
} from 'lucide-react';

interface HostingViewProps {
  project: Project;
  onOpenDeployModal: () => void;
  onOpenAddDomainModal: () => void;
  activeSubView?: string;
  onSubViewChange?: (subView: string) => void;
}

export const HostingView: React.FC<HostingViewProps> = ({
  project,
  onOpenDeployModal,
  onOpenAddDomainModal,
  activeSubView = 'deployments',
}) => {
  const [deployments, setDeployments] = useState<DeploymentRelease[]>([]);
  const [domains, setDomains] = useState<CustomDomain[]>([]);
  const [isLoadingDeployments, setIsLoadingDeployments] = useState(false);
  const [isLoadingDomains, setIsLoadingDomains] = useState(false);
  const [verifyingDomain, setVerifyingDomain] = useState<string | null>(null);

  // Real API: Fetch Domains
  const fetchDomains = useCallback(async () => {
    setIsLoadingDomains(true);
    try {
      const res = await fetch(`/_baas/v1/${project.slug}/hosting/domains`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setDomains(
            data.map((d: Record<string, unknown> | string) => {
              if (typeof d === 'string') {
                return {
                  id: d,
                  domain: d,
                  isVerified: true,
                  sslActive: true,
                  hasSsl: true,
                  cnameTarget: `${project.slug}.localme.ir`,
                  createdAt: '',
                };
              }
              return {
                id: String(d.id || d.domain || ''),
                domain: String(d.domain || ''),
                isVerified: Boolean(d.isVerified ?? d.verified ?? true),
                sslActive: Boolean(d.sslActive ?? d.hasSsl ?? d.ssl ?? true),
                hasSsl: Boolean(d.sslActive ?? d.hasSsl ?? d.ssl ?? true),
                cnameTarget: String(d.cnameTarget || `${project.slug}.localme.ir`),
                createdAt: String(d.createdAt || ''),
              };
            })
          );
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingDomains(false);
    }
  }, [project.slug]);

  // Real API: Fetch Deployments
  const fetchDeployments = useCallback(async () => {
    setIsLoadingDeployments(true);
    try {
      const res = await fetch(`/_baas/v1/${project.slug}/hosting/deployments`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setDeployments(
            data.map((dep: Record<string, unknown>) => ({
              id: String(dep.id || ''),
              branch: String(dep.branch || 'main'),
              commitSha: String(dep.commitSha || dep.sha || 'HEAD'),
              commitMessage: String(dep.commitMessage || dep.message || 'استقرار نسخه وب'),
              domain: String(dep.domain || `${project.slug}.localme.ir`),
              deployedAt: String(dep.deployedAt || dep.createdAt || 'هم‌اکنون'),
              status: (dep.status as DeploymentRelease['status']) || 'READY',
              sizeBytes: Number(dep.sizeBytes || 0),
              url: String(dep.url || `https://${project.slug}.localme.ir`),
              previewUrl: String(dep.previewUrl || dep.url || `https://${project.slug}.localme.ir`),
            }))
          );
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingDeployments(false);
    }
  }, [project.slug]);

  useEffect(() => {
    fetchDomains();
    fetchDeployments();
  }, [fetchDomains, fetchDeployments]);

  // Real API: Verify Domain
  const handleVerifyDomain = async (domainName: string) => {
    setVerifyingDomain(domainName);
    try {
      const res = await fetch(`/_baas/v1/${project.slug}/hosting/domains/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: domainName }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.verified) {
        setDomains((prev) =>
          prev.map((d) => (d.domain === domainName ? { ...d, isVerified: true } : d))
        );
        alert(`دامنه «${domainName}» با موفقیت تایید و گواهی امنیتی فعال گردید.`);
      } else {
        alert(data.message || `رکورد CNAME دامنه هنوز در شبکه DNS شناسایی نشده است.`);
      }
    } catch {
      alert('خطا در بررسی رکورد DNS دامنه.');
    } finally {
      setVerifyingDomain(null);
    }
  };

  // Real API: Delete Domain
  const handleDeleteDomain = async (domainName: string) => {
    if (!confirm(`آیا از حذف دامنه ${domainName} اطمینان دارید؟`)) return;
    try {
      const res = await fetch(`/_baas/v1/${project.slug}/hosting/domains/${domainName}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setDomains((prev) => prev.filter((d) => d.domain !== domainName));
      }
    } catch {
      // ignore
    }
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
            {activeSubView === 'domains'
              ? 'دامنه‌های اختصاصی و گواهی امنیتی'
              : activeSubView === 'routing'
              ? 'مسیریابی شبکه لبه و CDN'
              : 'استقرار وب‌سایت و تاریخچه انتشار'}
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            استقرار سریع وب‌سایت‌ها، اتصال دامنه‌های ملی و بین‌المللی با صدور خودکار SSL و شتاب‌دهی شبکه.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeSubView === 'domains' ? (
            <button
              onClick={onOpenAddDomainModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>ثبت دامنه جدید</span>
            </button>
          ) : (
            <button
              onClick={onOpenDeployModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>استقرار نسخه جدید</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub-View: Routing */}
      {activeSubView === 'routing' && (
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs max-w-2xl space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Link2 className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">مسیریابی شبکه لبه و شتاب‌دهی توزیع‌شده</h3>
          </div>
          <div className="space-y-3 text-xs text-slate-600">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span>زیردامنه اختصاصی پلتفرم:</span>
              <strong className="font-mono text-emerald-700" dir="ltr">{project.slug}.localme.ir</strong>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span>گواهی امنیتی SSL/TLS:</span>
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-4 h-4" /> خودکار و فعال
              </span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span>موقعیت دیتاسنتر لبه:</span>
              <span>ایران - تهران (برج میلاد آسیاتک)</span>
            </div>
          </div>
        </div>
      )}

      {/* Sub-View: Custom Domains */}
      {activeSubView === 'domains' && (
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="text-xs font-bold text-slate-900">
              دامنه‌های متصل به این پروژه ({domains.length})
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-right text-xs" dir="rtl">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                  <th className="py-2.5 px-3">نام دامنه</th>
                  <th className="py-2.5 px-3 text-center">وضعیت DNS</th>
                  <th className="py-2.5 px-3 text-center">گواهی امنیتی</th>
                  <th className="py-2.5 px-3 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoadingDomains ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-xs text-slate-500">
                      در حال دریافت لیست دامنه‌ها...
                    </td>
                  </tr>
                ) : domains.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-xs text-slate-400">
                      هنوز دامنه اختصاصی متصل نشده است. روی دکمه «ثبت دامنه جدید» کلیک کنید.
                    </td>
                  </tr>
                ) : (
                  domains.map((d) => (
                    <tr key={d.domain} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800" dir="ltr">
                        {d.domain}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            d.isVerified
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {d.isVerified ? 'تایید شده' : 'در انتظار تنظیم DNS'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="text-emerald-700 font-medium inline-flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" /> فعال
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {!d.isVerified && (
                            <button
                              onClick={() => handleVerifyDomain(d.domain)}
                              disabled={verifyingDomain === d.domain}
                              className="px-2.5 py-1 rounded-md text-[10px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition"
                            >
                              {verifyingDomain === d.domain ? 'در حال بررسی...' : 'بررسی مجدد CNAME'}
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteDomain(d.domain)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition"
                            title="حذف دامنه"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub-View: Deployments History (Default) */}
      {(activeSubView === 'deployments' || (!activeSubView && activeSubView !== 'domains' && activeSubView !== 'routing')) && (
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="text-xs font-bold text-slate-900">
              تاریخچه استقرارها ({deployments.length})
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-right text-xs" dir="rtl">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                  <th className="py-2.5 px-3">عنوان نسخه و کامیت</th>
                  <th className="py-2.5 px-3 text-center">شناسه SHA</th>
                  <th className="py-2.5 px-3 text-center">زمان انتشار</th>
                  <th className="py-2.5 px-3 text-center">وضعیت انتشار</th>
                  <th className="py-2.5 px-3 text-center">مشاهده</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoadingDeployments ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-xs text-slate-500">
                      در حال بارگذاری استقرارها...
                    </td>
                  </tr>
                ) : deployments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-xs text-slate-400">
                      هنوز نسخه‌ای برای این پروژه مستقر نشده است.
                    </td>
                  </tr>
                ) : (
                  deployments.map((dep) => (
                    <tr key={dep.id} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-3 font-medium text-slate-800">
                        {dep.commitMessage}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-500 text-[11px]" dir="ltr">
                        {dep.commitSha}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-500 text-[11px]">
                        {dep.deployedAt}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                          فعال در لبه
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <a
                          href={dep.url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 rounded text-slate-500 hover:text-emerald-700 transition inline-flex items-center"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
