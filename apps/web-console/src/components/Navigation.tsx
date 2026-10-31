import React, { useState, useRef, useEffect } from 'react';
import {
  LayoutGrid,
  Database,
  Users,
  Terminal,
  HardDrive,
  CreditCard,
  Globe,
  Award,
  Activity,
  Settings,
  Table as TableIcon,
  Code2,
  Columns,
  FolderGit2,
  Shield,
  Layers,
  Key,
  Network,
  UserCheck,
  ChevronRight,
  Archive,
  History,
  FileSpreadsheet,
  Link2,
} from 'lucide-react';
import { Project } from '../types';

export type TabId =
  | 'overview'
  | 'database'
  | 'auth'
  | 'functions'
  | 'storage'
  | 'ipg'
  | 'hosting'
  | 'compliance'
  | 'telemetry'
  | 'settings';

export interface SubViewItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface NavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId, subView?: string) => void;
  activeSubView?: string;
  onSubViewChange?: (subView: string) => void;
  edgeFunctionsEnabled: boolean;
  project?: Project;
  onNavigateHome: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  activeSubView,
  onSubViewChange,
  edgeFunctionsEnabled,
  project,
  onNavigateHome,
}) => {
  const [isSubNavCollapsed, setIsSubNavCollapsed] = useState(false);
  const [isRailExpanded, setIsRailExpanded] = useState(false);

  const enterTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    enterTimeoutRef.current = setTimeout(() => {
      setIsRailExpanded(true);
    }, 100);
  };

  const handleMouseLeave = () => {
    if (enterTimeoutRef.current) {
      clearTimeout(enterTimeoutRef.current);
      enterTimeoutRef.current = null;
    }
    leaveTimeoutRef.current = setTimeout(() => {
      setIsRailExpanded(false);
    }, 100);
  };

  useEffect(() => {
    return () => {
      if (enterTimeoutRef.current) clearTimeout(enterTimeoutRef.current);
      if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);
    };
  }, []);

  // Primary level-1 modules
  const primaryModules: {
    id: TabId;
    label: string;
    icon: React.ReactNode;
    badge?: string;
  }[] = [
    { id: 'overview', label: 'داشبورد', icon: <LayoutGrid className="w-5 h-5" /> },
    { id: 'database', label: 'پایگاه داده', icon: <Database className="w-5 h-5" /> },
    { id: 'auth', label: 'کاربران', icon: <Users className="w-5 h-5" /> },
    { id: 'storage', label: 'ذخیره‌سازی', icon: <HardDrive className="w-5 h-5" /> },
    {
      id: 'functions',
      label: 'توابع ابری',
      icon: <Terminal className="w-5 h-5" />,
      badge: edgeFunctionsEnabled ? 'فعال' : undefined,
    },
    { id: 'ipg', label: 'درگاه پرداخت', icon: <CreditCard className="w-5 h-5" /> },
    { id: 'hosting', label: 'میزبانی وب', icon: <Globe className="w-5 h-5" /> },
    { id: 'compliance', label: 'اینماد و نمادها', icon: <Award className="w-5 h-5" /> },
    { id: 'telemetry', label: 'لاگ‌ها', icon: <Activity className="w-5 h-5" /> },
    { id: 'settings', label: 'تنظیمات', icon: <Settings className="w-5 h-5" /> },
  ];

  // Secondary level-2 sub-views mapped by module
  const subViewGroups: Record<TabId, { title: string; items: SubViewItem[] }> = {
    overview: {
      title: 'نمای کلی پروژه',
      items: [
        { id: 'overview', label: 'داشبورد تجمیعی', icon: <LayoutGrid className="w-4 h-4" /> },
      ],
    },
    database: {
      title: 'پایگاه داده رابطه‌ای',
      items: [
        { id: 'grid', label: 'جداول و داده‌ها', icon: <TableIcon className="w-4 h-4" /> },
        { id: 'sql', label: 'ویرایشگر کوئری SQL', icon: <Code2 className="w-4 h-4" /> },
        { id: 'schema', label: 'طراحی ساختار جدول', icon: <Columns className="w-4 h-4" /> },
        { id: 'diagram', label: 'نمودار ارتباطی (ER)', icon: <Network className="w-4 h-4" /> },
        { id: 'backups', label: 'پشتیبان‌گیری و اسنپ‌شات', icon: <Archive className="w-4 h-4" /> },
      ],
    },
    auth: {
      title: 'احراز هویت و کاربران',
      items: [
        { id: 'users', label: 'مدیریت کاربران', icon: <Users className="w-4 h-4" /> },
        { id: 'sms', label: 'سرویس پیامک و ورود', icon: <Shield className="w-4 h-4" /> },
        { id: 'policies', label: 'سیاست‌های امنیتی', icon: <UserCheck className="w-4 h-4" /> },
      ],
    },
    storage: {
      title: 'ذخیره‌سازی ابری فایل',
      items: [
        { id: 'buckets', label: 'باکت‌های فایل', icon: <HardDrive className="w-4 h-4" /> },
        { id: 'explorer', label: 'مرورگر اسناد', icon: <FileSpreadsheet className="w-4 h-4" /> },
        { id: 'policies', label: 'سهمیه‌ها و محدودیت', icon: <Shield className="w-4 h-4" /> },
      ],
    },
    functions: {
      title: 'توابع بدون سرور',
      items: [
        { id: 'list', label: 'فهرست توابع لبه', icon: <Terminal className="w-4 h-4" /> },
        { id: 'deploy', label: 'ثبت و استقرار جدید', icon: <Layers className="w-4 h-4" /> },
        { id: 'env', label: 'متغیرهای محیطی', icon: <Key className="w-4 h-4" /> },
      ],
    },
    ipg: {
      title: 'درگاه‌های پرداخت',
      items: [
        { id: 'transactions', label: 'گزارش تراکنش‌ها', icon: <History className="w-4 h-4" /> },
        { id: 'gateways', label: 'پیکربندی درگاه‌ها', icon: <CreditCard className="w-4 h-4" /> },
        { id: 'ledger', label: 'دفتر کل و تسویه', icon: <FileSpreadsheet className="w-4 h-4" /> },
      ],
    },
    hosting: {
      title: 'میزبانی وب و دامنه‌ها',
      items: [
        { id: 'deployments', label: 'استقرارهای وب', icon: <Globe className="w-4 h-4" /> },
        { id: 'domains', label: 'دامنه‌های اختصاصی', icon: <Link2 className="w-4 h-4" /> },
        { id: 'routing', label: 'مسیریابی شبکه لبه', icon: <Network className="w-4 h-4" /> },
      ],
    },
    compliance: {
      title: 'اینماد و نمادهای سامانه‌ای',
      items: [
        { id: 'tokens', label: 'تاییدیه‌های اینماد', icon: <Award className="w-4 h-4" /> },
        { id: 'deeplinks', label: 'احراز دامنه و اپلیکیشن', icon: <Link2 className="w-4 h-4" /> },
      ],
    },
    telemetry: {
      title: 'لاگ‌ها و رویدادها',
      items: [
        { id: 'live', label: 'لاگ‌های زنده پلتفرم', icon: <Activity className="w-4 h-4" /> },
        { id: 'usage', label: 'گزارش مصارف و سهمیه‌ها', icon: <Layers className="w-4 h-4" /> },
      ],
    },
    settings: {
      title: 'تنظیمات پروژه',
      items: [
        { id: 'general', label: 'تنظیمات عمومی', icon: <Settings className="w-4 h-4" /> },
        { id: 'network', label: 'موقعیت و خروجی شبکه', icon: <Network className="w-4 h-4" /> },
        { id: 'team', label: 'اعضای تیم و دسترسی‌ها', icon: <Users className="w-4 h-4" /> },
      ],
    },
  };

  const currentSubGroup = subViewGroups[activeTab] || subViewGroups.database;

  return (
    <aside className="flex h-full select-none shrink-0 relative" aria-label="ناوبری دو سطحی پروژه">
      {/* Level 1: Primary Vertical Rail with 100ms Hover Delay and Non-Pushing Overlay */}
      <div className="relative w-14 h-full shrink-0 z-30">
        <nav
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={`absolute top-0 right-0 h-full bg-white border-l border-slate-200 flex flex-col justify-between py-3 px-2 overflow-hidden transition-[width,box-shadow] duration-200 ease-in-out ${
            isRailExpanded ? 'w-56 shadow-2xl z-40' : 'w-14'
          }`}
          aria-label="سرویس‌های اصلی"
        >
          <div className="flex flex-col gap-1 w-full">
            {/* Project Avatar / Mini Logo */}
            <button
              onClick={onNavigateHome}
              title={`بازگشت به هاب پروژه‌ها (${project?.name || 'انتخاب پروژه'})`}
              className="w-full h-10 flex items-center rounded-xl transition-colors hover:bg-slate-100 text-right p-0 overflow-hidden"
            >
              <div className="w-10 h-10 shrink-0 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shadow-xs transition-colors">
                {project?.name ? project.name.slice(0, 2) : 'LM'}
              </div>
              <div
                className={`mr-2.5 flex-1 min-w-0 text-right transition-opacity duration-150 ${
                  isRailExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              >
                <div className="text-xs font-semibold text-slate-900 truncate leading-tight">
                  {project?.name || 'انتخاب پروژه'}
                </div>
                <div className="text-[10px] text-slate-400 truncate">بازگشت به هاب پروژه‌ها</div>
              </div>
            </button>

            <div className="w-full h-px bg-slate-200 my-1" />

            {/* Module Icons */}
            {primaryModules.map((mod) => {
              const isActive = activeTab === mod.id;
              return (
                <button
                  key={mod.id}
                  onClick={() => {
                    const firstSub = subViewGroups[mod.id]?.items[0]?.id;
                    onTabChange(mod.id, firstSub);
                  }}
                  title={!isRailExpanded ? mod.label : undefined}
                  aria-label={mod.label}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative w-full h-10 flex items-center rounded-xl transition-colors overflow-hidden ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-700 font-semibold'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  <div className="w-10 h-10 shrink-0 flex items-center justify-center">
                    {mod.icon}
                  </div>
                  <span
                    className={`mr-1 text-xs truncate whitespace-nowrap transition-opacity duration-150 ${
                      isRailExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                  >
                    {mod.label}
                  </span>
                  {mod.badge && (
                    <span
                      className={`mr-auto px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-700 font-medium whitespace-nowrap transition-opacity duration-150 ${
                        isRailExpanded ? 'opacity-100' : 'opacity-0'
                      }`}
                    >
                      {mod.badge}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute right-0 top-2 bottom-2 w-1 bg-emerald-600 rounded-l-full" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Bottom Hub Return Button */}
          <div className="w-full pt-2 border-t border-slate-200">
            <button
              onClick={onNavigateHome}
              title={!isRailExpanded ? 'همه پروژه‌ها' : undefined}
              className="w-full h-10 flex items-center rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors overflow-hidden"
            >
              <div className="w-10 h-10 shrink-0 flex items-center justify-center">
                <FolderGit2 className="w-5 h-5 shrink-0" />
              </div>
              <span
                className={`mr-1 text-xs font-medium whitespace-nowrap transition-opacity duration-150 ${
                  isRailExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              >
                همه پروژه‌ها
              </span>
            </button>
          </div>
        </nav>
      </div>

      {/* Level 2: Secondary Sub-Navigation Pane */}
      <nav
        className={`bg-slate-50 border-l border-slate-200 flex flex-col h-full transition-all duration-200 ease-in-out shrink-0 z-10 ${
          isSubNavCollapsed ? 'w-0 overflow-hidden border-none' : 'w-56'
        }`}
        aria-label={currentSubGroup.title}
      >
        <div className="p-3.5 border-b border-slate-200 flex items-center justify-between">
          <div className="font-semibold text-xs text-slate-700 tracking-tight">
            {currentSubGroup.title}
          </div>
          <button
            onClick={() => setIsSubNavCollapsed(!isSubNavCollapsed)}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-200 transition"
            title="بستن منو"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {currentSubGroup.items.map((sub) => {
            const isActive = activeSubView === sub.id;
            return (
              <button
                key={sub.id}
                onClick={() => onSubViewChange && onSubViewChange(sub.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition text-right ${
                  isActive
                    ? 'bg-white text-emerald-700 font-semibold shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span className={isActive ? 'text-emerald-600' : 'text-slate-400'}>
                  {sub.icon}
                </span>
                <span className="flex-1 truncate">{sub.label}</span>
              </button>
            );
          })}
        </div>

        {/* Project Context Footer in Sub-Sidebar */}
        {project && (
          <div className="p-3 border-t border-slate-200 text-[11px] text-slate-500 bg-white/50">
            <div className="font-medium text-slate-700 truncate">{project.name}</div>
            <div className="text-[10px] text-slate-400 font-mono" dir="ltr">
              {project.slug}
            </div>
          </div>
        )}
      </nav>
    </aside>
  );
};
