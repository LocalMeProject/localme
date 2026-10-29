import React, { useState, useEffect, useCallback } from 'react';
import { Project, DatabaseColumn, DatabaseQueryHistoryItem } from '../types';
import {
  Database,
  Table as TableIcon,
  Plus,
  RefreshCw,
  Code2,
  Columns,
  ChevronRight,
} from 'lucide-react';

import { TableDataGrid } from './database/TableDataGrid';
import { SchemaDesigner } from './database/SchemaDesigner';
import { SqlQueryRunner } from './database/SqlQueryRunner';

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
  const [queryHistory, setQueryHistory] = useState<DatabaseQueryHistoryItem[]>([]);

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
  }, [project.slug]);

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
  const handleAddColumn = async (
    name: string,
    type: string,
    nullable: boolean,
    defaultVal: string
  ): Promise<boolean> => {
    const nullClause = nullable ? '' : ' NOT NULL';
    const defaultClause = defaultVal ? ` DEFAULT ${defaultVal}` : '';
    const ddl = `ALTER TABLE ${activeTable} ADD COLUMN ${name} ${type}${nullClause}${defaultClause};`;

    try {
      const res = await fetch(`/_baas/v1/${project.slug}/db/sql`, {
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
            محیط داده‌های توزیع‌شده با ایزولاسیون LTR، پشتیبانی PostgREST، اجرای DDL/DML، مدیریت ایندکس‌ها و اتصال کانکشن‌پول Npgsql.
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
    </div>
  );
};
