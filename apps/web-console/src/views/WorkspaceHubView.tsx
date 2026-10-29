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
  Layers,
  CheckCircle2,
  Copy,
  Globe,
  Radio,
  Clock,
  HardDrive,
} from 'lucide-react';
import { Project, UserEgressConfig } from '../types';

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
  const [copiedRelayCmd, setCopiedRelayCmd] = useState(false);

  // Workspace-wide aggregate metrics
  const totalDbStorage = projects.reduce((acc, p) => acc + (p.services.database?.isEnabled ? 48.5 : 0), 124.6);
  const totalRequests24h = '4,812,940';
  const totalDau = '100,000+';
  const p99Latency = '142ms';

  const [egressConfig] = useState<UserEgressConfig>({
    dedicatedIp: '185.143.232.14',
    outboundCountry: 'DE',
    tunnelRelayActive: true,
    tunnelPort: 443,
    protocol: 'TCP_TLS_443',
    assignedAsn: 'AS24940 (Hetzner Online GmbH)',
  });

  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRegion = filterRegion === 'ALL' || p.region === filterRegion;
    return matchesSearch && matchesRegion;
  });

  const handleCopyRelay = () => {
    navigator.clipboard.writeText('localme tunnel --relay --project-all --port 443 --tls');
    setCopiedRelayCmd(true);
    setTimeout(() => setCopiedRelayCmd(false), 2000);
  };

  const handleCardClick = (project: Project) => {
    onSelectProject(project);
    navigate(`/projects/${project.slug}/database`);
  };

  return (
    <div className="min-h-[calc(100vh-65px)] bg-[#0f0f0f] text-zinc-100 p-6 md:p-10 space-y-8 max-w-7xl mx-auto">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-[#242424] pb-8">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium tracking-wide bg-[#3ECF8E]/10 text-[#3ECF8E] border border-[#3ECF8E]/30">
              USER WORKSPACE HUB
            </span>
            <span className="text-zinc-500 text-xs">Stage 1 Fleet Control</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            فضای کاری و ناوگان سرویس‌های ابری
          </h1>
          <p className="text-xs text-zinc-400 mt-1 max-w-2xl leading-relaxed">
            مدیریت یکپارچه پروژه‌ها، اسکیماهای تفکیک‌شده PostgreSQL، ترافیک برون‌مرزی پایدار (DPI-Resilient TCP/TLS 1.3) و نظارت بر مقیاس‌پذیری ۱۰۰٬۰۰۰ کاربر روزانه.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenCreateProjectModal}
            className="btn-pill-primary"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>ساخت پروژه جدید</span>
          </button>
        </div>
      </div>

      {/* Aggregate Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total DAU */}
        <div className="p-4 rounded-xl bg-[#171717] border border-[#242424] hover:border-[#2e2e2e] transition shadow-sm">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium mb-2">
            <span>کاربران فعال روزانه (DAU)</span>
            <Activity className="w-4 h-4 text-[#3ECF8E]" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-white font-mono">
            {totalDau}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#3ECF8E]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>مقیاس‌پذیری تأیید شده برای ناوگان</span>
          </div>
        </div>

        {/* Total DB Storage */}
        <div className="p-4 rounded-xl bg-[#171717] border border-[#242424] hover:border-[#2e2e2e] transition shadow-sm">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium mb-2">
            <span>حجم پایگاه‌های داده (PostgreSQL)</span>
            <Database className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-white font-mono">
            {totalDbStorage.toFixed(1)} MB
          </div>
          <div className="mt-2 text-[11px] text-zinc-400 flex items-center justify-between font-mono">
            <span>اسکیماهای مجزا: {projects.length}</span>
            <span className="text-[#3ECF8E]">RAM Store: 0 B</span>
          </div>
        </div>

        {/* Total Requests / 24h */}
        <div className="p-4 rounded-xl bg-[#171717] border border-[#242424] hover:border-[#2e2e2e] transition shadow-sm">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium mb-2">
            <span>درخواست‌های گیت‌وی (۲۴ ساعت)</span>
            <Server className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-white font-mono">
            {totalRequests24h}
          </div>
          <div className="mt-2 text-[11px] text-zinc-400 flex items-center justify-between font-mono">
            <span>SWR Cache Hit: 88.4%</span>
            <span className="text-sky-400">Soft TTL 5s</span>
          </div>
        </div>

        {/* P99 SLA Latency */}
        <div className="p-4 rounded-xl bg-[#171717] border border-[#242424] hover:border-[#2e2e2e] transition shadow-sm">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium mb-2">
            <span>تأخیر پاسخ p99 (SLA)</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-white font-mono">
            {p99Latency}
          </div>
          <div className="mt-2 text-[11px] text-zinc-400 flex items-center justify-between font-mono">
            <span>هدف: &lt; 1000ms</span>
            <span className="text-[#3ECF8E]">پایدار</span>
          </div>
        </div>
      </div>

      {/* User Egress Fleet & Dedicated Outbound IP Settings */}
      <div className="p-5 rounded-2xl bg-[#171717] border border-[#242424] space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#242424] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#1f1f1f] border border-[#2e2e2e] flex items-center justify-center text-[#3ECF8E]">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                تنظیمات ترافیک برون‌مرزی اختصاصی و رله تونل (Sovereign Egress Fleet)
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  DPI-RESILIENT TCP/TLS
                </span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                مسیردهی خودکار ترافیک بر اساس ASN مبدا/مقصد. ترافیک‌های مسدود شده یا نیازمند آی‌پی ثابت خارجی از طریق تونل اختصاصی TCP 443 با رمزنگاری TLS 1.3 ارسال می‌شوند.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-[#1f1f1f] border border-[#2e2e2e] text-zinc-300">
              <Radio className="w-3.5 h-3.5 text-[#3ECF8E] animate-pulse" />
              <span>تونل متصل</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Assigned Dedicated IP */}
          <div className="p-3.5 rounded-xl bg-[#0f0f0f] border border-[#242424] space-y-1.5">
            <div className="text-zinc-400 text-[11px] font-medium">آی‌پی اختصاصی خروجی (Dedicated IP)</div>
            <div className="text-sm font-mono font-bold text-white flex items-center justify-between">
              <span>{egressConfig.dedicatedIp}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-sans">آلمان (FRA)</span>
            </div>
            <div className="text-[10px] text-zinc-500 font-mono truncate">{egressConfig.assignedAsn}</div>
          </div>

          {/* Protocol & Port */}
          <div className="p-3.5 rounded-xl bg-[#0f0f0f] border border-[#242424] space-y-1.5">
            <div className="text-zinc-400 text-[11px] font-medium">پروتکل انتقال ایمن (Bypass DPI)</div>
            <div className="text-sm font-mono font-bold text-[#3ECF8E] flex items-center justify-between">
              <span>TCP Port 443 TLS 1.3</span>
              <Shield className="w-4 h-4 text-[#3ECF8E]" />
            </div>
            <div className="text-[10px] text-zinc-500">جایگزین فیلترینگ UDP/WireGuard در زیرساخت ملی</div>
          </div>

          {/* CLI Tunnel Relay linking */}
          <div className="p-3.5 rounded-xl bg-[#0f0f0f] border border-[#242424] space-y-1.5">
            <div className="flex items-center justify-between text-zinc-400 text-[11px] font-medium">
              <span>اتصال رله محلی (CLI Proxy Relay)</span>
              <button
                onClick={handleCopyRelay}
                className="text-[10px] text-[#3ECF8E] hover:underline flex items-center gap-1 font-mono"
              >
                <Copy className="w-3 h-3" />
                {copiedRelayCmd ? 'کپی شد!' : 'کپی دستور CLI'}
              </button>
            </div>
            <div className="font-mono text-[11px] text-zinc-300 bg-[#171717] p-1.5 rounded border border-[#282828] truncate dir-ltr text-left">
              localme tunnel --relay --port 443
            </div>
            <div className="text-[10px] text-zinc-500">پروکسی محلی برای تست سرویس‌های حساس به آی‌پی</div>
          </div>
        </div>
      </div>

      {/* Projects Grid Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-white tracking-tight">پروژه‌های شما ({projects.length})</h2>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="جستجوی نام یا شناسه پروژه..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-8 pl-3 py-1.5 text-xs rounded-full bg-[#171717] border border-[#242424] focus:border-[#3ECF8E] focus:outline-none text-zinc-200 placeholder-zinc-500 w-56 md:w-64 transition"
              />
            </div>
          </div>

          {/* Region selector filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-zinc-500 text-[11px]">منطقه:</span>
            {['ALL', 'IR-THR-1', 'EU-FRA-1'].map((reg) => (
              <button
                key={reg}
                onClick={() => setFilterRegion(reg)}
                className={`px-3 py-1 rounded-full text-[11px] font-mono transition ${
                  filterRegion === reg
                    ? 'bg-[#3ECF8E] text-black font-semibold'
                    : 'bg-[#171717] text-zinc-400 hover:text-zinc-200 border border-[#242424]'
                }`}
              >
                {reg === 'ALL' ? 'همه مناطق' : reg}
              </button>
            ))}
          </div>
        </div>

        {/* Project Cards Grid */}
        {filteredProjects.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-[#171717] border border-dashed border-[#242424] space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#1f1f1f] text-zinc-500 mx-auto flex items-center justify-center">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-300">پروژه‌ای با این مشخصات یافت نشد</h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              می‌توانید برای میزبانی اپلیکیشن، پایگاه داده رابطه‌ای و سرویس‌های خود یک پروژه جدید تعریف کنید.
            </p>
            <button
              onClick={onOpenCreateProjectModal}
              className="btn-pill-primary mt-2"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>ساخت اولین پروژه</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProjects.map((proj) => (
              <div
                key={proj.id}
                  onClick={() => handleCardClick(proj)}
                  className="group relative p-5 rounded-2xl bg-[#171717] border border-[#242424] hover:border-[#3ECF8E]/50 transition-all duration-200 cursor-pointer flex flex-col justify-between shadow-sm hover:shadow-lg hover:shadow-[#3ECF8E]/5"
                >
                  <div className="space-y-3">
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-white group-hover:text-[#3ECF8E] transition">
                            {proj.name}
                          </h3>
                          <span className="w-2 h-2 rounded-full bg-[#3ECF8E]" />
                        </div>
                        <div className="text-[11px] font-mono text-zinc-500 mt-0.5 dir-ltr text-right">
                          {proj.slug}.localme.ir
                        </div>
                      </div>

                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#1f1f1f] border border-[#2e2e2e] text-zinc-300">
                        {proj.region}
                      </span>
                    </div>

                    {/* Card Description */}
                    <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                      {proj.description || 'پروژه اختصاصی ابری برای مدیریت پایگاه داده، احراز هویت پیامکی و سرویس‌های کاربر.'}
                    </p>

                    {/* Technical details badge row */}
                    <div className="pt-2 border-t border-[#242424] grid grid-cols-2 gap-2 text-[11px] font-mono text-zinc-400">
                      <div className="flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5 text-[#3ECF8E]" />
                        <span className="truncate">prj_{proj.slug}</span>
                      </div>
                      <div className="flex items-center gap-1.5 justify-end">
                        <HardDrive className="w-3.5 h-3.5 text-zinc-500" />
                        <span>PostgreSQL 18</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="mt-4 pt-3 border-t border-[#242424] flex items-center justify-between text-xs">
                    <span className="text-[11px] text-zinc-500 font-mono">
                      ایجاد: {new Date(proj.createdAt).toLocaleDateString('fa-IR')}
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-[#3ECF8E] group-hover:translate-x-[-2px] transition">
                      <span>ورود به استودیو</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};
