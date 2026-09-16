import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  Activity,
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Database,
  FileCode2,
  FolderKanban,
  HardDrive,
  Loader2,
  RefreshCw,
  Save,
  ScrollText,
  Server,
  Settings2,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
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
import { JsonField } from "@/components/json-field";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { errorText } from "@/lib/errors";
import { formatBytes, formatCount, formatDate, formatDateTime, fromNow } from "@/lib/format";
import { useSessionStore } from "@/lib/session";

type UserRow = {
  id: Id<"users">;
  username: string;
  email: string | null;
  role: "admin" | "operator" | "user";
  storageCapBytes: number;
  isSuspended: boolean;
  createdAt: number;
  lastLoginAt: number | null;
  projectCount: number;
  storageUsed: number;
};

type ProjectRow = {
  id: Id<"projects">;
  name: string;
  owner: string;
  isActive: boolean;
  storageUsed: number;
  storageAllocated: number;
  visitsUsedThisMonth: number;
  freeVisitsPerMonth: number;
  createdAt: number;
  urlPath: string;
};

type ConfigRow = {
  key: string;
  description: string;
  value: unknown;
  isSeeded: boolean;
  secret?: boolean;
};

type PublicAsset = {
  id: Id<"publicLibraryFiles">;
  path: string;
  name: string;
  size: number;
  contentType: string;
  updatedAt: number;
};

function Sparkline({ series, tone = "signal" }: { series: { date: string; value: number }[]; tone?: "signal" | "blueprint" }) {
  const peak = Math.max(1, ...series.map((point) => point.value));
  return (
    <div className="flex h-28 items-end gap-1">
      {series.map((point) => (
        <div key={point.date} className="group flex flex-1 flex-col items-center justify-end gap-1">
          <span className="text-[9px] tabular-nums text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
            {point.value}
          </span>
          <div
            className={tone === "signal" ? "w-full rounded-sm bg-signal/70" : "w-full rounded-sm bg-blueprint/70"}
            style={{ height: `${Math.max(2, (point.value / peak) * 100)}%` }}
            title={`${point.date}: ${point.value}`}
          />
        </div>
      ))}
    </div>
  );
}

