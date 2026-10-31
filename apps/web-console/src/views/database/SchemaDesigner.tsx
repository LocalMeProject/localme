import React, { useState, useEffect } from 'react';
import {
  Columns,
  Plus,
  CheckCircle2,
  Key,
  Trash2,
  Edit2,
  Shield,
  Layers,
  AlertTriangle,
} from 'lucide-react';
import { DatabaseColumn } from '../../types';
import { ConfirmModal } from '../../components/modals/ConfirmModal';

interface TablePolicy {
  name: string;
  tableName: string;
  command: string;
  roles: string;
  usingExpression: string;
  checkExpression?: string | null;
}

interface SchemaDesignerProps {
  projectSlug: string;
  activeTable: string;
  schemaColumns: DatabaseColumn[];
  isLoadingSchema: boolean;
  schemaSuccessMsg: string | null;
  onAddColumn: (name: string, type: string, nullable: boolean, defaultVal: string) => Promise<boolean>;
  onDropColumn?: (columnName: string) => Promise<boolean>;
  onAlterColumn?: (oldName: string, newName: string, type: string, nullable: boolean, defaultVal: string) => Promise<boolean>;
  onDropTable?: (tableName: string) => Promise<boolean>;
  onTruncateTable?: (tableName: string) => Promise<boolean>;
  onRefreshSchema?: () => void;
}

