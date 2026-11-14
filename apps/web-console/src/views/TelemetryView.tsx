import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Project, TelemetryLog } from '../types';
import {
  Activity,
  RefreshCw,
  Search,
  Database,
  Cpu,
  KeyRound,
  Zap,
  Filter
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
  const [selectedStatusGroup, setSelectedStatusGroup] = useState<string>('all');
  const [onlySlowQueries, setOnlySlowQueries] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Real API: Fetch Logs
  const fetchLogs = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      const res = await fetch(`/_baas/v1/${project.slug}/logs?limit=200`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setLogs(
            data.map((l: Record<string, unknown>) => ({
              id: String(l.id || l.Id || `log-${Math.random()}`),
              service: String(l.service || l.Service || 'gateway'),
              level: (l.level || l.Level || 'INFO') as TelemetryLog['level'],
              message: String(l.message || l.Message || ''),
              traceId: String(l.traceId || l.TraceId || '-'),
              statusCode: Number(l.statusCode || l.StatusCode || 200),
              latencyMs: Number(l.latencyMs || l.LatencyMs || 0),
              timestamp: String(l.timestamp || l.timestampUtc || l.TimestampUtc || l.createdAt || 'هم‌اکنون'),
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

  // Compute telemetry metrics
  const metrics = useMemo(() => {
    const total = logs.length;
    if (total === 0) {
      return { total: 0, errorCount: 0, errorRate: 0, avgLatency: 0, slowQueryCount: 0 };
    }
    const errors = logs.filter((l) => (l.statusCode && l.statusCode >= 400) || l.level === 'ERROR');
    const totalLatency = logs.reduce((acc, l) => acc + (l.latencyMs || 0), 0);
    const slowQueries = logs.filter((l) => (l.latencyMs && l.latencyMs >= 200) || (l.service === 'database' && l.latencyMs && l.latencyMs >= 200));

    return {
      total,
      errorCount: errors.length,
      errorRate: Math.round((errors.length / total) * 100),
      avgLatency: Math.round(totalLatency / total),
      slowQueryCount: slowQueries.length,
    };
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      const lat = l.latencyMs ?? 0;
      const code = l.statusCode ?? 200;

      if (onlySlowQueries && (lat < 200 || l.service !== 'database')) return false;
      if (selectedService !== 'all' && l.service !== selectedService) return false;
      if (selectedLevel !== 'all' && l.level !== selectedLevel) return false;

      if (selectedStatusGroup === '2xx' && (code < 200 || code >= 300)) return false;
      if (selectedStatusGroup === '4xx' && (code < 400 || code >= 500)) return false;
      if (selectedStatusGroup === '5xx' && code < 500) return false;

      if (searchQuery && !l.message.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [logs, onlySlowQueries, selectedService, selectedLevel, selectedStatusGroup, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              تله‌متری و نظارت زنده
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
            مشاهده رخدادهای لحظه‌ای، زمان تاخیر، ردگیری خطاهای سیستمی و پایش کوئری‌های کند ۴ سرویس ابری لوکال می.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition shadow-xs"
          title="بازخوانی لاگ‌ها"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin text-emerald-600' : ''}`} />
          <span>بازخوانی</span>
        </button>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="text-[11px] text-slate-500 font-medium mb-1">کل رویدادهای ثبت‌شده</div>
          <div className="text-xl font-bold text-slate-900 font-mono" dir="ltr">
            {metrics.total}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">در بافر تله‌متری شارد</div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="text-[11px] text-slate-500 font-medium mb-1">میانگین زمان تاخیر</div>
          <div className="text-xl font-bold text-slate-900 font-mono" dir="ltr">
            {metrics.avgLatency} <span className="text-xs font-normal text-slate-500">ms</span>
          </div>
          <div className="text-[10px] text-emerald-600 mt-1 font-medium">زیرساخت ابری پایدار</div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="text-[11px] text-slate-500 font-medium mb-1">نرخ خطای درخواست‌ها</div>
          <div className="text-xl font-bold text-slate-900 font-mono" dir="ltr">
            {metrics.errorRate}%
          </div>
          <div className="text-[10px] text-slate-400 mt-1">{metrics.errorCount} خطا ثبت‌شده</div>
        </div>

        <div 
          onClick={() => setOnlySlowQueries(!onlySlowQueries)}
          className={`p-4 rounded-xl border shadow-xs cursor-pointer transition ${
            onlySlowQueries 
              ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-300' 
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-slate-600 font-medium">کوئری‌های کند (&gt;200ms)</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${onlySlowQueries ? 'bg-amber-200 text-amber-900' : 'bg-slate-100 text-slate-600'}`}>
              فیلتر
            </span>
          </div>
          <div className="text-xl font-bold text-amber-700 font-mono" dir="ltr">
            {metrics.slowQueryCount}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            {onlySlowQueries ? 'در حال نمایش کوئری‌های کند' : 'برای فیلتر کوئری‌ها کلیک کنید'}
          </div>
        </div>
      </div>

      {/* Sub-View: Usage Report */}
      {activeSubView === 'usage' && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div className="text-xs text-slate-500 font-medium">پایگاه داده (BAAS_DB)</div>
            <div className="text-xl font-bold text-slate-900 font-mono" dir="ltr">شارد postgres-shard-1</div>
            <div className="text-[11px] text-emerald-700">اتصال داخلی نامحدود</div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
            <div className="text-xs text-slate-500 font-medium">احراز هویت (IDAAS)</div>
            <div className="text-xl font-bold text-slate-900 font-mono" dir="ltr">Argon2id + Ed25519</div>
            <div className="text-[11px] text-slate-500">نشست‌ها و توکن‌های امن</div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Cpu className="w-4 h-4" />
            </div>
            <div className="text-xs text-slate-500 font-medium">توابع لبه (COMPUTE_EDGE)</div>
            <div className="text-xl font-bold text-slate-900 font-mono" dir="ltr">Jint 4.1.0 JS Runtime</div>
            <div className="text-[11px] text-slate-500">خروجی ایگرس NAT حاکمیتی</div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
            <div className="text-xs text-slate-500 font-medium">پایش و رویدادها (OBSERVABILITY)</div>
            <div className="text-xl font-bold text-slate-900 font-mono" dir="ltr">لاگ پارتیشن‌بندی‌شده</div>
            <div className="text-[11px] text-teal-700">ثبت تاخیر زیر ۳۰۰ میلی‌ثانیه</div>
          </div>
        </div>
      )}

      {/* Sub-View: Live Logs (Default) */}
      {(activeSubView === 'live' || activeSubView !== 'usage') && (
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Filter className="w-3.5 h-3.5" />
                <span>فیلترها:</span>
              </div>

              {/* Service Filter (4 Sovereign Services Only) */}
              <select
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-emerald-600 shadow-xs"
              >
                <option value="all">همه سرویس‌ها</option>
                <option value="database">پایگاه داده (BAAS_DB)</option>
                <option value="auth">احراز هویت (IDAAS)</option>
                <option value="functions">توابع لبه (COMPUTE_EDGE)</option>
                <option value="gateway">دروازه API و تله‌متری</option>
              </select>

              {/* Level Filter */}
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-emerald-600 shadow-xs"
              >
                <option value="all">همه سطوح</option>
                <option value="INFO">INFO</option>
                <option value="WARN">WARN</option>
                <option value="ERROR">ERROR</option>
              </select>

              {/* Status Code Filter */}
              <select
                value={selectedStatusGroup}
                onChange={(e) => setSelectedStatusGroup(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-emerald-600 shadow-xs"
              >
                <option value="all">همه کدهای وضعیت</option>
                <option value="2xx">موفق (2xx)</option>
                <option value="4xx">خطای کلاینت (4xx)</option>
                <option value="5xx">خطای سرور (5xx)</option>
              </select>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجو در پیام‌های لاگ..."
                className="w-full pr-8 pl-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-emerald-600 shadow-xs"
              />
            </div>
          </div>

          {/* Active Filter Indicators */}
          {onlySlowQueries && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              <span className="font-semibold">فیلتر فعال:</span>
              <span>در حال نمایش کوئری‌های پایگاه‌داده با زمان تاخیر بیش از ۲۰۰ میلی‌ثانیه.</span>
              <button
                onClick={() => setOnlySlowQueries(false)}
                className="mr-auto font-medium text-amber-900 underline hover:no-underline"
              >
                نمایش تمام رویدادها
              </button>
            </div>
          )}

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
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                        <span>در حال دریافت رویدادها از شارد پایگاه‌داده...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-xs text-slate-400">
                      رویدادی مطابق با فیلترهای انتخاب‌شده یافت نشد.
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
                      <td className="py-2.5 px-3 text-center font-bold" dir="ltr">
                        <span className={
                          (l.statusCode ?? 200) >= 500 ? 'text-rose-600 font-bold' :
                          (l.statusCode ?? 200) >= 400 ? 'text-amber-600 font-medium' :
                          'text-slate-700'
                        }>
                          {l.statusCode ?? 200}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center" dir="ltr">
                        <span className={`font-mono ${(l.latencyMs ?? 0) >= 200 ? 'text-amber-700 font-bold' : 'text-slate-500'}`}>
                          {l.latencyMs ?? 0} ms
                        </span>
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
