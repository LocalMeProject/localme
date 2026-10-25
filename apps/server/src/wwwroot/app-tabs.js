// =====================================================================
// LocalMe BaaS Console - Keep-Alive Tabs, Breadcrumbs & Routing Engine
// =====================================================================

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
if (!window.escapeHtml) window.escapeHtml = escapeHtml;

// Gated Service Mappings & Helpers
const MODULE_TO_SERVICE = {
  'db': 'database',
  'auth': 'auth',
  'storage': 'storage',
  'functions': 'functions',
  'ipg': 'ipg',
  'mobile': 'mobile',
  'hosting': 'hosting',
  'compliance': 'compliance'
};
window.MODULE_TO_SERVICE = MODULE_TO_SERVICE;

function isServiceEnabled(module) {
  const serviceKey = MODULE_TO_SERVICE[module];
  if (!serviceKey) return true;
  const project = window.activeProject;
  if (!project || !project.services) return false;
  const cfg = project.services[serviceKey];
  return cfg && cfg.isEnabled === true;
}
window.isServiceEnabled = isServiceEnabled;

// =====================================================================
// Workspace Keep-Alive Tab System
// =====================================================================
const TabManager = {
  tabs: [],
  activeTabId: 'overview-overview',

  init() {
    this.tabs = [
      {
        id: 'overview-overview',
        module: 'overview',
        subview: 'overview',
        title: 'داشبورد پروژه',
        pinned: true,
        controller: new AbortController()
      }
    ];
    this.render();
  },

  render() {
    const container = document.getElementById('workspace-tabs-bar');
    if (!container) return;

    container.innerHTML = this.tabs.map(tab => {
      const isActive = tab.id === this.activeTabId;
      return `
        <div class="workspace-tab-item ${isActive ? 'active' : ''}" data-tab-id="${escapeHtml(tab.id)}" onclick="TabManager.activateTab('${escapeHtml(tab.id)}')">
          ${tab.pinned ? '<span class="workspace-tab-pin" title="پیشخوان پین شده">📌</span>' : ''}
          <span class="workspace-tab-title">${escapeHtml(tab.title)}</span>
          ${!tab.pinned ? `<span class="workspace-tab-close" title="بستن زبانه" onclick="event.stopPropagation(); TabManager.closeTab('${escapeHtml(tab.id)}')">&times;</span>` : ''}
        </div>
      `;
    }).join('');
  },

  openTab(module, subview, title = null) {
    const tabId = `${module}-${subview}`;
    let existing = this.tabs.find(t => t.id === tabId);
    let isNew = false;
    if (!existing) {
      existing = {
        id: tabId,
        module,
        subview,
        title: title || this.getTitle(module, subview),
        pinned: (module === 'overview' && (subview === 'overview' || !subview)),
        controller: new AbortController(),
        loaded: false
      };
      this.tabs.push(existing);
      isNew = true;
    }
    this.activeTabId = tabId;
    this.render();
    return { tab: existing, isNew };
  },

  activateTab(tabId) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;
    this.activeTabId = tabId;
    this.render();
    Router.navigate(tab.module, tab.subview, true);
  },

  closeTab(tabId) {
    const idx = this.tabs.findIndex(t => t.id === tabId);
    if (idx === -1) return;
    const tab = this.tabs[idx];
    if (tab.pinned) return;

    if (tab.controller) {
      try {
        tab.controller.abort('Tab closed');
      } catch (err) {
        console.warn('Tab abort error:', err);
      }
    }

    // Reset view state and forms when tab is closed so reopening it loads fresh
    const modMap = ROUTE_VIEW_MAP[tab.module];
    const viewId = modMap ? (modMap[tab.subview] || modMap['_default']) : null;
    if (viewId) {
      const viewEl = document.getElementById(viewId);
      if (viewEl) {
        viewEl.querySelectorAll('form').forEach(f => {
          try {
            f.reset();
          } catch (err) {
            console.warn('Form reset error:', err);
          }
        });
      }
    }

    this.tabs.splice(idx, 1);

    if (this.activeTabId === tabId) {
      const nextTab = this.tabs[Math.max(0, idx - 1)] || this.tabs[0];
      this.activeTabId = nextTab.id;
      Router.navigate(nextTab.module, nextTab.subview, true);
    }
    this.render();
  },

  getTitle(module, subview) {
    const titles = {
      'overview': { 'overview': 'داشبورد پروژه', 'metrics': 'داشبورد پروژه' },
      'services': { 'list': 'مرکز مدیریت سرویس ها' },
      'service': {
        'database': 'پیکربندی پایگاه داده',
        'auth': 'پیکربندی احراز هویت',
        'storage': 'پیکربندی ذخیره سازی ابری',
        'functions': 'پیکربندی توابع لبه',
        'ipg': 'پیکربندی درگاه پرداخت شاپرک',
        'mobile': 'پیکربندی سرویس موبایل و پوش',
        'hosting': 'پیکربندی میزبانی وب',
        'compliance': 'پیکربندی انطباق و اینماد'
      },
      'db': { 'dashboard': 'داشبورد دیتابیس', 'tables': 'جداول دیتابیس', 'sqleditor': 'ویرایشگر SQL', 'schema': 'ساختار اسکیما', 'backups': 'پشتیبان گیری' },
      'auth': { 'dashboard': 'داشبورد احراز هویت', 'users': 'کاربران اپلیکیشن', 'sms-logs': 'گزارش پیامک ها', 'policies': 'سیاست های امنیتی' },
      'storage': { 'dashboard': 'داشبورد ذخیره سازی', 'buckets': 'باکت های ابری', 'explorer': 'کاوشگر فایل ها', 'policies': 'سطوح دسترسی' },
      'functions': { 'dashboard': 'داشبورد توابع لبه', 'editor': 'توابع سرورلس', 'traces': 'مانیتورینگ توابع', 'env': 'متغیرهای محیطی' },
      'ipg': { 'dashboard': 'داشبورد درگاه پرداخت', 'config': 'درگاه پرداخت شاپرک', 'ledger': 'تراکنش ها و اسناد', 'simulator': 'شبیه ساز پرداخت', 'reports': 'گزارش های مالی' },
      'mobile': { 'dashboard': 'داشبورد سرویس های موبایل', 'push': 'سامانه اعلان Push', 'iap': 'خرید بازار و مایکت', 'realtime': 'جریان داده زنده' },
      'hosting': { 'dashboard': 'داشبورد میزبانی وب', 'deployments': 'استقرارهای وب', 'domains': 'دامنه ها و SSL' },
      'compliance': { 'dashboard': 'داشبورد انطباق', 'tokens': 'مجوزها و اینماد', 'deeplinks': 'دیپ لینک اپلیکیشن' },
      'telemetry': { 'live': 'پخش زنده لاگ ها', 'audit': 'لاگ های امنیتی', 'usage': 'مصرف منابع' },
      'team': { 'members': 'اعضای تیم', 'roles': 'سطوح دسترسی' },
      'profile': { 'general': 'مشخصات حساب' },
      'settings': { 'general': 'تنظیمات پروژه', 'password': 'رمز اختصاصی', 'keys': 'کلیدهای API', 'danger': 'حذف پروژه' }
    };
    return titles[module]?.[subview] || MODULE_TITLES[module]?.title || module;
  }
};
window.TabManager = TabManager;

