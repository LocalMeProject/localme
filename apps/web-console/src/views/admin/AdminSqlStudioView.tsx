import { useState, useEffect } from 'react';
import { 
  Terminal, 
  Database, 
  Play, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Wrench, 
  Lock, 
  Table, 
  Clock 
} from 'lucide-react';
import { api } from '../../utils/apiClient';
import { toPersianDigits } from '../../utils/persian';

interface TableStat {
  schema: string;
  tableName: string;
  liveRows: number;
  deadRows: number;
  dataSize: string;
  indexSize: string;
  totalSize: string;
}

interface LockInfo {
  pid: number;
  lockType: string;
  mode: string;
  granted: boolean;
  relation: string;
  query: string;
}

interface QueryResult {
  columns: string[];
  rows: any[];
  rowCount: number;
  executionTimeMs: number;
}

export function AdminSqlStudioView() {
  const [activeSubTab, setActiveSubTab] = useState<'console' | 'tables' | 'maintenance' | 'locks'>('console');

  // Console State
  const [query, setQuery] = useState<string>('SELECT current_database(), current_user, version();');
  const [targetSchema, setTargetSchema] = useState<string>('public');
  const [targetShardId, setTargetShardId] = useState<string>('shard-a');
  const [shards, setShards] = useState<{ id: string; name: string }[]>([]);
  const [availableSchemas, setAvailableSchemas] = useState<string[]>(['public']);
  const [executing, setExecuting] = useState(false);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);

  // Tables State
  const [tables, setTables] = useState<TableStat[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [tablesFilter, setTablesFilter] = useState('');

  // Maintenance State
  const [maintOperation, setMaintOperation] = useState<'VACUUM ANALYZE' | 'REINDEX'>('VACUUM ANALYZE');
  const [maintTarget, setMaintTarget] = useState<string>('');
  const [maintRunning, setMaintRunning] = useState(false);
  const [maintFeedback, setMaintFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  // Locks State
  const [locks, setLocks] = useState<LockInfo[]>([]);
  const [loadingLocks, setLoadingLocks] = useState(false);

  // Load tables when switching to tables or maintenance tab
  const fetchTables = async () => {
    setLoadingTables(true);
    try {
      const res = await api.get('/_baas/v1/admin/db/tables');
      if (Array.isArray(res)) {
        setTables(res);
      }
    } catch (err: any) {
      console.error('Failed to load table stats', err);
    } finally {
      setLoadingTables(false);
    }
  };

  const fetchLocks = async () => {
    setLoadingLocks(true);
    try {
      const res = await api.get('/_baas/v1/admin/db/locks');
      if (Array.isArray(res)) {
        setLocks(res);
      }
    } catch (err: any) {
      console.error('Failed to load locks', err);
    } finally {
      setLoadingLocks(false);
    }
  };

  useEffect(() => {
    // Load shards and available schemas for the SQL console
    api.get('/_baas/v1/admin/shards').then((res) => {
      if (Array.isArray(res) && res.length > 0) {
        setShards(res);
        setTargetShardId(res[0].id);
      }
    }).catch(() => {});

    api.get('/_baas/v1/admin/db/schemas').then((res) => {
      if (Array.isArray(res) && res.length > 0) {
        setAvailableSchemas(res);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (activeSubTab === 'tables' || activeSubTab === 'maintenance') {
      fetchTables();
    } else if (activeSubTab === 'locks') {
      fetchLocks();
    }
  }, [activeSubTab]);

  const handleRunQuery = async () => {
    if (!query.trim()) return;
    setExecuting(true);
    setQueryError(null);
    setQueryResult(null);

    try {
      const res = await api.post('/_baas/v1/admin/db/query', {
        sql: query,
        targetSchema: targetSchema || 'public',
        shardId: targetShardId || undefined,
        limit: 100
      });

      if (res.success) {
        setQueryResult({
          columns: res.columns || [],
          rows: res.rows || [],
          rowCount: res.rowCount || 0,
          executionTimeMs: res.executionTimeMs || 0
        });
      } else {
        setQueryError(res.error || 'خطا در اجرای کوئری');
      }
    } catch (err: any) {
      setQueryError(err.message || 'خطا در برقراری ارتباط با دیتابیس');
    } finally {
      setExecuting(false);
    }
  };

  const handleRunMaintenance = async () => {
    setMaintRunning(true);
    setMaintFeedback(null);
    try {
      const res = await api.post('/_baas/v1/admin/db/maintenance', {
        operation: maintOperation,
        tableName: maintTarget.trim() ? maintTarget.trim() : null
      });

      if (res.success) {
        setMaintFeedback({ ok: true, message: res.message || 'عملیات با موفقیت پایان یافت.' });
        fetchTables();
      } else {
        setMaintFeedback({ ok: false, message: res.error || 'خطا در اجرای عملیات نگهداری.' });
      }
    } catch (err: any) {
      setMaintFeedback({ ok: false, message: err.message || 'خطا در اجرای عملیات.' });
    } finally {
      setMaintRunning(false);
    }
  };

  const filteredTables = tables.filter(t => 
    !tablesFilter.trim() || 
    t.tableName.toLowerCase().includes(tablesFilter.toLowerCase()) ||
    t.schema.toLowerCase().includes(tablesFilter.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Database className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">استودیو و کنسول نگهداری PostgreSQL کلاستر</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
              Root Level
            </span>
          </div>
          <p className="text-xs text-slate-500">
            اجرای کوئری‌های عمیق SQL روی تمام اسکیمای تننت‌ها، آنالیز بلات و اندازه جداول، اجرای VACUUM/REINDEX و نظارت بر قفل‌ها.
          </p>
        </div>

        {/* Sub-tab pills */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-medium">
          <button
            onClick={() => setActiveSubTab('console')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
              activeSubTab === 'console' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>کنسول SQL</span>
          </button>
          <button
            onClick={() => setActiveSubTab('tables')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
              activeSubTab === 'tables' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>آمار جداول ({toPersianDigits(tables.length)})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('maintenance')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
              activeSubTab === 'maintenance' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>نگهداری و بهینه‌سازی</span>
          </button>
          <button
            onClick={() => setActiveSubTab('locks')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
              activeSubTab === 'locks' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>قفل‌های فعال</span>
          </button>
        </div>
      </div>

      {/* TAB 1: SQL Console */}
      {activeSubTab === 'console' && (
        <div className="space-y-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-800 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                {/* Shard Selector */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-medium">شارد:</span>
                  <select
                    value={targetShardId}
                    onChange={(e) => setTargetShardId(e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-emerald-400 px-2.5 py-1 rounded-lg text-xs font-mono focus:outline-hidden focus:border-emerald-500"
                    dir="ltr"
                  >
                    {shards.length > 0 ? (
                      shards.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.id})
                        </option>
                      ))
                    ) : (
                      <option value="shard-a">shard-a (Default)</option>
                    )}
                  </select>
                </div>

                {/* Schema Selector */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-medium">اسکیما:</span>
                  <select
                    value={targetSchema}
                    onChange={(e) => setTargetSchema(e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-slate-200 px-2.5 py-1 rounded-lg text-xs font-mono focus:outline-hidden focus:border-emerald-500"
                    dir="ltr"
                  >
                    {availableSchemas.map((sch) => (
                      <option key={sch} value={sch}>
                        {sch}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-[11px] hidden sm:inline">اجرا با Ctrl+Enter</span>
                <button
                  onClick={handleRunQuery}
                  disabled={executing || !query.trim()}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition disabled:opacity-50"
                >
                  <Play className={`w-3.5 h-3.5 ${executing ? 'animate-spin' : ''}`} />
                  <span>{executing ? 'در حال اجرا...' : 'اجرای کوئری'}</span>
                </button>
              </div>
            </div>

            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleRunQuery();
                }
              }}
              rows={5}
              placeholder="دستورات SQL دلخواه را وارد کنید..."
              className="w-full bg-transparent text-emerald-400 font-mono text-xs focus:outline-hidden resize-y leading-relaxed"
              dir="ltr"
            />
          </div>

          {/* Query Error */}
          {queryError && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="font-mono text-[11px] leading-relaxed break-all" dir="ltr">
                {queryError}
              </div>
            </div>
          )}

          {/* Query Results */}
          {queryResult && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-slate-800">نتایج کوئری</span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[11px] font-mono">
                    {toPersianDigits(queryResult.rowCount)} سطر
                  </span>
                </div>
                <div className="flex items-center gap-1 text-slate-500 text-[11px] font-mono" dir="ltr">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{queryResult.executionTimeMs} ms</span>
                </div>
              </div>

              {queryResult.columns.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  دستور با موفقیت اجرا شد (هیچ سطری بازگردانده نشد).
                </div>
              ) : (
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-right text-xs" dir="ltr">
                    <thead className="bg-slate-100 text-slate-700 font-mono text-[11px] border-b border-slate-200 sticky top-0">
                      <tr>
                        {queryResult.columns.map((col) => (
                          <th key={col} className="px-4 py-2 font-semibold">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px] text-slate-800">
                      {queryResult.rows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition">
                          {queryResult.columns.map((col) => {
                            const val = row[col];
                            return (
                              <td key={col} className="px-4 py-2 text-slate-700 whitespace-nowrap">
                                {val === null || val === undefined ? (
                                  <span className="text-slate-400 italic">NULL</span>
                                ) : typeof val === 'object' ? (
                                  JSON.stringify(val)
                                ) : (
                                  String(val)
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Table Stats & Bloat */}
      {activeSubTab === 'tables' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
            <input
              type="text"
              value={tablesFilter}
              onChange={(e) => setTablesFilter(e.target.value)}
              placeholder="جستجو در نام جداول یا اسکیما..."
              className="bg-slate-50 border border-slate-200 text-slate-800 text-xs px-3 py-2 rounded-lg w-72 focus:outline-hidden focus:border-emerald-500"
            />
            <button
              onClick={fetchTables}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingTables ? 'animate-spin text-emerald-600' : ''}`} />
              <span>تازه سازی</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="px-5 py-3">اسکیما</th>
                    <th className="px-5 py-3">نام جدول</th>
                    <th className="px-5 py-3">سطرهای زنده</th>
                    <th className="px-5 py-3">سطرهای مرده (Bloat)</th>
                    <th className="px-5 py-3">حجم داده</th>
                    <th className="px-5 py-3">حجم ایندکس</th>
                    <th className="px-5 py-3">حجم کل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredTables.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                        {loadingTables ? 'در حال بارگذاری جداول...' : 'هیچ جدولی یافت نشد.'}
                      </td>
                    </tr>
                  ) : (
                    filteredTables.map((t, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition">
                        <td className="px-5 py-3 font-mono text-[11px] text-slate-500" dir="ltr">{t.schema}</td>
                        <td className="px-5 py-3 font-mono text-[11px] font-bold text-slate-900" dir="ltr">{t.tableName}</td>
                        <td className="px-5 py-3 font-mono text-[11px]">{toPersianDigits(t.liveRows.toLocaleString())}</td>
                        <td className="px-5 py-3 font-mono text-[11px]">
                          <span className={t.deadRows > 100 ? 'text-amber-600 font-semibold' : 'text-slate-500'}>
                            {toPersianDigits(t.deadRows.toLocaleString())}
                          </span>
                        </td>
                        <td className="px-5 py-3 font-mono text-[11px]" dir="ltr">{t.dataSize}</td>
                        <td className="px-5 py-3 font-mono text-[11px]" dir="ltr">{t.indexSize}</td>
                        <td className="px-5 py-3 font-mono text-[11px] font-bold text-slate-900" dir="ltr">{t.totalSize}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Maintenance & Vacuum */}
      {activeSubTab === 'maintenance' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6 max-w-2xl">
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">اجرای عملیات نگهداری پایگاه داده</h3>
            <p className="text-xs text-slate-500">
              پاک‌سازی فضاهای مرده (Dead Tuples)، به‌روزرسانی آمار پلنر و بازسازی ایندکس‌ها جهت افزایش سرعت کوئری‌ها.
            </p>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1.5">نوع عملیات:</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMaintOperation('VACUUM ANALYZE')}
                  className={`p-3 rounded-xl border text-right transition ${
                    maintOperation === 'VACUUM ANALYZE'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="font-mono text-xs">VACUUM ANALYZE</div>
                  <div className="text-[11px] text-slate-500 font-normal mt-0.5">آزادسازی فضای مرده و بازسازی آماری</div>
                </button>
                <button
                  type="button"
                  onClick={() => setMaintOperation('REINDEX')}
                  className={`p-3 rounded-xl border text-right transition ${
                    maintOperation === 'REINDEX'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="font-mono text-xs">REINDEX</div>
                  <div className="text-[11px] text-slate-500 font-normal mt-0.5">بازسازی ساختار ایندکس‌های خراب یا متورم</div>
                </button>
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1.5">جدول هدف (اختیاری):</label>
              <input
                type="text"
                value={maintTarget}
                onChange={(e) => setMaintTarget(e.target.value)}
                placeholder="خالی بگذارید تا کل دیتابیس پردازش شود یا نام جدول (مثلاً platform_users)"
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs px-3.5 py-2.5 rounded-xl focus:outline-hidden focus:border-emerald-500 font-mono"
                dir="ltr"
              />
            </div>

            {maintFeedback && (
              <div className={`p-4 rounded-xl text-xs flex items-center gap-2 ${
                maintFeedback.ok ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-800'
              }`}>
                {maintFeedback.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
                <span>{maintFeedback.message}</span>
              </div>
            )}

            <button
              onClick={handleRunMaintenance}
              disabled={maintRunning}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Wrench className={`w-4 h-4 ${maintRunning ? 'animate-spin' : ''}`} />
              <span>{maintRunning ? 'در حال اجرای عملیات نگهداری...' : `شروع عملیات ${maintOperation}`}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: Locks Monitor */}
      {activeSubTab === 'locks' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
            <span className="text-xs text-slate-600">
              نمایش قفل‌های اختصاصی و تراکنش‌های در انتظار تایید در pg_locks
            </span>
            <button
              onClick={fetchLocks}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingLocks ? 'animate-spin text-emerald-600' : ''}`} />
              <span>تازه سازی</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="px-5 py-3">PID</th>
                    <th className="px-5 py-3">رابطه / جدول</th>
                    <th className="px-5 py-3">نوع قفل</th>
                    <th className="px-5 py-3">حالت (Mode)</th>
                    <th className="px-5 py-3">وضعیت اعطا</th>
                    <th className="px-5 py-3">کوئری</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {locks.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                        {loadingLocks ? 'در حال دریافت اطلاعات قفل‌ها...' : 'هیچ قفل رقابتی یا منتظر در کلاستر وجود ندارد.'}
                      </td>
                    </tr>
                  ) : (
                    locks.map((l, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition">
                        <td className="px-5 py-3 font-mono text-[11px] font-bold">{toPersianDigits(l.pid)}</td>
                        <td className="px-5 py-3 font-mono text-[11px] text-slate-800" dir="ltr">{l.relation}</td>
                        <td className="px-5 py-3 font-mono text-[11px]">{l.lockType}</td>
                        <td className="px-5 py-3 font-mono text-[11px]">{l.mode}</td>
                        <td className="px-5 py-3 font-mono text-[11px]">
                          {l.granted ? (
                            <span className="text-emerald-600 font-semibold">تخصیص‌یافته (Granted)</span>
                          ) : (
                            <span className="text-rose-600 font-bold animate-pulse">در انتظار (Waiting)</span>
                          )}
                        </td>
                        <td className="px-5 py-3 font-mono text-[11px] text-slate-600 max-w-xs truncate" dir="ltr">{l.query}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
