import React, { useState } from 'react';
import { X, Table as TableIcon, Plus, Trash2 } from 'lucide-react';
import { DatabaseColumn } from '../../types';

interface CreateTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (table: { name: string; columns: DatabaseColumn[] }) => void;
}

export const CreateTableModal: React.FC<CreateTableModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [tableName, setTableName] = useState('');
  const [columns, setColumns] = useState<DatabaseColumn[]>([
    { name: 'id', dataType: 'BIGSERIAL', isPrimaryKey: true, isNullable: false },
    { name: 'created_at', dataType: 'TIMESTAMPTZ', isPrimaryKey: false, isNullable: false, defaultValue: 'NOW()' },
    { name: 'title', dataType: 'VARCHAR(255)', isPrimaryKey: false, isNullable: false },
  ]);

  if (!isOpen) return null;

  const handleAddColumn = () => {
    setColumns((prev) => [
      ...prev,
      {
        name: `column_${prev.length + 1}`,
        dataType: 'TEXT',
        isPrimaryKey: false,
        isNullable: true,
      },
    ]);
  };

  const handleRemoveColumn = (index: number) => {
    if (columns[index].isPrimaryKey) return; // Prevent removing PK
    setColumns((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateColumn = (index: number, updated: Partial<DatabaseColumn>) => {
    setColumns((prev) =>
      prev.map((col, i) => (i === index ? { ...col, ...updated } : col))
    );
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl p-6 text-zinc-100 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <TableIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100">ساخت جدول جدید در PostgreSQL 18</h3>
              <p className="text-xs text-zinc-400">طرحواره اختصاصی در شمای ایزوله پروژه</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-zinc-300 font-medium mb-1.5">نام جدول *</label>
            <input
              type="text"
              required
              value={tableName}
              onChange={(e) => setTableName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
              placeholder="مثال: invoices یا transactions"
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 focus:border-amber-500 focus:outline-none text-zinc-100 font-mono"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-zinc-300 font-medium">ستون‌های جدول</label>
              <button
                type="button"
                onClick={handleAddColumn}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] transition"
              >
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                <span>افزودن ستون</span>
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {columns.map((col, idx) => (
                <div
                  key={idx}
                  className="flex items-center space-x-2 p-2.5 rounded-xl bg-zinc-950 border border-zinc-800"
                >
                  <input
                    type="text"
                    value={col.name}
                    disabled={col.isPrimaryKey}
                    onChange={(e) => handleUpdateColumn(idx, { name: e.target.value })}
                    className="w-1/3 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 font-mono text-xs focus:outline-none focus:border-amber-500"
                    placeholder="نام ستون"
                  />
                  <select
                    value={col.dataType}
                    disabled={col.isPrimaryKey}
                    onChange={(e) => handleUpdateColumn(idx, { dataType: e.target.value })}
                    className="w-1/3 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 font-mono text-xs focus:outline-none focus:border-amber-500"
                  >
                    <option value="BIGSERIAL">BIGSERIAL (کلید اصلی)</option>
                    <option value="BIGINT">BIGINT (ارقام ریالی IRR)</option>
                    <option value="VARCHAR(255)">VARCHAR(255)</option>
                    <option value="TEXT">TEXT</option>
                    <option value="BOOLEAN">BOOLEAN</option>
                    <option value="JSONB">JSONB</option>
                    <option value="TIMESTAMPTZ">TIMESTAMPTZ</option>
                    <option value="UUID">UUID</option>
                  </select>
                  <label className="flex items-center space-x-1 text-[11px] text-zinc-400">
                    <input
                      type="checkbox"
                      checked={col.isNullable}
                      disabled={col.isPrimaryKey}
                      onChange={(e) => handleUpdateColumn(idx, { isNullable: e.target.checked })}
                      className="rounded border-zinc-750 bg-zinc-900 text-amber-500"
                    />
                    <span>Nullable</span>
                  </label>
                  {!col.isPrimaryKey && (
                    <button
                      type="button"
                      onClick={() => handleRemoveColumn(idx)}
                      className="p-1 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-850 transition ml-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-300 font-medium transition"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold transition shadow-lg shadow-amber-500/10"
            >
              ایجاد جدول در دیتابیس
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
