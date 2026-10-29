import React, { useState, useEffect, useCallback } from 'react';
import { Project, DatabaseColumn, DatabaseQueryHistoryItem } from '../types';
import {
  Database,
  Play,
  Table as TableIcon,
  Clock,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Code2,
  Columns,
  Key,
  AlertCircle,
  CheckCircle2,
  FileCode,
  ChevronRight,
} from 'lucide-react';

interface DatabaseViewProps {
  project: Project;
  onOpenCreateTableModal: () => void;
}

type StudioTab = 'grid' | 'schema' | 'sql';

export const DatabaseView: React.FC<DatabaseViewProps> = ({ project, onOpenCreateTableModal }) => {
  const [activeTab, setActiveTab] = useState<StudioTab>('grid');
  const [tables, setTables] = useState<string[]>([]);
  const [activeTable, setActiveTable] = useState<string>('');
  const [isLoadingTables, setIsLoadingTables] = useState(false);

  // Table Data Grid State
  const [tableRows, setTableRows] = useState<Record<string, unknown>[]>([]);
  const [tableColumns, setTableColumns] = useState<string[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [limit] = useState(50);
  const [gridError, setGridError] = useState<string | null>(null);

  // Schema Designer State
  const [schemaColumns, setSchemaColumns] = useState<DatabaseColumn[]>([]);
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState('VARCHAR(255)');
  const [newColNullable, setNewColNullable] = useState(true);
  const [newColDefault, setNewColDefault] = useState('');
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
  const [queryHistory, setQueryHistory] = useState<DatabaseQueryHistoryItem[]>([]);

  // Row Insertion Modal / Inline Drawer
  const [isInsertOpen, setIsInsertOpen] = useState(false);
  const [insertRecordJson, setInsertRecordJson] = useState('{\n  \n}');

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
        // Fallback or empty
        setTables([]);
      }
    } catch (err) {
      console.warn('Failed to fetch tables:', err);
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
      const res = await fetch(`/_baas/v1/${project.slug}/rest/${tableName}?limit=${limit}`);
      if (res.ok) {
        const rows = (await res.json()) as Record<string, unknown>[];
        setTableRows(rows);
        if (rows.length > 0) {
          setTableColumns(Object.keys(rows[0]));
        } else {
          // If no rows, fetch schema to get column names
          const schemaRes = await fetch(`/_baas/v1/${project.slug}/db/schema?table=${tableName}`);
          if (schemaRes.ok) {
            const schema = (await schemaRes.json()) as Record<string, DatabaseColumn[]>;
            const cols = (schema[tableName] || []).map((c) => c.name);
            setTableColumns(cols);
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
  }, [project.slug, limit]);

  // Load Table Schema
  const fetchTableSchema = useCallback(async (tableName: string) => {
    if (!tableName) return;
    setIsLoadingSchema(true);
    try {
      const res = await fetch(`/_baas/v1/${project.slug}/db/schema?table=${tableName}`);
      if (res.ok) {
        const schema = (await res.json()) as Record<string, DatabaseColumn[]>;
        setSchemaColumns(schema[tableName] || []);
      }
    } catch (err) {
      console.warn('Failed to load schema:', err);
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
      const res = await fetch(`/_baas/v1/${project.slug}/db/sql`, {
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

        setQueryHistory((prev) => [
          {
            id: String(Date.now()),
            query: sqlQuery,
            executedAt: new Date().toLocaleTimeString('fa-IR'),
            durationMs: latency,
            rowCount: count,
            status: 'SUCCESS',
          },
          ...prev.slice(0, 19),
        ]);

        // Refresh tables if DDL query
        if (/CREATE|ALTER|DROP/i.test(sqlQuery)) {
          fetchTables();
        }
      } else {
        const errText = await res.text();
        setQueryResults({
          columns: [],
          rows: [],
          latencyMs: latency,
          rowCount: 0,
          error: errText || `Error ${res.status}`,
        });

        setQueryHistory((prev) => [
          {
            id: String(Date.now()),
            query: sqlQuery,
            executedAt: new Date().toLocaleTimeString('fa-IR'),
            durationMs: latency,
            rowCount: 0,
            status: 'ERROR',
            errorMessage: errText,
          },
          ...prev.slice(0, 19),
        ]);
      }
    } catch (err) {
      const latency = Math.round(performance.now() - start);
      setQueryResults({
        columns: [],
        rows: [],
        latencyMs: latency,
        rowCount: 0,
        error: String(err),
      });
    } finally {
      setIsRunningQuery(false);
    }
  };

  // Add Column via SQL
  const handleAddColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim() || !activeTable) return;

    const nullClause = newColNullable ? '' : ' NOT NULL';
    const defaultClause = newColDefault ? ` DEFAULT ${newColDefault}` : '';
    const ddl = `ALTER TABLE ${activeTable} ADD COLUMN ${newColName.trim()} ${newColType}${nullClause}${defaultClause};`;

    try {
      const res = await fetch(`/_baas/v1/${project.slug}/db/sql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: ddl }),
      });

      if (res.ok) {
        setSchemaSuccessMsg(`ستون ${newColName} با موفقیت به جدول افزوده شد.`);
        setIsAddingColumn(false);
        setNewColName('');
        setNewColDefault('');
        fetchTableSchema(activeTable);
        fetchTableData(activeTable);
        setTimeout(() => setSchemaSuccessMsg(null), 3000);
      } else {
        const err = await res.text();
        alert(`خطا در افزودن ستون: ${err}`);
      }
    } catch (err) {
      alert(`خطا: ${String(err)}`);
    }
  };

  // Delete Row
  const handleDeleteRow = async (rowId: string) => {
    if (!confirm(`آیا از حذف رکورد با شناسه ${rowId} اطمینان دارید؟`)) return;
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
  const handleInsertRow = async () => {
    try {
      const parsed = JSON.parse(insertRecordJson);
      const res = await fetch(`/_baas/v1/${project.slug}/rest/${activeTable}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });

      if (res.ok) {
        setIsInsertOpen(false);
        setInsertRecordJson('{\n  \n}');
        fetchTableData(activeTable);
      } else {
        const err = await res.text();
        alert(`خطا در ثبت رکورد: ${err}`);
      }
    } catch (err) {
      alert(`فرمت JSON نامعتبر است: ${String(err)}`);
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

  // Filtered rows for Data Grid
  const filteredRows = tableRows.filter((row) => {
    if (!filterQuery) return true;
    return Object.values(row).some((val) =>
      String(val).toLowerCase().includes(filterQuery.toLowerCase())
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Studio Header */}
      <div className="p-5 rounded-2xl bg-[#171717] border border-[#242424] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium tracking-wide bg-[#3ECF8E]/10 text-[#3ECF8E] border border-[#3ECF8E]/30">
              POSTGRESQL 18.1 ENTERPRISE DBAAS
            </span>
            <span className="text-[11px] font-mono text-zinc-400">
              SCHEMA: prj_{project.slug}
            </span>
          </div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-[#3ECF8E]" />
            استودیو مدیریت داده‌های رابطه‌ای (Relational Database Studio)
          </h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-3xl leading-relaxed">
            محیط تمام‌عیار داده‌های توزیع‌شده با ایزولاسیون کامل LTR، پشتیبانی بومی PostgREST، اجرای دستورات DDL/DML، مدیریت مستقیم ایندکس‌ها و اتصال پرسرعت کانکشن‌پول Npgsql.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchTables}
            className="btn-pill-secondary"
            title="بازخوانی جداول"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTables ? 'animate-spin' : ''}`} />
            <span>بازخوانی</span>
          </button>
          <button
            onClick={onOpenCreateTableModal}
            className="btn-pill-primary"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ ساخت جدول جدید</span>
          </button>
        </div>
      </div>

      {/* Main Studio Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-[#242424] pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('grid')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition ${
              activeTab === 'grid'
                ? 'bg-[#3ECF8E] text-black font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-[#1f1f1f]'
            }`}
          >
            <TableIcon className="w-4 h-4" />
            <span>مرورگر داده‌ها (Data Grid)</span>
          </button>

          <button
            onClick={() => setActiveTab('schema')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition ${
              activeTab === 'schema'
                ? 'bg-[#3ECF8E] text-black font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-[#1f1f1f]'
            }`}
          >
            <Columns className="w-4 h-4" />
            <span>طراح اسکیما (Schema Designer)</span>
          </button>

          <button
            onClick={() => setActiveTab('sql')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition ${
              activeTab === 'sql'
                ? 'bg-[#3ECF8E] text-black font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-[#1f1f1f]'
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>کنسول و اجرای SQL (Query Runner)</span>
          </button>
        </div>

        {/* Current Table Selector Pill */}
        {tables.length > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-500 text-[11px]">جدول انتخابی:</span>
            <select
              value={activeTable}
              onChange={(e) => setActiveTable(e.target.value)}
              className="px-3 py-1.5 rounded-full bg-[#171717] border border-[#242424] text-xs font-mono text-[#3ECF8E] focus:outline-none focus:border-[#3ECF8E]"
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

      {/* Main Studio Viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Table Navigator Sidebar */}
        <div className="lg:col-span-3 space-y-3">
          <div className="p-3.5 rounded-xl bg-[#171717] border border-[#242424] space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-400">
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-[#3ECF8E]" />
                <span>جداول اسکیما ({tables.length})</span>
              </span>
              <span className="text-[10px] font-mono text-zinc-500">PostgreSQL</span>
            </div>

            <div className="space-y-1 max-h-[480px] overflow-y-auto">
              {tables.length === 0 ? (
                <div className="p-4 text-center text-xs text-zinc-500 rounded-lg border border-dashed border-[#242424] space-y-2">
                  <p>هیچ جدولی ایجاد نشده است</p>
                  <button
                    onClick={onOpenCreateTableModal}
                    className="text-[11px] text-[#3ECF8E] hover:underline font-medium"
                  >
                    + ایجاد اولین جدول
                  </button>
                </div>
              ) : (
                tables.map((tbl) => (
                  <button
                    key={tbl}
                    onClick={() => setActiveTable(tbl)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-mono transition text-left dir-ltr ${
                      activeTable === tbl
                        ? 'bg-[#1f1f1f] text-[#3ECF8E] border border-[#3ECF8E]/30 font-semibold shadow-sm'
                        : 'text-zinc-400 hover:text-white hover:bg-[#1a1a1a]'
                    }`}
                  >
                    <span className="truncate">{tbl}</span>
                    <ChevronRight className="w-3.5 h-3.5 opacity-50 flex-shrink-0" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Active Tab Workspace */}
        <div className="lg:col-span-9 space-y-4">
          {/* TAB 1: DATA GRID */}
          {activeTab === 'grid' && (
            <div className="space-y-4">
              {/* Grid Control Toolbar */}
              <div className="p-3.5 rounded-xl bg-[#171717] border border-[#242424] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="text"
                      placeholder="فیلتر در رکوردهای جدول..."
                      value={filterQuery}
                      onChange={(e) => setFilterQuery(e.target.value)}
                      className="pl-8 pr-3 py-1.5 rounded-full bg-[#0f0f0f] border border-[#242424] text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-[#3ECF8E] w-56 md:w-64"
                    />
                  </div>

                  <button
                    onClick={() => fetchTableData(activeTable)}
                    className="btn-pill-secondary text-xs px-3 py-1.5"
                    title="تازه سازی"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingData ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-mono text-zinc-400">
                    نمایش {filteredRows.length} رکورد
                  </span>
                  <button
                    onClick={() => setIsInsertOpen(true)}
                    className="btn-pill-primary text-xs px-3 py-1.5"
                    disabled={!activeTable}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>افزودن رکورد جدید</span>
                  </button>
                </div>
              </div>

              {/* Error Alert */}
              {gridError && (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-red-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span>{gridError}</span>
                </div>
              )}

              {/* STRICT LTR ISOLATION DATA GRID CONTAINER */}
              <div className="rounded-xl border border-[#242424] bg-[#171717] overflow-hidden shadow-sm">
                <div className="overflow-x-auto ltr-isolation max-h-[520px]">
                  <table className="w-full text-left text-xs font-mono border-collapse" dir="ltr">
                    <thead>
                      <tr className="border-b border-[#242424] bg-[#1a1a1a] text-zinc-400 sticky top-0 z-10">
                        <th className="py-2.5 px-3 font-semibold text-zinc-400 w-12 text-center">#</th>
                        {tableColumns.map((col) => (
                          <th key={col} className="py-2.5 px-3 font-semibold text-zinc-300 whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                        <th className="py-2.5 px-3 font-semibold text-right w-16">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#242424]">
                      {isLoadingData ? (
                        <tr>
                          <td colSpan={tableColumns.length + 2} className="py-12 text-center text-zinc-500">
                            <div className="inline-flex items-center gap-2">
                              <RefreshCw className="w-4 h-4 animate-spin text-[#3ECF8E]" />
                              <span>در حال بارگذاری رکوردهای جدول...</span>
                            </div>
                          </td>
                        </tr>
                      ) : filteredRows.length === 0 ? (
                        <tr>
                          <td colSpan={tableColumns.length + 2} className="py-12 text-center text-zinc-500">
                            {activeTable ? 'هیچ رکوردی در این جدول یافت نشد.' : 'ابتدا یک جدول انتخاب کنید.'}
                          </td>
                        </tr>
                      ) : (
                        filteredRows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-[#1f1f1f] transition group">
                            <td className="py-2 px-3 text-zinc-600 text-center font-mono">{idx + 1}</td>
                            {tableColumns.map((col) => {
                              const cellVal = row[col];
                              const isJson = typeof cellVal === 'object' && cellVal !== null;
                              return (
                                <td key={col} className="py-2 px-3 text-zinc-300 max-w-xs truncate" title={String(cellVal)}>
                                  {isJson ? (
                                    <span className="text-[#3ECF8E] font-mono text-[11px]">
                                      {JSON.stringify(cellVal)}
                                    </span>
                                  ) : cellVal === null || cellVal === undefined ? (
                                    <span className="text-zinc-600 italic">null</span>
                                  ) : (
                                    String(cellVal)
                                  )}
                                </td>
                              );
                            })}
                            <td className="py-2 px-3 text-right">
                              {row.id !== undefined && (
                                <button
                                  onClick={() => handleDeleteRow(String(row.id))}
                                  className="text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition p-1"
                                  title="حذف رکورد"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Insert Record Drawer / Modal */}
              {isInsertOpen && (
                <div className="p-4 rounded-xl bg-[#171717] border border-[#3ECF8E]/40 space-y-3 shadow-lg">
                  <div className="flex items-center justify-between border-b border-[#242424] pb-2">
                    <span className="text-xs font-bold text-white flex items-center gap-2">
                      <Plus className="w-3.5 h-3.5 text-[#3ECF8E]" />
                      ثبت رکورد در جدول {activeTable} (JSON Payload)
                    </span>
                    <button
                      onClick={() => setIsInsertOpen(false)}
                      className="text-xs text-zinc-500 hover:text-zinc-300"
                    >
                      بستن
                    </button>
                  </div>

                  <div className="ltr-isolation">
                    <textarea
                      value={insertRecordJson}
                      onChange={(e) => setInsertRecordJson(e.target.value)}
                      rows={5}
                      className="w-full p-2.5 rounded-lg bg-[#0f0f0f] border border-[#242424] text-xs font-mono text-[#3ECF8E] focus:outline-none focus:border-[#3ECF8E]"
                      placeholder='{\n  "title": "مقدار نمونه",\n  "status": "ACTIVE"\n}'
                      dir="ltr"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setIsInsertOpen(false)}
                      className="btn-pill-secondary text-xs px-3 py-1.5"
                    >
                      انصراف
                    </button>
                    <button
                      onClick={handleInsertRow}
                      className="btn-pill-primary text-xs px-3 py-1.5"
                    >
                      ذخیره در دیتابیس
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SCHEMA DESIGNER */}
          {activeTab === 'schema' && (
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
                  className="btn-pill-primary text-xs px-3 py-1.5"
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
                  onSubmit={handleAddColumn}
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
                      className="btn-pill-secondary text-xs px-3 py-1.5"
                    >
                      انصراف
                    </button>
                    <button
                      type="submit"
                      className="btn-pill-primary text-xs px-3 py-1.5"
                    >
                      اعمال DDL در دیتابیس
                    </button>
                  </div>
                </form>
              )}

              {/* Schema Table */}
              <div className="rounded-xl border border-[#242424] bg-[#171717] overflow-hidden">
                <div className="overflow-x-auto ltr-isolation">
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
                                <span className="text-amber-400 font-semibold">NOT NULL</span>
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
          )}

          {/* TAB 3: SQL RUNNER */}
          {activeTab === 'sql' && (
            <div className="space-y-4">
              {/* SQL Runner Toolbar */}
              <div className="p-3.5 rounded-xl bg-[#171717] border border-[#242424] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-[#3ECF8E]" />
                  <span className="text-xs font-bold text-white">ویرایشگر پرس‌وجوی SQL</span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => handleApplySnippet('select')}
                    className="px-2.5 py-1 rounded-full bg-[#1f1f1f] hover:bg-[#282828] text-[11px] text-zinc-300 border border-[#2e2e2e] transition"
                  >
                    SELECT
                  </button>
                  <button
                    onClick={() => handleApplySnippet('insert')}
                    className="px-2.5 py-1 rounded-full bg-[#1f1f1f] hover:bg-[#282828] text-[11px] text-zinc-300 border border-[#2e2e2e] transition"
                  >
                    INSERT
                  </button>
                  <button
                    onClick={() => handleApplySnippet('create_table')}
                    className="px-2.5 py-1 rounded-full bg-[#1f1f1f] hover:bg-[#282828] text-[11px] text-zinc-300 border border-[#2e2e2e] transition"
                  >
                    CREATE TABLE
                  </button>
                  <button
                    onClick={() => handleApplySnippet('index')}
                    className="px-2.5 py-1 rounded-full bg-[#1f1f1f] hover:bg-[#282828] text-[11px] text-zinc-300 border border-[#2e2e2e] transition"
                  >
                    INDEX
                  </button>
                  <button
                    onClick={() => handleApplySnippet('explain')}
                    className="px-2.5 py-1 rounded-full bg-[#1f1f1f] hover:bg-[#282828] text-[11px] text-zinc-300 border border-[#2e2e2e] transition"
                  >
                    EXPLAIN
                  </button>
                </div>
              </div>

              {/* STRICT LTR ISOLATION SQL EDITOR */}
              <div className="relative rounded-xl border border-[#242424] bg-[#0f0f0f] overflow-hidden">
                <textarea
                  value={sqlQuery}
                  onChange={(e) => setSqlQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                      e.preventDefault();
                      handleRunQuery();
                    }
                  }}
                  rows={6}
                  className="w-full p-4 font-mono text-xs text-[#ededed] bg-[#0f0f0f] focus:outline-none focus:ring-1 focus:ring-[#3ECF8E] resize-y leading-relaxed ltr-isolation"
                  placeholder="SELECT * FROM table_name LIMIT 10;"
                  dir="ltr"
                />

                <div className="p-2.5 bg-[#171717] border-t border-[#242424] flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-[11px] text-zinc-500 font-mono">
                      میانبر: Ctrl + Enter برای اجرا
                    </span>
                    {queryResults && !queryResults.error && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-[#3ECF8E]/10 text-[#3ECF8E] border border-[#3ECF8E]/30">
                        <Clock className="w-3 h-3" />
                        <span>{queryResults.latencyMs} ms</span>
                        <span>•</span>
                        <span>{queryResults.rowCount} رکورد</span>
                      </span>
                    )}
                  </div>

                  <button
                    onClick={handleRunQuery}
                    disabled={isRunningQuery}
                    className="btn-pill-primary text-xs px-4 py-1.5"
                  >
                    <Play className="w-3.5 h-3.5 fill-black" />
                    <span>{isRunningQuery ? 'در حال اجرا...' : 'اجرای پرس‌وجو'}</span>
                  </button>
                </div>
              </div>

              {/* SQL Result Table */}
              {queryResults && (
                <div className="space-y-2">
                  {queryResults.error ? (
                    <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-200 text-xs space-y-1">
                      <div className="font-bold flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-400" />
                        <span>خطای اجرای دستور SQL:</span>
                      </div>
                      <pre className="font-mono text-[11px] whitespace-pre-wrap text-red-300 dir-ltr text-left">
                        {queryResults.error}
                      </pre>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-[#242424] bg-[#171717] overflow-hidden">
                      <div className="overflow-x-auto ltr-isolation max-h-[380px]">
                        <table className="w-full text-left text-xs font-mono" dir="ltr">
                          <thead>
                            <tr className="border-b border-[#242424] bg-[#1a1a1a] text-zinc-400 sticky top-0">
                              {queryResults.columns.map((c) => (
                                <th key={c} className="py-2.5 px-3 font-semibold text-zinc-300 whitespace-nowrap">
                                  {c}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#242424]">
                            {queryResults.rows.length === 0 ? (
                              <tr>
                                <td colSpan={queryResults.columns.length || 1} className="py-8 text-center text-zinc-500">
                                  دستور با موفقیت اجرا شد (بدون سطر بازگشتی).
                                </td>
                              </tr>
                            ) : (
                              queryResults.rows.map((row, idx) => (
                                <tr key={idx} className="hover:bg-[#1f1f1f] transition">
                                  {queryResults.columns.map((c) => (
                                    <td key={c} className="py-2 px-3 text-zinc-300 max-w-xs truncate">
                                      {typeof row[c] === 'object' && row[c] !== null
                                        ? JSON.stringify(row[c])
                                        : String(row[c] ?? 'null')}
                                    </td>
                                  ))}
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Query History */}
              {queryHistory.length > 0 && (
                <div className="p-3.5 rounded-xl bg-[#171717] border border-[#242424] space-y-2">
                  <div className="text-[11px] font-semibold text-zinc-400 flex items-center justify-between">
                    <span>تاریخچه دستورات اجرا شده (Session History)</span>
                    <span className="font-mono text-zinc-500">{queryHistory.length} مورد</span>
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {queryHistory.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => setSqlQuery(item.query)}
                        className="p-2 rounded-lg bg-[#0f0f0f] border border-[#242424] hover:border-[#3ECF8E]/40 cursor-pointer flex items-center justify-between text-xs font-mono transition"
                      >
                        <span className="text-zinc-300 truncate max-w-md dir-ltr text-left">
                          {item.query}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 flex-shrink-0">
                          <span>{item.durationMs}ms</span>
                          <span className={item.status === 'SUCCESS' ? 'text-[#3ECF8E]' : 'text-red-400'}>
                            {item.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
