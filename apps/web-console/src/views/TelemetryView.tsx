import React, { useState } from 'react';
import { Project, TelemetryLog } from '../types';
import {
  Activity,
  RefreshCw,
  Search,
} from 'lucide-react';

interface TelemetryViewProps {
  project: Project;
}

const INITIAL_LOGS: TelemetryLog[] = [];

export const TelemetryView: React.FC<TelemetryViewProps> = ({ project }) => {
  const [logs, setLogs] = useState<TelemetryLog[]>(INITIAL_LOGS);
  const [selectedService, setSelectedService] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredLogs = logs.filter((l) => {
    if (selectedService !== 'all' && l.service !== selectedService) return false;
    if (selectedLevel !== 'all' && l.level !== selectedLevel) return false;
    if (searchQuery && !l.message.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const handleRefresh = () => {
    const newLog: TelemetryLog = {
      id: `log-${Date.now()}`,
      service: 'functions',
      level: 'INFO',
      message: `استعلام تلمتری برای پروژه «${project.name}» ثبت گردید.`,
      traceId: `tr_${Math.random().toString(36).slice(2, 10)}`,
      statusCode: 200,
      latencyMs: Math.floor(Math.random() * 8) + 2,
      timestamp: 'هم‌اکنون',
    };
    setLogs((prev) => [newLog, ...prev]);
  };

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
            رویدادها و لاگ‌های زنده پروژه
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            مشاهده لاگ‌های زنده، خطاهای سیستمی، زمان پاسخ‌دهی و ردگیری درخواست‌های ارسالی.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium transition"
        >
          <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
          <span>تازه‌سازی رویدادها</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            placeholder="جستجو در پیام‌های لاگ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pr-9 pl-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">همه سرویس‌ها</option>
            <option value="database">پایگاه داده</option>
            <option value="auth">احراز هویت</option>
            <option value="functions">توابع ابری</option>
            <option value="storage">ذخیره‌سازی</option>
            <option value="ipg">درگاه پرداخت</option>
          </select>

          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">همه سطوح</option>
            <option value="INFO">اطلاعات (INFO)</option>
            <option value="WARN">هشدار (WARN)</option>
            <option value="ERROR">خطا (ERROR)</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <span className="text-xs font-bold text-slate-900">
            فهرست رویدادهای زنده ({filteredLogs.length})
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-right text-xs" dir="rtl">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                <th className="py-2.5 px-3">زمان</th>
                <th className="py-2.5 px-3 text-center">سطح</th>
                <th className="py-2.5 px-3 text-center">سرویس</th>
                <th className="py-2.5 px-3 text-center">کد رهگیری</th>
                <th className="py-2.5 px-3 text-center">وضعیت</th>
                <th className="py-2.5 px-3 text-center">تاخیر</th>
                <th className="py-2.5 px-3">پیام</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-xs text-slate-400">
                    هیچ رویدادی برای نمایش یافت نشد.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-3 text-[11px] text-slate-500 whitespace-nowrap">
                      {log.timestamp}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                          log.level === 'ERROR'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : log.level === 'WARN'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                        dir="ltr"
                      >
                        {log.level}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-600" dir="ltr">
                      {log.service}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-400" dir="ltr">
                      {log.traceId}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700" dir="ltr">
                      {log.statusCode}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-[11px] text-emerald-700" dir="ltr">
                      {log.latencyMs} ms
                    </td>
                    <td className="py-2.5 px-3 text-slate-800 max-w-md truncate">
                      {log.message}
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
