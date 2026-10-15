// LocalMe Multi-Tenant BaaS Console Controller (Cloudflare Light-Mode RTL)
let allProjects = [];
let currentProjectId = null;
let currentProject = null;
let currentTable = null;
let currentFunc = null;

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initProjects();
  initModals();
  initShamsiDatepicker();
  initSuperadmin();
  refreshWallet();
});

// 1. Navigation & Views
function initNavigation() {
  const navItems = document.querySelectorAll('.cf-nav-item');
  const panels = document.querySelectorAll('.view-panel');
  const bcViewName = document.getElementById('bc-view-name');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetView = item.dataset.view;

      navItems.forEach(n => n.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));

      item.classList.add('active');
      const targetPanel = document.getElementById(targetView);
      if (targetPanel) targetPanel.classList.add('active');

      if (bcViewName) {
        bcViewName.textContent = item.innerText.trim();
      }

      // View-specific data refreshes
      if (targetView === 'view-usage') loadUsageData();
      if (targetView === 'view-db') loadTableData();
      if (targetView === 'view-auth') loadProjectUsers();
      if (targetView === 'view-storage') loadProjectBuckets();
      if (targetView === 'view-functions') loadProjectFunctions();
      if (targetView === 'view-superadmin') loadSuperadminData();
    });
  });

  const superadminBtn = document.getElementById('btn-toggle-superadmin');
  if (superadminBtn) {
    superadminBtn.addEventListener('click', () => {
      const adminNav = document.querySelector('[data-view="view-superadmin"]');
      if (adminNav) adminNav.click();
    });
  }
}

// 2. Multi-Tenant Project Management
async function initProjects() {
  const select = document.getElementById('global-project-select');
  try {
    const res = await fetch('/_baas/v1/projects');
    if (res.ok) {
      allProjects = await res.json();
      if (select) {
        select.innerHTML = allProjects.map(p => `
          <option value="${p.id}">${p.name} (${p.id})</option>
        `).join('');

        if (allProjects.length > 0) {
          selectProject(allProjects[0].id);
        }

        select.addEventListener('change', () => selectProject(select.value));
      }
    }
  } catch (err) {
    console.warn('Projects fetch failed:', err);
  }
}

async function selectProject(projectId) {
  currentProjectId = projectId;
  currentProject = allProjects.find(p => p.id === projectId);
  if (!currentProject) return;

  const bcProjName = document.getElementById('bc-project-name');
  if (bcProjName) bcProjName.textContent = currentProject.name;

  const statusBadge = document.getElementById('project-status-badge');
  if (statusBadge) {
    statusBadge.textContent = currentProject.status === 'Active' ? 'فعال (Active)' : 'معلق (Paused)';
    statusBadge.className = currentProject.status === 'Active' ? 'cf-badge cf-badge-active' : 'cf-badge cf-badge-paused';
  }

  // Populate overview inputs
  const ovProjId = document.getElementById('ov-proj-id');
  if (ovProjId) ovProjId.textContent = currentProject.id;

  const apiUrl = document.getElementById('api-url-input');
  if (apiUrl) apiUrl.value = `${window.location.origin}/_baas/v1/${currentProject.id}`;

  const anonKey = document.getElementById('anon-key-input');
  if (anonKey) anonKey.value = currentProject.anonKey;

  const serviceKey = document.getElementById('service-key-input');
  if (serviceKey) serviceKey.value = currentProject.serviceRoleKey;

  // Set Service Toggles
  const toggles = currentProject.services || {};
  setCheckbox('svc-toggle-db', toggles.database ?? true);
  setCheckbox('svc-toggle-auth', toggles.auth ?? true);
  setCheckbox('svc-toggle-storage', toggles.storage ?? true);
  setCheckbox('svc-toggle-functions', toggles.functions ?? true);
  setCheckbox('svc-toggle-sms', toggles.sms ?? true);

  // Load project-scoped sub-resources
  loadUsageData();
  loadProjectTables();
  loadProjectUsers();
  loadProjectBuckets();
  loadProjectFunctions();
}

function setCheckbox(id, checked) {
  const el = document.getElementById(id);
  if (el) el.checked = checked;
}

