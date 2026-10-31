import React, { useState, useEffect } from 'react';
import { Project, DatabaseColumn } from '../../types';
import { Network, Database, Key, ArrowRight, RefreshCw } from 'lucide-react';

interface SchemaDiagramViewProps {
  project: Project;
  tables: string[];
  onSelectTable?: (tableName: string) => void;
}

interface TableSchemaMap {
  [tableName: string]: DatabaseColumn[];
}

export const SchemaDiagramView: React.FC<SchemaDiagramViewProps> = ({
  project,
  tables,
  onSelectTable,
}) => {
  const [schemas, setSchemas] = useState<TableSchemaMap>({});
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  const fetchAllSchemas = async () => {
    setIsLoading(true);
    const map: TableSchemaMap = {};
    try {
      await Promise.all(
        tables.map(async (tbl) => {
          try {
            const res = await fetch(
              `/_baas/v1/${project.slug}/db/schema?table=${encodeURIComponent(tbl)}`
            );
            if (res.ok) {
              const data = await res.json();
              if (Array.isArray(data)) {
                map[tbl] = data.map((c: any) => ({
                  name: c.name ?? c.Name ?? c.column_name ?? '',
                  dataType: c.dataType ?? c.DataType ?? c.data_type ?? c.type ?? 'text',
                  isPrimaryKey: Boolean(c.isPrimaryKey ?? c.IsPrimaryKey ?? c.is_primary_key ?? false),
                  isNullable: Boolean(c.isNullable ?? c.IsNullable ?? true),
                  defaultValue: c.defaultValue ?? c.DefaultValue ?? null,
                }));
              }
            }
          } catch {
            map[tbl] = [];
          }
        })
      );
      setSchemas(map);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (tables.length > 0) {
      fetchAllSchemas();
    }
  }, [tables, project.slug]);

  // Find inferred relational connections based on _id suffixes
  const relations: Array<{ fromTable: string; fromColumn: string; toTable: string }> = [];
  Object.entries(schemas).forEach(([tableName, cols]) => {
    cols.forEach((col) => {
      if (col.name.endsWith('_id') && col.name !== 'id') {
        const targetEntity = col.name.replace(/_id$/, '');
        const matchingTable = tables.find(
          (t) =>
            t.toLowerCase() === targetEntity.toLowerCase() ||
            t.toLowerCase() === `${targetEntity}s`.toLowerCase()
        );
        if (matchingTable && matchingTable !== tableName) {
          relations.push({
            fromTable: tableName,
            fromColumn: col.name,
            toTable: matchingTable,
          });
        }
      }
    });
  });

  return (
    <div className="space-y-4">
      {/* Top Diagram Toolbar */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5">
          <Network className="w-5 h-5 text-emerald-600" />
          <div>
            <h3 className="text-xs font-bold text-slate-900">
              نمودار ارتباطی مدل‌های داده (ER Diagram)
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              نمایش ساختار جداول، نوع ستون‌ها و ارتباطات کلید خارجی در اسکیما
            </p>
          </div>
        </div>

        <button
          onClick={fetchAllSchemas}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>بازخوانی ساختار</span>
        </button>
      </div>

      {/* Relations Summary Bar */}
      {relations.length > 0 && (
        <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100 flex flex-wrap items-center gap-3 text-xs">
          <span className="font-semibold text-emerald-900 text-[11px]">
            ارتباطات شناسایی‌شده:
          </span>
          {relations.map((rel, idx) => (
            <div
              key={idx}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-emerald-200 shadow-2xs font-mono text-[11px] text-slate-700"
              dir="ltr"
            >
              <span className="font-semibold text-slate-900">{rel.fromTable}.{rel.fromColumn}</span>
              <ArrowRight className="w-3 h-3 text-emerald-600" />
              <span className="font-semibold text-emerald-700">{rel.toTable}.id</span>
            </div>
          ))}
        </div>
      )}

      {/* Entity Tables Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {tables.length === 0 ? (
          <div className="col-span-full p-8 text-center text-xs text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
            هنوز جدولی در این پروژه ایجاد نشده است.
          </div>
        ) : (
          tables.map((table) => {
            const cols = schemas[table] || [];
            const isSelected = selectedTable === table;
            return (
              <div
                key={table}
                onClick={() => {
                  setSelectedTable(table);
                  onSelectTable?.(table);
                }}
                className={`bg-white rounded-xl border transition-all cursor-pointer shadow-xs overflow-hidden ${
                  isSelected
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Header */}
                <div className="p-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2" dir="ltr">
                    <Database className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-mono text-xs font-bold text-slate-900 truncate">
                      {table}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {cols.length} ستون
                  </span>
                </div>

                {/* Column List */}
                <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                  {cols.map((col) => (
                    <div
                      key={col.name}
                      className="px-3 py-1.5 flex items-center justify-between text-xs font-mono hover:bg-slate-50/60 transition"
                      dir="ltr"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        {col.isPrimaryKey ? (
                          <Key className="w-3 h-3 text-amber-500 shrink-0" />
                        ) : (
                          <span className="w-3 h-3 inline-block" />
                        )}
                        <span
                          className={`truncate ${
                            col.isPrimaryKey
                              ? 'font-bold text-slate-900'
                              : 'text-slate-700'
                          }`}
                        >
                          {col.name}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {col.dataType}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
