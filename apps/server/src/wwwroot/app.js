function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// =====================================================================
// Apple-Styled Non-Blocking Toast Notification System
// =====================================================================
function showToast(message, type = 'info', duration = 3800) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast-message toast-${type}`;
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warning' ? '⚠' : 'ℹ';
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-text">${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-fadeout');
    setTimeout(() => toast.remove(), 280);
  }, duration);
}
window.showToast = showToast;

// Hard override of window.alert to guarantee zero browser popups platform-wide
window.alert = function(msg) {
  showToast(String(msg), 'info');
};

// LocalMe Developer BaaS Console Core Engine
var currentUser = null;
var userProjects = [];
var activeProjectId = null;
var activeProject = null;
window.currentUser = currentUser;
window.userProjects = userProjects;
window.activeProjectId = activeProjectId;
window.activeProject = activeProject;

document.addEventListener('DOMContentLoaded', () => {
  initUserSession();
  initSidebarNav();
  initMiniProfile();
  initModals();
  initServiceForms();
  initShamsiDatepicker();
  initProjectPasswordListeners();
  TabManager.init();
});

// 1. User Session & Initial Projects Fetch
async function initUserSession() {
  try {
    const res = await fetch('/_baas/v1/users/me');
    if (res.ok) {
      currentUser = await res.json();
      window.currentUser = currentUser;
      const nameEl = document.getElementById('user-display-name');
      if (nameEl) nameEl.textContent = currentUser.fullName;

      const roleBadge = document.getElementById('user-role-badge');
      if (roleBadge) {
        if (currentUser.isProjectScoped) {
          roleBadge.textContent = 'دسترسی تک‌پروژه';
          roleBadge.className = 'badge badge-info';
        } else {
          roleBadge.textContent = currentUser.role === 0 ? 'مدیر ارشد' : currentUser.role === 1 ? 'اپراتور' : 'توسعه‌دهنده';
        }
      }

      // Update Mini-Profile title and label
      const balanceStr = Shamsi.formatToman(currentUser.walletBalanceIrr);
      const titleStr = `${currentUser.fullName || 'سینا والی زاده'} | ${balanceStr}`;
      const labelEl = document.getElementById('mini-profile-label');
      const triggerEl = document.getElementById('mini-profile-trigger');
      if (labelEl) labelEl.textContent = titleStr;
      if (triggerEl) triggerEl.title = titleStr;

      const phoneEl = document.getElementById('mp-user-phone');
      if (phoneEl && currentUser.phone) phoneEl.textContent = currentUser.phone;

      const emailEl = document.getElementById('mp-user-email');
      if (emailEl && currentUser.email) emailEl.textContent = currentUser.email;

      // Hide create project button for project-scoped login
      if (currentUser.isProjectScoped) {
        const createBtn = document.getElementById('btn-create-proj-modal');
        if (createBtn) createBtn.style.display = 'none';
      }

      // Show Admin portal link if user is Admin or Operator
      const adminLink = document.getElementById('admin-panel-link');
      if (adminLink && !currentUser.isProjectScoped && (currentUser.role === 0 || currentUser.role === 1)) {
        adminLink.style.display = 'inline-flex';
      }

      updateWalletDisplay(currentUser.walletBalanceIrr);
      await loadUserProjects();
    }
  } catch (err) {
    console.warn('Session load failed:', err);
  }
}

function updateWalletDisplay(balanceIrr) {
  const el = document.getElementById('topbar-wallet-val');
  const balanceStr = Shamsi.formatToman(balanceIrr);
  if (el) {
    el.textContent = balanceStr;
  }
  const labelEl = document.getElementById('mini-profile-label');
  const triggerEl = document.getElementById('mini-profile-trigger');
  const name = (currentUser && currentUser.fullName) ? currentUser.fullName : 'سینا والی زاده';
  const titleStr = `${name} | ${balanceStr}`;
  if (labelEl) labelEl.textContent = titleStr;
  if (triggerEl) triggerEl.title = titleStr;
}

function initMiniProfile() {
  const wrapper = document.getElementById('mini-profile-wrapper');
  const trigger = document.getElementById('mini-profile-trigger');
  if (!wrapper || !trigger) return;

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    wrapper.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) {
      wrapper.classList.remove('open');
    }
  });
}

// 2. Load User Projects & Handle 0-Project Empty State
async function loadUserProjects(selectIdToActivate = null) {
  const switcher = document.getElementById('project-switcher');
  const emptyState = document.getElementById('empty-state-view');
  const activeContainer = document.getElementById('active-project-container');

  try {
    const res = await fetch('/_baas/v1/projects');
    if (res.ok) {
      userProjects = await res.json();
      window.userProjects = userProjects;

      if (!userProjects || userProjects.length === 0) {
        if (switcher) switcher.innerHTML = '<option value="">هیچ پروژه‌ای وجود ندارد</option>';
        if (emptyState) emptyState.style.display = 'block';
        if (activeContainer) activeContainer.style.display = 'none';
        activeProjectId = null;
        activeProject = null;
        setText('bc-project-name', 'پروژه‌ای انتخاب نشده');
        return;
      }

      if (emptyState) emptyState.style.display = 'none';
      if (activeContainer) activeContainer.style.display = 'block';

      if (switcher) {
        switcher.innerHTML = userProjects.map(p => `
          <option value="${escapeHtml(p.id)}">${escapeHtml(p.name)} (${escapeHtml(p.slug)})</option>
        `).join('');

        // Find initial target project from URL or requested ID
        const route = Router.parsePath();
        let targetProj = null;
        if (selectIdToActivate) {
          targetProj = userProjects.find(p => p.id === selectIdToActivate);
        } else if (route.slug) {
          targetProj = userProjects.find(p => p.slug === route.slug);
        }
        if (!targetProj) {
          targetProj = userProjects[0];
        }

        switcher.value = targetProj.id;
        activateProject(targetProj.id, false);
        Router.handleRoute(true);

        switcher.onchange = () => {
          activateProject(switcher.value, true);
        };
      }
    }
  } catch (err) {
    console.warn('Projects fetch error:', err);
  }
}

async function activateProject(projectId, updateRoute = true) {
  activeProjectId = projectId;
  activeProject = userProjects.find(p => p.id === projectId);
  window.activeProjectId = activeProjectId;
  window.activeProject = activeProject;
  if (!activeProject) return;

  setText('bc-project-name', activeProject.name);

  const statusBadge = document.getElementById('proj-status-badge');
  if (statusBadge) {
    statusBadge.textContent = activeProject.status === 'Active' ? 'فعال' : 'معلق';
    statusBadge.className = activeProject.status === 'Active' ? 'badge badge-active' : 'badge badge-paused';
  }

  // Populate Overview Tab
  setText('ov-proj-name', activeProject.name);
  setText('ov-proj-desc', activeProject.description || 'بدون توضیحات');
  setText('ov-proj-slug', activeProject.slug);
  setText('ov-proj-region', activeProject.region);
  setText('ov-proj-date', Shamsi.formatDate(activeProject.createdAtUtc));
  const ovStatus = document.getElementById('ov-proj-status');
  if (ovStatus) {
    ovStatus.textContent = activeProject.status === 'Active' ? 'فعال' : 'معلق';
    ovStatus.className = activeProject.status === 'Active' ? 'badge badge-active' : 'badge badge-paused';
  }

  // Populate Settings tab inputs
  const setName = document.getElementById('set-proj-name');
  if (setName) setName.value = activeProject.name;
  const setSlug = document.getElementById('set-proj-slug');
  if (setSlug) setSlug.value = activeProject.slug;
  const setDesc = document.getElementById('set-proj-desc');
  if (setDesc) setDesc.value = activeProject.description || '';

  // Render per-service pages and overview cards
  renderAllServices();
  if (typeof renderOverviewServices === 'function') renderOverviewServices();

  // If updateRoute requested, update URL with active project's slug
  if (updateRoute) {
    const url = Router.buildUrl(activeProject.slug, Router.currentModule, Router.currentSubview);
    if (window.location.pathname !== url) {
      window.history.pushState({ slug: activeProject.slug, module: Router.currentModule, subview: Router.currentSubview }, '', url);
    }
  }

  // Router trigger data load for current active view
  Router.triggerLoader(Router.currentModule, Router.currentSubview, null);
}

// 3. Multi-Level Unified Sidebar Navigation (Click-based)
function initSidebarNav() {
  const railItems = document.querySelectorAll('.rail-item');
  const flyoutLinks = document.querySelectorAll('.flyout-link');
  const viewLevel1 = document.getElementById('sidebar-view-level1');
  const viewLevel2 = document.getElementById('sidebar-view-level2');
  const backBtnTop = document.getElementById('sidebar-back-btn-top');
  const backBtnBottom = document.getElementById('sidebar-back-btn-bottom');

  function showLevel1() {
    if (viewLevel1) viewLevel1.classList.add('active');
    if (viewLevel2) viewLevel2.classList.remove('active');
  }

  function showLevel2(mod) {
    if (viewLevel1) viewLevel1.classList.remove('active');
    if (viewLevel2) viewLevel2.classList.add('active');

    // Update active state on rail items
    railItems.forEach(item => {
      if (item.dataset.module === mod) item.classList.add('active');
      else item.classList.remove('active');
    });

    // Update flyout title
    const headerTitle = document.getElementById('flyout-current-title');
    const modMeta = MODULE_TITLES[mod] || MODULE_TITLES['overview'];
    if (headerTitle && modMeta) {
      headerTitle.innerHTML = `<span>${modMeta.title}</span>`;
    }

    // Show matching flyout group
    document.querySelectorAll('.flyout-group').forEach(grp => {
      if (grp.dataset.module === mod) grp.classList.add('active');
      else grp.classList.remove('active');
    });
  }

  // 1. Level 1 Rail Items: Gated navigation per requirements
  railItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const mod = item.dataset.module;
      if (mod === 'services') {
        showLevel1();
        Router.navigate('services', 'list');
        return;
      }
      if (mod === 'overview') {
        showLevel1();
        Router.navigate('overview', 'overview');
        return;
      }
      const srvKey = MODULE_TO_SERVICE[mod];
      if (srvKey) {
        if (!isServiceEnabled(mod)) {
          showLevel1();
          Router.navigate('service', srvKey);
          showToast(`سرویس ${MODULE_TITLES[mod]?.title || mod} در این پروژه غیرفعال است.`, 'warning');
        } else {
          showLevel2(mod);
          Router.navigate(mod, 'dashboard');
        }
        return;
      }
      showLevel2(mod);
      const defaultSub = ROUTE_VIEW_MAP[mod] ? Object.keys(ROUTE_VIEW_MAP[mod])[0] : 'default';
      Router.navigate(mod, defaultSub);
    });
  });

  // 2. Back buttons (Top on desktop, Bottom on mobile)
  if (backBtnTop) {
    backBtnTop.addEventListener('click', (e) => {
      e.preventDefault();
      showLevel1();
    });
  }
  if (backBtnBottom) {
    backBtnBottom.addEventListener('click', (e) => {
      e.preventDefault();
      showLevel1();
    });
  }

  // 3. Level 2 Flyout Links: Click navigates to subview and loads page view
  flyoutLinks.forEach(link => {
    link.addEventListener('click', () => {
      const mod = link.dataset.module;
      const sub = link.dataset.subview;
      Router.navigate(mod, sub);
    });
  });

  // Listen to popstate for browser Back / Forward buttons
  window.addEventListener('popstate', () => {
    Router.handleRoute(false);
  });
}

async function loadUserProfileView() {
  if (!currentUser) return;
  setText('prof-full-name-val', currentUser.fullName || 'سینا والی زاده');
  setText('prof-phone-val', currentUser.phone || '۰۹۱۲۰۰۰۰۰۰۰');
  setText('prof-email-val', currentUser.email || 'sina@localme.ir');
  setText('prof-wallet-val', Shamsi.formatToman(currentUser.walletBalanceIrr));
  const roleEl = document.getElementById('prof-role-badge');
  if (roleEl) {
    roleEl.textContent = currentUser.role === 0 ? 'مدیر ارشد پلتفرم' : currentUser.role === 1 ? 'اپراتور سیستم' : 'توسعه‌دهنده (طرح پایه)';
    roleEl.className = currentUser.role === 0 ? 'badge badge-active' : 'badge badge-info';
  }
}

// Global Exports
window.openModal = openModal;
window.closeModal = closeModal;
window.copyFieldValue = copyFieldValue;
window.setText = setText;
window.setVal = setVal;
window.escapeHtml = escapeHtml;
window.loadUserProfileView = loadUserProfileView;
window.activateProject = activateProject;
window.loadUserProjects = loadUserProjects;