// 3. Database Studio (Project Scoped)
async function loadProjectTables() {
  if (!currentProjectId) return;
  const select = document.getElementById('db-table-selector');
  try {
    const res = await fetch(`/_baas/v1/projects/${currentProjectId}/tables`);
    if (res.ok) {
      const tableNames = await res.json();
      if (select) {
        if (tableNames.length === 0) {
          select.innerHTML = '<option value="">هیچ جدولی تعریف نشده است</option>';
        } else {
          select.innerHTML = tableNames.map(t => `<option value="${t}">${t}</option>`).join('');
          currentTable = tableNames[0];
          loadTableData();
        }
        select.onchange = () => {
          currentTable = select.value;
          loadTableData();
        };
      }
    }
  } catch (err) {
    console.warn('Tables load error:', err);
  }
}

async function loadTableData() {
  if (!currentProjectId || !currentTable) return;
  const thead = document.getElementById('cf-db-thead');
  const tbody = document.getElementById('cf-db-tbody');
  if (!thead || !tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--cf-text-muted); padding: 20px;">در حال بارگذاری داده‌ها...</td></tr>';

  try {
    const res = await fetch(`/_baas/v1/${currentProjectId}/rest/${currentTable}`);
    if (!res.ok) throw new Error('Fetch failed');
    const rows = await res.json();

    if (!rows || rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--cf-text-muted); padding: 20px;">جدول خالی است.</td></tr>';
      return;
    }

    const keys = Object.keys(rows[0]);
    thead.innerHTML = `<tr>${keys.map(k => `<th>${k}</th>`).join('')}</tr>`;

    tbody.innerHTML = rows.map(r => `
      <tr>
        ${keys.map(k => {
          let val = r[k];
          if (typeof val === 'object' && val !== null) val = JSON.stringify(val);
          return `<td style="font-family: var(--font-mono); font-size: 12px;">${val ?? ''}</td>`;
        }).join('')}
      </tr>
    `).join('');
  } catch {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--cf-red); padding: 20px;">خطا در دریافت اطلاعات جدول.</td></tr>';
  }
}

// 4. End-Users Studio
async function loadProjectUsers() {
  if (!currentProjectId) return;
  const tbody = document.getElementById('auth-users-tbody');
  if (!tbody) return;

  try {
    const res = await fetch(`/_baas/v1/projects/${currentProjectId}/users`);
    if (res.ok) {
      const users = await res.json();
      if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--cf-text-muted); padding: 20px;">هیچ کاربری ثبت نشده است.</td></tr>';
        return;
      }
      tbody.innerHTML = users.map(u => `
        <tr>
          <td style="font-family: var(--font-mono); font-size: 12px; color: var(--cf-blue);">${u.id}</td>
          <td style="font-family: var(--font-mono); font-weight: 600;">${u.phone}</td>
          <td>${u.fullName || '-'}</td>
          <td><span class="cf-badge cf-badge-active">تایید شده</span></td>
          <td style="font-size: 12px;">${Shamsi.formatDate(u.createdAtUtc)}</td>
          <td style="font-size: 12px;">${Shamsi.formatDate(u.lastSignInUtc)}</td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.warn('Users load error:', err);
  }
}

// 5. Storage Buckets Studio
async function loadProjectBuckets() {
  if (!currentProjectId) return;
  const tbody = document.getElementById('storage-buckets-tbody');
  if (!tbody) return;

  try {
    const res = await fetch(`/_baas/v1/projects/${currentProjectId}/buckets`);
    if (res.ok) {
      const buckets = await res.json();
      if (buckets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--cf-text-muted); padding: 20px;">باکتی برای این پروژه وجود ندارد.</td></tr>';
        return;
      }
      tbody.innerHTML = buckets.map(b => `
        <tr>
          <td style="font-weight: 700; color: var(--cf-text-main);">🪣 ${b.name}</td>
          <td><span class="cf-badge ${b.isPublic ? 'cf-badge-active' : 'cf-badge-orange'}">${b.isPublic ? 'عمومی (Public)' : 'محرمانه (Private)'}</span></td>
          <td>${Shamsi.toPersianDigits(b.objectCount)} فایل</td>
          <td style="font-family: var(--font-mono); font-size: 12px;">${(b.totalSizeBytes / (1024 * 1024)).toFixed(1)} MB</td>
          <td style="font-size: 12px;">${Shamsi.formatDate(b.createdAtUtc)}</td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.warn('Buckets load error:', err);
  }
}

