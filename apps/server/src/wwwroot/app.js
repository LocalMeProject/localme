// LocalMe Developer BaaS Console Engine (Light Mode, RTL, Pure Persian)
let currentUser = null;
let userProjects = [];
let activeProjectId = null;
let activeProject = null;
let currentDbTable = null;
let currentFuncSlug = null;

document.addEventListener('DOMContentLoaded', () => {
  initUserSession();
  initSidebarNav();
  initModals();
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
        // EMPTY STATE: User starts with 0 projects!
        if (switcher) switcher.innerHTML = '<option value="">هیچ پروژه‌ای وجود ندارد</option>';
        if (emptyState) emptyState.style.display = 'block';
        if (activeContainer) activeContainer.style.display = 'none';
        activeProjectId = null;
        activeProject = null;
        setText('bc-project-name', 'پروژه‌ای انتخاب نشده');
        return;
      }

      // Projects exist
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

  // Populate Settings tab inputs
  const setName = document.getElementById('set-proj-name');
  if (setName) setName.value = activeProject.name;
  const setSlug = document.getElementById('set-proj-slug');
  if (setSlug) setSlug.value = activeProject.slug;
  const setDesc = document.getElementById('set-proj-desc');
  if (setDesc) setDesc.value = activeProject.description || '';

  // Render Per-Service Cards with Per-Service Keys
  renderServicesList();

  // Load project sub-resources
  loadProjectTables();
  loadProjectUsers();
  loadProjectBuckets();
  loadProjectFunctions();
  loadUsageData();
}

