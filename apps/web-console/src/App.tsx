import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, CheckCircle2 } from 'lucide-react';
import { Project, DatabaseColumn, EdgeFunction, ProjectUser } from './types';
import { Header } from './components/Header';
import { Navigation, TabId } from './components/Navigation';

// Stage 1 Hub View
import { WorkspaceHubView } from './views/WorkspaceHubView';

// Stage 2 Studio Views
import { OverviewView } from './views/OverviewView';
import { DatabaseView } from './views/DatabaseView';
import { AuthView } from './views/AuthView';
import { EdgeFunctionsView } from './views/EdgeFunctionsView';
import { TelemetryView } from './views/TelemetryView';
import { SettingsView } from './views/SettingsView';
import { ErrorBoundary } from './components/ErrorBoundary';

// Auth & Admin Views
import { LoginView } from './views/auth/LoginView';
import { RegisterView } from './views/auth/RegisterView';
import { ResetPasswordView } from './views/auth/ResetPasswordView';
import { AdminLayout, AdminTab } from './views/admin/AdminLayout';
import { ClusterShardsView } from './views/admin/ClusterShardsView';
import { DatabaseActivityView } from './views/admin/DatabaseActivityView';
import { TenantOversightView } from './views/admin/TenantOversightView';
import { TelemetryHealthView } from './views/admin/TelemetryHealthView';
import { UsersPermissionsView } from './views/admin/UsersPermissionsView';
import { AdminLogsView } from './views/admin/AdminLogsView';
import { PricingQuotasView } from './views/admin/PricingQuotasView';
import { AdminSqlStudioView } from './views/admin/AdminSqlStudioView';

// Modals
import { CreateProjectModal } from './components/modals/CreateProjectModal';
import { DeployFunctionModal } from './components/modals/DeployFunctionModal';
import { CreateTableModal } from './components/modals/CreateTableModal';
import { AddUserModal } from './components/modals/AddUserModal';
import { ConfirmModal } from './components/modals/ConfirmModal';

const DEFAULT_PROJECTS: Project[] = [];