// 6. Edge Functions Studio
async function loadProjectFunctions() {
  if (!currentProjectId) return;
  const tbody = document.getElementById('functions-tbody');
  if (!tbody) return;

  try {
    const res = await fetch(`/_baas/v1/projects/${currentProjectId}/functions`);
    if (res.ok) {
      const funcs = await res.json();
      if (funcs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--cf-text-muted); padding: 20px;">هیچ تابعی مستقر نشده است.</td></tr>';
        return;
      }
      tbody.innerHTML = funcs.map(f => `
        <tr>
          <td style="font-weight: 700;">λ ${f.name}</td>
          <td style="font-family: var(--font-mono); font-size: 12px; color: var(--cf-blue);">${f.slug}</td>
          <td style="font-family: var(--font-mono); font-size: 11px;">${f.triggerPath}</td>
          <td style="font-size: 12px;">${Shamsi.formatDate(f.createdAtUtc)}</td>
          <td>
            <button class="btn-cf-secondary" style="padding: 3px 8px; font-size: 11px;" onclick="selectFunctionForTest('${f.slug}', '${f.name}')">تست زنده</button>
          </td>
        </tr>
      `).join('');

      if (funcs.length > 0 && !currentFunc) {
        selectFunctionForTest(funcs[0].slug, funcs[0].name);
      }
    }
  } catch (err) {
    console.warn('Functions load error:', err);
  }
}

function selectFunctionForTest(slug, name) {
  currentFunc = slug;
  const titleEl = document.getElementById('test-func-title');
  if (titleEl) titleEl.textContent = `${name} (${slug})`;
}

// 7. Usage & Metering Analytics (with Shamsi Datepicker)
async function loadUsageData() {
  if (!currentProjectId) return;
  try {
    const res = await fetch(`/_baas/v1/projects/${currentProjectId}/metrics`);
    if (res.ok) {
      const summary = await res.json();

      // Overview cards
      setNum('ov-queries-count', summary.totalDbQueries);
      setNum('ov-sms-count', summary.totalSmsSent);
      setText('ov-cost-toman', summary.formattedTotalCostToman);

      // Usage view boxes
      setNum('usage-db-q', summary.totalDbQueries);
      setNum('usage-sms-cnt', summary.totalSmsSent);
      setText('usage-storage-mb', `${(summary.totalStorageBytes / (1024 * 1024)).toFixed(1)} مگابایت`);
      setNum('usage-compute-ms', summary.totalComputeMs);

      // Usage events table
      const tbody = document.getElementById('usage-events-tbody');
      if (tbody && summary.recentEvents) {
        if (summary.recentEvents.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--cf-text-muted); padding: 16px;">هیچ رخداد مصرفی ثبت نشده است.</td></tr>';
          return;
        }
        tbody.innerHTML = summary.recentEvents.map(e => `
          <tr>
            <td><span class="cf-badge cf-badge-orange">${e.metricType}</span></td>
            <td style="font-family: var(--font-mono); font-weight: 600;">${Shamsi.toPersianDigits(e.quantity)}</td>
            <td style="font-family: var(--font-mono);">${Shamsi.toPersianDigits(e.costIrr)}</td>
            <td style="font-weight: 700; color: #c2410c;">${Shamsi.formatToman(e.costIrr)}</td>
            <td style="font-size: 12px; color: var(--cf-text-muted);">${Shamsi.formatDate(e.timestampUtc)}</td>
          </tr>
        `).join('');
      }
    }
  } catch (err) {
    console.warn('Metrics fetch error:', err);
  }
}

