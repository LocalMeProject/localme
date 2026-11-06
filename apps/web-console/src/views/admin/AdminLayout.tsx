import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Database, 
  HardDrive, 
  Radio, 
  Building2, 
  Activity, 
  Users, 
  FileText, 
  DollarSign, 
  LogOut, 
  ExternalLink, 
  Network
} from 'lucide-react';
import { useAuth } from '../../components/auth/AuthGuard';
import { api } from '../../utils/apiClient';

export type AdminTab = 
  | 'shards'
  | 'storage'
  | 'gateways'
  | 'tenants'
  | 'telemetry'
  | 'users'
  | 'logs'
  | 'pricing';

interface AdminLayoutProps {
  currentTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  children: React.ReactNode;
}

export function AdminLayout({ currentTab, onTabChange, children }: AdminLayoutProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [egressIp, setEgressIp] = useState<string>('2.180.12.94');

  useEffect(() => {
    // Fetch live config to get dynamic egress IP
    api.get('/_baas/v1/admin/config')
      .then((cfg) => {
        if (cfg?.egressNatIp) {
          setEgressIp(cfg.egressNatIp);
        }
      })
      .catch(() => {
        // fallback
      });
  }, []);

  const navItems: { id: AdminTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'shards', label: 'مدیریت شاردها و کلاستر', icon: Database },
    { id: 'storage', label: 'فضای ذخیره‌سازی و S3 آروان', icon: HardDrive },
    { id: 'gateways', label: 'درگاه‌های پیامک و پرداخت', icon: Radio },
    { id: 'tenants', label: 'نظارت بر پروژه‌ها (تننت‌ها)', icon: Building2 },
    { id: 'telemetry', label: 'پایش و سلامت سرور (Telemetry)', icon: Activity },
    { id: 'users', label: 'کاربران و سطوح دسترسی', icon: Users },
    { id: 'logs', label: 'لاگ‌های زنده سیستم', icon: FileText },
    { id: 'pricing', label: 'تعرفه‌ها و سهمیه‌های پایه', icon: DollarSign },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 font-sans selection:bg-emerald-500/20 selection:text-emerald-700" dir="rtl">
      
      {/* Topbar */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md px-5 py-2.5 flex items-center justify-between shadow-xs select-none">
        
        {/* Brand & Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <img
              src="/favicon.svg"
              alt="LocalMe"
              className="w-7 h-7 rounded-lg object-contain shadow-xs"
            />
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-900 text-white tracking-wider">
              ADMIN
            </span>
            <span className="text-xs font-bold text-slate-900 tracking-tight hidden sm:inline">
              راهبری کلان سامانه لوکال می
            </span>
          </div>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          {/* Bus Status Indicator */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>سیستم اطلاع‌رسانی کلاستر (<span className="font-mono text-[10px]">cluster_bus</span>): فعال</span>
          </div>
        </div>

        {/* Right Utilities */}
        <div className="flex items-center gap-2.5">
          {/* Egress NAT Indicator */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-600">
            <Network className="w-3.5 h-3.5 text-slate-400" />
            <span>Egress IP:</span>
            <span className="font-mono font-semibold text-slate-800 text-[11px]" dir="ltr">{egressIp}</span>
          </div>

          {/* Switch to Developer Console */}
          <button
            onClick={() => navigate('/panel')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-medium text-slate-700 transition"
          >
            <span>پنل توسعه‌دهندگان</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* User Badge & Logout */}
          <div className="flex items-center gap-2 pr-2 border-r border-slate-200">
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-bold text-slate-800">{user?.fullName || 'مدیر ارشد'}</span>
              <span className="text-[10px] text-emerald-600 font-medium">Superadmin</span>
            </div>
            <button
              onClick={logout}
              title="خروج از حساب"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

      </header>

      {/* Admin Tab Navigation Bar */}
      <div className="border-b border-slate-200 bg-white px-5 overflow-x-auto no-scrollbar shadow-xs">
        <nav className="flex space-x-1 space-x-reverse min-w-max py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition select-none ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main Tab Content */}
      <main className="flex-1 p-5 md:p-8 max-w-7xl mx-auto w-full">
        {children}
      </main>

    </div>
  );
}
