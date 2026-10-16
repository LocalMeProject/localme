// LocalMe BaaS Services Module (Database, Auth, Storage, Functions)
let currentDbTable = null;
let currentFuncSlug = null;
window.projectFunctionsMap = {};

// 1. Render Each Service Page (Disabled banner vs Active container)
function renderAllServices() {
  if (!activeProject) return;

  const services = [
    { key: 'database', title: 'پایگاه داده رابطه‌ای (PostgreSQL REST)', desc: 'اسکیمای مجزا و دسترسی مستقیم REST', view: 'view-db' },
    { key: 'auth', title: 'احراز هویت جامع کاربران (Auth)', desc: 'ورود پیامکی OTP با خط اختصاصی، کلمه‌عبور، و توکن‌های OAuth', view: 'view-auth' },
    { key: 'storage', title: 'ذخیره‌سازی ابری چندرسانه‌ای (Blob Storage)', desc: 'باکت‌های ذخیره فایل‌ها و اسناد با صدور آدرس امن', view: 'view-storage' },
    { key: 'functions', title: 'توابع سرورلس لبه (Edge Functions)', desc: 'اجرای کدهای جاوااسکریپت در محیط ایزوله سریع', view: 'view-functions' }
  ];

  let activeCount = 0;

  // Overview Tab Services Grid
  const ovContainer = document.getElementById('overview-services-list');
  if (ovContainer) {
    ovContainer.innerHTML = services.map(s => {
      const cfg = activeProject.services?.[s.key] || { isEnabled: false };
      if (cfg.isEnabled) activeCount++;

      return `
        <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 14px 18px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 13.5px; font-weight: 700; color: var(--text-main);">${s.title}</span>
              <span class="badge ${cfg.isEnabled ? 'badge-active' : 'badge-paused'}">
                ${cfg.isEnabled ? 'فعال' : 'غیرفعال'}
              </span>
            </div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">${s.desc}</div>
          </div>
          <button type="button" class="btn-secondary" style="font-size: 11.5px; padding: 4px 12px;" onclick="navigateToView('${s.view}')">
            ورود به صفحه سرویس
          </button>
        </div>
      `;
    }).join('');
  }

  setText('ov-val-active-services', `${Shamsi.toPersianDigits(activeCount)} / ۴`);

  // Individual Service Pages
  services.forEach(s => {
    const cfg = activeProject.services?.[s.key] || { isEnabled: false, settings: {}, apiKey: { apiKey: 'تولید نشده' } };
    const isEn = cfg.isEnabled;
    const apiKey = cfg.apiKey?.apiKey || 'تولید نشده';
    const settings = cfg.settings || {};

    const badgeEl = document.getElementById(`${getServicePrefix(s.key)}-status-badge`);
    if (badgeEl) {
      badgeEl.textContent = isEn ? 'فعال و آماده اتصال' : 'غیرفعال (نیاز به پیکربندی)';
      badgeEl.className = isEn ? 'badge badge-active' : 'badge badge-paused';
    }

    const keyValEl = document.getElementById(`${getServicePrefix(s.key)}-api-key-val`);
    if (keyValEl) keyValEl.value = apiKey;

    const disabledBox = document.getElementById(`${getServicePrefix(s.key)}-disabled-box`);
    const activeBox = document.getElementById(`${getServicePrefix(s.key)}-active-box`);

    if (disabledBox && activeBox) {
      disabledBox.style.display = isEn ? 'none' : 'block';
      activeBox.style.display = isEn ? 'block' : 'none';
    }

    populateServiceInputs(s.key, settings);
  });
}

function getServicePrefix(serviceKey) {
  switch (serviceKey) {
    case 'database': return 'db';
    case 'auth': return 'auth';
    case 'storage': return 'storage';
    case 'functions': return 'func';
    default: return serviceKey;
  }
}

