import React, { useState, useEffect } from 'react';
import { X, Table as TableIcon, Plus, Trash2 } from 'lucide-react';
import { DatabaseColumn } from '../../types';

interface CreateTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (table: { name: string; columns: DatabaseColumn[] }) => void;
}

const DEFAULT_COLUMNS: DatabaseColumn[] = [
  {
    name: 'id',
    dataType: 'BIGSERIAL',
    isNullable: false,
    defaultValue: '',
    isPrimaryKey: true,
  },
  {
    name: 'created_at',
    dataType: 'TIMESTAMPTZ',
    isNullable: false,
    defaultValue: 'NOW()',
    isPrimaryKey: false,
  },
];

export const CreateTableModal: React.FC<CreateTableModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [tableName, setTableName] = useState('');
  const [columns, setColumns] = useState<DatabaseColumn[]>(DEFAULT_COLUMNS);

  useEffect(() => {
    if (isOpen) {
      setTableName('');
      setColumns(DEFAULT_COLUMNS);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddColumn = () => {
    setColumns((prev) => [
      ...prev,
      {
        name: `column_${prev.length + 1}`,
        dataType: 'VARCHAR(255)',
        isNullable: true,
        defaultValue: '',
        isPrimaryKey: false,
      },
    ]);
  };

  const handleUpdateColumn = (index: number, updated: Partial<DatabaseColumn>) => {
    setColumns((prev) =>
      prev.map((col, idx) => (idx === index ? { ...col, ...updated } : col))
    );
  };

  const handleDeleteColumn = (index: number) => {
    if (columns.length <= 1) return;
    setColumns((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableName.trim() || columns.length === 0) return;

    onCreate({
      name: tableName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      columns,
    });

    setTableName('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-table-modal-title"
    >
      <div className="relative w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 text-slate-800 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
              <TableIcon className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 id="create-table-modal-title" className="text-base font-bold text-slate-900">
                ایجاد جدول جدید در پایگاه داده
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                تعریف نام جدول، ستون‌ها و کلیدهای اصلی
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="بستن"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-medium mb-1.5">نام جدول</label>
            <input
              type="text"
              required
              placeholder="orders"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              dir="ltr"
              className="w-full px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:outline-none text-slate-900 font-mono"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-slate-700 font-medium">ستون‌های جدول</label>
              <button
                type="button"
                onClick={handleAddColumn}
                className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 text-xs font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>افزودن ستون</span>
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto p-1">
              {columns.map((col, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200"
                >
                  <input
                    type="text"
                    required
                    placeholder="نام ستون"
                    value={col.name}
                    onChange={(e) => handleUpdateColumn(idx, { name: e.target.value })}
                    dir="ltr"
                    className="w-1/3 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-900 font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />

                  <select
                    value={col.dataType}
                    onChange={(e) => handleUpdateColumn(idx, { dataType: e.target.value })}
                    dir="ltr"
                    className="w-1/3 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-900 font-mono text-xs focus:outline-none focus:border-emerald-500"
                  >
                    <option value="BIGSERIAL">BIGSERIAL</option>
                    <option value="VARCHAR(255)">VARCHAR(255)</option>
                    <option value="TEXT">TEXT</option>
                    <option value="INTEGER">INTEGER</option>
                    <option value="BIGINT">BIGINT</option>
                    <option value="BOOLEAN">BOOLEAN</option>
                    <option value="JSONB">JSONB</option>
                    <option value="TIMESTAMPTZ">TIMESTAMPTZ</option>
                  </select>

                  <label className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={col.isPrimaryKey}
                      onChange={(e) => handleUpdateColumn(idx, { isPrimaryKey: e.target.checked })}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>کلید</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => handleDeleteColumn(idx)}
                    className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition shadow-xs"
            >
              ساخت جدول
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
