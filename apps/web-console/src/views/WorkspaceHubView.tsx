import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Database,
  Server,
  Activity,
  ArrowUpRight,
  Plus,
  Search,
  Shield,
  CheckCircle2,
  FolderGit2,
} from 'lucide-react';
import { Project } from '../types';

interface WorkspaceHubViewProps {
  projects: Project[];
  onOpenCreateProjectModal: () => void;
  onSelectProject: (project: Project) => void;
}

export const WorkspaceHubView: React.FC<WorkspaceHubViewProps> = ({
  projects,
  onOpenCreateProjectModal,
  onSelectProject,
}) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRegion, setFilterRegion] = useState<string>('ALL');

  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRegion = filterRegion === 'ALL' || p.region === filterRegion;
    return matchesSearch && matchesRegion;
  });

  const handleCardClick = (project: Project) => {
    onSelectProject(project);
    navigate(`/panel/${project.slug}/database/grid`);
  };

  const activeProjectsCount = projects.filter((p) => p.status === 'ACTIVE').length;

  return (
    <div className="min-h-full bg-white text-slate-800 p-6 md:p-10 space-y-8 max-w-7xl mx-auto">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              مدیریت فضای ابری
            </span>
            <span className="text-slate-400 text-xs">میزکار توسعه‌دهندگان</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            پروژه‌ها و سرویس‌های ابری
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            مدیریت پایگاه‌های داده رابطه‌ای، کاربران و احراز هویت، توابع ابری و درگاه‌های پرداخت در یک محیط امن و یکپارچه.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenCreateProjectModal}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-4 py-2 transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>ایجاد پروژه جدید</span>
          </button>
        </div>
      </div>

      {/* Overview Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>تعداد پروژه‌ها</span>
            <FolderGit2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900" dir="ltr">
            {projects.length}
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
            <span>پروژه‌های فعال:</span>
            <span className="font-semibold text-emerald-700" dir="ltr">{activeProjectsCount}</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>وضعیت سرویس پایگاه داده</span>
            <Database className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700">
            فعال و آماده
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>اتصال مستقیم پایگاه داده</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>سرویس‌های احراز هویت</span>
            <Shield className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            فعال
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>ورود پیامکی و کاربران اختصاصی</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>پایداری زیرساخت</span>
            <Activity className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700" dir="ltr">
            ۱۰۰٪
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>تمام سرویس‌ها در وضعیت عادی</span>
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجوی نام یا شناسه پروژه..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pr-9 pl-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <select
            value={filterRegion}
            onChange={(e) => setFilterRegion(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">همه موقعیت‌ها</option>
            <option value="ir-teh-1 (آسیاتک برج میلاد)">آسیاتک برج میلاد</option>
            <option value="ir-teh-2 (زیرساخت امام)">زیرساخت امام</option>
          </select>
        </div>
      </div>

      {/* Projects Grid or Clean Empty State */}
      {filteredProjects.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-400">
            <FolderGit2 className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">
            {projects.length === 0 ? 'هنوز پروژه‌ای ثبت نشده است' : 'پروژه‌ای با مشخصات جستجو شده یافت نشد'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-5 leading-relaxed">
            {projects.length === 0
              ? 'برای شروع استفاده از پایگاه داده، احراز هویت و توابع ابری، اولین پروژه خود را بسازید.'
              : 'عبارت جستجو یا فیلترهای اعمال شده را تغییر دهید.'}
          </p>
          {projects.length === 0 && (
            <button
              onClick={onOpenCreateProjectModal}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-4 py-2 transition"
            >
              <Plus className="w-4 h-4" />
              <span>ایجاد اولین پروژه</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((p) => {
            const toman = Math.floor((p.walletBalanceIrr || 0) / 10);
            return (
              <div
                key={p.id}
                onClick={() => handleCardClick(p)}
                className="group p-5 rounded-2xl bg-white border border-slate-200 hover:border-emerald-500 hover:shadow-md transition cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-emerald-500" />
                      <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        فعال
                      </span>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition" />
                  </div>

                  <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-700 transition">
                    {p.name}
                  </h3>

                  <div className="text-xs text-slate-400 font-mono mt-0.5" dir="ltr">
                    {p.slug}
                  </div>

                  <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                    {p.description || 'بدون توضیحات ثبت‌شده'}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate max-w-[130px]">{p.region}</span>
                  </div>

                  <div className="font-semibold text-slate-700 flex items-center gap-1">
                    <span dir="ltr">{toman.toLocaleString('fa-IR')}</span>
                    <span className="text-[10px] text-slate-400 font-normal">تومان</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
