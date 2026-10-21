import React from 'react';
import { Project, CapabilityCode } from '../types';
import { buildCapabilitiesList, resolvePrimitives } from '../dagEngine';
import {
  ExternalLink,
  Zap,
  Terminal,
  CheckCircle2,
  Layers,
} from 'lucide-react';

interface OverviewViewProps {
  project: Project;
  activeCapabilities: Set<CapabilityCode>;
  onToggleCapability: (code: CapabilityCode) => void;
  onNavigateTab: (tab: string) => void;
  onDeployBuild: () => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  project,
  activeCapabilities,
  onToggleCapability,
  onNavigateTab,
  onDeployBuild,
}) => {
  const capabilities = buildCapabilitiesList(activeCapabilities);
  const activePrimitives = resolvePrimitives(Array.from(activeCapabilities));
  const isEdgeFunctionsEnabled = activeCapabilities.has('COMPUTE_EDGE');

  return (
    <div className="space-y-8">
      {/* Project Status Hero Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-b from-zinc-900/60 to-zinc-900/30 border border-zinc-800/80 backdrop-blur-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {project.status}
            </span>
            <span className="text-xs text-zinc-400 font-mono">
              منطقه: {project.region}
            </span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-zinc-100 flex items-center gap-2">
            {project.name}
          </h2>
          <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1.5">
            <span>دامنه پیش‌فرض ایرانی:</span>
            <a
              href={`https://${project.slug}.localme.ir`}
              target="_blank"
              rel="noreferrer"
              className="text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1 font-mono"
            >
              https://{project.slug}.localme.ir
              <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2.5">
          {/* Prominent Enable Edge Functions Service Button */}
          <button
            onClick={() => onToggleCapability('COMPUTE_EDGE')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition shadow-sm ${
              isEdgeFunctionsEnabled
                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
                : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black shadow-amber-500/20'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>
              {isEdgeFunctionsEnabled ? 'غیرفعال‌سازی توابع لبه' : 'فعال‌سازی سرویس توابع لبه (Edge Functions)'}
            </span>
          </button>

          <button
            onClick={onDeployBuild}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs transition shadow-sm"
          >
            <Zap className="w-4 h-4 text-amber-600" />
            <span>استقرار نسخه جدید</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div
          onClick={() => onNavigateTab('database')}
          className="cursor-pointer p-4 rounded-xl bg-zinc-900/40 hover:bg-zinc-900/70 border border-zinc-800/80 transition"
        >
          <div className="text-[11px] font-medium text-zinc-400 mb-1">کوئری‌های پایگاه داده</div>
          <div className="text-2xl font-bold font-mono text-zinc-100">۲۴,۱۸۰</div>
          <div className="text-[10px] text-emerald-400 mt-1 flex items-center gap-0.5">
            <CheckCircle2 className="w-3 h-3" />
            <span>PostgreSQL 18.1 Npgsql Pool</span>
          </div>
        </div>

        <div
          onClick={() => onNavigateTab('auth')}
          className="cursor-pointer p-4 rounded-xl bg-zinc-900/40 hover:bg-zinc-900/70 border border-zinc-800/80 transition"
        >
          <div className="text-[11px] font-medium text-zinc-400 mb-1">پیامک‌های OTP کاوه‌نگار</div>
          <div className="text-2xl font-bold font-mono text-zinc-100">۱,۴۲۰</div>
          <div className="text-[10px] text-zinc-400 mt-1">خط خدماتی ۳۰۰۰۷۷۷</div>
        </div>

        <div
          onClick={() => onNavigateTab('functions')}
          className="cursor-pointer p-4 rounded-xl bg-zinc-900/40 hover:bg-zinc-900/70 border border-zinc-800/80 transition"
        >
          <div className="text-[11px] font-medium text-zinc-400 mb-1">فراخوانی توابع لبه Jint</div>
          <div className="text-2xl font-bold font-mono text-zinc-100">
            {isEdgeFunctionsEnabled ? '۸,۹۴۰' : 'سرویس غیرفعال'}
          </div>
          <div className="text-[10px] text-amber-400 mt-1 font-mono">
            {isEdgeFunctionsEnabled ? 'میانگین تاخیر: ۶ میلی‌ثانیه' : 'کلیک برای فعال‌سازی'}
          </div>
        </div>

        <div
          onClick={() => onNavigateTab('telemetry')}
          className="cursor-pointer p-4 rounded-xl bg-zinc-900/40 hover:bg-zinc-900/70 border border-zinc-800/80 transition"
        >
          <div className="text-[11px] font-medium text-zinc-400 mb-1">هزینه دوره جاری</div>
          <div className="text-2xl font-bold font-mono text-amber-400">۸۵,۰۰۰ تومان</div>
          <div className="text-[10px] text-zinc-400 mt-1">کسر از کیف پول ریالی</div>
        </div>
      </div>

      {/* DAG Matrix Engine Section */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold tracking-tight text-zinc-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              ماتریس وابستگی‌های DAG پلتفرم LocalMe
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              با فعال یا غیرفعال‌سازی هر قابلیت، موتور DAG به صورت خودکار ارجاعات را به المان‌های زیرساخت تخصیص می‌دهد.
            </p>
          </div>
          <div className="text-xs font-mono text-zinc-400 bg-zinc-900/80 px-3 py-1.5 rounded-lg border border-zinc-800">
            سرویس‌های فعال: <span className="text-amber-400 font-bold">{activeCapabilities.size}</span> از {capabilities.length}
          </div>
        </div>

        {/* 17 Capabilities Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {capabilities.map((cap) => {
            const isEdgeFunc = cap.code === 'COMPUTE_EDGE';
            return (
              <div
                key={cap.code}
                onClick={() => onToggleCapability(cap.code)}
                className={`cursor-pointer p-4 rounded-xl border transition-all duration-200 select-none ${
                  cap.enabled
                    ? isEdgeFunc
                      ? 'bg-amber-950/20 border-amber-500/60 shadow-lg shadow-amber-500/5 ring-1 ring-amber-500/30'
                      : 'bg-zinc-900/90 border-zinc-700 hover:border-zinc-600 shadow-sm'
                    : 'bg-zinc-900/20 border-zinc-800/60 opacity-60 hover:opacity-90'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-mono font-bold text-amber-400">{cap.code}</span>
                    {isEdgeFunc && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                        محوری
                      </span>
                    )}
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center transition ${
                      cap.enabled ? 'border-amber-500 bg-amber-500' : 'border-zinc-700'
                    }`}
                  >
                    {cap.enabled && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                  </div>
                </div>

                <h4 className="font-semibold text-xs text-zinc-100">{cap.name}</h4>
                <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed line-clamp-2">{cap.description}</p>

                {cap.dependentCapabilities.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-zinc-800/60 flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono">
                    <span>وابسته به:</span>
                    {cap.dependentCapabilities.map((dep) => (
                      <span key={dep} className="px-1 rounded bg-zinc-800/80 text-zinc-300">
                        {dep}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Active Primitives Display */}
      <section className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-zinc-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            پریمیتیوهای فعال زیرساخت روی پراسس .NET 10 ({activePrimitives.length})
          </h4>
          <span className="text-[11px] text-zinc-400 font-mono">
            Pure Managed Memory Isolation
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {activePrimitives.map((p) => (
            <span
              key={p}
              className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-zinc-800/80 text-zinc-200 border border-zinc-700/60 hover:border-zinc-600 transition"
            >
              {p}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
};
