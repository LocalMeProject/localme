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
  CreditCard,
} from "lucide-react";
import { KeyRound, Languages, Webhook } from "lucide-react";
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
import { AdminTranslationsPanel } from "@/components/admin-translations-panel";
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "@/app/console";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { DEFAULT_PLANS, type SubscriptionPlan } from "@/lib/subscriptions-shared";

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

interface SubscriptionUser {
  id: number;
  username: string;
  email: string | null;
  isAdmin: boolean;
  isOperator: boolean;
  isSuspended: boolean;
  subscriptionTier: string;
  maxProjects: number;
  projectStorageCapBytes: number;
  libraryStorageCapBytes: number;
  subscriptionExpiresAt: string | null;
  createdAt: string;
  projectCount: number;
  totalStorageBytes: number;
}

interface PaymentTransaction {
  id: number;
  userId: number;
  username: string;
  tier: string;
  amount: number;
  currency: string;
  authority: string;
  status: string;
  refId: string | null;
  createdAt: string;
  verifiedAt: string | null;
}

interface SystemState {
  totalUsers: number;
  totalProjects: number;
  isDemo: boolean;
}

const EMPTY_PAGING: PaginationState = { page: 1, pageSize: 25, total: 0 };

/* ------------------------------------------------------------------- page */

