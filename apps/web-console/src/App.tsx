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

const DEFAULT_PROJECTS: Project[] = [
  {
    id: 'prj-digikala-stage',
    name: 'دیجی‌کالا آزمایشی (Digikala)',
    slug: 'digikala-stage',
    description: 'سرویس توزیع‌شده با پایگاه داده رابطه‌ای PostgreSQL 18، ترافیک برون‌مرزی پایدار و احراز هویت پیامکی.',
    region: 'ir-teh-1 (آسیاتک برج میلاد)',
    status: 'ACTIVE',
    createdAt: '2026-10-25T12:00:00Z',
    walletBalanceIrr: 540000000,
    hasPassword: true,
    services: {
      database: { isEnabled: true },
      auth: { isEnabled: true },
      storage: { isEnabled: true },
      functions: { isEnabled: true },
    },
  },
  {
    id: 'prj-shaparak-gateway',
    name: 'سامانه پرداخت شاپرک',
    slug: 'shaparak-gateway',
    description: 'درگاه متمرکز پرداخت الکترونیک شتاب و شاپرک با رعایت الزامات شاپرک و رصد تراکنش‌ها.',
    region: 'ir-teh-2 (زیرساخت امام)',
    status: 'ACTIVE',
    createdAt: '2026-10-26T14:30:00Z',
    walletBalanceIrr: 1200000000,
    hasPassword: true,
    services: {
      database: { isEnabled: true },
      auth: { isEnabled: true },
      storage: { isEnabled: false },
      functions: { isEnabled: true },
    },
  },
];

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem('localme_projects');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_PROJECTS;
  });

  const [currentProjectId, setCurrentProjectId] = useState<string>(
    projects[0]?.id || ''
  );

  // Parse route: either Stage 1 ('/' or '/hub') or Stage 2 ('/projects/:slug/:tab')
  const isHubStage = location.pathname === '/' || location.pathname === '/hub';
  const pathParts = location.pathname.split('/').filter(Boolean);

  let activeTab: TabId = 'database';
  if (pathParts[0] === 'projects' && pathParts[2]) {
    activeTab = pathParts[2] as TabId;
  }

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
    if (pathParts[0] === 'projects' && pathParts[1]) {
      const match = projects.find((p) => p.slug === pathParts[1]);
      if (match && match.id !== currentProjectId) {
        setCurrentProjectId(match.id);
      }
    }
  }, [location.pathname, projects, currentProjectId, pathParts]);

  const currentProject =
    projects.find((p) => p.id === currentProjectId) || projects[0];

  const handleSelectProject = (proj: Project) => {
    setCurrentProjectId(proj.id);
    navigate(`/projects/${proj.slug}/${activeTab}`);
  };

  const handleTabChange = (tab: TabId) => {
    if (currentProject) {
      navigate(`/projects/${currentProject.slug}/${tab}`);
    }
  };

  const handleToggleCapability = (code: CapabilityCode) => {
    setActiveCapabilities((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
        showToast(`قابلیت ${code} با موفقیت غیرفعال شد.`);
      } else {
        next.add(code);
        showToast(`قابلیت ${code} فعال و ماتریس وابستگی DAG بازآرایی شد.`);
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
      walletBalanceIrr: 100000000,
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
    navigate(`/projects/${newPrj.slug}/database`);
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
    <div className="min-h-screen bg-[#0f0f0f] text-[#ededed] flex flex-col font-sans antialiased selection:bg-[#3ECF8E]/20 selection:text-[#3ECF8E]">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-full bg-[#171717] border border-[#3ECF8E]/40 shadow-2xl text-[#3ECF8E] text-xs font-medium flex items-center gap-2 animate-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-[#3ECF8E]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Global Sovereign Header */}
      <Header
        currentProject={currentProject}
        allProjects={projects}
        onSelectProject={handleSelectProject}
        onOpenCreateModal={() => setIsCreateProjectOpen(true)}
        onOpenTopupModal={() => setIsTopupOpen(true)}
      />

      {/* STAGE 1: USER WORKSPACE HUB */}
      {isHubStage ? (
        <main className="flex-1">
          <WorkspaceHubView
            projects={projects}
            onOpenCreateProjectModal={() => setIsCreateProjectOpen(true)}
            onSelectProject={handleSelectProject}
          />
        </main>
      ) : (
        /* STAGE 2: PROJECT SERVICE STUDIO */
        <>
          {/* Project Studio Navigation Tabs */}
          <Navigation
            activeTab={activeTab}
            onTabChange={handleTabChange}
            edgeFunctionsEnabled={isEdgeFunctionsEnabled}
          />

          {/* Main Service Viewport */}
          <main
            className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8"
            role="tabpanel"
            id={`panel-${activeTab}`}
            aria-labelledby={`tab-${activeTab}`}
          >
            {!currentProject ? (
              <div className="text-center py-20 px-4 rounded-3xl bg-[#171717] border border-[#242424] max-w-lg mx-auto">
                <div className="w-16 h-16 rounded-2xl bg-[#0f0f0f] border border-[#242424] flex items-center justify-center mx-auto mb-4 text-[#3ECF8E]">
                  <Plus className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-white mb-2">هیچ پروژه‌ای تعریف نشده است</h3>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto mb-6 leading-relaxed">
                  جهت آغاز به کار در زیرساخت ابری لوکال‌می و دسترسی به پایگاه‌داده، احراز هویت و توابع، نخستین پروژه خود را راه‌اندازی نمایید.
                </p>
                <button
                  onClick={() => setIsCreateProjectOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#3ECF8E] hover:bg-[#34b27b] text-[#0f0f0f] font-medium text-xs px-5 py-2.5 transition-colors"
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
        </>
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
          showToast(`تابع لبه «${fn.name}» با موفقیت در هسته Jint مستقر گردید.`);
        }}
      />

      <CreateTableModal
        isOpen={isCreateTableOpen}
        onClose={() => setIsCreateTableOpen(false)}
        onCreate={(tbl) => {
          showToast(`جدول «${tbl.name}» در طرحواره PostgreSQL 18 ایجاد گردید.`);
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
          showToast(`کاربر «${usr.fullName}» در سامانه IDaaS ثبت گردید.`);
        }}
      />

      <AddDomainModal
        isOpen={isAddDomainOpen}
        onClose={() => setIsAddDomainOpen(false)}
        onAdd={(dom) => {
          showToast(`دامنه «${dom.domain}» ثبت شد. در حال صدور گواهی Let's Encrypt...`);
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
