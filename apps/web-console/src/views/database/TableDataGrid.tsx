import React, { useState } from 'react';
import {
  Search,
  RefreshCw,
  Plus,
  AlertCircle,
  Trash2,
  Download,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Edit2,
  Check,
  X,
} from 'lucide-react';
import { DatabaseColumn } from '../../types';
import { ConfirmModal } from '../../components/modals/ConfirmModal';
import { InsertRecordModal } from './InsertRecordModal';

interface TableDataGridProps {
  activeTable: string;
  tableColumns: string[];
  schemaColumns?: DatabaseColumn[];
  filteredRows: Record<string, unknown>[];
  filterQuery: string;
  onFilterQueryChange: (q: string) => void;
  isLoadingData: boolean;
  gridError: string | null;
  onRefresh: () => void;
  onDeleteRow: (id: string) => void;
  onInsertRow?: (jsonText: string) => Promise<boolean>;
  onInsertRecord?: (data: Record<string, unknown>) => Promise<{ success: boolean; error?: string; code?: string; detail?: string }>;
  onUpdateRow?: (id: string, patch: Record<string, unknown>) => Promise<boolean>;
  // Pagination & Sorting props
  currentPage?: number;
  pageSize?: number;
  totalCount?: number;
  onPageChange?: (page: number) => void;
  sortColumn?: string | null;
  sortAscending?: boolean;
  onSortChange?: (column: string) => void;
}

