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
      <div className="p-4 rounded-xl bg-white border border-slate-200 flex items-center justify-between shadow-xs">
        <div>
          <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
            <Columns className="w-4 h-4 text-emerald-600" />
            <span>ستون‌ها و ساختار جدول: </span>
            <span className="font-mono text-emerald-700 font-bold" dir="ltr">{activeTable || 'بدون جدول'}</span>
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            مشاهده نوع داده‌ها، کلیدهای اصلی و افزودن ستون‌های جدید به ساختار جدول
          </p>
        </div>

        <button
          onClick={() => setIsAddingColumn(!isAddingColumn)}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-3.5 py-1.5 transition shadow-xs"
          disabled={!activeTable}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>افزودن ستون جدید</span>
        </button>
      </div>

      {schemaSuccessMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{schemaSuccessMsg}</span>
        </div>
      )}

      {/* Add Column Inline Form */}
      {isAddingColumn && (
        <form
          onSubmit={handleSubmit}
          className="p-4 rounded-xl bg-white border border-emerald-300 space-y-3 shadow-xs"
        >
          <div className="text-xs font-bold text-slate-900">تعریف ستون جدید در جدول</div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-slate-600 text-[11px] mb-1 font-medium">نام ستون</label>
              <input
                type="text"
                required
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                placeholder="عنوان انگلیسی ستون"
                dir="ltr"
                className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-600 text-[11px] mb-1 font-medium">نوع داده</label>
              <select
                value={newColType}
                onChange={(e) => setNewColType(e.target.value)}
                dir="ltr"
                className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500"
              >
                <option value="VARCHAR(255)">VARCHAR(255)</option>
                <option value="TEXT">TEXT</option>
                <option value="BIGINT">BIGINT</option>
                <option value="INTEGER">INTEGER</option>
                <option value="BOOLEAN">BOOLEAN</option>
                <option value="JSONB">JSONB</option>
                <option value="TIMESTAMPTZ">TIMESTAMPTZ</option>
                <option value="NUMERIC(14,2)">NUMERIC(14,2)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-600 text-[11px] mb-1 font-medium">مقدار پیش‌فرض</label>
              <input
                type="text"
                value={newColDefault}
                onChange={(e) => setNewColDefault(e.target.value)}
                placeholder="اختیاری (مثال: 'ACTIVE')"
                dir="ltr"
                className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-end pb-1.5">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={newColNullable}
                  onChange={(e) => setNewColNullable(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>مجاز به مقدار خالی (NULL)</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddingColumn(false)}
              className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs text-slate-700 transition"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition shadow-xs"
            >
              افزودن به ساختار جدول
            </button>
          </div>
        </form>
      )}

      {/* Schema Columns Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <table className="w-full text-right text-xs" dir="rtl">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
              <th className="py-2.5 px-4 text-right">نام ستون</th>
              <th className="py-2.5 px-4 text-center">نوع داده</th>
              <th className="py-2.5 px-4 text-center">پذیرش NULL</th>
              <th className="py-2.5 px-4 text-center">مقدار پیش‌فرض</th>
              <th className="py-2.5 px-4 text-center">نقش در جدول</th>
            </tr>
          </thead>
          <tbody>
            {isLoadingSchema ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400">
                  در حال بارگذاری ساختار جدول...
                </td>
              </tr>
            ) : schemaColumns.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400">
                  {activeTable ? 'هیچ ستونی برای این جدول یافت نشد.' : 'ابتدا یک جدول انتخاب نمایید.'}
                </td>
              </tr>
            ) : (
              schemaColumns.map((col) => (
                <tr key={col.name} className="border-b border-slate-100 hover:bg-slate-50 transition">
                  <td className="py-2.5 px-4 font-mono font-bold text-slate-800" dir="ltr">
                    {col.name}
                  </td>
                  <td className="py-2.5 px-4 text-center font-mono text-emerald-700" dir="ltr">
                    {col.dataType}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    {col.isNullable ? (
                      <span className="text-[11px] text-slate-500">بله</span>
                    ) : (
                      <span className="text-[11px] font-bold text-rose-600">خیر (اجباری)</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-center font-mono text-slate-600 text-[11px]" dir="ltr">
                    {col.defaultValue || '-'}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    {col.isPrimaryKey ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        <Key className="w-3 h-3 text-amber-600" />
                        کلید اصلی
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[11px]">ستون داده</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