const DEFAULT_SUB_VIEWS: Record<TabId, string> = {
  overview: 'overview',
  database: 'dashboard',
  auth: 'users',
  functions: 'list',
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
    if (lower === 'functions' || lower === 'edge') return 'functions';
    if (lower === 'telemetry' || lower === 'logs') return 'telemetry';
    if (lower === 'settings') return 'settings';
    if (lower === 'overview') return 'overview';
    return 'database';
  };

  const activeTab: TabId = mapToTabId(rawTab);
  const [activeSubView, setActiveSubView] = useState<string>('dashboard');

  // Sync activeSubView with initial route
  useEffect(() => {
    if (rawSub) {
      const lower = rawSub.toLowerCase();
      if (lower === 'sqleditor' || lower === 'sql') setActiveSubView('sql');
      else if (lower === 'schema') setActiveSubView('schema');
      else if (lower === 'tables' || lower === 'grid') setActiveSubView('grid');
      else if (lower === 'dashboard') setActiveSubView('dashboard');
      else setActiveSubView(lower);
    } else if (rawTab) {
      const lower = rawTab.toLowerCase();
      if (lower === 'sqleditor' || lower === 'sql') setActiveSubView('sql');
      else if (lower === 'schema') setActiveSubView('schema');
      else if (lower === 'tables' || lower === 'grid') setActiveSubView('grid');
      else setActiveSubView(DEFAULT_SUB_VIEWS[activeTab] || 'dashboard');
    }
  }, [rawTab, rawSub, activeTab]);



  // Modal open states
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isDeployFunctionOpen, setIsDeployFunctionOpen] = useState(false);
  const [isCreateTableOpen, setIsCreateTableOpen] = useState(false);
  const [lastCreatedTable, setLastCreatedTable] = useState<string | null>(null);
  const [tableRefreshTrigger, setTableRefreshTrigger] = useState(0);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isConfirmDeleteProjectOpen, setIsConfirmDeleteProjectOpen] = useState(false);

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
    const currentPath = location.pathname.toLowerCase();
    if (currentPath === '/login' || currentPath === '/register' || currentPath === '/reset-password' || currentPath.startsWith('/auth')) {
      return;
    }

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('localme_token') : null;
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch('/_baas/v1/projects', {
        headers,
        credentials: 'include',
      });
      if (res.status === 401) {
        // Redirection is handled gracefully by AuthGuard; never trigger full browser reload
        return;
      }
      if (res.ok) {
        const live = await res.json();
        if (Array.isArray(live)) {
          const mapped: Project[] = live.map((p: Record<string, unknown>) => ({
            id: String(p.id || p.Id || ''),
            name: String(p.name || p.Name || p.id || ''),
            slug: String(p.slug || p.Slug || p.id || ''),
            description: String(p.description || p.Description || ''),
            region: String(p.region || p.Region || 'ir-teh-1 (دیتاسنتر مرکزی)'),
            status: (p.status === 'PROVISIONING' || p.status === 'MAINTENANCE' ? p.status : 'ACTIVE') as Project['status'],
            createdAt: String(p.createdAt || p.CreatedAt || new Date().toISOString()),
            hasPassword: Boolean(p.hasPassword),
            services: (p.services as Project['services']) || {
              database: { isEnabled: true },
              auth: { isEnabled: true },
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
  }, [currentProjectId, location.pathname]);

  useEffect(() => {
    const currentPath = location.pathname.toLowerCase();
    if (currentPath === '/login' || currentPath === '/register' || currentPath === '/reset-password' || currentPath.startsWith('/auth')) {
      return;
    }
    fetchLiveProjects();
  }, [fetchLiveProjects, location.pathname]);

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
        hasPassword: Boolean(data.password),
        services: {
          database: { isEnabled: true },
          auth: { isEnabled: true },
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
      const res = await fetch(`/_baas/v1/${currentProject.slug}/db/tables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tbl.name, columns: tbl.columns }),
      });

      if (res.ok) {
        showToast(`جدول «${tbl.name}» با موفقیت ایجاد گردید.`);
        setIsCreateTableOpen(false);
        setLastCreatedTable(tbl.name);
        setTableRefreshTrigger(Date.now());
        const targetSubView = activeSubView === 'schema' ? 'schema' : 'grid';
        navigate(`/panel/${currentProject.slug}/database/${targetSubView}`);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(`خطا در ایجاد جدول: ${err.error || res.statusText}`);
      }
    } catch {
      showToast('خطا در برقراری ارتباط با پایگاه داده.');
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
          email: usr.email,
          username: usr.username,
          phone: usr.phone,
          password: usr.password || 'TempPassword123!',
          role: usr.role || 'user',
        }),
      });
      if (res.ok) {
        showToast(`کاربر «${usr.fullName || usr.email}» با موفقیت ثبت شد.`);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(`خطا در ثبت کاربر: ${err.error || res.statusText}`);
      }
    } catch {
      showToast('خطا در ثبت کاربر.');
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
  const handleDeleteProject = () => {
    if (projects.length <= 1) {
      showToast('خطا: حذف تنها پروژه فعال مجاز نمی‌باشد.');
      return;
    }
    if (!currentProject) return;
    setIsConfirmDeleteProjectOpen(true);
  };

  const executeDeleteProject = async () => {
    setIsConfirmDeleteProjectOpen(false);
    if (!currentProject) return;

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



  const normalizedPath = location.pathname.toLowerCase();
  const isAdminRoute = normalizedPath === '/admin' || normalizedPath.startsWith('/admin/');

  // Auth Routing (Self-Service Registration, Password Recovery, and Login)
  if (normalizedPath === '/register' || normalizedPath === '/auth/register') {
    return <RegisterView />;
  }
  if (normalizedPath === '/reset-password' || normalizedPath === '/auth/reset-password') {
    return <ResetPasswordView />;
  }
  if (normalizedPath === '/login' || normalizedPath.startsWith('/auth')) {
    return <LoginView />;
  }

  // Admin Routing
  if (isAdminRoute) {
    const adminTabMatch = normalizedPath.match(/^\/admin\/([a-z0-9_-]+)/);
    const rawAdminTab = (adminTabMatch ? adminTabMatch[1] : 'shards') as AdminTab;
    const validAdminTabs: AdminTab[] = ['shards', 'activity', 'query', 'tenants', 'telemetry', 'users', 'logs', 'pricing'];
    const activeAdminTab: AdminTab = validAdminTabs.includes(rawAdminTab) ? rawAdminTab : 'shards';

    return (
      <ErrorBoundary>
        <AdminLayout currentTab={activeAdminTab} onTabChange={(t) => navigate(`/admin/${t}`)}>
          {activeAdminTab === 'shards' && <ClusterShardsView />}
          {activeAdminTab === 'activity' && <DatabaseActivityView />}
          {activeAdminTab === 'query' && <AdminSqlStudioView />}
          {activeAdminTab === 'tenants' && <TenantOversightView />}
          {activeAdminTab === 'telemetry' && <TelemetryHealthView />}
          {activeAdminTab === 'users' && <UsersPermissionsView />}
          {activeAdminTab === 'logs' && <AdminLogsView />}
          {activeAdminTab === 'pricing' && <PricingQuotasView />}
        </AdminLayout>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
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
                    lastCreatedTable={lastCreatedTable}
                    tableRefreshTrigger={tableRefreshTrigger}
                  />
                )}

                {activeTab === 'overview' && (
                  <OverviewView
                    project={currentProject}
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
                    onOpenDeployModal={() => setIsDeployFunctionOpen(true)}
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

      <AddUserModal
        isOpen={isAddUserOpen}
        onClose={() => setIsAddUserOpen(false)}
        onAdd={handleAddUser}
      />

      {/* Accessible Confirm Modal for Project Deletion */}
      <ConfirmModal
        isOpen={isConfirmDeleteProjectOpen}
        title="حذف کامل پروژه"
        message={`آیا از حذف کامل پروژه «${currentProject?.name}» اطمینان دارید؟ تمامی داده‌ها، اسکیماها، فایل‌ها و توابع این پروژه برای همیشه نابود خواهند شد.`}
        confirmLabel="حذف دائم پروژه"
        isDanger={true}
        requiredConfirmationText={currentProject?.slug}
        onConfirm={executeDeleteProject}
        onCancel={() => setIsConfirmDeleteProjectOpen(false)}
      />
    </div>
    </ErrorBoundary>
  );
}
