import React from 'react';
import { Project, CapabilityCode } from '../types';
import { TabId } from '../components/Navigation';
import {
  ExternalLink,
  Terminal,
  CheckCircle2,
  Database,
  Users,
  Activity,
  Code2,
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
}) => {
  const isEdgeFunctionsEnabled = activeCapabilities.has('COMPUTE_EDGE');

  return (
    <div className="space-y-6">
      {/* Project Status Hero Card */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              {project.status === 'ACTIVE' ? 'فعال و عملیاتی' : project.status}
            </span>
            <span className="text-xs text-slate-500">
              موقعیت سرور: {project.region}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {project.name}
          </h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            <span>نشانی اینترنتی پیش‌فرض:</span>
            <a
              href={`https://${project.slug}.localme.ir`}
              target="_blank"
              rel="noreferrer"
              className="text-emerald-700 hover:underline flex items-center gap-1 font-mono font-medium"
              dir="ltr"
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
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition ${
              isEdgeFunctionsEnabled
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>
              {isEdgeFunctionsEnabled ? 'غیرفعال‌سازی توابع لبه' : 'فعال‌سازی توابع لبه'}
            </span>
          </button>
        </div>
      </div>

      {/* Services Grid Navigation (4 Core Services) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => onNavigateTab('database')}
          className="cursor-pointer p-4 rounded-xl bg-white hover:border-emerald-500 border border-slate-200 transition shadow-xs group"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>پایگاه داده رابطه‌ای</span>
            <Database className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition" />
          </div>
          <div className="text-lg font-bold text-slate-900">
            مدیریت جداول
          </div>
          <div className="text-[11px] text-emerald-700 mt-2 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>PostgreSQL & Data API</span>
          </div>
        </div>

        <div
          onClick={() => onNavigateTab('auth')}
          className="cursor-pointer p-4 rounded-xl bg-white hover:border-emerald-500 border border-slate-200 transition shadow-xs group"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>احراز هویت و کاربران</span>
            <Users className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition" />
          </div>
          <div className="text-lg font-bold text-slate-900">
            کاربران پروژه
          </div>
          <div className="text-[11px] text-emerald-700 mt-2 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>رمز عبور و JWT</span>
          </div>
        </div>

        <div
          onClick={() => onNavigateTab('functions')}
          className="cursor-pointer p-4 rounded-xl bg-white hover:border-emerald-500 border border-slate-200 transition shadow-xs group"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>توابع لبه (Edge Functions)</span>
            <Code2 className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition" />
          </div>
          <div className="text-lg font-bold text-slate-900">
            محاسبات ابری
          </div>
          <div className="text-[11px] text-emerald-700 mt-2 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{isEdgeFunctionsEnabled ? 'موتور Jint فعال' : 'آماده فعال‌سازی'}</span>
          </div>
        </div>

        <div
          onClick={() => onNavigateTab('telemetry')}
          className="cursor-pointer p-4 rounded-xl bg-white hover:border-emerald-500 border border-slate-200 transition shadow-xs group"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>تله‌متری و پایش</span>
            <Activity className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition" />
          </div>
          <div className="text-lg font-bold text-slate-900">
            لاگ‌های زنده
          </div>
          <div className="text-[11px] text-emerald-700 mt-2 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>درخواست‌ها و تله‌متری</span>
          </div>
        </div>
      </div>

      {/* Project Description & Config Summary */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
        <h3 className="text-xs font-bold text-slate-900">مشخصات عمومی پروژه</h3>
        <p className="text-xs text-slate-600 leading-relaxed">
          {project.description || 'توضیحاتی برای این پروژه ثبت نشده است.'}
        </p>
        <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-4 text-xs text-slate-500">
          <div>
            <span>شناسه اختصاصی: </span>
            <span className="font-mono text-slate-800 font-bold" dir="ltr">{project.slug}</span>
          </div>
          <div>
            <span>تاریخ ایجاد: </span>
            <span className="font-mono text-slate-800" dir="ltr">{new Date(project.createdAt).toLocaleDateString('fa-IR')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
