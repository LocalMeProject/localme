import React from 'react';
import { Project } from '../types';
import { ShieldCheck, Server, Plus, Wallet, ChevronDown } from 'lucide-react';

interface HeaderProps {
  currentProject: Project;
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

  const tomanBalance = Math.floor(currentProject.walletBalanceIrr / 10);

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl px-6 py-3.5 flex items-center justify-between">
      {/* Brand & Project Switcher */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center font-black text-black text-xs shadow-md shadow-amber-500/10">
            LM
          </div>
          <div>
            <span className="text-xs font-bold tracking-tight text-zinc-100 flex items-center gap-1.5">
              LocalMe <span className="text-[10px] text-zinc-400 font-normal px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">Sovereign Cloud</span>
            </span>
          </div>
        </div>

        <div className="h-4 w-px bg-zinc-800" />

        {/* Project Selector Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-zinc-900/80 hover:bg-zinc-850 border border-zinc-800 text-xs font-medium text-zinc-200 transition"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-semibold">{currentProject.name}</span>
            <span className="text-zinc-500 font-mono text-[11px]">({currentProject.slug})</span>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400 ml-1" />
          </button>

          {dropdownOpen && (
            <div className="absolute left-0 mt-2 w-64 rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl py-1 z-50">
              <div className="px-3 py-2 text-[10px] font-semibold tracking-wider uppercase text-zinc-400 border-b border-zinc-800/60">
                پروژه‌های شما
              </div>
              <div className="max-h-56 overflow-y-auto py-1">
                {allProjects.map((proj) => (
                  <button
                    key={proj.id}
                    onClick={() => {
                      onSelectProject(proj);
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between text-xs hover:bg-zinc-800/70 transition ${
                      proj.id === currentProject.id ? 'bg-zinc-800/50 text-amber-400' : 'text-zinc-300'
                    }`}
                  >
                    <div>
                      <div className="font-medium">{proj.name}</div>
                      <div className="text-[10px] text-zinc-500 font-mono">{proj.slug}</div>
                    </div>
                    {proj.id === currentProject.id && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    )}
                  </button>
                ))}
              </div>
              <div className="border-t border-zinc-800/60 p-1.5">
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    onOpenCreateModal();
                  }}
                  className="w-full flex items-center justify-center space-x-1 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 font-medium transition"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-400" />
                  <span>ساخت پروژه جدید</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sovereign Iran Status Indicators & Wallet */}
      <div className="flex items-center space-x-3 text-xs">
        {/* Egress NAT Pill */}
        <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 font-mono text-[11px]">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>NAT: 2.180.12.94</span>
          <span className="text-[10px] text-emerald-400 font-bold">Whitelisted</span>
        </div>

        {/* Region */}
        <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono text-[11px]">
          <Server className="w-3.5 h-3.5 text-zinc-500" />
          <span>{currentProject.region}</span>
        </div>

        {/* Rial / Toman Wallet */}
        <div className="flex items-center space-x-2 pl-2">
          <div className="px-3 py-1 rounded-lg bg-zinc-900/90 border border-zinc-800/90 flex items-center space-x-2">
            <Wallet className="w-3.5 h-3.5 text-amber-400" />
            <div className="text-right">
              <span className="text-amber-400 font-bold font-mono text-xs">
                {tomanBalance.toLocaleString('fa-IR')}
              </span>
              <span className="text-[10px] text-zinc-400 mr-1">تومان</span>
            </div>
          </div>
          <button
            onClick={onOpenTopupModal}
            className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition shadow-sm"
          >
            افزایش موجودی
          </button>
        </div>
      </div>
    </header>
  );
};
