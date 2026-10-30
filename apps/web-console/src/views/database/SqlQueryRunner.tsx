import React from 'react';
import {
  FileCode,
  Clock,
  Play,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { DatabaseQueryHistoryItem } from '../../types';

interface SqlQueryRunnerProps {
  sqlQuery: string;
  onSqlQueryChange: (sql: string) => void;
  onRunQuery: () => void;
  isRunningQuery: boolean;
  queryResults: {
    columns: string[];
    rows: Record<string, unknown>[];
    latencyMs: number;
    rowCount: number;
    error?: string;
  } | null;
  queryHistory: DatabaseQueryHistoryItem[];
  onApplySnippet: (type: string) => void;
}

export const SqlQueryRunner: React.FC<SqlQueryRunnerProps> = ({
  sqlQuery,
  onSqlQueryChange,
  onRunQuery,
  isRunningQuery,
  queryResults,
  queryHistory: _queryHistory,
  onApplySnippet,
}) => {
  return (
    <div className="space-y-4">
      {/* SQL Runner Toolbar */}
      <div className="p-3.5 rounded-xl bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-bold text-slate-900">ویرایشگر پرس‌وجوی SQL</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => onApplySnippet('select')}
            className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-[11px] font-mono text-slate-700 border border-slate-200 transition"
          >
            SELECT
          </button>
          <button
            onClick={() => onApplySnippet('insert')}
            className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-[11px] font-mono text-slate-700 border border-slate-200 transition"
          >
            INSERT
          </button>
          <button
            onClick={() => onApplySnippet('create_table')}
            className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-[11px] font-mono text-slate-700 border border-slate-200 transition"
          >
            CREATE TABLE
          </button>
          <button
            onClick={() => onApplySnippet('index')}
            className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-[11px] font-mono text-slate-700 border border-slate-200 transition"
          >
            INDEX
          </button>
          <button
            onClick={() => onApplySnippet('explain')}
            className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-[11px] font-mono text-slate-700 border border-slate-200 transition"
          >
            EXPLAIN
          </button>
        </div>
      </div>

      {/* Query Code Area */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
          <span className="text-[11px] font-medium text-slate-500">
            پرس‌وجوی مورد نظر خود را بنویسید یا از الگوهای آماده استفاده کنید:
          </span>
          <button
            onClick={onRunQuery}
            disabled={isRunningQuery || !sqlQuery.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition shadow-xs disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${isRunningQuery ? 'animate-spin' : ''}`} />
            <span>{isRunningQuery ? 'در حال اجرا...' : 'اجرای پرس‌وجو'}</span>
          </button>
        </div>

        <textarea
          value={sqlQuery}
          onChange={(e) => onSqlQueryChange(e.target.value)}
          rows={7}
          dir="ltr"
          placeholder="-- دستورات SQL خود را اینجا بنویسید&#10;SELECT * FROM ... LIMIT 50;"
          className="w-full p-4 bg-slate-900 text-emerald-400 font-mono text-xs focus:outline-none resize-y selection:bg-emerald-500/30 leading-relaxed"
        />
      </div>

      {/* Query Execution Output */}
      {queryResults && (
        <div className="space-y-3">
          {queryResults.error ? (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
              <div>
                <div className="font-bold mb-1">خطا در اجرای کوئری:</div>
                <div className="font-mono text-[11px]" dir="ltr">
                  {queryResults.error}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
              <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>کوئری با موفقیت اجرا شد</span>
                  </span>
                  <span className="text-slate-400">|</span>
                  <span className="text-slate-600">
                    تعداد سطرها: <strong className="text-slate-900 font-mono" dir="ltr">{queryResults.rowCount}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                  <Clock className="w-3.5 h-3.5" />
                  <span dir="ltr">{queryResults.latencyMs} ms</span>
                </div>
              </div>

              <div className="overflow-x-auto max-h-[400px]" dir="ltr">
                <table className="w-full text-left text-xs font-mono border-collapse" dir="ltr">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 sticky top-0">
                      <th className="py-2 px-3 font-semibold text-slate-500 w-10 text-center">#</th>
                      {queryResults.columns.map((c) => (
                        <th key={c} className="py-2 px-3 font-semibold text-slate-700 whitespace-nowrap">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {queryResults.rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={queryResults.columns.length + 1}
                          className="py-8 text-center text-slate-400 font-sans text-xs"
                          dir="rtl"
                        >
                          کوئری با موفقیت اجرا شد اما سطری برای نمایش بازگردانده نشد.
                        </td>
                      </tr>
                    ) : (
                      queryResults.rows.map((row, idx) => (
                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/80 transition">
                          <td className="py-2 px-3 text-center text-slate-400 text-[11px]">{idx + 1}</td>
                          {queryResults.columns.map((c) => {
                            const val = row[c];
                            const text =
                              typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val ?? '');
                            return (
                              <td key={c} className="py-2 px-3 text-slate-800 truncate max-w-xs" title={text}>
                                {text === '' ? <span className="text-slate-300 italic">NULL</span> : text}
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
