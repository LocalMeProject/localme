// LocalMe Developer BaaS Console Core Engine
let currentUser = null;
let userProjects = [];
let activeProjectId = null;
let activeProject = null;

document.addEventListener('DOMContentLoaded', () => {
  initUserSession();
  initSidebarNav();
  initModals();
  initServiceForms();
  initShamsiDatepicker();
});

// 1. User Session & Initial Projects Fetch
async function initUserSession() {
  try {
    const res = await fetch('/_baas/v1/users/me');
    if (res.ok) {
      currentUser = await res.json();
      const nameEl = document.getElementById('user-display-name');
      if (nameEl) nameEl.textContent = currentUser.fullName;

      const roleBadge = document.getElementById('user-role-badge');
      if (roleBadge) {
        roleBadge.textContent = currentUser.role === 0 ? 'مدیر ارشد' : currentUser.role === 1 ? 'اپراتور' : 'توسعه‌دهنده';
      }

      // Show Admin portal link if user is Admin or Operator
      const adminLink = document.getElementById('admin-panel-link');
      if (adminLink && (currentUser.role === 0 || currentUser.role === 1)) {
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
  if (el) {
    el.textContent = Shamsi.formatToman(balanceIrr);
  }
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
          <option value="${p.id}">${p.name} (${p.slug})</option>
        `).join('');

        const targetId = selectIdToActivate || userProjects[0].id;
        switcher.value = targetId;
        activateProject(targetId);

        switcher.onchange = () => activateProject(switcher.value);
      }
    }
  } catch (err) {
    console.warn('Projects fetch error:', err);
  }
}

async function activateProject(projectId) {
  activeProjectId = projectId;
  activeProject = userProjects.find(p => p.id === projectId);
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

  // Load project sub-resources
  loadProjectTables();
  loadProjectUsers();
  loadProjectBuckets();
  loadProjectFunctions();
  loadUsageData();
}

// 3. Sidebar Navigation
function initSidebarNav() {
  const links = document.querySelectorAll('.sidebar-link');
  const views = document.querySelectorAll('.tab-view');
  const bcViewName = document.getElementById('bc-view-name');

  links.forEach(link => {
    link.addEventListener('click', () => {
      const targetView = link.dataset.view;

      links.forEach(l => l.classList.remove('active'));
      views.forEach(v => v.classList.remove('active'));

      link.classList.add('active');
      const targetEl = document.getElementById(targetView);
      if (targetEl) targetEl.classList.add('active');

      if (bcViewName) bcViewName.textContent = link.innerText.trim();
    });
  });
}

function navigateToView(viewId) {
  const links = document.querySelectorAll('.sidebar-link');
  const views = document.querySelectorAll('.tab-view');
  const bcViewName = document.getElementById('bc-view-name');

  links.forEach(l => {
    if (l.dataset.view === viewId) {
      l.classList.add('active');
      if (bcViewName) bcViewName.textContent = l.innerText.trim();
    } else {
      l.classList.remove('active');
    }
  });

  views.forEach(v => {
    if (v.id === viewId) {
      v.classList.add('active');
    } else {
      v.classList.remove('active');
    }
  });
}

// 4. Usage & Metering (with Shamsi Datepicker Popover)
async function loadUsageData(startDateIso = null, endDateIso = null) {
  if (!activeProjectId) return;

  try {
    let url = `/_baas/v1/${activeProjectId}/billing/usage`;
    if (startDateIso && endDateIso) {
      url += `?start=${encodeURIComponent(startDateIso)}&end=${encodeURIComponent(endDateIso)}`;
    }

    const res = await fetch(url);
    if (res.ok) {
      const summary = await res.json();
      setText('usage-val-db', Shamsi.toPersianDigits(summary.totalDbQueries));
      setText('usage-val-sms', Shamsi.toPersianDigits(summary.totalSmsSent));
      setText('usage-val-compute', `${Shamsi.toPersianDigits(summary.totalComputeMs)} ms`);
      setText('usage-val-cost', `${Shamsi.toPersianDigits(summary.formattedCostToman)} تومان`);

      setText('ov-val-queries', Shamsi.toPersianDigits(summary.totalDbQueries));
      setText('ov-val-sms', Shamsi.toPersianDigits(summary.totalSmsSent));
      setText('ov-val-cost', `${Shamsi.toPersianDigits(summary.formattedCostToman)} تومان`);

      const tbody = document.getElementById('usage-events-tbody');
      if (tbody && summary.recentEvents) {
        tbody.innerHTML = summary.recentEvents.map(e => `
          <tr>
            <td style="font-family: var(--font-mono); font-size: 11.5px; font-weight: 600;">${e.resourceType}</td>
            <td style="font-family: var(--font-mono);">${Shamsi.toPersianDigits(e.units)}</td>
            <td style="font-family: var(--font-mono); font-size: 11.5px;">${Shamsi.toPersianDigits(e.costIrr.toLocaleString())}</td>
            <td style="font-weight: 700; color: var(--brand-dark);">${Shamsi.toPersianDigits(Math.floor(e.costIrr / 10).toLocaleString())} تومان</td>
            <td style="font-size: 11.5px;">${Shamsi.formatDate(e.recordedAtUtc)}</td>
          </tr>
        `).join('');
      }
    }
  } catch (err) {
    console.warn('Usage fetch error:', err);
  }
}

function initShamsiDatepicker() {
  const triggerBtn = document.getElementById('btn-shamsi-dp-trigger');
  const popoverBox = document.getElementById('shamsi-dp-popover-box');
  const filterText = document.getElementById('dp-filter-text');

  if (!triggerBtn || !popoverBox) return;

  const dp = new ShamsiDatepicker(popoverBox, (selectedDate, isRange, rangeStart, rangeEnd) => {
    if (isRange && rangeStart && rangeEnd) {
      filterText.textContent = `فیلتر: ${rangeStart.jy}/${rangeStart.jm}/${rangeStart.jd} تا ${rangeEnd.jy}/${rangeEnd.jm}/${rangeEnd.jd}`;
      popoverBox.style.display = 'none';
      loadUsageData();
    } else {
      filterText.textContent = `فیلتر: ${selectedDate.jy}/${selectedDate.jm}/${selectedDate.jd}`;
      popoverBox.style.display = 'none';
      loadUsageData();
    }
  });

  triggerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = popoverBox.style.display === 'none';
    popoverBox.style.display = isHidden ? 'block' : 'none';
  });

  document.addEventListener('click', (e) => {
    if (!popoverBox.contains(e.target) && e.target !== triggerBtn) {
      popoverBox.style.display = 'none';
    }
  });
}

// 5. Project CRUD & Modals
function initModals() {
  const openCreateBtns = [
    document.getElementById('btn-create-proj-modal'),
    document.getElementById('btn-create-first-proj')
  ];

  openCreateBtns.forEach(btn => {
    if (btn) btn.addEventListener('click', () => openModal('modal-create-proj'));
  });

  const formCreate = document.getElementById('form-create-new-project');
  if (formCreate) {
    formCreate.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('new-proj-name').value.trim();
      const slug = document.getElementById('new-proj-slug').value.trim();
      const desc = document.getElementById('new-proj-desc').value.trim();

      try {
        const res = await fetch('/_baas/v1/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, slug, description: desc })
        });

        if (res.ok) {
          const newProj = await res.json();
          closeModal('modal-create-proj');
          formCreate.reset();
          alert('پروژه جدید با موفقیت ایجاد شد.');
          await loadUserProjects(newProj.id);
        } else {
          alert('خطا در ایجاد پروژه.');
        }
      } catch {
        alert('خطای شبکه.');
      }
    });
  }

  const formUpdate = document.getElementById('form-update-project');
  if (formUpdate) {
    formUpdate.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeProjectId) return;

      const name = document.getElementById('set-proj-name').value.trim();
      const slug = document.getElementById('set-proj-slug').value.trim();
      const desc = document.getElementById('set-proj-desc').value.trim();

      try {
        const res = await fetch(`/_baas/v1/projects/${activeProjectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, slug, description: desc })
        });

        if (res.ok) {
          alert('مشخصات پروژه با موفقیت ذخیره شد.');
          await loadUserProjects(activeProjectId);
        } else {
          alert('خطا در به‌روزرسانی پروژه.');
        }
      } catch {
        alert('خطای شبکه.');
      }
    });
  }

  const btnDelete = document.getElementById('btn-delete-project');
  if (btnDelete) {
    btnDelete.addEventListener('click', async () => {
      if (!activeProjectId) return;

      if (!confirm(`آیا مطمئن هستید که می‌خواهید پروژه "${activeProject.name}" را برای همیشه حذف کنید؟`)) {
        return;
      }

      try {
        const res = await fetch(`/_baas/v1/projects/${activeProjectId}`, {
          method: 'DELETE'
        });

        if (res.ok) {
          alert('پروژه با موفقیت حذف گردید.');
          await loadUserProjects();
        } else {
          alert('خطا در حذف پروژه.');
        }
      } catch {
        alert('خطای شبکه.');
      }
    });
  }

  const topupBtn = document.getElementById('btn-open-topup');
  if (topupBtn) {
    topupBtn.addEventListener('click', () => openModal('modal-topup'));
  }

  const formTopup = document.getElementById('form-topup');
  if (formTopup) {
    formTopup.addEventListener('submit', async (e) => {
      e.preventDefault();
      const gateway = document.getElementById('topup-gateway').value;
      const amountToman = parseInt(document.getElementById('topup-amount-toman').value, 10);
      const amountIrr = amountToman * 10;

      try {
        const res = await fetch('/_baas/v1/pay/initiate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amountIrr,
            customerPhone: currentUser.phone,
            gateway,
            callbackUrl: window.location.href
          })
        });

        if (res.ok) {
          const initRes = await res.json();
          const vRes = await fetch('/_baas/v1/pay/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              authority: initRes.authority,
              trackingCode: initRes.trackingCode,
              customerPhone: currentUser.phone
            })
          });

          if (vRes.ok) {
            const vData = await vRes.json();
            alert(`پرداخت الکترونیک موفق شاپرک.\nشماره پیگیری: ${vData.shaparakRefId}\nموجودی جدید: ${Shamsi.toPersianDigits(Math.floor(vData.newWalletBalanceIrr / 10).toLocaleString())} تومان`);
            updateWalletDisplay(vData.newWalletBalanceIrr);
            closeModal('modal-topup');
          }
        }
      } catch {
        alert('خطا در برقراری ارتباط با درگاه پرداخت.');
      }
    });
  }

  const formInsert = document.getElementById('form-insert-db-row');
  if (formInsert) {
    formInsert.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeProjectId || !currentDbTable) return;

      const title = document.getElementById('db-input-title').value.trim();
      const category = document.getElementById('db-input-category').value.trim();
      const price = parseInt(document.getElementById('db-input-price').value, 10);

      try {
        const res = await fetch(`/_baas/v1/${activeProjectId}/db/${currentDbTable}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, category, price, created_at: new Date().toISOString() })
        });

        if (res.ok) {
          document.getElementById('db-input-title').value = '';
          loadTableData(currentDbTable);
          loadUsageData();
        }
      } catch (err) {
        console.warn('Row insert error:', err);
      }
    });
  }

  const refreshDbBtn = document.getElementById('btn-refresh-db');
  if (refreshDbBtn) {
    refreshDbBtn.addEventListener('click', () => {
      if (currentDbTable) loadTableData(currentDbTable);
    });
  }

  const btnExecFunc = document.getElementById('btn-exec-func-test');
  if (btnExecFunc) {
    btnExecFunc.addEventListener('click', async () => {
      if (!activeProjectId || !currentFuncSlug) return;

      const outEl = document.getElementById('func-test-output');
      let bodyObj = {};
      try {
        bodyObj = JSON.parse(document.getElementById('func-test-input').value);
      } catch {
        alert('قالب JSON ورودی معتبر نیست.');
        return;
      }

      outEl.textContent = '// در حال پردازش در موتور Jint...';
      try {
        const res = await fetch(`/_baas/v1/${activeProjectId}/functions/${currentFuncSlug}/exec`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyObj)
        });

        if (res.ok) {
          const result = await res.json();
          outEl.textContent = JSON.stringify(result, null, 2);
          loadUsageData();
        } else {
          outEl.textContent = `// خطا در اجرا: وضعیت ${res.status}`;
        }
      } catch (err) {
        outEl.textContent = `// خطای شبکه: ${err.message}`;
      }
    });
  }
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'flex';
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

function copyFieldValue(inputId) {
  const el = document.getElementById(inputId);
  if (el) {
    navigator.clipboard.writeText(el.value).then(() => {
      alert('کلید دسترسی با موفقیت در کلیپ‌بورد کپی شد.');
    }).catch(() => {
      prompt('کلید دسترسی:', el.value);
    });
  }
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}
