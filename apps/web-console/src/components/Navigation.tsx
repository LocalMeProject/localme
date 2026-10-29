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
    { id: 'overview', label: 'نمای کلی و DAG', icon: <LayoutGrid className="w-4 h-4" /> },
    { id: 'database', label: 'پایگاه داده (DBaaS)', icon: <Database className="w-4 h-4" /> },
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
    <div className="border-b border-[#242424] bg-[#0f0f0f] px-6">
      <nav
        className="flex gap-1.5 overflow-x-auto py-2.5 no-scrollbar"
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
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all focus-visible:outline-none ${
                isActive
                  ? 'bg-[#171717] text-[#3ECF8E] border border-[#3ECF8E]/30 font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#171717]'
              }`}
            >
              <span className={isActive ? 'text-[#3ECF8E]' : 'text-zinc-400'}>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={`text-[9px] px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider ${
                    edgeFunctionsEnabled
                      ? 'bg-[#3ECF8E]/10 text-[#3ECF8E] border border-[#3ECF8E]/30'
                      : 'bg-[#1f1f1f] text-zinc-500 border border-[#2e2e2e]'
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
