import React, { useState, useEffect, useCallback } from 'react';
import { Project, DatabaseColumn, DatabaseQueryHistoryItem } from '../types';
import {
  Database,
  Plus,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';

import { TableDataGrid } from './database/TableDataGrid';
import { SchemaDesigner } from './database/SchemaDesigner';
import { SqlQueryRunner } from './database/SqlQueryRunner';
import { SchemaDiagramView } from './database/SchemaDiagramView';
import { DatabaseBackupsView } from './database/DatabaseBackupsView';
import { AlertModal } from '../components/modals/AlertModal';

interface DatabaseViewProps {
  project: Project;
  onOpenCreateTableModal: () => void;
  activeSubView?: string;
  onSubViewChange?: (subView: string) => void;
  lastCreatedTable?: string | null;
  tableRefreshTrigger?: number;
}

type StudioTab = 'grid' | 'schema' | 'diagram' | 'sql' | 'backups';

export const DatabaseView: React.FC<DatabaseViewProps> = ({
  project,
  onOpenCreateTableModal,
  activeSubView,
  lastCreatedTable,
  tableRefreshTrigger,
}) => {
  const [activeTab, setActiveTab] = useState<StudioTab>('grid');
  const [tables, setTables] = useState<string[]>([]);
  const [activeTable, setActiveTable] = useState<string>('');
  const [isLoadingTables, setIsLoadingTables] = useState(false);

  // Sync with Level 2 sidebar subview
  useEffect(() => {
    if (activeSubView === 'sql') setActiveTab('sql');
    else if (activeSubView === 'schema') setActiveTab('schema');
    else if (activeSubView === 'diagram') setActiveTab('diagram');
    else if (activeSubView === 'backups') setActiveTab('backups');
    else if (activeSubView === 'grid') setActiveTab('grid');
  }, [activeSubView]);

  // Table Data Grid State
  const [tableRows, setTableRows] = useState<Record<string, unknown>[]>([]);
  const [tableColumns, setTableColumns] = useState<string[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [gridError, setGridError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalRowCount, setTotalRowCount] = useState(0);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortAscending, setSortAscending] = useState(true);

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

  // Accessible Alert Modal for error / investigation reporting
  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    detail?: string;
    code?: string;
    type: 'error' | 'success' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'error',
  });

  const showAlert = (title: string, message: string, detail?: string, code?: string, type: 'error' | 'success' | 'info' = 'error') => {
    setAlertState({ isOpen: true, title, message, detail, code, type });
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

  useEffect(() => {
    if (tableRefreshTrigger) {
      fetchTables();
      if (lastCreatedTable) {
        setActiveTable(lastCreatedTable);
      }
    }
  }, [tableRefreshTrigger, lastCreatedTable, fetchTables]);

  // Load Table Data
  const fetchTableData = useCallback(async (tableName: string, page = currentPage, sortCol = sortColumn, sortAsc = sortAscending) => {
    if (!tableName) return;
    setIsLoadingData(true);
    setGridError(null);
    try {
      const offset = (page - 1) * pageSize;
      let url = `/_baas/v1/${project.slug}/rest/${tableName}?limit=${pageSize}&offset=${offset}`;
      if (sortCol) {
        url += `&order=${sortCol}.${sortAsc ? 'asc' : 'desc'}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const countHeader = res.headers.get('X-Total-Count');
        const rows = (await res.json()) as Record<string, unknown>[];
        setTableRows(rows);
        setTotalRowCount(countHeader ? Number(countHeader) : rows.length);
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
  }, [project.slug, pageSize, currentPage, sortColumn, sortAscending]);

  const handleSortChange = (col: string) => {
    const isSame = sortColumn === col;
    const nextAsc = isSame ? !sortAscending : true;
    setSortColumn(col);
    setSortAscending(nextAsc);
    fetchTableData(activeTable, currentPage, col, nextAsc);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    fetchTableData(activeTable, newPage, sortColumn, sortAscending);
  };

  const handleUpdateRow = async (rowId: string, patch: Record<string, unknown>): Promise<boolean> => {
    try {
      const res = await fetch(`/_baas/v1/${project.slug}/rest/${activeTable}/${rowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        fetchTableData(activeTable, currentPage);
        return true;
      }
      const err = await res.json().catch(() => null);
      showAlert('خطا در ویرایش رکورد', err?.error || 'ویرایش رکورد در پایگاه داده ناموفق بود.', err?.detail, err?.code);
      return false;
    } catch (err) {
      showAlert('خطای ارتباط با سرور', 'برقراری ارتباط با سرور ناموفق بود.', String(err));
      return false;
    }
  };

  const handleDropColumn = async (columnName: string): Promise<boolean> => {
    try {
      const res = await fetch(`/_baas/v1/${project.slug}/db/tables/${activeTable}/columns/${columnName}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchTableSchema(activeTable);
        fetchTableData(activeTable, currentPage);
        return true;
      }
      const err = await res.json().catch(() => null);
      showAlert('خطا در حذف ستون', err?.error || 'حذف ستون از جدول ناموفق بود.', err?.detail, err?.code);
      return false;
    } catch (err) {
      showAlert('خطای ارتباط با سرور', 'خطا در حذف ستون.', String(err));
      return false;
    }
  };

  const handleAlterColumn = async (oldName: string, newName: string, type: string, nullable: boolean, defaultVal: string): Promise<boolean> => {
    try {
      const res = await fetch(`/_baas/v1/${project.slug}/db/tables/${activeTable}/columns/${oldName}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newName,
          dataType: type,
          isNullable: nullable,
          defaultValue: defaultVal || null,
        }),
      });
      if (res.ok) {
        fetchTableSchema(activeTable);
        fetchTableData(activeTable, currentPage);
        return true;
      }
      const err = await res.json().catch(() => null);
      showAlert('خطا در تغییر ستون', err?.error || 'تغییر مشخصات ستون ناموفق بود.', err?.detail, err?.code);
      return false;
    } catch (err) {
      showAlert('خطای ارتباط با سرور', 'خطا در تغییر ستون.', String(err));
      return false;
    }
  };

  const handleDropTable = async (tableName: string): Promise<boolean> => {
    try {
      const res = await fetch(`/_baas/v1/${project.slug}/db/tables/${tableName}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await fetchTables();
        return true;
      }
      const err = await res.json().catch(() => null);
      showAlert('خطا در حذف جدول', err?.error || 'حذف جدول ناموفق بود.', err?.detail, err?.code);
      return false;
    } catch (err) {
      showAlert('خطای ارتباط با سرور', 'خطا در حذف جدول.', String(err));
      return false;
    }
  };

  const handleTruncateTable = async (tableName: string): Promise<boolean> => {
    try {
      const res = await fetch(`/_baas/v1/${project.slug}/db/tables/${tableName}/truncate`, {
        method: 'POST',
      });
      if (res.ok) {
        fetchTableData(tableName, 1);
        return true;
      }
      const err = await res.json().catch(() => null);
      showAlert('خطا در پاکسازی جدول', err?.error || 'پاکسازی جدول ناموفق بود.', err?.detail, err?.code);
      return false;
    } catch (err) {
      showAlert('خطای ارتباط با سرور', 'خطا در پاکسازی جدول.', String(err));
      return false;
    }
  };

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
    try {
      const res = await fetch(`/_baas/v1/${project.slug}/db/tables/${activeTable}/columns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          dataType: type,
          isNullable: nullable,
          defaultValue: defaultVal || null,
        }),
      });

      if (res.ok) {
        setSchemaSuccessMsg(`ستون «${name}» با موفقیت به جدول افزوده شد.`);
        fetchTableSchema(activeTable);
        fetchTableData(activeTable);
        setTimeout(() => setSchemaSuccessMsg(null), 3000);
        return true;
      }
      const err = await res.json().catch(() => null);
      showAlert('خطا در افزودن ستون', err?.error || 'افزودن ستون به جدول ناموفق بود.', err?.detail, err?.code);
      return false;
    } catch (err) {
      showAlert('خطای ارتباط با سرور', 'خطا در افزودن ستون.', String(err));
      return false;
    }
  };

  // Delete Row
  const handleDeleteRow = async (rowId: string) => {
    try {
      const res = await fetch(`/_baas/v1/${project.slug}/rest/${activeTable}/${rowId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setTableRows((prev) => prev.filter((r) => String(r.id) !== String(rowId)));
      } else {
        const err = await res.json().catch(() => null);
        showAlert('خطا در حذف رکورد', err?.error || 'حذف سطر از جدول با خطا مواجه شد.', err?.detail, err?.code);
      }
    } catch (err) {
      showAlert('خطای ارتباط با سرور', 'خطا در حذف رکورد.', String(err));
    }
  };

  // Insert Record via structured form or json
  const handleInsertRecord = async (
    recordData: Record<string, unknown>
  ): Promise<{ success: boolean; error?: string; code?: string; detail?: string }> => {
    try {
      const res = await fetch(`/_baas/v1/${project.slug}/rest/${activeTable}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recordData),
      });

      if (res.ok) {
        fetchTableData(activeTable, 1);
        return { success: true };
      }

      const body = await res.json().catch(() => null);
      return {
        success: false,
        error: body?.error || 'خطا در ثبت رکورد در پایگاه داده',
        code: body?.code,
        detail: body?.detail,
      };
    } catch (err) {
      return {
        success: false,
        error: 'خطا در برقراری ارتباط با سرور',
        detail: String(err),
      };
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
      case 'update':
        setSqlQuery(`UPDATE ${activeTable || 'records'} SET status = 'INACTIVE' WHERE id = 1 RETURNING *;`);
        break;
      case 'delete':
        setSqlQuery(`DELETE FROM ${activeTable || 'records'} WHERE id = 0 RETURNING *;`);
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
      {/* Top Studio Header - Exclusively on Table Grid View */}
      {activeTab === 'grid' && (
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
      )}

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
        <DatabaseBackupsView
          projectSlug={project.slug}
          onRestoreCompleted={fetchTables}
        />
      ) : activeTab === 'grid' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Table Navigator Sidebar - Exclusively on Table Grid View */}
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

          {/* Right: Table Data Grid */}
          <div className="lg:col-span-9 space-y-4">
            <TableDataGrid
              activeTable={activeTable}
              tableColumns={tableColumns}
              schemaColumns={schemaColumns}
              filteredRows={filteredRows}
              filterQuery={filterQuery}
              onFilterQueryChange={setFilterQuery}
              isLoadingData={isLoadingData}
              gridError={gridError}
              onRefresh={() => fetchTableData(activeTable)}
              onDeleteRow={handleDeleteRow}
              onInsertRecord={handleInsertRecord}
              onUpdateRow={handleUpdateRow}
              currentPage={currentPage}
              pageSize={pageSize}
              totalCount={totalRowCount}
              onPageChange={handlePageChange}
              sortColumn={sortColumn}
              sortAscending={sortAscending}
              onSortChange={handleSortChange}
            />
          </div>
        </div>
      ) : activeTab === 'schema' ? (
        <div className="w-full">
          <SchemaDesigner
            projectSlug={project.slug}
            activeTable={activeTable}
            tables={tables}
            onSelectTable={setActiveTable}
            onOpenCreateTableModal={onOpenCreateTableModal}
            schemaColumns={schemaColumns}
            isLoadingSchema={isLoadingSchema}
            schemaSuccessMsg={schemaSuccessMsg}
            onAddColumn={handleAddColumn}
            onDropColumn={handleDropColumn}
            onAlterColumn={handleAlterColumn}
            onDropTable={handleDropTable}
            onTruncateTable={handleTruncateTable}
            onRefreshSchema={() => fetchTableSchema(activeTable)}
          />
        </div>
      ) : activeTab === 'diagram' ? (
        <div className="w-full">
          <SchemaDiagramView
            project={project}
            tables={tables}
            onSelectTable={(tbl) => {
              setActiveTable(tbl);
              setActiveTab('grid');
            }}
          />
        </div>
      ) : activeTab === 'sql' ? (
        <div className="w-full">
          <SqlQueryRunner
            sqlQuery={sqlQuery}
            onSqlQueryChange={setSqlQuery}
            onRunQuery={handleRunQuery}
            isRunningQuery={isRunningQuery}
            queryResults={queryResults}
            queryHistory={queryHistory}
            onApplySnippet={handleApplySnippet}
          />
        </div>
      ) : null}

      {/* Accessible Alert Modal for Database Operations */}
      <AlertModal
        isOpen={alertState.isOpen}
        title={alertState.title}
        message={alertState.message}
        detail={alertState.detail}
        code={alertState.code}
        type={alertState.type}
        onClose={() => setAlertState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
