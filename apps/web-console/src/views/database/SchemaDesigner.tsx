import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Columns,
  Plus,
  CheckCircle2,
  Key,
  Trash2,
  Edit2,
  AlertTriangle,
  RefreshCw,
  Search,
  ExternalLink,
  Shield,
  Zap,
  Network,
  Table as TableIcon,
  Copy,
  Check,
} from 'lucide-react';
import { DatabaseColumn } from '../../types';
import { ConfirmModal } from '../../components/modals/ConfirmModal';
import { SchemaPoliciesSection } from './SchemaPoliciesSection';
import { SchemaIndexesSection } from './SchemaIndexesSection';
import { SchemaRelationshipsSection } from './SchemaRelationshipsSection';

interface SchemaDesignerProps {
  projectSlug: string;
  activeTable: string;
  tables?: string[];
  onSelectTable?: (tableName: string) => void;
  onOpenCreateTableModal?: () => void;
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

type SchemaTab = 'columns' | 'relationships' | 'indexes' | 'policies' | 'danger';

export const SchemaDesigner: React.FC<SchemaDesignerProps> = ({
  projectSlug,
  activeTable,
  tables,
  onSelectTable,
  onOpenCreateTableModal,
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
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SchemaTab>('columns');
  const [columnSearch, setColumnSearch] = useState('');
  const [copiedTableName, setCopiedTableName] = useState(false);

  // New Column State
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

  const handleCopyTable = () => {
    if (!activeTable) return;
    navigator.clipboard.writeText(activeTable);
    setCopiedTableName(true);
    setTimeout(() => setCopiedTableName(false), 2000);
  };

  const handleApplyPreset = (preset: { name: string; type: string; nullable: boolean; defaultVal?: string }) => {
    setNewColName(preset.name);
    setNewColType(preset.type);
    setNewColNullable(preset.nullable);
    setNewColDefault(preset.defaultVal || '');
  };

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

  const filteredColumns = schemaColumns.filter(
    (c) =>
      c.name.toLowerCase().includes(columnSearch.trim().toLowerCase()) ||
      c.dataType.toLowerCase().includes(columnSearch.trim().toLowerCase())
  );

  const getTypeBadgeClass = (dataType: string) => {
    const dt = dataType.toLowerCase();
    if (dt.includes('int') || dt.includes('serial') || dt.includes('numeric')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (dt.includes('bool')) {
      return 'bg-purple-50 text-purple-700 border-purple-200';
    }
    if (dt.includes('time') || dt.includes('date')) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    if (dt.includes('json')) {
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div className="space-y-5">
      {/* Top Table Control & Header Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <TableIcon className="w-5 h-5" />
            </span>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-slate-900 font-mono" dir="ltr">
                {activeTable || 'بدون جدول'}
              </span>
              {activeTable && (
                <button
                  onClick={handleCopyTable}
                  className="p-1 rounded text-slate-400 hover:text-slate-600 transition"
                  title="کپی نام جدول"
                >
                  {copiedTableName ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>

            {/* Standardized Table Selector Dropdown */}
            {tables && tables.length > 0 && onSelectTable && (
              <div className="inline-flex items-center gap-1 mr-2">
                <span className="text-[11px] text-slate-500 font-medium">تغییر جدول:</span>
                <select
                  value={activeTable}
                  onChange={(e) => onSelectTable(e.target.value)}
                  className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-emerald-700 font-bold focus:outline-none focus:border-emerald-500 shadow-xs"
                  dir="ltr"
                >
                  {tables.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
            <span>تعداد ستون‌ها: <strong className="text-slate-800 font-mono">{schemaColumns.length}</strong></span>
            <span>•</span>
            <span>کلید اصلی: <strong className="text-amber-700 font-mono">{schemaColumns.find((c) => c.isPrimaryKey)?.name || 'id'}</strong></span>
            <span>•</span>
            <span className="text-slate-400 font-mono" dir="ltr">prj_{projectSlug}.{activeTable}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {activeTable && (
            <button
              onClick={() => navigate(`/panel/${projectSlug}/database/grid?table=${encodeURIComponent(activeTable)}`)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium text-xs px-3.5 py-2 transition"
              title="مشاهده داده‌ها در نمای گرید"
            >
              <span>مشاهده داده‌ها</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
            </button>
          )}
          {onRefreshSchema && (
            <button
              onClick={onRefreshSchema}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium text-xs px-3.5 py-2 transition"
              title="بازخوانی ساختار"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSchema ? 'animate-spin' : ''}`} />
              <span>بازخوانی</span>
            </button>
          )}
          {onOpenCreateTableModal && (
            <button
              onClick={onOpenCreateTableModal}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-4 py-2 transition shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>جدول جدید</span>
            </button>
          )}
        </div>
      </div>

      {schemaSuccessMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{schemaSuccessMsg}</span>
        </div>
      )}

      {/* Schema Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('columns')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
            activeTab === 'columns'
              ? 'border-emerald-600 text-emerald-700 bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Columns className="w-4 h-4" />
          <span>ستون‌ها ({schemaColumns.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('relationships')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
            activeTab === 'relationships'
              ? 'border-emerald-600 text-emerald-700 bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Network className="w-4 h-4" />
          <span>روابط و کلید خارجی</span>
        </button>

        <button
          onClick={() => setActiveTab('indexes')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
            activeTab === 'indexes'
              ? 'border-emerald-600 text-emerald-700 bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>ایندکس‌ها</span>
        </button>

        <button
          onClick={() => setActiveTab('policies')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
            activeTab === 'policies'
              ? 'border-emerald-600 text-emerald-700 bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>امنیت سطرها (RLS)</span>
        </button>

        <button
          onClick={() => setActiveTab('danger')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition mr-auto ${
            activeTab === 'danger'
              ? 'border-rose-600 text-rose-700 bg-white'
              : 'border-transparent text-slate-400 hover:text-rose-600 hover:bg-rose-50/50'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>منطقه خطر</span>
        </button>
      </div>

      {/* Tab 1: Columns */}
      {activeTab === 'columns' && (
        <div className="space-y-4">
          {/* Columns Toolbar: Search & Add Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                value={columnSearch}
                onChange={(e) => setColumnSearch(e.target.value)}
                placeholder="جستجو در نام و نوع ستون‌ها..."
                className="w-full pl-3 pr-8 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              onClick={() => setIsAddingColumn(!isAddingColumn)}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition shadow-xs"
              disabled={!activeTable}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>تعریف ستون جدید</span>
            </button>
          </div>

          {/* Add Column Form with Presets */}
          {isAddingColumn && (
            <form
              onSubmit={handleAddSubmit}
              className="p-5 rounded-2xl bg-white border border-emerald-300 shadow-xs space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-emerald-600" />
                  <span>تعریف ستون جدید در جدول {activeTable}</span>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-400 font-medium">الگوهای آماده:</span>
                  {[
                    { name: 'title', type: 'VARCHAR(255)', nullable: false },
                    { name: 'description', type: 'TEXT', nullable: true },
                    { name: 'status', type: 'VARCHAR(50)', nullable: false, defaultVal: "'ACTIVE'" },
                    { name: 'is_active', type: 'BOOLEAN', nullable: false, defaultVal: 'true' },
                    { name: 'metadata', type: 'JSONB', nullable: true, defaultVal: "'{}'" },
                  ].map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => handleApplyPreset(p)}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-mono text-slate-700 transition"
                    >
                      +{p.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block text-slate-600 text-[11px] mb-1 font-medium">نام ستون</label>
                  <input
                    type="text"
                    required
                    value={newColName}
                    onChange={(e) => setNewColName(e.target.value)}
                    placeholder="مثال: status"
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
                    <option value="UUID">UUID</option>
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

          {/* Edit Column Modal / Form */}
          {editingCol && (
            <form
              onSubmit={handleEditSubmit}
              className="p-5 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-3 shadow-xs"
            >
              <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <Edit2 className="w-3.5 h-3.5 text-amber-600" />
                <span>ویرایش ستون: <span className="font-mono">{editingCol.name}</span></span>
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
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      در حال بارگذاری ساختار جدول...
                    </td>
                  </tr>
                ) : filteredColumns.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      {columnSearch ? 'هیچ ستونی مطابق عبارت جستجو یافت نشد.' : 'هیچ ستونی برای این جدول یافت نشد.'}
                    </td>
                  </tr>
                ) : (
                  filteredColumns.map((col) => (
                    <tr key={col.name} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900" dir="ltr">
                        <div className="flex items-center gap-1.5">
                          {col.isPrimaryKey && <Key className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                          <span>{col.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono" dir="ltr">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${getTypeBadgeClass(col.dataType)}`}>
                          {col.dataType}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {col.isNullable ? (
                          <span className="text-[11px] text-slate-500">بله (NULL)</span>
                        ) : (
                          <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            خیر (NOT NULL)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-slate-600 text-[11px]" dir="ltr">
                        {col.defaultValue || '-'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {col.isPrimaryKey ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <Key className="w-3 h-3 text-amber-600" />
                            کلید اصلی
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">ستون داده</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
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
        </div>
      )}

      {/* Tab 2: Relationships */}
      {activeTab === 'relationships' && (
        <SchemaRelationshipsSection
          projectSlug={projectSlug}
          activeTable={activeTable}
          tables={tables}
          columns={schemaColumns}
        />
      )}

      {/* Tab 3: Indexes */}
      {activeTab === 'indexes' && (
        <SchemaIndexesSection
          projectSlug={projectSlug}
          activeTable={activeTable}
          columns={schemaColumns}
        />
      )}

      {/* Tab 4: Policies (RLS) */}
      {activeTab === 'policies' && (
        <SchemaPoliciesSection projectSlug={projectSlug} activeTable={activeTable} />
      )}

      {/* Tab 5: Danger Zone */}
      {activeTab === 'danger' && (
        <div className="p-6 rounded-2xl bg-rose-50/50 border border-rose-200 shadow-xs space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-rose-200 text-rose-800 font-bold text-xs">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>عملیات غیرقابل بازگشت روی جدول {activeTable}</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="font-semibold text-xs text-slate-900">پاکسازی کامل داده‌ها (Truncate)</div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                تمامی رکوردهای این جدول حذف می‌گردند ولی ساختار، ستون‌ها و ایندکس‌ها حفظ می‌شوند.
              </p>
            </div>
            <button
              onClick={() => setShowTruncateModal(true)}
              className="px-4 py-2 rounded-xl bg-white border border-rose-300 text-rose-700 hover:bg-rose-100 text-xs font-medium transition"
            >
              پاکسازی رکوردهای جدول
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-rose-100">
            <div>
              <div className="font-semibold text-xs text-rose-900">حذف دائم جدول (Drop Table)</div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                جدول به همراه تمامی داده‌ها، ایندکس‌ها و قوانین RLS مرتبط به صورت دائم نابود خواهد شد.
              </p>
            </div>
            <button
              onClick={() => setShowDropTableModal(true)}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition shadow-xs"
            >
              حذف دائم جدول
            </button>
          </div>
        </div>
      )}

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