function setNum(id, num) {
  const el = document.getElementById(id);
  if (el) el.textContent = Shamsi.toPersianDigits(num ?? 0);
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// 8. Shamsi Datepicker Popover Init
function initShamsiDatepicker() {
  const trigger = document.getElementById('btn-toggle-datepicker');
  const popover = document.getElementById('shamsi-datepicker-popover');
  const label = document.getElementById('dp-selected-label');

  if (trigger && popover) {
    new Shamsi.Datepicker('shamsi-datepicker-popover', {
      onSelect: (date) => {
        popover.style.display = 'none';
        if (label) {
          label.textContent = `فیلتر: ${Shamsi.toPersianDigits(date.year)}/${Shamsi.toPersianDigits(date.month)}/${Shamsi.toPersianDigits(date.day)}`;
        }
        loadUsageData();
      }
    });

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      popover.style.display = popover.style.display === 'block' ? 'none' : 'block';
    });

    document.addEventListener('click', () => {
      popover.style.display = 'none';
    });
  }
}

// 9. Superadmin Configuration Panel
async function loadSuperadminData() {
  try {
    const res = await fetch('/_baas/v1/superadmin/system');
    if (res.ok) {
      const stats = await res.json();
      setNum('admin-total-proj', stats.totalProjects);
      setNum('admin-total-queries', stats.totalQueriesProcessed);
      setText('admin-total-rev', stats.formattedRevenueToman);

      const p = stats.pricing;
      if (p) {
        setVal('p-db-q', p.dbQueryPer1kIrr);
        setVal('p-sms', p.smsPerMessageIrr);
        setVal('p-storage', p.storageGbMonthIrr);
        setVal('p-compute', p.computePer100msIrr);
        setVal('p-min-topup', p.minWalletTopupIrr);
        setVal('p-free-credit', p.initialFreeCreditIrr);
        setCheckbox('p-maint-mode', p.maintenanceMode);
      }
    }
  } catch (err) {
    console.warn('Superadmin fetch error:', err);
  }
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function initSuperadmin() {
  const form = document.getElementById('admin-pricing-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        DbQueryPer1kIrr: parseInt(document.getElementById('p-db-q').value, 10),
        SmsPerMessageIrr: parseInt(document.getElementById('p-sms').value, 10),
        StorageGbMonthIrr: parseInt(document.getElementById('p-storage').value, 10),
        ComputePer100msIrr: parseInt(document.getElementById('p-compute').value, 10),
        MinWalletTopupIrr: parseInt(document.getElementById('p-min-topup').value, 10),
        InitialFreeCreditIrr: parseInt(document.getElementById('p-free-credit').value, 10),
        MaintenanceMode: document.getElementById('p-maint-mode').checked
      };

      try {
        const res = await fetch('/_baas/v1/superadmin/pricing', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          alert('تعرفه‌ها و متغیرهای سوپرادمین با موفقیت به‌روزرسانی شدند و به صورت بلادرنگ در سیستم اعمال گردیدند.');
          loadSuperadminData();
          loadUsageData();
        } else {
          alert('خطا در به‌روزرسانی تعرفه‌ها.');
        }
      } catch {
        alert('خطای شبکه.');
      }
    });
  }
}

