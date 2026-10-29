import React, { useState } from 'react';
import { Project, DatabaseTable, DatabaseColumn } from '../types';
import {
  Database,
  Play,
  Table as TableIcon,
  Clock,
  Layers,
} from 'lucide-react';

interface DatabaseViewProps {
  project: Project;
  onOpenCreateTableModal: () => void;
}

const INITIAL_TABLES: DatabaseTable[] = [];

const INITIAL_COLUMNS: Record<string, DatabaseColumn[]> = {};

const INITIAL_DATA_ROWS: Record<string, any[]> = {};

export const DatabaseView: React.FC<DatabaseViewProps> = ({ project, onOpenCreateTableModal }) => {
  const [tables] = useState<DatabaseTable[]>(INITIAL_TABLES);
  const [activeTable, setActiveTable] = useState<string>('');
  const [sqlQuery, setSqlQuery] = useState<string>('');
  const [queryResults, setQueryResults] = useState<{ columns: string[]; rows: Record<string, unknown>[]; latencyMs: number } | null>(null);
  const [isRunningQuery, setIsRunningQuery] = useState(false);

  const handleRunQuery = () => {
    setIsRunningQuery(true);
    const start = performance.now();

    setTimeout(() => {
      const rows = INITIAL_DATA_ROWS[activeTable] || [];
      const columns = rows.length > 0 ? Object.keys(rows[0] || {}) : [];
      const latency = Math.round(performance.now() - start) + 2;

      setQueryResults({
        columns,
        rows,
        latencyMs: latency,
      });
      setIsRunningQuery(false);
    }, 100);
  };

  const handleApplySnippet = (type: string) => {
    switch (type) {
      case 'select':
        setSqlQuery(`SELECT * FROM ${activeTable} ORDER BY id DESC LIMIT 50;`);
        break;
      case 'insert':
        setSqlQuery(`INSERT INTO ${activeTable} (title, price_irr, category) VALUES ('محصول جدید', 25000000, 'سرویس');`);
        break;
      case 'create':
        setSqlQuery(`CREATE TABLE IF NOT EXISTS audit_logs (\n  id BIGSERIAL PRIMARY KEY,\n  action VARCHAR(64) NOT NULL,\n  created_at TIMESTAMPTZ DEFAULT NOW()\n);`);
        break;
    }
  };

  const currentColumns = INITIAL_COLUMNS[activeTable] || [];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <Database className="w-5 h-5 text-amber-400" />
            پایگاه داده رابطه‌ای پروژه (PostgreSQL 18.1 Schema-Per-Tenant)
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            دسترسی مستقیم RESTful از طریق Dynamic SQL Middleware و اتصالات بهینه‌شده NpgsqlDataSource.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onOpenCreateTableModal}
            className="px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs transition shadow-sm"
          >
            + ساخت جدول جدید
          </button>
        </div>
      </div>

      {/* Grid: Tables & Schema Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Table Selector */}
        <div className="lg:col-span-4 space-y-3">
          <div className="text-xs font-semibold text-zinc-400 flex items-center justify-between px-1">
            <span>جداول اسکیما ({tables.length})</span>
            <span className="text-[10px] text-zinc-500 font-mono">public_{project.slug}</span>
          </div>

          <div className="space-y-2">
            {tables.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-500 rounded-xl border border-dashed border-zinc-800">
                هیچ جدولی ایجاد نشده است
              </div>
            ) : (
              tables.map((t) => (
                <div
                  key={t.name}
                  onClick={() => {
                    setActiveTable(t.name);
                    setSqlQuery(`SELECT * FROM ${t.name} ORDER BY id DESC LIMIT 50;`);
                  }}
                  className={`cursor-pointer p-3.5 rounded-xl border transition ${
                    activeTable === t.name
                      ? 'bg-zinc-850 border-amber-500/50 shadow-sm'
                      : 'bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-850/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-bold text-amber-400">{t.name}</span>
                    <span className="text-[10px] text-zinc-400 font-mono">{t.rowCount.toLocaleString('fa-IR')} رکورد</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono flex items-center justify-between">
                    <span>حجم: {(t.sizeBytes / (1024 * 1024)).toFixed(1)} MB</span>
                    <span>ایجاد: {t.createdAt}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Schema Columns Preview */}
        <div className="lg:col-span-8 p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <span className="text-xs font-bold text-zinc-200 flex items-center gap-2">
              <TableIcon className="w-4 h-4 text-amber-400" />
              ساختار فیلدهای جدول: <span className="font-mono text-amber-400">{activeTable || 'بدون جدول'}</span>
            </span>
            <span className="text-[11px] text-zinc-400 font-mono">
              {currentColumns.length} ستون
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-zinc-800/60 text-zinc-400">
                  <th className="py-2 px-3">نام ستون</th>
                  <th className="py-2 px-3">نوع داده</th>
                  <th className="py-2 px-3">کلید اصلی</th>
                  <th className="py-2 px-3">تهی‌پذیری</th>
                  <th className="py-2 px-3">پیش‌فرض</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {currentColumns.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-xs text-zinc-500">
                      ستونی برای نمایش وجود ندارد
                    </td>
                  </tr>
                ) : (
                  currentColumns.map((c) => (
                    <tr key={c.name} className="hover:bg-zinc-850/30">
                      <td className="py-2 px-3 font-bold text-zinc-200">{c.name}</td>
                      <td className="py-2 px-3 text-amber-400">{c.dataType}</td>
                      <td className="py-2 px-3">
                        {c.isPrimaryKey ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20">
                            PK
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-2 px-3 text-zinc-400">{c.isNullable ? 'NULL' : 'NOT NULL'}</td>
                      <td className="py-2 px-3 text-zinc-400">{c.defaultValue || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Visual SQL Studio */}
      <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-bold text-zinc-200">
              ویرایشگر تعاملی SQL (Interactive Query Studio)
            </h4>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleApplySnippet('select')}
              className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] text-zinc-300 transition"
            >
              نمونه SELECT
            </button>
            <button
              onClick={() => handleApplySnippet('insert')}
              className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] text-zinc-300 transition"
            >
              نمونه INSERT
            </button>
            <button
              onClick={() => handleApplySnippet('create')}
              className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] text-zinc-300 transition"
            >
              نمونه CREATE
            </button>
          </div>
        </div>

        <div className="relative">
          <textarea
            value={sqlQuery}
            onChange={(e) => setSqlQuery(e.target.value)}
            className="w-full h-32 p-3.5 rounded-xl bg-zinc-950 font-mono text-xs text-zinc-200 border border-zinc-800 focus:outline-none focus:border-amber-500/60 resize-y leading-relaxed"
          />
          <div className="absolute left-3 bottom-3 flex items-center space-x-3">
            {queryResults && (
              <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1 bg-zinc-900/90 px-2 py-1 rounded border border-zinc-800">
                <Clock className="w-3 h-3" />
                زمان پردازش: {queryResults.latencyMs} ms
              </span>
            )}
            <button
              onClick={handleRunQuery}
              disabled={isRunningQuery}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition shadow-sm"
            >
              <Play className="w-3.5 h-3.5 fill-black" />
              <span>{isRunningQuery ? 'در حال اجرا...' : 'اجرای دستور SQL'}</span>
            </button>
          </div>
        </div>

        {/* Query Results Table */}
        {queryResults && (
          <div className="pt-2">
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 mb-2">
              <span>نتایج اجرای دستور ({queryResults.rows.length} رکورد بازگشتی)</span>
              <span className="text-[10px] text-zinc-500 font-mono">Dynamic SQL Handler</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-zinc-800/80 bg-zinc-950">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/60 text-zinc-400">
                    {queryResults.columns.map((c) => (
                      <th key={c} className="py-2.5 px-3 font-semibold">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40">
                  {queryResults.rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-zinc-850/30 transition">
                      {queryResults.columns.map((c) => (
                        <td key={c} className="py-2.5 px-3 text-zinc-300">
                          {typeof row[c] === 'object' ? JSON.stringify(row[c]) : String(row[c])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
