import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, CheckCircle2 } from 'lucide-react';
import { Project, CapabilityCode } from './types';
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

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem('localme_projects');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Filter out any legacy demo projects
          const nonDemo = parsed.filter(
            (p: Project) => p.slug !== 'digikala-stage' && p.slug !== 'shaparak-gateway'
          );
          if (nonDemo.length > 0) return nonDemo;
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_PROJECTS;
  });

  const [currentProjectId, setCurrentProjectId] = useState<string>(
    projects[0]?.id || ''
  );

  // Parse route:
  // Stage 1 Hub: '/', '/hub', '/panel', '/panel/', '/console', '/console/'
  // Stage 2 Studio: '/panel/:slugOrId/:tab', '/console/:slugOrId/:tab', '/projects/:slugOrId/:tab'
  const pathParts = location.pathname.split('/').filter(Boolean);
  const prefix = pathParts[0] || '';
  const isPrefix = prefix === 'panel' || prefix === 'console' || prefix === 'projects';
  const slugOrId = isPrefix ? pathParts[1] : (pathParts.length > 0 && prefix !== 'hub' ? pathParts[0] : null);
  const rawTab = isPrefix ? pathParts[2] : pathParts[1];

  const isHubStage = !slugOrId || location.pathname === '/' || location.pathname === '/hub' || location.pathname === '/panel' || location.pathname === '/console';

  const mapToTabId = (tab: string | undefined): TabId => {
    if (!tab) return 'database';
    const lower = tab.toLowerCase();
    if (lower === 'db' || lower === 'sqleditor' || lower === 'tables' || lower === 'schema') return 'database';
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

  // Sync activeSubView with initial route if explicit
  useEffect(() => {
    if (rawTab) {
      const lower = rawTab.toLowerCase();
      if (lower === 'sqleditor' || lower === 'sql') setActiveSubView('sql');
      else if (lower === 'schema') setActiveSubView('schema');
      else if (lower === 'tables' || lower === 'grid') setActiveSubView('grid');
    }
  }, [rawTab]);

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
  useEffect(() => {
    const fetchLiveProjects = async () => {
      try {
        const res = await fetch('/_baas/v1/projects');
        if (res.ok) {
          const live = await res.json();
          if (Array.isArray(live)) {
            const mapped = live.map((p: Record<string, unknown>) => ({
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
              }
            }));
            setProjects(mapped);
          }
        }
      } catch {
        // fallback
      }
    };
    fetchLiveProjects();
  }, []);

  // Keep localStorage in sync
  useEffect(() => {
    try {
      localStorage.setItem('localme_projects', JSON.stringify(projects));
    } catch {
      // ignore
    }
  }, [projects]);

  // Synchronize route with currentProjectId
  useEffect(() => {
    if (slugOrId) {
      const match = projects.find((p) => p.slug === slugOrId || p.id === slugOrId);
      if (match) {
        if (match.id !== currentProjectId) {
          setCurrentProjectId(match.id);
        }
      } else {
        const provisional: Project = {
          id: slugOrId,
          slug: slugOrId,
          name: slugOrId,
          description: `پروژه ${slugOrId}`,
          region: 'ir-teh-1 (آسیاتک برج میلاد)',
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
          walletBalanceIrr: 0,
          hasPassword: false,
          services: {
            database: { isEnabled: true },
            auth: { isEnabled: true },
            storage: { isEnabled: true },
            functions: { isEnabled: true },
          }
        };
        setProjects((prev) => [provisional, ...prev]);
        setCurrentProjectId(slugOrId);
      }
    }
  }, [slugOrId, projects, currentProjectId]);

  const currentProject =
    projects.find((p) => p.id === currentProjectId) || projects[0];

  const handleSelectProject = (proj: Project) => {
    setCurrentProjectId(proj.id);
    navigate(`/panel/${proj.slug}/${activeTab}`);
  };

  const handleTabChange = (tab: TabId) => {
    if (currentProject) {
      navigate(`/panel/${currentProject.slug}/${tab}`);
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

  const handleCreateProject = (data: {
    name: string;
    slug: string;
    description: string;
    region: string;
    password?: string;
  }) => {
    const newPrj: Project = {
      id: `prj-${Date.now()}`,
      name: data.name,
      slug: data.slug,
      description: data.description,
      region: data.region,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      walletBalanceIrr: 0,
      hasPassword: Boolean(data.password),
      services: {
        database: { isEnabled: true },
        auth: { isEnabled: true },
        storage: { isEnabled: true },
        functions: { isEnabled: true },
      },
    };
    setProjects((prev) => [newPrj, ...prev]);
    setCurrentProjectId(newPrj.id);
    navigate(`/panel/${newPrj.slug}/database`);
    showToast(`پروژه «${data.name}» با موفقیت راه‌اندازی گردید.`);
  };

  const handleUpdateProject = (updated: Partial<Project>) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === currentProjectId ? { ...p, ...updated } : p))
    );
    showToast('تنظیمات پروژه با موفقیت ذخیره گردید.');
  };

  const handleDeleteProject = () => {
    if (projects.length <= 1) {
      showToast('خطا: حذف تنها پروژه فعال مجاز نمی‌باشد.');
      return;
    }
    const remaining = projects.filter((p) => p.id !== currentProjectId);
    setProjects(remaining);
    setCurrentProjectId(remaining[0].id);
    navigate('/');
    showToast('پروژه با موفقیت حذف گردید.');
  };

  const handleTopup = (amountIrr: number, gateway: string) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === currentProjectId
          ? { ...p, walletBalanceIrr: p.walletBalanceIrr + amountIrr }
          : p
      )
    );
    showToast(
      `پرداخت موفق از طریق درگاه ${gateway}. مبلغ ${(amountIrr / 10).toLocaleString('fa-IR')} تومان به کیف پول افزوده شد.`
    );
  };

  const isEdgeFunctionsEnabled = activeCapabilities.has('COMPUTE_EDGE');

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-50 text-slate-800 flex flex-col font-sans select-none" dir="rtl">
      {/* Toast Notification Banner */}
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
        <main className="flex-1 overflow-y-auto">
          <WorkspaceHubView
            projects={projects}
            onOpenCreateProjectModal={() => setIsCreateProjectOpen(true)}
            onSelectProject={handleSelectProject}
          />
        </main>
      ) : (
        /* STAGE 2: PROJECT SERVICE STUDIO WITH TWO-LEVEL SIDEBAR */
        <div className="flex flex-1 overflow-hidden">
          {/* Supabase Two-Level Sidebar Navigation */}
          <Navigation
            activeTab={activeTab}
            onTabChange={handleTabChange}
            activeSubView={activeSubView}
            onSubViewChange={setActiveSubView}
            edgeFunctionsEnabled={isEdgeFunctionsEnabled}
            project={currentProject}
            onNavigateHome={() => navigate('/')}
          />

          {/* Main Service Viewport */}
          <main
            className="flex-1 overflow-y-auto p-6 md:p-8"
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
                  />
                )}

                {activeTab === 'functions' && (
                  <EdgeFunctionsView
                    project={currentProject}
                    enabled={isEdgeFunctionsEnabled}
                    onToggleEnable={() => handleToggleCapability('COMPUTE_EDGE')}
                    onOpenDeployModal={() => setIsDeployFunctionOpen(true)}
                  />
                )}

                {activeTab === 'storage' && (
                  <StorageView
                    project={currentProject}
                    onOpenCreateBucketModal={() => setIsCreateBucketOpen(true)}
                  />
                )}

                {activeTab === 'ipg' && <IpgView project={currentProject} />}

                {activeTab === 'hosting' && (
                  <HostingView
                    project={currentProject}
                    onOpenDeployModal={() => setIsDeployFunctionOpen(true)}
                    onOpenAddDomainModal={() => setIsAddDomainOpen(true)}
                  />
                )}

                {activeTab === 'compliance' && <ComplianceView project={currentProject} />}

                {activeTab === 'telemetry' && <TelemetryView project={currentProject} />}

                {activeTab === 'settings' && (
                  <SettingsView
                    project={currentProject}
                    onUpdateProject={handleUpdateProject}
                    onDeleteProject={handleDeleteProject}
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
        onDeploy={(fn) => {
          showToast(`تابع لبه «${fn.name}» با موفقیت مستقر گردید.`);
        }}
      />

      <CreateTableModal
        isOpen={isCreateTableOpen}
        onClose={() => setIsCreateTableOpen(false)}
        onCreate={(tbl) => {
          showToast(`جدول «${tbl.name}» با موفقیت ایجاد گردید.`);
        }}
      />

      <CreateBucketModal
        isOpen={isCreateBucketOpen}
        onClose={() => setIsCreateBucketOpen(false)}
        onCreate={(bkt) => {
          showToast(`باکت «${bkt.name}» با موفقیت ایجاد گردید.`);
        }}
      />

      <AddUserModal
        isOpen={isAddUserOpen}
        onClose={() => setIsAddUserOpen(false)}
        onAdd={(usr) => {
          showToast(`کاربر «${usr.fullName}» با موفقیت ثبت گردید.`);
        }}
      />

      <AddDomainModal
        isOpen={isAddDomainOpen}
        onClose={() => setIsAddDomainOpen(false)}
        onAdd={(dom) => {
          showToast(`دامنه «${dom.domain}» با موفقیت ثبت شد.`);
        }}
      />

      <TopupModal
        isOpen={isTopupOpen}
        onClose={() => setIsTopupOpen(false)}
        onTopup={handleTopup}
      />
    </div>
  );
}
