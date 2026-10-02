"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Copy, FileUp, FolderUp, Library, RefreshCw, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader, SectionHeader } from "@/components/page-header";
import { useI18n } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/catalog";
import { apiDelete, apiGet, apiPost } from "@/app/console";

interface LibraryRow {
  path: string;
  size: number;
  modified: string;
}

interface LibraryResponse {
  data: LibraryRow[];
  usage: { used: number; cap: number };
  username: string;
  /** The prefix every reference uses, e.g. "/ada/library". */
  publicUrl: string;
}

/** Anything that is not a document the browser would execute is fair game. */
function blockedExtension(path: string): boolean {
  return /\.html?$/i.test(path);
}

export default function LibraryPage() {
  const { t, fmt } = useI18n();
  const [state, setState] = useState<LibraryResponse | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const result = await apiGet<LibraryResponse>("/api/library");
      setState(result);
      setSelected((prev) => prev.filter((path) => result.data.some((entry) => entry.path === path)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("library.loadFailed"));
    }
  }, [t]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const listed = useMemo(() => {
    const rows = state?.data ?? [];
    const needle = query.trim().toLowerCase();
    return needle ? rows.filter((row) => row.path.toLowerCase().includes(needle)) : rows;
  }, [query, state]);

  async function upload(files: FileList | null, stripRoot = false) {
    if (!files || files.length === 0) return;
    setUploading(true);
    let ok = 0;
    for (const file of Array.from(files)) {
      // Paths must carry their folders: a browser gives a flat name unless the
      // picker used webkitdirectory, and "css/theme.css" is the whole point of a
      // shared library.
      let relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      // A directory pick reports the chosen folder as the first segment. The
      // user pointed at that folder on purpose, so publishing its *contents*
      // is what they meant: `css/theme.css`, not `css/css/theme.css`.
      if (stripRoot) relative = relative.split("/").slice(1).join("/") || file.name;
      if (blockedExtension(relative)) {
        toast.error(t("library.publish.blockedHtml", { path: relative }));
        continue;
      }
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = "";
        // Chunked so a few-MB asset does not blow the argument limit of apply.
        for (let i = 0; i < bytes.length; i += 0x8000) {
          binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        }
        await apiPost("/api/library/upload", { path: relative, contentBase64: btoa(binary) });
        ok += 1;
      } catch (error) {
        toast.error(`${file.name}: ${error instanceof Error ? error.message : t("library.publish.failed")}`);
      }
    }
    setUploading(false);
    if (ok > 0) toast.success(t("library.publish.done", { count: fmt.number(ok) }));
    await load();
  }

  async function remove(paths: string[]) {
    if (paths.length === 0) return;
    if (!window.confirm(t("library.remove.confirm", { count: fmt.number(paths.length) }))) {
      return;
    }
    setBusy(true);
    for (const path of paths) {
      await apiDelete(`/api/library/delete?path=${encodeURIComponent(path)}`).catch(() => undefined);
    }
    setSelected([]);
    setBusy(false);
    toast.success(t("library.remove.done", { count: fmt.number(paths.length) }));
    await load();
  }

  async function copy(text: string, what: MessageKey) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("library.copied", { what: t(what) }));
    } catch {
      toast.error(text);
    }
  }

  const usage = state?.usage;
  const usedPct = usage && usage.cap > 0 ? Math.min(100, (usage.used / usage.cap) * 100) : 0;
  const listedPaths = listed.map((row) => row.path);
  const prefix = state?.publicUrl ?? "/{you}/library";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("library.eyebrow")}
        title={t("library.title")}
        description={t("library.description")}
        actions={
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-3.5 w-3.5" /> {t("action.refresh")}
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("library.stat.usage")}</CardTitle>
            <CardDescription className="text-12.5px">{t("library.stat.usageDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={usedPct > 90 ? "h-full rounded-full bg-destructive" : "h-full rounded-full bg-signal"}
                style={{ width: `${usedPct}%` }}
              />
            </div>
            <p className="nums text-13px">
              {fmt.bytes(usage?.used ?? 0)} / {fmt.bytes(usage?.cap ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("library.stat.assets")}</CardTitle>
            <CardDescription className="text-12.5px">{t("library.stat.assetsDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="nums text-2xl font-semibold">{fmt.number(state?.data.length ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("library.stat.baseUrl")}</CardTitle>
            <CardDescription className="text-12.5px">{t("library.stat.baseUrlDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <button
              type="button"
              onClick={() => void copy(`${window.location.origin}${prefix}`, "library.copy.baseUrl")}
              className="group inline-flex items-center gap-1.5 font-mono text-12.5px text-foreground hover:text-signal"
            >
              {prefix}
              <Copy className="h-3 w-3 text-muted-foreground group-hover:text-signal" />
            </button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <SectionHeader
          title={t("library.publish.title")}
          description={t("library.publish.description")}
        />
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => {
                void upload(event.target.files);
                event.target.value = "";
              }}
            />
            {/* webkitdirectory publishes a whole folder with its structure kept,
                which is how a `css/` or `fonts/` tree gets into the library. */}
            <input
              ref={dirRef}
              type="file"
              multiple
              className="hidden"
              // @ts-expect-error -- non-standard but universally supported
              webkitdirectory=""
              onChange={(event) => {
                void upload(event.target.files, true);
                event.target.value = "";
              }}
            />
            <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
              <FileUp className="h-3.5 w-3.5" /> {uploading ? t("library.publish.uploading") : t("library.publish.chooseFiles")}
            </Button>
            <Button variant="outline" onClick={() => dirRef.current?.click()} disabled={uploading}>
              <FolderUp className="h-3.5 w-3.5" /> {t("library.publish.uploadFolder")}
            </Button>
          </div>
          <p className="flex items-start gap-1.5 text-12px text-muted-foreground">
            <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" />
            {t("library.publish.warning")}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("library.reference.title")}</CardTitle>
          <CardDescription className="text-12.5px">{t("library.reference.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 font-mono text-12px leading-relaxed">{`<link rel="stylesheet" href="${prefix}/theme.css">
<script src="${prefix}/analytics.js" defer></script>

<!-- or, from inside a project (works on custom domains too) -->
<link rel="stylesheet" href="library/theme.css">`}</pre>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center gap-2 border-b px-5 py-3.5">
            <Library className="h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("library.filter.placeholder")}
              className="h-8 w-56 text-12.5px"
              aria-label={t("library.filter.ariaLabel")}
            />
            <span className="nums text-12px text-muted-foreground">
              {t("library.list.of", { shown: fmt.number(listed.length), total: fmt.number(state?.data.length ?? 0) })}
            </span>
            {selected.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="ms-auto h-8 text-muted-foreground hover:text-destructive"
                disabled={busy}
                onClick={() => void remove(selected)}
              >
                <Trash2 className="h-3.5 w-3.5" /> {t("library.remove.selected", { count: fmt.number(selected.length) })}
              </Button>
            )}
          </div>
          {listed.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("label.path")}</TableHead>
                  <TableHead>{t("library.table.url")}</TableHead>
                  <TableHead className="w-24 text-end">{t("label.size")}</TableHead>
                  <TableHead className="w-36">{t("label.updatedAt")}</TableHead>
                  <TableHead className="w-10" />
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {listed.map((row) => {
                  const url = `${prefix}/${row.path.split("/").map(encodeURIComponent).join("/")}`;
                  return (
                    <TableRow key={row.path} className={selected.includes(row.path) ? "bg-muted/40" : undefined}>
                      <TableCell>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[hsl(var(--signal))]"
                            checked={selected.includes(row.path)}
                            onChange={(event) =>
                              setSelected((prev) =>
                                event.target.checked
                                  ? [...new Set([...prev, row.path])]
                                  : prev.filter((path) => path !== row.path),
                              )
                            }
                          />
                          <span className="font-mono text-12.5px">{row.path}</span>
                        </label>
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => void copy(`${window.location.origin}${url}`, "library.copy.publicUrl")}
                          title={t("library.table.copyTitle")}
                          className="group inline-flex max-w-[22rem] items-center gap-1.5 truncate font-mono text-12px text-muted-foreground hover:text-signal"
                        >
                          <span className="truncate">{url}</span>
                          <Copy className="h-3 w-3 shrink-0 group-hover:text-signal" />
                        </button>
                      </TableCell>
                      <TableCell className="nums text-end text-12.5px text-muted-foreground">
                        {fmt.bytes(row.size)}
                      </TableCell>
                      <TableCell className="nums text-12px text-muted-foreground">
                        {row.modified ? fmt.dateTime(new Date(row.modified).getTime()) : ""}
                      </TableCell>
                      <TableCell />
                      <TableCell className="text-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          title={t("library.remove.one")}
                          onClick={() => void remove([row.path])}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="px-5 py-10 text-center text-13px text-muted-foreground">
              {query
                ? t("library.empty.filtered", { query })
                : t("library.empty.body")}
            </p>
          )}
          {listedPaths.length > 0 && selected.length === 0 && (
            <div className="border-t px-5 py-2.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-12px text-muted-foreground"
                onClick={() => setSelected(listedPaths)}
              >
                {t("library.selectAll", { count: fmt.number(listedPaths.length) })}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
