import React, { useState, useEffect, useCallback } from 'react';
import { Project, DatabaseColumn, DatabaseQueryHistoryItem } from '../types';
import {
  Database,
  Plus,
  RefreshCw,
  ChevronRight,
  Archive,
  Key,
  Copy,
  Check,
} from 'lucide-react';

import { TableDataGrid } from './database/TableDataGrid';
import { SchemaDesigner } from './database/SchemaDesigner';
import { SqlQueryRunner } from './database/SqlQueryRunner';

interface DatabaseViewProps {
  project: Project;
  onOpenCreateTableModal: () => void;
  activeSubView?: string;
  onSubViewChange?: (subView: string) => void;
}

type StudioTab = 'grid' | 'schema' | 'sql' | 'backups' | 'config';

export const DatabaseView: React.FC<DatabaseViewProps> = ({
  project,
  onOpenCreateTableModal,
  activeSubView,
}) => {
  const [activeTab, setActiveTab] = useState<StudioTab>('grid');
  const [tables, setTables] = useState<string[]>([]);
  const [activeTable, setActiveTable] = useState<string>('');
  const [isLoadingTables, setIsLoadingTables] = useState(false);

  // Sync with Level 2 sidebar subview
  useEffect(() => {
    if (activeSubView === 'sql') setActiveTab('sql');
    else if (activeSubView === 'schema') setActiveTab('schema');
    else if (activeSubView === 'backups') setActiveTab('backups');
    else if (activeSubView === 'config') setActiveTab('config');
    else if (activeSubView === 'grid') setActiveTab('grid');
  }, [activeSubView]);

  // Table Data Grid State
  const [tableRows, setTableRows] = useState<Record<string, unknown>[]>([]);
  const [tableColumns, setTableColumns] = useState<string[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [gridError, setGridError] = useState<string | null>(null);

  // Schema Designer State
  const [schemaColumns, setSchemaColumns] = useState<DatabaseColumn[]>([]);
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);
  const [schemaSuccessMsg, setSchemaSuccessMsg] = useState<string | null>(null);

  // SQL Studio State
  const [sqlQuery, setSqlQuery] = useState<string>('');
  const [queryResults, setQueryResults] = useState<{
    columns: string[];
    rows: Record<string, unknown>[];
    latencyMs: number;
    rowCount: number;
    error?: string;
  } | null>(null);
  const [isRunningQuery, setIsRunningQuery] = useState(false);
  const [queryHistory] = useState<DatabaseQueryHistoryItem[]>([]);

  // Copied state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Load Tables
  const fetchTables = useCallback(async () => {
    setIsLoadingTables(true);
    try {
      const res = await fetch(`/_baas/v1/${project.slug}/db/tables`);
      if (res.ok) {
        const tableList = (await res.json()) as string[];
        setTables(tableList);
        if (tableList.length > 0 && (!activeTable || !tableList.includes(activeTable))) {
          setActiveTable(tableList[0]);
        }
      } else {
        setTables([]);
      }
    } catch {
      setTables([]);
    } finally {
      setIsLoadingTables(false);
    }
  }, [project.slug, activeTable]);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  // Load Table Data
  const fetchTableData = useCallback(async (tableName: string) => {
    if (!tableName) return;
    setIsLoadingData(true);
    setGridError(null);
    try {
      const res = await fetch(`/_baas/v1/${project.slug}/rest/${tableName}?limit=50`);
      if (res.ok) {
        const rows = (await res.json()) as Record<string, unknown>[];
        setTableRows(rows);
        if (rows.length > 0) {
          setTableColumns(Object.keys(rows[0]));
        } else {
          const schemaRes = await fetch(`/_baas/v1/${project.slug}/db/schema?table=${tableName}`);
          if (schemaRes.ok) {
            const raw = await schemaRes.json();
            let rawList: Record<string, unknown>[] = [];
            if (Array.isArray(raw)) {
              rawList = raw;
            } else if (raw && typeof raw === 'object') {
              if (Array.isArray(raw[tableName])) rawList = raw[tableName];
              else if (Array.isArray(raw.columns)) rawList = raw.columns;
            }
            const cols = rawList.map((c) => String(c.name || c.Name || c.column_name || ''));
            setTableColumns(cols.length > 0 ? cols : ['id']);
          } else {
            setTableColumns(['id']);
          }
        }
      } else {
        const errText = await res.text();
        setGridError(`خطا در بازیابی داده‌ها: ${errText || res.statusText}`);
      }
    } catch (err) {
      setGridError(`خطای شبکه: ${String(err)}`);
    } finally {
      setIsLoadingData(false);
    }
  }, [project.slug]);

  // Load Table Schema
  const fetchTableSchema = useCallback(async (tableName: string) => {
    if (!tableName) return;
    setIsLoadingSchema(true);
    try {
      const res = await fetch(`/_baas/v1/${project.slug}/db/schema?table=${tableName}`);
      if (res.ok) {
        const raw = await res.json();
        let rawList: Record<string, unknown>[] = [];
        if (Array.isArray(raw)) {
          rawList = raw;
        } else if (raw && typeof raw === 'object') {
          if (Array.isArray(raw[tableName])) rawList = raw[tableName];
          else if (Array.isArray(raw.columns)) rawList = raw.columns;
        }
        setSchemaColumns(
          rawList.map((c: Record<string, unknown>) => ({
            name: String(c.name || c.Name || c.column_name || ''),
            dataType: String(c.dataType || c.DataType || c.data_type || c.type || 'text'),
            isPrimaryKey: Boolean(c.isPrimaryKey ?? c.IsPrimaryKey ?? c.is_primary_key ?? false),
            isNullable: Boolean(c.isNullable ?? c.IsNullable ?? c.is_nullable ?? true),
            defaultValue:
              c.defaultValue !== undefined && c.defaultValue !== null
                ? String(c.defaultValue)
                : c.DefaultValue !== undefined && c.DefaultValue !== null
                ? String(c.DefaultValue)
                : undefined,
          }))
        );
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingSchema(false);
    }
  }, [project.slug]);

  // Sync on activeTable change
  useEffect(() => {
    if (activeTable) {
      fetchTableData(activeTable);
      fetchTableSchema(activeTable);
      setSqlQuery(`SELECT * FROM ${activeTable} LIMIT 50;`);
    }
  }, [activeTable, fetchTableData, fetchTableSchema]);

  // Run Raw SQL
  const handleRunQuery = async () => {
    if (!sqlQuery.trim()) return;
    setIsRunningQuery(true);
    const start = performance.now();
    try {
      const res = await fetch(`/_baas/v1/${project.slug}/sql/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: sqlQuery }),
      });

      const latency = Math.round(performance.now() - start);

      if (res.ok) {
        const data = await res.json();
        const rows = Array.isArray(data) ? data : (data.rows || []);
        const columns = rows.length > 0 ? Object.keys(rows[0]) : (data.columns || []);
        const count = rows.length;

        setQueryResults({
          columns,
          rows,
          latencyMs: latency,
          rowCount: count,
        });

        if (
          sqlQuery.toUpperCase().includes('CREATE TABLE') ||
          sqlQuery.toUpperCase().includes('DROP TABLE') ||
          sqlQuery.toUpperCase().includes('ALTER TABLE')
        ) {
          fetchTables();
        }
      } else {
        const errData = await res.json().catch(() => null);
        const errMsg = errData?.error || (await res.text()) || 'خطا در اجرای کوئری';
        setQueryResults({
          columns: [],
          rows: [],
          latencyMs: latency,
          rowCount: 0,
          error: errMsg,
        });
      }
    } catch (err) {
      setQueryResults({
        columns: [],
        rows: [],
        latencyMs: 0,
        rowCount: 0,
        error: String(err),
      });
    } finally {
      setIsRunningQuery(false);
    }
  };

  // Add Column
  const handleAddColumn = async (
    name: string,
    type: string,
    nullable: boolean,
    defaultVal: string
  ): Promise<boolean> => {
    let ddl = `ALTER TABLE ${activeTable} ADD COLUMN ${name} ${type}`;
    if (!nullable) ddl += ' NOT NULL';
    if (defaultVal) ddl += ` DEFAULT ${defaultVal}`;
    ddl += ';';

    try {
      const res = await fetch(`/_baas/v1/${project.slug}/sql/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: ddl }),
      });

      if (res.ok) {
        setSchemaSuccessMsg(`ستون ${name} با موفقیت به جدول افزوده شد.`);
        fetchTableSchema(activeTable);
        fetchTableData(activeTable);
        setTimeout(() => setSchemaSuccessMsg(null), 3000);
        return true;
      }
      const err = await res.text();
      alert(`خطا در افزودن ستون: ${err}`);
      return false;
    } catch (err) {
      alert(`خطا: ${String(err)}`);
      return false;
    }
  };

  // Delete Row
  const handleDeleteRow = async (rowId: string) => {
    if (!confirm(`آیا از حذف این رکورد اطمینان دارید؟`)) return;
    try {
      const res = await fetch(`/_baas/v1/${project.slug}/rest/${activeTable}/${rowId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setTableRows((prev) => prev.filter((r) => String(r.id) !== String(rowId)));
      } else {
        alert('حذف رکورد با خطا مواجه شد.');
      }
    } catch (err) {
      alert(`خطا در حذف رکورد: ${String(err)}`);
    }
  };

  // Insert Row
  const handleInsertRow = async (jsonText: string): Promise<boolean> => {
    try {
      const parsed = JSON.parse(jsonText);
      const res = await fetch(`/_baas/v1/${project.slug}/rest/${activeTable}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });

      if (res.ok) {
        fetchTableData(activeTable);
        return true;
      }
      const err = await res.text();
      alert(`خطا در ثبت رکورد: ${err}`);
      return false;
    } catch (err) {
      alert(`فرمت JSON نامعتبر است: ${String(err)}`);
      return false;
    }
  };

  // Quick SQL Snippets
  const handleApplySnippet = (type: string) => {
    switch (type) {
      case 'select':
        setSqlQuery(`SELECT * FROM ${activeTable || 'records'} ORDER BY id DESC LIMIT 50;`);
        break;
      case 'insert':
        setSqlQuery(`INSERT INTO ${activeTable || 'records'} (title, status, created_at)\nVALUES ('عنوان نمونه', 'ACTIVE', NOW())\nRETURNING *;`);
        break;
      case 'create_table':
        setSqlQuery(`CREATE TABLE IF NOT EXISTS user_profiles (\n  id BIGSERIAL PRIMARY KEY,\n  user_id UUID NOT NULL,\n  full_name VARCHAR(128),\n  meta JSONB DEFAULT '{}'::jsonb,\n  created_at TIMESTAMPTZ DEFAULT NOW()\n);`);
        break;
      case 'index':
        setSqlQuery(`CREATE INDEX IF NOT EXISTS idx_${activeTable || 'records'}_created_at\nON ${activeTable || 'records'} (created_at DESC);`);
        break;
      case 'explain':
        setSqlQuery(`EXPLAIN ANALYZE\nSELECT * FROM ${activeTable || 'records'} WHERE id > 0;`);
        break;
    }
  };

  const filteredRows = tableRows.filter((row) => {
    if (!filterQuery) return true;
    return Object.values(row).some((val) =>
      String(val).toLowerCase().includes(filterQuery.toLowerCase())
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Studio Header */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              پایگاه داده رابطه‌ای
            </span>
            <span className="text-xs text-slate-400 font-mono" dir="ltr">
              prj_{project.slug}
            </span>
          </div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-600" />
            مدیریت پایگاه داده و جدول‌ها
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
            مشاهده و مدیریت ساختار داده‌ها، اجرای پرس‌وجوهای متنی و ویرایش مستقیم رکوردهای جدول در محیطی امن و ایزوله.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchTables}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium text-xs px-3.5 py-1.5 transition"
            title="بازخوانی فهرست جداول"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTables ? 'animate-spin' : ''}`} />
            <span>بازخوانی</span>
          </button>
          <button
            onClick={onOpenCreateTableModal}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-4 py-1.5 transition shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>ایجاد جدول جدید</span>
          </button>
        </div>
      </div>

      {/* Table Selector & Toolbar in Grid View */}
      {activeTab === 'grid' && tables.length > 0 && (
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">جدول جاری:</span>
            <select
              value={activeTable}
              onChange={(e) => setActiveTable(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-mono text-emerald-700 font-semibold focus:outline-none focus:border-emerald-500 shadow-xs"
              dir="ltr"
            >
              {tables.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Main Studio Viewport */}
      {activeTab === 'backups' ? (
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Archive className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">نسخه‌های پشتیبان پایگاه داده</h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
            پشتیبان‌گیری خودکار روزانه از تمام اسکیماها و داده‌های این پروژه انجام می‌پذیرد. همچنین می‌توانید در هر لحظه نسخه پشتیبان لحظه‌ای دریافت کنید.
          </p>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div>
              <div className="font-semibold text-xs text-slate-800">اسنپ‌شات لحظه‌ای از تمام جداول</div>
              <div className="text-[11px] text-slate-500 mt-0.5">فرمت استاندارد SQL سازگار با بازیابی کامل</div>
            </div>
            <a
              href={`/_baas/v1/${project.slug}/db/snapshot`}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition shadow-xs"
            >
              دانلود فایل پشتیبان
            </a>
          </div>
        </div>
      ) : activeTab === 'config' ? (
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Key className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">مشخصات اتصال مستقیم به پایگاه داده</h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
            از این اطلاعات برای اتصال برنامه‌ها، ORMها و ابزارهای مدیریت داده به اسکیما استفاده نمایید:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[11px] text-slate-500">طرحواره اختصاصی (Schema):</span>
              <div className="font-mono font-bold text-slate-900" dir="ltr">
                prj_{project.slug}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[11px] text-slate-500">پورت استاندارد:</span>
              <div className="font-mono font-bold text-slate-900" dir="ltr">
                5432
              </div>
            </div>
            <div className="md:col-span-2 p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500">رشته اتصال (URI):</span>
                <button
                  onClick={() =>
                    copyToClipboard(
                      `postgresql://postgres:***@remote-respina-free.runflare.com:31725/sina-infwqq_db?options=-csearch_path=prj_${project.slug},public`,
                      'uri'
                    )
                  }
                  className="flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-800"
                >
                  {copiedKey === 'uri' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'uri' ? 'کپی شد' : 'کپی'}</span>
                </button>
              </div>
              <div className="font-mono text-xs text-slate-800 break-all select-all pt-1" dir="ltr">
                postgresql://postgres:***@remote-respina-free.runflare.com:31725/sina-infwqq_db?options=-csearch_path=prj_{project.slug},public
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Table Navigator Sidebar */}
          <div className="lg:col-span-3 space-y-3">
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                <span className="flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-emerald-600" />
                  <span>جداول پروژه ({tables.length})</span>
                </span>
              </div>

              <div className="space-y-1 max-h-[480px] overflow-y-auto">
                {tables.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400 rounded-lg border border-dashed border-slate-200 space-y-2">
                    <p>هنوز جدولی ایجاد نشده است</p>
                    <button
                      onClick={onOpenCreateTableModal}
                      className="text-[11px] text-emerald-700 hover:underline font-medium"
                    >
                      + ساخت اولین جدول
                    </button>
                  </div>
                ) : (
                  tables.map((tbl) => (
                    <button
                      key={tbl}
                      onClick={() => setActiveTable(tbl)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-mono transition text-left ${
                        activeTable === tbl
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                      dir="ltr"
                    >
                      <span className="truncate">{tbl}</span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-50 shrink-0" />
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right: Active Tab Workspace */}
          <div className="lg:col-span-9 space-y-4">
            {activeTab === 'grid' && (
              <TableDataGrid
                activeTable={activeTable}
                tableColumns={tableColumns}
                filteredRows={filteredRows}
                filterQuery={filterQuery}
                onFilterQueryChange={setFilterQuery}
                isLoadingData={isLoadingData}
                gridError={gridError}
                onRefresh={() => fetchTableData(activeTable)}
                onDeleteRow={handleDeleteRow}
                onInsertRow={handleInsertRow}
              />
            )}

            {activeTab === 'schema' && (
              <SchemaDesigner
                activeTable={activeTable}
                schemaColumns={schemaColumns}
                isLoadingSchema={isLoadingSchema}
                schemaSuccessMsg={schemaSuccessMsg}
                onAddColumn={handleAddColumn}
              />
            )}

            {activeTab === 'sql' && (
              <SqlQueryRunner
                sqlQuery={sqlQuery}
                onSqlQueryChange={setSqlQuery}
                onRunQuery={handleRunQuery}
                isRunningQuery={isRunningQuery}
                queryResults={queryResults}
                queryHistory={queryHistory}
                onApplySnippet={handleApplySnippet}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
