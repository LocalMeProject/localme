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
      <div className="p-3.5 rounded-xl bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="جستجو و فیلتر در رکوردهای جدول..."
              value={filterQuery}
              onChange={(e) => onFilterQueryChange(e.target.value)}
              className="pr-8 pl-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 w-56 md:w-64"
            />
          </div>

          <button
            onClick={onRefresh}
            className="rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium text-xs px-3 py-1.5 transition"
            title="بازخوانی داده‌ها"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingData ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-xs text-slate-500 font-medium">
            نمایش <span className="font-bold text-slate-800 font-mono" dir="ltr">{filteredRows.length}</span> رکورد
          </span>
          <button
            onClick={() => setIsInsertOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-3.5 py-1.5 transition shadow-xs"
            disabled={!activeTable}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>افزودن رکورد جدید</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {gridError && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{gridError}</span>
        </div>
      )}

      {/* Strict LTR Data Grid Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="overflow-x-auto max-h-[520px]" dir="ltr">
          <table className="w-full text-left text-xs font-mono border-collapse" dir="ltr">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 sticky top-0 z-10">
                <th className="py-2.5 px-3 font-semibold text-slate-500 w-12 text-center">#</th>
                {tableColumns.map((col) => (
                  <th key={col} className="py-2.5 px-3 font-semibold text-slate-700 whitespace-nowrap">
                    {col}
                  </th>
                ))}
                <th className="py-2.5 px-3 font-semibold text-slate-500 w-16 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={tableColumns.length + 2}
                    className="py-12 text-center text-slate-400 font-sans text-xs"
                    dir="rtl"
                  >
                    {activeTable ? 'هیچ داده‌ای در این جدول یافت نشد.' : 'ابتدا یک جدول را انتخاب کنید.'}
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => {
                  const rowId = String(row.id ?? idx);
                  return (
                    <tr
                      key={rowId}
                      className="border-b border-slate-100 hover:bg-slate-50/80 transition"
                    >
                      <td className="py-2 px-3 text-center text-slate-400 text-[11px]">
                        {idx + 1}
                      </td>
                      {tableColumns.map((col) => {
                        const val = row[col];
                        const displayVal =
                          typeof val === 'object' && val !== null
                            ? JSON.stringify(val)
                            : String(val ?? '');
                        return (
                          <td
                            key={col}
                            className="py-2 px-3 text-slate-800 truncate max-w-xs"
                            title={displayVal}
                          >
                            {displayVal === '' ? (
                              <span className="text-slate-300 italic">NULL</span>
                            ) : (
                              displayVal
                            )}
                          </td>
                        );
                      })}
                      <td className="py-2 px-3 text-center">
                        <button
                          onClick={() => onDeleteRow(rowId)}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          title="حذف این رکورد"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* JSON Insert Modal */}
      {isInsertOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                افزودن رکورد جدید به جدول <span className="font-mono text-emerald-700" dir="ltr">{activeTable}</span>
              </h3>
              <button
                onClick={() => setIsInsertOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                بستن
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              مشخصات رکورد جدید را در قالب JSON وارد نمایید:
            </p>

            <textarea
              value={insertRecordJson}
              onChange={(e) => setInsertRecordJson(e.target.value)}
              rows={8}
              dir="ltr"
              className="w-full rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500"
              placeholder={`{\n  "title": "عنوان",\n  "status": "ACTIVE"\n}`}
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsInsertOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 transition"
              >
                انصراف
              </button>
              <button
                onClick={handleInsert}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-medium text-white transition shadow-xs"
              >
                ثبت رکورد در پایگاه داده
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