function populateServiceInputs(serviceKey, settings) {
  switch (serviceKey) {
    case 'database':
      setVal('db-cfg-schema', settings['schema'] || `public_${activeProjectId}`);
      setVal('db-cfg-conn', settings['max_connections'] || '20');
      setVal('db-active-schema', settings['schema'] || `public_${activeProjectId}`);
      setVal('db-active-conn', settings['max_connections'] || '20');
      break;
    case 'auth':
      setVal('auth-cfg-provider', settings['sms_provider'] || 'kavenegar');
      setVal('auth-cfg-sms-key', settings['sms_api_key'] || '');
      setVal('auth-cfg-sms-num', settings['sms_sender_number'] || '3000777');
      setVal('auth-cfg-sms-pat', settings['sms_pattern_code'] || 'localme-verify');
      setVal('auth-cfg-len', settings['otp_length'] || '6');
      setVal('auth-cfg-ttl', settings['otp_expiry_seconds'] || '120');

      setVal('auth-active-provider', settings['sms_provider'] || 'kavenegar');
      setVal('auth-active-sms-key', settings['sms_api_key'] || '');
      setVal('auth-active-sms-num', settings['sms_sender_number'] || '3000777');
      setVal('auth-active-sms-pat', settings['sms_pattern_code'] || 'localme-verify');
      break;
    case 'storage':
      setVal('storage-cfg-bucket', settings['default_bucket'] || 'assets');
      setVal('storage-cfg-size', settings['max_file_size_mb'] || '50');
      setVal('storage-active-bucket', settings['default_bucket'] || 'assets');
      setVal('storage-active-size', settings['max_file_size_mb'] || '50');
      break;
    case 'functions':
      setVal('func-cfg-mem', settings['memory_limit_mb'] || '16');
      setVal('func-cfg-timeout', settings['timeout_seconds'] || '5');
      setVal('func-active-mem', settings['memory_limit_mb'] || '16');
      setVal('func-active-timeout', settings['timeout_seconds'] || '5');
      break;
  }
}

// 2. In-Page Service Enable / Update / Disable Handlers
function initServiceForms() {
  bindServiceForm('form-enable-db', 'database', true, () => ({
    schema: document.getElementById('db-cfg-schema').value.trim(),
    max_connections: document.getElementById('db-cfg-conn').value
  }));
  bindServiceForm('form-update-db-settings', 'database', true, () => ({
    schema: document.getElementById('db-active-schema').value.trim(),
    max_connections: document.getElementById('db-active-conn').value
  }));

  bindServiceForm('form-enable-auth', 'auth', true, () => ({
    sms_provider: document.getElementById('auth-cfg-provider').value,
    sms_api_key: document.getElementById('auth-cfg-sms-key').value.trim(),
    sms_sender_number: document.getElementById('auth-cfg-sms-num').value.trim(),
    sms_pattern_code: document.getElementById('auth-cfg-sms-pat').value.trim(),
    otp_length: document.getElementById('auth-cfg-len').value,
    otp_expiry_seconds: document.getElementById('auth-cfg-ttl').value
  }));
  bindServiceForm('form-update-auth-settings', 'auth', true, () => ({
    sms_provider: document.getElementById('auth-active-provider').value,
    sms_api_key: document.getElementById('auth-active-sms-key').value.trim(),
    sms_sender_number: document.getElementById('auth-active-sms-num').value.trim(),
    sms_pattern_code: document.getElementById('auth-active-sms-pat').value.trim()
  }));

  bindServiceForm('form-enable-storage', 'storage', true, () => ({
    default_bucket: document.getElementById('storage-cfg-bucket').value.trim(),
    max_file_size_mb: document.getElementById('storage-cfg-size').value
  }));
  bindServiceForm('form-update-storage-settings', 'storage', true, () => ({
    default_bucket: document.getElementById('storage-active-bucket').value.trim(),
    max_file_size_mb: document.getElementById('storage-active-size').value
  }));

  bindServiceForm('form-enable-func', 'functions', true, () => ({
    memory_limit_mb: document.getElementById('func-cfg-mem').value,
    timeout_seconds: document.getElementById('func-cfg-timeout').value
  }));
  bindServiceForm('form-update-func-settings', 'functions', true, () => ({
    memory_limit_mb: document.getElementById('func-active-mem').value,
    timeout_seconds: document.getElementById('func-active-timeout').value
  }));
}

function bindServiceForm(formId, serviceKey, isEnabled, getSettingsFn) {
  const form = document.getElementById(formId);
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeProjectId) return;

    const settings = getSettingsFn();
    await saveServiceConfig(serviceKey, isEnabled, settings);
  });
}

async function disableService(serviceKey) {
  if (!confirm('آیا از غیرفعال‌سازی موقت این سرویس اطمینان دارید؟ در این مدت امکان فراخوانی API آن وجود نخواهد داشت.')) {
    return;
  }
  await saveServiceConfig(serviceKey, false, {});
}

