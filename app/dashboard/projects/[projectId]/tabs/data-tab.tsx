"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/components/pagination";
import { SectionHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/client";
import type { Translate } from "@/lib/i18n/catalog";
import { apiGet, apiPost } from "@/app/console";

export interface TableInfo {
  name: string;
  count: number;
}

export interface DocumentRow {
  id: string | number;
  _localme?: { created?: string; updated?: string };
  [key: string]: unknown;
}

export type RowSort = "id" | "_localme.created" | "_localme.updated";

/** One-line summary of a document for the grid: "3 fields · name=Ada, city=…". */
function summarizeDocument(row: DocumentRow, t: Translate, count: (n: number) => string): string {
  const rest = Object.entries(row).filter(([key]) => key !== "id" && key !== "_localme");
  if (rest.length === 0) return t("data.summary.none");
  const preview = rest
    .slice(0, 4)
    .map(([key, value]) => `${key}=${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
    .join(", ");
  const more = rest.length > 4 ? t("data.summary.more", { count: count(rest.length - 4) }) : "";
  return `${t("data.summary.count", { count: count(rest.length) })} · ${preview}${more}`;
}

/** True for a value we can print inline in a definition list. */
function isPrimitive(value: unknown): boolean {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

/**
 * Read-only view of one document.
 */
function DocumentDialog({
  row,
  onClose,
  onDelete,
}: {
  row: DocumentRow | null;
  onClose: () => void;
  onDelete: (id: unknown) => void;
}) {
  const [copied, setCopied] = useState(false);
  const { t, fmt } = useI18n();
  if (!row) return null;

  const { _localme, id, ...fields } = row;
  const raw = JSON.stringify(row, null, 2);

  const render = (key: string, value: unknown, depth: number): React.ReactNode => {
    const pad = { paddingInlineStart: `${depth * 1.1}rem` };
    if (isPrimitive(value)) {
      const isLong = typeof value === "string" && value.length > 80;
      return (
        <div key={key} className="grid grid-cols-[minmax(6rem,14rem)_1fr] gap-3 border-b border-border/60 py-2 last:border-0">
          <div className="ltr-content font-mono text-12px text-muted-foreground" style={pad}>
            {key}
          </div>
          <div
            className={cn(
              "ltr-content font-mono text-12.5px",
              typeof value === "string" ? "break-words text-foreground" : "text-signal",
              isLong && "whitespace-pre-wrap",
            )}
          >
            {value === null ? <span className="text-muted-foreground">{t("data.null")}</span> : String(value)}
          </div>
        </div>
      );
    }
    const entries = Array.isArray(value)
      ? value.map((item, index) => [String(index), item] as const)
      : Object.entries(value as Record<string, unknown>);
    return (
      <div key={key}>
        <div className="flex items-baseline gap-2 py-1.5" style={pad}>
          <span className="ltr-content font-mono text-12px text-muted-foreground">{key}</span>
          <Badge variant="outline" className="text-10px">
            {t(Array.isArray(value) ? "data.value.array" : "data.value.object", {
              count: fmt.number(entries.length),
            })}
          </Badge>
        </div>
        {entries.length === 0 ? (
          <p className="py-1 text-12px italic text-muted-foreground" style={pad}>
            {t("data.value.empty")}
          </p>
        ) : (
          <div className="border-s border-border/60 ps-1">
            {entries.map(([childKey, childValue]) => render(childKey, childValue, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="ltr-content font-mono">{String(id)}</DialogTitle>
          <DialogDescription>
            {_localme?.created && (
              <>{t("data.dialog.created", { when: fmt.dateTime(new Date(_localme.created).getTime()) })} · </>
            )}
            {_localme?.updated && (
              <>{t("data.dialog.updated", { when: fmt.dateTime(new Date(_localme.updated).getTime()) })}</>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto rounded-md border border-border px-3 py-1">
          {Object.keys(fields).length === 0 ? (
            <p className="py-6 text-center text-13px text-muted-foreground">
              {t("data.dialog.empty")}
            </p>
          ) : (
            Object.entries(fields).map(([key, value]) => render(key, value, 0))
          )}
        </div>
        <DialogFooter className="flex-wrap justify-between gap-2 sm:justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(raw).then(
                  () => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1600);
                  },
                  () => toast.error(t("data.dialog.clipboardFailed")),
                );
              }}
            >
              <Copy className="h-3.5 w-3.5" /> {copied ? t("action.copied") : t("data.dialog.copyJson")}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              {t("action.close")}
            </Button>
            <Button variant="destructive" size="sm" onClick={() => onDelete(id)}>
              <Trash2 className="h-3.5 w-3.5" /> {t("action.delete")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DataTab({ projectId }: { projectId: number }) {
  const { t, fmt } = useI18n();
  const [tables, setTables] = useState<TableInfo[] | null>(null);
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [rows, setRows] = useState<DocumentRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<RowSort>("_localme.created");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [viewing, setViewing] = useState<DocumentRow | null>(null);
  const [insertOpen, setInsertOpen] = useState(false);
  const [insertJson, setInsertJson] = useState("{\n  \"id\": \"doc-1\"\n}");

  const loadTables = useCallback(async () => {
    try {
      const { data } = await apiGet<{ data: TableInfo[] }>(`/api/db/tables?projectId=${projectId}`);
      setTables(data);
      if (data.length > 0 && !activeTable) {
        setActiveTable(data[0].name);
        setPage(1);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("data.tablesFailed"));
      setTables([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, t]);

  const loadRows = useCallback(async () => {
    if (!activeTable) return;
    try {
      const result = await apiPost<{ data: DocumentRow[]; total: number }>(
        `/api/db/find?projectId=${projectId}`,
        {
          table: activeTable,
          ...(query.trim() ? { filter: { $text: query.trim() } } : {}),
          sort: { [sort]: sortDir },
          limit: pageSize,
          offset: (page - 1) * pageSize,
        },
      );
      setRows(result.data);
      setTotal(result.total ?? result.data.length);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("data.loadFailed"));
      setRows([]);
      setTotal(0);
    }
  }, [page, pageSize, projectId, activeTable, query, sort, sortDir, t]);

  useEffect(() => {
    void Promise.resolve().then(loadTables);
  }, [loadTables]);
  useEffect(() => {
    void Promise.resolve().then(loadRows);
  }, [loadRows]);

  function chooseTable(name: string) {
    setActiveTable(name);
    setPage(1);
  }

  async function insertDoc(event: React.FormEvent) {
    event.preventDefault();
    if (!activeTable) return;
    let document: unknown;
    try {
      document = JSON.parse(insertJson);
    } catch {
      toast.error(t("data.insert.invalidJson"));
      return;
    }
    try {
      await apiPost(`/api/db/insert?projectId=${projectId}`, { table: activeTable, document });
      toast.success(t("data.insert.done"));
      setInsertOpen(false);
      await Promise.all([loadTables(), loadRows()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("data.insert.failed"));
    }
  }

  async function deleteDoc(id: unknown) {
    if (!activeTable) return;
    try {
      await apiPost(`/api/db/delete?projectId=${projectId}`, { table: activeTable, filter: { id } });
      toast.success(t("files.delete.done"));
      await Promise.all([loadTables(), loadRows()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("files.delete.failed"));
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title={t("data.title")}
        description={t("data.description")}
        actions={
          <Dialog open={insertOpen} onOpenChange={setInsertOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={!activeTable}>
                <Plus className="h-3.5 w-3.5" /> {t("data.insert")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="ltr-content">{t("data.insert.title", { table: activeTable ?? "" })}</DialogTitle>
                <DialogDescription>{t("data.insert.description")}</DialogDescription>
              </DialogHeader>
              <form onSubmit={insertDoc} className="space-y-4">
                <Textarea
                  value={insertJson}
                  onChange={(e) => setInsertJson(e.target.value)}
                  rows={8}
                  dir="ltr"
                  className="ltr-content font-mono text-12.5px"
                />
                <DialogFooter>
                  <Button type="submit">{t("data.insert")}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      {tables && tables.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tables.map((table) => (
            <button key={table.name} type="button" onClick={() => chooseTable(table.name)}>
              <Badge variant={activeTable === table.name ? "default" : "outline"} className="font-mono">
                {table.name} · <span className="nums">{fmt.number(table.count)}</span>
              </Badge>
            </button>
          ))}
        </div>
      )}
      {tables && tables.length === 0 && (
        <p className="text-13px text-muted-foreground">{t("data.empty.tables")}</p>
      )}
      {rows && activeTable && (
        <Card>
          <CardContent className="p-0">
            <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder={t("data.search.placeholder")}
                className="h-8 w-64 text-12.5px"
                aria-label={t("data.search.ariaLabel")}
              />
              <Select
                value={sort}
                onValueChange={(value) => setSort(value as RowSort)}
              >
                <SelectTrigger className="h-8 w-44 text-12.5px" aria-label={t("data.search.ariaLabel")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_localme.created">{t("data.sort.created")}</SelectItem>
                  <SelectItem value="_localme.updated">{t("data.sort.updated")}</SelectItem>
                  <SelectItem value="id">{t("data.sort.id")}</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                title={sortDir === -1 ? t("data.sort.newest") : t("data.sort.oldest")}
                onClick={() => setSortDir((prev) => (prev === -1 ? 1 : -1))}
              >
                {sortDir === -1 ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}
              </Button>
              <span className="nums text-12px text-muted-foreground">
                {rows.length === 0
                  ? t("data.noMatches")
                  : t("pagination.range", {
                      from: fmt.number((page - 1) * pageSize + 1),
                      to: fmt.number((page - 1) * pageSize + rows.length),
                      total: fmt.number(total),
                      label: t("pagination.documents"),
                    })}
              </span>
            </div>
            {rows.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-44">{t("data.table.id")}</TableHead>
                    <TableHead>{t("data.table.fields")}</TableHead>
                    <TableHead className="w-40">{t("data.table.updated")}</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={String(row.id)}>
                      <TableCell className="ltr-content font-mono text-12px">{String(row.id)}</TableCell>
                      <TableCell className="max-w-0 truncate font-mono text-12px text-muted-foreground">
                        <button
                          type="button"
                          className="block max-w-full truncate text-start hover:text-signal"
                          onClick={() => setViewing(row)}
                        >
                          {summarizeDocument(row, t, fmt.number)}
                        </button>
                      </TableCell>
                      <TableCell className="text-11.5px text-muted-foreground">
                        {row._localme?.updated ? fmt.dateTime(new Date(row._localme.updated).getTime()) : "—"}
                      </TableCell>
                      <TableCell className="text-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-muted-foreground hover:text-destructive"
                          title={t("data.delete.title")}
                          onClick={() => void deleteDoc(row.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="px-3 py-10 text-center text-13px text-muted-foreground">
                {query.trim() ? t("data.empty.filtered", { query: query.trim() }) : t("data.empty.table")}
              </p>
            )}
            {total > pageSize && (
              <div className="border-t px-3 py-2">
                <Pagination
                  state={{ page, pageSize, total }}
                  label="pagination.documents"
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <DocumentDialog
        row={viewing}
        onClose={() => setViewing(null)}
        onDelete={(id) => {
          setViewing(null);
          void deleteDoc(id);
        }}
      />
    </div>
  );
}