function renderBreadcrumbs(project, module, subview) {
  const container = document.getElementById('project-breadcrumbs');
  if (!container) return;

  project = project || window.activeProject || (window.userProjects && window.userProjects.find(p => p.id === window.activeProjectId));
  const projName = project ? escapeHtml(project.name) : 'پروژه انتخاب نشده';
  const modMeta = MODULE_TITLES[module] || MODULE_TITLES['overview'];
  const subTitle = TabManager.getTitle(module, subview);

  container.innerHTML = `
    <a class="breadcrumb-link" href="#" onclick="event.preventDefault(); Router.navigate('overview', 'overview');">پلتفرم</a>
    <span class="breadcrumb-separator">/</span>
    <span id="bc-project-name" class="breadcrumb-link" onclick="event.preventDefault(); Router.navigate('overview', 'overview');" style="cursor: pointer;">${projName}</span>
    <span class="breadcrumb-separator">/</span>
    <a class="breadcrumb-link" href="#" onclick="event.preventDefault(); showSidebarLevel2('${module}');">${escapeHtml(modMeta.title)}</a>
    <span class="breadcrumb-separator">/</span>
    <span class="breadcrumb-current">${escapeHtml(subTitle)}</span>
  `;
}
window.renderBreadcrumbs = renderBreadcrumbs;