export const TableDataGrid: React.FC<TableDataGridProps> = ({
  activeTable,
  tableColumns,
  schemaColumns,
  filteredRows,
  filterQuery,
  onFilterQueryChange,
  isLoadingData,
  gridError,
  onRefresh,
  onDeleteRow,
  onInsertRow,
  onInsertRecord,
  onUpdateRow,
  currentPage = 1,
  pageSize = 50,
  totalCount = filteredRows.length,
  onPageChange,
  sortColumn,
  sortAscending = true,
  onSortChange,
}) => {
  const [isInsertOpen, setIsInsertOpen] = useState(false);

  // Deletion state
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Inline editing state
  const [editingCell, setEditingCell] = useState<{ rowId: string; col: string; value: string } | null>(null);

  const effectiveColumns: DatabaseColumn[] = schemaColumns && schemaColumns.length > 0
    ? schemaColumns
    : tableColumns.map((col) => ({
        name: col,
        dataType: 'text',
        isPrimaryKey: col === 'id',
        isNullable: true,
      }));

  const handleInsertRecordSubmit = async (data: Record<string, unknown>) => {
    if (onInsertRecord) {
      return await onInsertRecord(data);
    }
    if (onInsertRow) {
      const ok = await onInsertRow(JSON.stringify(data));
      return { success: ok };
    }
    return { success: false, error: 'اکشن ثبت رکورد تعریف نشده است.' };
  };

  const handleSaveCell = async () => {
    if (!editingCell || !onUpdateRow) {
      setEditingCell(null);
      return;
    }
    const { rowId, col, value } = editingCell;
    let parsedVal: unknown = value;
    try {
      if (value.startsWith('{') || value.startsWith('[')) {
        parsedVal = JSON.parse(value);
      } else if (!isNaN(Number(value)) && value.trim() !== '') {
        parsedVal = Number(value);
      } else if (value === 'true' || value === 'false') {
        parsedVal = value === 'true';
      } else if (value === 'null') {
        parsedVal = null;
      }
    } catch {
      parsedVal = value;
    }

    await onUpdateRow(rowId, { [col]: parsedVal });
    setEditingCell(null);
  };

  const exportCsv = () => {
    if (filteredRows.length === 0) return;
    const cols = tableColumns;
    const header = cols.join(',');
    const lines = filteredRows.map((r) =>
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
    link.setAttribute('download', `${activeTable}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportJson = () => {
    if (filteredRows.length === 0) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredRows, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${activeTable}_export.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

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

          <div className="flex items-center gap-1 border-r border-slate-200 pr-2 mr-1">
            <button
              onClick={exportCsv}
              disabled={filteredRows.length === 0}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium transition disabled:opacity-40"
              title="خروجی CSV"
            >
              <Download className="w-3 h-3" />
              <span>CSV</span>
            </button>
            <button
              onClick={exportJson}
              disabled={filteredRows.length === 0}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium transition disabled:opacity-40"
              title="خروجی JSON"
            >
              <Download className="w-3 h-3" />
              <span>JSON</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-xs text-slate-500 font-medium">
            نمایش <span className="font-bold text-slate-800 font-mono" dir="ltr">{filteredRows.length}</span> از{' '}
            <span className="font-bold text-slate-800 font-mono" dir="ltr">{totalCount}</span> رکورد
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
                {tableColumns.map((col) => {
                  const isSorted = sortColumn === col;
                  return (
                    <th
                      key={col}
                      onClick={() => onSortChange?.(col)}
                      className={`py-2.5 px-3 font-semibold whitespace-nowrap cursor-pointer select-none hover:bg-slate-100/80 transition ${
                        isSorted ? 'text-emerald-700 bg-emerald-50/50' : 'text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>{col}</span>
                        {isSorted ? (
                          sortAscending ? (
                            <ArrowUp className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <ArrowDown className="w-3 h-3 text-emerald-600" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-30" />
                        )}
                      </div>
                    </th>
                  );
                })}
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
                      className="border-b border-slate-100 hover:bg-slate-50/80 transition group"
                    >
                      <td className="py-2 px-3 text-center text-slate-400 text-[11px]">
                        {(currentPage - 1) * pageSize + idx + 1}
                      </td>
                      {tableColumns.map((col) => {
                        const val = row[col];
                        const isEditing = editingCell?.rowId === rowId && editingCell?.col === col;
                        const displayVal =
                          typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val ?? '');

                        if (isEditing) {
                          return (
                            <td key={col} className="p-1">
                              <div className="flex items-center gap-1 bg-white border border-emerald-500 rounded p-1 shadow-2xs">
                                <input
                                  type="text"
                                  value={editingCell.value}
                                  onChange={(e) =>
                                    setEditingCell({ ...editingCell, value: e.target.value })
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveCell();
                                    else if (e.key === 'Escape') setEditingCell(null);
                                  }}
                                  className="w-full text-xs font-mono px-1 py-0.5 focus:outline-none"
                                  autoFocus
                                />
                                <button
                                  onClick={handleSaveCell}
                                  className="text-emerald-600 hover:text-emerald-800"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setEditingCell(null)}
                                  className="text-slate-400 hover:text-slate-600"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          );
                        }

                        return (
                          <td
                            key={col}
                            onDoubleClick={() => {
                              if (onUpdateRow && col !== 'id') {
                                setEditingCell({ rowId, col, value: displayVal });
                              }
                            }}
                            className="py-2 px-3 text-slate-800 truncate max-w-xs cursor-cell group/cell relative"
                            title="برای ویرایش دوبار کلیک کنید"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="truncate">
                                {displayVal === '' ? (
                                  <span className="text-slate-300 italic">NULL</span>
                                ) : (
                                  displayVal
                                )}
                              </span>
                              {onUpdateRow && col !== 'id' && (
                                <button
                                  onClick={() =>
                                    setEditingCell({ rowId, col, value: displayVal })
                                  }
                                  className="opacity-0 group-hover/cell:opacity-100 text-slate-400 hover:text-emerald-600 p-0.5 transition"
                                >
                                  <Edit2 className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      })}
                      <td className="py-2 px-3 text-center">
                        <button
                          onClick={() => setPendingDeleteId(rowId)}
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

        {/* Server-Side Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              صفحه {currentPage} از {totalPages}
            </span>
            <div className="flex items-center gap-1.5" dir="ltr">
              <button
                onClick={() => onPageChange?.(currentPage - 1)}
                disabled={currentPage <= 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 font-mono font-bold text-slate-800">{currentPage}</span>
              <button
                onClick={() => onPageChange?.(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Typed Record Insert Modal */}
      <InsertRecordModal
        isOpen={isInsertOpen}
        tableName={activeTable}
        columns={effectiveColumns}
        onClose={() => setIsInsertOpen(false)}
        onSubmit={handleInsertRecordSubmit}
      />

      {/* Accessible Confirm Deletion Modal */}
      <ConfirmModal
        isOpen={pendingDeleteId !== null}
        title="حذف رکورد از جدول"
        message={`آیا از حذف دائم رکورد با شناسه "${pendingDeleteId}" از جدول "${activeTable}" اطمینان دارید؟ این عملیات غیرقابل بازگشت است.`}
        confirmLabel="حذف رکورد"
        isDanger={true}
        onConfirm={() => {
          if (pendingDeleteId) {
            onDeleteRow(pendingDeleteId);
            setPendingDeleteId(null);
          }
        }}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
};
