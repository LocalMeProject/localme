import React, { useState, useEffect } from 'react';
import {
  Database,
  Table as TableIcon,
  Code2,
  Columns,
  Network,
  Plus,
  RefreshCw,
  Search,
  ExternalLink,
  ShieldCheck,
  Zap,
  Copy,
  Check,
  Terminal,
} from 'lucide-react';
import { Project } from '../../types';

interface DatabaseDashboardViewProps {
  project: Project;
  tables: string[];
  isLoadingTables: boolean;
  onRefreshTables: () => void;
  onOpenCreateTableModal: () => void;
  onNavigateToSubView: (subView: string, table?: string) => void;
}

interface TableSummaryItem {
  name: string;
  columnCount: number;
  rowCount: number;
  primaryKey?: string;
}

export const DatabaseDashboardView: React.FC<DatabaseDashboardViewProps> = ({
  project,
  tables,
  isLoadingTables,
  onRefreshTables,
  onOpenCreateTableModal,
  onNavigateToSubView,
}) => {
  const [tableSearch, setTableSearch] = useState('');
  const [tableSummaries, setTableSummaries] = useState<Record<string, TableSummaryItem>>({});
  const [isLoadingSummaries, setIsLoadingSummaries] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [activeSnippetTab, setActiveSnippetTab] = useState<'ts' | 'curl'>('ts');

  // Load summary stats for tables via high-performance consolidated overview endpoint
  useEffect(() => {
    let isMounted = true;
    const fetchSummaries = async () => {
      setIsLoadingSummaries(true);
      try {
        const res = await fetch(`/_baas/v1/${project.slug}/db/tables/overview`);
        if (res.ok) {
          const data = await res.json();
          const results: Record<string, TableSummaryItem> = {};
          if (Array.isArray(data)) {
            for (const item of data) {
              results[item.name] = {
                name: item.name,
                columnCount: item.columnCount ?? 0,
                rowCount: item.estimatedRowCount ?? 0,
                primaryKey: item.primaryKey ?? undefined,
              };
            }
          }
          if (isMounted) {
            setTableSummaries(results);
          }
        }
      } catch {
        // Fallback gracefully
      } finally {
        if (isMounted) {
          setIsLoadingSummaries(false);
        }
      }
    };

    fetchSummaries();
    return () => {
      isMounted = false;
    };
  }, [tables, project.slug]);

  const filteredTables = tables.filter((t) =>
    t.toLowerCase().includes(tableSearch.trim().toLowerCase())
  );

  const totalEstimatedRows = Object.values(tableSummaries).reduce(
    (sum, item) => sum + (item.rowCount || 0),
    0
  );

  const sdkCode =
    activeSnippetTab === 'ts'
      ? `import { createClient } from '@localme/sdk';

const localme = createClient({
  projectSlug: '${project.slug}',
  endpoint: 'https://localme.ir',
});

// دریافت ۱۰ رکورد اول از جدول
const { data, error } = await localme
  .from('${tables[0] || 'records'}')
  .select('*')
  .limit(10);`
      : `curl -X GET "https://localme.ir/_baas/v1/${project.slug}/rest/${tables[0] || 'records'}?limit=10" \\
  -H "Accept: application/json"`;

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(sdkCode);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Welcome / Header Banner */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2.5">
            <Database className="w-5 h-5 text-emerald-600" />
            داشبورد پایگاه داده
          </h1>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed max-w-2xl">
            مدیریت متمرکز جداول رابطه‌ای، مشاهده آمار رکوردها، نظارت بر سلامت درگاه داده و اجرای سریع عملیات ساختاری و پرس‌وجو.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={onRefreshTables}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium text-xs transition"
            title="بازخوانی جداول"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTables || isLoadingSummaries ? 'animate-spin' : ''}`} />
            <span>بازخوانی</span>
          </button>
          <button
            onClick={onOpenCreateTableModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>ایجاد جدول جدید</span>
          </button>
        </div>
      </div>

      {/* Developer KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Tables */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-slate-500">جداول تعریف‌شده</div>
            <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
              {tables.length}
            </div>
            <div className="text-[10px] text-emerald-600 font-medium mt-0.5">آماده و فعال</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <TableIcon className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Total Rows */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-slate-500">مجموع رکوردها (تخمینی)</div>
            <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
              {isLoadingSummaries ? '...' : totalEstimatedRows.toLocaleString('fa-IR')}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">در کل جدول‌های پروژه</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Storage Engine & Isolation */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-slate-500">موتور ذخیره‌سازی</div>
            <div className="text-xs font-bold text-slate-800 font-mono mt-1" dir="ltr">
              PostgreSQL 18.1 Multi-Tenant
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5" dir="ltr">
              prj_{project.slug}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Database className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Security & Health */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-slate-500">امنیت و درگاه داده</div>
            <div className="text-xs font-bold text-emerald-700 mt-1 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              عملیاتی و ایزوله
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">RLS و گاردریل فعال</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Quick Developer Action Shortcuts */}
      <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 space-y-3">
        <div className="text-xs font-bold text-slate-800">دسترسی سریع به ابزارهای دیتابیس</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigateToSubView('grid')}
            className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-emerald-500 hover:shadow-xs transition text-right flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 transition">
                جداول و داده‌ها
              </span>
              <TableIcon className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-[11px] text-slate-500">مشاهده گرید داده، فیلتر، صفحه‌بندی و ثبت رکورد</p>
          </button>

          <button
            onClick={() => onNavigateToSubView('sql')}
            className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-emerald-500 hover:shadow-xs transition text-right flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 transition">
                ویرایشگر کوئری SQL
              </span>
              <Code2 className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-[11px] text-slate-500">اجرای مستقیم کوئری‌های استاندارد با خروجی CSV/JSON</p>
          </button>

          <button
            onClick={() => onNavigateToSubView('schema')}
            className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-emerald-500 hover:shadow-xs transition text-right flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 transition">
                طراحی ساختار (Schema)
              </span>
              <Columns className="w-4 h-4 text-purple-600" />
            </div>
            <p className="text-[11px] text-slate-500">تعریف ستون‌ها، انواع داده، روابط و قواعد RLS</p>
          </button>

          <button
            onClick={() => onNavigateToSubView('diagram')}
            className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-emerald-500 hover:shadow-xs transition text-right flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 transition">
                نمودار ارتباطی (ER)
              </span>
              <Network className="w-4 h-4 text-indigo-600" />
            </div>
            <p className="text-[11px] text-slate-500">مشاهده گراف روابط و کلیدهای خارجی میان جداول</p>
          </button>
        </div>
      </div>

      {/* Central Tables Overview Section */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs space-y-0">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <TableIcon className="w-4 h-4 text-emerald-600" />
              فهرست جداول پایگاه داده ({tables.length})
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              برای مشاهده داده‌ها یا ویرایش ساختار، روی هر جدول کلیک کنید.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder="جستجو در نام جداول..."
              className="w-full pl-3 pr-8 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs" dir="rtl">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                <th className="py-2.5 px-4 text-right">نام جدول</th>
                <th className="py-2.5 px-4 text-center">کلید اصلی</th>
                <th className="py-2.5 px-4 text-center">تعداد ستون‌ها</th>
                <th className="py-2.5 px-4 text-center">تعداد رکوردها</th>
                <th className="py-2.5 px-4 text-center">عملیات سریع</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tables.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <div className="space-y-2">
                      <p>هنوز جدولی در این پروژه تعریف نشده است.</p>
                      <button
                        onClick={onOpenCreateTableModal}
                        className="text-xs text-emerald-700 hover:underline font-semibold"
                      >
                        + ساخت اولین جدول پروژه
                      </button>
                    </div>
                  </td>
                </tr>
              ) : filteredTables.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    هیچ جدولی مطابق با عبارت جستجو یافت نشد.
                  </td>
                </tr>
              ) : (
                filteredTables.map((tbl) => {
                  const summary = tableSummaries[tbl];
                  return (
                    <tr
                      key={tbl}
                      className="hover:bg-slate-50/80 transition cursor-pointer"
                      onClick={() => onNavigateToSubView('grid', tbl)}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <TableIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="font-mono font-bold text-slate-900" dir="ltr">
                            {tbl}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-mono text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded" dir="ltr">
                          {summary?.primaryKey || 'id'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-slate-600">
                        {summary ? `${summary.columnCount} ستون` : '-'}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-slate-800 font-semibold">
                        {summary ? summary.rowCount.toLocaleString('fa-IR') : '-'}
                      </td>
                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onNavigateToSubView('grid', tbl)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-medium transition"
                            title="مشاهده داده‌ها"
                          >
                            <span>داده‌ها</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => onNavigateToSubView('schema', tbl)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition"
                            title="طراحی ساختار"
                          >
                            <span>ساختار</span>
                          </button>
                          <button
                            onClick={() => onNavigateToSubView('sql', tbl)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition"
                            title="اجرای کوئری SQL"
                          >
                            <span>کوئری</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Developer Gateway & SDK Connection Panel */}
      <div className="p-5 rounded-xl bg-slate-900 text-slate-200 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-white">اتصال و استفاده در کدهای برنامه (SDK / REST)</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-slate-800 rounded-lg p-0.5 flex items-center text-xs">
              <button
                onClick={() => setActiveSnippetTab('ts')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                  activeSnippetTab === 'ts' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                TypeScript / Node.js
              </button>
              <button
                onClick={() => setActiveSnippetTab('curl')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                  activeSnippetTab === 'curl' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                cURL / HTTP REST
              </button>
            </div>

            <button
              onClick={handleCopySnippet}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
              title="کپی قطعه کد"
            >
              {copiedSnippet ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 text-[11px]">کپی شد</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="text-[11px]">کپی</span>
                </>
              )}
            </button>
          </div>
        </div>

        <pre className="p-3 bg-slate-950 rounded-lg text-emerald-400 font-mono text-xs overflow-x-auto leading-relaxed" dir="ltr">
          {sdkCode}
        </pre>
      </div>
    </div>
  );
};