export default function AdminPage() {
  const router = useRouter();
  const { t, fmt, locale } = useI18n();
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

  const [subUsers, setSubUsers] = useState<SubscriptionUser[]>([]);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [systemState, setSystemState] = useState<SystemState | null>(null);
  const [editingSubUser, setEditingSubUser] = useState<SubscriptionUser | null>(null);
  const [subTier, setSubTier] = useState<string>("free");
  const [subMaxProjects, setSubMaxProjects] = useState<number>(3);
  const [subProjectCapMb, setSubProjectCapMb] = useState<number>(3);
  const [subLibraryCapMb, setSubLibraryCapMb] = useState<number>(3);
  const [subExpiresAt, setSubExpiresAt] = useState<string>("");
  const [prodConfirmText, setProdConfirmText] = useState("");
  const [prodModalOpen, setProdModalOpen] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [isPopulating, setIsPopulating] = useState(false);

  const [plansConfig, setPlansConfig] = useState<SubscriptionPlan[]>(DEFAULT_PLANS);
  const [isSavingPlans, setIsSavingPlans] = useState(false);
  const [setupStatus, setSetupStatus] = useState<{
    wizardCompleted: boolean;
    totalUsers: number;
    totalProjects: number;
    examplesUserExists: boolean;
    exampleProjectsCount: number;
    exampleProjects: { name: string; url: string }[];
  } | null>(null);
  const [isSeedingSetup, setIsSeedingSetup] = useState(false);
  const [seedDemoOption, setSeedDemoOption] = useState(true);
  const [seedExamplesOption, setSeedExamplesOption] = useState(true);
  const [merchantIdInput, setMerchantIdInput] = useState<string>("");

  const loadSidePanels = useCallback(async () => {
    const [statsRes, overviewRes, configRes, cronRes, libraryRes, subRes, sysRes, plansRes, setupRes] = await Promise.all([
      apiGet<Stats>("/api/admin"),
      apiGet<Overview>("/api/admin/overview"),
      apiGet<{ data: Record<string, unknown>; defaults: Record<string, unknown> }>("/api/admin/config"),
      apiGet<{ data: AdminCronTask[] }>("/api/admin/cron"),
      apiGet<{ data: PublicAsset[] }>("/api/admin/public-library"),
      apiGet<{ data: { users: SubscriptionUser[]; transactions: PaymentTransaction[] } }>("/api/admin/subscriptions").catch(() => ({ data: { users: [], transactions: [] } })),
      apiGet<SystemState>("/api/admin/system").catch(() => null),
      apiGet<{ data: SubscriptionPlan[] }>("/api/admin/subscriptions/plans").catch(() => ({ data: DEFAULT_PLANS })),
      apiGet<{ data: any }>("/api/admin/setup").catch(() => null),
    ]);
    setStats(statsRes);
    setOverview(overviewRes);
    setConfigs(configRes.data);
    setDefaults(configRes.defaults);
    if (typeof configRes.data["zarinpal.merchant_id"] === "string") {
      setMerchantIdInput(configRes.data["zarinpal.merchant_id"] as string);
    }
    setCronTasks(cronRes.data);
    setPublicAssets(libraryRes.data);
    if (subRes?.data) {
      setSubUsers(subRes.data.users);
      setTransactions(subRes.data.transactions);
    }
    if (sysRes) {
      setSystemState(sysRes);
    }
    if (plansRes?.data) {
      setPlansConfig(plansRes.data);
    }
    if (setupRes?.data) {
      setSetupStatus(setupRes.data);
    }
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
      const message = error instanceof Error ? error.message : t("admin.loadFailed");
      if (/403|Admin/.test(message)) setForbidden(true);
      else toast.error(message);
    } finally {
      setRefreshing(false);
    }
  }, [loadProjects, loadSidePanels, loadUsers, t]);

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
        toast.error(error instanceof Error ? error.message : t("admin.updateFailed"));
      }
    },
    [load, t],
  );

  const patchProjects = useCallback(
    async (payload: Record<string, unknown>, success: string) => {
      try {
        await apiPatch("/api/admin/projects", payload);
        toast.success(success);
        await load();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("admin.updateFailed"));
      }
    },
    [load, t],
  );

  async function saveSubscriptionPlan() {
    if (!editingSubUser) return;
    try {
      await apiPatch("/api/admin/subscriptions", {
        userId: editingSubUser.id,
        tier: subTier,
        maxProjects: subMaxProjects,
        projectStorageCapBytes: Math.round(subProjectCapMb * 1024 * 1024),
        libraryStorageCapBytes: Math.round(subLibraryCapMb * 1024 * 1024),
        subscriptionExpiresAt: subExpiresAt ? new Date(subExpiresAt).toISOString() : null,
      });
      toast.success("Subscription plan updated successfully.");
      setEditingSubUser(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update subscription.");
    }
  }

  async function handleConvertToProduction() {
    if (prodConfirmText !== "CONFIRM_PRODUCTION") {
      toast.error("You must enter 'CONFIRM_PRODUCTION' to confirm.");
      return;
    }
    setIsPurging(true);
    try {
      const res = await apiPost<{ success: boolean; message: string }>("/api/admin/system", {
        action: "convert_to_production",
        confirmation: "CONFIRM_PRODUCTION",
      });
      toast.success(res.message || "Successfully converted to production!");
      setProdModalOpen(false);
      setProdConfirmText("");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to convert to production.");
    } finally {
      setIsPurging(false);
    }
  }

  async function handlePopulateDemo() {
    setIsPopulating(true);
    try {
      const res = await apiPost<{ success: boolean; message: string }>("/api/admin/system", {
        action: "populate_demo",
      });
      toast.success(res.message || "Demo data populated successfully!");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to populate demo data.");
    } finally {
      setIsPopulating(false);
    }
  }

  async function impersonate(user: AdminUser) {
    try {
      await apiPost("/api/admin/impersonate", { userId: user.id });
      // The session cookie changed, so the whole router cache is stale: replace
      // rather than push, then refresh to re-render every server component
      // against the impersonated identity.
      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("admin.impersonate.failed"));
    }
  }

  async function openDetail(user: AdminUser) {
    try {
      const { data } = await apiGet<{ data: UserDetail }>(`/api/admin/users?userId=${user.id}`);
      setDetail(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("admin.detail.failed"));
    }
  }

  async function deleteUser(user: AdminUser) {
    const typed = window.prompt(t("admin.deleteAccountPrompt", { name: user.username }));
    if (typed === null) return;
    try {
      await apiDelete("/api/admin/users", { userId: user.id, confirmUsername: typed });
      toast.success(t("admin.done.deleted", { name: user.username }));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("admin.deleteFailed"));
    }
  }

  async function deleteProject(project: AdminProject) {
    const typed = window.prompt(
      t("admin.deleteProjectPrompt", { name: `${project.username}/${project.name}` }),
    );
    if (typed === null) return;
    try {
      await apiDelete("/api/admin/projects", { projectId: project.id, confirmName: typed });
      toast.success(t("admin.done.deleted", { name: project.name }));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("admin.deleteFailed"));
    }
  }

  async function revokeSessions(user: AdminUser) {
    try {
      await apiDelete(`/api/admin/sessions?userId=${user.id}`);
      toast.success(t("admin.done.signedOut", { name: user.username }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("admin.revoke.failed"));
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
      toast.success(t("admin.config.saved", { key }));
      await loadSidePanels();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("admin.config.failed"));
    }
  }

  async function toggleGlobalTask(task: AdminCronTask) {
    try {
      await apiPut("/api/admin/cron", { task: task.task, isEnabled: !task.globallyEnabled });
      toast.success(
        t("admin.cron.done", {
          task: task.task,
          state: t(task.globallyEnabled ? "admin.cron.state.disabled" : "admin.cron.state.enabled"),
        }),
      );
      await loadSidePanels();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("admin.updateFailed"));
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
      if (!response.ok) throw new Error(payload.error ?? t("error.generic"));
      toast.success(t("admin.library.published", { path }));
      setPublicPath("");
      await loadSidePanels();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("error.generic"));
    }
  }

  async function deletePublicAsset(path: string) {
    try {
      await apiDelete(`/api/admin/public-library?path=${encodeURIComponent(path)}`);
      toast.success(t("admin.library.removed"));
      await loadSidePanels();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("admin.deleteFailed"));
    }
  }

  async function handleSavePlansConfig() {
    setIsSavingPlans(true);
    try {
      await apiPut("/api/admin/subscriptions/plans", { plans: plansConfig });
      toast.success(t("admin.subscriptions.title"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save plans.");
    } finally {
      setIsSavingPlans(false);
    }
  }

  async function handleRunSetupWizard() {
    setIsSeedingSetup(true);
    try {
      const res = await apiPost<{ success: boolean; result: any; status: any }>("/api/admin/setup", {
        seedDemoData: seedDemoOption,
        seedExampleProjects: seedExamplesOption,
      });
      if (res.status) setSetupStatus(res.status);
      toast.success("Setup wizard completed.");
      await loadSidePanels();
      await loadUsers();
      await loadProjects();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Setup wizard failed.");
    } finally {
      setIsSeedingSetup(false);
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
        <h1 className="mt-3 text-lg font-semibold">{t("admin.forbidden.title")}</h1>
        <p className="mt-1 text-13px text-muted-foreground">
          {t("admin.forbidden.body")}
        </p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link href="/dashboard">
            <ArrowLeft className="rtl-flip h-3.5 w-3.5" /> {t("admin.forbidden.back")}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("admin.eyebrow")}
        title={t("admin.title")}
        description={t("admin.description")}
        actions={
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={refreshing}>
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            {refreshing ? t("admin.refreshing") : t("action.refresh")}
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("label.accounts")}
          value={overview ? fmt.number(overview.users) : "…"}
          icon={Users}
          tone="signal"
          hint={
            overview
              ? t("admin.stat.accountsHint", {
                  suspended: fmt.number(overview.suspendedUsers),
                  locked: fmt.number(overview.lockedUsers),
                  newUsers: fmt.number(overview.week.newUsers),
                })
              : undefined
          }
        />
        <StatCard
          label={t("label.projects")}
          value={stats ? fmt.number(stats.projects) : "…"}
          icon={Building2}
          hint={
            overview ? t("admin.stat.projectsHint", { count: fmt.number(overview.newProjectsThisWeek) }) : undefined
          }
        />
        <StatCard
          label={t("projects.stat.visits")}
          value={overview ? fmt.number(overview.last24h.visits) : "…"}
          hint={
            overview
              ? t("admin.stat.visitsHint", {
                  unique: fmt.number(overview.last24h.uniqueVisitors),
                  week: fmt.number(overview.week.visits),
                })
              : undefined
          }
          icon={Activity}
        />
        <StatCard
          label={t("projects.stat.storage")}
          value={stats ? fmt.bytes(stats.storageBytes) : "…"}
          icon={HardDrive}
          tone="blueprint"
          hint={
            stats ? t("admin.stat.storageHint", { count: fmt.number(stats.visitsAllTime) }) : undefined
          }
        />
      </div>

      {overview && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={t("admin.stat.sessions")}
            value={fmt.number(overview.health.liveSessions)}
            icon={Activity}
            tone="blueprint"
            hint={t("admin.stat.sessionsHint")}
          />
          <StatCard
            label={t("admin.stat.apiKeys")}
            value={fmt.number(overview.health.activeApiKeys)}
            icon={KeyRound}
            tone={overview.health.idleApiKeys > 0 ? "signal" : "blueprint"}
            hint={t("admin.stat.apiKeysHint", { count: fmt.number(overview.health.idleApiKeys) })}
          />
          <StatCard
            label={t("landing.feature.automation")}
            value={fmt.number(overview.health.activeWebhooks)}
            icon={Webhook}
            tone={overview.health.failedDeliveriesThisWeek > 0 ? "destructive" : "blueprint"}
            hint={t("admin.stat.webhooksHint", { count: fmt.number(overview.health.failedDeliveriesThisWeek) })}
          />
          <StatCard
            label={t("admin.stat.scheduled")}
            value={fmt.number(overview.health.enabledCronTasks)}
            icon={Cpu}
            hint={t("admin.stat.scheduledHint", { count: fmt.number(overview.health.verifiedDomains) })}
          />
        </div>
      )}

      {overview && !overview.viewer.isAdmin && (
        <p className="panel px-4 py-3 text-12.5px text-muted-foreground">
          {t("admin.operatorNote")}
        </p>
      )}

      <Tabs defaultValue="accounts">
        <TabsList>
          <TabsTrigger value="accounts">
            <Users className="h-3.5 w-3.5" /> {t("admin.tab.accounts")}
          </TabsTrigger>
          <TabsTrigger value="projects">
            <FolderTree className="h-3.5 w-3.5" /> {t("admin.tab.projects")}
          </TabsTrigger>
          <TabsTrigger value="subscriptions">
            <CreditCard className="h-3.5 w-3.5" /> {t("admin.tab.subscriptions")}
          </TabsTrigger>
          <TabsTrigger value="platform">
            <Cpu className="h-3.5 w-3.5" /> {t("admin.tab.platform")}
          </TabsTrigger>
          <TabsTrigger value="config">
            <Gauge className="h-3.5 w-3.5" /> {t("admin.tab.config")}
          </TabsTrigger>
          <TabsTrigger value="i18n">
            <Languages className="h-3.5 w-3.5" /> {t("admin.tab.i18n")}
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
            placeholder={t("admin.searchUsers")}
            filters={[
              { value: userStatus, onChange: setUserStatus, options: [
                ["all", t("admin.filter.allAccounts")],
                ["active", t("admin.filter.active")],
                ["suspended", t("admin.filter.suspended")],
                ["locked", t("admin.filter.locked")],
                ["admin", t("admin.filter.admins")],
              ] },
              { value: userSort, onChange: setUserSort, options: [
                ["id", t("admin.sort.newest")],
                ["username", t("admin.sort.username")],
                ["storage", t("admin.sort.storage")],
                ["projects", t("admin.sort.projects")],
                ["lastLogin", t("admin.sort.recent")],
              ] },
            ]}
          />

          <div className="panel overflow-hidden">
            <SelectionToolbar
              selected={userSelected}
              noun="selection.account"
              onClear={() => setUserSelected([])}
            >
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-12px"
                onClick={() =>
                  void patchUsers(
                    { userIds: userSelected.map(Number), isSuspended: true },
                    t("admin.done.suspended", { count: fmt.number(userSelected.length) }),
                  ).then(() => setUserSelected([]))
                }
              >
                {t("admin.suspend")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-12px"
                onClick={() =>
                  void patchUsers(
                    { userIds: userSelected.map(Number), isSuspended: false },
                    t("admin.done.resumed", { count: fmt.number(userSelected.length) }),
                  ).then(() => setUserSelected([]))
                }
              >
                {t("admin.resume")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-12px"
                onClick={() =>
                  void patchUsers(
                    { userIds: userSelected.map(Number), unlock: true },
                    t("admin.done.unlocked", { count: fmt.number(userSelected.length) }),
                  ).then(() => setUserSelected([]))
                }
              >
                {t("admin.clearLockout")}
              </Button>
              {isViewerAdmin && (
                <RoleSelect
                  onApply={(patch, label) =>
                    void patchUsers(
                      { userIds: userSelected.map(Number), ...patch },
                      t("admin.bulk.roleCount", {
                        count: fmt.number(userSelected.length),
                        label,
                      }),
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
                      label={t("admin.selectAll.accounts")}
                      onToggle={(selectAll) =>
                        setUserSelected(selectAll ? users.map((user) => String(user.id)) : [])
                      }
                    />
                  </TableHead>
                  <TableHead>{t("admin.th.account")}</TableHead>
                  <TableHead className="text-end">{t("label.projects")}</TableHead>
                  <TableHead className="w-44">{t("projects.stat.storage")}</TableHead>
                  <TableHead className="w-32">{t("label.lastSeen")}</TableHead>
                  <TableHead className="w-28">{t("label.status")}</TableHead>
                  <TableHead className="w-56 text-end">{t("admin.th.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-13px text-muted-foreground">
                      {t("admin.noAccounts")}
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
                        className="ltr-content text-start font-mono text-12.5px hover:text-signal"
                        onClick={() => void openDetail(user)}
                      >
                        {user.username}
                      </button>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {user.isAdmin && <Badge variant="signal">{t("admin.badge.admin")}</Badge>}
                        {user.isOperator && !user.isAdmin && (
                          <Badge variant="blueprint">{t("admin.badge.operator")}</Badge>
                        )}
                        {user.email && (
                          <span className="ltr-content text-11px text-muted-foreground">{user.email}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="nums text-end text-12.5px tabular-nums">{fmt.number(user.projectCount)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MeterBar
                          value={user.storageUsedBytes}
                          max={user.storageCapBytes}
                          className="w-20"
                          tone={user.storageUsedBytes > user.storageCapBytes ? "destructive" : "signal"}
                        />
                        <span className="nums font-mono text-11px text-muted-foreground tabular-nums">
                          {fmt.bytes(user.storageUsedBytes)} / {fmt.bytes(user.storageCapBytes)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-11.5px text-muted-foreground">
                      {user.lastLogin
                        ? fmt.relative(new Date(user.lastLogin).getTime())
                        : t("state.never")}
                    </TableCell>
                    <TableCell>
                      <StatusBadges user={user} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title={t("admin.detail.signInAs", { username: user.username })}
                          onClick={() => void impersonate(user)}
                          disabled={!isViewerAdmin && user.isAdmin}
                        >
                          <UserCog className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title={t("admin.tooltip.detail")}
                          onClick={() => void openDetail(user)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Switch
                          checked={user.isSuspended}
                          onCheckedChange={(checked) =>
                            void patchUsers(
                              { userId: user.id, isSuspended: checked },
                              checked
                                ? t("admin.done.userSuspended", { name: user.username })
                                : t("admin.done.userResumed", { name: user.username }),
                            )
                          }
                        />
                        {isViewerAdmin && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground hover:text-destructive"
                            title={t("admin.tooltip.deleteAccount")}
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
              label="pagination.accounts"
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
            placeholder={t("admin.searchProjects")}
            filters={[
              { value: projectStatus, onChange: setProjectStatus, options: [
                ["all", t("admin.filter.allProjects")],
                ["active", t("admin.filter.live")],
                ["suspended", t("admin.filter.suspended")],
                ["owner-suspended", t("admin.filter.ownerSuspended")],
              ] },
              { value: projectSort, onChange: setProjectSort, options: [
                ["id", t("admin.sort.newest")],
                ["name", t("admin.sort.name")],
                ["files", t("admin.sort.files")],
                ["storage", t("admin.sort.storage")],
                ["visits", t("admin.sort.visits")],
              ] },
            ]}
          />

          <div className="panel overflow-hidden">
            <SelectionToolbar
              selected={projectSelected}
              noun="selection.project"
              onClear={() => setProjectSelected([])}
            >
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-12px"
                onClick={() =>
                  void patchProjects(
                    { projectIds: projectSelected.map(Number), isActive: true },
                    t("admin.bulk.projectsResumed", { count: fmt.number(projectSelected.length) }),
                  ).then(() => setProjectSelected([]))
                }
              >
                {t("admin.activate")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-12px"
                onClick={() =>
                  void patchProjects(
                    { projectIds: projectSelected.map(Number), isActive: false },
                    t("admin.bulk.projectsSuspended", { count: fmt.number(projectSelected.length) }),
                  ).then(() => setProjectSelected([]))
                }
              >
                {t("admin.suspend")}
              </Button>
            </SelectionToolbar>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <SelectAllCheckbox
                      selected={projectSelected}
                      total={projects.length}
                      label={t("admin.selectAll.projects")}
                      onToggle={(selectAll) =>
                        setProjectSelected(selectAll ? projects.map((p) => String(p.id)) : [])
                      }
                    />
                  </TableHead>
                  <TableHead>{t("label.project")}</TableHead>
                  <TableHead className="w-32">{t("label.owner")}</TableHead>
                  <TableHead className="text-end">{t("label.files")}</TableHead>
                  <TableHead className="text-end">{t("projects.meter.visits")}</TableHead>
                  <TableHead className="w-28">{t("admin.th.freeQuota")}</TableHead>
                  <TableHead className="w-28">{t("label.status")}</TableHead>
                  <TableHead className="w-24 text-end">{t("admin.th.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-13px text-muted-foreground">
                      {t("admin.noProjects")}
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
                        className="ltr-content font-mono text-12.5px hover:text-signal"
                      >
                        {project.name}
                      </a>
                      <div className="text-11px text-muted-foreground">
                        {t("admin.project.stored", { bytes: fmt.bytes(project.storageBytes) })}
                      </div>
                    </TableCell>
                    <TableCell className="ltr-content font-mono text-12px text-muted-foreground">
                      {project.username}
                    </TableCell>
                    <TableCell className="nums text-end text-12.5px tabular-nums">{fmt.number(project.fileCount)}</TableCell>
                    <TableCell className="nums text-end text-12.5px tabular-nums">
                      {fmt.number(project.visitCount)}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        defaultValue={project.freeVisitsPerMonth}
                        className="nums h-8 w-24"
                        onBlur={(event) => {
                          const visits = Number(event.target.value);
                          if (Number.isFinite(visits) && visits >= 0 && visits !== project.freeVisitsPerMonth) {
                            void patchProjects(
                              { projectId: project.id, freeVisitsPerMonth: visits },
                              t("admin.done.quotaSet", {
                                name: project.name,
                                value: fmt.number(visits),
                              }),
                            );
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      {project.ownerSuspended ? (
                        <Badge variant="outline">{t("admin.filter.ownerSuspended")}</Badge>
                      ) : project.isActive ? (
                        <Badge>{t("projects.badge.live")}</Badge>
                      ) : (
                        <Badge variant="destructive">{t("admin.badge.suspended")}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Switch
                          checked={project.isActive}
                          onCheckedChange={(checked) =>
                            void patchProjects(
                              { projectId: project.id, isActive: checked },
                              checked
                                ? t("admin.done.userResumed", { name: project.name })
                                : t("admin.done.userSuspended", { name: project.name }),
                            )
                          }
                        />
                        {isViewerAdmin && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground hover:text-destructive"
                            title={t("admin.tooltip.deleteProject")}
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
              label="pagination.projects"
              className="border-t border-border"
              onPageChange={(page) => setProjectPaging((prev) => ({ ...prev, page }))}
              onPageSizeChange={(pageSize) => setProjectPaging({ ...projectPaging, page: 1, pageSize })}
            />
          </div>
        </TabsContent>

        {/* -------------------------------------------------- subscriptions */}
        <TabsContent value="subscriptions" className="space-y-6">
          {/* ZarinPal Gateway Settings */}
          <div className="panel overflow-hidden">
            <div className="border-b border-border px-5 py-3.5 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">{locale === "fa-IR" ? "تنظیمات درگاه پرداخت زرین‌پال" : "ZarinPal Payment Gateway Configuration"}</div>
                <div className="mt-0.5 text-12.5px text-muted-foreground">
                  {locale === "fa-IR" ? "شناسه مرچنت زرین‌پال نسخه ۴ جهت پرداخت آنلاین پلن‌های پلاس و پرو" : "ZarinPal v4 Merchant ID for online tier purchases"}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={!isViewerAdmin}
                onClick={() => void saveConfig("zarinpal.merchant_id", merchantIdInput.trim())}
              >
                {locale === "fa-IR" ? "ذخیره شناسه مرچنت" : "Save Merchant ID"}
              </Button>
            </div>
            <div className="p-5 max-w-lg space-y-2">
              <Label className="text-12px">{locale === "fa-IR" ? "شناسه مرچنت (UUID ۳۶ کاراکتری)" : "Merchant ID (36-character UUID)"}</Label>
              <Input
                type="text"
                placeholder="00000000-0000-0000-0000-000000000000"
                value={merchantIdInput}
                onChange={(e) => setMerchantIdInput(e.target.value)}
                className="font-mono text-12.5px"
              />
            </div>
          </div>

          {/* Subscription Plans Tier Editor */}
          <div className="panel overflow-hidden">
            <div className="border-b border-border px-5 py-3.5 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">{locale === "fa-IR" ? "تنظیمات طرح‌های اشتراک پلتفرم" : "Platform Subscription Tiers Configuration"}</div>
                <div className="mt-0.5 text-12.5px text-muted-foreground">
                  {locale === "fa-IR" ? "تنظیم قیمت، سقف پروژه‌ها و فضای ذخیره‌سازی برای پلن‌های رایگان، پلاس و حرفه‌ای" : "Configure pricing, project limits, and storage caps for Free, Plus, and Pro plans"}
                </div>
              </div>
              <Button
                size="sm"
                variant="signal"
                disabled={!isViewerAdmin || isSavingPlans}
                onClick={() => void handleSavePlansConfig()}
              >
                {isSavingPlans ? (locale === "fa-IR" ? "در حال ذخیره..." : "Saving...") : (locale === "fa-IR" ? "ذخیره تغییرات تعرفه‌ها" : "Save Tier Settings")}
              </Button>
            </div>
            <div className="p-5 grid gap-6 md:grid-cols-3">
              {plansConfig.map((plan, idx) => (
                <div key={plan.id} className="rounded-xl border border-border p-4 bg-card/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{plan.name} ({plan.nameFa})</span>
                    <Badge variant={plan.isPopular ? "signal" : "outline"} className="text-10px">
                      {plan.id.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-11px text-muted-foreground">{locale === "fa-IR" ? "عنوان انگلیسی" : "Plan Name (EN)"}</Label>
                      <Input
                        type="text"
                        value={plan.name}
                        onChange={(e) => {
                          const updated = [...plansConfig];
                          updated[idx].name = e.target.value;
                          setPlansConfig(updated);
                        }}
                        className="h-8 text-12px"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-11px text-muted-foreground">{locale === "fa-IR" ? "عنوان فارسی" : "Plan Name (FA)"}</Label>
                      <Input
                        type="text"
                        value={plan.nameFa}
                        onChange={(e) => {
                          const updated = [...plansConfig];
                          updated[idx].nameFa = e.target.value;
                          setPlansConfig(updated);
                        }}
                        className="h-8 text-12px"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-11px text-muted-foreground">{locale === "fa-IR" ? "قیمت ماهانه (تومان)" : "Price (Toman/month)"}</Label>
                    <Input
                      type="number"
                      value={plan.priceToman}
                      disabled={plan.id === "free"}
                      onChange={(e) => {
                        const updated = [...plansConfig];
                        updated[idx].priceToman = Math.max(0, Number(e.target.value));
                        setPlansConfig(updated);
                      }}
                      className="h-8 text-12px"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-11px text-muted-foreground">{locale === "fa-IR" ? "حداکثر پروژه‌ها" : "Max Projects"}</Label>
                    <Input
                      type="number"
                      value={plan.maxProjects}
                      onChange={(e) => {
                        const updated = [...plansConfig];
                        updated[idx].maxProjects = Math.max(1, Number(e.target.value));
                        setPlansConfig(updated);
                      }}
                      className="h-8 text-12px"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-11px text-muted-foreground">{locale === "fa-IR" ? "سقف حافظه هر پروژه (مگابایت)" : "Project Storage Cap (MB)"}</Label>
                    <Input
                      type="number"
                      value={plan.projectStorageCapMb}
                      onChange={(e) => {
                        const updated = [...plansConfig];
                        updated[idx].projectStorageCapMb = Math.max(1, Number(e.target.value));
                        setPlansConfig(updated);
                      }}
                      className="h-8 text-12px"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-11px text-muted-foreground">{locale === "fa-IR" ? "بازدید ماهانه مجاز" : "Monthly Visits"}</Label>
                    <Input
                      type="number"
                      value={plan.monthlyVisits}
                      onChange={(e) => {
                        const updated = [...plansConfig];
                        updated[idx].monthlyVisits = Math.max(10, Number(e.target.value));
                        setPlansConfig(updated);
                      }}
                      className="h-8 text-12px"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel overflow-hidden">
            <div className="border-b border-border px-5 py-3.5">
              <div className="text-sm font-semibold">{t("admin.subscriptions.title")}</div>
              <div className="mt-0.5 text-12.5px text-muted-foreground">
                {t("admin.subscriptions.description")}
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("label.username")}</TableHead>
                  <TableHead className="w-24">{t("admin.subscriptions.tier")}</TableHead>
                  <TableHead className="w-28 text-end">{t("admin.subscriptions.maxProjects")}</TableHead>
                  <TableHead className="w-32 text-end">{t("admin.subscriptions.projectCap")}</TableHead>
                  <TableHead className="w-32 text-end">{t("admin.subscriptions.libraryCap")}</TableHead>
                  <TableHead className="w-36">{t("admin.subscriptions.expiresAt")}</TableHead>
                  <TableHead className="w-28 text-end" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {subUsers.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>{u.username}</span>
                        {u.isAdmin && <Badge variant="outline" className="text-10px">Admin</Badge>}
                      </div>
                      {u.email && <div className="text-11px text-muted-foreground font-mono">{u.email}</div>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.subscriptionTier === "plus" ? "default" : "outline"}>
                        {u.subscriptionTier.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-end nums text-12px tabular-nums">
                      {u.projectCount} / {u.maxProjects}
                    </TableCell>
                    <TableCell className="text-end nums text-12px tabular-nums">
                      {fmt.bytes(u.projectStorageCapBytes)}
                    </TableCell>
                    <TableCell className="text-end nums text-12px tabular-nums">
                      {fmt.bytes(u.libraryStorageCapBytes)}
                    </TableCell>
                    <TableCell className="text-11.5px text-muted-foreground">
                      {u.subscriptionExpiresAt ? fmt.dateTime(new Date(u.subscriptionExpiresAt).getTime()) : "Never (Perpetual)"}
                    </TableCell>
                    <TableCell className="text-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-12px"
                        disabled={!isViewerAdmin}
                        onClick={() => {
                          setEditingSubUser(u);
                          setSubTier(u.subscriptionTier);
                          setSubMaxProjects(u.maxProjects);
                          setSubProjectCapMb(Math.round(u.projectStorageCapBytes / (1024 * 1024)));
                          setSubLibraryCapMb(Math.round(u.libraryStorageCapBytes / (1024 * 1024)));
                          setSubExpiresAt(u.subscriptionExpiresAt ? u.subscriptionExpiresAt.slice(0, 10) : "");
                        }}
                      >
                        {t("admin.subscriptions.editPlan")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="panel overflow-hidden">
            <div className="border-b border-border px-5 py-3.5">
              <div className="text-sm font-semibold">{t("admin.subscriptions.transactions")}</div>
            </div>
            {transactions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">ID</TableHead>
                    <TableHead>{t("label.username")}</TableHead>
                    <TableHead className="w-20">Tier</TableHead>
                    <TableHead className="w-28 text-end">Amount</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="w-36">Authority / Ref ID</TableHead>
                    <TableHead className="w-36">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-mono text-12px">#{tx.id}</TableCell>
                      <TableCell className="font-medium text-12px">{tx.username}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{tx.tier.toUpperCase()}</Badge>
                      </TableCell>
                      <TableCell className="text-end nums text-12px tabular-nums">
                        {fmt.number(tx.amount)} {tx.currency}
                      </TableCell>
                      <TableCell>
                        <Badge variant={tx.status === "completed" ? "default" : tx.status === "pending" ? "outline" : "destructive"}>
                          {tx.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-11px text-muted-foreground truncate max-w-xs">
                        {tx.refId || tx.authority}
                      </TableCell>
                      <TableCell className="text-11.5px text-muted-foreground">
                        {tx.createdAt ? fmt.dateTime(new Date(tx.createdAt).getTime()) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No payment transactions recorded yet.
              </div>
            )}
          </div>
        </TabsContent>

        {/* ------------------------------------------------------- platform */}
        <TabsContent value="platform" className="space-y-4">
          {/* Setup Wizard */}
          <div className="panel overflow-hidden">
            <div className="border-b border-border px-5 py-3.5 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">{locale === "fa-IR" ? "راه‌اندازی اولیه و اپ‌های نمونه" : "Deployment Setup Wizard"}</div>
                <div className="mt-0.5 text-12.5px text-muted-foreground">
                  {locale === "fa-IR" ? "آماده‌سازی خودکار پلتفرم و ساخت نمونه‌های نمایشی بدون دستکاری اطلاعات موجود" : "Non-destructive production initialization & showcase projects population"}
                </div>
              </div>
              {setupStatus && (
                <Badge variant={setupStatus.wizardCompleted ? "default" : "outline"}>
                  {setupStatus.wizardCompleted ? (locale === "fa-IR" ? "تکمیل شده" : "Initialized") : (locale === "fa-IR" ? "آماده راه‌اندازی" : "Pending")}
                </Badge>
              )}
            </div>
            <div className="p-5 space-y-4">
              <div className="flex flex-wrap items-center gap-4 text-12.5px text-muted-foreground">
                <span>{locale === "fa-IR" ? "حساب نمونه‌ها:" : "Examples Account:"} <strong className="text-foreground">these_are_examples</strong> ({setupStatus?.examplesUserExists ? (locale === "fa-IR" ? "فعال" : "Created") : (locale === "fa-IR" ? "هنوز ساخته نشده" : "Not created")})</span>
                <span>{locale === "fa-IR" ? "نمونه‌های ساخته‌شده:" : "Sample Projects:"} <strong className="text-foreground">{setupStatus?.exampleProjectsCount ?? 0}</strong></span>
              </div>

              {setupStatus?.exampleProjects && setupStatus.exampleProjects.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {setupStatus.exampleProjects.map((p) => (
                    <a
                      key={p.name}
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono bg-accent/60 hover:bg-accent text-signal transition-colors border border-border"
                    >
                      🚀 {p.name}
                    </a>
                  ))}
                </div>
              )}

              <div className="pt-2 border-t border-border flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-12.5px cursor-pointer">
                    <input
                      type="checkbox"
                      checked={seedDemoOption}
                      onChange={(e) => setSeedDemoOption(e.target.checked)}
                      className="rounded border-border"
                    />
                    <span>{locale === "fa-IR" ? "ثبت تنظیمات پایه و تعرفه‌ها" : "Seed Demo & Plan Configs"}</span>
                  </label>
                  <label className="flex items-center gap-2 text-12.5px cursor-pointer">
                    <input
                      type="checkbox"
                      checked={seedExamplesOption}
                      onChange={(e) => setSeedExamplesOption(e.target.checked)}
                      className="rounded border-border"
                    />
                    <span>{locale === "fa-IR" ? "ساخت اپ‌های نمونه روی حساب these_are_examples" : "Populate Sample Projects under these_are_examples"}</span>
                  </label>
                </div>
                <Button
                  size="sm"
                  disabled={!isViewerAdmin || isSeedingSetup || (!seedDemoOption && !seedExamplesOption)}
                  onClick={() => void handleRunSetupWizard()}
                >
                  <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", isSeedingSetup && "animate-spin")} />
                  {isSeedingSetup ? (locale === "fa-IR" ? "در حال آماده‌سازی..." : "Seeding...") : (locale === "fa-IR" ? "شروع راه‌اندازی اولیه" : "Run Setup Wizard")}
                </Button>
              </div>
            </div>
          </div>

          <div className="panel overflow-hidden">
            <div className="border-b border-border px-5 py-3.5 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">{t("admin.system.title")}</div>
                <div className="mt-0.5 text-12.5px text-muted-foreground">
                  {t("admin.system.description")}
                </div>
              </div>
              {systemState && (
                <Badge variant={systemState.isDemo ? "outline" : "default"}>
                  {systemState.isDemo ? "Demo Environment" : "Production Environment"}
                </Badge>
              )}
            </div>
            <div className="p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1 text-12.5px text-muted-foreground max-w-xl">
                <p>Total Users: <strong className="text-foreground">{systemState?.totalUsers ?? 0}</strong> · Total Projects: <strong className="text-foreground">{systemState?.totalProjects ?? 0}</strong></p>
                <p>Converting to clean production purges all demo accounts, demo projects, database tables, and physical storage folders while preserving your SuperAdmin account. Populating demo initializes demo templates on an empty deployment.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={!isViewerAdmin || isPurging}
                  onClick={() => setProdModalOpen(true)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> {t("admin.system.convertToProd")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!isViewerAdmin || isPopulating || (systemState ? systemState.totalProjects > 0 : false)}
                  onClick={() => void handlePopulateDemo()}
                >
                  <RefreshCw className={cn("h-3.5 w-3.5 mr-1", isPopulating && "animate-spin")} /> {t("admin.system.populateDemo")}
                </Button>
              </div>
            </div>
          </div>
          {overview && overview.topProjects.length > 0 && (
            <div className="panel p-5">
              <div className="mono-label">{t("admin.busiest")}</div>
              <ol className="mt-3 space-y-2">
                {overview.topProjects.map((project, index) => (
                  <li key={project.id} className="flex items-center gap-3 text-13px">
                    <span className="nums w-4 font-mono text-11px text-muted-foreground">{fmt.number(index + 1)}</span>
                    <span className="ltr-content font-mono">{project.username}/{project.name}</span>
                    <span className="nums ms-auto tabular-nums text-muted-foreground">
                      {fmt.number(project.visits)}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="panel overflow-hidden">
            <div className="border-b border-border px-5 py-3.5">
              <div className="text-sm font-semibold">{t("admin.cron.title")}</div>
              <div className="mt-0.5 text-12.5px text-muted-foreground">
                {t("admin.cron.description")}
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.cron.th.task")}</TableHead>
                  <TableHead className="w-32 text-end">{t("admin.cron.th.due")}</TableHead>
                  <TableHead className="w-24">{t("label.enabled")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cronTasks.map((task) => (
                  <TableRow key={task.task}>
                    <TableCell className="ltr-content font-mono text-12.5px">{task.task}</TableCell>
                    <TableCell className="nums text-end text-12.5px tabular-nums">{fmt.number(task.dueProjects)}</TableCell>
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
              <div className="text-sm font-semibold">{t("admin.library.title")}</div>
              <div className="mt-0.5 text-12.5px text-muted-foreground">
                {t("admin.library.description")}
              </div>
            </div>
            <div className="space-y-3 border-b border-border px-5 py-4">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Label htmlFor="public-path">{t("label.path")}</Label>
                  <Input
                    id="public-path"
                    value={publicPath}
                    onChange={(event) => setPublicPath(event.target.value)}
                    dir="ltr"
                    className="ltr-input font-mono"
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
                  {t("admin.library.publish")}
                </Button>
              </div>
              <p className="text-11.5px text-muted-foreground">{t("admin.library.hint")}</p>
            </div>
            {publicAssets.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("label.path")}</TableHead>
                    <TableHead className="w-28 text-end">{t("label.size")}</TableHead>
                    <TableHead className="w-28">{t("files.table.modified")}</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {publicAssets.map((asset) => (
                    <TableRow key={asset.path}>
                      <TableCell className="ltr-content font-mono text-12px">/~public/{asset.path}</TableCell>
                      <TableCell className="nums text-end text-12px tabular-nums">
                        {fmt.bytes(asset.size)}
                      </TableCell>
                      <TableCell className="text-11.5px text-muted-foreground">
                        {asset.modified ? fmt.dateTime(new Date(asset.modified).getTime()) : "—"}
                      </TableCell>
                      <TableCell className="text-end">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:text-destructive"
                          title={t("action.delete")}
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
              <p className="px-5 py-8 text-center text-13px text-muted-foreground">
                {t("admin.library.empty")}
              </p>
            )}
          </div>
        </TabsContent>

        {/* --------------------------------------------------------- config */}
        <TabsContent value="config">
          <ConfigEditor configs={configs} defaults={defaults} onSave={saveConfig} />
        </TabsContent>

        {/* ------------------------------------------------------ i18n */}
        <TabsContent value="i18n">
          <AdminTranslationsPanel />
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
          void patchUsers(
            { userId: user.id, isSuspended: suspended },
            t("admin.done.updated", { name: user.username }),
          );
        }}
        onSetCap={(user, capMb) => {
          void patchUsers(
            { userId: user.id, storageCapBytes: Math.round(capMb * 1024 * 1024) },
            t("admin.done.capSet", { name: user.username, value: fmt.number(capMb) }),
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
          const label =
            role === "admin"
              ? t("admin.role.isNowAdmin")
              : role === "operator"
                ? t("admin.role.isNowOperator")
                : t("admin.role.isNowMember");
          setDetail(null);
          void patchUsers(
            { userId: user.id, ...patch },
            t("admin.detail.roleChanged", { name: user.username, label }),
          );
        }}
      />

      {/* ------------------------------------------------ Edit Plan Dialog */}
      <Dialog open={editingSubUser !== null} onOpenChange={(open) => !open && setEditingSubUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Plan: {editingSubUser?.username}</DialogTitle>
            <DialogDescription>
              Adjust user subscription tier, project quota, storage caps, and expiry date.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Subscription Tier</Label>
              <Select
                value={subTier}
                onValueChange={(val) => {
                  setSubTier(val);
                  if (val === "plus") {
                    setSubMaxProjects(50);
                    setSubProjectCapMb(50);
                    setSubLibraryCapMb(50);
                  } else if (val === "free") {
                    setSubMaxProjects(3);
                    setSubProjectCapMb(3);
                    setSubLibraryCapMb(3);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free Tier (3 Projects, 3MB Storage)</SelectItem>
                  <SelectItem value="plus">Plus Tier (50 Projects, 50MB Storage)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label>Max Projects</Label>
                <Input
                  type="number"
                  min={1}
                  value={subMaxProjects}
                  onChange={(e) => setSubMaxProjects(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Project Cap (MB)</Label>
                <Input
                  type="number"
                  min={1}
                  value={subProjectCapMb}
                  onChange={(e) => setSubProjectCapMb(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Library Cap (MB)</Label>
                <Input
                  type="number"
                  min={1}
                  value={subLibraryCapMb}
                  onChange={(e) => setSubLibraryCapMb(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Expiry Date (Leave empty for perpetual)</Label>
              <Input
                type="date"
                value={subExpiresAt}
                onChange={(e) => setSubExpiresAt(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSubUser(null)}>
              Cancel
            </Button>
            <Button onClick={() => void saveSubscriptionPlan()}>
              Save Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -------------------------------------- Convert to Production Dialog */}
      <Dialog open={prodModalOpen} onOpenChange={setProdModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <TriangleAlert className="h-5 w-5" /> Convert to Clean Production
            </DialogTitle>
            <DialogDescription>
              This action is destructive and irreversible. It will wipe all demo users, demo projects, database entries, and physical disk files. Your current SuperAdmin account will be preserved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-12.5px text-muted-foreground">
              To confirm, type <strong className="font-mono text-destructive">CONFIRM_PRODUCTION</strong> below:
            </p>
            <Input
              value={prodConfirmText}
              onChange={(e) => setProdConfirmText(e.target.value)}
              placeholder="CONFIRM_PRODUCTION"
              className="font-mono text-center tracking-wider"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProdModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={prodConfirmText !== "CONFIRM_PRODUCTION" || isPurging}
              onClick={() => void handleConvertToProduction()}
            >
              {isPurging ? "Purging..." : "Purge & Convert to Production"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  const { t } = useI18n();
  const [value, setValue] = useState("");

  return (
    <div className="flex items-center gap-1.5">
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger className="h-7 w-44 text-12px" aria-label={t("admin.role.aria")}>
          <SelectValue placeholder={t("admin.role.placeholder")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="member">{t("admin.role.removeAccess")}</SelectItem>
          <SelectItem value="operator">{t("admin.role.makeOperator")}</SelectItem>
          <SelectItem value="admin">{t("admin.role.makeAdmin")}</SelectItem>
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-12px"
        disabled={!value}
        onClick={() => {
          const patch =
            value === "admin"
              ? { isAdmin: true, isOperator: true }
              : value === "operator"
                ? { isOperator: true }
                : { isOperator: false, isAdmin: false };
          void onApply(
            patch,
            value === "admin"
              ? t("admin.role.madeAdmins")
              : value === "operator"
                ? t("admin.role.madeOperators")
                : t("admin.role.demoted"),
          );
          setValue("");
        }}
      >
        {t("admin.role.apply")}
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
        <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder={placeholder}
          className="ps-8"
          aria-label={placeholder}
        />
      </div>
      {filters.map((filter) => (
        <select
          key={filter.options[0]?.[0]}
          value={filter.value}
          onChange={(event) => filter.onChange(event.target.value)}
          aria-label={filter.options[0]?.[1]}
          className="h-10 rounded-md border border-input bg-background px-2.5 text-13px text-foreground"
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
  const { t } = useI18n();
  const locked = user.lockedUntil !== null && new Date(user.lockedUntil) > new Date();
  if (user.isSuspended) return <Badge variant="destructive">{t("admin.badge.suspended")}</Badge>;
  if (locked) return <Badge variant="warning">{t("admin.badge.lockedOut")}</Badge>;
  return <Badge variant="outline">{t("admin.badge.active")}</Badge>;
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
  const { t, fmt } = useI18n();
  return (
    <>
      <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                <span className="ltr-content font-mono">{detail.username}</span>
                <StatusBadges user={detail} />
                {detail.isAdmin && <Badge variant="signal">{t("admin.badge.admin")}</Badge>}
              </DialogTitle>
              <DialogDescription>
                {detail.email ?? t("admin.detail.noEmail")} ·{" "}
                {t("admin.detail.joined", { date: fmt.date(new Date(detail.createdAt).getTime()) })} ·{" "}
                {detail.lastLogin
                  ? t("admin.detail.lastSeen", { date: fmt.relative(new Date(detail.lastLogin).getTime()) })
                  : t("admin.detail.neverSignedIn")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-border p-3">
                  <div className="mono-label">{t("admin.detail.projects")}</div>
                  <div className="nums mt-1 text-lg font-semibold tabular-nums">{fmt.number(detail.projects.length)}</div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="mono-label">{t("admin.detail.visitors")}</div>
                  <div className="nums mt-1 text-lg font-semibold tabular-nums">{fmt.number(detail.visitorCount)}</div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="mono-label">{t("admin.th.storage")}</div>
                  <div className="nums mt-1 text-lg font-semibold">{fmt.bytes(used)}</div>
                  <MeterBar value={used} max={detail.storageCapBytes} className="mt-2" />
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="detail-cap">{t("admin.detail.capLabel")}</Label>
                  <Input
                    id="detail-cap"
                    type="number"
                    min={0}
                    value={cap}
                    onChange={(event) => onCapChange(event.target.value)}
                    className="nums w-28"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => asUser && onSetCap(asUser, Number(cap))}
                  disabled={Number.isNaN(Number(cap))}
                >
                  {t("admin.detail.capUpdate")}
                </Button>
              </div>

              <div>
                <div className="mono-label mb-2">{t("admin.detail.projects")}</div>
                <div className="scrollbar-thin max-h-56 overflow-y-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("label.name")}</TableHead>
                        <TableHead className="text-end">{t("admin.detail.th.files")}</TableHead>
                        <TableHead className="text-end">{t("label.size")}</TableHead>
                        <TableHead className="w-20">{t("label.status")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.projects.map((project) => (
                        <TableRow key={project.id}>
                          <TableCell>
                            <Link
                              href={`/dashboard/projects/${project.id}`}
                              className="ltr-content font-mono text-12.5px hover:text-signal"
                              onClick={onClose}
                            >
                              {project.name}
                            </Link>
                          </TableCell>
                          <TableCell className="nums text-end text-12px tabular-nums">{fmt.number(project.fileCount)}</TableCell>
                          <TableCell className="nums text-end text-12px tabular-nums">
                            {fmt.bytes(project.storageBytes)}
                          </TableCell>
                          <TableCell>
                            {project.isActive ? (
                              <Badge>{t("projects.badge.live")}</Badge>
                            ) : (
                              <Badge variant="destructive">{t("admin.badge.suspended")}</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {detail.projects.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-13px text-muted-foreground">
                            {t("admin.detail.noProjects")}
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
                    <UserCog className="h-3.5 w-3.5" /> {t("admin.detail.signInAs", { username: detail.username })}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onRevoke(asUser)}>
                    {t("admin.detail.signOutEverywhere")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onToggleSuspend(asUser, !detail.isSuspended)}
                  >
                    {detail.isSuspended ? t("admin.detail.resumeAccount") : t("admin.detail.suspendAccount")}
                  </Button>
                  {canManageRoles && (
                    <Select
                      value={detail.isAdmin ? "admin" : detail.isOperator ? "operator" : "member"}
                      onValueChange={(value) => onSetRole(asUser, value as "member" | "operator" | "admin")}
                    >
                      <SelectTrigger className="w-48" aria-label={t("admin.role.aria")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">{t("admin.role.memberDesc")}</SelectItem>
                        <SelectItem value="operator">{t("admin.role.operatorDesc")}</SelectItem>
                        <SelectItem value="admin">{t("admin.role.adminDesc")}</SelectItem>
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
  const { t, fmt } = useI18n();
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
        <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder={t("admin.config.filter")}
          aria-label={t("admin.config.filter")}
          className="ps-8"
        />
      </div>
      {groups.map(([group, keys]) => {
        const shown = keys.filter(visible);
        if (shown.length === 0) return null;
        return (
          <div key={group} className="panel overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-5 py-3">
              <span className="ltr-content font-mono text-12.5px font-medium">{group}</span>
              <Badge variant="outline" className="nums tabular-nums">
                {fmt.number(shown.length)}
              </Badge>
            </div>
            <div className="divide-y divide-border">
              {shown.map((key) => (
                <div key={key} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <Label htmlFor={`cfg-${key}`} className="ltr-content font-mono text-11.5px">
                      {key}
                    </Label>
                    <p className="mt-0.5 text-11px text-muted-foreground">
                      {t("admin.config.default", { value: String(defaults[key]) })}
                      {configs[key] !== undefined && (
                        <>
                          {" "}
                          {t("admin.config.currently", {
                            value: JSON.stringify(configs[key]),
                          })}
                        </>
                      )}
                    </p>
                  </div>
                  <Input
                    id={`cfg-${key}`}
                    dir="ltr"
                    className="ltr-input w-44 font-mono text-12.5px"
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
        <p className="flex items-center justify-center gap-2 py-10 text-13px text-muted-foreground">
          <TriangleAlert className="h-4 w-4 shrink-0" /> {t("admin.config.noMatch", { filter })}
        </p>
      )}
    </div>
  );
}