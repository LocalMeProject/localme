import React from 'react';
import {
  FileCode,
  Clock,
  Play,
  AlertCircle,
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
  queryHistory,
  onApplySnippet,
}) => {
  return (
    <div className="space-y-4">
      {/* SQL Runner Toolbar */}
      <div className="p-3.5 rounded-xl bg-[#171717] border border-[#242424] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-[#3ECF8E]" />
          <span className="text-xs font-bold text-white">ویرایشگر پرس‌وجوی SQL</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => onApplySnippet('select')}
            className="px-2.5 py-1 rounded-full bg-[#1f1f1f] hover:bg-[#282828] text-[11px] text-zinc-300 border border-[#2e2e2e] transition"
          >
            SELECT
          </button>
          <button
            onClick={() => onApplySnippet('insert')}
            className="px-2.5 py-1 rounded-full bg-[#1f1f1f] hover:bg-[#282828] text-[11px] text-zinc-300 border border-[#2e2e2e] transition"
          >
            INSERT
          </button>
          <button
            onClick={() => onApplySnippet('create_table')}
            className="px-2.5 py-1 rounded-full bg-[#1f1f1f] hover:bg-[#282828] text-[11px] text-zinc-300 border border-[#2e2e2e] transition"
          >
            CREATE TABLE
          </button>
          <button
            onClick={() => onApplySnippet('index')}
            className="px-2.5 py-1 rounded-full bg-[#1f1f1f] hover:bg-[#282828] text-[11px] text-zinc-300 border border-[#2e2e2e] transition"
          >
            INDEX
          </button>
          <button
            onClick={() => onApplySnippet('explain')}
            className="px-2.5 py-1 rounded-full bg-[#1f1f1f] hover:bg-[#282828] text-[11px] text-zinc-300 border border-[#2e2e2e] transition"
          >
            EXPLAIN
          </button>
        </div>
      </div>

      {/* STRICT LTR ISOLATION SQL EDITOR */}
      <div className="relative rounded-xl border border-[#242424] bg-[#0f0f0f] overflow-hidden">
        <textarea
          value={sqlQuery}
          onChange={(e) => onSqlQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault();
              onRunQuery();
            }
          }}
          rows={6}
          className="w-full p-4 font-mono text-xs text-[#ededed] bg-[#0f0f0f] focus:outline-none focus:ring-1 focus:ring-[#3ECF8E] resize-y leading-relaxed"
          placeholder="SELECT * FROM table_name LIMIT 10;"
          dir="ltr"
        />

        <div className="p-2.5 bg-[#171717] border-t border-[#242424] flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs">
            <span className="text-[11px] text-zinc-500 font-mono">
              میانبر: Ctrl + Enter برای اجرا
            </span>
            {queryResults && !queryResults.error && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-[#3ECF8E]/10 text-[#3ECF8E] border border-[#3ECF8E]/30">
                <Clock className="w-3 h-3" />
                <span>{queryResults.latencyMs} ms</span>
                <span>•</span>
                <span>{queryResults.rowCount} رکورد</span>
              </span>
            )}
          </div>

          <button
            onClick={onRunQuery}
            disabled={isRunningQuery}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#3ECF8E] hover:bg-[#34b27b] text-[#0f0f0f] font-medium text-xs px-4 py-1.5 transition-colors"
          >
            <Play className="w-3.5 h-3.5 fill-black" />
            <span>{isRunningQuery ? 'در حال اجرا...' : 'اجرای پرس‌وجو'}</span>
          </button>
        </div>
      </div>

      {/* SQL Result Table */}
      {queryResults && (
        <div className="space-y-2">
          {queryResults.error ? (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-200 text-xs space-y-1">
              <div className="font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span>خطای اجرای دستور SQL:</span>
              </div>
              <pre className="font-mono text-[11px] whitespace-pre-wrap text-red-300 dir-ltr text-left">
                {queryResults.error}
              </pre>
            </div>
          ) : (
            <div className="rounded-xl border border-[#242424] bg-[#171717] overflow-hidden">
              <div className="overflow-x-auto max-h-[380px]" dir="ltr">
                <table className="w-full text-left text-xs font-mono" dir="ltr">
                  <thead>
                    <tr className="border-b border-[#242424] bg-[#1a1a1a] text-zinc-400 sticky top-0">
                      {queryResults.columns.map((c) => (
                        <th key={c} className="py-2.5 px-3 font-semibold text-zinc-300 whitespace-nowrap">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#242424]">
                    {queryResults.rows.length === 0 ? (
                      <tr>
                        <td colSpan={queryResults.columns.length || 1} className="py-8 text-center text-zinc-500">
                          دستور با موفقیت اجرا شد (بدون سطر بازگشتی).
                        </td>
                      </tr>
                    ) : (
                      queryResults.rows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-[#1f1f1f] transition">
                          {queryResults.columns.map((c) => (
                            <td key={c} className="py-2 px-3 text-zinc-300 max-w-xs truncate">
                              {typeof row[c] === 'object' && row[c] !== null
                                ? JSON.stringify(row[c])
                                : String(row[c] ?? 'null')}
                            </td>
                          ))}
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

      {/* Query History */}
      {queryHistory.length > 0 && (
        <div className="p-3.5 rounded-xl bg-[#171717] border border-[#242424] space-y-2">
          <div className="text-[11px] font-semibold text-zinc-400 flex items-center justify-between">
            <span>تاریخچه دستورات اجرا شده (Session History)</span>
            <span className="font-mono text-zinc-500">{queryHistory.length} مورد</span>
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {queryHistory.map((item) => (
              <div
                key={item.id}
                onClick={() => onSqlQueryChange(item.query)}
                className="p-2 rounded-lg bg-[#0f0f0f] border border-[#242424] hover:border-[#3ECF8E]/40 cursor-pointer flex items-center justify-between text-xs font-mono transition"
              >
                <span className="text-zinc-300 truncate max-w-md dir-ltr text-left">
                  {item.query}
                </span>
                <div className="flex items-center gap-2 text-[10px] text-zinc-500 flex-shrink-0">
                  <span>{item.durationMs}ms</span>
                  <span className={item.status === 'SUCCESS' ? 'text-[#3ECF8E]' : 'text-red-400'}>
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