function showSidebarLevel2(mod) {
  const serviceKey = MODULE_TO_SERVICE[mod];
  if (serviceKey && !isServiceEnabled(mod)) {
    showToast(`سرویس ${MODULE_TITLES[mod]?.title || mod} در این پروژه غیرفعال است.`, 'warning');
    Router.navigate('service', serviceKey, true);
    return;
  }

  const viewLevel1 = document.getElementById('sidebar-view-level1');
  const viewLevel2 = document.getElementById('sidebar-view-level2');
  if (viewLevel1) viewLevel1.classList.remove('active');
  if (viewLevel2) viewLevel2.classList.add('active');

  document.querySelectorAll('.rail-item').forEach(item => {
    if (item.dataset.module === mod) item.classList.add('active');
    else item.classList.remove('active');
  });

  const headerTitle = document.getElementById('flyout-current-title');
  const modMeta = MODULE_TITLES[mod] || MODULE_TITLES['overview'];
  if (headerTitle && modMeta) {
    headerTitle.innerHTML = `<span>${escapeHtml(modMeta.title)}</span>`;
  }

  document.querySelectorAll('.flyout-group').forEach(grp => {
    if (grp.dataset.module === mod) grp.classList.add('active');
    else grp.classList.remove('active');
  });
}
window.showSidebarLevel2 = showSidebarLevel2;

// Router Configuration & Multi-Level Layout Engine
const ROUTE_VIEW_MAP = {
  'overview': {
    'overview': 'view-overview',
    '_default': 'view-overview'
  },
  'services': {
    'list': 'view-services-manager',
    '_default': 'view-services-manager'
  },
  'service': {
    'database': 'view-service-config',
    'auth': 'view-service-config',
    'storage': 'view-service-config',
    'functions': 'view-service-config',
    'ipg': 'view-service-config',
    'mobile': 'view-service-config',
    'hosting': 'view-service-config',
    'compliance': 'view-service-config',
    '_default': 'view-service-config'
  },
  'db': {
    'dashboard': 'view-db-dashboard',
    'tables': 'view-db-tables',
    'sqleditor': 'view-db-sqleditor',
    'schema': 'view-db-schema',
    'backups': 'view-db-backups',
    '_default': 'view-db-dashboard'
  },
  'auth': {
    'dashboard': 'view-auth-dashboard',
    'users': 'view-auth-users',
    'sms-logs': 'view-auth-sms-logs',
    'policies': 'view-auth-policies',
    '_default': 'view-auth-dashboard'
  },
  'storage': {
    'dashboard': 'view-storage-dashboard',
    'buckets': 'view-storage-buckets',
    'explorer': 'view-storage-explorer',
    'policies': 'view-storage-policies',
    '_default': 'view-storage-dashboard'
  },
  'functions': {
    'dashboard': 'view-functions-dashboard',
    'editor': 'view-functions-editor',
    'traces': 'view-functions-traces',
    'env': 'view-functions-env',
    '_default': 'view-functions-dashboard'
  },
  'ipg': {
    'dashboard': 'view-ipg-dashboard',
    'config': 'view-ipg-config',
    'ledger': 'view-ipg-ledger',
    'simulator': 'view-ipg-simulator',
    'reports': 'view-ipg-reports',
    '_default': 'view-ipg-dashboard'
  },
  'mobile': {
    'dashboard': 'view-mobile-dashboard',
    'push': 'view-mobile-push',
    'iap': 'view-mobile-iap',
    'realtime': 'view-mobile-realtime',
    '_default': 'view-mobile-dashboard'
  },
  'hosting': {
    'dashboard': 'view-hosting-dashboard',
    'deployments': 'view-hosting-deployments',
    'domains': 'view-hosting-domains',
    '_default': 'view-hosting-dashboard'
  },
  'compliance': {
    'dashboard': 'view-compliance-dashboard',
    'tokens': 'view-compliance-tokens',
    'deeplinks': 'view-compliance-deeplinks',
    '_default': 'view-compliance-dashboard'
  },
  'telemetry': {
    'live': 'view-telemetry-live',
    'audit': 'view-telemetry-audit',
    'usage': 'view-telemetry-usage',
    '_default': 'view-telemetry-live'
  },
  'team': {
    'members': 'view-team-members',
    'roles': 'view-team-roles',
    '_default': 'view-team-members'
  },
  'profile': {
    'general': 'view-profile-general',
    '_default': 'view-profile-general'
  },
  'settings': {
    'general': 'view-settings-general',
    'password': 'view-settings-password',
    'keys': 'view-settings-keys',
    'danger': 'view-settings-danger',
    '_default': 'view-settings-general'
  }
};
window.ROUTE_VIEW_MAP = ROUTE_VIEW_MAP;

