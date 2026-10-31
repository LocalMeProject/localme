import React, { useState, useEffect, useCallback } from 'react';
import { Layers, Plus, Trash2, RefreshCw, Key, ShieldCheck } from 'lucide-react';
import { TableIndex, DatabaseColumn } from '../../types';
import { ConfirmModal } from '../../components/modals/ConfirmModal';
import { AlertModal } from '../../components/modals/AlertModal';

interface SchemaIndexesSectionProps {
  projectSlug: string;
  activeTable: string;
  columns?: DatabaseColumn[];
}

export const SchemaIndexesSection: React.FC<SchemaIndexesSectionProps> = ({
  projectSlug,
  activeTable,
  columns = [],
}) => {
  const [indexes, setIndexes] = useState<TableIndex[]>([]);
  const [isLoadingIndexes, setIsLoadingIndexes] = useState(false);
  const [isAddingIndex, setIsAddingIndex] = useState(false);
  const [reindexingName, setReindexingName] = useState<string | null>(null);

  // Creation form state
  const [newIndexName, setNewIndexName] = useState('');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [isUnique, setIsUnique] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Deletion modal state
  const [indexToDelete, setIndexToDelete] = useState<string | null>(null);

  // Feedback Alert Modal
  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    detail?: string;
    code?: string;
    type: 'error' | 'success' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });

  const fetchIndexes = useCallback(async () => {
    if (!activeTable) return;
    setIsLoadingIndexes(true);
    try {
      const res = await fetch(`/_baas/v1/${projectSlug}/db/tables/${encodeURIComponent(activeTable)}/indexes`);
      if (res.ok) {
        const data = await res.json();
        setIndexes(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch indexes:', err);
    } finally {
      setIsLoadingIndexes(false);
    }
  }, [activeTable, projectSlug]);

  useEffect(() => {
    fetchIndexes();
  }, [fetchIndexes]);

  const handleToggleColumn = (colName: string) => {
    setSelectedColumns((prev) =>
      prev.includes(colName) ? prev.filter((c) => c !== colName) : [...prev, colName]
    );
  };

  const handleCreateIndex = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedColumns.length === 0 || !activeTable) {
      setAlertState({
        isOpen: true,
        title: 'انتخاب ستون الزامی است',
        message: 'لطفاً حداقل یک ستون برای ایجاد ایندکس انتخاب نمایید.',
        type: 'error',
      });
      return;
    }

    setIsCreating(true);
    const finalName = newIndexName.trim() || `idx_${activeTable}_${selectedColumns.join('_')}`;

    try {
      const res = await fetch(`/_baas/v1/${projectSlug}/db/tables/${encodeURIComponent(activeTable)}/indexes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: finalName,
          columns: selectedColumns,
          isUnique,
        }),
      });

      const body = await res.json().catch(() => null);

      if (res.ok) {
        setIsAddingIndex(false);
        setNewIndexName('');
        setSelectedColumns([]);
        setIsUnique(false);
        fetchIndexes();
        setAlertState({
          isOpen: true,
          title: 'ایندکس با موفقیت ایجاد شد',
          message: `ایندکس «${finalName}» بر روی جدول «${activeTable}» با موفقیت ساخته شد.`,
          type: 'success',
        });
      } else {
        setAlertState({
          isOpen: true,
          title: 'خطا در ایجاد ایندکس',
          message: body?.error || 'ساخت ایندکس در پایگاه داده ناموفق بود.',
          code: body?.code,
          detail: body?.detail,
          type: 'error',
        });
      }
    } catch (err) {
      setAlertState({
        isOpen: true,
        title: 'خطای ارتباط با سرور',
        message: 'برقراری ارتباط با سرور با خطا مواجه شد.',
        detail: String(err),
        type: 'error',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleReindex = async (indexName: string) => {
    setReindexingName(indexName);
    try {
      const res = await fetch(
        `/_baas/v1/${projectSlug}/db/tables/${encodeURIComponent(activeTable)}/indexes/${encodeURIComponent(indexName)}/rebuild`,
        { method: 'POST' }
      );
      const body = await res.json().catch(() => null);
      if (res.ok) {
        setAlertState({
          isOpen: true,
          title: 'بازسازی ایندکس با موفقیت انجام شد',
          message: `ایندکس «${indexName}» مجدداً بازسازی و بروزرسانی گردید.`,
          type: 'success',
        });
      } else {
        setAlertState({
          isOpen: true,
          title: 'خطا در بازسازی ایندکس',
          message: body?.error || 'عملیات REINDEX ناموفق بود.',
          code: body?.code,
          detail: body?.detail,
          type: 'error',
        });
      }
    } catch (err) {
      setAlertState({
        isOpen: true,
        title: 'خطای ارتباط با سرور',
        message: 'خطا در ارسال درخواست بازسازی ایندکس.',
        detail: String(err),
        type: 'error',
      });
    } finally {
      setReindexingName(null);
    }
  };

  const handleDeleteIndex = async (indexName: string) => {
    try {
      const res = await fetch(
        `/_baas/v1/${projectSlug}/db/tables/${encodeURIComponent(activeTable)}/indexes/${encodeURIComponent(indexName)}`,
        { method: 'DELETE' }
      );
      const body = await res.json().catch(() => null);
      if (res.ok) {
        fetchIndexes();
        setAlertState({
          isOpen: true,
          title: 'حذف ایندکس موفق',
          message: `ایندکس «${indexName}» با موفقیت حذف گردید.`,
          type: 'success',
        });
      } else {
        setAlertState({
          isOpen: true,
          title: 'خطا در حذف ایندکس',
          message: body?.error || 'حذف ایندکس ناموفق بود.',
          code: body?.code,
          detail: body?.detail,
          type: 'error',
        });
      }
    } catch (err) {
      setAlertState({
        isOpen: true,
        title: 'خطای ارتباط با سرور',
        message: 'خطا در حذف ایندکس.',
        detail: String(err),
        type: 'error',
      });
    } finally {
      setIndexToDelete(null);
    }
  };

  return (
    <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-600" />
          <div>
            <h4 className="text-xs font-bold text-slate-900">مدیریت ایندکس‌ها (Database Indexes)</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              مشاهده، بازسازی (REINDEX)، تعریف ایندکس یکتا/ترکیبی و حذف ایندکس‌های جدول
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchIndexes}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            title="بروزرسانی ایندکس‌ها"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingIndexes ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setIsAddingIndex(!isAddingIndex)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-medium transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>ایجاد ایندکس جدید</span>
          </button>
        </div>
      </div>

      {/* Add Index Form */}
      {isAddingIndex && (
        <form
          onSubmit={handleCreateIndex}
          className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4 text-xs animate-in fade-in duration-150"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 text-[11px] font-medium mb-1">
                نام ایندکس (اختیاری):
              </label>
              <input
                type="text"
                value={newIndexName}
                onChange={(e) => setNewIndexName(e.target.value)}
                placeholder={`idx_${activeTable}_col`}
                dir="ltr"
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-6">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isUnique}
                  onChange={(e) => setIsUnique(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span className="text-slate-700 text-xs font-medium">ایندکس یکتا (UNIQUE Index)</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 text-[11px] font-medium mb-1.5">
              ستون‌های تحت پوشش ایندکس:
            </label>
            <div className="flex flex-wrap gap-2">
              {columns.map((col) => {
                const isSelected = selectedColumns.includes(col.name);
                return (
                  <button
                    key={col.name}
                    type="button"
                    onClick={() => handleToggleColumn(col.name)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono transition ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 font-semibold shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>{col.name}</span>
                    <span className="text-[10px] opacity-75">({col.dataType})</span>
                  </button>
                );
              })}
            </div>
            {selectedColumns.length > 0 && (
              <p className="text-[11px] text-emerald-700 mt-2 font-mono" dir="ltr">
                Index: ({selectedColumns.join(', ')})
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                setIsAddingIndex(false);
                setSelectedColumns([]);
              }}
              className="px-3.5 py-1.5 rounded-lg text-slate-600 hover:bg-slate-200 transition"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs transition disabled:opacity-50"
            >
              {isCreating ? 'در حال ایجاد...' : 'ثبت ایندکس'}
            </button>
          </div>
        </form>
      )}

      {/* Index List */}
      <div className="space-y-2">
        {isLoadingIndexes ? (
          <div className="text-center py-6 text-xs text-slate-400">در حال دریافت فهرست ایندکس‌ها...</div>
        ) : indexes.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            هیچ ایندکسی برای جدول {activeTable} یافت نشد.
          </div>
        ) : (
          indexes.map((idx) => {
            const isReindexing = reindexingName === idx.name;
            return (
              <div
                key={idx.name}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-slate-900" dir="ltr">
                      {idx.name}
                    </span>
                    {idx.isPrimary && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 font-medium">
                        <Key className="w-3 h-3" />
                        <span>کلید اصلی (PRIMARY)</span>
                      </span>
                    )}
                    {idx.isUnique && !idx.isPrimary && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-indigo-100 text-indigo-800 font-medium">
                        <ShieldCheck className="w-3 h-3" />
                        <span>یکتا (UNIQUE)</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-slate-600 font-mono text-[11px]" dir="ltr">
                    <span className="text-slate-400">Columns:</span>
                    <span className="bg-white px-2 py-0.5 rounded border border-slate-200 font-semibold text-slate-800">
                      {idx.columns.join(', ')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => handleReindex(idx.name)}
                    disabled={isReindexing}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-medium transition disabled:opacity-50"
                    title="بازسازی و بازچینی ایندکس (REINDEX)"
                  >
                    <RefreshCw className={`w-3 h-3 ${isReindexing ? 'animate-spin text-emerald-600' : ''}`} />
                    <span>{isReindexing ? 'در حال بازسازی...' : 'بازسازی (REINDEX)'}</span>
                  </button>

                  {!idx.isPrimary && (
                    <button
                      type="button"
                      onClick={() => setIndexToDelete(idx.name)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="حذف ایندکس"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(indexToDelete)}
        title="حذف ایندکس پایگاه داده"
        message={`آیا از حذف ایندکس «${indexToDelete}» بر روی جدول «${activeTable}» اطمینان دارید؟`}
        confirmLabel="حذف ایندکس"
        isDanger={true}
        onConfirm={() => {
          if (indexToDelete) handleDeleteIndex(indexToDelete);
        }}
        onCancel={() => setIndexToDelete(null)}
      />

      {/* Action Result Alert Modal */}
      <AlertModal
        isOpen={alertState.isOpen}
        title={alertState.title}
        message={alertState.message}
        detail={alertState.detail}
        code={alertState.code}
        type={alertState.type}
        onClose={() => setAlertState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