// 10. Modals & Actions
function initModals() {
  const btnCreateProj = document.getElementById('btn-open-create-proj');
  if (btnCreateProj) {
    btnCreateProj.addEventListener('click', () => openModal('modal-create-project'));
  }

  const formCreateProj = document.getElementById('form-create-project');
  if (formCreateProj) {
    formCreateProj.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('cp-name')?.value;
      const slug = document.getElementById('cp-slug')?.value;
      const phone = document.getElementById('cp-phone')?.value;

      try {
        const res = await fetch('/_baas/v1/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ Name: name, Slug: slug, OwnerPhone: phone })
        });
        if (res.ok) {
          closeModal('modal-create-project');
          await initProjects();
        }
      } catch (err) {
        alert('خطا در ایجاد پروژه');
      }
    });
  }

  // Wallet topup
  const btnTopup = document.getElementById('btn-open-topup');
  if (btnTopup) btnTopup.addEventListener('click', () => openModal('modal-topup'));

  const formTopup = document.getElementById('form-topup');
  if (formTopup) {
    formTopup.addEventListener('submit', async (e) => {
      e.preventDefault();
      const gateway = document.getElementById('topup-gateway')?.value;
      const amountToman = parseInt(document.getElementById('topup-amount-toman')?.value || '1000000', 10);
      closeModal('modal-topup');

      try {
        // Step 1: Initiate
        const initRes = await fetch('/_baas/v1/pay/initiate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            Gateway: gateway,
            AmountIrr: amountToman * 10,
            CallbackUrl: '/',
            Description: 'شارژ کیف پول مستاجر از طریق درگاه شاپرک',
            CustomerPhone: '+989121112233',
            IdempotencyKey: `topup_${Date.now()}`
          })
        });
        const initData = await initRes.json();
        if (initData.success) {
          // Simulate instant bank verification
          await fetch('/_baas/v1/pay/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              Gateway: gateway,
              AuthorityToken: initData.authorityToken,
              Status: 'OK'
            })
          });
          refreshWallet();
          alert(`کیف پول شما با موفقیت مبلغ ${Shamsi.toPersianDigits(amountToman.toLocaleString('en-US'))} تومان شارژ گردید.`);
        }
      } catch {
        alert('خطا در پرداخت بانکی.');
      }
    });
  }

  // DB Insert Row Form
  const formInsertRow = document.getElementById('db-insert-row-form');
  if (formInsertRow) {
    formInsertRow.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentProjectId || !currentTable) return;
      const name = document.getElementById('db-field-name')?.value;
      const cat = document.getElementById('db-field-cat')?.value;
      const price = parseInt(document.getElementById('db-field-price')?.value || '0', 10);

      const payload = { title: name, category: cat, price_irr: price };
      try {
        const res = await fetch(`/_baas/v1/${currentProjectId}/rest/${currentTable}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          document.getElementById('db-field-name').value = '';
          loadTableData();
          loadUsageData();
        }
      } catch {
        alert('خطا در ثبت سطر');
      }
    });
  }

  // Edge function test run
  const btnRunFunc = document.getElementById('btn-run-func-test');
  if (btnRunFunc) {
    btnRunFunc.addEventListener('click', async () => {
      if (!currentProjectId || !currentFunc) return;
      const inputJson = document.getElementById('func-input-json')?.value || '{}';
      const outputPre = document.getElementById('func-output-result');

      btnRunFunc.disabled = true;
      btnRunFunc.textContent = 'در حال اجرا...';

      try {
        const res = await fetch(`/_baas/v1/${currentProjectId}/functions/${currentFunc}/invoke`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ Script: '', InputJson: inputJson })
        });
        const data = await res.json();
        if (outputPre) {
          outputPre.textContent = JSON.stringify(data, null, 2);
        }
        loadUsageData();
      } catch {
        if (outputPre) outputPre.textContent = 'خطا در فراخوانی تابع';
      } finally {
        btnRunFunc.disabled = false;
        btnRunFunc.textContent = 'فراخوانی و محاسبه هزینه مصرف';
      }
    });
  }

  // Service toggles save
  const btnSaveSvc = document.getElementById('btn-save-services');
  if (btnSaveSvc) {
    btnSaveSvc.addEventListener('click', async () => {
      if (!currentProjectId) return;
      const toggles = {
        Database: document.getElementById('svc-toggle-db').checked,
        Auth: document.getElementById('svc-toggle-auth').checked,
        Storage: document.getElementById('svc-toggle-storage').checked,
        Functions: document.getElementById('svc-toggle-functions').checked,
        Sms: document.getElementById('svc-toggle-sms').checked
      };

      try {
        const res = await fetch(`/_baas/v1/projects/${currentProjectId}/services`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toggles)
        });
        if (res.ok) alert('پیکربندی سرویس‌های پروژه ذخیره شد.');
      } catch {
        alert('خطای ذخیره‌سازی.');
      }
    });
  }
}

async function refreshWallet() {
  try {
    const res = await fetch('/_baas/v1/wallet/%2B989121112233');
    if (res.ok) {
      const data = await res.json();
      const el = document.getElementById('header-wallet-toman');
      if (el) el.textContent = data.formattedToman;
    }
  } catch (err) {
    console.warn('Wallet refresh failed:', err);
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

function copyText(inputId) {
  const el = document.getElementById(inputId);
  if (el) {
    navigator.clipboard.writeText(el.value).then(() => {
      alert('مقدار در کلیپ‌بورد کپی شد.');
    });
  }
}

function togglePassword(inputId) {
  const el = document.getElementById(inputId);
  if (el) {
    el.type = el.type === 'password' ? 'text' : 'password';
  }
}
