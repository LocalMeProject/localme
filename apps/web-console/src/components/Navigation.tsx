import React from 'react';
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
} from 'lucide-react';

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

interface NavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  edgeFunctionsEnabled: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  edgeFunctionsEnabled,
}) => {
  const tabs: { id: TabId; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'overview', label: 'نمای کلی و ماتریس DAG', icon: <LayoutGrid className="w-4 h-4" /> },
    { id: 'database', label: 'پایگاه داده رابطه‌ای', icon: <Database className="w-4 h-4" /> },
    { id: 'auth', label: 'احراز هویت پیامکی', icon: <Users className="w-4 h-4" /> },
    {
      id: 'functions',
      label: 'توابع سرورلس لبه',
      icon: <Terminal className="w-4 h-4" />,
      badge: edgeFunctionsEnabled ? 'فعال' : 'غیرفعال',
    },
    { id: 'storage', label: 'فضای ذخیره‌سازی ابری', icon: <HardDrive className="w-4 h-4" /> },
    { id: 'ipg', label: 'درگاه شاپرک و تسویه', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'hosting', label: 'استقرار وب و دامنه‌ها', icon: <Globe className="w-4 h-4" /> },
    { id: 'compliance', label: 'اینماد و نمادهای ملی', icon: <Award className="w-4 h-4" /> },
    { id: 'telemetry', label: 'لاگ‌ها و مصارف ریالی', icon: <Activity className="w-4 h-4" /> },
    { id: 'settings', label: 'تنظیمات و کلیدهای API', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="border-b border-zinc-800/80 bg-zinc-950/60 backdrop-blur-md px-6">
      <nav
        className="flex gap-1 overflow-x-auto py-2 no-scrollbar"
        role="tablist"
        aria-label="تب‌های میزکار توسعه‌دهنده"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:outline-none ${
                isActive
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
              }`}
            >
              <span className={isActive ? 'text-amber-400' : 'text-zinc-400'}>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    edgeFunctionsEnabled
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700/60'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