export const SchemaDesigner: React.FC<SchemaDesignerProps> = ({
  projectSlug,
  activeTable,
  schemaColumns,
  isLoadingSchema,
  schemaSuccessMsg,
  onAddColumn,
  onDropColumn,
  onAlterColumn,
  onDropTable,
  onTruncateTable,
  onRefreshSchema,
}) => {
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState('VARCHAR(255)');
  const [newColNullable, setNewColNullable] = useState(true);
  const [newColDefault, setNewColDefault] = useState('');

  // Editing Column State
  const [editingCol, setEditingCol] = useState<DatabaseColumn | null>(null);
  const [editColName, setEditColName] = useState('');
  const [editColType, setEditColType] = useState('');
  const [editColNullable, setEditColNullable] = useState(true);

  // Deletion modals
  const [colToDelete, setColToDelete] = useState<string | null>(null);
  const [showDropTableModal, setShowDropTableModal] = useState(false);
  const [showTruncateModal, setShowTruncateModal] = useState(false);

  // RLS Policies State
  const [policies, setPolicies] = useState<TablePolicy[]>([]);
  const [isLoadingPolicies, setIsLoadingPolicies] = useState(false);
  const [isAddingPolicy, setIsAddingPolicy] = useState(false);
  const [newPolicyName, setNewPolicyName] = useState('');
  const [newPolicyCmd, setNewPolicyCmd] = useState('ALL');
  const [newPolicyRole, setNewPolicyRole] = useState('authenticated');
  const [newPolicyUsing, setNewPolicyUsing] = useState('true');

  // Index Creation State
  const [isAddingIndex, setIsAddingIndex] = useState(false);
  const [newIndexName, setNewIndexName] = useState('');
  const [newIndexCol, setNewIndexCol] = useState('');
  const [newIndexUnique, setNewIndexUnique] = useState(false);

  const fetchPolicies = async () => {
    if (!activeTable) return;
    setIsLoadingPolicies(true);
    try {
      const res = await fetch(`/_baas/v1/${projectSlug}/db/tables/${activeTable}/policies`);
      if (res.ok) {
        const data = await res.json();
        setPolicies(Array.isArray(data) ? data : []);
      }
    } catch {
      setPolicies([]);
    } finally {
      setIsLoadingPolicies(false);
    }
  };

  useEffect(() => {
    if (activeTable) {
      fetchPolicies();
    }
  }, [activeTable, projectSlug]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim() || !activeTable) return;
    const ok = await onAddColumn(newColName.trim(), newColType, newColNullable, newColDefault.trim());
    if (ok) {
      setIsAddingColumn(false);
      setNewColName('');
      setNewColDefault('');
      onRefreshSchema?.();
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCol || !editColName.trim() || !onAlterColumn) return;
    const ok = await onAlterColumn(
      editingCol.name,
      editColName.trim(),
      editColType,
      editColNullable,
      editingCol.defaultValue || ''
    );
    if (ok) {
      setEditingCol(null);
      onRefreshSchema?.();
    }
  };

  const handleCreateIndex = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIndexCol || !activeTable) return;
    const name = newIndexName.trim() || `idx_${activeTable}_${newIndexCol}`;
    try {
      const res = await fetch(`/_baas/v1/${projectSlug}/db/tables/${activeTable}/indexes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          columns: [newIndexCol],
          isUnique: newIndexUnique,
        }),
      });
      if (res.ok) {
        setIsAddingIndex(false);
        setNewIndexName('');
        alert('ایندکس با موفقیت ایجاد گردید.');
      } else {
        const err = await res.json();
        alert(`خطا: ${err.error || 'ایجاد ایندکس ناموفق بود'}`);
      }
    } catch (err) {
      alert(`خطا در ایجاد ایندکس: ${String(err)}`);
    }
  };

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPolicyName.trim() || !activeTable) return;
    try {
      const res = await fetch(`/_baas/v1/${projectSlug}/db/tables/${activeTable}/policies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPolicyName.trim(),
          command: newPolicyCmd,
          roles: newPolicyRole,
          usingExpression: newPolicyUsing,
        }),
      });
      if (res.ok) {
        setIsAddingPolicy(false);
        setNewPolicyName('');
        fetchPolicies();
      } else {
        const err = await res.json();
        alert(`خطا در ساخت پالیسی: ${err.error || 'ناموفق'}`);
      }
    } catch (err) {
      alert(`خطا: ${String(err)}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
            <Columns className="w-4 h-4 text-emerald-600" />
            <span>طراحی ساختار جدول: </span>
            <span className="font-mono text-emerald-700 font-bold" dir="ltr">
              {activeTable || 'بدون جدول'}
            </span>
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            مدیریت ستون‌ها، انواع داده، ایندکس‌ها، قواعد امنیت در سطح سطر (RLS) و ساختار دیتابیس
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddingIndex(!isAddingIndex)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium text-xs px-3 py-1.5 transition"
            disabled={!activeTable}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>ایجاد ایندکس</span>
          </button>
          <button
            onClick={() => setIsAddingColumn(!isAddingColumn)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-3.5 py-1.5 transition shadow-xs"
            disabled={!activeTable}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>افزودن ستون جدید</span>
          </button>
        </div>
      </div>

      {schemaSuccessMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{schemaSuccessMsg}</span>
        </div>
      )}

      {/* Add Index Inline Form */}
      {isAddingIndex && (
        <form
          onSubmit={handleCreateIndex}
          className="p-4 rounded-xl bg-white border border-emerald-200 space-y-3 shadow-xs"
        >
          <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-600" />
            <span>ایجاد ایندکس جدید روی جدول {activeTable}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block text-slate-600 text-[11px] mb-1 font-medium">نام ایندکس (اختیاری)</label>
              <input
                type="text"
                value={newIndexName}
                onChange={(e) => setNewIndexName(e.target.value)}
                placeholder={`idx_${activeTable}_col`}
                dir="ltr"
                className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-slate-600 text-[11px] mb-1 font-medium">انتخاب ستون</label>
              <select
                value={newIndexCol}
                onChange={(e) => setNewIndexCol(e.target.value)}
                required
                dir="ltr"
                className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono focus:outline-none focus:border-emerald-500"
              >
                <option value="">-- انتخاب ستون --</option>
                {schemaColumns.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={newIndexUnique}
                  onChange={(e) => setNewIndexUnique(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>یکتا (UNIQUE INDEX)</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddingIndex(false)}
              className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs text-slate-700 transition"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition shadow-xs"
            >
              ساخت ایندکس
            </button>
          </div>
        </form>
      )}

      {/* Add Column Inline Form */}
      {isAddingColumn && (
        <form
          onSubmit={handleAddSubmit}
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

      {/* Edit Column Form Modal */}
      {editingCol && (
        <form
          onSubmit={handleEditSubmit}
          className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 space-y-3 shadow-xs"
        >
          <div className="text-xs font-bold text-amber-900">
            ویرایش ستون: <span className="font-mono">{editingCol.name}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block text-slate-600 text-[11px] mb-1 font-medium">نام جدید ستون</label>
              <input
                type="text"
                required
                value={editColName}
                onChange={(e) => setEditColName(e.target.value)}
                dir="ltr"
                className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-slate-600 text-[11px] mb-1 font-medium">نوع داده</label>
              <input
                type="text"
                required
                value={editColType}
                onChange={(e) => setEditColType(e.target.value)}
                dir="ltr"
                className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={editColNullable}
                  onChange={(e) => setEditColNullable(e.target.checked)}
                  className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                />
                <span>پذیرش مقدار خالی (NULL)</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-amber-100">
            <button
              type="button"
              onClick={() => setEditingCol(null)}
              className="px-3.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-xs text-slate-700 transition"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium transition shadow-xs"
            >
              ذخیره تغییرات ستون
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
              <th className="py-2.5 px-4 text-center">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoadingSchema ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  در حال بارگذاری ساختار جدول...
                </td>
              </tr>
            ) : schemaColumns.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  {activeTable ? 'هیچ ستونی برای این جدول یافت نشد.' : 'ابتدا یک جدول انتخاب نمایید.'}
                </td>
              </tr>
            ) : (
              schemaColumns.map((col) => (
                <tr key={col.name} className="hover:bg-slate-50/70 transition">
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
                  <td className="py-2.5 px-4 text-center">
                    {!col.isPrimaryKey && (
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => {
                            setEditingCol(col);
                            setEditColName(col.name);
                            setEditColType(col.dataType);
                            setEditColNullable(col.isNullable);
                          }}
                          className="p-1 rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition"
                          title="ویرایش مشخصات ستون"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setColToDelete(col.name)}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          title="حذف ستون"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Row Level Security (RLS) Policies Section */}
      <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-600" />
            <h4 className="text-xs font-bold text-slate-900">امنیت در سطح سطر (Row-Level Security - RLS)</h4>
          </div>
          <button
            onClick={() => setIsAddingPolicy(!isAddingPolicy)}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium transition"
          >
            <Plus className="w-3 h-3" />
            <span>قاعده امنیتی جدید</span>
          </button>
        </div>

        {isAddingPolicy && (
          <form
            onSubmit={handleCreatePolicy}
            className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs"
          >
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-slate-600 text-[11px] mb-1">نام قاعده (Policy Name)</label>
                <input
                  type="text"
                  required
                  value={newPolicyName}
                  onChange={(e) => setNewPolicyName(e.target.value)}
                  placeholder="user_access_rule"
                  dir="ltr"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-600 text-[11px] mb-1">دستور مجاز</label>
                <select
                  value={newPolicyCmd}
                  onChange={(e) => setNewPolicyCmd(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 font-mono"
                >
                  <option value="ALL">ALL (تمامی دستورات)</option>
                  <option value="SELECT">SELECT</option>
                  <option value="INSERT">INSERT</option>
                  <option value="UPDATE">UPDATE</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-600 text-[11px] mb-1">نقش کاربری (Role)</label>
                <select
                  value={newPolicyRole}
                  onChange={(e) => setNewPolicyRole(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 font-mono"
                >
                  <option value="authenticated">authenticated</option>
                  <option value="anon">anon</option>
                  <option value="public">public</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-600 text-[11px] mb-1">شرط دسترسی (USING)</label>
                <input
                  type="text"
                  required
                  value={newPolicyUsing}
                  onChange={(e) => setNewPolicyUsing(e.target.value)}
                  placeholder="auth.uid() = user_id"
                  dir="ltr"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsAddingPolicy(false)}
                className="px-3 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="px-3.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
              >
                ثبت قاعده RLS
              </button>
            </div>
          </form>
        )}

        <div className="space-y-2">
          {isLoadingPolicies ? (
            <div className="text-center py-4 text-xs text-slate-400">در حال دریافت قوانین امنیتی...</div>
          ) : policies.length === 0 ? (
            <div className="text-center py-4 text-xs text-slate-400">
              هیچ قاعده RLS فعالی برای جدول {activeTable} ثبت نشده است. (دسترسی پیش‌فرض فعال است)
            </div>
          ) : (
            policies.map((p) => (
              <div
                key={p.name}
                className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between font-mono text-xs"
                dir="ltr"
              >
                <div className="flex items-center gap-3">
                  <span className="font-bold text-slate-900">{p.name}</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px]">
                    {p.command}
                  </span>
                  <span className="text-slate-500 text-[11px]">TO {p.roles}</span>
                  <span className="text-slate-600 text-[11px]">USING ({p.usingExpression})</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Danger Zone: Truncate / Drop Table */}
      <div className="p-5 rounded-xl bg-rose-50/50 border border-rose-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-rose-200 text-rose-800 font-bold text-xs">
          <AlertTriangle className="w-4 h-4 text-rose-600" />
          <span>عملیات خطرناک روی جدول {activeTable}</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="font-semibold text-xs text-slate-900">پاکسازی کامل داده‌ها (Truncate)</div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              تمامی رکوردهای این جدول حذف می‌گردند ولی ساختار و ستون‌های جدول حفظ می‌شوند.
            </p>
          </div>
          <button
            onClick={() => setShowTruncateModal(true)}
            className="px-3.5 py-1.5 rounded-lg bg-white border border-rose-300 text-rose-700 hover:bg-rose-100 text-xs font-medium transition"
          >
            پاکسازی رکوردهای جدول
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-rose-100">
          <div>
            <div className="font-semibold text-xs text-rose-900">حذف کامل جدول (Drop Table)</div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              جدول به همراه تمامی داده‌ها، ایندکس‌ها و قوانین RLS مرتبط به صورت دائم حذف خواهد شد.
            </p>
          </div>
          <button
            onClick={() => setShowDropTableModal(true)}
            className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition shadow-xs"
          >
            حذف دائم جدول
          </button>
        </div>
      </div>

      {/* Confirm Column Deletion Modal */}
      <ConfirmModal
        isOpen={colToDelete !== null}
        title="حذف ستون از جدول"
        message={`آیا از حذف ستون "${colToDelete}" از جدول "${activeTable}" اطمینان دارید؟ تمام داده‌های ذخیره‌شده در این ستون به صورت دائم پاک خواهند شد.`}
        confirmLabel="حذف ستون"
        isDanger={true}
        onConfirm={async () => {
          if (colToDelete && onDropColumn) {
            await onDropColumn(colToDelete);
            setColToDelete(null);
            onRefreshSchema?.();
          }
        }}
        onCancel={() => setColToDelete(null)}
      />

      {/* Confirm Truncate Table Modal */}
      <ConfirmModal
        isOpen={showTruncateModal}
        title="پاکسازی کامل داده‌های جدول"
        message={`این عملیات تمام رکوردهای جدول "${activeTable}" را پاک می‌کند.`}
        confirmLabel="پاکسازی داده‌ها"
        isDanger={true}
        requiredConfirmationText={activeTable}
        onConfirm={async () => {
          if (onTruncateTable) {
            await onTruncateTable(activeTable);
            setShowTruncateModal(false);
          }
        }}
        onCancel={() => setShowTruncateModal(false)}
      />

      {/* Confirm Drop Table Modal */}
      <ConfirmModal
        isOpen={showDropTableModal}
        title="حذف دائم جدول"
        message={`این عملیات غیرقابل بازگشت است. جدول "${activeTable}" و تمامی وابستگی‌های آن به صورت کامل نابود می‌شوند.`}
        confirmLabel="حذف دائم جدول"
        isDanger={true}
        requiredConfirmationText={activeTable}
        onConfirm={async () => {
          if (onDropTable) {
            await onDropTable(activeTable);
            setShowDropTableModal(false);
          }
        }}
        onCancel={() => setShowDropTableModal(false)}
      />
    </div>
  );
};
