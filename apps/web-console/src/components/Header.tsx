import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Project } from '../types';
import {
  User,
  ChevronDown,
  LayoutGrid,
  ChevronLeft,
  Plus,
  Wallet,
  Settings,
  LogOut,
  CreditCard,
  Check,
} from 'lucide-react';

interface HeaderProps {
  currentProject?: Project;
  allProjects: Project[];
  onSelectProject: (p: Project) => void;
  onOpenCreateModal: () => void;
  onOpenTopupModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentProject,
  allProjects,
  onSelectProject,
  onOpenCreateModal,
  onOpenTopupModal,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Project selector dropdown state
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const projectDropdownRef = useRef<HTMLDivElement>(null);

  // Mini Profile popover state
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Outside click listeners
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(event.target as Node)) {
        setProjectDropdownOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isHubView = location.pathname === '/' || location.pathname === '/hub';
  const tomanBalance = Math.floor((currentProject?.walletBalanceIrr ?? 0) / 10);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md px-5 py-2.5 flex items-center justify-between shadow-xs select-none">
      {/* Brand & Project Breadcrumb Navigation */}
      <div className="flex items-center gap-3">
        {/* Brand Icon */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 focus:outline-none group"
          title="بازگشت به فهرست پروژه‌ها"
        >
          <div className="w-8 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center font-bold text-white text-xs shadow-xs transition">
            LM
          </div>
          <span className="text-xs font-bold text-slate-900 tracking-tight">
            لوکال‌می
          </span>
        </button>

        <div className="h-4 w-px bg-slate-200" />

        {/* Breadcrumb & Project Selector */}
        {isHubView ? (
          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
            <LayoutGrid className="w-3.5 h-3.5 text-emerald-600" />
            <span>میزکار مدیریت پروژه‌ها</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1 text-slate-500 hover:text-slate-800 transition px-2 py-1 rounded-md hover:bg-slate-100"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
              <span>پروژه‌ها</span>
            </button>

            <span className="text-slate-300">/</span>

            {/* Project Selector Dropdown */}
            <div className="relative" ref={projectDropdownRef}>
              <button
                onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-medium text-slate-800 transition"
              >
                <div className={`w-2 h-2 rounded-full ${currentProject ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                <span className="font-semibold">{currentProject ? currentProject.name : 'انتخاب پروژه'}</span>
                {currentProject && (
                  <bdi className="text-slate-400 font-mono text-[11px] inline-block" dir="ltr">
                    ({currentProject.slug})
                  </bdi>
                )}
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {projectDropdownOpen && (
                <div className="absolute right-0 mt-1.5 w-64 rounded-xl bg-white border border-slate-200 shadow-xl py-1 z-50">
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-500 border-b border-slate-100">
                    تغییر پروژه فعال
                  </div>
                  <div className="max-h-56 overflow-y-auto py-1">
                    {allProjects.length === 0 ? (
                      <div className="px-3 py-3 text-xs text-slate-400 text-center">
                        هیچ پروژه‌ای یافت نشد
                      </div>
                    ) : (
                      allProjects.map((proj) => {
                        const isCurrent = proj.id === currentProject?.id;
                        return (
                          <button
                            key={proj.id}
                            onClick={() => {
                              onSelectProject(proj);
                              setProjectDropdownOpen(false);
                              navigate(`/panel/${proj.slug}/database/grid`);
                            }}
                            className={`w-full text-right px-3 py-2 flex items-center justify-between text-xs hover:bg-slate-50 transition ${
                              isCurrent ? 'bg-emerald-50 text-emerald-800 font-medium' : 'text-slate-700'
                            }`}
                          >
                            <div className="truncate">
                              <div className="font-medium truncate">{proj.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono truncate" dir="ltr">
                                {proj.slug}
                              </div>
                            </div>
                            {isCurrent && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                  <div className="border-t border-slate-100 p-1.5">
                    <button
                      onClick={() => {
                        setProjectDropdownOpen(false);
                        onOpenCreateModal();
                      }}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-xs text-emerald-800 font-medium transition"
                    >
                      <Plus className="w-3.5 h-3.5 text-emerald-600" />
                      <span>ایجاد پروژه جدید</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mini Profile Popover (Replacing old raw badges) */}
      <div className="relative" ref={profileRef}>
        <button
          onClick={() => setProfileOpen(!profileOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs text-slate-700 transition"
          title="مشخصات و حساب کاربری"
        >
          <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <User className="w-3.5 h-3.5" />
          </div>
          <span className="font-medium text-slate-800 hidden sm:inline-flex items-center gap-1.5">
            <span>سینا ولی زاده</span>
            <span className="text-slate-300">|</span>
            <span className="text-emerald-700 font-semibold">{tomanBalance.toLocaleString('fa-IR')} تومان</span>
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </button>

        {profileOpen && (
          <div className="absolute left-0 mt-1.5 w-72 rounded-xl bg-white border border-slate-200 shadow-xl p-3 z-50">
            {/* User Details */}
            <div className="pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-xs text-slate-900">سینا والی زاده</span>
                <span className="text-[10px] font-medium bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                  توسعه‌دهنده
                </span>
              </div>
              <div className="text-[11px] text-slate-500 font-mono" dir="ltr">
                +989121112233
              </div>
              <div className="text-[11px] text-slate-400 font-mono" dir="ltr">
                sina@example.com
              </div>
            </div>

            {/* Wallet Balance Box */}
            <div className="my-2.5 p-2.5 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-slate-600">
                <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                <span>موجودی کیف پول:</span>
              </div>
              <div className="font-semibold text-emerald-700 flex items-center gap-1">
                <span dir="ltr">{tomanBalance.toLocaleString('fa-IR')}</span>
                <span className="text-[10px] text-slate-500 font-normal">تومان</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-1">
              <button
                onClick={() => {
                  setProfileOpen(false);
                  onOpenTopupModal();
                }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>افزایش اعتبار کیف پول</span>
              </button>

              <button
                onClick={() => {
                  setProfileOpen(false);
                  if (currentProject) {
                    navigate(`/panel/${currentProject.slug}/settings/general`);
                  }
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-slate-700 hover:bg-slate-50 text-xs transition text-right"
              >
                <Settings className="w-3.5 h-3.5 text-slate-400" />
                <span>تنظیمات و دسترسی‌ها</span>
              </button>

              <button
                onClick={() => {
                  setProfileOpen(false);
                  navigate('/panel');
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 text-xs transition text-right"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>خروج از حساب</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
