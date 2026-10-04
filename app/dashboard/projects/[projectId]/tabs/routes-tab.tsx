"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, TriangleAlert, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { RowCheckbox, SelectAllCheckbox, SelectionToolbar } from "@/components/selection-toolbar";
import { TransferControls } from "@/components/transfer-controls";
import { SectionHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/client";
import { apiDelete, apiGet, apiPost } from "@/app/console";

export interface ConsoleRoute {
  id: number;
  pathPattern: string;
  targetFile: string | null;
  isProxy: boolean;
  requiresAuth: boolean;
  requiredRole: string | null;
  requiredPermission: string | null;
  isActive: boolean;
}

export function RoutesTab({ projectId, base }: { projectId: number; base: string | null }) {
  const { t, fmt } = useI18n();
  const [routes, setRoutes] = useState<ConsoleRoute[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [files, setFiles] = useState<string[]>([]);
  const [pathPattern, setPathPattern] = useState("/");
  const [targetFile, setTargetFile] = useState("index.html");
  const [isProxy, setIsProxy] = useState(false);
  const [proxyTarget, setProxyTarget] = useState("");
  const [requiresAuth, setRequiresAuth] = useState(false);
  const [requiredRole, setRequiredRole] = useState("");
  const [requiredPermission, setRequiredPermission] = useState("any");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  // The single most common Routing complaint was "I defined the path and it
  // still 404s" — almost always because the target file was never created, or
  // was created under a different name. Having the file list in hand turns that
  // into an inline warning on the form and a badge on the saved row.
  const targetMissing =
    !isProxy &&
    targetFile.trim().length > 0 &&
    files.length > 0 &&
    !files.includes(targetFile.trim().replace(/^\/+/, ""));

  const load = useCallback(async () => {
    try {
      const { data } = await apiGet<{ data: ConsoleRoute[] }>(`/api/routes?projectId=${projectId}`);
      setRoutes(data);
      // The §5.5 permission catalogue ships with the keys endpoint, so the
      // permission picker never hardcodes its own list.
      const keys = await apiGet<{ availablePermissions?: string[] }>(`/api/keys?projectId=${projectId}`);
      setPermissions(keys.availablePermissions ?? []);
      // Knowing which files exist is what turns "this route 404s" into a
      // warning next to the target field rather than a mystery at request time.
      const listing = await apiGet<{ data: Array<{ path: string; type: string }> }>(
        `/api/storage/list?projectId=${projectId}`,
      );
      setFiles(listing.data.filter((entry) => entry.type !== "directory").map((entry) => entry.path));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("routes.loadFailed"));
      setRoutes([]);
    }
  }, [projectId, t]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function saveRoute(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await apiPost(`/api/routes?projectId=${projectId}`, {
        pathPattern,
        targetFile: isProxy ? null : targetFile,
        isProxy,
        proxyConfig: isProxy ? { target: proxyTarget } : undefined,
        requiresAuth,
        requiredRole: requiredRole || null,
        requiredPermission: requiredPermission === "any" ? null : requiredPermission,
        isActive: true,
      });
      toast.success(t("routes.save.done", { path: pathPattern }));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("routes.save.failed"));
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelectedRoutes() {
    if (selected.length === 0) return;
    if (!window.confirm(t("routes.delete.confirm", { count: fmt.number(selected.length) }))) return;
    for (const route of routes ?? []) {
      if (selected.includes(route.pathPattern)) {
        await apiDelete(`/api/routes/${route.id}?projectId=${projectId}`).catch(() => undefined);
      }
    }
    toast.success(t("routes.delete.doneCount", { count: fmt.number(selected.length) }));
    setSelected([]);
    await load();
  }

  async function deleteRoute(id: number) {
    try {
      await apiDelete(`/api/routes/${id}?projectId=${projectId}`);
      toast.success(t("routes.delete.done"));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("routes.delete.failed"));
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title={t("routes.title")}
        description={t("routes.description")}
        actions={
          <TransferControls
            projectId={projectId}
            feature="routes"
            featureLabel="routes"
            selected={selected}
            allIds={(routes ?? []).map((route) => route.pathPattern)}
            onChanged={load}
            showDelete
            onDelete={async () => {
              await deleteSelectedRoutes();
            }}
          />
        }
      />
      {routes && routes.length === 0 && (
        <p className="text-13px text-muted-foreground">{t("routes.empty")}</p>
      )}
      {routes && routes.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <SelectionToolbar selected={selected} noun="selection.route" onClear={() => setSelected([])} />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <SelectAllCheckbox
                      selected={selected}
                      total={routes.length}
                      label={t("routes.selectAll")}
                      onToggle={(all) =>
                        setSelected(all ? routes.map((route) => route.pathPattern) : [])
                      }
                    />
                  </TableHead>
                  <TableHead>{t("routes.table.path")}</TableHead>
                  <TableHead>{t("routes.table.target")}</TableHead>
                  <TableHead className="w-24 text-end">{t("routes.table.file")}</TableHead>
                  <TableHead className="w-24">{t("routes.table.auth")}</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {routes.map((route) => (
                  <TableRow
                    key={route.id}
                    className={cn(selected.includes(route.pathPattern) && "bg-muted/40")}
                  >
                    <TableCell>
                      <RowCheckbox
                        id={route.pathPattern}
                        selected={selected}
                        onToggle={(id, next) =>
                          setSelected((prev) => (next ? [...prev, id] : prev.filter((x) => x !== id)))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <span className="ltr-content font-mono text-12.5px">{route.pathPattern}</span>
                      {base && (
                        <a
                          href={`${base}${route.pathPattern === "/" ? "/" : route.pathPattern}`}
                          target="_blank"
                          rel="noreferrer"
                          title={t("routes.openTitle", { path: route.pathPattern })}
                          className="ms-2 align-middle text-11px text-signal hover:underline"
                        >
                          {t("routes.open")}
                        </a>
                      )}
                      {!route.isActive && (
                        <Badge variant="outline" className="ms-2">
                          {t("routes.disabled")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-end">
                      {!route.isProxy && (
                        <span
                          className="text-11px text-muted-foreground"
                          title={t("routes.downloadTitle", { file: route.targetFile ?? "" })}
                        >
                          <a
                            className="hover:text-signal hover:underline"
                            href={`/api/storage/download?projectId=${projectId}&path=${encodeURIComponent(route.targetFile ?? "")}`}
                          >
                            {files.length > 0 && route.targetFile && !files.includes(route.targetFile) ? (
                              <span className="inline-flex items-center gap-1 text-destructive">
                                <TriangleAlert className="h-3 w-3" /> {t("routes.missing")}
                              </span>
                            ) : (
                              t("routes.download")
                            )}
                          </a>
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-12.5px">
                      {route.isProxy ? (
                        <span className="text-signal">{t("routes.proxyMount")}</span>
                      ) : (
                        <span className="ltr-content font-mono text-12px">{route.targetFile}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {route.requiresAuth || route.requiredPermission ? (
                        <span className="flex flex-wrap items-center gap-1">
                          <Badge variant="outline">{route.requiredRole ?? t("routes.anyVisitor")}</Badge>
                          {route.requiredPermission && (
                            <Badge variant="blueprint" className="font-mono text-11px">
                              {route.requiredPermission}
                            </Badge>
                          )}
                        </span>
                      ) : (
                        <span className="text-12.5px text-muted-foreground">{t("routes.public")}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-muted-foreground hover:text-destructive"
                        onClick={() => void deleteRoute(route.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("routes.form.title")}</CardTitle>
          <CardDescription className="text-12.5px">
            {t("routes.form.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveRoute} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="route-path">{t("routes.form.pathLabel")}</Label>
                <Input
                  id="route-path"
                  value={pathPattern}
                  onChange={(e) => setPathPattern(e.target.value)}
                  className="ltr-input font-mono text-12.5px"
                  dir="ltr"
                  placeholder="/"
                  required
                />
              </div>
              {!isProxy && (
                <div className="space-y-1.5">
                  <Label htmlFor="route-target">{t("routes.form.targetLabel")}</Label>
                  <Input
                    id="route-target"
                    list="route-target-options"
                    value={targetFile}
                    onChange={(e) => setTargetFile(e.target.value)}
                    dir="ltr"
                    className={cn("ltr-input font-mono text-12.5px", targetMissing && "border-destructive")}
                    placeholder="index.html"
                    required={!isProxy}
                    aria-invalid={targetMissing}
                    aria-describedby="route-target-hint"
                  />
                  <datalist id="route-target-options">
                    {files.map((path) => (
                      <option key={path} value={path} />
                    ))}
                  </datalist>
                  <p id="route-target-hint" className="text-11.5px text-muted-foreground">
                    {targetMissing ? (
                      <span className="inline-flex items-center gap-1 text-destructive">
                        <TriangleAlert className="h-3 w-3 shrink-0" />
                        {t("routes.form.targetMissing", { file: targetFile.trim() })}
                      </span>
                    ) : files.length === 0 ? (
                      t("routes.form.targetNoFiles")
                    ) : (
                      t("routes.form.targetCount", { count: fmt.number(files.length) })
                    )}
                  </p>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 text-13px">
                <Switch checked={isProxy} onCheckedChange={setIsProxy} /> {t("routes.form.proxy")}
              </label>
              {isProxy && (
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Input
                    value={proxyTarget}
                    onChange={(e) => setProxyTarget(e.target.value)}
                    className="ltr-input font-mono text-12.5px"
                    dir="ltr"
                    placeholder="https://api.example.com/v1"
                    required={isProxy}
                  />
                </div>
              )}
              <label className="flex items-center gap-2 text-13px">
                <Switch checked={requiresAuth} onCheckedChange={setRequiresAuth} /> {t("routes.form.requiresAuth")}
              </label>
              {requiresAuth && (
                <>
                  <Input
                    value={requiredRole}
                    onChange={(e) => setRequiredRole(e.target.value)}
                    className="ltr-input w-40 font-mono text-12.5px"
                    dir="ltr"
                    placeholder={t("routes.form.rolePlaceholder")}
                  />
                  <Select value={requiredPermission} onValueChange={setRequiredPermission}>
                    <SelectTrigger className="w-52" aria-label={t("routes.form.permissionAria")}>
                      <SelectValue placeholder={t("routes.form.permissionPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">{t("routes.form.anyPermission")}</SelectItem>
                      {permissions.map((permission) => (
                        <SelectItem key={permission} value={permission}>
                          {permission}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" size="sm" disabled={busy}>
                {busy ? t("action.saving") : t("routes.form.save")}
              </Button>
              {base && (
                <Button asChild variant="outline" size="sm">
                  <a
                    href={`${base}${pathPattern.startsWith("/") ? pathPattern : `/${pathPattern}`}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> {t("routes.form.test")}
                  </a>
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