const VIEW_TO_ROUTE = {
  'view-overview': { module: 'overview', subview: 'overview' },
  'view-services-manager': { module: 'services', subview: 'list' },
  'view-service-config': { module: 'service', subview: 'database' },
  'view-db-dashboard': { module: 'db', subview: 'dashboard' },
  'view-auth-dashboard': { module: 'auth', subview: 'dashboard' },
  'view-storage-dashboard': { module: 'storage', subview: 'dashboard' },
  'view-functions-dashboard': { module: 'functions', subview: 'dashboard' },
  'view-ipg-dashboard': { module: 'ipg', subview: 'dashboard' },
  'view-mobile-dashboard': { module: 'mobile', subview: 'dashboard' },
  'view-hosting-dashboard': { module: 'hosting', subview: 'dashboard' },
  'view-compliance-dashboard': { module: 'compliance', subview: 'dashboard' },
  'view-db-tables': { module: 'db', subview: 'tables' },
  'view-db-sqleditor': { module: 'db', subview: 'sqleditor' },
  'view-db-schema': { module: 'db', subview: 'schema' },
  'view-db-backups': { module: 'db', subview: 'backups' },
  'view-auth-users': { module: 'auth', subview: 'users' },
  'view-auth-sms-logs': { module: 'auth', subview: 'sms-logs' },
  'view-auth-policies': { module: 'auth', subview: 'policies' },
  'view-storage-buckets': { module: 'storage', subview: 'buckets' },
  'view-storage-explorer': { module: 'storage', subview: 'explorer' },
  'view-storage-policies': { module: 'storage', subview: 'policies' },
  'view-functions-editor': { module: 'functions', subview: 'editor' },
  'view-functions-traces': { module: 'functions', subview: 'traces' },
  'view-functions-env': { module: 'functions', subview: 'env' },
  'view-ipg-config': { module: 'ipg', subview: 'config' },
  'view-ipg-ledger': { module: 'ipg', subview: 'ledger' },
  'view-ipg-simulator': { module: 'ipg', subview: 'simulator' },
  'view-ipg-reports': { module: 'ipg', subview: 'reports' },
  'view-mobile-push': { module: 'mobile', subview: 'push' },
  'view-mobile-iap': { module: 'mobile', subview: 'iap' },
  'view-mobile-realtime': { module: 'mobile', subview: 'realtime' },
  'view-hosting-deployments': { module: 'hosting', subview: 'deployments' },
  'view-hosting-domains': { module: 'hosting', subview: 'domains' },
  'view-compliance-tokens': { module: 'compliance', subview: 'tokens' },
  'view-compliance-deeplinks': { module: 'compliance', subview: 'deeplinks' },
  'view-telemetry-live': { module: 'telemetry', subview: 'live' },
  'view-telemetry-audit': { module: 'telemetry', subview: 'audit' },
  'view-telemetry-usage': { module: 'telemetry', subview: 'usage' },
  'view-team-members': { module: 'team', subview: 'members' },
  'view-team-roles': { module: 'team', subview: 'roles' },
  'view-profile-general': { module: 'profile', subview: 'general' },
  'view-settings-general': { module: 'settings', subview: 'general' },
  'view-settings-password': { module: 'settings', subview: 'password' },
  'view-settings-keys': { module: 'settings', subview: 'keys' },
  'view-settings-danger': { module: 'settings', subview: 'danger' },
  // Backward compatibility aliases
  'view-overview-metrics': { module: 'overview', subview: 'overview' },
  'view-overview-quickstart': { module: 'overview', subview: 'overview' },
  'view-db': { module: 'db', subview: 'dashboard' },
  'view-sqleditor': { module: 'db', subview: 'sqleditor' },
  'view-auth': { module: 'auth', subview: 'dashboard' },
  'view-storage': { module: 'storage', subview: 'dashboard' },
  'view-functions': { module: 'functions', subview: 'dashboard' },
  'view-ipg': { module: 'ipg', subview: 'dashboard' },
  'view-hosting': { module: 'hosting', subview: 'dashboard' },
  'view-compliance': { module: 'compliance', subview: 'dashboard' },
  'view-logs': { module: 'telemetry', subview: 'live' },
  'view-usage': { module: 'telemetry', subview: 'usage' },
  'view-team': { module: 'team', subview: 'members' },
  'view-profile': { module: 'profile', subview: 'general' },
  'view-settings': { module: 'settings', subview: 'general' }
};
window.VIEW_TO_ROUTE = VIEW_TO_ROUTE;

