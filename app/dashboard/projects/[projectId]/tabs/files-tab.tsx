"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Download,
  FilePlus2,
  FileUp,
  Folder,
  Pencil,
  Save,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
import { CodeEditor } from "@/components/code-editor";
import { RowCheckbox, SelectAllCheckbox, SelectionToolbar } from "@/components/selection-toolbar";
import { SectionHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/client";
import { apiDelete, apiGet } from "@/app/console";

export function languageFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "html" || ext === "htm") return "html";
  if (ext === "css") return "css";
  if (ext === "js" || ext === "mjs") return "js";
  if (ext === "json") return "json";
  if (ext === "md") return "md";
  return "text";
}

export function isTextPath(path: string): boolean {
  return /\.(html?|css|js|mjs|json|txt|md|svg|xml|csv|webmanifest)$/i.test(path);
}

export interface StoredEntry {
  path: string;
  name: string;
  size: number;
  modified: string;
  type: "file" | "directory";
}

export type FileSort = "name" | "size" | "modified";

export function FilesTab({ projectId }: { projectId: number }) {
  const { t, fmt } = useI18n();
  const [files, setFiles] = useState<StoredEntry[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [dir, setDir] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<FileSort>("name");
  const [usage, setUsage] = useState<{ used: number; total: number; files: number } | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTo, setRenameTo] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);
  const [original, setOriginal] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [newPath, setNewPath] = useState("");
  const uploadRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await apiGet<{ data: StoredEntry[] }>(
        `/api/storage/list?projectId=${projectId}&path=${encodeURIComponent(dir)}`,
      );
      setFiles(data);
      setChecked((prev) =>
        prev.filter((path) => data.some((entry) => entry.path === path && entry.type === "file")),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("files.listFailed"));
    }
    try {
      setUsage(await apiGet<{ used: number; total: number; files: number }>(`/api/storage/status?projectId=${projectId}`));
    } catch {
      // The meter is decoration; a failure to read it must not hide the files.
    }
  }, [dir, projectId, t]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const openFile = useCallback(
    async (path: string) => {
      setSelected(path);
      setOriginal("");
      setContent("");
      if (!isTextPath(path)) return;
      try {
        const response = await fetch(`/api/storage/download?projectId=${projectId}&path=${encodeURIComponent(path)}`, {
          credentials: "include",
        });
        const text = await response.text();
        setOriginal(text);
        setContent(text);
      } catch {
        toast.error(t("files.openFailed"));
      }
    },
    [projectId, t],
  );

  async function saveFile() {
    if (!selected) return;
    setSaving(true);
    try {
      const response = await fetch(
        `/api/storage/upload?projectId=${projectId}&path=${encodeURIComponent(selected)}`,
        { method: "POST", credentials: "include", body: content, headers: { "content-type": "text/plain" } },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? t("files.saveFailed"));
      }
      toast.success(t("files.saved"));
      setOriginal(content);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("files.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function uploadFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    let ok = 0;
    for (const file of Array.from(list)) {
      const form = new FormData();
      form.append("file", file);
      // Uploads land in the folder the user is looking at, which is what a
      // file manager does; the bare project root is only the default.
      form.append("path", dir ? `${dir}/${file.name}` : file.name);
      try {
        const response = await fetch(`/api/storage/upload?projectId=${projectId}`, {
          method: "POST",
          credentials: "include",
          body: form,
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? t("files.uploadFailed"));
        }
        ok += 1;
      } catch (error) {
        toast.error(`${file.name}: ${error instanceof Error ? error.message : t("files.uploadFailed")}`);
      }
    }
    if (ok > 0) toast.success(t("files.uploaded", { count: fmt.number(ok) }));
    await load();
  }

  async function deleteFile(path: string, isDirectory = false) {
    const label = isDirectory
      ? t("files.delete.confirmFolder", { path })
      : path;
    if (!window.confirm(t("files.delete.confirm", { label }))) return;
    try {
      await apiDelete(
        `/api/storage/delete?projectId=${projectId}&path=${encodeURIComponent(path)}${isDirectory ? "&prefix=1" : ""}`,
      );
      if (selected === path) setSelected(null);
      setChecked((prev) => prev.filter((entry) => entry !== path));
      toast.success(t("files.delete.done"));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("files.delete.failed"));
    }
  }

  async function deleteChecked(paths: string[]) {
    if (paths.length === 0) return;
    if (!window.confirm(t("files.delete.confirmCount", { count: fmt.number(paths.length) }))) return;
    for (const path of paths) {
      await apiDelete(`/api/storage/delete?projectId=${projectId}&path=${encodeURIComponent(path)}`).catch(
        () => undefined,
      );
    }
    toast.success(t("files.delete.doneCount", { count: fmt.number(paths.length) }));
    if (selected && paths.includes(selected)) setSelected(null);
    setChecked([]);
    await load();
  }

  function startRename(path: string) {
    setSelected(path);
    setRenameTo(path);
    setRenameOpen(true);
  }

  async function submitRename(event: React.FormEvent) {
    event.preventDefault();
    const from = selected;
    const to = renameTo.trim().replace(/^\/+/, "");
    if (!from || !to || to === from) {
      setRenameOpen(false);
      return;
    }
    setRenameBusy(true);
    try {
      const response = await fetch(`/api/storage/move?projectId=${projectId}`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ from, to }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? t("files.rename.failed"));
      }
      toast.success(t("files.rename.done", { to }));
      setRenameOpen(false);
      setChecked((prev) => prev.map((entry) => (entry === from ? to : entry)));
      await load();
      await openFile(to);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("files.rename.failed"));
    } finally {
      setRenameBusy(false);
    }
  }

  async function createFile(event: React.FormEvent) {
    event.preventDefault();
    const path = newPath.trim().replace(/^\/+/, "");
    if (!path) return;
    try {
      const response = await fetch(`/api/storage/upload?projectId=${projectId}&path=${encodeURIComponent(path)}`, {
        method: "POST",
        credentials: "include",
        body: "",
        headers: { "content-type": "text/plain" },
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? t("files.new.failed"));
      }
      setNewOpen(false);
      setNewPath("");
      toast.success(t("files.new.created", { name: path }));
      await load();
      await openFile(path);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("files.new.failed"));
    }
  }

  // Filtering happens before sorting so "sort by size" means "biggest thing
  // matching my search", which is what the eye expects.
  const needle = query.trim().toLowerCase();
  const listed = (files ?? [])
    .filter((entry) => entry.type === "file" || dir !== "")
    .filter((entry) => (needle ? entry.name.toLowerCase().includes(needle) : true))
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      if (sort === "size") return b.size - a.size;
      if (sort === "modified") return b.modified.localeCompare(a.modified);
      return a.name.localeCompare(b.name);
    });
  const filePaths = listed.filter((entry) => entry.type === "file").map((entry) => entry.path);
  const allFilesChecked = filePaths.length > 0 && filePaths.every((path) => checked.includes(path));
  const usedPct = usage && usage.total > 0 ? Math.min(100, (usage.used / usage.total) * 100) : 0;

  const crumbs = dir ? dir.split("/").filter(Boolean) : [];

  return (
    <div className="space-y-4">
      <SectionHeader
        title={t("files.title")}
        description={t("files.description")}
        actions={
          <>
            <input
              ref={uploadRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                void uploadFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <Button variant="outline" size="sm" onClick={() => uploadRef.current?.click()}>
              <FileUp className="h-3.5 w-3.5" /> {t("files.upload")}
            </Button>
            <Dialog open={newOpen} onOpenChange={setNewOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <FilePlus2 className="h-3.5 w-3.5" /> {t("files.new")}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{t("files.new")}</DialogTitle>
                  <DialogDescription>{t("files.new.description")}</DialogDescription>
                </DialogHeader>
                <form onSubmit={createFile} className="space-y-4">
                  <Input
                    value={newPath}
                    onChange={(e) => setNewPath(e.target.value)}
                    placeholder="index.html"
                    className="ltr-input font-mono"
                    dir="ltr"
                    autoFocus
                    required
                  />
                  <DialogFooter>
                    <Button type="submit">{t("files.new.submit")}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </>
        }
      />
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("files.rename.title")}</DialogTitle>
            <DialogDescription>{t("files.rename.description")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitRename} className="space-y-4">
            <Input
              value={renameTo}
              onChange={(e) => setRenameTo(e.target.value)}
              className="ltr-input font-mono text-12.5px"
              dir="ltr"
              autoFocus
              required
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenameOpen(false)}>
                {t("action.cancel")}
              </Button>
              <Button type="submit" disabled={renameBusy}>
                {renameBusy ? t("files.rename.moving") : t("action.move")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {usage && (
        <div className="flex items-center gap-3 text-12px text-muted-foreground">
          <div className="h-1.5 w-40 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", usedPct > 90 ? "bg-destructive" : "bg-signal")}
              style={{ width: `${usedPct}%` }}
            />
          </div>
          <span className="nums">
            {t("files.usage.used", { used: fmt.bytes(usage.used), total: fmt.bytes(usage.total) })}
          </span>
          <span>·</span>
          <span className="nums">{t("files.usage.count", { count: fmt.number(usage.files) })}</span>
        </div>
      )}
      {files && files.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
              <nav aria-label={t("label.folder")} className="flex min-w-0 items-center gap-1 text-12.5px">
                <button
                  type="button"
                  className={cn("ltr-content font-mono hover:text-signal", dir === "" && "text-foreground")}
                  onClick={() => setDir("")}
                >
                  {t("files.root")}
                </button>
                {crumbs.map((crumb, index) => (
                  <span key={crumb + index} className="flex items-center gap-1">
                    <span className="text-muted-foreground">/</span>
                    <button
                      type="button"
                      className={cn(
                        "ltr-content font-mono hover:text-signal",
                        index === crumbs.length - 1 && "text-foreground",
                      )}
                      onClick={() => setDir(crumbs.slice(0, index + 1).join("/"))}
                    >
                      {crumb}
                    </button>
                  </span>
                ))}
              </nav>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("files.filter.placeholder")}
                className="ms-auto h-8 w-44 text-12.5px"
                aria-label={t("files.filter.ariaLabel")}
              />
              <Select value={sort} onValueChange={(value) => setSort(value as FileSort)}>
                <SelectTrigger className="h-8 w-36 text-12.5px" aria-label={t("files.filter.ariaLabel")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">{t("files.sort.name")}</SelectItem>
                  <SelectItem value="size">{t("files.sort.size")}</SelectItem>
                  <SelectItem value="modified">{t("files.sort.modified")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <SelectionToolbar
              selected={checked}
              noun="selection.file"
              onClear={() => setChecked([])}
            >
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-12px text-muted-foreground hover:text-destructive"
                onClick={() => void deleteChecked(checked)}
              >
                <Trash2 className="h-3.5 w-3.5" /> {t("transfer.deleteCount", { count: fmt.number(checked.length) })}
              </Button>
            </SelectionToolbar>
            <Table>
              <TableHeader>
                <TableRow className="h-8">
                  <TableHead className="w-10">
                    <SelectAllCheckbox
                      selected={checked}
                      total={filePaths.length}
                      label={t("files.selectAll")}
                      allSelected={allFilesChecked}
                      hiddenSelected={checked.length - filePaths.filter((p) => checked.includes(p)).length}
                      onToggle={(all) =>
                        setChecked((prev) =>
                          all
                            ? [...new Set([...prev, ...filePaths])]
                            : prev.filter((path) => !filePaths.includes(path)),
                        )
                      }
                    />
                  </TableHead>
                  <TableHead>{t("files.table.name")}</TableHead>
                  <TableHead className="w-28 text-end">{t("files.table.size")}</TableHead>
                  <TableHead className="w-36">{t("files.table.modified")}</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {listed.map((entry) => (
                  <TableRow
                    key={entry.path}
                    className={cn(
                      "h-8",
                      entry.type === "directory" && "bg-blueprint/[0.07] hover:bg-blueprint/[0.11]",
                      checked.includes(entry.path) && "bg-muted/40",
                    )}
                  >
                    <TableCell className="py-0.5">
                      {entry.type === "file" ? (
                        <RowCheckbox
                          id={entry.path}
                          selected={checked}
                          onToggle={(id, next) =>
                            setChecked((prev) =>
                              next ? [...prev, id] : prev.filter((x) => x !== id),
                            )
                          }
                        />
                      ) : null}
                    </TableCell>
                    <TableCell className="py-0.5">
                      {entry.type === "directory" ? (
                        <button
                          type="button"
                          className="ltr-content flex items-center gap-1.5 text-12.5px font-medium text-blueprint hover:text-signal"
                          onClick={() => setDir(entry.path)}
                        >
                          <Folder className="h-3.5 w-3.5 fill-blueprint/25 text-blueprint" />
                          {entry.name}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="ltr-content font-mono text-12.5px text-foreground/85 hover:text-signal"
                          onClick={() => void openFile(entry.path)}
                        >
                          {entry.name}
                        </button>
                      )}
                      {selected === entry.path && <Badge className="ms-2">{t("files.editing")}</Badge>}
                    </TableCell>
                    <TableCell className="nums py-0.5 text-end text-12.5px text-muted-foreground">
                      {entry.type === "directory" ? "—" : fmt.bytes(entry.size)}
                    </TableCell>
                    <TableCell className="py-0.5 text-12px text-muted-foreground">
                      {entry.modified ? fmt.dateTime(new Date(entry.modified).getTime()) : ""}
                    </TableCell>
                    <TableCell className="py-0.5 text-end">
                      {entry.type === "file" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground"
                          title={t("files.rename.title")}
                          onClick={() => startRename(entry.path)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        title={t("files.delete.title")}
                        onClick={() => void deleteFile(entry.path, entry.type === "directory")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {listed.length === 0 && (
              <p className="px-3 py-6 text-center text-13px text-muted-foreground">
                {needle ? t("files.empty.filtered", { query }) : t("files.empty.folder")}
              </p>
            )}
          </CardContent>
        </Card>
      )}
      {files && files.length === 0 && (
        <p className="text-13px text-muted-foreground">{t("files.empty.body")}</p>
      )}
      {selected && isTextPath(selected) ? (
        <div className="space-y-2">
          <CodeEditor
            path={selected}
            value={content}
            language={languageFor(selected)}
            dirty={content !== original}
            saving={saving}
            onChange={setContent}
            onSave={() => void saveFile()}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setContent(original)} disabled={content === original}>
              {t("action.reset")}
            </Button>
            <Button size="sm" onClick={() => void saveFile()} disabled={saving || content === original}>
              <Save className="h-3.5 w-3.5" /> {saving ? t("action.saving") : t("action.save")}
            </Button>
          </div>
        </div>
      ) : (
        selected && (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-dashed px-3 py-4 text-13px text-muted-foreground">
            <span className="ltr-content font-mono text-foreground">{selected}</span>
            <span>{t("files.binary")}</span>
            <div className="ms-auto flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => startRename(selected)}>
                <Pencil className="h-3.5 w-3.5" /> {t("action.rename")}
              </Button>
              <Button asChild variant="outline" size="sm">
                <a
                  href={`/api/storage/download?projectId=${projectId}&path=${encodeURIComponent(selected)}&download=1`}
                >
                  <Download className="h-3.5 w-3.5" /> {t("action.download")}
                </a>
              </Button>
            </div>
          </div>
        )
      )}
    </div>
  );
}
