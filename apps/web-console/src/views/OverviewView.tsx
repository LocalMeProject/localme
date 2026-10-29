import React from 'react';
import { Project, CapabilityCode } from '../types';
import { TabId } from '../components/Navigation';
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
  onNavigateTab: (tab: TabId) => void;
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
      <div className="p-6 rounded-2xl bg-[#171717] border border-[#242424] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase bg-[#3ECF8E]/10 text-[#3ECF8E] border border-[#3ECF8E]/30">
              {project.status}
            </span>
            <span className="text-xs text-zinc-400 font-mono">
              منطقه: {project.region}
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            {project.name}
          </h2>
          <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1.5">
            <span>دامنه پیش‌فرض:</span>
            <a
              href={`https://${project.slug}.localme.ir`}
              target="_blank"
              rel="noreferrer"
              className="text-[#3ECF8E] hover:underline flex items-center gap-1 font-mono"
            >
              https://{project.slug}.localme.ir
              <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onToggleCapability('COMPUTE_EDGE')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition ${
              isEdgeFunctionsEnabled
                ? 'bg-[#1f1f1f] hover:bg-[#282828] text-zinc-200 border border-[#2e2e2e]'
                : 'bg-[#3ECF8E] hover:bg-[#34b27b] text-black shadow-sm'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>
              {isEdgeFunctionsEnabled ? 'غیرفعال‌سازی توابع لبه' : 'فعال‌سازی توابع لبه (Edge Functions)'}
            </span>
          </button>

          <button
            onClick={onDeployBuild}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs transition shadow-sm"
          >
            <Zap className="w-4 h-4 text-emerald-600" />
            <span>استقرار نسخه جدید</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div
          onClick={() => onNavigateTab('database')}
          className="cursor-pointer p-4 rounded-xl bg-[#171717] hover:border-[#3ECF8E]/40 border border-[#242424] transition shadow-sm"
        >
          <div className="text-[11px] font-medium text-zinc-400 mb-1">پرس‌وجوهای پایگاه داده</div>
          <div className="text-2xl font-bold font-mono text-white">۲۴,۱۸۰</div>
          <div className="text-[10px] text-[#3ECF8E] mt-1 flex items-center gap-1 font-mono">
            <CheckCircle2 className="w-3 h-3" />
            <span>PostgreSQL 18 Npgsql Pool</span>
          </div>
        </div>

        <div
          onClick={() => onNavigateTab('auth')}
          className="cursor-pointer p-4 rounded-xl bg-[#171717] hover:border-[#3ECF8E]/40 border border-[#242424] transition shadow-sm"
        >
          <div className="text-[11px] font-medium text-zinc-400 mb-1">پیامک‌های OTP کاوه‌نگار</div>
          <div className="text-2xl font-bold font-mono text-white">۱,۴۲۰</div>
          <div className="text-[10px] text-zinc-500 mt-1 font-mono">خط خدماتی ۳۰۰۰۷۷۷</div>
        </div>

        <div
          onClick={() => onNavigateTab('functions')}
          className="cursor-pointer p-4 rounded-xl bg-[#171717] hover:border-[#3ECF8E]/40 border border-[#242424] transition shadow-sm"
        >
          <div className="text-[11px] font-medium text-zinc-400 mb-1">فراخوانی توابع لبه Jint</div>
          <div className="text-2xl font-bold font-mono text-white">
            {isEdgeFunctionsEnabled ? '۸,۹۴۰' : 'سرویس غیرفعال'}
          </div>
          <div className="text-[10px] text-[#3ECF8E] mt-1 font-mono">
            {isEdgeFunctionsEnabled ? 'میانگین تاخیر: ۶ ms' : 'کلیک برای فعال‌سازی'}
          </div>
        </div>

        <div
          onClick={() => onNavigateTab('telemetry')}
          className="cursor-pointer p-4 rounded-xl bg-[#171717] hover:border-[#3ECF8E]/40 border border-[#242424] transition shadow-sm"
        >
          <div className="text-[11px] font-medium text-zinc-400 mb-1">هزینه دوره جاری</div>
          <div className="text-2xl font-bold font-mono text-[#3ECF8E]">۸۵,۰۰۰ تومان</div>
          <div className="text-[10px] text-zinc-500 mt-1 font-mono">کسر از کیف پول ریالی</div>
        </div>
      </div>

      {/* DAG Matrix Engine Section */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#3ECF8E]" />
              ماتریس وابستگی‌های DAG پلتفرم LocalMe
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              با فعال یا غیرفعال‌سازی هر قابلیت، موتور DAG به صورت خودکار ارجاعات را به المان‌های زیرساخت تخصیص می‌دهد.
            </p>
          </div>
          <div className="text-xs font-mono text-zinc-300 bg-[#171717] px-3 py-1.5 rounded-full border border-[#242424]">
            سرویس‌های فعال: <span className="text-[#3ECF8E] font-bold">{activeCapabilities.size}</span> از {capabilities.length}
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
                      ? 'bg-[#171717] border-[#3ECF8E] shadow-sm shadow-[#3ECF8E]/10'
                      : 'bg-[#171717] border-[#242424] hover:border-[#3ECF8E]/50'
                    : 'bg-[#0f0f0f] border-[#1f1f1f] opacity-50 hover:opacity-80'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[#3ECF8E]">{cap.code}</span>
                    {isEdgeFunc && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#3ECF8E]/10 text-[#3ECF8E] border border-[#3ECF8E]/30 font-bold font-mono">
                        محوری
                      </span>
                    )}
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center transition ${
                      cap.enabled ? 'border-[#3ECF8E] bg-[#3ECF8E]' : 'border-[#2e2e2e]'
                    }`}
                  >
                    {cap.enabled && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                  </div>
                </div>

                <h4 className="font-semibold text-xs text-white">{cap.name}</h4>
                <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed line-clamp-2">{cap.description}</p>

                {cap.dependentCapabilities.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-[#242424] flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono">
                    <span>وابسته به:</span>
                    {cap.dependentCapabilities.map((dep) => (
                      <span key={dep} className="px-1.5 py-0.5 rounded bg-[#1f1f1f] text-zinc-300">
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
      <section className="p-5 rounded-2xl bg-[#171717] border border-[#242424] space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#3ECF8E] animate-pulse" />
            پریمیتیوهای فعال زیرساخت روی پراسس .NET 10 ({activePrimitives.length})
          </h4>
          <span className="text-[11px] text-zinc-500 font-mono">
            Pure Managed Memory Isolation
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {activePrimitives.map((p) => (
            <span
              key={p}
              className="px-2.5 py-1 rounded-full text-[11px] font-mono bg-[#0f0f0f] text-zinc-300 border border-[#242424] hover:border-[#3ECF8E]/40 transition"
            >
              {p}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
};
