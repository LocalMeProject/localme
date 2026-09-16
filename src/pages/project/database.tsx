import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  Database,
  Filter,
  Loader2,
  Pencil,
  Play,
  Plus,
  Table2,
  Trash2,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useProject } from "@/components/project-layout";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { JsonField } from "@/components/json-field";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { errorText } from "@/lib/errors";
import { formatCount, prettyJson } from "@/lib/format";
import { cn } from "@/lib/utils";

const OPERATORS = ["$eq", "$ne", "$gt", "$gte", "$lt", "$lte", "$in", "$nin", "$regex", "$exists", "$and", "$or", "$not"];

const LIMITS = [25, 50, 100, 250, 500];

type BrowseResult = {
  data?: Record<string, unknown>[];
  total?: number;
  error?: string;
  truncated?: boolean;
};

function cellValue(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (value === undefined) return "—";
  if (value === null) return "null";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function ProjectDatabase() {
  const { project, token } = useProject();
  const projectId = project.id as Id<"projects">;

  const tables = useQuery(api.data.listTables, { token, projectId });
  const [table, setTable] = useState<string | null>(null);

  const [filterText, setFilterText] = useState("{}");
  const [sortText, setSortText] = useState("{}");
  const [limit, setLimit] = useState(50);
  const [applied, setApplied] = useState<{ filter: string; sort: string; limit: number }>({
    filter: "{}",
    sort: "{}",
    limit: 50,
  });

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [newTable, setNewTable] = useState("");
  const [insertOpen, setInsertOpen] = useState(false);
  const [documentText, setDocumentText] = useState("");
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const createTable = useMutation(api.data.createTable);
  const dropTable = useMutation(api.data.dropTable);
  const insert = useMutation(api.data.insert);
  const update = useMutation(api.data.update);
  const remove = useMutation(api.data.remove);

  useEffect(() => {
    if (!table && tables && tables.length > 0) setTable(tables[0].name);
  }, [table, tables]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(timer);
  }, [notice]);

  const result = useQuery(
    api.data.browse,
    table
      ? { token, projectId, table, filter: applied.filter, sort: applied.sort, limit: applied.limit, offset: 0 }
      : "skip",
  ) as BrowseResult | undefined;

  const rows: Record<string, unknown>[] = useMemo(
    () => (Array.isArray(result?.data) ? result.data : []),
    [result],
  );

  const columns = useMemo(() => {
    const keys = new Set<string>();
    for (const row of rows) for (const key of Object.keys(row)) keys.add(key);
    return [...keys];
  }, [rows]);

  const guard = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  };

  const runQuery = () => {
    try {
      JSON.parse(filterText.trim() || "{}");
      JSON.parse(sortText.trim() || "{}");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Filter must be valid JSON");
      return;
    }
    setError(null);
    setApplied({ filter: filterText.trim() || "{}", sort: sortText.trim() || "{}", limit });
  };

  return (
    <div className="space-y-5">
      {error && <Alert variant="destructive">{error}</Alert>}
      {notice && (
        <div className="flex items-center gap-2 text-[11px] text-signal">
          <span className="h-1.5 w-1.5 rounded-full bg-signal" />
          {notice}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div className="panel flex flex-col">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="mono-label">tables</span>
            <Button variant="ghost" size="icon-sm" title="New table" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          {tables === undefined ? (
            <div className="space-y-2 p-3">
              {[0, 1, 2].map((index) => (
                <Skeleton key={index} className="h-7 w-full" />
              ))}
            </div>
          ) : tables.length === 0 ? (
            <p className="px-4 py-6 text-[11px] text-muted-foreground">
              No tables yet. Documents live in tables you create here or on first insert through{" "}
              <span className="font-mono">/api/db/insert</span>.
            </p>
          ) : (
            <ul className="p-1.5">
              {tables.map((entry) => (
                <li key={entry.name} className="group">
                  <div
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2.5 py-2 text-xs transition-colors",
                      table === entry.name ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-accent",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setTable(entry.name)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <Table2 className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate font-mono">{entry.name}</span>
                    </button>
                    <span className="font-mono text-[10px] text-muted-foreground">{formatCount(entry.count)}</span>
                    <button
                      type="button"
                      title="Drop table"
                      onClick={() => setDropTarget(entry.name)}
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-5">
          <div className="panel">
            <div className="border-b border-border px-5 py-3">
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-blueprint" />
                <span className="text-sm font-medium">Query builder</span>
                <Badge variant="outline">max 500 rows</Badge>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                MongoDB-style filters. Operators: {OPERATORS.join(" ")}
              </div>
            </div>
            <div className="grid gap-4 p-5 lg:grid-cols-2">
              <JsonField
                label="Filter"
                value={filterText}
                onChange={setFilterText}
                rows={5}
                placeholder={`{ "age": { "$gt": 18 } }`}
                hint="Leave as {} to match every document."
              />
              <JsonField
                label="Sort"
                value={sortText}
                onChange={setSortText}
                rows={5}
                placeholder={`{ "created": -1 }`}
                hint="1 for ascending, -1 for descending."
              />
            </div>
            <div className="flex flex-wrap items-end justify-between gap-3 border-t border-border px-5 py-3">
              <div className="flex items-end gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px]">Limit</Label>
                  <Select value={String(limit)} onValueChange={(value) => setLimit(Number(value))}>
                    <SelectTrigger className="h-8 w-24 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LIMITS.map((value) => (
                        <SelectItem key={value} value={String(value)}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" size="sm" onClick={runQuery} disabled={!table}>
                  <Play className="h-3.5 w-3.5" />
                  Run query
                </Button>
              </div>
              <Button
                variant="signal"
                size="sm"
                disabled={!table}
                onClick={() => {
                  setDocumentText('{\n  "id": 1\n}');
                  setInsertOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Insert document
              </Button>
            </div>
          </div>

          <div className="panel">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
              <div>
                <div className="text-sm font-medium">{table ? <span className="font-mono">{table}</span> : "Results"}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {result && !result.error
                    ? `${result.total ?? rows.length} matching document(s) · showing ${rows.length}`
                    : "Select a table to browse its documents"}
                </div>
              </div>
              {result?.truncated && <Badge variant="warning">scan truncated at 5000 documents</Badge>}
            </div>

            {result?.error ? (
              <div className="p-5">
                <Alert variant="destructive">{String(result.error)}</Alert>
              </div>
            ) : !table ? (
              <EmptyState
                className="m-5"
                icon={Database}
                title="No table selected"
                description="Create a table or pick one on the left to inspect its documents."
              />
            ) : result === undefined ? (
              <div className="space-y-2 p-5">
                {[0, 1, 2].map((index) => (
                  <Skeleton key={index} className="h-8 w-full" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <EmptyState
                className="m-5"
                icon={Database}
                title="No documents match"
                description="Adjust the filter, or insert a document to get started."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map((column) => (
                      <TableHead key={column}>{column}</TableHead>
                    ))}
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, index) => (
                    <TableRow key={String((row as { id?: unknown }).id ?? index)}>
                      {columns.map((column) => (
                        <TableCell
                          key={column}
                          className="max-w-[16rem] truncate font-mono text-[11px]"
                          title={cellValue(row, column)}
                        >
                          {cellValue(row, column)}
                        </TableCell>
                      ))}
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Edit document"
                            onClick={() =>
                              setEditing({
                                id: String((row as { id: unknown }).id),
                                text: prettyJson(
                                  Object.fromEntries(Object.entries(row).filter(([key]) => key !== "_localme")),
                                ),
                              })
                            }
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Delete document"
                            onClick={() => setDeleteTarget(String((row as { id: unknown }).id))}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New table</DialogTitle>
            <DialogDescription>
              Tables are logical groupings of JSON documents. Every document needs a non-null{" "}
              <span className="font-mono text-foreground">id</span> field.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="table-name">Table name</Label>
            <Input
              id="table-name"
              value={newTable}
              onChange={(event) => setNewTable(event.target.value)}
              placeholder="orders"
              className="font-mono"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="signal"
              disabled={busy || !newTable.trim()}
              onClick={() =>
                guard(async () => {
                  await createTable({ token, projectId, name: newTable.trim() });
                  setTable(newTable.trim());
                  setNewTable("");
                  setCreateOpen(false);
                  setNotice(`Table ${newTable.trim()} created`);
                })
              }
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Create table
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={insertOpen} onOpenChange={setInsertOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Insert into <span className="font-mono">{table}</span>
            </DialogTitle>
            <DialogDescription>
              A single JSON object. Duplicate <span className="font-mono text-foreground">id</span> values are rejected.
            </DialogDescription>
          </DialogHeader>
          <JsonField label="Document" value={documentText} onChange={setDocumentText} rows={10} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setInsertOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="signal"
              disabled={busy || !table}
              onClick={() =>
                guard(async () => {
                  if (!table) return;
                  await insert({ token, projectId, table, document: documentText });
                  setInsertOpen(false);
                  setNotice("Document inserted");
                })
              }
            >
              Insert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Edit document <span className="font-mono text-sm">{editing?.id}</span>
            </DialogTitle>
            <DialogDescription>
              The saved document replaces the stored one. Keep the <span className="font-mono text-foreground">id</span>{" "}
              field, or change it to rename the document.
            </DialogDescription>
          </DialogHeader>
          <JsonField
            label="Document"
            value={editing?.text ?? ""}
            onChange={(value) => setEditing((current) => (current ? { ...current, text: value } : current))}
            rows={12}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              variant="signal"
              disabled={busy || !editing || !table}
              onClick={() =>
                guard(async () => {
                  if (!editing || !table) return;
                  await update({
                    token,
                    projectId,
                    table,
                    filter: JSON.stringify({ id: editing.id }),
                    update: JSON.stringify(JSON.parse(editing.text)),
                    many: false,
                  });
                  setEditing(null);
                  setNotice("Document updated");
                })
              }
            >
              Save document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete document</DialogTitle>
            <DialogDescription>
              Permanently removes the document with <span className="font-mono text-foreground">id</span>{" "}
              <span className="font-mono text-foreground">{deleteTarget}</span>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy || !table}
              onClick={() =>
                guard(async () => {
                  if (!table || !deleteTarget) return;
                  await remove({ token, projectId, table, filter: JSON.stringify({ id: deleteTarget }) });
                  setDeleteTarget(null);
                  setNotice("Document deleted");
                })
              }
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(dropTarget)}
        onOpenChange={(open) => !open && setDropTarget(null)}
        title={`Drop table ${dropTarget ?? ""}?`}
        description="Every document in the table is deleted immediately. This cannot be undone."
        confirmWord={dropTarget ?? undefined}
        confirmLabel="Drop table"
        pending={busy}
        onConfirm={() =>
          guard(async () => {
            if (!dropTarget) return;
            const outcome = await dropTable({ token, projectId, name: dropTarget });
            if (table === dropTarget) setTable(null);
            setNotice(`${dropTarget} dropped (${outcome?.deleted ?? 0} document(s))`);
          })
        }
      />

      <div className="panel p-5">
        <div className="text-sm font-medium">Calling the database from your frontend</div>
        <p className="mt-1 text-xs text-muted-foreground">
          Requests are scoped to this project automatically and must include credentials so the visitor session cookie
          travels with them.
        </p>
        <Textarea
          readOnly
          rows={7}
          className="mt-3 font-mono text-[11.5px]"
          value={`const res = await fetch('/api/db/find', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    table: '${table ?? "orders"}',
    filter: { active: true },
    sort: { created: -1 },
    limit: 50
  })
});
const { data } = await res.json();`}
        />
      </div>
    </div>
  );
}
