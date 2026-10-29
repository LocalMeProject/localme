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
      message: `استعلام تلمتری برای پروژه «${project.name}» (${project.slug}) دریافت گردید.`,
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
      <div className="p-5 rounded-2xl bg-[#171717] border border-[#242424] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#3ECF8E]" />
            مرکز تله‌متری و لاگ‌های زنده سرور (Live Telemetry & Traces)
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            خط لوله تله‌متری غیرمسدودکننده (Non-Blocking System.Threading.Channels) با فلاش دوره‌ای به جدول صورت‌حساب.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          className="flex items-center space-x-1.5 px-4 py-1.5 rounded-full bg-[#242424] hover:bg-[#2e2e2e] text-[#ededed] border border-[#2e2e2e] text-xs font-medium transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[#3ECF8E]" />
          <span>تازه‌سازی لاگ‌ها</span>
        </button>
      </div>

      {/* Usage Ledger Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#171717] border border-[#242424] hover:border-[#2e2e2e] transition shadow-sm">
          <div className="text-[11px] text-zinc-400">کوئری‌های پایگاه داده</div>
          <div className="text-xl font-bold font-mono text-white mt-1">۲۴,۱۸۰</div>
          <div className="text-[10px] text-zinc-500 font-mono mt-0.5">نرخ: ۲ ریال به ازای هر کوئری</div>
        </div>

        <div className="p-4 rounded-xl bg-[#171717] border border-[#242424] hover:border-[#2e2e2e] transition shadow-sm">
          <div className="text-[11px] text-zinc-400">پیامک‌های OTP خدماتی</div>
          <div className="text-xl font-bold font-mono text-white mt-1">۱,۴۲۰</div>
          <div className="text-[10px] text-zinc-500 font-mono mt-0.5">نرخ: ۱,۵۰۰ ریال به ازای پیامک</div>
        </div>

        <div className="p-4 rounded-xl bg-[#171717] border border-[#242424] hover:border-[#2e2e2e] transition shadow-sm">
          <div className="text-[11px] text-zinc-400">پردازش توابع لبه Jint</div>
          <div className="text-xl font-bold font-mono text-white mt-1">۵۳,۶۴۰ ms</div>
          <div className="text-[10px] text-zinc-500 font-mono mt-0.5">نرخ: ۱ ریال به ازای هر میلی‌ثانیه</div>
        </div>

        <div className="p-4 rounded-xl bg-[#171717] border border-[#242424] hover:border-[#2e2e2e] transition shadow-sm">
          <div className="text-[11px] text-zinc-400">فضای ذخیره‌سازی ابری</div>
          <div className="text-xl font-bold font-mono text-white mt-1">۵۵.۰ MB</div>
          <div className="text-[10px] text-zinc-500 font-mono mt-0.5">نرخ: ۵۰ ریال به ازای هر مگابایت</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-xl bg-[#171717] border border-[#242424] flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute right-3 top-2.5" />
            <input
              type="text"
              placeholder="جستجو در پیام لاگ‌ها..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-8 pl-3 py-1.5 rounded-full bg-[#0f0f0f] border border-[#242424] text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-[#3ECF8E]"
            />
          </div>

          <select
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
            className="px-3 py-1.5 rounded-full bg-[#0f0f0f] border border-[#242424] text-xs text-zinc-300 focus:outline-none focus:border-[#3ECF8E]"
          >
            <option value="all">همه سرویس‌ها</option>
            <option value="database">پایگاه داده</option>
            <option value="functions">توابع لبه</option>
            <option value="auth">احراز هویت</option>
            <option value="ipg">درگاه پرداخت</option>
            <option value="hosting">هاستینگ</option>
          </select>

          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="px-3 py-1.5 rounded-full bg-[#0f0f0f] border border-[#242424] text-xs text-zinc-300 focus:outline-none focus:border-[#3ECF8E]"
          >
            <option value="all">همه سطوح</option>
            <option value="INFO">INFO</option>
            <option value="WARN">WARN</option>
            <option value="ERROR">ERROR</option>
          </select>
        </div>

        <div className="text-xs text-zinc-400 font-mono">
          نمایش {filteredLogs.length} از {logs.length} رویداد
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-xl border border-[#242424] bg-[#171717] overflow-hidden" dir="ltr">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-[#242424] bg-[#1a1a1a] text-zinc-400">
                <th className="py-2.5 px-3">زمان</th>
                <th className="py-2.5 px-3">سرویس</th>
                <th className="py-2.5 px-3">سطح</th>
                <th className="py-2.5 px-3">وضعیت / کد</th>
                <th className="py-2.5 px-3">تاخیر</th>
                <th className="py-2.5 px-3">پیام رویداد</th>
                <th className="py-2.5 px-3">ردیابی (TraceId)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#242424]">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-zinc-500">
                    هیچ لاگی ثبت نشده است
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#1f1f1f] transition-colors">
                    <td className="py-2.5 px-3 text-zinc-500 whitespace-nowrap">{log.timestamp}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#0f0f0f] border border-[#242424] text-zinc-300 font-bold uppercase">
                        {log.service}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                          log.level === 'INFO'
                            ? 'text-[#3ECF8E] bg-[#3ECF8E]/10 border-[#3ECF8E]/20'
                            : log.level === 'WARN'
                            ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                            : 'text-red-400 bg-red-500/10 border-red-500/20'
                        }`}
                      >
                        {log.level}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-zinc-300">{log.statusCode || '-'}</td>
                    <td className="py-2.5 px-3 text-zinc-400">{log.latencyMs ? `${log.latencyMs} ms` : '-'}</td>
                    <td className="py-2.5 px-3 text-zinc-200">{log.message}</td>
                    <td className="py-2.5 px-3 text-zinc-500">{log.traceId}</td>
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
