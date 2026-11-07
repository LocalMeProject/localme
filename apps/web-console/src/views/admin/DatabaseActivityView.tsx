import { useState, useEffect } from 'react';
import { 
  Activity, 
  RefreshCw, 
  Power, 
  Clock, 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  Pause, 
  Play 
} from 'lucide-react';
import { api } from '../../utils/apiClient';
import { toPersianDigits } from '../../utils/persian';

interface DbActivityItem {
  pid: number;
  user: string;
  clientIp: string;
  state: string;
  durationSeconds: number;
  query: string;
  waitEventType?: string;
  waitEvent?: string;
}

export function DatabaseActivityView() {
  const [activities, setActivities] = useState<DbActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('ALL');
  const [terminatingPid, setTerminatingPid] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const fetchActivities = async (isManual = false) => {
    if (isManual) setLoading(true);
    try {
      const data = await api.get('/_baas/v1/admin/db/activity');
      if (Array.isArray(data)) {
        setActivities(data);
      }
    } catch (err) {
      console.error('Failed to load database activity', err);
    } finally {
      if (isManual) setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities(true);
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchActivities(false);
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const handleTerminateQuery = async (pid: number) => {
    if (!window.confirm(`آیا از توقف اجباری پردازش پایگاه‌داده (PID: ${pid}) اطمینان دارید؟`)) return;

    setTerminatingPid(pid);
    setFeedback(null);
    try {
      const res = await api.post('/_baas/v1/admin/db/terminate', { pid });
      setFeedback({
        ok: true,
        message: res.message || `پردازش پایگاه‌داده (PID: ${pid}) متوقف شد.`,
      });
      await fetchActivities(false);
    } catch (err: any) {
      setFeedback({
        ok: false,
        message: err.message || `خطا در توقف پردازش ${pid}.`,
      });
    } finally {
      setTerminatingPid(null);
    }
  };

  const filtered = activities.filter((item) => {
    if (stateFilter !== 'ALL' && item.state.toLowerCase() !== stateFilter.toLowerCase()) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.query.toLowerCase().includes(q) ||
        item.user.toLowerCase().includes(q) ||
        item.clientIp.toLowerCase().includes(q) ||
        String(item.pid).includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">پایش نشست‌ها و کوئری‌های فعال PostgreSQL</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
              {toPersianDigits(activities.length)} نشست
            </span>
          </div>
          <p className="text-xs text-slate-500">
            بررسی کوئری‌های در حال اجرا (pg_stat_activity)، ردیابی کندی‌ها و قفل‌ها، و توقف اجباری پردازش‌های سنگین.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
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
                <span>توقف جریان خودکار</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>شروع جریان (۳ث)</span>
              </>
            )}
          </button>

          <button
            onClick={() => fetchActivities(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
            <span>تازه سازی</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center gap-2.5 animate-in fade-in ${
            feedback.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {feedback.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">وضعیت نشست:</span>
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">همه نشست‌ها</option>
            <option value="active">در حال اجرای کوئری (Active)</option>
            <option value="idle">آماده در استخر (Idle)</option>
            <option value="idle in transaction">در انتظار تراکنش</option>
          </select>
        </div>

        <div className="relative flex-1 min-w-[240px]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجو در متن SQL، کاربر، آدرس IP یا PID..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-8 pl-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2 pointer-events-none" />
        </div>
      </div>

      {/* Table / List */}
      {loading && activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <RefreshCw className="w-6 h-6 animate-spin text-emerald-600 mb-2" />
          <span className="text-xs text-slate-500">در حال دریافت نشست‌های فعال پایگاه‌داده...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700 mb-1">هیچ کوئری فعال یا مسدودکننده‌ای یافت نشد</h3>
          <p className="text-xs text-slate-400">تمام کانکشن‌های پایگاه‌داده در وضعیت سالم یا آماده‌باش (Idle) قرار دارند.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">PID</th>
                  <th className="p-3.5">وضعیت</th>
                  <th className="p-3.5">کاربر و مبدا</th>
                  <th className="p-3.5">مدت زمان اجرا</th>
                  <th className="p-3.5 min-w-[280px]">دستور SQL</th>
                  <th className="p-3.5">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((item) => (
                  <tr key={item.pid} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5 font-mono font-bold text-slate-900" dir="ltr">
                      {item.pid}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          item.state === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : item.state.includes('transaction')
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {item.state}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="font-semibold text-slate-800">{item.user}</div>
                      <div className="font-mono text-[10px] text-slate-400" dir="ltr">{item.clientIp}</div>
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-1 font-mono font-bold text-slate-800" dir="ltr">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{toPersianDigits(item.durationSeconds.toFixed(2))} s</span>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-mono text-[11px] text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-200 max-h-24 overflow-y-auto break-all whitespace-pre-wrap" dir="ltr">
                        {item.query || '---'}
                      </div>
                      {item.waitEvent && (
                        <div className="text-[10px] text-amber-600 mt-1">
                          در انتظار رویداد: <span className="font-mono">{item.waitEventType} ({item.waitEvent})</span>
                        </div>
                      )}
                    </td>
                    <td className="p-3.5">
                      <button
                        onClick={() => handleTerminateQuery(item.pid)}
                        disabled={terminatingPid === item.pid}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200 transition disabled:opacity-50"
                        title="توقف اجباری پردازش"
                      >
                        {terminatingPid === item.pid ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Power className="w-3.5 h-3.5" />
                        )}
                        <span>خاتمه</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
