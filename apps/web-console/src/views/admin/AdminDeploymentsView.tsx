import { useState, useEffect } from 'react';
import { 
  Zap, 
  Globe, 
  Cpu, 
  RefreshCw, 
  Trash2, 
  Eye, 
  CheckCircle2, 
  AlertCircle, 
  Server, 
  Clock 
} from 'lucide-react';
import { api } from '../../utils/apiClient';
import { toPersianDigits } from '../../utils/persian';

interface AdminFunction {
  id: string;
  projectId: string;
  projectSlug: string;
  projectName: string;
  name: string;
  slug: string;
  triggerPath: string;
  runtime: string;
  script: string;
  invocations: number;
  createdAt: string;
  updatedAt: string;
}

interface AdminDomain {
  projectId: string;
  projectSlug: string;
  projectName: string;
  domain: string;
  isVerified: boolean;
  sslStatus: string;
  createdAt: string;
}

interface RuntimeDiagnostics {
  osDescription: string;
  osArchitecture: string;
  processArchitecture: string;
  frameworkDescription: string;
  processId: number;
  processorCount: number;
  gcTotalMemoryBytes: number;
  gcTotalMemoryPretty: string;
  isServerGC: boolean;
  threadCount: number;
  upTime: string;
}

export function AdminDeploymentsView() {
  const [activeSubTab, setActiveSubTab] = useState<'functions' | 'domains' | 'runtime'>('functions');

  // Functions state
  const [functions, setFunctions] = useState<AdminFunction[]>([]);
  const [loadingFns, setLoadingFns] = useState(false);
  const [selectedScript, setSelectedScript] = useState<AdminFunction | null>(null);

  // Domains state
  const [domains, setDomains] = useState<AdminDomain[]>([]);
  const [loadingDomains, setLoadingDomains] = useState(false);

  // Runtime diagnostics state
  const [runtime, setRuntime] = useState<RuntimeDiagnostics | null>(null);
  const [loadingRuntime, setLoadingRuntime] = useState(false);

  const fetchFunctions = async () => {
    setLoadingFns(true);
    try {
      const res = await api.get('/_baas/v1/admin/deployments/functions');
      if (Array.isArray(res)) {
        setFunctions(res);
      }
    } catch (err) {
      console.error('Failed to load edge functions', err);
    } finally {
      setLoadingFns(false);
    }
  };

  const fetchDomains = async () => {
    setLoadingDomains(true);
    try {
      const res = await api.get('/_baas/v1/admin/deployments/domains');
      if (Array.isArray(res)) {
        setDomains(res);
      }
    } catch (err) {
      console.error('Failed to load domains', err);
    } finally {
      setLoadingDomains(false);
    }
  };

  const fetchRuntime = async () => {
    setLoadingRuntime(true);
    try {
      const res = await api.get('/_baas/v1/admin/system/runtime');
      if (res) {
        setRuntime(res);
      }
    } catch (err) {
      console.error('Failed to load runtime diagnostics', err);
    } finally {
      setLoadingRuntime(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'functions') fetchFunctions();
    else if (activeSubTab === 'domains') fetchDomains();
    else if (activeSubTab === 'runtime') fetchRuntime();
  }, [activeSubTab]);

  const handleDeleteFunction = async (fn: AdminFunction) => {
    if (!window.confirm(`آیا از حذف تابع "${fn.name}" در پروژه "${fn.projectName}" اطمینان دارید؟`)) return;
    try {
      await api.delete(`/_baas/v1/admin/deployments/functions/${encodeURIComponent(fn.projectId)}/${encodeURIComponent(fn.slug)}`);
      setFunctions((prev) => prev.filter((item) => item.id !== fn.id));
    } catch (err: any) {
      alert(`خطا در حذف تابع: ${err.message}`);
    }
  };

  const handleDeleteDomain = async (d: AdminDomain) => {
    if (!window.confirm(`آیا از قطع اتصال دامنه "${d.domain}" از پروژه "${d.projectName}" اطمینان دارید؟`)) return;
    try {
      await api.delete(`/_baas/v1/admin/deployments/domains/${encodeURIComponent(d.projectId)}/${encodeURIComponent(d.domain)}`);
      setDomains((prev) => prev.filter((item) => !(item.projectId === d.projectId && item.domain === d.domain)));
    } catch (err: any) {
      alert(`خطا در حذف دامنه: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">مدیریت کلان توابع لبه، دامنه‌ها و زمان اجرای سرور</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
              Global Platform Deployments
            </span>
          </div>
          <p className="text-xs text-slate-500">
            مشاهده و نظارت بر کلیه توابع سرورلس، دامنه‌های اختصاصی تننت‌ها و سلامت هسته زمان اجرای .NET 10.
          </p>
        </div>

        {/* Sub-tab pills */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-medium">
          <button
            onClick={() => setActiveSubTab('functions')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
              activeSubTab === 'functions' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>توابع لبه ({toPersianDigits(functions.length)})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('domains')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
              activeSubTab === 'domains' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>دامنه‌های متصل ({toPersianDigits(domains.length)})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('runtime')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
              activeSubTab === 'runtime' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>سلامت هسته و ران‌تایم</span>
          </button>
        </div>
      </div>

      {/* TAB 1: Functions */}
      {activeSubTab === 'functions' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-800">فهرست کل توابع لبه مستقر در تمامی پروژه‌ها</span>
            <button
              onClick={fetchFunctions}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingFns ? 'animate-spin text-emerald-600' : ''}`} />
              <span>تازه سازی</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="px-5 py-3">نام تابع</th>
                  <th className="px-5 py-3">پروژه تننت</th>
                  <th className="px-5 py-3">مسیر اجرا (Trigger)</th>
                  <th className="px-5 py-3">محیط اجرا</th>
                  <th className="px-5 py-3">تاریخ ایجاد</th>
                  <th className="px-5 py-3 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {functions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                      {loadingFns ? 'در حال بارگذاری توابع...' : 'هیچ تابع لبه‌ای تاکنون ثبت نشده است.'}
                    </td>
                  </tr>
                ) : (
                  functions.map((fn) => (
                    <tr key={fn.id} className="hover:bg-slate-50 transition">
                      <td className="px-5 py-3 font-bold text-slate-900 font-mono text-[11px]" dir="ltr">
                        {fn.name}
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-medium text-slate-800">{fn.projectName}</span>
                        <span className="text-[10px] text-slate-400 block font-mono" dir="ltr">{fn.projectSlug}</span>
                      </td>
                      <td className="px-5 py-3 font-mono text-[11px] text-emerald-700" dir="ltr">
                        {fn.triggerPath}
                      </td>
                      <td className="px-5 py-3 font-mono text-[11px]">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600">
                          {fn.runtime}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-500 text-[11px] font-mono" dir="ltr">
                        {fn.createdAt ? new Date(fn.createdAt).toLocaleDateString('fa-IR') : '—'}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setSelectedScript(fn)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition"
                            title="مشاهده کد جاوااسکریپت"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteFunction(fn)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="حذف تابع"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* TAB 2: Domains */}
      {activeSubTab === 'domains' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-800">فهرست دامنه‌های اختصاصی متصل به پروژه‌ها</span>
            <button
              onClick={fetchDomains}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingDomains ? 'animate-spin text-emerald-600' : ''}`} />
              <span>تازه سازی</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="px-5 py-3">دامنه</th>
                  <th className="px-5 py-3">پروژه متصل</th>
                  <th className="px-5 py-3">وضعیت تایید DNS</th>
                  <th className="px-5 py-3">وضعیت گواهینامه SSL</th>
                  <th className="px-5 py-3">تاریخ اتصال</th>
                  <th className="px-5 py-3 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {domains.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                      {loadingDomains ? 'در حال بارگذاری دامنه‌ها...' : 'هیچ دامنه اختصاصی متصلی یافت نشد.'}
                    </td>
                  </tr>
                ) : (
                  domains.map((d, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td className="px-5 py-3 font-mono text-[11px] font-bold text-slate-900" dir="ltr">
                        {d.domain}
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-medium text-slate-800">{d.projectName}</span>
                        <span className="text-[10px] text-slate-400 block font-mono" dir="ltr">{d.projectSlug}</span>
                      </td>
                      <td className="px-5 py-3">
                        {d.isVerified ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>تایید شده</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <AlertCircle className="w-3 h-3 text-amber-600" />
                            <span>در انتظار DNS</span>
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 font-mono text-[11px]">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700">
                          {d.sslStatus}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-500 text-[11px] font-mono" dir="ltr">
                        {d.createdAt ? new Date(d.createdAt).toLocaleDateString('fa-IR') : '—'}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <button
                          onClick={() => handleDeleteDomain(d)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          title="حذف اتصال دامنه"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Runtime Diagnostics */}
      {activeSubTab === 'runtime' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 text-xs">
            <span className="text-slate-600">اطلاعات پردازش میزبان و ماشین مجازی ASP.NET Core</span>
            <button
              onClick={fetchRuntime}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingRuntime ? 'animate-spin text-emerald-600' : ''}`} />
              <span>تازه سازی</span>
            </button>
          </div>

          {runtime && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-slate-700 font-bold text-xs">
                  <Server className="w-4 h-4 text-emerald-600" />
                  <span>سیستم‌عامل و معماری</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="text-slate-500">OS: <span className="font-mono text-slate-800" dir="ltr">{runtime.osDescription}</span></div>
                  <div className="text-slate-500">معماری OS: <span className="font-mono text-slate-800" dir="ltr">{runtime.osArchitecture}</span></div>
                  <div className="text-slate-500">معماری پردازش: <span className="font-mono text-slate-800" dir="ltr">{runtime.processArchitecture}</span></div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-slate-700 font-bold text-xs">
                  <Cpu className="w-4 h-4 text-emerald-600" />
                  <span>زمان اجرای دات‌نت (.NET CLR)</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="text-slate-500">نسخه فریم‌ورک: <span className="font-mono text-slate-800 font-bold" dir="ltr">{runtime.frameworkDescription}</span></div>
                  <div className="text-slate-500">شناسه پردازش (PID): <span className="font-mono text-slate-800" dir="ltr">{runtime.processId}</span></div>
                  <div className="text-slate-500">تعداد پردازنده‌ها: <span className="font-mono text-slate-800" dir="ltr">{runtime.processorCount} Cores</span></div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-slate-700 font-bold text-xs">
                  <Clock className="w-4 h-4 text-emerald-600" />
                  <span>حافظه و Garbage Collector</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="text-slate-500">حجم تخصیص یافته GC: <span className="font-mono text-emerald-600 font-bold" dir="ltr">{runtime.gcTotalMemoryPretty}</span></div>
                  <div className="text-slate-500">حالت Garbage Collector: <span className="font-mono text-slate-800" dir="ltr">{runtime.isServerGC ? 'Server GC' : 'Workstation GC'}</span></div>
                  <div className="text-slate-500">تعداد تردها: <span className="font-mono text-slate-800" dir="ltr">{runtime.threadCount} Threads</span></div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Script Modal */}
      {selectedScript && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">کد منبع تابع: {selectedScript.name}</h3>
                <span className="text-xs font-mono text-slate-500" dir="ltr">{selectedScript.triggerPath}</span>
              </div>
              <button
                onClick={() => setSelectedScript(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200"
              >
                ✕
              </button>
            </div>
            <div className="p-6 bg-slate-900">
              <pre className="font-mono text-xs text-emerald-400 max-h-96 overflow-y-auto leading-relaxed" dir="ltr">
                {selectedScript.script}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