const MODULE_TITLES = {
  'overview': { icon: '', title: 'داشبورد پروژه' },
  'services': { icon: '', title: 'مدیریت سرویس ها' },
  'service': { icon: '', title: 'پیکربندی سرویس' },
  'db': { icon: '', title: 'پایگاه داده رابطه ای' },
  'auth': { icon: '', title: 'احراز هویت و کاربران' },
  'storage': { icon: '', title: 'ذخیره سازی ابری' },
  'functions': { icon: '', title: 'توابع سرورلس' },
  'ipg': { icon: '', title: 'درگاه پرداخت شاپرک' },
  'mobile': { icon: '', title: 'سرویس های موبایل و پوش' },
  'hosting': { icon: '', title: 'میزبانی وب و استقرار' },
  'compliance': { icon: '', title: 'مجوزها و انطباق قانونی' },
  'telemetry': { icon: '', title: 'پایش و لاگ ها' },
  'team': { icon: '', title: 'اعضای تیم و دسترسی ها' },
  'profile': { icon: '', title: 'پروفایل و حساب کاربری' },
  'settings': { icon: '', title: 'تنظیمات پروژه' }
};
window.MODULE_TITLES = MODULE_TITLES;

const Router = {
  currentModule: 'overview',
  currentSubview: 'overview',

  parsePath() {
    const pathname = window.location.pathname;
    const parts = pathname.split('/').filter(p => p.length > 0);
    const slug = parts[1] || null;
    const hasExplicitModule = !!parts[2];
    const module = parts[2] || 'overview';
    const subview = parts[3] || null;
    return { slug, module, subview, hasExplicitModule };
  },

  buildUrl(slug, module, subview) {
    if (!slug) return '/panel';
    const mod = module || 'overview';
    if (mod === 'overview') {
      return `/panel/${slug}/overview`;
    }
    if (mod === 'services') {
      return `/panel/${slug}/services`;
    }
    if (mod === 'service') {
      return `/panel/${slug}/service/${subview || 'database'}`;
    }
    const defaultSub = ROUTE_VIEW_MAP[mod] ? Object.keys(ROUTE_VIEW_MAP[mod])[0] : 'dashboard';
    const sub = subview || defaultSub;
    return `/panel/${slug}/${mod}/${sub}`;
  },

  navigate(module, subview, updateHistory = true) {
    const mod = module || 'overview';
    const sub = subview || (ROUTE_VIEW_MAP[mod] ? Object.keys(ROUTE_VIEW_MAP[mod])[0] : 'default');
    this.currentModule = mod;
    this.currentSubview = sub;

    this.applyView(mod, sub, true);

    const activeProject = window.activeProject;
    if (updateHistory && activeProject) {
      const url = this.buildUrl(activeProject.slug, mod, sub);
      if (window.location.pathname !== url) {
        window.history.pushState({ slug: activeProject.slug, module: mod, subview: sub }, '', url);
      }
    }
  },

  applyView(module, subview, showLevel2Sidebar = true) {
    // Gating Check: If service is inactive, redirect directly to service config
    const serviceKey = MODULE_TO_SERVICE[module];
    if (serviceKey && !isServiceEnabled(module)) {
      showToast(`سرویس ${MODULE_TITLES[module]?.title || module} در این پروژه غیرفعال است.`, 'warning');
      this.navigate('service', serviceKey, true);
      return;
    }

    const modMap = ROUTE_VIEW_MAP[module] || ROUTE_VIEW_MAP['overview'];
    const targetSub = subview || Object.keys(modMap)[0];
    const viewId = modMap[targetSub] || modMap['_default'] || 'view-overview';

    // 1. Manage sidebar view level (Level 1 vs Level 2)
    const isSingleLevel = module === 'overview' || module === 'services' || module === 'service';
    const effectiveShowL2 = showLevel2Sidebar && !isSingleLevel;

    const viewLevel1 = document.getElementById('sidebar-view-level1');
    const viewLevel2 = document.getElementById('sidebar-view-level2');
    if (viewLevel1 && viewLevel2) {
      if (effectiveShowL2) {
        viewLevel1.classList.remove('active');
        viewLevel2.classList.add('active');
      } else {
        viewLevel1.classList.add('active');
        viewLevel2.classList.remove('active');
      }
    }

    document.querySelectorAll('.rail-item').forEach(btn => {
      if (btn.dataset.module === module) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // 2. Update Level-2 Flyout Title
    const headerTitle = document.getElementById('flyout-current-title');
    const modMeta = MODULE_TITLES[module] || MODULE_TITLES['overview'];
    if (headerTitle && modMeta) {
      headerTitle.innerHTML = `<span>${escapeHtml(modMeta.title)}</span>`;
    }

    // 3. Show only the flyout group for this module
    document.querySelectorAll('.flyout-group').forEach(grp => {
      if (grp.dataset.module === module) {
        grp.classList.add('active');
      } else {
        grp.classList.remove('active');
      }
    });

    // 4. Highlight active flyout link
    document.querySelectorAll('.flyout-link').forEach(link => {
      if (link.dataset.module === module && (link.dataset.subview === targetSub || (!subview && link.classList.contains('active')))) {
        link.classList.add('active');
      } else if (link.dataset.module === module) {
        link.classList.remove('active');
      }
    });

    // 5. Activate Target Section View (Keep-Alive DOM)
    document.querySelectorAll('.tab-view').forEach(v => {
      if (v.id === viewId) {
        v.classList.add('active');
      } else {
        v.classList.remove('active');
      }
    });

    // 6. Update Keep-Alive Tab Bar & Granular Traversal Breadcrumbs
    const { tab, isNew } = TabManager.openTab(module, targetSub);
    renderBreadcrumbs(window.activeProject, module, targetSub);

    // 8. Scroll/focus handling for internal anchor subviews
    this.handleSubViewFocus(module, targetSub);

    // 9. Trigger data loader for the active view only if new, not loaded, or overview/services/service/dashboard
    if (isNew || !tab.loaded || module === 'overview' || module === 'services' || module === 'service' || targetSub === 'dashboard') {
      tab.loaded = true;
      this.triggerLoader(module, targetSub, viewId);
    }
  },

  handleSubViewFocus(module, subview) {
    if (module === 'settings' && subview === 'password') {
      const el = document.getElementById('project-password-mgmt-box');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (module === 'db' && subview === 'sqleditor') {
      const el = document.getElementById('view-sqleditor');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  },

  triggerLoader(module, subview, viewId) {
    const activeProjectId = window.activeProjectId;
    if (!activeProjectId) return;
    try {
      if (module === 'overview') {
        if (typeof renderOverviewServices === 'function') renderOverviewServices();
        if (typeof loadUsageData === 'function') loadUsageData();
        if (typeof renderDashboardCharts === 'function') renderDashboardCharts();
      } else if (module === 'services') {
        if (typeof renderServicesManager === 'function') renderServicesManager();
      } else if (module === 'service') {
        if (typeof renderServiceConfigPage === 'function') renderServiceConfigPage(subview);
      } else if (subview === 'dashboard') {
        if (typeof renderServiceDashboard === 'function') renderServiceDashboard(module);
      } else if (module === 'db') {
        if (subview === 'sqleditor') {
          if (typeof loadSqlEditor === 'function') loadSqlEditor();
        } else if (subview === 'schema') {
          if (typeof loadDbSchema === 'function') loadDbSchema();
        } else if (subview === 'backups') {
          if (typeof loadDbBackups === 'function') loadDbBackups();
        } else {
          if (typeof loadProjectTables === 'function') loadProjectTables();
        }
      } else if (module === 'auth') {
        if (subview === 'sms-logs') {
          if (typeof loadSmsLogs === 'function') loadSmsLogs();
        } else if (subview === 'policies') {
          if (typeof loadAuthPolicies === 'function') loadAuthPolicies();
        } else {
          if (typeof loadProjectUsers === 'function') loadProjectUsers();
        }
      } else if (module === 'storage') {
        if (subview === 'explorer') {
          if (typeof loadStorageExplorer === 'function') loadStorageExplorer();
        } else if (subview === 'policies') {
          if (typeof loadStoragePolicies === 'function') loadStoragePolicies();
        } else {
          if (typeof loadProjectBuckets === 'function') loadProjectBuckets();
        }
      } else if (module === 'functions') {
        if (subview === 'traces') {
          if (typeof loadFunctionsTraces === 'function') loadFunctionsTraces();
        } else if (subview === 'env') {
          if (typeof loadFunctionsEnv === 'function') loadFunctionsEnv();
        } else {
          if (typeof loadProjectFunctions === 'function') loadProjectFunctions();
        }
      } else if (module === 'ipg') {
        if (subview === 'ledger') {
          if (typeof loadIpgLedger === 'function') loadIpgLedger();
        } else if (subview === 'simulator') {
          if (typeof loadIpgSimulator === 'function') loadIpgSimulator();
        } else if (subview === 'reports') {
          if (typeof loadIpgReports === 'function') loadIpgReports();
        } else {
          if (typeof loadIpgStudio === 'function') loadIpgStudio();
        }
      } else if (module === 'mobile') {
        if (subview === 'iap') {
          if (typeof loadIapPurchases === 'function') loadIapPurchases();
        } else if (subview === 'realtime') {
          if (typeof updateRealtimeWsUrlDisplay === 'function') {
            updateRealtimeWsUrlDisplay();
          } else {
            const wsEl = document.getElementById('mobile-ws-url-display');
            if (wsEl) {
              const loc = window.location;
              const wsProto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
              wsEl.textContent = `${wsProto}//${loc.host}/_baas/v1/${activeProjectId}/realtime`;
            }
          }
        } else {
          if (typeof loadPushDevices === 'function') loadPushDevices();
          if (typeof loadPushConfig === 'function') loadPushConfig();
        }
      } else if (module === 'hosting') {
        if (subview === 'domains') {
          if (typeof loadHostingDomains === 'function') loadHostingDomains();
        } else {
          if (typeof loadHosting === 'function') loadHosting();
        }
      } else if (module === 'compliance') {
        if (subview === 'deeplinks') {
          if (typeof loadComplianceDeeplinks === 'function') loadComplianceDeeplinks();
        } else {
          if (typeof loadCompliance === 'function') loadCompliance();
        }
      } else if (module === 'telemetry') {
        if (subview === 'usage') {
          if (typeof loadUsageData === 'function') loadUsageData();
        } else if (subview === 'audit') {
          if (typeof loadAuditLogs === 'function') loadAuditLogs();
        } else {
          if (typeof loadLogs === 'function') loadLogs();
        }
      } else if (module === 'team') {
        if (subview === 'roles') {
          if (typeof loadTeamRoles === 'function') loadTeamRoles();
        } else {
          if (typeof loadTeam === 'function') loadTeam();
        }
      } else if (module === 'profile') {
        if (typeof loadUserProfileView === 'function') loadUserProfileView();
      } else if (module === 'settings') {
        if (subview === 'password') {
          if (typeof loadProjectPasswordStatus === 'function') loadProjectPasswordStatus(activeProjectId);
        } else if (subview === 'keys') {
          if (typeof loadSettingsKeys === 'function') loadSettingsKeys();
        } else if (subview === 'danger') {
          if (typeof loadSettingsDanger === 'function') loadSettingsDanger();
        } else {
          if (typeof loadSettingsGeneral === 'function') loadSettingsGeneral();
        }
      }
    } catch (err) {
      console.warn('Loader error for', module, subview, err);
    }
  },

  handleRoute(initial = false) {
    const route = this.parsePath();
    const userProjects = window.userProjects;
    if (!userProjects || userProjects.length === 0) return;

    let targetProject = null;
    if (route.slug) {
      targetProject = userProjects.find(p => p.slug === route.slug);
    }
    if (!targetProject) {
      targetProject = userProjects[0];
    }

    const activeProject = window.activeProject;
    if (!activeProject || activeProject.id !== targetProject.id) {
      if (typeof window.activateProject === 'function') {
        window.activateProject(targetProject.id, false);
      }
      const switcher = document.getElementById('project-switcher');
      if (switcher) switcher.value = targetProject.id;
    }

    const mod = route.module || 'overview';
    const sub = route.subview || (ROUTE_VIEW_MAP[mod] ? Object.keys(ROUTE_VIEW_MAP[mod])[0] : (mod === 'overview' ? 'overview' : 'dashboard'));

    this.currentModule = mod;
    this.currentSubview = sub;
    const showLevel2Sidebar = !initial || route.hasExplicitModule;
    this.applyView(mod, sub, showLevel2Sidebar);

    // Synchronize canonical address in browser address bar
    const canonicalUrl = this.buildUrl(targetProject.slug, mod, sub);
    if (window.location.pathname !== canonicalUrl) {
      if (initial) {
        window.history.replaceState({ slug: targetProject.slug, module: mod, subview: sub }, '', canonicalUrl);
      } else {
        window.history.pushState({ slug: targetProject.slug, module: mod, subview: sub }, '', canonicalUrl);
      }
    }
  }
};
window.Router = Router;

function navigateToView(viewId) {
  const mapping = VIEW_TO_ROUTE[viewId] || { module: 'overview', subview: 'overview' };
  Router.navigate(mapping.module, mapping.subview);
}
window.navigateToView = navigateToView;

// Service Gating Dynamic DOM Helpers (fallback)
function showServiceGatingInView(module, serviceKey, viewId) {
  const sDef = MODULE_TO_SERVICE[module] || serviceKey;
  Router.navigate('service', sDef, true);
}
window.showServiceGatingInView = showServiceGatingInView;

function clearServiceGatingInView(viewId) {}
window.clearServiceGatingInView = clearServiceGatingInView;
