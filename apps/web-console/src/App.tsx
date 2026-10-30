import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, CheckCircle2 } from 'lucide-react';
import { Project, CapabilityCode, DatabaseColumn, EdgeFunction, ProjectUser } from './types';
import { Header } from './components/Header';
import { Navigation, TabId } from './components/Navigation';

// Stage 1 Hub View
import { WorkspaceHubView } from './views/WorkspaceHubView';

// Stage 2 Studio Views
import { OverviewView } from './views/OverviewView';
import { DatabaseView } from './views/DatabaseView';
import { AuthView } from './views/AuthView';
import { EdgeFunctionsView } from './views/EdgeFunctionsView';
import { StorageView } from './views/StorageView';
import { IpgView } from './views/IpgView';
import { HostingView } from './views/HostingView';
import { ComplianceView } from './views/ComplianceView';
import { TelemetryView } from './views/TelemetryView';
import { SettingsView } from './views/SettingsView';

// Modals
import { CreateProjectModal } from './components/modals/CreateProjectModal';
import { DeployFunctionModal } from './components/modals/DeployFunctionModal';
import { CreateTableModal } from './components/modals/CreateTableModal';
import { CreateBucketModal } from './components/modals/CreateBucketModal';
import { AddUserModal } from './components/modals/AddUserModal';
import { AddDomainModal } from './components/modals/AddDomainModal';
import { TopupModal } from './components/modals/TopupModal';

const DEFAULT_PROJECTS: Project[] = [];

