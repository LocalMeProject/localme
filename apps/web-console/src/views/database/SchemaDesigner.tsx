import React, { useState } from 'react';
import { Columns, Plus, CheckCircle2, Key } from 'lucide-react';
import { DatabaseColumn } from '../../types';

interface SchemaDesignerProps {
  activeTable: string;
  schemaColumns: DatabaseColumn[];
  isLoadingSchema: boolean;
  schemaSuccessMsg: string | null;
  onAddColumn: (name: string, type: string, nullable: boolean, defaultVal: string) => Promise<boolean>;
}

export const SchemaDesigner: React.FC<SchemaDesignerProps> = ({
  activeTable,
  schemaColumns,
  isLoadingSchema,
  schemaSuccessMsg,
  onAddColumn,
}) => {
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState('VARCHAR(255)');
  const [newColNullable, setNewColNullable] = useState(true);
  const [newColDefault, setNewColDefault] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim() || !activeTable) return;
    const ok = await onAddColumn(newColName.trim(), newColType, newColNullable, newColDefault.trim());
    if (ok) {
      setIsAddingColumn(false);
      setNewColName('');
      setNewColDefault('');
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-[#171717] border border-[#242424] flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-white flex items-center gap-2">
            <Columns className="w-4 h-4 text-[#3ECF8E]" />
            <span>ستون‌های جدول: </span>
            <span className="font-mono text-[#3ECF8E]">{activeTable || 'بدون جدول'}</span>
          </h3>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            تعریف مستقیم تایپ‌ها، کلید اصلی و محدودیت‌های یکپارچگی در اسکیما
          </p>
        </div>

        <button
          onClick={() => setIsAddingColumn(!isAddingColumn)}
          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#3ECF8E] hover:bg-[#34b27b] text-[#0f0f0f] font-medium text-xs px-3.5 py-1.5 transition-colors"
          disabled={!activeTable}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ افزودن ستون</span>
        </button>
      </div>

      {schemaSuccessMsg && (
        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-[#3ECF8E] text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{schemaSuccessMsg}</span>
        </div>
      )}

      {/* Add Column Inline Form */}
      {isAddingColumn && (
        <form
          onSubmit={handleSubmit}
          className="p-4 rounded-xl bg-[#171717] border border-[#3ECF8E]/40 space-y-3"
        >
          <div className="text-xs font-bold text-white">افزودن ستون جدید (DDL Generator)</div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-zinc-400 text-[11px] mb-1">نام ستون</label>
              <input
                type="text"
                required
                placeholder="e.g. user_age"
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-[#0f0f0f] border border-[#242424] font-mono text-zinc-200 focus:outline-none focus:border-[#3ECF8E]"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-zinc-400 text-[11px] mb-1">نوع داده (Data Type)</label>
              <select
                value={newColType}
                onChange={(e) => setNewColType(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-[#0f0f0f] border border-[#242424] font-mono text-zinc-200 focus:outline-none focus:border-[#3ECF8E]"
                dir="ltr"
              >
                <option value="VARCHAR(255)">VARCHAR(255)</option>
                <option value="TEXT">TEXT</option>
                <option value="INTEGER">INTEGER</option>
                <option value="BIGINT">BIGINT</option>
                <option value="BOOLEAN">BOOLEAN</option>
                <option value="JSONB">JSONB</option>
                <option value="TIMESTAMPTZ">TIMESTAMPTZ</option>
                <option value="UUID">UUID</option>
                <option value="NUMERIC(14,2)">NUMERIC(14,2)</option>
              </select>
            </div>
            <div>
              <label className="block text-zinc-400 text-[11px] mb-1">مقدار پیش‌فرض (اختیاری)</label>
              <input
                type="text"
                placeholder="e.g. 'active' or NOW()"
                value={newColDefault}
                onChange={(e) => setNewColDefault(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-[#0f0f0f] border border-[#242424] font-mono text-zinc-200 focus:outline-none focus:border-[#3ECF8E]"
                dir="ltr"
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="colNullable"
                checked={newColNullable}
                onChange={(e) => setNewColNullable(e.target.checked)}
                className="rounded border-[#242424] text-[#3ECF8E] focus:ring-[#3ECF8E]"
              />
              <label htmlFor="colNullable" className="text-zinc-300 text-xs cursor-pointer">
                تهی‌پذیر (NULL)
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#242424]">
            <button
              type="button"
              onClick={() => setIsAddingColumn(false)}
              className="rounded-full bg-[#242424] hover:bg-[#2e2e2e] text-[#ededed] border border-[#2e2e2e] font-medium text-xs px-3.5 py-1.5 transition-colors"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-full bg-[#3ECF8E] hover:bg-[#34b27b] text-[#0f0f0f] font-medium text-xs px-3.5 py-1.5 transition-colors"
            >
              اعمال DDL در دیتابیس
            </button>
          </div>
        </form>
      )}

      {/* Schema Table */}
      <div className="rounded-xl border border-[#242424] bg-[#171717] overflow-hidden">
        <div className="overflow-x-auto" dir="ltr">
          <table className="w-full text-left text-xs font-mono" dir="ltr">
            <thead>
              <tr className="border-b border-[#242424] bg-[#1a1a1a] text-zinc-400">
                <th className="py-2.5 px-3">Column Name</th>
                <th className="py-2.5 px-3">Data Type</th>
                <th className="py-2.5 px-3">Key</th>
                <th className="py-2.5 px-3">Nullable</th>
                <th className="py-2.5 px-3">Default Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#242424]">
              {isLoadingSchema ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-zinc-500">
                    در حال بررسی ساختار اسکیما...
                  </td>
                </tr>
              ) : schemaColumns.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-zinc-500">
                    ستونی در این جدول ثبت نشده است.
                  </td>
                </tr>
              ) : (
                schemaColumns.map((c) => (
                  <tr key={c.name} className="hover:bg-[#1f1f1f] transition">
                    <td className="py-2.5 px-3 font-bold text-white">{c.name}</td>
                    <td className="py-2.5 px-3 text-[#3ECF8E] font-mono">{c.dataType}</td>
                    <td className="py-2.5 px-3">
                      {c.isPrimaryKey ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-[#3ECF8E]/10 text-[#3ECF8E] font-bold border border-[#3ECF8E]/30 font-mono">
                          <Key className="w-3 h-3" />
                          PK
                        </span>
                      ) : (
                        <span className="text-zinc-600">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {c.isNullable ? (
                        <span className="text-zinc-400">NULL</span>
                      ) : (
                        <span className="text-[#3ECF8E] font-semibold">NOT NULL</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-zinc-400">
                      {c.defaultValue || <span className="text-zinc-600 italic">none</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
