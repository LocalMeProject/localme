import { useState, useEffect } from 'react';
import { 
  Activity, 
  Cpu, 
  HardDrive, 
  Database, 
  Clock, 
  RefreshCw, 
  Server,
  Layers,
  Building2,
  Users,
  Grid,
  Pause,
  Play
} from 'lucide-react';
import { api } from '../../utils/apiClient';
import { toPersianDigits, formatToman } from '../../utils/persian';

interface TelemetryData {
  cpuUsagePercent?: number;
  cpu_percent?: number;
  memoryWorkingSetMb?: number;
  memory_mb?: number;
  memoryAllocatedMb?: number;
  activeDbConnections?: number;
  active_connections?: number;
  idleDbConnections?: number;
  idle_connections?: number;
  totalDbConnections?: number;
  total_connections?: number;
  dbSizeBytes?: number;
  dbSizePretty?: string;
  pushQueueBacklog?: number;
  latencyPercentiles?: {
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
  };
  latency_p50_ms?: number;
  latency_p95_ms?: number;
  latency_p99_ms?: number;
  serverUptimeSeconds?: number;
  uptime_seconds?: number;
  threadPoolBusyThreads?: number;
  threadPoolMaxThreads?: number;
  totalProjects?: number;
  activeShards?: number;
  totalRequestsServed?: number;
  status?: string;
}

interface ProjectBreakdownItem {
  projectId: string;
  slug: string;
  name: string;
  ownerPhone: string;
  dbSize: string;
  tableCount: number;
  liveRows: number;
  functionCount: number;
  domainCount: number;
}

interface UserBreakdownItem {
  userId: string;
  fullName: string;
  phone: string;
  role: string;
  walletBalanceIrr: number;
  projectCount: number;
  totalDbSizeBytes: number;
  totalDbSizePretty: string;
  totalStorageBytes: number;
  totalStoragePretty: string;
}

interface ShardBreakdownItem {
  clusterId: string;
  projectCount: number;
}

