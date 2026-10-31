import React, { useState, useEffect } from 'react';
import {
  FileCode,
  Clock,
  Play,
  AlertCircle,
  CheckCircle2,
  Download,
  History,
  Trash2,
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
  queryHistory?: DatabaseQueryHistoryItem[];
  onApplySnippet: (type: string) => void;
}

export const SqlQueryRunner: React.FC<SqlQueryRunnerProps> = ({
  sqlQuery,
  onSqlQueryChange,
  onRunQuery,
  isRunningQuery,
  queryResults,
  onApplySnippet,
}) => {
  const [history, setHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load history from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('localme_sql_history');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setHistory(parsed);
      }
    } catch {
      // Ignore
    }
  }, []);

  // Update history when queryResults changes and is successful
  useEffect(() => {
    if (queryResults && !queryResults.error && sqlQuery.trim()) {
      setHistory((prev) => {
        const updated = [sqlQuery.trim(), ...prev.filter((q) => q !== sqlQuery.trim())].slice(0, 20);
        try {
          localStorage.setItem('localme_sql_history', JSON.stringify(updated));
        } catch {
          // Ignore
        }
        return updated;
      });
    }
  }, [queryResults, sqlQuery]);

  const clearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem('localme_sql_history');
    } catch {
      // Ignore
    }
  };

  const exportCsv = () => {
    if (!queryResults || queryResults.rows.length === 0) return;
    const cols = queryResults.columns;
    const header = cols.join(',');
    const lines = queryResults.rows.map((r) =>
      cols
        .map((c) => {
          const val = r[c];
          const str = typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val ?? '');
          return `"${str.replace(/"/g, '""')}"`;
        })
        .join(',')
    );
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [header, ...lines].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `query_results_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportJson = () => {
    if (!queryResults || queryResults.rows.length === 0) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(queryResults.rows, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `query_results_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-4">
      {/* SQL Runner Toolbar */}
      <div className="p-3.5 rounded-xl bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-bold text-slate-900">ویرایشگر پرس‌وجوی SQL</span>
          <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-mono">
            Ctrl + Enter
          </span>
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
            onClick={() => onApplySnippet('update')}
            className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-[11px] font-mono text-slate-700 border border-slate-200 transition"
          >
            UPDATE
          </button>
          <button
            onClick={() => onApplySnippet('delete')}
            className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-[11px] font-mono text-slate-700 border border-slate-200 transition"
          >
            DELETE
          </button>
          <button
            onClick={() => onApplySnippet('explain')}
            className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-[11px] font-mono text-slate-700 border border-slate-200 transition"
          >
            EXPLAIN
          </button>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition ${
              showHistory
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <History className="w-3 h-3" />
            <span>تاریخچه</span>
          </button>
        </div>
      </div>

      {/* Query History Drawer */}
      {showHistory && (
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
            <span>تاریخچه کوئری‌های اخیر</span>
            {history.length > 0 && (
              <button
                onClick={clearHistory}
                className="inline-flex items-center gap-1 text-[11px] text-rose-600 hover:text-rose-700"
              >
                <Trash2 className="w-3 h-3" />
                <span>پاکسازی تاریخچه</span>
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">هنوز کوئری ثبت نشده است.</p>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {history.map((q, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    onSqlQueryChange(q);
                    setShowHistory(false);
                  }}
                  className="p-2 rounded-lg bg-white border border-slate-200 text-xs font-mono text-slate-800 hover:border-emerald-500 cursor-pointer transition truncate"
                  dir="ltr"
                >
                  {q}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Query Code Area */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
          <span className="text-[11px] font-medium text-slate-500">
            پرس‌وجوی مورد نظر خود را بنویسید (اجرا با کلیک یا کلید میانبر <kbd className="px-1 py-0.5 rounded bg-slate-200 font-mono text-[10px]">Ctrl+Enter</kbd>):
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
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault();
              if (!isRunningQuery && sqlQuery.trim()) {
                onRunQuery();
              }
            }
          }}
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
              <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>کوئری با موفقیت اجرا شد</span>
                  </span>
                  <span className="text-slate-400">|</span>
                  <span className="text-slate-600">
                    تعداد سطرها: <strong className="text-slate-900 font-mono" dir="ltr">{queryResults.rowCount}</strong>
                  </span>
                  <span className="text-slate-400">|</span>
                  <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                    <Clock className="w-3.5 h-3.5" />
                    <span dir="ltr">{queryResults.latencyMs} ms</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={exportCsv}
                    disabled={queryResults.rows.length === 0}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-medium transition disabled:opacity-40"
                  >
                    <Download className="w-3 h-3" />
                    <span>CSV</span>
                  </button>
                  <button
                    onClick={exportJson}
                    disabled={queryResults.rows.length === 0}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-medium transition disabled:opacity-40"
                  >
                    <Download className="w-3 h-3" />
                    <span>JSON</span>
                  </button>
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