const DEFAULT_SUB_VIEWS: Record<TabId, string> = {
  overview: 'overview',
  database: 'grid',
  auth: 'users',
  storage: 'buckets',
  functions: 'list',
  ipg: 'transactions',
  hosting: 'deployments',
  compliance: 'tokens',
  telemetry: 'live',
  settings: 'general',
};

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [projects, setProjects] = useState<Project[]>(DEFAULT_PROJECTS);
  const [currentProjectId, setCurrentProjectId] = useState<string>('');

  // Parse route:
  // Hub: '/', '/hub', '/panel', '/panel/', '/console', '/projects'
  // Studio: '/panel/:slug/:tab/:subview'
  const pathParts = location.pathname.split('/').filter(Boolean);
  const prefix = pathParts[0] || '';
  const isPrefix = prefix === 'panel' || prefix === 'console' || prefix === 'projects';
  const slugOrId = isPrefix ? pathParts[1] : (pathParts.length > 0 && prefix !== 'hub' ? pathParts[0] : null);
  const rawTab = isPrefix ? pathParts[2] : pathParts[1];
  const rawSub = isPrefix ? pathParts[3] : pathParts[2];

  const isHubStage = !slugOrId || location.pathname === '/' || location.pathname === '/hub' || location.pathname === '/panel' || location.pathname === '/console' || location.pathname === '/projects';

  const mapToTabId = (tab: string | undefined): TabId => {
    if (!tab) return 'database';
    const lower = tab.toLowerCase();
    if (lower === 'db' || lower === 'sqleditor' || lower === 'tables' || lower === 'schema' || lower === 'database') return 'database';
    if (lower === 'auth' || lower === 'users') return 'auth';
    if (lower === 'storage' || lower === 'buckets' || lower === 'files') return 'storage';
    if (lower === 'functions' || lower === 'edge') return 'functions';
    if (lower === 'ipg' || lower === 'pay' || lower === 'payments') return 'ipg';
    if (lower === 'hosting' || lower === 'domains') return 'hosting';
    if (lower === 'compliance' || lower === 'enamad') return 'compliance';
    if (lower === 'telemetry' || lower === 'logs') return 'telemetry';
    if (lower === 'settings') return 'settings';
    if (lower === 'overview') return 'overview';
    return 'database';
  };

  const activeTab: TabId = mapToTabId(rawTab);
  const [activeSubView, setActiveSubView] = useState<string>('grid');

  // Sync activeSubView with initial route
  useEffect(() => {
    if (rawSub) {
      const lower = rawSub.toLowerCase();
      if (lower === 'sqleditor' || lower === 'sql') setActiveSubView('sql');
      else if (lower === 'schema') setActiveSubView('schema');
      else if (lower === 'tables' || lower === 'grid') setActiveSubView('grid');
      else setActiveSubView(lower);
    } else if (rawTab) {
      const lower = rawTab.toLowerCase();
      if (lower === 'sqleditor' || lower === 'sql') setActiveSubView('sql');
      else if (lower === 'schema') setActiveSubView('schema');
      else if (lower === 'tables' || lower === 'grid') setActiveSubView('grid');
      else setActiveSubView(DEFAULT_SUB_VIEWS[activeTab] || 'grid');
    }
  }, [rawTab, rawSub, activeTab]);

  // Capability set for current project
  const [activeCapabilities, setActiveCapabilities] = useState<Set<CapabilityCode>>(
    new Set(['BASE', 'BAAS_DB', 'IDAAS', 'COMPUTE_EDGE', 'HOSTING_WEB', 'STORAGE_BLOB'])
  );

  // Modal open states
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isDeployFunctionOpen, setIsDeployFunctionOpen] = useState(false);
  const [isCreateTableOpen, setIsCreateTableOpen] = useState(false);
  const [isCreateBucketOpen, setIsCreateBucketOpen] = useState(false);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isAddDomainOpen, setIsAddDomainOpen] = useState(false);
  const [isTopupOpen, setIsTopupOpen] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Fetch live projects from backend API
  const fetchLiveProjects = useCallback(async () => {
    try {
      const res = await fetch('/_baas/v1/projects');
      if (res.ok) {
        const live = await res.json();
        if (Array.isArray(live)) {
          const mapped: Project[] = live.map((p: Record<string, unknown>) => ({
            id: String(p.id || p.Id || ''),
            name: String(p.name || p.Name || p.id || ''),
            slug: String(p.slug || p.Slug || p.id || ''),
            description: String(p.description || p.Description || ''),
            region: String(p.region || p.Region || 'ir-teh-1 (آسیاتک برج میلاد)'),
            status: (p.status === 'PROVISIONING' || p.status === 'MAINTENANCE' ? p.status : 'ACTIVE') as Project['status'],
            createdAt: String(p.createdAt || p.CreatedAt || new Date().toISOString()),
            walletBalanceIrr: Number(p.walletBalanceIrr ?? p.WalletBalanceIrr ?? 0),
            hasPassword: Boolean(p.hasPassword),
            services: (p.services as Project['services']) || {
              database: { isEnabled: true },
              auth: { isEnabled: true },
              storage: { isEnabled: true },
              functions: { isEnabled: true },
            },
          }));
          setProjects(mapped);
          if (mapped.length > 0 && !currentProjectId) {
            setCurrentProjectId(mapped[0].id);
          }
        }
      }
    } catch {
      // ignore
    }
  }, [currentProjectId]);

  useEffect(() => {
    fetchLiveProjects();
  }, [fetchLiveProjects]);

  // Sync URL project parameter
  useEffect(() => {
    if (slugOrId && projects.length > 0) {
      const match = projects.find(
        (p) => p.slug === slugOrId || p.id === slugOrId
      );
      if (match && match.id !== currentProjectId) {
        setCurrentProjectId(match.id);
      }
    }
  }, [slugOrId, projects, currentProjectId]);

  const currentProject =
    projects.find((p) => p.id === currentProjectId) || projects[0];

  const handleSelectProject = (proj: Project) => {
    setCurrentProjectId(proj.id);
    navigate(`/panel/${proj.slug}/${activeTab}/${activeSubView}`);
  };

  const handleTabChange = (tab: TabId, subView?: string) => {
    const defaultSub = subView || DEFAULT_SUB_VIEWS[tab] || 'overview';
    setActiveSubView(defaultSub);
    if (currentProject) {
      navigate(`/panel/${currentProject.slug}/${tab}/${defaultSub}`);
    }
  };

  const handleSubViewChange = (subView: string) => {
    setActiveSubView(subView);
    if (currentProject) {
      navigate(`/panel/${currentProject.slug}/${activeTab}/${subView}`);
    }
  };

  const handleToggleCapability = (code: CapabilityCode) => {
    setActiveCapabilities((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
        showToast(`سرویس با موفقیت غیرفعال شد.`);
      } else {
        next.add(code);
        showToast(`سرویس با موفقیت فعال گردید.`);
      }
      return next;
    });

    if (code === 'COMPUTE_EDGE') {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === currentProjectId
            ? {
                ...p,
                services: {
                  ...p.services,
                  functions: {
                    isEnabled: !p.services.functions?.isEnabled,
                  },
                },
              }
            : p
        )
      );
    }
  };

  // Real API: Create Project
  const handleCreateProject = async (data: {
    name: string;
    slug: string;
    description: string;
    region: string;
    password?: string;
  }) => {
    try {
      const res = await fetch('/_baas/v1/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          slug: data.slug,
          description: data.description,
          region: data.region,
          password: data.password || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(`خطا در ایجاد پروژه: ${err.error || res.statusText}`);
        return;
      }

      const created = await res.json();
      const newPrj: Project = {
        id: String(created.id || data.slug),
        name: String(created.name || data.name),
        slug: String(created.slug || data.slug),
        description: String(created.description || data.description),
        region: String(created.region || data.region),
        status: 'ACTIVE',
        createdAt: String(created.createdAt || new Date().toISOString()),
        walletBalanceIrr: 0,
        hasPassword: Boolean(data.password),
        services: {
          database: { isEnabled: true },
          auth: { isEnabled: true },
          storage: { isEnabled: true },
          functions: { isEnabled: true },
        },
      };

      setProjects((prev) => [newPrj, ...prev.filter((p) => p.slug !== newPrj.slug)]);
      setCurrentProjectId(newPrj.id);
      showToast(`پروژه «${data.name}» با موفقیت ایجاد گردید.`);
      navigate(`/panel/${newPrj.slug}/database/grid`);
    } catch {
      showToast('خطا در برقراری ارتباط با سرور.');
    }
  };

  // Real API: Create Table
  const handleCreateTable = async (tbl: { name: string; columns: DatabaseColumn[] }) => {
    if (!currentProject) return;
    try {
      const colsSql = tbl.columns
        .map((c) => {
          let def = `"${c.name}" ${c.dataType}`;
          if (c.isPrimaryKey) def += ' PRIMARY KEY';
          if (!c.isNullable && !c.isPrimaryKey) def += ' NOT NULL';
          if (c.defaultValue && c.defaultValue.trim()) def += ` DEFAULT ${c.defaultValue}`;
          return def;
        })
        .join(', ');
      const sql = `CREATE TABLE IF NOT EXISTS "${tbl.name}" (${colsSql});`;

      const res = await fetch(`/_baas/v1/${currentProject.slug}/sql/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql }),
      });

      if (res.ok) {
        showToast(`جدول «${tbl.name}» با موفقیت ایجاد گردید.`);
        setActiveSubView('grid');
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(`خطا در ایجاد جدول: ${err.error || res.statusText}`);
      }
    } catch {
      showToast('خطا در برقراری ارتباط با پایگاه داده.');
    }
  };

  // Real API: Create Bucket
  const handleCreateBucket = async (bkt: { name: string; isPublic: boolean }) => {
    if (!currentProject) return;
    try {
      const res = await fetch(`/_baas/v1/${currentProject.slug}/storage/buckets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: bkt.name, isPublic: bkt.isPublic }),
      });
      if (res.ok) {
        showToast(`باکت «${bkt.name}» با موفقیت ایجاد گردید.`);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(`خطا در ایجاد باکت: ${err.error || res.statusText}`);
      }
    } catch {
      showToast('خطا در ارتباط با سرویس ذخیره‌سازی.');
    }
  };

  // Real API: Deploy Function
  const handleDeployFunction = async (fn: EdgeFunction) => {
    if (!currentProject) return;
    try {
      const res = await fetch(`/_baas/v1/${currentProject.slug}/functions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fn.name,
          slug: fn.slug,
          runtime: fn.runtime || 'nodejs20',
          code: fn.script,
        }),
      });
      if (res.ok) {
        showToast(`تابع لبه «${fn.name}» با موفقیت مستقر گردید.`);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(`خطا در استقرار تابع: ${err.error || res.statusText}`);
      }
    } catch {
      showToast('خطا در ارتباط با سرور توابع.');
    }
  };

  // Real API: Add User
  const handleAddUser = async (usr: ProjectUser) => {
    if (!currentProject) return;
    try {
      const res = await fetch(`/_baas/v1/${currentProject.slug}/auth/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: usr.fullName,
          phone: usr.phone,
          email: usr.email,
          password: 'TempPassword123!',
          role: usr.role || 'user',
        }),
      });
      if (res.ok) {
        showToast(`کاربر «${usr.fullName || usr.phone}» با موفقیت ثبت شد.`);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(`خطا در ثبت کاربر: ${err.error || res.statusText}`);
      }
    } catch {
      showToast('خطا در ثبت کاربر.');
    }
  };

  // Real API: Add Domain
  const handleAddDomain = async (dom: { domain: string }) => {
    if (!currentProject) return;
    try {
      const res = await fetch(`/_baas/v1/${currentProject.slug}/hosting/domains`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: dom.domain }),
      });
      if (res.ok) {
        showToast(`دامنه «${dom.domain}» با موفقیت ثبت شد.`);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(`خطا در ثبت دامنه: ${err.error || res.statusText}`);
      }
    } catch {
      showToast('خطا در ثبت دامنه.');
    }
  };

  // Real API: Update Project
  const handleUpdateProject = async (updated: Partial<Project>) => {
    if (!currentProject) return;
    try {
      const res = await fetch(`/_baas/v1/projects/${currentProject.slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        setProjects((prev) =>
          prev.map((p) => (p.id === currentProjectId ? { ...p, ...updated } : p))
        );
        showToast('مشخصات پروژه ذخیره گردید.');
      }
    } catch {
      showToast('خطا در به‌روزرسانی پروژه.');
    }
  };

  // Real API: Delete Project
  const handleDeleteProject = async () => {
    if (projects.length <= 1) {
      showToast('خطا: حذف تنها پروژه فعال مجاز نمی‌باشد.');
      return;
    }
    if (!currentProject) return;
    if (!confirm(`آیا از حذف کامل پروژه «${currentProject.name}» اطمینان دارید؟`)) return;

    try {
      const res = await fetch(`/_baas/v1/projects/${currentProject.slug}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const remaining = projects.filter((p) => p.id !== currentProjectId);
        setProjects(remaining);
        setCurrentProjectId(remaining[0].id);
        navigate('/panel');
        showToast('پروژه با موفقیت حذف گردید.');
      }
    } catch {
      showToast('خطا در حذف پروژه.');
    }
  };

  // Real API: Topup Wallet
  const handleTopup = async (amountIrr: number, gateway: string) => {
    try {
      const res = await fetch('/_baas/v1/users/usr_developer_03/credit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deltaIrr: amountIrr }),
      });
      if (res.ok) {
        setProjects((prev) =>
          prev.map((p) =>
            p.id === currentProjectId
              ? { ...p, walletBalanceIrr: p.walletBalanceIrr + amountIrr }
              : p
          )
        );
        showToast(
          `پرداخت موفق از طریق ${gateway}. مبلغ ${(amountIrr / 10).toLocaleString('fa-IR')} تومان به کیف پول افزوده شد.`
        );
      }
    } catch {
      showToast('خطا در افزایش اعتبار کیف پول.');
    }
  };

  const isEdgeFunctionsEnabled = activeCapabilities.has('COMPUTE_EDGE');

  return (
    <div className="h-screen flex flex-col bg-white text-surface-900 font-sans selection:bg-brand-500/20 selection:text-brand-600 overflow-hidden" dir="rtl">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 shadow-xl text-white text-xs font-medium flex items-center gap-2 animate-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Global Header */}
      <Header
        currentProject={currentProject}
        allProjects={projects}
        onSelectProject={handleSelectProject}
        onOpenCreateModal={() => setIsCreateProjectOpen(true)}
        onOpenTopupModal={() => setIsTopupOpen(true)}
      />

      {/* STAGE 1: USER WORKSPACE HUB */}
      {isHubStage ? (
        <main className="flex-1 h-[calc(100vh-3.5rem)] overflow-y-auto bg-white">
          <WorkspaceHubView
            projects={projects}
            onOpenCreateProjectModal={() => setIsCreateProjectOpen(true)}
            onSelectProject={handleSelectProject}
          />
        </main>
      ) : (
        /* STAGE 2: PROJECT SERVICE STUDIO WITH TWO-LEVEL SIDEBAR */
        <div className="flex flex-1 h-[calc(100vh-3.5rem)] overflow-hidden">
          {/* Supabase Two-Level Sidebar Navigation */}
          <Navigation
            activeTab={activeTab}
            onTabChange={handleTabChange}
            activeSubView={activeSubView}
            onSubViewChange={handleSubViewChange}
            edgeFunctionsEnabled={isEdgeFunctionsEnabled}
            project={currentProject}
            onNavigateHome={() => navigate('/panel')}
          />

          {/* Main Service Viewport */}
          <main
            className="flex-1 h-full overflow-y-auto p-6 md:p-8 bg-white"
            role="tabpanel"
            id={`panel-${activeTab}`}
            aria-labelledby={`tab-${activeTab}`}
          >
            {!currentProject ? (
              <div className="text-center py-20 px-4 rounded-2xl bg-white border border-slate-200 max-w-lg mx-auto shadow-xs">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4 text-emerald-600">
                  <Plus className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">هیچ پروژه‌ای یافت نشد</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mb-5 leading-relaxed">
                  جهت آغاز به کار و دسترسی به پایگاه‌داده، احراز هویت و توابع، نخستین پروژه خود را راه‌اندازی نمایید.
                </p>
                <button
                  onClick={() => setIsCreateProjectOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-4 py-2 transition shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>ساخت اولین پروژه</span>
                </button>
              </div>
            ) : (
              <>
                {activeTab === 'database' && (
                  <DatabaseView
                    project={currentProject}
                    onOpenCreateTableModal={() => setIsCreateTableOpen(true)}
                    activeSubView={activeSubView}
                    onSubViewChange={handleSubViewChange}
                  />
                )}

                {activeTab === 'overview' && (
                  <OverviewView
                    project={currentProject}
                    activeCapabilities={activeCapabilities}
                    onToggleCapability={handleToggleCapability}
                    onNavigateTab={handleTabChange}
                    onDeployBuild={() => setIsDeployFunctionOpen(true)}
                  />
                )}

                {activeTab === 'auth' && (
                  <AuthView
                    project={currentProject}
                    onOpenAddUserModal={() => setIsAddUserOpen(true)}
                    activeSubView={activeSubView}
                    onSubViewChange={handleSubViewChange}
                  />
                )}

                {activeTab === 'functions' && (
                  <EdgeFunctionsView
                    project={currentProject}
                    enabled={isEdgeFunctionsEnabled}
                    onToggleEnable={() => handleToggleCapability('COMPUTE_EDGE')}
                    onOpenDeployModal={() => setIsDeployFunctionOpen(true)}
                    activeSubView={activeSubView}
                    onSubViewChange={handleSubViewChange}
                  />
                )}

                {activeTab === 'storage' && (
                  <StorageView
                    project={currentProject}
                    onOpenCreateBucketModal={() => setIsCreateBucketOpen(true)}
                    activeSubView={activeSubView}
                    onSubViewChange={handleSubViewChange}
                  />
                )}

                {activeTab === 'ipg' && (
                  <IpgView
                    project={currentProject}
                    activeSubView={activeSubView}
                    onSubViewChange={handleSubViewChange}
                  />
                )}

                {activeTab === 'hosting' && (
                  <HostingView
                    project={currentProject}
                    onOpenDeployModal={() => setIsDeployFunctionOpen(true)}
                    onOpenAddDomainModal={() => setIsAddDomainOpen(true)}
                    activeSubView={activeSubView}
                    onSubViewChange={handleSubViewChange}
                  />
                )}

                {activeTab === 'compliance' && (
                  <ComplianceView
                    project={currentProject}
                    activeSubView={activeSubView}
                    onSubViewChange={handleSubViewChange}
                  />
                )}

                {activeTab === 'telemetry' && (
                  <TelemetryView
                    project={currentProject}
                    activeSubView={activeSubView}
                    onSubViewChange={handleSubViewChange}
                  />
                )}

                {activeTab === 'settings' && (
                  <SettingsView
                    project={currentProject}
                    onUpdateProject={handleUpdateProject}
                    onDeleteProject={handleDeleteProject}
                    activeSubView={activeSubView}
                    onSubViewChange={handleSubViewChange}
                  />
                )}
              </>
            )}
          </main>
        </div>
      )}

      {/* Global Modals */}
      <CreateProjectModal
        isOpen={isCreateProjectOpen}
        onClose={() => setIsCreateProjectOpen(false)}
        onCreate={handleCreateProject}
      />

      <DeployFunctionModal
        isOpen={isDeployFunctionOpen}
        onClose={() => setIsDeployFunctionOpen(false)}
        onDeploy={handleDeployFunction}
      />

      <CreateTableModal
        isOpen={isCreateTableOpen}
        onClose={() => setIsCreateTableOpen(false)}
        onCreate={handleCreateTable}
      />

      <CreateBucketModal
        isOpen={isCreateBucketOpen}
        onClose={() => setIsCreateBucketOpen(false)}
        onCreate={handleCreateBucket}
      />

      <AddUserModal
        isOpen={isAddUserOpen}
        onClose={() => setIsAddUserOpen(false)}
        onAdd={handleAddUser}
      />

      <AddDomainModal
        isOpen={isAddDomainOpen}
        onClose={() => setIsAddDomainOpen(false)}
        onAdd={handleAddDomain}
      />

      <TopupModal
        isOpen={isTopupOpen}
        onClose={() => setIsTopupOpen(false)}
        onTopup={handleTopup}
      />
    </div>
  );
}