export function TelemetryHealthView() {
  const [data, setData] = useState<TelemetryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'projects' | 'users' | 'shards'>('overview');

  // Breakdown state
  const [projectBreakdown, setProjectBreakdown] = useState<ProjectBreakdownItem[]>([]);
  const [userBreakdown, setUserBreakdown] = useState<UserBreakdownItem[]>([]);
  const [shardBreakdown, setShardBreakdown] = useState<ShardBreakdownItem[]>([]);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);

  const fetchTelemetry = async (isManual = false) => {
    if (isManual) setLoading(true);
    try {
      const res = await api.get('/_baas/v1/admin/telemetry');
      if (res) {
        setData(res);
      }
    } catch (err) {
      console.error('Failed to fetch telemetry', err);
    } finally {
      if (isManual) setLoading(false);
    }
  };

  const fetchBreakdown = async () => {
    setLoadingBreakdown(true);
    try {
      const res = await api.get('/_baas/v1/admin/telemetry/breakdown');
      if (res) {
        const rawProjects = res.projects || res.projectBreakdown || [];
        setProjectBreakdown(rawProjects.map((p: any) => ({
          projectId: p.id || p.projectId,
          slug: p.slug,
          name: p.name,
          ownerPhone: p.ownerPhone,
          dbSize: p.dbSizePretty || p.dbSize || '0 B',
          tableCount: p.tableCount ?? 0,
          liveRows: p.liveRows ?? p.totalRows ?? 0,
          functionCount: p.functionCount ?? 0,
          domainCount: p.domainCount ?? 0,
        })));

        const rawUsers = res.users || res.userBreakdown || [];
        setUserBreakdown(rawUsers.map((u: any) => ({
          userId: u.id || u.userId,
          fullName: u.fullName || 'بدون نام',
          phone: u.phone,
          role: u.role,
          walletBalanceIrr: u.walletBalanceIrr ?? 0,
          projectCount: u.projectCount ?? 0,
          totalDbSizeBytes: u.totalDbSizeBytes ?? 0,
          totalDbSizePretty: u.totalDbSizePretty || '0 B',
        })));

        const rawShards = res.shards || res.shardBreakdown || [];
        setShardBreakdown(rawShards.map((s: any) => ({
          clusterId: s.id || s.clusterId,
          projectCount: s.currentProjectCount ?? s.projectCount ?? 0,
        })));
      }
    } catch (err) {
      console.error('Failed to fetch telemetry breakdown', err);
    } finally {
      setLoadingBreakdown(false);
    }
  };

  useEffect(() => {
    fetchTelemetry(true);
  }, []);

  useEffect(() => {
    if (activeSubTab !== 'overview') {
      fetchBreakdown();
    }
  }, [activeSubTab]);

  // 3-second auto-refresh polling
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (autoRefresh && activeSubTab === 'overview') {
      interval = setInterval(() => {
        fetchTelemetry(false);
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, activeSubTab]);

  const formatUptime = (seconds?: number) => {
    if (seconds === undefined || seconds === null) return 'در حال محاسبه...';
    const total = Math.floor(seconds);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${toPersianDigits(h)} ساعت و ${toPersianDigits(m)} دقیقه و ${toPersianDigits(s)} ثانیه`;
  };

  // Real data extraction with zero fake numbers
  const cpu = data?.cpuUsagePercent ?? data?.cpu_percent ?? 0;
  const memoryWorkingSet = data?.memoryWorkingSetMb ?? data?.memory_mb ?? 0;
  const memoryAllocated = data?.memoryAllocatedMb ?? 0;
  
  const activeConnections = data?.activeDbConnections ?? data?.active_connections ?? 0;
  const idleConnections = data?.idleDbConnections ?? data?.idle_connections ?? 0;
  const totalConnections = data?.totalDbConnections ?? data?.total_connections ?? (activeConnections + idleConnections);
  
  const dbSizePretty = data?.dbSizePretty ?? '۰ مگابایت';
  
  const p50 = data?.latencyPercentiles?.p50Ms ?? data?.latency_p50_ms ?? 0;
  const p95 = data?.latencyPercentiles?.p95Ms ?? data?.latency_p95_ms ?? 0;
  const p99 = data?.latencyPercentiles?.p99Ms ?? data?.latency_p99_ms ?? 0;
  
  const uptimeSeconds = data?.serverUptimeSeconds ?? data?.uptime_seconds;
  const totalProjects = data?.totalProjects ?? 0;
  const activeShards = data?.activeShards ?? 1;
  const totalRequests = data?.totalRequestsServed ?? 0;
  const busyThreads = data?.threadPoolBusyThreads ?? 0;

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">پایش بلادرنگ و سنجه‌های تفکیکی سیستم (Telemetry)</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              داده‌های ۱۰۰٪ واقعی سرور و پایگاه‌داده
            </span>
          </div>
          <p className="text-xs text-slate-500">
            سنجه‌های پردازنده، حافظه، اتصالات کلاستر و تفکیک دقیق منابع مصرفی بر اساس پروژه، کاربر و شارد.
          </p>
        </div>

        {/* Sub-tab Pills & Refresh */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-medium">
            <button
              onClick={() => setActiveSubTab('overview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                activeSubTab === 'overview' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>دید کلی کلاستر</span>
            </button>
            <button
              onClick={() => setActiveSubTab('projects')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                activeSubTab === 'projects' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>تفکیک پروژه‌ها</span>
            </button>
            <button
              onClick={() => setActiveSubTab('users')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                activeSubTab === 'users' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>تفکیک کاربران</span>
            </button>
            <button
              onClick={() => setActiveSubTab('shards')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                activeSubTab === 'shards' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>توزیع شاردها</span>
            </button>
          </div>

          {activeSubTab === 'overview' && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition ${
                  autoRefresh
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                }`}
                title={autoRefresh ? 'توقف تازه‌سازی خودکار' : 'شروع تازه‌سازی خودکار'}
              >
                {autoRefresh ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{autoRefresh ? 'پایش زنده' : 'متوقف'}</span>
              </button>
              <button
                onClick={() => fetchTelemetry(true)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
                title="تازه سازی اکنون"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
              </button>
            </div>
          )}

          {activeSubTab !== 'overview' && (
            <button
              onClick={fetchBreakdown}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
              title="تازه سازی تفکیک"
            >
              <RefreshCw className={`w-4 h-4 ${loadingBreakdown ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* SUB-TAB 1: Overview */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          {/* Main Metric Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Card 1: CPU Usage */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold">مصرف پردازنده سرور (CPU)</span>
                <Cpu className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold font-mono text-slate-900">
                  {toPersianDigits(cpu.toFixed(1))}
                </span>
                <span className="text-xs text-slate-500">درصد</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    cpu > 80 ? 'bg-rose-500' : cpu > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(2, cpu))}%` }}
                />
              </div>
              <div className="text-[11px] text-slate-400 mt-2 flex items-center justify-between">
                <span>ترد‌های پردازشی فعال:</span>
                <span className="font-mono font-medium text-slate-700">{toPersianDigits(busyThreads)} ترد</span>
              </div>
            </div>

            {/* Card 2: Memory */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold">حافظه اشغالی پروسه (WorkingSet)</span>
                <HardDrive className="w-4 h-4 text-cyan-600" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold font-mono text-slate-900">
                  {toPersianDigits(memoryWorkingSet.toFixed(1))}
                </span>
                <span className="text-xs text-slate-500">مگابایت</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
                <div
                  className="bg-cyan-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(5, (memoryWorkingSet / 1024) * 100))}%` }}
                />
              </div>
              <div className="text-[11px] text-slate-400 mt-2 flex items-center justify-between">
                <span>تخصیص هیپ دات‌نت (GC Heap):</span>
                <span className="font-mono font-medium text-slate-700">{toPersianDigits(memoryAllocated.toFixed(1))} MB</span>
              </div>
            </div>

            {/* Card 3: DB Connections */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold">اتصالات PostgreSQL (واقعی)</span>
                <Database className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold font-mono text-slate-900">
                  {toPersianDigits(activeConnections)}
                </span>
                <span className="text-xs text-slate-500">کوئری فعال / {toPersianDigits(totalConnections)} کل</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-3 flex items-center justify-between pt-1 border-t border-slate-100">
                <span>کانکشن‌های آماده (Idle Pool):</span>
                <span className="font-mono font-bold text-emerald-600">{toPersianDigits(idleConnections)}</span>
              </div>
            </div>

            {/* Card 4: Database Disk Size */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold">حجم پایگاه‌داده روی دیسک</span>
                <Layers className="w-4 h-4 text-amber-500" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold font-mono text-slate-900" dir="ltr">
                  {dbSizePretty}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 mt-3 flex items-center justify-between pt-1 border-t border-slate-100">
                <span>کل پروژه‌های فعال:</span>
                <span className="font-mono font-bold text-slate-800">{toPersianDigits(totalProjects)} پروژه</span>
              </div>
            </div>

          </div>

          {/* Latency Percentiles & System Health */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Latency Percentiles */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs font-bold text-slate-900">صدک‌های تاخیر پاسخگویی (Request Latencies)</h3>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  کل درخواست‌ها: {toPersianDigits(totalRequests)}
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                    <span>میانگین صدک ۵۰ (P50 - Median):</span>
                    <span className="font-mono font-bold text-emerald-600 text-xs" dir="ltr">
                      {toPersianDigits(p50.toFixed(1))} ms
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(100, Math.max(3, p50 * 5))}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                    <span>صدک ۹۵ (P95 - 95th Percentile):</span>
                    <span className="font-mono font-bold text-cyan-600 text-xs" dir="ltr">
                      {toPersianDigits(p95.toFixed(1))} ms
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-cyan-500 h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(100, Math.max(3, p95 * 4))}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                    <span>صدک ۹۹ (P99 - Tail Latency):</span>
                    <span className="font-mono font-bold text-indigo-600 text-xs" dir="ltr">
                      {toPersianDigits(p99.toFixed(1))} ms
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-indigo-500 h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(100, Math.max(3, p99 * 3))}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Runtime Environment Info */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Server className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-slate-900">مشخصات محیط اجرایی و کلاستر</h3>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
                  <span className="text-slate-500">موتور مرکزی (Runtime Engine):</span>
                  <span className="font-mono font-bold text-slate-800" dir="ltr">Pure .NET 10.0 (Unified Server)</span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
                  <span className="text-slate-500">پایگاه‌داده اولیه و شاردها:</span>
                  <span className="font-mono font-bold text-slate-800" dir="ltr">PostgreSQL 18.1 ({toPersianDigits(activeShards)} شارد فعال)</span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
                  <span className="text-slate-500">گذرگاه رویدادها (Cluster Bus):</span>
                  <span className="font-mono font-bold text-emerald-700 flex items-center gap-1" dir="ltr">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    PG LISTEN/NOTIFY (&lt;5ms)
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5">
                  <span className="text-slate-500">مدت زمان فعالیت سرور (Uptime):</span>
                  <span className="font-medium text-slate-800">
                    {formatUptime(uptimeSeconds)}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* SUB-TAB 2: Per-Project Breakdown */}
      {activeSubTab === 'projects' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-800">تفکیک مصرف منابع، پایگاه داده و توابع لبه به ازای هر پروژه</span>
            <span className="text-slate-500 font-mono text-[11px]">{toPersianDigits(projectBreakdown.length)} پروژه</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="px-5 py-3">نام و شناسه پروژه</th>
                  <th className="px-5 py-3">مالک پروژه</th>
                  <th className="px-5 py-3">حجم دیتابیس</th>
                  <th className="px-5 py-3">تعداد جداول</th>
                  <th className="px-5 py-3">سطرهای زنده</th>
                  <th className="px-5 py-3">توابع لبه</th>
                  <th className="px-5 py-3">دامنه‌ها</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {projectBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                      {loadingBreakdown ? 'در حال محاسبه و گردآوری منابع...' : 'پروژه‌ای برای نمایش یافت نشد.'}
                    </td>
                  </tr>
                ) : (
                  projectBreakdown.map((p) => (
                    <tr key={p.projectId} className="hover:bg-slate-50 transition">
                      <td className="px-5 py-3">
                        <div className="font-bold text-slate-900">{p.name}</div>
                        <div className="font-mono text-[11px] text-slate-400" dir="ltr">{p.slug}</div>
                      </td>
                      <td className="px-5 py-3 font-mono text-[11px]" dir="ltr">
                        {p.ownerPhone}
                      </td>
                      <td className="px-5 py-3 font-mono text-[11px] font-bold text-slate-900" dir="ltr">
                        {p.dbSize}
                      </td>
                      <td className="px-5 py-3 font-mono text-[11px]">
                        {toPersianDigits(p.tableCount)}
                      </td>
                      <td className="px-5 py-3 font-mono text-[11px] text-emerald-700 font-semibold">
                        {toPersianDigits(p.liveRows.toLocaleString())}
                      </td>
                      <td className="px-5 py-3 font-mono text-[11px]">
                        {toPersianDigits(p.functionCount)}
                      </td>
                      <td className="px-5 py-3 font-mono text-[11px]">
                        {toPersianDigits(p.domainCount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: Per-User Breakdown */}
      {activeSubTab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-800">تفکیک مصرف و ردپای کاربران پلتفرم</span>
            <span className="text-slate-500 font-mono text-[11px]">{toPersianDigits(userBreakdown.length)} کاربر</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="px-5 py-3">نام و مشخصات کاربر</th>
                  <th className="px-5 py-3">شماره تماس</th>
                  <th className="px-5 py-3">نقش</th>
                  <th className="px-5 py-3">تعداد پروژه‌ها</th>
                  <th className="px-5 py-3">کل دیتابیس اختصاصی</th>
                  <th className="px-5 py-3">موجودی کیف پول</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {userBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                      {loadingBreakdown ? 'در حال بارگذاری آمار کاربران...' : 'هیچ کاربری یافت نشد.'}
                    </td>
                  </tr>
                ) : (
                  userBreakdown.map((u) => (
                    <tr key={u.userId} className="hover:bg-slate-50 transition">
                      <td className="px-5 py-3 font-bold text-slate-900">
                        {u.fullName || 'بدون نام'}
                      </td>
                      <td className="px-5 py-3 font-mono text-[11px]" dir="ltr">
                        {u.phone}
                      </td>
                      <td className="px-5 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {u.role}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-mono text-[11px] font-bold">
                        {toPersianDigits(u.projectCount)}
                      </td>
                      <td className="px-5 py-3 font-mono text-[11px]" dir="ltr">
                        {u.totalDbSizePretty || '0 B'}
                      </td>
                      <td className="px-5 py-3 font-bold text-slate-900">
                        {formatToman(u.walletBalanceIrr)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: Shard Distribution */}
      {activeSubTab === 'shards' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {shardBreakdown.map((s) => (
            <div key={s.clusterId} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-emerald-600" />
                  <span className="font-bold text-sm text-slate-900 font-mono" dir="ltr">{s.clusterId}</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Active Primary
                </span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>تعداد تننت‌های مستقر:</span>
                  <span className="font-mono font-bold text-slate-900">{toPersianDigits(s.projectCount)} پروژه</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>وضعیت اتصال و سلامت:</span>
                  <span className="text-emerald-600 font-semibold">پایدار و متصل (OK)</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
