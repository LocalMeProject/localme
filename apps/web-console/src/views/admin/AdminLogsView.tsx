import { useState, useEffect } from 'react';
import { 
  FileText, 
  Search, 
  Trash2, 
  RefreshCw, 
  AlertTriangle, 
  Info, 
  AlertCircle,
  Download,
  Copy,
  Check,
  Pause,
  Play
} from 'lucide-react';
import { api } from '../../utils/apiClient';
import { toPersianDigits } from '../../utils/persian';

interface LogEntry {
  id?: string;
  timestampUtc?: string;
  logLevel?: string;
  level?: string;
  category?: string;
  message?: string;
  exception?: string;
}

export function AdminLogsView() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [clearing, setClearing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchLogs = async (isManual = false) => {
    if (isManual) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (levelFilter !== 'ALL') params.set('level', levelFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      params.set('limit', '200');

      const data = await api.get(`/_baas/v1/admin/logs?${params.toString()}`);
      if (Array.isArray(data)) {
        setLogs(data);
      }
    } catch (err) {
      console.error('Failed to load logs', err);
    } finally {
      if (isManual) setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(true);
  }, [levelFilter]);

  // 3-second polling
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchLogs(false);
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, levelFilter, searchQuery]);

  const handleClearLogs = async () => {
    if (!window.confirm('آیا از پاک‌سازی بافر رویدادهای سیستمی اطمینان دارید؟')) return;
    setClearing(true);
    try {
      await api.delete('/_baas/v1/admin/logs');
      setLogs([]);
    } catch (err: any) {
      alert(`خطا در پاک‌سازی لاگ‌ها: ${err.message}`);
    } finally {
      setClearing(false);
    }
  };

  const handleExportLogs = async () => {
    try {
      const allLogs = await api.get('/_baas/v1/admin/logs/export');
      const blob = new Blob([JSON.stringify(allLogs, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `localme-platform-logs-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`خطا در دریافت خروجی لاگ‌ها: ${err.message}`);
    }
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getLevelBadge = (rawLevel?: string) => {
    const upper = (rawLevel || 'INFO').toUpperCase();
    if (upper === 'ERROR' || upper === 'CRITICAL') {
      return { label: upper, bg: 'bg-rose-500/20 text-rose-300 border-rose-500/30', icon: AlertCircle };
    }
    if (upper === 'WARNING' || upper === 'WARN') {
      return { label: upper, bg: 'bg-amber-500/20 text-amber-300 border-amber-500/30', icon: AlertTriangle };
    }
    if (upper === 'DEBUG' || upper === 'TRACE') {
      return { label: upper, bg: 'bg-slate-500/20 text-slate-400 border-slate-500/30', icon: Info };
    }
    return { label: upper, bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', icon: Info };
  };

  const formatLogTime = (timestamp?: string) => {
    if (!timestamp) return '--:--:--';
    try {
      const d = new Date(timestamp);
      return d.toLocaleTimeString('fa-IR', { hour12: false });
    } catch {
      return '--:--:--';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">لاگ‌ها و رویدادهای زنده سیستم (System Logs)</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
              {toPersianDigits(logs.length)} رویداد
            </span>
          </div>
          <p className="text-xs text-slate-500">
            بافر بلادرنگ پردازش‌های هسته سرور .NET 10، نشست‌های احراز هویت، پیام‌های کلاستر باس و هشدارهای امنیتی.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition ${
              autoRefresh
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
            }`}
          >
            {autoRefresh ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>توقف جریان زنده</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>شروع جریان زنده (۳ث)</span>
              </>
            )}
          </button>

          <button
            onClick={() => fetchLogs(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition"
            title="تازه سازی دستی"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>تازه سازی</span>
          </button>

          <button
            onClick={handleExportLogs}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition"
            title="دانلود خروجی JSON"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>خروجی لاگ‌ها</span>
          </button>

          <button
            onClick={handleClearLogs}
            disabled={clearing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium border border-rose-200 transition disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>پاک‌سازی بافر</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">سطح رخداد:</span>
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">همه سطوح (All)</option>
            <option value="DEBUG">اشکال‌زدایی (Debug)</option>
            <option value="INFO">اطلاعات (Information)</option>
            <option value="WARNING">هشدارها (Warning)</option>
            <option value="ERROR">خطاها و کریتیکال (Error)</option>
          </select>
        </div>

        <div className="relative flex-1 min-w-[240px]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchLogs(true)}
            placeholder="جستجو در پیام، شناسه، یا دسته‌بندی لاگ (Enter)..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-8 pl-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2 pointer-events-none" />
        </div>
      </div>

      {/* Logs Terminal Viewer */}
      {loading && logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <RefreshCw className="w-6 h-6 animate-spin text-emerald-600 mb-2" />
          <span className="text-xs text-slate-500">در حال دریافت بافر لاگ‌های سرور...</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700 mb-1">هیچ لاگی با فیلتر کنونی ثبت نشده است</h3>
          <p className="text-xs text-slate-400">رویدادهای جدید بلافاصله پس از ثبت در سرور در این بخش نمایان می‌شوند.</p>
        </div>
      ) : (
        <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4 shadow-2xl font-mono text-xs text-slate-200 space-y-2 max-h-[640px] overflow-y-auto" dir="ltr">
          {logs.map((log, idx) => {
            const rawLevel = log.logLevel || log.level || 'INFO';
            const badge = getLevelBadge(rawLevel);
            const entryId = log.id || `log-${idx}`;

            return (
              <div
                key={entryId}
                className="group p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 hover:bg-slate-900 hover:border-slate-700 transition"
              >
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] text-slate-400 font-semibold" dir="rtl">
                      {formatLogTime(log.timestampUtc)}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.bg}`}>
                      {badge.label}
                    </span>
                    <span className="text-[11px] text-cyan-400/90 font-medium">
                      [{log.category || 'General'}]
                    </span>
                  </div>

                  <button
                    onClick={() => handleCopyMessage(entryId, log.message || '')}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
                    title="کپی متن پیام"
                  >
                    {copiedId === entryId ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                <div className="text-slate-100 text-[11px] leading-relaxed break-all whitespace-pre-wrap">
                  {log.message}
                </div>

                {log.exception && (
                  <pre className="mt-2.5 p-2.5 bg-slate-950 rounded-lg border border-rose-900/40 text-[10px] text-rose-300 overflow-x-auto whitespace-pre-wrap">
                    {log.exception}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
