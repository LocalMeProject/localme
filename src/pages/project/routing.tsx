import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  ArrowRightLeft,
  FileCode2,
  Loader2,
  Lock,
  Plus,
  Route as RouteIcon,
  Server,
  Trash2,
  Unlock,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useProject } from "@/components/project-layout";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
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
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { errorText } from "@/lib/errors";
import { markMilestone } from "@/lib/onboarding";

type RouteRow = {
  id: Id<"routes">;
  pathPattern: string;
  targetFile: string | null;
  isProxy: boolean;
  proxyConfig: { target: string; method: string; headers: Record<string, string>; timeout_seconds: number } | null;
  requiresAuth: boolean;
  requiredRole: string | null;
  isActive: boolean;
  updatedAt: number;
  targetMissing: boolean;
};

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"];

const emptyForm = {
  pathPattern: "",
  targetFile: "",
  isProxy: false,
  proxyTarget: "",
  proxyMethod: "POST",
  proxyHeaders: "{}",
  proxyTimeout: 30,
  requiresAuth: false,
  requiredRole: "",
};

export function ProjectRouting() {
  const { project, token } = useProject();
  const projectId = project.id as Id<"projects">;

  // First-run progress: configuring how the project is served counts as done.
  useEffect(() => {
    markMilestone("structure");
  }, []);

  const data = useQuery(api.routing.list, { token, projectId });
  const endpoints = useQuery(api.routing.listEndpoints, { token, projectId });
  const roles = useQuery(api.access.listRoles, { token, projectId });

  const create = useMutation(api.routing.create);
  const update = useMutation(api.routing.update);
  const remove = useMutation(api.routing.remove);
  const updateEndpoint = useMutation(api.routing.updateEndpoint);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"routes"> | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RouteRow | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(timer);
  }, [notice]);

  const routes: RouteRow[] = data?.routes ?? [];
  const htmlFiles: string[] = data?.htmlFiles ?? [];
  const roleNames: string[] = (roles ?? []).map((role: { name: string }) => role.name);

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

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, targetFile: htmlFiles[0] ?? "" });
    setDialogOpen(true);
  };

  const openEdit = (route: RouteRow) => {
    setEditingId(route.id);
    setForm({
      pathPattern: route.pathPattern,
      targetFile: route.targetFile ?? "",
      isProxy: route.isProxy,
      proxyTarget: route.proxyConfig?.target ?? "",
      proxyMethod: route.proxyConfig?.method ?? "POST",
      proxyHeaders: JSON.stringify(route.proxyConfig?.headers ?? {}, null, 2),
      proxyTimeout: route.proxyConfig?.timeout_seconds ?? 30,
      requiresAuth: route.requiresAuth,
      requiredRole: route.requiredRole ?? "",
    });
    setDialogOpen(true);
  };

  const submit = () =>
    guard(async () => {
      const proxyConfig = form.isProxy
        ? {
            target: form.proxyTarget.trim(),
            method: form.proxyMethod,
            headers: JSON.parse(form.proxyHeaders.trim() || "{}"),
            timeout_seconds: form.proxyTimeout,
          }
        : undefined;
      if (editingId) {
        await update({
          token,
          projectId,
          routeId: editingId,
          pathPattern: form.pathPattern,
          targetFile: form.isProxy ? undefined : form.targetFile,
          isProxy: form.isProxy,
          proxyConfig,
          requiresAuth: form.requiresAuth,
          requiredRole: form.requiredRole || undefined,
        });
        setNotice(`${form.pathPattern} updated`);
      } else {
        await create({
          token,
          projectId,
          pathPattern: form.pathPattern,
          targetFile: form.isProxy ? undefined : form.targetFile,
          isProxy: form.isProxy,
          proxyConfig,
          requiresAuth: form.requiresAuth,
          requiredRole: form.requiredRole || undefined,
        });
        setNotice(`${form.pathPattern} is live`);
      }
      setDialogOpen(false);
    });

  return (
    <div className="space-y-5">
      {error && <Alert variant="destructive">{error}</Alert>}
      {notice && (
        <div className="flex items-center gap-2 text-[11px] text-signal">
          <span className="h-1.5 w-1.5 rounded-full bg-signal" />
          {notice}
        </div>
      )}

      <div className="panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div>
            <div className="text-sm font-medium">Routes</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Only HTML files can be routed. Wildcards such as <span className="font-mono">/blog/*</span> are supported.
            </div>
          </div>
          <Button variant="signal" size="sm" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />
            Add route
          </Button>
        </div>

        {data === undefined ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-9 w-full" />
            ))}
          </div>
        ) : routes.length === 0 ? (
          <EmptyState
            className="m-5"
            icon={RouteIcon}
            title="No routes yet"
            description="Every project starts with a homepage route. Add more to serve additional pages."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Path</TableHead>
                <TableHead>Serves</TableHead>
                <TableHead>Access</TableHead>
                <TableHead className="w-20 text-center">Live</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {routes.map((route) => (
                <TableRow key={route.id}>
                  <TableCell className="font-mono text-xs">{route.pathPattern}</TableCell>
                  <TableCell>
                    {route.isProxy ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="blueprint">proxy</Badge>
                        <span className="max-w-[14rem] truncate font-mono text-[11px] text-muted-foreground">
                          {route.proxyConfig?.method} {route.proxyConfig?.target}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <FileCode2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-mono text-[11px]">{route.targetFile ?? "—"}</span>
                        {route.targetMissing && (
                          <Badge variant="warning">
                            <AlertTriangle className="h-3 w-3" />
                            missing
                          </Badge>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {route.requiresAuth ? (
                      <Badge variant="signal">
                        <Lock className="h-3 w-3" />
                        {route.requiredRole ?? "any visitor"}
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        <Unlock className="h-3 w-3" />
                        public
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={route.isActive}
                      disabled={busy}
                      onCheckedChange={(checked) =>
                        guard(async () => {
                          await update({ token, projectId, routeId: route.id, isActive: checked });
                        })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" title="Edit route" onClick={() => openEdit(route)}>
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Delete route"
                        disabled={route.pathPattern === "/"}
                        onClick={() => setDeleteTarget(route)}
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

        {data && (
          <div className="border-t border-border px-5 py-3 text-[11px] text-muted-foreground">
            Routable HTML files:{" "}
            <span className="font-mono text-foreground">
              {htmlFiles.length > 0 ? htmlFiles.join(", ") : "none uploaded yet"}
            </span>
            . Reserved prefixes: <span className="font-mono">{data.reservedPrefixes.join(", ")}</span>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="border-b border-border px-5 py-3">
          <div className="text-sm font-medium">API endpoints</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Disable or gate individual REST endpoints for this project. Changes apply immediately.
          </div>
        </div>
        {endpoints === undefined ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-8 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Endpoint</TableHead>
                <TableHead>Permission</TableHead>
                <TableHead className="w-28 text-center">Enabled</TableHead>
                <TableHead className="w-28 text-center">Requires auth</TableHead>
                <TableHead className="w-40">Required role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {endpoints.map(
                (endpoint: {
                  name: string;
                  description: string;
                  permission: string;
                  isEnabled: boolean;
                  requiresAuth: boolean;
                  requiredRole: string;
                }) => (
                  <TableRow key={endpoint.name}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Server className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-mono text-[11px]">{endpoint.name}</span>
                      </div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">{endpoint.description}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{endpoint.permission}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={endpoint.isEnabled}
                        disabled={busy}
                        onCheckedChange={(checked) =>
                          guard(async () => {
                            await updateEndpoint({
                              token,
                              projectId,
                              endpointName: endpoint.name,
                              isEnabled: checked,
                            });
                          })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={endpoint.requiresAuth}
                        disabled={busy}
                        onCheckedChange={(checked) =>
                          guard(async () => {
                            await updateEndpoint({
                              token,
                              projectId,
                              endpointName: endpoint.name,
                              requiresAuth: checked,
                            });
                          })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={endpoint.requiredRole}
                        onValueChange={(value) =>
                          guard(async () => {
                            await updateEndpoint({
                              token,
                              projectId,
                              endpointName: endpoint.name,
                              requiredRole: value,
                            });
                          })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["Owner", "Admin", "Member", "Guest", ...roleNames.filter((name) => !["Owner", "Admin", "Member", "Guest"].includes(name))].map(
                            (name) => (
                              <SelectItem key={name} value={name}>
                                {name}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ),
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit route" : "Add route"}</DialogTitle>
            <DialogDescription>
              A route serves an HTML file from storage, or forwards the request to an external API through the proxy.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="route-path">Path</Label>
              <Input
                id="route-path"
                value={form.pathPattern}
                onChange={(event) => setForm({ ...form, pathPattern: event.target.value })}
                placeholder="/about"
                className="font-mono"
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">
                Reserved prefixes are rejected: {data?.reservedPrefixes.join(", ")}
              </p>
            </div>

            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
              <div>
                <div className="text-xs font-medium">Proxy route</div>
                <div className="text-[11px] text-muted-foreground">Forward to an external API with secret headers.</div>
              </div>
              <Switch
                checked={form.isProxy}
                onCheckedChange={(checked) => setForm({ ...form, isProxy: checked })}
              />
            </div>

            {form.isProxy ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="proxy-target">Target URL</Label>
                  <Input
                    id="proxy-target"
                    value={form.proxyTarget}
                    onChange={(event) => setForm({ ...form, proxyTarget: event.target.value })}
                    placeholder="https://api.stripe.com/v1/payment_intents"
                    className="font-mono text-xs"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Method</Label>
                    <Select
                      value={form.proxyMethod}
                      onValueChange={(value) => setForm({ ...form, proxyMethod: value })}
                    >
                      <SelectTrigger className="text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {METHODS.map((method) => (
                          <SelectItem key={method} value={method}>
                            {method}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="proxy-timeout">Timeout (seconds)</Label>
                    <Input
                      id="proxy-timeout"
                      type="number"
                      min={1}
                      max={60}
                      value={form.proxyTimeout}
                      onChange={(event) => setForm({ ...form, proxyTimeout: Number(event.target.value) })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="proxy-headers">Headers (JSON)</Label>
                  <Textarea
                    id="proxy-headers"
                    rows={4}
                    value={form.proxyHeaders}
                    onChange={(event) => setForm({ ...form, proxyHeaders: event.target.value })}
                    className="font-mono text-[12px]"
                    placeholder='{ "Authorization": "Bearer {{STRIPE_KEY}}" }'
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Reference stored secrets with <span className="font-mono">{"{{KEY_NAME}}"}</span>. Values are
                    substituted server-side and never reach the browser.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Target file</Label>
                <Select
                  value={form.targetFile || undefined}
                  onValueChange={(value) => setForm({ ...form, targetFile: value })}
                >
                  <SelectTrigger className="font-mono text-xs">
                    <SelectValue placeholder="Select an HTML file" />
                  </SelectTrigger>
                  <SelectContent>
                    {htmlFiles.map((file) => (
                      <SelectItem key={file} value={file} className="font-mono text-xs">
                        {file}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {htmlFiles.length === 0 && (
                  <p className="text-[11px] text-amber-500">
                    Upload an HTML file in Storage before creating a route.
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
              <div>
                <div className="text-xs font-medium">Require a signed-in visitor</div>
                <div className="text-[11px] text-muted-foreground">Unsigned visitors are sent to the login page.</div>
              </div>
              <Switch
                checked={form.requiresAuth}
                onCheckedChange={(checked) => setForm({ ...form, requiresAuth: checked })}
              />
            </div>

            {form.requiresAuth && (
              <div className="space-y-1.5">
                <Label>Required role</Label>
                <Select
                  value={form.requiredRole || "Member"}
                  onValueChange={(value) => setForm({ ...form, requiredRole: value })}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Owner", "Admin", "Member", "Guest", ...roleNames].map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Permissions are hierarchical: Admin satisfies a Member requirement, Owner satisfies everything.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="signal" disabled={busy || !form.pathPattern.trim()} onClick={() => void submit()}>
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {editingId ? "Save route" : "Create route"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete route ${deleteTarget?.pathPattern ?? ""}?`}
        description="The route stops serving immediately. Files and data are untouched."
        confirmLabel="Delete route"
        pending={busy}
        onConfirm={() =>
          guard(async () => {
            if (!deleteTarget) return;
            await remove({ token, projectId, routeId: deleteTarget.id });
            setNotice(`${deleteTarget.pathPattern} deleted`);
          })
        }
      />

      <div className="panel overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <RouteIcon className="h-3.5 w-3.5 text-signal" />
          <span className="mono-label">resolution order</span>
        </div>
        <ol className="space-y-2 px-5 py-4 text-xs text-muted-foreground">
          <li>1. An exact route match serves its HTML file.</li>
          <li>2. A wildcard route match serves its HTML file.</li>
          <li>3. A static file at the requested path is served directly.</li>
          <li>4. <span className="font-mono text-foreground">&lt;dir&gt;/index.html</span> is served for directory paths.</li>
          <li>5. <span className="font-mono text-foreground">404.html</span> is returned, or the platform 404 page.</li>
        </ol>
      </div>
    </div>
  );
}