// 3. Render Services & Per-User Per-Project Per-Service API Keys
function renderServicesList() {
  const container = document.getElementById('services-cards-list');
  if (!container || !activeProject) return;

  const servicesDef = [
    { key: 'database', title: 'پایگاه داده رابطه‌ای (PostgreSQL REST)', desc: 'دسترسی امن به جداول داده اختصاصی با ساختار اسکیمای تفکیک‌شده' },
    { key: 'auth', title: 'احراز هویت پیامکی کاربران (SMS OTP)', desc: 'ارسال کدهای یک‌بار مصرف ورود و مدیریت نشست‌های معتبر' },
    { key: 'storage', title: 'ذخیره‌سازی ابری چندرسانه‌ای (Blob Storage)', desc: 'باکت‌های ذخیره فایل‌ها، تصاویر و اسناد با امکان صدور لینک امن' },
    { key: 'functions', title: 'توابع سرورلس لبه (Edge Functions)', desc: 'اجرای کدهای جاوااسکریپت با سقف حافظه ۱۶ مگابایت در محیط ایزوله' },
    { key: 'sms', title: 'پیامک و اطلاع‌رسانی (SMS Service)', desc: 'ارسال اعلان‌های سیستمی و تراکنشی از طریق سرشماره‌های داخلی' }
  ];

  container.innerHTML = servicesDef.map(s => {
    const cfg = activeProject.services?.[s.key] || {
      service: s.key,
      isEnabled: false,
      settings: {},
      apiKey: { apiKey: 'تولید نشده', secretKey: '', role: 'read_write' }
    };

    const isEnabled = cfg.isEnabled;
    const apiKey = cfg.apiKey?.apiKey || 'تولید نشده';
    const secretKey = cfg.apiKey?.secretKey || '';

    return `
      <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 18px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
          <div>
            <div style="font-size: 14px; font-weight: 800; color: var(--text-main);">${s.title}</div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">${s.desc}</div>
          </div>
          <span class="badge ${isEnabled ? 'badge-active' : 'badge-paused'}">
            ${isEnabled ? 'فعال و آماده استفاده' : 'غیرفعال (نیاز به پیکربندی)'}
          </span>
        </div>

        <!-- Service API Key Box -->
        <div style="background: var(--bg-subtle); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 11px; font-weight: 700; color: var(--text-muted);">کلید اختصاصی این سرویس (Service API Key):</span>
            <button type="button" class="btn-secondary" style="padding: 2px 8px; font-size: 11px;" onclick="regenerateServiceKey('${s.key}')">تولید مجدد کلید</button>
          </div>
          <div style="display: flex; gap: 8px;">
            <input type="text" id="key-input-${s.key}" class="input-field input-mono" value="${apiKey}" readonly />
            <button type="button" class="btn-secondary" style="font-size: 11px;" onclick="copyFieldValue('key-input-${s.key}')">کپی</button>
          </div>
        </div>

        <!-- Configuration Actions -->
        <div style="display: flex; justify-content: flex-end; gap: 8px;">
          <button type="button" class="btn-primary" style="font-size: 12px; padding: 6px 14px;" onclick="openConfigureModal('${s.key}', '${s.title}', ${isEnabled})">
            پیکربندی و تنظیمات سرویس
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// 4. Configure Service Modal & API Key Regeneration
function openConfigureModal(serviceKey, serviceTitle, isEnabled) {
  const modal = document.getElementById('modal-configure-service');
  const titleEl = document.getElementById('cfg-modal-title');
  const hiddenInput = document.getElementById('cfg-service-name');
  const checkbox = document.getElementById('cfg-is-enabled');
  const dynamicFields = document.getElementById('cfg-dynamic-fields');

  if (titleEl) titleEl.textContent = `پیکربندی: ${serviceTitle}`;
  if (hiddenInput) hiddenInput.value = serviceKey;
  if (checkbox) checkbox.checked = isEnabled;

  const existingSettings = activeProject?.services?.[serviceKey]?.settings || {};

  if (dynamicFields) {
    if (serviceKey === 'database') {
      dynamicFields.innerHTML = `
        <div>
          <label style="font-size: 11.5px; font-weight: 600; display: block; margin-bottom: 3px;">نام اسکیمای دیتابیس</label>
          <input type="text" id="cfg-field-schema" class="input-field input-mono" value="${existingSettings['schema'] || 'public_' + activeProjectId}" />
        </div>
        <div>
          <label style="font-size: 11.5px; font-weight: 600; display: block; margin-bottom: 3px;">حداکثر اتصالات همزمان</label>
          <input type="number" id="cfg-field-max-conn" class="input-field input-mono" value="${existingSettings['max_connections'] || '20'}" />
        </div>
      `;
    } else if (serviceKey === 'auth') {
      dynamicFields.innerHTML = `
        <div>
          <label style="font-size: 11.5px; font-weight: 600; display: block; margin-bottom: 3px;">طول کد پیامکی یک‌بار مصرف</label>
          <input type="number" id="cfg-field-otp-len" class="input-field input-mono" value="${existingSettings['otp_length'] || '6'}" />
        </div>
        <div>
          <label style="font-size: 11.5px; font-weight: 600; display: block; margin-bottom: 3px;">مدت اعتبار کد (ثانیه)</label>
          <input type="number" id="cfg-field-otp-ttl" class="input-field input-mono" value="${existingSettings['otp_expiry_seconds'] || '120'}" />
        </div>
      `;
    } else if (serviceKey === 'storage') {
      dynamicFields.innerHTML = `
        <div>
          <label style="font-size: 11.5px; font-weight: 600; display: block; margin-bottom: 3px;">نام باکت پیش‌فرض</label>
          <input type="text" id="cfg-field-bucket" class="input-field input-mono" value="${existingSettings['default_bucket'] || 'assets'}" />
        </div>
        <div>
          <label style="font-size: 11.5px; font-weight: 600; display: block; margin-bottom: 3px;">حداکثر حجم فایل (مگابایت)</label>
          <input type="number" id="cfg-field-max-file" class="input-field input-mono" value="${existingSettings['max_file_size_mb'] || '50'}" />
        </div>
      `;
    } else if (serviceKey === 'functions') {
      dynamicFields.innerHTML = `
        <div>
          <label style="font-size: 11.5px; font-weight: 600; display: block; margin-bottom: 3px;">سقف مصرف حافظه رم (مگابایت)</label>
          <input type="number" id="cfg-field-ram" class="input-field input-mono" value="${existingSettings['memory_limit_mb'] || '16'}" />
        </div>
        <div>
          <label style="font-size: 11.5px; font-weight: 600; display: block; margin-bottom: 3px;">محدودیت زمان اجرا (ثانیه)</label>
          <input type="number" id="cfg-field-timeout" class="input-field input-mono" value="${existingSettings['timeout_seconds'] || '5'}" />
        </div>
      `;
    } else if (serviceKey === 'sms') {
      dynamicFields.innerHTML = `
        <div>
          <label style="font-size: 11.5px; font-weight: 600; display: block; margin-bottom: 3px;">ارائه‌دهنده پیامک</label>
          <select id="cfg-field-sms-provider" class="input-field">
            <option value="magfa">مگفا (Magfa)</option>
            <option value="kavenegar">کاوه‌نگار (Kavenegar)</option>
          </select>
        </div>
        <div>
          <label style="font-size: 11.5px; font-weight: 600; display: block; margin-bottom: 3px;">سرشماره اختصاصی ارسال</label>
          <input type="text" id="cfg-field-sms-num" class="input-field input-mono" value="${existingSettings['sender_number'] || '3000777'}" />
        </div>
      `;
    }
  }

  openModal('modal-configure-service');
}

async function regenerateServiceKey(service) {
  if (!confirm(`آیا از ابطال و تولید مجدد کلید دسترسی سرویس ${service} اطمینان دارید؟`)) return;

  try {
    const res = await fetch(`/_baas/v1/projects/${activeProjectId}/services/${service}/regenerate-key`, {
      method: 'POST'
    });
    if (res.ok) {
      alert('کلید دسترسی جدید با موفقیت صادر شد.');
      await loadUserProjects(activeProjectId);
    }
  } catch {
    alert('خطا در صدور کلید جدید.');
  }
}

// 5. Database Studio Logic
async function loadProjectTables() {
  if (!activeProjectId) return;
  const select = document.getElementById('db-table-select');
  try {
    const res = await fetch(`/_baas/v1/projects/${activeProjectId}/tables`);
    if (res.ok) {
      const tables = await res.json();
      if (select) {
        if (!tables || tables.length === 0) {
          select.innerHTML = '<option value="">هیچ جدولی تعریف نشده است</option>';
          currentDbTable = null;
        } else {
          select.innerHTML = tables.map(t => `<option value="${t}">${t}</option>`).join('');
          currentDbTable = tables[0];
          loadTableRows();
        }
        select.onchange = () => {
          currentDbTable = select.value;
          loadTableRows();
        };
      }
    }
  } catch (err) {
    console.warn('DB tables load error:', err);
  }
}

async function loadTableRows() {
  if (!activeProjectId || !currentDbTable) return;
  const thead = document.getElementById('db-table-head');
  const tbody = document.getElementById('db-table-body');
  if (!thead || !tbody) return;

  tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 18px;">در حال بارگذاری داده‌ها...</td></tr>';

  try {
    const res = await fetch(`/_baas/v1/${activeProjectId}/rest/${currentDbTable}`);
    if (!res.ok) throw new Error('Fetch failed');
    const rows = await res.json();

    if (!rows || rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 18px;">جدول خالی است.</td></tr>';
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
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--color-danger); padding: 18px;">خطا در دریافت اطلاعات جدول.</td></tr>';
  }
}

// 6. Users Studio
async function loadProjectUsers() {
  if (!activeProjectId) return;
  const tbody = document.getElementById('auth-users-tbody');
  if (!tbody) return;

  try {
    const res = await fetch(`/_baas/v1/projects/${activeProjectId}/users`);
    if (res.ok) {
      const users = await res.json();
      if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 18px;">هیچ کاربری در این اپلیکیشن عضو نشده است.</td></tr>';
        return;
      }
      tbody.innerHTML = users.map(u => `
        <tr>
          <td style="font-family: var(--font-mono); font-size: 11.5px; color: var(--color-info);">${u.id}</td>
          <td style="font-family: var(--font-mono); font-weight: 600;">${u.phone}</td>
          <td>${u.fullName || '-'}</td>
          <td><span class="badge badge-active">تایید شده</span></td>
          <td style="font-size: 11.5px;">${Shamsi.formatDate(u.createdAtUtc)}</td>
          <td style="font-size: 11.5px;">${Shamsi.formatDate(u.lastSignInUtc)}</td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.warn('Users load error:', err);
  }
}

// 7. Buckets Studio
async function loadProjectBuckets() {
  if (!activeProjectId) return;
  const tbody = document.getElementById('storage-buckets-tbody');
  if (!tbody) return;

  try {
    const res = await fetch(`/_baas/v1/projects/${activeProjectId}/buckets`);
    if (res.ok) {
      const buckets = await res.json();
      if (!buckets || buckets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 18px;">باکتی برای این پروژه ساخته نشده است.</td></tr>';
        return;
      }
      tbody.innerHTML = buckets.map(b => `
        <tr>
          <td style="font-weight: 700;">${b.name}</td>
          <td><span class="badge ${b.isPublic ? 'badge-active' : 'badge-paused'}">${b.isPublic ? 'عمومی' : 'محرمانه'}</span></td>
          <td>${Shamsi.toPersianDigits(b.objectCount)} فایل</td>
          <td style="font-family: var(--font-mono); font-size: 12px;">${(b.totalSizeBytes / (1024 * 1024)).toFixed(1)} MB</td>
          <td style="font-size: 11.5px;">${Shamsi.formatDate(b.createdAtUtc)}</td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.warn('Buckets load error:', err);
  }
}

// 8. Functions Studio
async function loadProjectFunctions() {
  if (!activeProjectId) return;
  const tbody = document.getElementById('functions-tbody');
  if (!tbody) return;

  try {
    const res = await fetch(`/_baas/v1/projects/${activeProjectId}/functions`);
    if (res.ok) {
      const funcs = await res.json();
      if (!funcs || funcs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 18px;">هیچ تابعی مستقر نشده است.</td></tr>';
        return;
      }
      tbody.innerHTML = funcs.map(f => `
        <tr>
          <td style="font-weight: 700;">${f.name}</td>
          <td style="font-family: var(--font-mono); font-size: 11.5px; color: var(--brand-dark);">${f.slug}</td>
          <td style="font-family: var(--font-mono); font-size: 11px;">${f.triggerPath}</td>
          <td style="font-size: 11.5px;">${Shamsi.formatDate(f.createdAtUtc)}</td>
          <td>
            <button type="button" class="btn-secondary" style="padding: 2px 8px; font-size: 11px;" onclick="selectTestFunc('${f.slug}')">تست</button>
          </td>
        </tr>
      `).join('');

      if (funcs.length > 0 && !currentFuncSlug) {
        selectTestFunc(funcs[0].slug);
      }
    }
  } catch (err) {
    console.warn('Functions load error:', err);
  }
}

function selectTestFunc(slug) {
  currentFuncSlug = slug;
  setText('active-test-func-slug', slug);
}

// 9. Usage & Metering (with Shamsi Datepicker)
async function loadUsageData() {
  if (!activeProjectId) return;
  try {
    const res = await fetch(`/_baas/v1/projects/${activeProjectId}/metrics`);
    if (res.ok) {
      const data = await res.json();
      setNum('usage-val-db', data.totalDbQueries);
      setNum('usage-val-sms', data.totalSmsSent);
      setNum('usage-val-compute', data.totalComputeMs);
      setText('usage-val-cost', data.formattedTotalCostToman);

      const tbody = document.getElementById('usage-events-tbody');
      if (tbody && data.recentEvents) {
        if (data.recentEvents.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 16px;">هیچ رخدادی ثبت نشده است.</td></tr>';
          return;
        }
        tbody.innerHTML = data.recentEvents.map(e => `
          <tr>
            <td><span class="badge badge-info">${e.metricType}</span></td>
            <td style="font-family: var(--font-mono); font-weight: 600;">${Shamsi.toPersianDigits(e.quantity)}</td>
            <td style="font-family: var(--font-mono);">${Shamsi.toPersianDigits(e.costIrr)}</td>
            <td style="font-weight: 700; color: var(--brand-dark);">${Shamsi.formatToman(e.costIrr)}</td>
            <td style="font-size: 11.5px; color: var(--text-muted);">${Shamsi.formatDate(e.timestampUtc)}</td>
          </tr>
        `).join('');
      }
    }
  } catch (err) {
    console.warn('Usage fetch error:', err);
  }
}

// 10. Shamsi Datepicker Popover
function initShamsiDatepicker() {
  const trigger = document.getElementById('btn-shamsi-dp-trigger');
  const popover = document.getElementById('shamsi-dp-popover-box');
  const label = document.getElementById('dp-filter-text');

  if (trigger && popover) {
    new Shamsi.Datepicker('shamsi-dp-popover-box', {
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

// 11. Sidebar Navigation
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

      if (targetView === 'view-db') loadTableRows();
      if (targetView === 'view-usage') loadUsageData();
      if (targetView === 'view-auth') loadProjectUsers();
      if (targetView === 'view-storage') loadProjectBuckets();
      if (targetView === 'view-functions') loadProjectFunctions();
    });
  });
}

// 12. Modals & Actions
function initModals() {
  // Open Create Project Modal
  const btnOpenModal = document.getElementById('btn-create-proj-modal');
  const btnEmptyFirst = document.getElementById('btn-create-first-proj');
  if (btnOpenModal) btnOpenModal.addEventListener('click', () => openModal('modal-create-proj'));
  if (btnEmptyFirst) btnEmptyFirst.addEventListener('click', () => openModal('modal-create-proj'));

  // Submit Create Project Form
  const formCreateProj = document.getElementById('form-create-new-project');
  if (formCreateProj) {
    formCreateProj.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('new-proj-name')?.value;
      const slug = document.getElementById('new-proj-slug')?.value;
      const desc = document.getElementById('new-proj-desc')?.value;

      try {
        const res = await fetch('/_baas/v1/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ Name: name, Slug: slug, Description: desc })
        });
        if (res.ok) {
          const created = await res.json();
          closeModal('modal-create-proj');
          document.getElementById('new-proj-name').value = '';
          document.getElementById('new-proj-slug').value = '';
          document.getElementById('new-proj-desc').value = '';
          await loadUserProjects(created.id);
        }
      } catch {
        alert('خطا در ایجاد پروژه.');
      }
    });
  }

  // Update Project Form
  const formUpdateProj = document.getElementById('form-update-project');
  if (formUpdateProj) {
    formUpdateProj.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeProjectId) return;
      const name = document.getElementById('set-proj-name')?.value;
      const slug = document.getElementById('set-proj-slug')?.value;
      const desc = document.getElementById('set-proj-desc')?.value;

      try {
        const res = await fetch(`/_baas/v1/projects/${activeProjectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ Name: name, Slug: slug, Description: desc })
        });
        if (res.ok) {
          alert('مشخصات پروژه با موفقیت ذخیره گردید.');
          await loadUserProjects(activeProjectId);
        }
      } catch {
        alert('خطا در به‌روزرسانی پروژه.');
      }
    });
  }

  // Delete Project Button
  const btnDeleteProj = document.getElementById('btn-delete-project');
  if (btnDeleteProj) {
    btnDeleteProj.addEventListener('click', async () => {
      if (!activeProjectId) return;
      if (!confirm(`آیا مطمئن هستید که می‌خواهید پروژه «${activeProject.name}» را به صورت دائمی حذف کنید؟`)) return;

      try {
        const res = await fetch(`/_baas/v1/projects/${activeProjectId}`, {
          method: 'DELETE'
        });
        if (res.ok) {
          alert('پروژه با موفقیت حذف گردید.');
          await loadUserProjects();
        }
      } catch {
        alert('خطا در حذف پروژه.');
      }
    });
  }

  // Submit Configure Service Form
  const formCfgService = document.getElementById('form-configure-service');
  if (formCfgService) {
    formCfgService.addEventListener('submit', async (e) => {
      e.preventDefault();
      const serviceName = document.getElementById('cfg-service-name')?.value;
      const isEnabled = document.getElementById('cfg-is-enabled')?.checked;
      const settings = {};

      if (serviceName === 'database') {
        settings['schema'] = document.getElementById('cfg-field-schema')?.value;
        settings['max_connections'] = document.getElementById('cfg-field-max-conn')?.value;
      } else if (serviceName === 'auth') {
        settings['otp_length'] = document.getElementById('cfg-field-otp-len')?.value;
        settings['otp_expiry_seconds'] = document.getElementById('cfg-field-otp-ttl')?.value;
      } else if (serviceName === 'storage') {
        settings['default_bucket'] = document.getElementById('cfg-field-bucket')?.value;
        settings['max_file_size_mb'] = document.getElementById('cfg-field-max-file')?.value;
      } else if (serviceName === 'functions') {
        settings['memory_limit_mb'] = document.getElementById('cfg-field-ram')?.value;
        settings['timeout_seconds'] = document.getElementById('cfg-field-timeout')?.value;
      } else if (serviceName === 'sms') {
        settings['provider'] = document.getElementById('cfg-field-sms-provider')?.value;
        settings['sender_number'] = document.getElementById('cfg-field-sms-num')?.value;
      }

      try {
        const res = await fetch(`/_baas/v1/projects/${activeProjectId}/services/configure`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ Service: serviceName, IsEnabled: isEnabled, Settings: settings })
        });
        if (res.ok) {
          closeModal('modal-configure-service');
          await loadUserProjects(activeProjectId);
        }
      } catch {
        alert('خطا در ذخیره پیکربندی سرویس.');
      }
    });
  }

  // Wallet Top-Up
  const btnOpenTopup = document.getElementById('btn-open-topup');
  if (btnOpenTopup) btnOpenTopup.addEventListener('click', () => openModal('modal-topup'));

  const formTopup = document.getElementById('form-topup');
  if (formTopup) {
    formTopup.addEventListener('submit', async (e) => {
      e.preventDefault();
      const gateway = document.getElementById('topup-gateway')?.value;
      const amountToman = parseInt(document.getElementById('topup-amount-toman')?.value || '1000000', 10);
      closeModal('modal-topup');

      try {
        const initRes = await fetch('/_baas/v1/pay/initiate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            Gateway: gateway,
            AmountIrr: amountToman * 10,
            CallbackUrl: '/panel',
            Description: 'شارژ کیف پول توسعه‌دهنده با درگاه شاپرک',
            CustomerPhone: currentUser.phone,
            IdempotencyKey: `topup_${Date.now()}`
          })
        });
        const initData = await initRes.json();
        if (initData.success) {
          await fetch('/_baas/v1/pay/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              Gateway: gateway,
              AuthorityToken: initData.authorityToken,
              Status: 'OK'
            })
          });
          initUserSession();
          alert(`کیف پول شما به مبلغ ${Shamsi.toPersianDigits(amountToman.toLocaleString('en-US'))} تومان شارژ گردید.`);
        }
      } catch {
        alert('خطا در تراکنش بانکی.');
      }
    });
  }

  // DB Insert Row Form
  const formInsertDbRow = document.getElementById('form-insert-db-row');
  if (formInsertDbRow) {
    formInsertDbRow.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeProjectId || !currentDbTable) return;
      const title = document.getElementById('db-input-title')?.value;
      const cat = document.getElementById('db-input-category')?.value;
      const price = parseInt(document.getElementById('db-input-price')?.value || '0', 10);

      try {
        const res = await fetch(`/_baas/v1/${activeProjectId}/rest/${currentDbTable}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, category: cat, price_irr: price })
        });
        if (res.ok) {
          document.getElementById('db-input-title').value = '';
          loadTableRows();
          loadUsageData();
        }
      } catch {
        alert('خطا در ثبت سطر دیتابیس.');
      }
    });
  }

  // Edge Function Exec Test
  const btnExecFunc = document.getElementById('btn-exec-func-test');
  if (btnExecFunc) {
    btnExecFunc.addEventListener('click', async () => {
      if (!activeProjectId || !currentFuncSlug) return;
      const inputJson = document.getElementById('func-test-input')?.value || '{}';
      const outputPre = document.getElementById('func-test-output');

      btnExecFunc.disabled = true;
      btnExecFunc.textContent = 'در حال اجرا...';

      try {
        const res = await fetch(`/_baas/v1/${activeProjectId}/functions/${currentFuncSlug}/invoke`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ Script: '', InputJson: inputJson })
        });
        const data = await res.json();
        if (outputPre) outputPre.textContent = JSON.stringify(data, null, 2);
        loadUsageData();
      } catch {
        if (outputPre) outputPre.textContent = 'خطا در اجرای تابع.';
      } finally {
        btnExecFunc.disabled = false;
        btnExecFunc.textContent = 'اجرا و کسر مصرف';
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

function copyFieldValue(id) {
  const el = document.getElementById(id);
  if (el) {
    navigator.clipboard.writeText(el.value).then(() => {
      alert('مقدار کلید در کلیپ‌بورد کپی شد.');
    });
  }
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setNum(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = Shamsi.toPersianDigits(val ?? 0);
}
