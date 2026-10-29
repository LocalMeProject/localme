import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Project } from '../types';
import {
  ShieldCheck,
  Server,
  Plus,
  Wallet,
  ChevronDown,
  LayoutGrid,
  ChevronLeft,
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
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isHubView = location.pathname === '/' || location.pathname === '/hub';
  const tomanBalance = Math.floor((currentProject?.walletBalanceIrr ?? 0) / 10);

  return (
    <header className="sticky top-0 z-40 border-b border-[#242424] bg-[#0f0f0f]/95 backdrop-blur-xl px-6 py-3 flex items-center justify-between">
      {/* Brand & Breadcrumb Navigation */}
      <div className="flex items-center gap-3">
        {/* Brand Icon */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2.5 focus:outline-none group"
          title="بازگشت به هاب پروژه‌ها"
        >
          <div className="w-8 h-8 rounded-lg bg-[#3ECF8E] flex items-center justify-center font-black text-black text-xs shadow-sm transition group-hover:scale-105">
            LM
          </div>
          <div className="text-right">
            <span className="text-xs font-bold tracking-tight text-white flex items-center gap-1.5">
              LocalMe
              <span className="text-[10px] text-zinc-400 font-mono px-1.5 py-0.5 rounded-full bg-[#171717] border border-[#242424]">
                v2.0
              </span>
            </span>
          </div>
        </button>

        <div className="h-4 w-px bg-[#242424]" />

        {/* Two-Stage Breadcrumb */}
        {isHubView ? (
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <LayoutGrid className="w-3.5 h-3.5 text-[#3ECF8E]" />
            <span className="font-semibold text-white">میزکار فضای ابری (Workspace Hub)</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs">
            {/* Back to all projects button */}
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1 text-zinc-400 hover:text-white transition px-2 py-1 rounded-full hover:bg-[#1f1f1f]"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-zinc-400" />
              <span>همه پروژه‌ها</span>
            </button>

            <span className="text-zinc-600">/</span>

            {/* Project Selector Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#171717] hover:bg-[#1f1f1f] border border-[#242424] text-xs font-medium text-zinc-200 transition"
              >
                <div className={`w-2 h-2 rounded-full ${currentProject ? 'bg-[#3ECF8E]' : 'bg-zinc-600'}`} />
                <span className="font-semibold">{currentProject ? currentProject.name : 'انتخاب پروژه'}</span>
                {currentProject && (
                  <span className="text-zinc-500 font-mono text-[11px]">({currentProject.slug})</span>
                )}
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl bg-[#171717] border border-[#242424] shadow-2xl py-1 z-50">
                  <div className="px-3 py-2 text-[10px] font-semibold tracking-wider uppercase text-zinc-400 border-b border-[#242424]">
                    انتخاب پروژه فعال
                  </div>
                  <div className="max-h-56 overflow-y-auto py-1">
                    {allProjects.length === 0 ? (
                      <div className="px-3 py-3 text-xs text-zinc-500 text-center">هیچ پروژه‌ای تعریف نشده است</div>
                    ) : (
                      allProjects.map((proj) => (
                        <button
                          key={proj.id}
                          onClick={() => {
                            onSelectProject(proj);
                            setDropdownOpen(false);
                            navigate(`/projects/${proj.slug}/database`);
                          }}
                          className={`w-full text-right px-3 py-2 flex items-center justify-between text-xs hover:bg-[#1f1f1f] transition ${
                            proj.id === currentProject?.id ? 'bg-[#1f1f1f] text-[#3ECF8E]' : 'text-zinc-300'
                          }`}
                        >
                          <div>
                            <div className="font-medium">{proj.name}</div>
                            <div className="text-[10px] text-zinc-500 font-mono">{proj.slug}</div>
                          </div>
                          {proj.id === currentProject?.id && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#3ECF8E]" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                  <div className="border-t border-[#242424] p-1.5">
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        onOpenCreateModal();
                      }}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1f1f1f] hover:bg-[#282828] text-xs text-zinc-200 font-medium transition"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#3ECF8E]" />
                      <span>ساخت پروژه جدید</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sovereign Iran Status Indicators & Wallet */}
      <div className="flex items-center gap-3 text-xs">
        {/* Egress NAT Pill */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#171717] border border-[#242424] text-zinc-300 font-mono text-[11px]">
          <ShieldCheck className="w-3.5 h-3.5 text-[#3ECF8E]" />
          <span>NAT: 2.180.12.94</span>
          <span className="text-[10px] text-[#3ECF8E] font-bold">Whitelisted</span>
        </div>

        {/* Region */}
        {currentProject && !isHubView && (
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#171717] border border-[#242424] text-zinc-400 font-mono text-[11px]">
            <Server className="w-3.5 h-3.5 text-zinc-500" />
            <span>{currentProject.region}</span>
          </div>
        )}

        {/* Rial / Toman Wallet */}
        <div className="flex items-center gap-2 pl-2">
          <div className="px-3 py-1 rounded-full bg-[#171717] border border-[#242424] flex items-center gap-2">
            <Wallet className="w-3.5 h-3.5 text-[#3ECF8E]" />
            <div className="text-right flex items-center gap-1">
              <span className="text-[#3ECF8E] font-bold font-mono text-xs">
                {tomanBalance.toLocaleString('fa-IR')}
              </span>
              <span className="text-[10px] text-zinc-400">تومان</span>
            </div>
          </div>
          <button
            onClick={onOpenTopupModal}
            className="btn-pill-primary text-xs px-3 py-1"
          >
            افزایش موجودی
          </button>
        </div>
      </div>
    </header>
  );
};