async function saveServiceConfig(serviceKey, isEnabled, settings) {
  try {
    const res = await fetch(`/_baas/v1/projects/${activeProjectId}/services/${serviceKey}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service: serviceKey, isEnabled, settings })
    });

    if (res.ok) {
      const updatedConfig = await res.json();
      if (!activeProject.services) activeProject.services = {};
      activeProject.services[serviceKey] = updatedConfig;

      alert(`سرویس با موفقیت ${isEnabled ? 'فعال و تنظیمات ذخیره' : 'غیرفعال'} شد.`);
      renderAllServices();
    } else {
      alert('خطا در ذخیره تنظیمات سرویس.');
    }
  } catch {
    alert('خطای ارتباط با سرور.');
  }
}

async function regenerateServiceKey(serviceKey) {
  if (!confirm('آیا از صدور مجدد کلید این سرویس اطمینان دارید؟ کلید قبلی بلافاصله باطل خواهد شد.')) {
    return;
  }

  try {
    const res = await fetch(`/_baas/v1/projects/${activeProjectId}/services/${serviceKey}/regenerate-key`, {
      method: 'POST'
    });

    if (res.ok) {
      const newKey = await res.json();
      if (activeProject.services?.[serviceKey]) {
        activeProject.services[serviceKey].apiKey = newKey;
      }
      alert('کلید جدید اختصاصی سرویس با موفقیت صادر شد.');
      renderAllServices();
    } else {
      alert('خطا در صدور مجدد کلید.');
    }
  } catch {
    alert('خطای شبکه.');
  }
}

// 3. Subsystem: Database Studio
async function loadProjectTables() {
  const select = document.getElementById('db-table-select');
  if (!select || !activeProjectId) return;

  try {
    const res = await fetch(`/_baas/v1/${activeProjectId}/db/tables`);
    if (res.ok) {
      const tables = await res.json();
      if (tables.length === 0) {
        select.innerHTML = '<option value="">هیچ جدولی یافت نشد</option>';
        return;
      }

      select.innerHTML = tables.map(t => `<option value="${t}">${t}</option>`).join('');
      currentDbTable = tables[0];
      select.value = currentDbTable;
      loadTableData(currentDbTable);

      select.onchange = () => {
        currentDbTable = select.value;
        loadTableData(currentDbTable);
      };
    }
  } catch (err) {
    console.warn('Tables load error:', err);
  }
}

async function loadTableData(tableName) {
  const thead = document.getElementById('db-table-head');
  const tbody = document.getElementById('db-table-body');
  if (!thead || !tbody || !tableName || !activeProjectId) return;

  try {
    const res = await fetch(`/_baas/v1/${activeProjectId}/db/${tableName}`);
    if (res.ok) {
      const rows = await res.json();
      if (!rows || rows.length === 0) {
        thead.innerHTML = '<tr><th>شناسه</th><th>عنوان</th><th>اطلاعات</th></tr>';
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 18px;">سطری در این جدول وجود ندارد.</td></tr>';
        return;
      }

      const keys = Object.keys(rows[0]);
      thead.innerHTML = '<tr>' + keys.map(k => `<th>${k}</th>`).join('') + '</tr>';
      tbody.innerHTML = rows.map(r => `
        <tr>
          ${keys.map(k => {
            const val = r[k];
            const isJson = typeof val === 'object';
            return `<td style="${k === 'id' ? 'font-family: var(--font-mono); font-size: 11px; color: var(--color-info);' : ''}">${isJson ? JSON.stringify(val) : val}</td>`;
          }).join('')}
        </tr>
      `).join('');
    }
  } catch (err) {
    console.warn('Table rows load error:', err);
  }
}

// 4. Subsystem: Auth & Users
async function loadProjectUsers() {
  const tbody = document.getElementById('auth-users-tbody');
  if (!tbody || !activeProjectId) return;

  try {
    const res = await fetch(`/_baas/v1/${activeProjectId}/auth/users`);
    if (res.ok) {
      const users = await res.json();
      if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 18px;">کاربری در این پروژه ثبت‌نام نکرده است.</td></tr>';
        return;
      }

      tbody.innerHTML = users.map(u => {
        const identifier = u.phone || u.email || '-';
        const providerName = u.provider === 'sms_otp' ? 'پیامک OTP' :
                             u.provider === 'password' ? 'رمز عبور' :
                             u.provider === 'oauth_google' ? 'گوگل (OAuth)' :
                             u.provider === 'oauth_github' ? 'گیت‌هاب (OAuth)' : (u.provider || 'سیستمی');

        return `
          <tr>
            <td style="font-family: var(--font-mono); font-size: 11px; color: var(--color-info);">${u.id}</td>
            <td style="font-family: var(--font-mono); font-weight: 600;">${identifier}</td>
            <td>${u.fullName || '-'}</td>
            <td><span class="badge badge-info" style="font-size: 11px;">${providerName}</span></td>
            <td><span class="badge ${u.isConfirmed !== false ? 'badge-active' : 'badge-paused'}">${u.isConfirmed !== false ? 'فعال و تاییدشده' : 'در انتظار'}</span></td>
            <td style="font-size: 11.5px;">${Shamsi.formatDate(u.createdAtUtc)}</td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    console.warn('Users fetch error:', err);
  }
}

// 5. Subsystem: Storage Buckets
async function loadProjectBuckets() {
  const tbody = document.getElementById('storage-buckets-tbody');
  if (!tbody || !activeProjectId) return;

  try {
    const res = await fetch(`/_baas/v1/${activeProjectId}/storage/buckets`);
    if (res.ok) {
      const buckets = await res.json();
      if (!buckets || buckets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 18px;">باکتی برای ذخیره‌سازی فایل‌ها ایجاد نشده است.</td></tr>';
        return;
      }

      tbody.innerHTML = buckets.map(b => {
        const count = b.objectCount ?? b.fileCount ?? 0;
        const bytes = b.totalSizeBytes ?? b.totalBytes ?? 0;
        return `
          <tr>
            <td style="font-family: var(--font-mono); font-weight: 700;">${b.name}</td>
            <td><span class="badge ${b.isPublic ? 'badge-info' : 'badge-paused'}">${b.isPublic ? 'عمومی (Public)' : 'محرمانه (Private)'}</span></td>
            <td style="font-family: var(--font-mono);">${Shamsi.toPersianDigits(count)}</td>
            <td style="font-family: var(--font-mono); font-size: 11.5px;">${(bytes / (1024*1024)).toFixed(2)} MB</td>
            <td style="font-size: 11.5px;">${Shamsi.formatDate(b.createdAtUtc)}</td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    console.warn('Buckets load error:', err);
  }
}

// 6. Subsystem: Edge Functions
async function loadProjectFunctions() {
  const tbody = document.getElementById('functions-tbody');
  if (!tbody || !activeProjectId) return;

  try {
    const res = await fetch(`/_baas/v1/${activeProjectId}/functions`);
    if (res.ok) {
      const funcs = await res.json();
      window.projectFunctionsMap = {};

      if (!funcs || funcs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 18px;">تابعی برای این پروژه مستقر نشده است. برای شروع «+ استقرار تابع جدید» را کلیک کنید.</td></tr>';
        currentFuncSlug = null;
        setText('active-test-func-slug', '-');
        const preview = document.getElementById('func-script-preview');
        if (preview) preview.value = '// تابعی انتخاب نشده است.';
        return;
      }

      funcs.forEach(f => {
        window.projectFunctionsMap[f.slug] = f;
      });

      tbody.innerHTML = funcs.map(f => `
        <tr>
          <td style="font-weight: 700;">${f.name}</td>
          <td style="font-family: var(--font-mono); font-size: 11.5px;">${f.slug}</td>
          <td style="font-family: var(--font-mono); font-size: 11.5px; color: var(--color-info);">/_baas/v1/${activeProjectId}/functions/${f.slug}</td>
          <td style="font-size: 11.5px;">${Shamsi.formatDate(f.createdAtUtc)}</td>
          <td>
            <button type="button" class="btn-secondary" style="font-size: 11px; padding: 2px 8px;" onclick="selectTestFunc('${f.slug}')">انتخاب و تست</button>
            <button type="button" class="btn-danger" style="font-size: 11px; padding: 2px 8px; margin-right: 4px;" onclick="deleteProjectFunction('${f.slug}')">حذف</button>
          </td>
        </tr>
      `).join('');

      if (currentFuncSlug && window.projectFunctionsMap[currentFuncSlug]) {
        selectTestFunc(currentFuncSlug);
      } else if (funcs.length > 0) {
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
  const func = window.projectFunctionsMap?.[slug];
  const preview = document.getElementById('func-script-preview');
  if (preview && func) {
    preview.value = func.script;
  }
}

async function deleteProjectFunction(slug) {
  if (!confirm(`آیا از حذف تابع "${slug}" اطمینان دارید؟`)) return;

  try {
    const res = await fetch(`/_baas/v1/${activeProjectId}/functions/${slug}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      if (currentFuncSlug === slug) currentFuncSlug = null;
      await loadProjectFunctions();
    } else {
      alert('خطا در حذف تابع.');
    }
  } catch (err) {
    console.warn('Delete function error:', err);
  }
}
