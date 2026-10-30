import React, { useState, useEffect, useCallback } from 'react';
import { Project, TelemetryLog } from '../types';
import {
  Activity,
  RefreshCw,
  Search,
} from 'lucide-react';

interface TelemetryViewProps {
  project: Project;
  activeSubView?: string;
  onSubViewChange?: (subView: string) => void;
}

export const TelemetryView: React.FC<TelemetryViewProps> = ({
  project,
  activeSubView = 'live',
}) => {
  const [logs, setLogs] = useState<TelemetryLog[]>([]);
  const [selectedService, setSelectedService] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Real API: Fetch Logs
  const fetchLogs = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      const res = await fetch(`/_baas/v1/${project.slug}/logs`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setLogs(
            data.map((l: Record<string, unknown>) => ({
              id: String(l.id || `log-${Math.random()}`),
              service: String(l.service || 'gateway'),
              level: (l.level as TelemetryLog['level']) || 'INFO',
              message: String(l.message || ''),
              traceId: String(l.traceId || '-'),
              statusCode: Number(l.statusCode || 200),
              latencyMs: Number(l.latencyMs || 0),
              timestamp: String(l.timestamp || l.createdAt || 'هم‌اکنون'),
            }))
          );
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingLogs(false);
    }
  }, [project.slug]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filteredLogs = logs.filter((l) => {
    if (selectedService !== 'all' && l.service !== selectedService) return false;
    if (selectedLevel !== 'all' && l.level !== selectedLevel) return false;
    if (searchQuery && !l.message.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              لاگ‌ها و رویدادها
            </span>
            <span className="text-xs text-slate-400 font-mono" dir="ltr">
              {project.slug}
            </span>
          </div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-600" />
            {activeSubView === 'usage' ? 'گزارش مصارف و سهمیه‌های زیرساخت' : 'رویدادها و لاگ‌های زنده پروژه'}
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            مشاهده رخدادهای لحظه‌ای، ارزیابی زمان تاخیر، ردگیری خطاهای سیستمی و سلامت سرویس‌ها.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition shadow-xs"
          title="بازخوانی لاگ‌ها"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />
          <span>بازخوانی</span>
        </button>
      </div>

      {/* Sub-View: Usage Report */}
      {activeSubView === 'usage' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="text-xs text-slate-500 font-medium mb-1">کل فراخوانی‌های پایگاه داده</div>
            <div className="text-2xl font-bold text-slate-900 font-mono" dir="ltr">0</div>
            <div className="text-[11px] text-emerald-700 mt-2">سهمیه مجاز: نامحدود</div>
          </div>
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="text-xs text-slate-500 font-medium mb-1">حجم ذخیره‌سازی مصرف‌شده</div>
            <div className="text-2xl font-bold text-slate-900 font-mono" dir="ltr">0 MB</div>
            <div className="text-[11px] text-slate-400 mt-2">از سقف 1,024 MB</div>
          </div>
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="text-xs text-slate-500 font-medium mb-1">اجراهای توابع بدون سرور</div>
            <div className="text-2xl font-bold text-slate-900 font-mono" dir="ltr">0</div>
            <div className="text-[11px] text-slate-400 mt-2">میانگین تاخیر: 0 ms</div>
          </div>
        </div>
      )}

      {/* Sub-View: Live Logs (Default) */}
      {(activeSubView === 'live' || activeSubView !== 'usage') && (
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 shadow-xs"
              >
                <option value="all">همه سرویس‌ها</option>
                <option value="database">پایگاه داده</option>
                <option value="auth">احراز هویت</option>
                <option value="storage">ذخیره‌سازی</option>
                <option value="functions">توابع لبه</option>
                <option value="ipg">درگاه پرداخت</option>
              </select>

              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 shadow-xs"
              >
                <option value="all">همه سطوح</option>
                <option value="INFO">INFO</option>
                <option value="WARN">WARN</option>
                <option value="ERROR">ERROR</option>
              </select>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجو در پیام‌های لاگ..."
                className="w-full pr-8 pl-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 shadow-xs"
              />
            </div>
          </div>

          {/* Logs Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-right text-xs" dir="rtl">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                  <th className="py-2.5 px-3">زمان</th>
                  <th className="py-2.5 px-3 text-center">سطح</th>
                  <th className="py-2.5 px-3 text-center">سرویس</th>
                  <th className="py-2.5 px-3">پیام رویداد</th>
                  <th className="py-2.5 px-3 text-center">کد وضعیت</th>
                  <th className="py-2.5 px-3 text-center">تاخیر</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoadingLogs ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-xs text-slate-500">
                      در حال دریافت رویدادها...
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-xs text-slate-400">
                      رویدادی برای نمایش در این بازه زمانی یافت نشد.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50 transition font-mono text-[11px]">
                      <td className="py-2.5 px-3 text-slate-500" dir="ltr">
                        {l.timestamp}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            l.level === 'ERROR'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : l.level === 'WARN'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {l.level}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-600" dir="ltr">
                        {l.service}
                      </td>
                      <td className="py-2.5 px-3 text-slate-800 font-sans text-xs">
                        {l.message}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-700" dir="ltr">
                        {l.statusCode}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-500" dir="ltr">
                        {l.latencyMs} ms
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