export function AdminPage() {
  const token = useSessionStore((state) => state.token) ?? "";

  const overview = useQuery(api.insights.adminOverview, token ? { token } : "skip");
  const signups = useQuery(api.insights.signupSeries, token ? { token } : "skip");
  const users = useQuery(api.accounts.adminListUsers, token ? { token } : "skip") as UserRow[] | undefined;
  const projects = useQuery(api.settings.adminProjects, token ? { token } : "skip") as ProjectRow[] | undefined;
  const configs = useQuery(api.settings.listConfigs, token ? { token } : "skip") as ConfigRow[] | undefined;
  const audit = useQuery(api.accounts.adminAuditLog, token ? { token, limit: 100 } : "skip");
  const publicAssets = useQuery(api.storage.publicLibraryList, token ? { token } : "skip") as PublicAsset[] | undefined;
  const health = useQuery(api.settings.health, {});

  const setUserRole = useMutation(api.accounts.adminSetUserRole);
  const setUserSuspended = useMutation(api.accounts.adminSetUserSuspended);
  const setStorageCap = useMutation(api.accounts.adminSetStorageCap);
  const deleteUser = useMutation(api.accounts.adminDeleteUser);
  const setProjectActive = useMutation(api.settings.adminSetProjectActive);
  const updateConfig = useMutation(api.settings.updateConfig);
  const seedDefaults = useMutation(api.settings.seedDefaults);
  const publicLibraryAdd = useMutation(api.storage.publicLibraryAdd);
  const publicLibraryRemove = useMutation(api.storage.publicLibraryRemove);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteUserTarget, setDeleteUserTarget] = useState<UserRow | null>(null);
  const [configDrafts, setConfigDrafts] = useState<Record<string, string>>({});
  const [assetOpen, setAssetOpen] = useState(false);
  const [assetName, setAssetName] = useState("");
  const [assetContent, setAssetContent] = useState("");
  const [capTarget, setCapTarget] = useState<UserRow | null>(null);
  const [capValue, setCapValue] = useState(0);
  const [removeAssetTarget, setRemoveAssetTarget] = useState<PublicAsset | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  const guard = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(null);
    }
  };

  const totals = overview?.totals;
  const visitSeries = (overview?.series ?? []).map((point: { date: string; visits: number }) => ({
    date: point.date,
    value: point.visits,
  }));
  const signupData = (signups ?? []).map((point: { date: string; count: number }) => ({
    date: point.date,
    value: point.count,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="administration"
        title="Platform console"
        description="Accounts, projects, runtime configuration and the platform audit trail. Visible to administrators and operators."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={health?.status === "healthy" ? "success" : "warning"}>
              {health?.status ?? "unknown"}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              disabled={busy !== null}
              onClick={() =>
                guard("seed", async () => {
                  await seedDefaults({ token });
                  setNotice("Default configuration written");
                })
              }
            >
              {busy === "seed" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Seed defaults
            </Button>
          </div>
        }
      />

      {error && <Alert variant="destructive">{error}</Alert>}
      {notice && (
        <div className="flex items-center gap-2 text-[11px] text-signal">
          <span className="h-1.5 w-1.5 rounded-full bg-signal" />
          {notice}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Accounts"
          value={totals ? formatCount(totals.users) : "—"}
          hint={totals ? `${totals.admins} admin · ${totals.operators} operator · ${totals.suspended} suspended` : undefined}
          icon={Users}
          tone="signal"
        />
        <StatCard
          label="Projects"
          value={totals ? formatCount(totals.projects) : "—"}
          hint={totals ? `${totals.activeProjects} live` : undefined}
          icon={FolderKanban}
        />
        <StatCard
          label="Storage in use"
          value={totals ? formatBytes(totals.storageBytes) : "—"}
          hint={totals ? `${formatCount(totals.files)} files · ${formatCount(totals.documents)} documents` : undefined}
          icon={HardDrive}
          tone="blueprint"
        />
        <StatCard
          label="Visits (30 days)"
          value={totals ? formatCount(totals.visits30d) : "—"}
          hint={totals ? `${formatCount(totals.visitsToday)} today · ${formatCount(totals.visitors)} visitors` : undefined}
          icon={Activity}
        />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">
            <Activity className="h-3.5 w-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="users">
            <Users className="h-3.5 w-3.5" />
            Users
          </TabsTrigger>
          <TabsTrigger value="projects">
            <FolderKanban className="h-3.5 w-3.5" />
            Projects
          </TabsTrigger>
          <TabsTrigger value="config">
            <Settings2 className="h-3.5 w-3.5" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="audit">
            <ScrollText className="h-3.5 w-3.5" />
            Audit log
          </TabsTrigger>
          <TabsTrigger value="public">
            <Boxes className="h-3.5 w-3.5" />
            Public library
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="panel">
              <div className="border-b border-border px-5 py-3">
                <div className="text-sm font-medium">Visits · last 30 days</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Aggregated nightly, with live logs merged in.
                </div>
              </div>
              <div className="px-5 py-5">
                {overview === undefined ? <Skeleton className="h-28 w-full" /> : <Sparkline series={visitSeries} />}
              </div>
            </div>
            <div className="panel">
              <div className="border-b border-border px-5 py-3">
                <div className="text-sm font-medium">Signups · last 30 days</div>
                <div className="mt-0.5 text-xs text-muted-foreground">New platform accounts per day.</div>
              </div>
              <div className="px-5 py-5">
                {signups === undefined ? <Skeleton className="h-28 w-full" /> : <Sparkline series={signupData} tone="blueprint" />}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="panel">
              <div className="border-b border-border px-5 py-3">
                <div className="text-sm font-medium">Top projects by visits</div>
                <div className="mt-0.5 text-xs text-muted-foreground">This month, across all accounts.</div>
              </div>
              {overview === undefined ? (
                <div className="space-y-2 p-5">
                  {[0, 1, 2].map((index) => (
                    <Skeleton key={index} className="h-8 w-full" />
                  ))}
                </div>
              ) : (overview.topProjects ?? []).length === 0 ? (
                <div className="px-5 py-8 text-center text-xs text-muted-foreground">No projects yet.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead className="w-24 text-right">Visits</TableHead>
                      <TableHead className="w-24 text-right">Files</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(overview.topProjects as { id: string; name: string; visits: number; files: number }[]).map(
                      (project) => (
                        <TableRow key={project.id}>
                          <TableCell className="font-mono text-xs">{project.name}</TableCell>
                          <TableCell className="text-right font-mono text-[11px]">{formatCount(project.visits)}</TableCell>
                          <TableCell className="text-right font-mono text-[11px]">{project.files}</TableCell>
                        </TableRow>
                      ),
                    )}
                  </TableBody>
                </Table>
              )}
            </div>

            <div className="panel">
              <div className="border-b border-border px-5 py-3">
                <div className="text-sm font-medium">Deployment health</div>
                <div className="mt-0.5 text-xs text-muted-foreground">Live platform checks.</div>
              </div>
              <div className="space-y-3 p-5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Database className="h-3.5 w-3.5" />
                    Database
                  </span>
                  <Badge variant="success">{health?.checks?.database ?? "—"}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Server className="h-3.5 w-3.5" />
                    Cron scheduler
                  </span>
                  <Badge variant="success">{health?.checks?.cron ?? "—"}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <HardDrive className="h-3.5 w-3.5" />
                    Blob storage
                  </span>
                  <Badge variant="success">{health?.checks?.storage ?? "—"}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <FileCode2 className="h-3.5 w-3.5" />
                    Config keys seeded
                  </span>
                  <span className="font-mono">{health?.configKeys ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Failed webhook deliveries
                  </span>
                  <span className="font-mono">{formatCount(totals?.failedDeliveries ?? 0)}</span>
                </div>
                <p className="pt-1 text-[11px] text-muted-foreground">
                  Version {health?.version ?? "—"} · checked {health?.time ? fromNow(new Date(health.time).getTime()) : "—"}
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="users">
          <div className="panel">
            <div className="border-b border-border px-5 py-3">
              <div className="text-sm font-medium">Accounts</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Roles control console access. Suspending an account blocks sign-in immediately.
              </div>
            </div>
            {users === undefined ? (
              <div className="space-y-2 p-5">
                {[0, 1, 2].map((index) => (
                  <Skeleton key={index} className="h-8 w-full" />
                ))}
              </div>
            ) : users.length === 0 ? (
              <EmptyState className="m-5" icon={Users} title="No accounts" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead className="w-36">Role</TableHead>
                    <TableHead className="w-40">Storage</TableHead>
                    <TableHead className="w-32">Last login</TableHead>
                    <TableHead className="w-24 text-center">Suspended</TableHead>
                    <TableHead className="w-36" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="text-xs font-medium">{user.username}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {user.email ?? "no email"} · {user.projectCount} project(s) · joined {formatDate(user.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={user.role}
                          onValueChange={(value) =>
                            guard(user.id, async () => {
                              await setUserRole({
                                token,
                                userId: user.id,
                                role: value as "admin" | "operator" | "user",
                              });
                              setNotice(`${user.username} is now ${value}`);
                            })
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">admin</SelectItem>
                            <SelectItem value="operator">operator</SelectItem>
                            <SelectItem value="user">user</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-[11px]">
                          {formatBytes(user.storageUsed)} / {formatBytes(user.storageCapBytes)}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-1 h-6 px-2 text-[10px]"
                          onClick={() => {
                            setCapTarget(user);
                            setCapValue(user.storageCapBytes);
                          }}
                        >
                          Adjust cap
                        </Button>
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">
                        {user.lastLoginAt ? fromNow(user.lastLoginAt) : "never"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={user.isSuspended}
                          disabled={busy === user.id}
                          onCheckedChange={(checked) =>
                            guard(user.id, async () => {
                              await setUserSuspended({ token, userId: user.id, isSuspended: checked });
                              setNotice(`${user.username} ${checked ? "suspended" : "reinstated"}`);
                            })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Delete account"
                            onClick={() => setDeleteUserTarget(user)}
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
        </TabsContent>

        <TabsContent value="projects">
          <div className="panel">
            <div className="border-b border-border px-5 py-3">
              <div className="text-sm font-medium">All projects</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Disabling a project returns maintenance responses for every route.
              </div>
            </div>
            {projects === undefined ? (
              <div className="space-y-2 p-5">
                {[0, 1, 2].map((index) => (
                  <Skeleton key={index} className="h-8 w-full" />
                ))}
              </div>
            ) : projects.length === 0 ? (
              <EmptyState className="m-5" icon={FolderKanban} title="No projects on the platform" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead className="w-40">Owner</TableHead>
                    <TableHead className="w-40">Storage</TableHead>
                    <TableHead className="w-32">Visits</TableHead>
                    <TableHead className="w-24 text-center">Live</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell>
                        <div className="font-mono text-xs">{project.urlPath}</div>
                        <div className="text-[10px] text-muted-foreground">created {formatDate(project.createdAt)}</div>
                      </TableCell>
                      <TableCell className="text-xs">{project.owner}</TableCell>
                      <TableCell className="font-mono text-[11px]">
                        {formatBytes(project.storageUsed)} / {formatBytes(project.storageAllocated)}
                      </TableCell>
                      <TableCell className="font-mono text-[11px]">
                        {project.visitsUsedThisMonth}/{project.freeVisitsPerMonth}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={project.isActive}
                          disabled={busy === project.id}
                          onCheckedChange={(checked) =>
                            guard(project.id, async () => {
                              await setProjectActive({ token, projectId: project.id, isActive: checked });
                            })
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="config">
          <div className="panel">
            <div className="border-b border-border px-5 py-3">
              <div className="text-sm font-medium">System configuration</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Values are read on every request. Objects and arrays must be valid JSON.
              </div>
            </div>
            {configs === undefined ? (
              <div className="space-y-3 p-5">
                {[0, 1, 2].map((index) => (
                  <Skeleton key={index} className="h-20 w-full" />
                ))}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {configs.map((config) => {
                  const draft = configDrafts[config.key] ?? JSON.stringify(config.value, null, 2);
                  return (
                    <div key={config.key} className="grid gap-3 p-5 lg:grid-cols-[260px_minmax(0,1fr)_auto]">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-medium">{config.key}</span>
                          {config.secret && <Badge variant="warning">secret</Badge>}
                          {config.isSeeded ? (
                            <Badge variant="outline">seeded</Badge>
                          ) : (
                            <Badge variant="warning">default</Badge>
                          )}
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">{config.description}</p>
                      </div>
                      {config.secret ? (
                        <Input value="••••••••" readOnly className="font-mono text-xs" />
                      ) : (
                        <JsonField
                          value={draft}
                          rows={5}
                          onChange={(value) =>
                            setConfigDrafts((current) => ({ ...current, [config.key]: value }))
                          }
                        />
                      )}
                      <div className="flex items-start justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={config.secret || busy === config.key || !configDrafts[config.key]}
                          onClick={() =>
                            guard(config.key, async () => {
                              await updateConfig({
                                token,
                                key: config.key,
                                value: JSON.parse(configDrafts[config.key]),
                              });
                              setConfigDrafts((current) => {
                                const next = { ...current };
                                delete next[config.key];
                                return next;
                              });
                              setNotice(`${config.key} updated`);
                            })
                          }
                        >
                          {busy === config.key ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Save className="h-3.5 w-3.5" />
                          )}
                          Save
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="audit">
          <div className="panel">
            <div className="border-b border-border px-5 py-3">
              <div className="text-sm font-medium">Platform audit trail</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                The 100 most recent entries across accounts and projects.
              </div>
            </div>
            {!Array.isArray(audit) ? (
              <div className="space-y-2 p-5">
                {[0, 1, 2].map((index) => (
                  <Skeleton key={index} className="h-8 w-full" />
                ))}
              </div>
            ) : audit.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-muted-foreground">Nothing logged yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">Level</TableHead>
                    <TableHead className="w-52">Event</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead className="w-40 text-right">When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audit.map(
                    (entry: { _id: string; level: string; event: string; message: string; createdAt: number }) => (
                      <TableRow key={entry._id}>
                        <TableCell>
                          <Badge
                            variant={
                              entry.level === "error" ? "destructive" : entry.level === "warning" ? "warning" : "outline"
                            }
                          >
                            {entry.level}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-[11px]">{entry.event}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{entry.message}</TableCell>
                        <TableCell className="text-right text-[11px] text-muted-foreground">
                          {formatDateTime(entry.createdAt)}
                        </TableCell>
                      </TableRow>
                    ),
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="public">
          <div className="panel">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
              <div>
                <div className="text-sm font-medium">Public library</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Assets served to every project at <span className="font-mono text-foreground">/~public/&lt;name&gt;</span>
                  . Admin only; HTML files are rejected.
                </div>
              </div>
              <Button
                variant="signal"
                size="sm"
                onClick={() => {
                  setAssetName("");
                  setAssetContent("");
                  setAssetOpen(true);
                }}
              >
                <Upload className="h-3.5 w-3.5" />
                Add asset
              </Button>
            </div>
            {publicAssets === undefined ? (
              <div className="space-y-2 p-5">
                {[0, 1].map((index) => (
                  <Skeleton key={index} className="h-8 w-full" />
                ))}
              </div>
            ) : publicAssets.length === 0 ? (
              <EmptyState
                className="m-5"
                icon={Boxes}
                title="No public assets"
                description="Publish shared stylesheets or scripts that every platform project can reference."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead className="w-24 text-right">Size</TableHead>
                    <TableHead className="w-32 text-right">Updated</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {publicAssets.map((asset) => (
                    <TableRow key={asset.id}>
                      <TableCell>
                        <div className="font-mono text-xs">{asset.path}</div>
                        <div className="text-[10px] text-muted-foreground">{asset.contentType}</div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-[11px]">{formatBytes(asset.size)}</TableCell>
                      <TableCell className="text-right text-[11px] text-muted-foreground">
                        {fromNow(asset.updatedAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Remove asset"
                            onClick={() => setRemoveAssetTarget(asset)}
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
        </TabsContent>
      </Tabs>

      <Dialog
        open={Boolean(capTarget)}
        onOpenChange={(open) => {
          if (!open) setCapTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Storage cap for {capTarget?.username}</DialogTitle>
            <DialogDescription>
              Raising the cap lets the account store more before writes are rejected with 402.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="cap">Cap in bytes</Label>
            <Input
              id="cap"
              type="number"
              value={capValue}
              onChange={(event) => setCapValue(Number(event.target.value))}
              className="font-mono"
            />
            <p className="text-[11px] text-muted-foreground">That is {formatBytes(capValue)}.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCapTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="signal"
              disabled={busy !== null}
              onClick={() =>
                guard("cap", async () => {
                  if (!capTarget) return;
                  await setStorageCap({ token, userId: capTarget.id, storageCapBytes: capValue });
                  setNotice(`Cap updated for ${capTarget.username}`);
                  setCapTarget(null);
                })
              }
            >
              Save cap
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assetOpen} onOpenChange={setAssetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a public asset</DialogTitle>
            <DialogDescription>
              Reachable from every project as <span className="font-mono">/~public/&lt;name&gt;</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="asset-name">File name</Label>
              <Input
                id="asset-name"
                value={assetName}
                onChange={(event) => setAssetName(event.target.value)}
                placeholder="shared.css"
                className="font-mono"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="asset-content">Contents</Label>
              <Textarea
                id="asset-content"
                value={assetContent}
                onChange={(event) => setAssetContent(event.target.value)}
                rows={10}
                className="font-mono text-[12px]"
                placeholder=":root { --platform-radius: 10px; }"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssetOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="signal"
              disabled={busy !== null || !assetName.trim()}
              onClick={() =>
                guard("asset", async () => {
                  const result = await publicLibraryAdd({ token, name: assetName.trim(), content: assetContent });
                  setNotice(`${result?.path ?? assetName} published`);
                  setAssetOpen(false);
                })
              }
            >
              Publish asset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteUserTarget)}
        onOpenChange={(open) => !open && setDeleteUserTarget(null)}
        title={`Delete ${deleteUserTarget?.username ?? "account"}?`}
        description={
          <span className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
            <span>
              {deleteUserTarget?.projectCount ?? 0} project(s), the account library and every session are erased
              permanently.
            </span>
          </span>
        }
        confirmWord={deleteUserTarget?.username}
        confirmLabel="Delete account"
        pending={busy !== null}
        onConfirm={() =>
          guard("delete-user", async () => {
            if (!deleteUserTarget) return;
            await deleteUser({ token, userId: deleteUserTarget.id });
            setNotice(`${deleteUserTarget.username} deleted`);
          })
        }
      />

      <ConfirmDialog
        open={Boolean(removeAssetTarget)}
        onOpenChange={(open) => !open && setRemoveAssetTarget(null)}
        title={`Remove ${removeAssetTarget?.name ?? "asset"}?`}
        description="Projects referencing this public asset will start receiving 404 for it."
        confirmLabel="Remove asset"
        pending={busy !== null}
        onConfirm={() =>
          guard("remove-asset", async () => {
            if (!removeAssetTarget) return;
            await publicLibraryRemove({ token, id: removeAssetTarget.id });
            setNotice(`${removeAssetTarget.name} removed`);
          })
        }
      />

      {totals && (
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            {formatCount(totals.webhookDeliveries)} webhook deliveries recorded
          </span>
          <span>·</span>
          <span>{formatCount(totals.documents)} documents stored platform-wide</span>
          <span>·</span>
          <span>default storage cap {formatBytes(totals.defaultCapBytes)}</span>
        </div>
      )}
    </div>
  );
}
