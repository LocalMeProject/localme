import { useState } from 'react';
import { Project, CapabilityCode } from './types';
import { Header } from './components/Header';
import { Navigation, TabId } from './components/Navigation';

// Views
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

const INITIAL_PROJECTS: Project[] = [
  {
    id: 'prj-101',
    name: 'دیجی‌کالا کلون',
    slug: 'digikala-clone',
    description: 'فروشگاه اینترنتی با پرداخت مستقیم شاپرک و احراز هویت پیامکی',
    region: 'ir-teh-1 (آسیاتک)',
    status: 'ACTIVE',
    createdAt: '۱۴۰۳/۰۶/۱۵',
    walletBalanceIrr: 450_000_000, // 45,000,000 Tomans
    hasPassword: true,
    services: {
      database: { isEnabled: true },
      auth: { isEnabled: true },
      storage: { isEnabled: true },
      functions: { isEnabled: true },
    },
  },
  {
    id: 'prj-102',
    name: 'اسنپ تریپ اپ',
    slug: 'snapp-trip',
    description: 'سامانه رزرو بلیت و هتل بر بستر شبکه ملی اطلاعات',
    region: 'ir-teh-2 (زیرساخت)',
    status: 'ACTIVE',
    createdAt: '۱۴۰۳/۰۷/۰۱',
    walletBalanceIrr: 1_200_000_000,
    hasPassword: false,
    services: {
      database: { isEnabled: true },
      auth: { isEnabled: true },
      storage: { isEnabled: false },
      functions: { isEnabled: false },
    },
  },
];

export default function App() {
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [currentProjectId, setCurrentProjectId] = useState<string>('prj-101');
  const [activeTab, setActiveTab] = useState<TabId>('overview');

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

  const currentProject =
    projects.find((p) => p.id === currentProjectId) || projects[0];

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
      createdAt: 'همین الان',
      walletBalanceIrr: 100_000_000, // Initial promotional credit 10,000,000 IRR
      hasPassword: Boolean(data.password),
      services: {
        database: { isEnabled: true },
        auth: { isEnabled: true },
        storage: { isEnabled: false },
        functions: { isEnabled: true },
      },
    };
    setProjects((prev) => [newPrj, ...prev]);
    setCurrentProjectId(newPrj.id);
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-amber-500/20 selection:text-amber-300 font-sans antialiased">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl bg-zinc-900 border border-amber-500/50 shadow-2xl text-amber-300 text-xs font-medium flex items-center space-x-2 animate-in slide-in-from-bottom-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Sovereign Header */}
      <Header
        currentProject={currentProject}
        allProjects={projects}
        onSelectProject={(p) => setCurrentProjectId(p.id)}
        onOpenCreateModal={() => setIsCreateProjectOpen(true)}
        onOpenTopupModal={() => setIsTopupOpen(true)}
      />

      {/* Navigation Tabs */}
      <Navigation
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        edgeFunctionsEnabled={isEdgeFunctionsEnabled}
      />

      {/* Main Workspace Body */}
      <main
        className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8"
        role="tabpanel"
        id={`panel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
      >
        {activeTab === 'overview' && (
          <OverviewView
            project={currentProject}
            activeCapabilities={activeCapabilities}
            onToggleCapability={handleToggleCapability}
            onNavigateTab={setActiveTab}
            onDeployBuild={() => setIsDeployFunctionOpen(true)}
          />
        )}

        {activeTab === 'database' && (
          <DatabaseView
            project={currentProject}
            onOpenCreateTableModal={() => setIsCreateTableOpen(true)}
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
      </main>

      {/* Modals */}
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
