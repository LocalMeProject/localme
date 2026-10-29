import React, { useState } from 'react';
import {
  Search,
  RefreshCw,
  Plus,
  AlertCircle,
  Trash2,
} from 'lucide-react';

interface TableDataGridProps {
  activeTable: string;
  tableColumns: string[];
  filteredRows: Record<string, unknown>[];
  filterQuery: string;
  onFilterQueryChange: (q: string) => void;
  isLoadingData: boolean;
  gridError: string | null;
  onRefresh: () => void;
  onDeleteRow: (id: string) => void;
  onInsertRow: (jsonText: string) => Promise<boolean>;
}

export const TableDataGrid: React.FC<TableDataGridProps> = ({
  activeTable,
  tableColumns,
  filteredRows,
  filterQuery,
  onFilterQueryChange,
  isLoadingData,
  gridError,
  onRefresh,
  onDeleteRow,
  onInsertRow,
}) => {
  const [isInsertOpen, setIsInsertOpen] = useState(false);
  const [insertRecordJson, setInsertRecordJson] = useState('{\n  \n}');

  const handleInsert = async () => {
    const ok = await onInsertRow(insertRecordJson);
    if (ok) {
      setIsInsertOpen(false);
      setInsertRecordJson('{\n  \n}');
    }
  };

  return (
    <div className="space-y-4">
      {/* Grid Control Toolbar */}
      <div className="p-3.5 rounded-xl bg-[#171717] border border-[#242424] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="فیلتر در رکوردهای جدول..."
              value={filterQuery}
              onChange={(e) => onFilterQueryChange(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-full bg-[#0f0f0f] border border-[#242424] text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-[#3ECF8E] w-56 md:w-64"
            />
          </div>

          <button
            onClick={onRefresh}
            className="rounded-full bg-[#242424] hover:bg-[#2e2e2e] text-[#ededed] border border-[#2e2e2e] font-medium text-xs px-3 py-1.5 transition-colors"
            title="تازه سازی"
          >
            <RefreshCw className={`w-3 h-3 ${isLoadingData ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-xs font-mono text-zinc-400">
            نمایش {filteredRows.length} رکورد
          </span>
          <button
            onClick={() => setIsInsertOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#3ECF8E] hover:bg-[#34b27b] text-[#0f0f0f] font-medium text-xs px-3.5 py-1.5 transition-colors"
            disabled={!activeTable}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>افزودن رکورد جدید</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {gridError && (
        <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-red-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span>{gridError}</span>
        </div>
      )}

      {/* STRICT LTR ISOLATION DATA GRID CONTAINER */}
      <div className="rounded-xl border border-[#242424] bg-[#171717] overflow-hidden shadow-sm">
        <div className="overflow-x-auto max-h-[520px]" dir="ltr">
          <table className="w-full text-left text-xs font-mono border-collapse" dir="ltr">
            <thead>
              <tr className="border-b border-[#242424] bg-[#1a1a1a] text-zinc-400 sticky top-0 z-10">
                <th className="py-2.5 px-3 font-semibold text-zinc-400 w-12 text-center">#</th>
                {tableColumns.map((col) => (
                  <th key={col} className="py-2.5 px-3 font-semibold text-zinc-300 whitespace-nowrap">
                    {col}
                  </th>
                ))}
                <th className="py-2.5 px-3 font-semibold text-right w-16">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#242424]">
              {isLoadingData ? (
                <tr>
                  <td colSpan={tableColumns.length + 2} className="py-12 text-center text-zinc-500">
                    <div className="inline-flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-[#3ECF8E]" />
                      <span>در حال بارگذاری رکوردهای جدول...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={tableColumns.length + 2} className="py-12 text-center text-zinc-500">
                    {activeTable ? 'هیچ رکوردی در این جدول یافت نشد.' : 'ابتدا یک جدول انتخاب کنید.'}
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-[#1f1f1f] transition group">
                    <td className="py-2 px-3 text-zinc-600 text-center font-mono">{idx + 1}</td>
                    {tableColumns.map((col) => {
                      const cellVal = row[col];
                      const isJson = typeof cellVal === 'object' && cellVal !== null;
                      return (
                        <td key={col} className="py-2 px-3 text-zinc-300 max-w-xs truncate" title={String(cellVal)}>
                          {isJson ? (
                            <span className="text-[#3ECF8E] font-mono text-[11px]">
                              {JSON.stringify(cellVal)}
                            </span>
                          ) : cellVal === null || cellVal === undefined ? (
                            <span className="text-zinc-600 italic">null</span>
                          ) : (
                            String(cellVal)
                          )}
                        </td>
                      );
                    })}
                    <td className="py-2 px-3 text-right">
                      {row.id !== undefined && (
                        <button
                          onClick={() => onDeleteRow(String(row.id))}
                          className="text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition p-1"
                          title="حذف رکورد"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Insert Record Drawer / Modal */}
      {isInsertOpen && (
        <div className="p-4 rounded-xl bg-[#171717] border border-[#3ECF8E]/40 space-y-3 shadow-lg">
          <div className="flex items-center justify-between border-b border-[#242424] pb-2">
            <span className="text-xs font-bold text-white flex items-center gap-2">
              <Plus className="w-3.5 h-3.5 text-[#3ECF8E]" />
              ثبت رکورد در جدول {activeTable} (JSON Payload)
            </span>
            <button
              onClick={() => setIsInsertOpen(false)}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              بستن
            </button>
          </div>

          <div dir="ltr">
            <textarea
              value={insertRecordJson}
              onChange={(e) => setInsertRecordJson(e.target.value)}
              rows={5}
              className="w-full p-2.5 rounded-lg bg-[#0f0f0f] border border-[#242424] text-xs font-mono text-[#3ECF8E] focus:outline-none focus:border-[#3ECF8E]"
              placeholder='{\n  "title": "مقدار نمونه",\n  "status": "ACTIVE"\n}'
              dir="ltr"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsInsertOpen(false)}
              className="rounded-full bg-[#242424] hover:bg-[#2e2e2e] text-[#ededed] border border-[#2e2e2e] font-medium text-xs px-3.5 py-1.5 transition-colors"
            >
              انصراف
            </button>
            <button
              onClick={handleInsert}
              className="rounded-full bg-[#3ECF8E] hover:bg-[#34b27b] text-[#0f0f0f] font-medium text-xs px-3.5 py-1.5 transition-colors"
            >
              ذخیره در دیتابیس
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
