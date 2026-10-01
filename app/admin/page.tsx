"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Activity,
  ArrowLeft,
  Building2,
  Cpu,
  Eye,
  FolderTree,
  Gauge,
  HardDrive,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  UserCog,
  Users,
} from "lucide-react";
import { KeyRound, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MeterBar, StatCard } from "@/components/stat-card";
import { PageHeader } from "@/components/page-header";
import { Pagination, type PaginationState } from "@/components/pagination";
import { RowCheckbox, SelectAllCheckbox, SelectionToolbar } from "@/components/selection-toolbar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiDelete, apiGet, apiPatch, apiPost, apiPut, formatBytes } from "@/app/console";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ types */

interface Stats {
  users: number;
  projects: number;
  visitsAllTime: number;
  visitsThisMonth: number;
  storageBytes: number;
}

interface Overview {
  users: number;
  suspendedUsers: number;
  lockedUsers: number;
  newProjectsThisWeek: number;
  week: { visits: number; uniqueVisitors: number; newUsers: number; since: string };
  last24h: { visits: number; uniqueVisitors: number };
  viewer: { username: string | null; isAdmin: boolean; isOperator: boolean };
  health: {
    storageBytes: number;
    activeApiKeys: number;
    idleApiKeys: number;
    activeWebhooks: number;
    failedDeliveriesThisWeek: number;
    verifiedDomains: number;
    enabledCronTasks: number;
    liveSessions: number;
  };
  topProjects: Array<{ id: number; name: string; username: string; visits: number }>;
}

interface AdminUser {
  id: number;
  username: string;
  email: string | null;
  isAdmin: boolean;
  isOperator: boolean;
  isSuspended: boolean;
  storageCapBytes: number;
  storageUsedBytes: number;
  projectCount: number;
  createdAt: string;
  lastLogin: string | null;
  lockedUntil: string | null;
}

interface AdminProject {
  id: number;
  name: string;
  userId: number;
  username: string;
  isActive: boolean;
  ownerSuspended: boolean;
  freeVisitsPerMonth: number;
  fileCount: number;
  storageBytes: number;
  visitCount: number;
  lastVisit: string | null;
  createdAt: string;
}

interface AdminCronTask {
  task: string;
  globallyEnabled: boolean;
  dueProjects: number;
}

interface PublicAsset {
  path: string;
  size: number;
  modified: string;
}

interface UserDetail {
  id: number;
  username: string;
  email: string | null;
  isAdmin: boolean;
  isOperator: boolean;
  isSuspended: boolean;
  storageCapBytes: number;
  createdAt: string;
  lastLogin: string | null;
  lockedUntil: string | null;
  visitorCount: number;
  projects: Array<{
    id: number;
    name: string;
    isActive: boolean;
    freeVisitsPerMonth: number;
    fileCount: number;
    storageBytes: number;
  }>;
}

const EMPTY_PAGING: PaginationState = { page: 1, pageSize: 25, total: 0 };

/* ------------------------------------------------------------------- page */

