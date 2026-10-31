import React, { useState, useEffect, useCallback } from 'react';
import { GitFork, Plus, Trash2, RefreshCw, ArrowLeft } from 'lucide-react';
import { TableRelationship, DatabaseColumn } from '../../types';
import { ConfirmModal } from '../../components/modals/ConfirmModal';
import { AlertModal } from '../../components/modals/AlertModal';

interface SchemaRelationshipsSectionProps {
  projectSlug: string;
  activeTable: string;
  tables?: string[];
  columns?: DatabaseColumn[];
}

export const SchemaRelationshipsSection: React.FC<SchemaRelationshipsSectionProps> = ({
  projectSlug,
  activeTable,
  tables = [],
  columns = [],
}) => {
  const [relationships, setRelationships] = useState<TableRelationship[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [sourceColumn, setSourceColumn] = useState('');
  const [targetTable, setTargetTable] = useState('');
  const [targetColumn, setTargetColumn] = useState('id');
  const [onDelete, setOnDelete] = useState('NO ACTION');
  const [onUpdate, setOnUpdate] = useState('NO ACTION');

  // Deletion modal state
  const [relToDelete, setRelToDelete] = useState<TableRelationship | null>(null);

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

  const fetchRelationships = useCallback(async () => {
    if (!activeTable) return;
    setIsLoading(true);
    try {
      const res = await fetch(
        `/_baas/v1/${projectSlug}/db/tables/${encodeURIComponent(activeTable)}/relationships`
      );
      if (res.ok) {
        const data = await res.json();
        setRelationships(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch relationships:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeTable, projectSlug]);

  useEffect(() => {
    fetchRelationships();
  }, [fetchRelationships]);

  useEffect(() => {
    if (columns.length > 0 && !sourceColumn) {
      // Find a column ending with _id or default to first
      const fkCandidate = columns.find((c) => c.name.endsWith('_id') && c.name !== 'id');
      setSourceColumn(fkCandidate ? fkCandidate.name : columns[0].name);
    }
    if (tables.length > 0 && !targetTable) {
      const otherTable = tables.find((t) => t !== activeTable) || tables[0];
      setTargetTable(otherTable);
    }
  }, [columns, tables, activeTable, sourceColumn, targetTable]);

  const handleCreateRelationship = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceColumn || !targetTable || !targetColumn || !activeTable) {
      setAlertState({
        isOpen: true,
        title: 'اطلاعات رابطه ناقص است',
        message: 'لطفاً تمامی فیلدهای الزامی کلید خارجی را تکمیل نمایید.',
        type: 'error',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(
        `/_baas/v1/${projectSlug}/db/tables/${encodeURIComponent(activeTable)}/relationships`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceColumn,
            targetTable,
            targetColumn,
            onDelete,
            onUpdate,
          }),
        }
      );

      const body = await res.json().catch(() => null);

      if (res.ok) {
        setIsAdding(false);
        fetchRelationships();
        setAlertState({
          isOpen: true,
          title: 'رابطه با موفقیت ایجاد شد',
          message: `کلید خارجی میان «${activeTable}.${sourceColumn}» و «${targetTable}.${targetColumn}» برقرار گردید.`,
          type: 'success',
        });
      } else {
        setAlertState({
          isOpen: true,
          title: 'خطا در ایجاد رابطه کلید خارجی',
          message: body?.error || 'ایجاد رابطه در پایگاه داده ناموفق بود.',
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
      setIsSubmitting(false);
    }
  };

  const handleDeleteRelationship = async (constraintName: string) => {
    try {
      const res = await fetch(
        `/_baas/v1/${projectSlug}/db/tables/${encodeURIComponent(activeTable)}/relationships/${encodeURIComponent(constraintName)}`,
        { method: 'DELETE' }
      );
      const body = await res.json().catch(() => null);
      if (res.ok) {
        fetchRelationships();
        setAlertState({
          isOpen: true,
          title: 'حذف رابطه موفق',
          message: `رابطه «${constraintName}» با موفقیت حذف گردید.`,
          type: 'success',
        });
      } else {
        setAlertState({
          isOpen: true,
          title: 'خطا در حذف رابطه',
          message: body?.error || 'حذف قید کلید خارجی ناموفق بود.',
          code: body?.code,
          detail: body?.detail,
          type: 'error',
        });
      }
    } catch (err) {
      setAlertState({
        isOpen: true,
        title: 'خطای ارتباط با سرور',
        message: 'خطا در حذف رابطه.',
        detail: String(err),
        type: 'error',
      });
    } finally {
      setRelToDelete(null);
    }
  };

  return (
    <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <GitFork className="w-4 h-4 text-emerald-600" />
          <div>
            <h4 className="text-xs font-bold text-slate-900">روابط جدول‌ها (Foreign Keys & Relations)</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              مدیریت و اتصال کلیدهای خارجی، یکپارچگی ارجاعی و رفتار Cascade در حذف یا تغییر
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchRelationships}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            title="بروزرسانی روابط"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setIsAdding(!isAdding)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-medium transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>تعریف رابطه جدید (Foreign Key)</span>
          </button>
        </div>
      </div>

      {/* Add Relation Form */}
      {isAdding && (
        <form
          onSubmit={handleCreateRelationship}
          className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4 text-xs animate-in fade-in duration-150"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-slate-700 text-[11px] font-medium mb-1">
                ستون این جدول (Source Column):
              </label>
              <select
                value={sourceColumn}
                onChange={(e) => setSourceColumn(e.target.value)}
                dir="ltr"
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
              >
                {columns.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.dataType})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 text-[11px] font-medium mb-1">
                جدول مقصد (Target Table):
              </label>
              <select
                value={targetTable}
                onChange={(e) => setTargetTable(e.target.value)}
                dir="ltr"
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
              >
                {tables.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 text-[11px] font-medium mb-1">
                ستون مقصد (Target Column):
              </label>
              <input
                type="text"
                required
                value={targetColumn}
                onChange={(e) => setTargetColumn(e.target.value)}
                placeholder="id"
                dir="ltr"
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 text-[11px] font-medium mb-1">
                رفتار هنگام حذف (ON DELETE):
              </label>
              <select
                value={onDelete}
                onChange={(e) => setOnDelete(e.target.value)}
                dir="ltr"
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
              >
                <option value="NO ACTION">NO ACTION</option>
                <option value="CASCADE">CASCADE (حذف آبشاری)</option>
                <option value="SET NULL">SET NULL (تنظیم به تهی)</option>
                <option value="RESTRICT">RESTRICT (ممانعت از حذف)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 text-[11px] font-medium mb-1">
                رفتار هنگام تغییر (ON UPDATE):
              </label>
              <select
                value={onUpdate}
                onChange={(e) => setOnUpdate(e.target.value)}
                dir="ltr"
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
              >
                <option value="NO ACTION">NO ACTION</option>
                <option value="CASCADE">CASCADE (بروزرسانی آبشاری)</option>
                <option value="RESTRICT">RESTRICT (ممانعت از تغییر)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-200">
            <div className="text-[11px] text-slate-600 font-mono flex items-center gap-1.5" dir="ltr">
              <span className="text-slate-400">Preview:</span>
              <span className="font-semibold text-emerald-800">
                {activeTable}.{sourceColumn || '?'} &rarr; {targetTable || '?'}.{targetColumn || '?'}
              </span>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-3.5 py-1.5 rounded-lg text-slate-600 hover:bg-slate-200 transition"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs transition disabled:opacity-50"
              >
                {isSubmitting ? 'در حال ایجاد رابطه...' : 'ثبت رابطه'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Relationships List */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="text-center py-6 text-xs text-slate-400">در حال دریافت فهرست روابط...</div>
        ) : relationships.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            هیچ کلید خارجی برای جدول {activeTable} تعریف نشده است.
          </div>
        ) : (
          relationships.map((rel) => (
            <div
              key={rel.constraintName}
              className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-slate-900" dir="ltr">
                    {rel.constraintName}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-slate-200 text-slate-700 font-mono" dir="ltr">
                    ON DELETE: {rel.onDelete}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-slate-700 font-mono text-[11px]" dir="ltr">
                  <span className="bg-white px-2 py-0.5 rounded border border-slate-200 font-semibold text-emerald-700">
                    {rel.sourceTable}.{rel.sourceColumn}
                  </span>
                  <ArrowLeft className="w-3.5 h-3.5 text-slate-400 rotate-180" />
                  <span className="bg-white px-2 py-0.5 rounded border border-slate-200 font-semibold text-blue-700">
                    {rel.targetTable}.{rel.targetColumn}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => setRelToDelete(rel)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                  title="حذف رابطه کلید خارجی"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(relToDelete)}
        title="حذف رابطه کلید خارجی"
        message={`آیا از حذف قید کلید خارجی «${relToDelete?.constraintName}» اطمینان دارید؟`}
        confirmLabel="حذف رابطه"
        isDanger={true}
        onConfirm={() => {
          if (relToDelete) handleDeleteRelationship(relToDelete.constraintName);
        }}
        onCancel={() => setRelToDelete(null)}
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
