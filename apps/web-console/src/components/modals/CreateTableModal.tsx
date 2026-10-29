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

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-table-modal-title"
    >
      <div className="relative w-full max-w-2xl rounded-2xl bg-[#171717] border border-[#242424] shadow-2xl p-6 text-zinc-100 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-[#242424]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#3ECF8E]/10 border border-[#3ECF8E]/20 flex items-center justify-center text-[#3ECF8E]">
              <TableIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 id="create-table-modal-title" className="text-base font-bold text-white">ساخت جدول جدید در PostgreSQL 18</h3>
              <p className="text-xs text-zinc-400">طرحواره اختصاصی در اسکیما ایزوله پروژه</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="بستن"
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1f1f1f] transition"
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
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0f0f0f] border border-[#242424] focus:border-[#3ECF8E] focus:outline-none text-zinc-100 font-mono"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-zinc-300 font-medium">ستون‌های جدول</label>
              <button
                type="button"
                onClick={handleAddColumn}
                className="rounded-full bg-[#242424] hover:bg-[#2e2e2e] text-[#ededed] border border-[#2e2e2e] font-medium text-xs px-3 py-1 transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-[#3ECF8E]" />
                <span>افزودن ستون</span>
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {columns.map((col, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-[#0f0f0f] border border-[#242424]"
                >
                  <input
                    type="text"
                    value={col.name}
                    disabled={col.isPrimaryKey}
                    onChange={(e) => handleUpdateColumn(idx, { name: e.target.value })}
                    className="w-1/3 px-2.5 py-1.5 rounded-lg bg-[#171717] border border-[#242424] text-zinc-200 font-mono text-xs focus:outline-none focus:border-[#3ECF8E]"
                    placeholder="نام ستون"
                    dir="ltr"
                  />
                  <select
                    value={col.dataType}
                    disabled={col.isPrimaryKey}
                    onChange={(e) => handleUpdateColumn(idx, { dataType: e.target.value })}
                    className="w-1/3 px-2.5 py-1.5 rounded-lg bg-[#171717] border border-[#242424] text-zinc-200 font-mono text-xs focus:outline-none focus:border-[#3ECF8E]"
                    dir="ltr"
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
                  <label className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                    <input
                      type="checkbox"
                      checked={col.isNullable}
                      disabled={col.isPrimaryKey}
                      onChange={(e) => handleUpdateColumn(idx, { isNullable: e.target.checked })}
                      className="rounded border-[#242424] bg-[#171717] text-[#3ECF8E] focus:ring-[#3ECF8E]"
                    />
                    <span>Nullable</span>
                  </label>
                  {!col.isPrimaryKey && (
                    <button
                      type="button"
                      onClick={() => handleRemoveColumn(idx)}
                      className="p-1 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-[#1f1f1f] transition ml-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-[#242424]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-[#242424] hover:bg-[#2e2e2e] text-[#ededed] border border-[#2e2e2e] font-medium text-xs px-4 py-2 transition-colors"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-full bg-[#3ECF8E] hover:bg-[#34b27b] text-[#0f0f0f] font-medium text-xs px-5 py-2 transition-colors"
            >
              ایجاد جدول در دیتابیس
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
