import { useState, useEffect } from 'react';
import { 
  FileText, 
  Search, 
  Trash2, 
  RefreshCw, 
  AlertTriangle, 
  Info, 
  AlertCircle 
} from 'lucide-react';
import { api } from '../../utils/apiClient';

interface LogEntry {
  timestampUtc: string;
  level: string;
  category: string;
  message: string;
  exception?: string;
}

export function AdminLogsView() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [clearing, setClearing] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (levelFilter !== 'ALL') params.set('level', levelFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      params.set('limit', '100');

      const data = await api.get(`/_baas/v1/admin/logs?${params.toString()}`);
      if (Array.isArray(data)) {
        setLogs(data);
      }
    } catch (err) {
      console.error('Failed to load logs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [levelFilter]);

  const handleClearLogs = async () => {
    if (!window.confirm('آیا از پاک‌سازی بافر لاگ‌های سیستمی اطمینان دارید؟')) return;
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

  const getLevelBadge = (level: string) => {
    const upper = level.toUpperCase();
    if (upper === 'ERROR' || upper === 'CRITICAL') {
      return { bg: 'bg-rose-50 text-rose-700 border-rose-200', icon: AlertCircle };
    }
    if (upper === 'WARNING' || upper === 'WARN') {
      return { bg: 'bg-amber-50 text-amber-700 border-amber-200', icon: AlertTriangle };
    }
    return { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: Info };
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">لاگ‌ها و رویدادهای زنده سیستم (System Logs)</h2>
          </div>
          <p className="text-xs text-slate-500">
            بافر بلادرنگ رویدادهای کلان سرور، خطاهای احراز هویت، پیام‌های کلاستر باس و هشدارهای امنیتی.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchLogs}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>تازه سازی</span>
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
          <span className="text-xs text-slate-500 font-medium">سطح لاگ:</span>
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">همه سطوح</option>
            <option value="INFO">اطلاعات (Information)</option>
            <option value="WARNING">هشدار (Warning)</option>
            <option value="ERROR">خطا (Error)</option>
          </select>
        </div>

        <div className="relative flex-1 min-w-[200px]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchLogs()}
            placeholder="جستجو در پیام لاگ و دسته بندی (Enter)..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-8 pl-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2 pointer-events-none" />
        </div>
      </div>

      {/* Logs Viewer */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <RefreshCw className="w-6 h-6 animate-spin text-emerald-600 mb-2" />
          <span className="text-xs text-slate-500">در حال دریافت لاگ‌های سیستم...</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700 mb-1">هیچ رویدادی ثبت نشده است</h3>
        </div>
      ) : (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 shadow-xl font-mono text-xs text-slate-200 space-y-2 max-h-[600px] overflow-y-auto" dir="ltr">
          {logs.map((log, idx) => {
            const badge = getLevelBadge(log.level);
            return (
              <div key={idx} className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50 hover:bg-slate-800 transition">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-[11px] text-slate-400">
                    {new Date(log.timestampUtc).toLocaleTimeString()}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.bg}`}>
                    {log.level}
                  </span>
                  <span className="text-[11px] text-slate-400 font-semibold">
                    [{log.category}]
                  </span>
                </div>
                <div className="text-slate-100 text-[11px] leading-relaxed break-all">
                  {log.message}
                </div>
                {log.exception && (
                  <pre className="mt-2 p-2 bg-slate-950/80 rounded text-[10px] text-rose-300 overflow-x-auto whitespace-pre-wrap">
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