export default function AdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [configs, setConfigs] = useState<Record<string, unknown>>({});
  const [defaults, setDefaults] = useState<Record<string, unknown>>({});
  const [cronTasks, setCronTasks] = useState<AdminCronTask[]>([]);
  const [publicAssets, setPublicAssets] = useState<PublicAsset[]>([]);
  const [publicPath, setPublicPath] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const publicUploadRef = useRef<HTMLInputElement>(null);

  // Listings are paged and filtered on the server; these hold the query.
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userPaging, setUserPaging] = useState<PaginationState>(EMPTY_PAGING);
  const [userQuery, setUserQuery] = useState("");
  const [userStatus, setUserStatus] = useState("all");
  const [userSort, setUserSort] = useState("id");
  const [userSelected, setUserSelected] = useState<string[]>([]);

  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [projectPaging, setProjectPaging] = useState<PaginationState>(EMPTY_PAGING);
  const [projectQuery, setProjectQuery] = useState("");
  const [projectStatus, setProjectStatus] = useState("all");
  const [projectSort, setProjectSort] = useState("id");
  const [projectSelected, setProjectSelected] = useState<string[]>([]);

  const [detail, setDetail] = useState<UserDetail | null>(null);

  const loadSidePanels = useCallback(async () => {
    const [statsRes, overviewRes, configRes, cronRes, libraryRes] = await Promise.all([
      apiGet<Stats>("/api/admin"),
      apiGet<Overview>("/api/admin/overview"),
      apiGet<{ data: Record<string, unknown>; defaults: Record<string, unknown> }>("/api/admin/config"),
      apiGet<{ data: AdminCronTask[] }>("/api/admin/cron"),
      apiGet<{ data: PublicAsset[] }>("/api/admin/public-library"),
    ]);
    setStats(statsRes);
    setOverview(overviewRes);
    setConfigs(configRes.data);
    setDefaults(configRes.defaults);
    setCronTasks(cronRes.data);
    setPublicAssets(libraryRes.data);
  }, []);

  const loadUsers = useCallback(async () => {
    const query = new URLSearchParams({
      page: String(userPaging.page),
      pageSize: String(userPaging.pageSize),
      status: userStatus,
      sort: userSort,
    });
    if (userQuery.trim()) query.set("q", userQuery.trim());
    const result = await apiGet<{ data: AdminUser[]; total: number }>(`/api/admin/users?${query}`);
    setUsers(result.data);
    setUserPaging((prev) => ({ ...prev, total: result.total }));
    // A selection only makes sense on rows that are still on screen.
    setUserSelected((prev) => prev.filter((id) => result.data.some((user) => String(user.id) === id)));
  }, [userPaging.page, userPaging.pageSize, userQuery, userSort, userStatus]);

  const loadProjects = useCallback(async () => {
    const query = new URLSearchParams({
      page: String(projectPaging.page),
      pageSize: String(projectPaging.pageSize),
      status: projectStatus,
      sort: projectSort,
    });
    if (projectQuery.trim()) query.set("q", projectQuery.trim());
    const result = await apiGet<{ data: AdminProject[]; total: number }>(`/api/admin/projects?${query}`);
    setProjects(result.data);
    setProjectPaging((prev) => ({ ...prev, total: result.total }));
    setProjectSelected((prev) =>
      prev.filter((id) => result.data.some((project) => String(project.id) === id)),
    );
  }, [projectPaging.page, projectPaging.pageSize, projectQuery, projectSort, projectStatus]);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadSidePanels(), loadUsers(), loadProjects()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load admin data.";
      if (/403|Admin/.test(message)) setForbidden(true);
      else toast.error(message);
    } finally {
      setRefreshing(false);
    }
  }, [loadProjects, loadSidePanels, loadUsers]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  /* ------------------------------------------------------------ mutations */

  const patchUsers = useCallback(
    async (payload: Record<string, unknown>, success: string) => {
      try {
        await apiPatch("/api/admin/users", payload);
        toast.success(success);
        await load();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Update failed.");
      }
    },
    [load],
  );

  const patchProjects = useCallback(
    async (payload: Record<string, unknown>, success: string) => {
      try {
        await apiPatch("/api/admin/projects", payload);
        toast.success(success);
        await load();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Update failed.");
      }
    },
    [load],
  );

  async function impersonate(user: AdminUser) {
    try {
      await apiPost("/api/admin/impersonate", { userId: user.id });
      // The session cookie changed, so the whole router cache is stale: replace
      // rather than push, then refresh to re-render every server component
      // against the impersonated identity.
      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start impersonating.");
    }
  }

  async function openDetail(user: AdminUser) {
    try {
      const { data } = await apiGet<{ data: UserDetail }>(`/api/admin/users?userId=${user.id}`);
      setDetail(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load the account.");
    }
  }

  async function deleteUser(user: AdminUser) {
    const typed = window.prompt(
      `Deleting "${user.username}" removes every project, file and visitor they own. This cannot be undone.\n\nType the username to confirm:`,
    );
    if (typed === null) return;
    try {
      await apiDelete("/api/admin/users", { userId: user.id, confirmUsername: typed });
      toast.success(`${user.username} deleted`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed.");
    }
  }

  async function deleteProject(project: AdminProject) {
    const typed = window.prompt(
      `Deleting "${project.username}/${project.name}" removes its files, data and configuration. This cannot be undone.\n\nType the project name to confirm:`,
    );
    if (typed === null) return;
    try {
      await apiDelete("/api/admin/projects", { projectId: project.id, confirmName: typed });
      toast.success(`${project.name} deleted`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed.");
    }
  }

  async function revokeSessions(user: AdminUser) {
    try {
      await apiDelete(`/api/admin/sessions?userId=${user.id}`);
      toast.success(`Signed ${user.username} out everywhere`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not revoke sessions.");
    }
  }

  async function saveConfig(key: string, raw: string) {
    let value: number | string | boolean = raw;
    try {
      value = JSON.parse(raw);
    } catch {
      // keep as string
    }
    try {
      await apiPut("/api/admin/config", { key, value });
      toast.success(`${key} saved`);
      await loadSidePanels();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Config save failed.");
    }
  }

  async function toggleGlobalTask(task: AdminCronTask) {
    try {
      await apiPut("/api/admin/cron", { task: task.task, isEnabled: !task.globallyEnabled });
      toast.success(`${task.task} ${task.globallyEnabled ? "disabled" : "enabled"} globally`);
      await loadSidePanels();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed.");
    }
  }

  async function publishPublicAsset(file: File, path: string) {
    try {
      const response = await fetch(`/api/admin/public-library?path=${encodeURIComponent(path)}`, {
        method: "PUT",
        body: file,
        credentials: "include",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Upload failed.");
      toast.success(`/~public/${path} published`);
      setPublicPath("");
      await loadSidePanels();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    }
  }

  async function deletePublicAsset(path: string) {
    try {
      await apiDelete(`/api/admin/public-library?path=${encodeURIComponent(path)}`);
      toast.success("Removed");
      await loadSidePanels();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed.");
    }
  }

  /* ----------------------------------------------------------------- view */

  // The API refuses these actions for an operator, so the controls are hidden
  // rather than left as buttons that fail with a 403.
  const isViewerAdmin = overview?.viewer.isAdmin ?? true;

  if (forbidden) {
    return (
      <div className="panel mx-auto mt-16 max-w-md p-8 text-center">
        <ShieldCheck className="mx-auto h-8 w-8 text-destructive" />
        <h1 className="mt-3 text-lg font-semibold">Admin access required</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          This console is restricted to platform operators.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link href="/dashboard">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operator"
        title="Admin console"
        description="Accounts, projects and platform configuration across every deployment."
        actions={
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={refreshing}>
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Accounts"
          value={overview ? overview.users.toLocaleString("en-US") : "…"}
          icon={Users}
          tone="signal"
          hint={
            overview
              ? `${overview.suspendedUsers} suspended · ${overview.lockedUsers} locked out · ${overview.week.newUsers} new this week`
              : undefined
          }
        />
        <StatCard
          label="Projects"
          value={stats ? stats.projects.toLocaleString("en-US") : "…"}
          icon={Building2}
          hint={overview ? `${overview.newProjectsThisWeek} created this week` : undefined}
        />
        <StatCard
          label="Visits"
          value={overview ? overview.last24h.visits.toLocaleString("en-US") : "…"}
          hint={
            overview
              ? `last 24h · ${overview.last24h.uniqueVisitors.toLocaleString("en-US")} unique · ${overview.week.visits.toLocaleString("en-US")} this week`
              : undefined
          }
          icon={Activity}
        />
        <StatCard
          label="Storage used"
          value={stats ? formatBytes(stats.storageBytes) : "…"}
          icon={HardDrive}
          tone="blueprint"
          hint={stats ? `${stats.visitsAllTime.toLocaleString("en-US")} visits all time` : undefined}
        />
      </div>

      {overview && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Live sessions"
            value={overview.health.liveSessions.toLocaleString("en-US")}
            icon={Activity}
            tone="blueprint"
            hint="console sessions not yet expired"
          />
          <StatCard
            label="Active API keys"
            value={overview.health.activeApiKeys.toLocaleString("en-US")}
            icon={KeyRound}
            tone={overview.health.idleApiKeys > 0 ? "signal" : "blueprint"}
            hint={`${overview.health.idleApiKeys} unused for 30 days`}
          />
          <StatCard
            label="Webhooks"
            value={overview.health.activeWebhooks.toLocaleString("en-US")}
            icon={Webhook}
            tone={overview.health.failedDeliveriesThisWeek > 0 ? "destructive" : "blueprint"}
            hint={`${overview.health.failedDeliveriesThisWeek} failed deliveries this week`}
          />
          <StatCard
            label="Scheduled work"
            value={overview.health.enabledCronTasks.toLocaleString("en-US")}
            icon={Cpu}
            hint={`${overview.health.verifiedDomains} verified custom domains`}
          />
        </div>
      )}

      {overview && !overview.viewer.isAdmin && (
        <p className="panel px-4 py-3 text-[12.5px] text-muted-foreground">
          You are signed in as an <strong className="text-foreground">operator</strong>. You can run the
          platform day to day; changing roles and deleting accounts or projects are reserved for an
          admin, so those controls are hidden rather than failing with a 403.
        </p>
      )}

      <Tabs defaultValue="accounts">
        <TabsList>
          <TabsTrigger value="accounts">
            <Users className="h-3.5 w-3.5" /> Accounts
          </TabsTrigger>
          <TabsTrigger value="projects">
            <FolderTree className="h-3.5 w-3.5" /> Projects
          </TabsTrigger>
          <TabsTrigger value="platform">
            <Cpu className="h-3.5 w-3.5" /> Platform
          </TabsTrigger>
          <TabsTrigger value="config">
            <Gauge className="h-3.5 w-3.5" /> Configuration
          </TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------- accounts */}
        <TabsContent value="accounts" className="space-y-4">
          <Toolbar
            query={userQuery}
            onQuery={(value) => {
              setUserQuery(value);
              setUserPaging((prev) => ({ ...prev, page: 1 }));
            }}
            placeholder="Search username or email"
            filters={[
              { value: userStatus, onChange: setUserStatus, options: [
                ["all", "All accounts"],
                ["active", "Active"],
                ["suspended", "Suspended"],
                ["locked", "Locked out"],
                ["admin", "Administrators"],
              ] },
              { value: userSort, onChange: setUserSort, options: [
                ["id", "Newest first"],
                ["username", "Username A–Z"],
                ["storage", "Most storage"],
                ["projects", "Most projects"],
                ["lastLogin", "Recently active"],
              ] },
            ]}
          />

          <div className="panel overflow-hidden">
            <SelectionToolbar
              selected={userSelected}
              noun="account"
              onClear={() => setUserSelected([])}
            >
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[12px]"
                onClick={() =>
                  void patchUsers(
                    { userIds: userSelected.map(Number), isSuspended: true },
                    `${userSelected.length} accounts suspended`,
                  ).then(() => setUserSelected([]))
                }
              >
                Suspend
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[12px]"
                onClick={() =>
                  void patchUsers(
                    { userIds: userSelected.map(Number), isSuspended: false },
                    `${userSelected.length} accounts resumed`,
                  ).then(() => setUserSelected([]))
                }
              >
                Resume
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[12px]"
                onClick={() =>
                  void patchUsers(
                    { userIds: userSelected.map(Number), unlock: true },
                    `${userSelected.length} lockouts cleared`,
                  ).then(() => setUserSelected([]))
                }
              >
                Clear lockout
              </Button>
              {isViewerAdmin && (
                <RoleSelect
                  onApply={(patch, label) =>
                    void patchUsers(
                      { userIds: userSelected.map(Number), ...patch },
                      `${userSelected.length} accounts ${label}`,
                    ).then(() => setUserSelected([]))
                  }
                />
              )}
            </SelectionToolbar>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <SelectAllCheckbox
                      selected={userSelected}
                      total={users.length}
                      label="Select every account on this page"
                      onToggle={(selectAll) =>
                        setUserSelected(selectAll ? users.map((user) => String(user.id)) : [])
                      }
                    />
                  </TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Projects</TableHead>
                  <TableHead className="w-44">Storage</TableHead>
                  <TableHead className="w-32">Last login</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead className="w-56 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-[13px] text-muted-foreground">
                      No accounts match this filter.
                    </TableCell>
                  </TableRow>
                )}
                {users.map((user) => (
                  <TableRow key={user.id} className={cn(userSelected.includes(String(user.id)) && "bg-muted/40")}>
                    <TableCell>
                      <RowCheckbox
                        id={String(user.id)}
                        selected={userSelected}
                        onToggle={(id, next) =>
                          setUserSelected((prev) => (next ? [...prev, id] : prev.filter((x) => x !== id)))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        className="text-left font-mono text-[12.5px] hover:text-signal"
                        onClick={() => void openDetail(user)}
                      >
                        {user.username}
                      </button>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {user.isAdmin && <Badge variant="signal">admin</Badge>}
                        {user.isOperator && !user.isAdmin && <Badge variant="blueprint">operator</Badge>}
                        {user.email && (
                          <span className="text-[11px] text-muted-foreground">{user.email}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-[12.5px] tabular-nums">{user.projectCount}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MeterBar
                          value={user.storageUsedBytes}
                          max={user.storageCapBytes}
                          className="w-20"
                          tone={user.storageUsedBytes > user.storageCapBytes ? "destructive" : "signal"}
                        />
                        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                          {formatBytes(user.storageUsedBytes)} / {formatBytes(user.storageCapBytes)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-[11.5px] text-muted-foreground">
                      {user.lastLogin ? new Date(user.lastLogin).toLocaleString("en-US") : "never"}
                    </TableCell>
                    <TableCell>
                      <StatusBadges user={user} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title={`Sign in as ${user.username}`}
                          onClick={() => void impersonate(user)}
                          disabled={!isViewerAdmin && user.isAdmin}
                        >
                          <UserCog className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Account detail"
                          onClick={() => void openDetail(user)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Switch
                          checked={user.isSuspended}
                          onCheckedChange={(checked) =>
                            void patchUsers(
                              { userId: user.id, isSuspended: checked },
                              `${user.username} ${checked ? "suspended" : "resumed"}`,
                            )
                          }
                        />
                        {isViewerAdmin && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground hover:text-destructive"
                            title="Delete account and everything it owns"
                            onClick={() => void deleteUser(user)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination
              state={userPaging}
              label="accounts"
              className="border-t border-border"
              onPageChange={(page) => setUserPaging((prev) => ({ ...prev, page }))}
              onPageSizeChange={(pageSize) => setUserPaging({ ...userPaging, page: 1, pageSize })}
            />
          </div>
        </TabsContent>

        {/* ------------------------------------------------------- projects */}
        <TabsContent value="projects" className="space-y-4">
          <Toolbar
            query={projectQuery}
            onQuery={(value) => {
              setProjectQuery(value);
              setProjectPaging((prev) => ({ ...prev, page: 1 }));
            }}
            placeholder="Search project or owner"
            filters={[
              { value: projectStatus, onChange: setProjectStatus, options: [
                ["all", "All projects"],
                ["active", "Live"],
                ["suspended", "Suspended"],
                ["owner-suspended", "Owner suspended"],
              ] },
              { value: projectSort, onChange: setProjectSort, options: [
                ["id", "Newest first"],
                ["name", "Name A–Z"],
                ["files", "Most files"],
                ["storage", "Most storage"],
                ["visits", "Most visits"],
              ] },
            ]}
          />

          <div className="panel overflow-hidden">
            <SelectionToolbar
              selected={projectSelected}
              noun="project"
              onClear={() => setProjectSelected([])}
            >
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[12px]"
                onClick={() =>
                  void patchProjects(
                    { projectIds: projectSelected.map(Number), isActive: true },
                    `${projectSelected.length} projects resumed`,
                  ).then(() => setProjectSelected([]))
                }
              >
                Activate
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[12px]"
                onClick={() =>
                  void patchProjects(
                    { projectIds: projectSelected.map(Number), isActive: false },
                    `${projectSelected.length} projects suspended`,
                  ).then(() => setProjectSelected([]))
                }
              >
                Suspend
              </Button>
            </SelectionToolbar>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <SelectAllCheckbox
                      selected={projectSelected}
                      total={projects.length}
                      label="Select every project on this page"
                      onToggle={(selectAll) =>
                        setProjectSelected(selectAll ? projects.map((p) => String(p.id)) : [])
                      }
                    />
                  </TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead className="w-32">Owner</TableHead>
                  <TableHead className="text-right">Files</TableHead>
                  <TableHead className="text-right">Visits</TableHead>
                  <TableHead className="w-28">Free quota</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-[13px] text-muted-foreground">
                      No projects match this filter.
                    </TableCell>
                  </TableRow>
                )}
                {projects.map((project) => (
                  <TableRow
                    key={project.id}
                    className={cn(projectSelected.includes(String(project.id)) && "bg-muted/40")}
                  >
                    <TableCell>
                      <RowCheckbox
                        id={String(project.id)}
                        selected={projectSelected}
                        onToggle={(id, next) =>
                          setProjectSelected((prev) => (next ? [...prev, id] : prev.filter((x) => x !== id)))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <a
                        href={`/${project.username}/${project.name}/`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[12.5px] hover:text-signal"
                      >
                        {project.name}
                      </a>
                      <div className="text-[11px] text-muted-foreground">
                        {formatBytes(project.storageBytes)} stored
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-[12px] text-muted-foreground">
                      {project.username}
                    </TableCell>
                    <TableCell className="text-right text-[12.5px] tabular-nums">{project.fileCount}</TableCell>
                    <TableCell className="text-right text-[12.5px] tabular-nums">
                      {project.visitCount.toLocaleString("en-US")}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        defaultValue={project.freeVisitsPerMonth}
                        className="h-8 w-24"
                        onBlur={(event) => {
                          const visits = Number(event.target.value);
                          if (Number.isFinite(visits) && visits >= 0 && visits !== project.freeVisitsPerMonth) {
                            void patchProjects(
                              { projectId: project.id, freeVisitsPerMonth: visits },
                              `${project.name} quota set to ${visits}`,
                            );
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      {project.ownerSuspended ? (
                        <Badge variant="outline">owner suspended</Badge>
                      ) : project.isActive ? (
                        <Badge>live</Badge>
                      ) : (
                        <Badge variant="destructive">suspended</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Switch
                          checked={project.isActive}
                          onCheckedChange={(checked) =>
                            void patchProjects(
                              { projectId: project.id, isActive: checked },
                              `${project.name} ${checked ? "resumed" : "suspended"}`,
                            )
                          }
                        />
                        {isViewerAdmin && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground hover:text-destructive"
                            title="Delete project and its data"
                            onClick={() => void deleteProject(project)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination
              state={projectPaging}
              label="projects"
              className="border-t border-border"
              onPageChange={(page) => setProjectPaging((prev) => ({ ...prev, page }))}
              onPageSizeChange={(pageSize) => setProjectPaging({ ...projectPaging, page: 1, pageSize })}
            />
          </div>
        </TabsContent>

        {/* ------------------------------------------------------- platform */}
        <TabsContent value="platform" className="space-y-4">
          {overview && overview.topProjects.length > 0 && (
            <div className="panel p-5">
              <div className="mono-label">Busiest projects this week</div>
              <ol className="mt-3 space-y-2">
                {overview.topProjects.map((project, index) => (
                  <li key={project.id} className="flex items-center gap-3 text-[13px]">
                    <span className="w-4 font-mono text-[11px] text-muted-foreground">{index + 1}</span>
                    <span className="font-mono">{project.username}/{project.name}</span>
                    <span className="ml-auto tabular-nums text-muted-foreground">
                      {project.visits.toLocaleString("en-US")}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="panel overflow-hidden">
            <div className="border-b border-border px-5 py-3.5">
              <div className="text-sm font-semibold">Global cron switches</div>
              <div className="mt-0.5 text-[12.5px] text-muted-foreground">
                Turn a task off across the whole platform. Projects keep their own toggles.
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead className="w-32 text-right">Due projects</TableHead>
                  <TableHead className="w-24">Enabled</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cronTasks.map((task) => (
                  <TableRow key={task.task}>
                    <TableCell className="font-mono text-[12.5px]">{task.task}</TableCell>
                    <TableCell className="text-right text-[12.5px] tabular-nums">{task.dueProjects}</TableCell>
                    <TableCell>
                      <Switch
                        checked={task.globallyEnabled}
                        onCheckedChange={() => void toggleGlobalTask(task)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="panel overflow-hidden">
            <div className="border-b border-border px-5 py-3.5">
              <div className="text-sm font-semibold">Public library</div>
              <div className="mt-0.5 text-[12.5px] text-muted-foreground">
                Assets served at <span className="font-mono">/~public/&lt;path&gt;</span> to every
                project on the platform.
              </div>
            </div>
            <div className="space-y-3 border-b border-border px-5 py-4">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Label htmlFor="public-path">Path</Label>
                  <Input
                    id="public-path"
                    value={publicPath}
                    onChange={(event) => setPublicPath(event.target.value)}
                    className="font-mono"
                    placeholder="theme.css"
                  />
                </div>
                <input
                  ref={publicUploadRef}
                  type="file"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    const path = publicPath.trim();
                    if (file && path) void publishPublicAsset(file, path);
                    event.target.value = "";
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!publicPath.trim()}
                  onClick={() => publicUploadRef.current?.click()}
                >
                  Publish asset
                </Button>
              </div>
              <p className="text-[11.5px] text-muted-foreground">
                Pick the file, set the path it should be served at, then publish. HTML is refused —
                <span className="font-mono"> /~public/</span> is for shared stylesheets, scripts and
                images.
              </p>
            </div>
            {publicAssets.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Path</TableHead>
                    <TableHead className="w-28 text-right">Size</TableHead>
                    <TableHead className="w-28">Modified</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {publicAssets.map((asset) => (
                    <TableRow key={asset.path}>
                      <TableCell className="font-mono text-[12px]">/~public/{asset.path}</TableCell>
                      <TableCell className="text-right text-[12px] tabular-nums">
                        {formatBytes(asset.size)}
                      </TableCell>
                      <TableCell className="text-[11.5px] text-muted-foreground">
                        {asset.modified ? new Date(asset.modified).toLocaleString("en-US") : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => void deletePublicAsset(asset.path)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="px-5 py-8 text-center text-[13px] text-muted-foreground">
                The public library is empty.
              </p>
            )}
          </div>
        </TabsContent>

        {/* --------------------------------------------------------- config */}
        <TabsContent value="config">
          <ConfigEditor configs={configs} defaults={defaults} onSave={saveConfig} />
        </TabsContent>
      </Tabs>

      <UserDetailDialog
        detail={detail}
        onClose={() => setDetail(null)}
        onImpersonate={(user) => {
          setDetail(null);
          void impersonate(user);
        }}
        onRevoke={(user) => {
          void revokeSessions(user);
          setDetail(null);
        }}
        onToggleSuspend={(user, suspended) => {
          setDetail(null);
          void patchUsers({ userId: user.id, isSuspended: suspended }, `${user.username} updated`);
        }}
        onSetCap={(user, capMb) => {
          void patchUsers(
            { userId: user.id, storageCapBytes: Math.round(capMb * 1024 * 1024) },
            `${user.username} cap set to ${capMb} MB`,
          );
          void openDetail(user);
        }}
        canManageRoles={isViewerAdmin}
        onSetRole={(user, role) => {
          const patch =
            role === "admin"
              ? { isAdmin: true, isOperator: true }
              : role === "operator"
                ? { isOperator: true }
                : { isOperator: false, isAdmin: false };
          const label = role === "admin" ? "is now an admin" : role === "operator" ? "is now an operator" : "is now a member";
          setDetail(null);
          void patchUsers({ userId: user.id, ...patch }, `${user.username} ${label}`);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------- fragments */

/**
 * Console role assignment (admin only).
 *
 * The API has always accepted `isAdmin` / `isOperator`; nothing in the console
 * exposed it, so the tier an operator could never reach and an admin could
 * never grant was effectively unreachable in both directions.
 */
function RoleSelect({
  onApply,
}: {
  onApply: (patch: { isAdmin?: boolean; isOperator?: boolean }, label: string) => void | Promise<void>;
}) {
  const [value, setValue] = useState("");

  return (
    <div className="flex items-center gap-1.5">
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger className="h-7 w-44 text-[12px]" aria-label="Console role">
          <SelectValue placeholder="Set console role…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="member">Remove operator access</SelectItem>
          <SelectItem value="operator">Make operator</SelectItem>
          <SelectItem value="admin">Make admin</SelectItem>
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-[12px]"
        disabled={!value}
        onClick={() => {
          const patch =
            value === "admin"
              ? { isAdmin: true, isOperator: true }
              : value === "operator"
                ? { isOperator: true }
                : { isOperator: false, isAdmin: false };
          void onApply(patch, value === "admin" ? "made admins" : value === "operator" ? "made operators" : "demoted");
          setValue("");
        }}
      >
        Apply
      </Button>
    </div>
  );
}

function Toolbar({
  query,
  onQuery,
  placeholder,
  filters,
}: {
  query: string;
  onQuery: (value: string) => void;
  placeholder: string;
  filters: Array<{
    value: string;
    onChange: (value: string) => void;
    options: Array<[string, string]>;
  }>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-56 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder={placeholder}
          className="pl-8"
          aria-label={placeholder}
        />
      </div>
      {filters.map((filter) => (
        <select
          key={filter.options[0]?.[0]}
          value={filter.value}
          onChange={(event) => filter.onChange(event.target.value)}
          aria-label={filter.options[0]?.[1]}
          className="h-10 rounded-md border border-input bg-background px-2.5 text-[13px] text-foreground"
        >
          {filter.options.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      ))}
    </div>
  );
}

function StatusBadges({ user }: { user: Pick<AdminUser, "isSuspended" | "lockedUntil"> }) {
  const locked = user.lockedUntil !== null && new Date(user.lockedUntil) > new Date();
  if (user.isSuspended) return <Badge variant="destructive">suspended</Badge>;
  if (locked) return <Badge variant="warning">locked out</Badge>;
  return <Badge variant="outline">active</Badge>;
}

function UserDetailDialog({
  detail,
  onClose,
  onImpersonate,
  onRevoke,
  onToggleSuspend,
  onSetCap,
  canManageRoles,
  onSetRole,
}: {
  detail: UserDetail | null;
  onClose: () => void;
  onImpersonate: (user: AdminUser) => void;
  onRevoke: (user: AdminUser) => void;
  onToggleSuspend: (user: AdminUser, suspended: boolean) => void;
  onSetCap: (user: AdminUser, capMb: number) => void;
  canManageRoles: boolean;
  onSetRole: (user: AdminUser, role: "member" | "operator" | "admin") => void;
}) {
  const [cap, setCap] = useState(() =>
    detail ? String(Math.round(detail.storageCapBytes / (1024 * 1024))) : "",
  );
  const asUser = useMemo(
    () =>
      detail
        ? ({
            id: detail.id,
            username: detail.username,
            isSuspended: detail.isSuspended,
          } as AdminUser)
        : null,
    [detail],
  );

  return (
    <Dialog open={detail !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        {detail && (
          // Re-keyed per account so the cap field starts from the value of
          // whichever account is open, without an effect driving the state.
          <UserDetailPanel
            key={detail.id}
            detail={detail}
            cap={cap}
            onCapChange={setCap}
            asUser={asUser}
            onClose={onClose}
            onImpersonate={onImpersonate}
            onRevoke={onRevoke}
            onToggleSuspend={onToggleSuspend}
            onSetCap={onSetCap}
            canManageRoles={canManageRoles}
            onSetRole={onSetRole}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function UserDetailPanel({
  detail,
  cap,
  onCapChange,
  asUser,
  onClose,
  onImpersonate,
  onRevoke,
  onToggleSuspend,
  onSetCap,
  canManageRoles,
  onSetRole,
}: {
  detail: UserDetail;
  cap: string;
  onCapChange: (value: string) => void;
  asUser: AdminUser | null;
  onClose: () => void;
  onImpersonate: (user: AdminUser) => void;
  onRevoke: (user: AdminUser) => void;
  onToggleSuspend: (user: AdminUser, suspended: boolean) => void;
  onSetCap: (user: AdminUser, capMb: number) => void;
  canManageRoles: boolean;
  onSetRole: (user: AdminUser, role: "member" | "operator" | "admin") => void;
}) {
  const used = detail.projects.reduce((sum, project) => sum + project.storageBytes, 0);
  return (
    <>
      <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                <span className="font-mono">{detail.username}</span>
                <StatusBadges user={detail} />
                {detail.isAdmin && <Badge variant="signal">admin</Badge>}
              </DialogTitle>
              <DialogDescription>
                {detail.email ?? "no email on file"} · joined{" "}
                {new Date(detail.createdAt).toLocaleDateString("en-US")} ·{" "}
                {detail.lastLogin
                  ? `last seen ${new Date(detail.lastLogin).toLocaleString("en-US")}`
                  : "never signed in"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-border p-3">
                  <div className="mono-label">Projects</div>
                  <div className="mt-1 text-lg font-semibold tabular-nums">{detail.projects.length}</div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="mono-label">Visitors</div>
                  <div className="mt-1 text-lg font-semibold tabular-nums">{detail.visitorCount}</div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="mono-label">Storage</div>
                  <div className="mt-1 text-lg font-semibold tabular-nums">{formatBytes(used)}</div>
                  <MeterBar value={used} max={detail.storageCapBytes} className="mt-2" />
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="detail-cap">Storage cap (MB)</Label>
                  <Input
                    id="detail-cap"
                    type="number"
                    min={0}
                    value={cap}
                    onChange={(event) => onCapChange(event.target.value)}
                    className="w-28"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => asUser && onSetCap(asUser, Number(cap))}
                  disabled={Number.isNaN(Number(cap))}
                >
                  Update cap
                </Button>
              </div>

              <div>
                <div className="mono-label mb-2">Projects</div>
                <div className="max-h-56 overflow-y-auto rounded-lg border border-border scrollbar-thin">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="text-right">Files</TableHead>
                        <TableHead className="text-right">Size</TableHead>
                        <TableHead className="w-20">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.projects.map((project) => (
                        <TableRow key={project.id}>
                          <TableCell>
                            <Link
                              href={`/dashboard/projects/${project.id}`}
                              className="font-mono text-[12.5px] hover:text-signal"
                              onClick={onClose}
                            >
                              {project.name}
                            </Link>
                          </TableCell>
                          <TableCell className="text-right text-[12px] tabular-nums">{project.fileCount}</TableCell>
                          <TableCell className="text-right text-[12px] tabular-nums">
                            {formatBytes(project.storageBytes)}
                          </TableCell>
                          <TableCell>
                            {project.isActive ? <Badge>live</Badge> : <Badge variant="destructive">suspended</Badge>}
                          </TableCell>
                        </TableRow>
                      ))}
                      {detail.projects.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-[13px] text-muted-foreground">
                            No projects.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>

            <DialogFooter className="flex-wrap justify-start gap-2 sm:justify-start">
              {asUser && (
                <>
                  <Button size="sm" onClick={() => onImpersonate(asUser)}>
                    <UserCog className="h-3.5 w-3.5" /> Sign in as {detail.username}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onRevoke(asUser)}>
                    Sign out everywhere
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onToggleSuspend(asUser, !detail.isSuspended)}
                  >
                    {detail.isSuspended ? "Resume account" : "Suspend account"}
                  </Button>
                  {canManageRoles && (
                    <Select
                      value={detail.isAdmin ? "admin" : detail.isOperator ? "operator" : "member"}
                      onValueChange={(value) => onSetRole(asUser, value as "member" | "operator" | "admin")}
                    >
                      <SelectTrigger className="w-48" aria-label="Console role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member — dashboard only</SelectItem>
                        <SelectItem value="operator">Operator — runs the platform</SelectItem>
                        <SelectItem value="admin">Admin — full control</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </>
              )}
            </DialogFooter>
    </>
  );
}

/** System configuration, grouped by key prefix so 20+ keys stay readable. */
function ConfigEditor({
  configs,
  defaults,
  onSave,
}: {
  configs: Record<string, unknown>;
  defaults: Record<string, unknown>;
  onSave: (key: string, raw: string) => void | Promise<void>;
}) {
  const [filter, setFilter] = useState("");
  const groups = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const key of Object.keys(defaults)) {
      const group = key.split(".")[0] ?? "other";
      map.set(group, [...(map.get(group) ?? []), key]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [defaults]);

  const visible = (key: string) =>
    filter.trim() === "" || key.toLowerCase().includes(filter.trim().toLowerCase());

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter configuration keys"
          className="pl-8"
        />
      </div>
      {groups.map(([group, keys]) => {
        const shown = keys.filter(visible);
        if (shown.length === 0) return null;
        return (
          <div key={group} className="panel overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-5 py-3">
              <span className="font-mono text-[12.5px] font-medium">{group}</span>
              <Badge variant="outline" className="tabular-nums">
                {shown.length}
              </Badge>
            </div>
            <div className="divide-y divide-border">
              {shown.map((key) => (
                <div key={key} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <Label htmlFor={`cfg-${key}`} className="font-mono text-[11.5px]">
                      {key}
                    </Label>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      default {String(defaults[key])}
                      {configs[key] !== undefined && (
                        <>
                          {" "}
                          · currently <span className="font-mono">{JSON.stringify(configs[key])}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <Input
                    id={`cfg-${key}`}
                    className="w-44 font-mono text-[12.5px]"
                    defaultValue={JSON.stringify(configs[key] ?? defaults[key])}
                    onBlur={(event) => {
                      const next = JSON.stringify(configs[key] ?? defaults[key]);
                      if (event.target.value !== next) void onSave(key, event.target.value);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {groups.every(([, keys]) => !keys.some(visible)) && (
        <p className="flex items-center justify-center gap-2 py-10 text-[13px] text-muted-foreground">
          <TriangleAlert className="h-4 w-4" /> No configuration key matches “{filter}”.
        </p>
      )}
    </div>
  );
}