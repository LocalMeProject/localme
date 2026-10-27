// LocalMe BaaS - Core Services, Quickstart & Governance

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// LocalMe BaaS Services Module (Database, Auth, Storage, Functions)
let currentDbTable = null;
let currentFuncSlug = null;
window.projectFunctionsMap = {};

// 1. Render Each Service Page (Disabled banner vs Active container)
function renderAllServices() {
  if (!activeProject) return;

  const services = [
    { key: 'database', title: 'پایگاه داده رابطه ای', desc: 'اسکیمای مجزا، جداول و دسترسی مستقیم RESTful', view: 'view-db' },
    { key: 'auth', title: 'احراز هویت جامع کاربران', desc: 'ورود پیامکی با خط اختصاصی، کلمه عبور، و توکن های معتبر', view: 'view-auth' },
    { key: 'storage', title: 'ذخیره سازی ابری چندرسانه ای', desc: 'باکت های ذخیره فایل ها و اسناد با صدور آدرس امن', view: 'view-storage' },
    { key: 'functions', title: 'توابع سرورلس لبه', desc: 'اجرای کدهای جاوااسکریپت در محیط ایزوله سریع Jint', view: 'view-functions' },
    { key: 'ipg', title: 'درگاه پرداخت شاپرک', desc: 'تراکنش های شتابی آنلاین با کلیه بانک های عضو شاپرک', view: 'view-ipg-config' },
    { key: 'mobile', title: 'سرویس های موبایل و پوش', desc: 'اعلان به اپلیکیشن های موبایل، خرید کافه بازار و مایکت و وب سوکت', view: 'view-mobile-push' },
    { key: 'hosting', title: 'میزبانی وب و استقرار ایستا', desc: 'استقرار SPA و اتصال دامنه اختصاصی با SSL خودکار', view: 'view-hosting-deployments' },
    { key: 'compliance', title: 'مجوزها، اینماد و دیپ لینک قانونی', desc: 'تاییدیه نماد الکترونیکی و پیکربندی دیپ لینک اپلیکیشن موبایل', view: 'view-compliance-tokens' }
  ];

  let activeCount = 0;

  // Overview Tab Services Grid
  const ovContainer = document.getElementById('overview-services-list');
  if (ovContainer) {
    ovContainer.innerHTML = services.map(s => {
      const cfg = activeProject.services?.[s.key] || { isEnabled: false };
      if (cfg.isEnabled) activeCount++;

      return `
        <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 13.5px; font-weight: 700; color: var(--text-main);">${s.title}</span>
              <span class="badge ${cfg.isEnabled ? 'badge-active' : 'badge-paused'}">
                ${cfg.isEnabled ? 'فعال' : 'غیرفعال'}
              </span>
            </div>
            <div style="font-size: 13px; color: var(--text-muted); margin-top: 2px;">${s.desc}</div>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button type="button" class="${cfg.isEnabled ? 'btn-danger' : 'btn-primary'}" style="font-size: 12.5px; padding: 4px 12px;" onclick="${cfg.isEnabled ? `disableService('${s.key}')` : `quickEnableService('${s.key}')`}">
              ${cfg.isEnabled ? 'غیرفعال سازی' : 'فعال سازی سرویس'}
            </button>
            <button type="button" class="btn-secondary" style="font-size: 13px; padding: 4px 12px;" onclick="navigateToView('${s.view}')">
              ورود به صفحه سرویس
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  setText('ov-val-active-services', `${Shamsi.toPersianDigits(activeCount)} / ${Shamsi.toPersianDigits(services.length)}`);

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

    const disabledBox = document.getElementById(`${getServicePrefix(s.key)}-disabled-box`) || document.getElementById(`${s.key}-disabled-box`);
    const activeBox = document.getElementById(`${getServicePrefix(s.key)}-active-box`) || document.getElementById(`${s.key}-active-box`);

    if (disabledBox && activeBox) {
      disabledBox.style.display = isEn ? 'none' : 'block';
      activeBox.style.display = isEn ? 'block' : 'none';
    }

    populateServiceInputs(s.key, settings);
  });

  const fnCfg = activeProject.services?.functions || { isEnabled: false };
  const banner = document.getElementById('overview-edge-func-banner');
  if (banner) {
    banner.style.display = fnCfg.isEnabled ? 'none' : 'flex';
  }
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
      const setChecked = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.checked = val;
      };
      setChecked('auth-cfg-allow-password', settings['enable_password_auth'] !== 'false');
      setChecked('auth-cfg-enable-captcha', settings['enable_captcha'] === 'true');
      setChecked('auth-cfg-enable-otp', settings['enable_otp_sms'] === 'true');
      setChecked('auth-cfg-allow-oauth', settings['enable_oauth'] !== 'false');
      setChecked('auth-cfg-allow-magiclink', settings['enable_magiclink'] === 'true');

      setChecked('auth-active-allow-password', settings['enable_password_auth'] !== 'false');
      setChecked('auth-active-enable-captcha', settings['enable_captcha'] === 'true');
      const isOtpActive = settings['enable_otp_sms'] === 'true';
      setChecked('auth-active-enable-otp', isOtpActive);
      setChecked('auth-active-allow-oauth', settings['enable_oauth'] !== 'false');
      setChecked('auth-active-allow-magiclink', settings['enable_magiclink'] === 'true');
      const smsPanel = document.getElementById('auth-sms-settings-panel');
      if (smsPanel) smsPanel.style.display = isOtpActive ? 'grid' : 'none';

      setVal('auth-active-sms-provider', settings['sms_provider'] || 'kavenegar');
      setVal('auth-active-sms-key', settings['sms_api_key'] || '');
      setVal('auth-active-sms-num', settings['sms_sender_number'] || '3000777');
      setVal('auth-active-otp-len', settings['otp_length'] || '6');
      break;
    case 'storage':
      setVal('storage-cfg-quota', settings['quota_mb'] || settings['max_file_size_mb'] || '1024');
      setVal('storage-cfg-cors', settings['cors'] || '*');
      setVal('storage-cfg-bucket', settings['default_bucket'] || 'assets');
      setVal('storage-cfg-size', settings['max_file_size_mb'] || '50');
      setVal('storage-active-quota', settings['quota_mb'] || settings['max_file_size_mb'] || '1024');
      setVal('storage-active-cors', settings['cors'] || '*');
      setVal('storage-active-bucket', settings['default_bucket'] || 'assets');
      setVal('storage-active-size', settings['max_file_size_mb'] || '50');
      break;
    case 'functions':
      setVal('func-cfg-memory', settings['memory_limit_mb'] || '16');
      setVal('func-cfg-mem', settings['memory_limit_mb'] || '16');
      setVal('func-cfg-timeout', settings['timeout_seconds'] || '5000');
      setVal('func-active-memory', settings['memory_limit_mb'] || '16');
      setVal('func-active-mem', settings['memory_limit_mb'] || '16');
      setVal('func-active-timeout', settings['timeout_seconds'] || '5000');
      break;
  }
}

// 2. In-Page Service Enable / Update / Disable Handlers
function initServiceForms() {
  bindServiceForm('form-enable-db', 'database', true, () => ({
    schema: (document.getElementById('db-cfg-schema')?.value || `public_${activeProjectId}`).trim(),
    max_connections: document.getElementById('db-cfg-conn')?.value || '20'
  }));
  bindServiceForm('form-update-db-settings', 'database', true, () => ({
    schema: (document.getElementById('db-active-schema')?.value || `public_${activeProjectId}`).trim(),
    max_connections: document.getElementById('db-active-conn')?.value || '20'
  }));

  bindServiceForm('form-enable-auth', 'auth', true, () => ({
    enable_password_auth: document.getElementById('auth-cfg-allow-password')?.checked ? 'true' : 'false',
    enable_captcha: document.getElementById('auth-cfg-enable-captcha')?.checked ? 'true' : 'false',
    enable_otp_sms: document.getElementById('auth-cfg-enable-otp')?.checked ? 'true' : 'false',
    enable_oauth: document.getElementById('auth-cfg-allow-oauth')?.checked ? 'true' : 'false',
    enable_magiclink: document.getElementById('auth-cfg-allow-magiclink')?.checked ? 'true' : 'false',
    sms_provider: 'kavenegar',
    sms_api_key: '',
    sms_sender_number: '3000777',
    sms_pattern_code: 'localme-verify',
    otp_length: '6',
    otp_expiry_seconds: '120'
  }));
  bindServiceForm('form-update-auth-settings', 'auth', true, () => ({
    enable_password_auth: document.getElementById('auth-active-allow-password')?.checked ? 'true' : 'false',
    enable_captcha: document.getElementById('auth-active-enable-captcha')?.checked ? 'true' : 'false',
    enable_otp_sms: document.getElementById('auth-active-enable-otp')?.checked ? 'true' : 'false',
    enable_oauth: document.getElementById('auth-active-allow-oauth')?.checked ? 'true' : 'false',
    enable_magiclink: document.getElementById('auth-active-allow-magiclink')?.checked ? 'true' : 'false',
    sms_provider: document.getElementById('auth-active-sms-provider')?.value || 'kavenegar',
    sms_api_key: document.getElementById('auth-active-sms-key')?.value.trim() || '',
    sms_sender_number: document.getElementById('auth-active-sms-num')?.value.trim() || '3000777',
    otp_length: document.getElementById('auth-active-otp-len')?.value || '6'
  }));

  bindServiceForm('form-enable-storage', 'storage', true, () => ({
    quota_mb: (document.getElementById('storage-cfg-quota') || document.getElementById('storage-cfg-size'))?.value || '1024',
    cors: document.getElementById('storage-cfg-cors')?.value || '*',
    default_bucket: (document.getElementById('storage-cfg-bucket'))?.value?.trim() || 'assets',
    max_file_size_mb: (document.getElementById('storage-cfg-size') || document.getElementById('storage-cfg-quota'))?.value || '50'
  }));
  bindServiceForm('form-update-storage-settings', 'storage', true, () => ({
    quota_mb: (document.getElementById('storage-active-quota') || document.getElementById('storage-active-size'))?.value || '1024',
    cors: document.getElementById('storage-active-cors')?.value || '*',
    default_bucket: (document.getElementById('storage-active-bucket'))?.value?.trim() || 'assets',
    max_file_size_mb: (document.getElementById('storage-active-size') || document.getElementById('storage-active-quota'))?.value || '50'
  }));

  bindServiceForm('form-enable-func', 'functions', true, () => ({
    memory_limit_mb: (document.getElementById('func-cfg-memory') || document.getElementById('func-cfg-mem'))?.value || '16',
    timeout_seconds: document.getElementById('func-cfg-timeout')?.value || '5000'
  }));
  bindServiceForm('form-update-func-settings', 'functions', true, () => ({
    memory_limit_mb: (document.getElementById('func-active-memory') || document.getElementById('func-active-mem'))?.value || '16',
    timeout_seconds: document.getElementById('func-active-timeout')?.value || '5000'
  }));
}

async function quickEnableService(serviceKey) {
  if (!activeProjectId) return;
  const defaultSettings = {
    database: { schema: `public_${activeProjectId}`, max_connections: '20' },
    auth: { enable_password_auth: 'true', enable_otp_sms: 'true', enable_captcha: 'false', enable_oauth: 'true', enable_magiclink: 'false', sms_provider: 'kavenegar', sms_sender_number: '3000777', otp_length: '6', otp_expiry_seconds: '120' },
    storage: { default_bucket: 'assets', max_file_size_mb: '50', quota_mb: '1024', cors: '*' },
    functions: { memory_limit_mb: '16', timeout_seconds: '5000' },
    ipg: { psp: 'zarinpal', merchant_id: 'test-merchant', wage_percent: '1.0', callback_url: `https://api.localme.ir/_baas/v1/${activeProjectId}/ipg/verify` },
    mobile: { fcm_server_key: '', apns_p8_key: '', najva_api_key: '', default_provider: 'fcm', bazaar_client_id: '', myket_client_id: '' },
    hosting: { custom_domain: '', enable_ssl: 'true', spa_fallback: 'true', max_bandwidth_gb: '100' },
    compliance: { enamad_token: '', samandehi_token: '', android_sha256: '', ios_app_id: '' }
  };
  await saveServiceConfig(serviceKey, true, defaultSettings[serviceKey] || {});
}
window.quickEnableService = quickEnableService;

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
  if (!confirm('آیا از غیرفعال سازی موقت این سرویس اطمینان دارید؟ در این مدت امکان فراخوانی API آن وجود نخواهد داشت.')) {
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

      showToast(`سرویس با موفقیت ${isEnabled ? 'فعال و تنظیمات ذخیره' : 'غیرفعال'} شد.`, 'success');
      renderAllServices();

      // If current view was gated, re-apply view to clear gate
      if (window.Router && Router.currentModule) {
        Router.applyView(Router.currentModule, Router.currentSubview, true);
      }

      if (isEnabled) {
        if (serviceKey === 'functions' && typeof window.loadProjectFunctions === 'function') {
          window.loadProjectFunctions();
        } else if (serviceKey === 'database' && typeof window.loadProjectTables === 'function') {
          window.loadProjectTables();
          if (typeof window.loadSqlEditor === 'function') window.loadSqlEditor();
        } else if (serviceKey === 'storage' && typeof window.loadProjectBuckets === 'function') {
          window.loadProjectBuckets();
        } else if (serviceKey === 'auth' && typeof window.loadProjectUsers === 'function') {
          window.loadProjectUsers();
        }
      }
      const banner = document.getElementById('overview-edge-func-banner');
      if (banner && serviceKey === 'functions') {
        banner.style.display = isEnabled ? 'none' : 'flex';
      }
    } else {
      showToast('خطا در ذخیره تنظیمات سرویس.', 'error');
    }
  } catch (err) {
    showToast('خطای ارتباط با سرور: ' + err.message, 'error');
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
      showToast('کلید جدید اختصاصی سرویس با موفقیت صادر شد.', 'success');
      renderAllServices();
    } else {
      showToast('خطا در صدور مجدد کلید.', 'error');
    }
  } catch (err) {
    showToast('خطای شبکه در صدور کلید: ' + err.message, 'error');
  }
}

// 3. Subsystem: Database Studio
function switchQuickstartLang(lang) {
  currentQuickstartLang = lang;
  const tabsContainer = document.getElementById('quickstart-lang-tabs');
  if (tabsContainer) {
    const buttons = tabsContainer.getElementsByTagName('button');
    for (let btn of buttons) {
      if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(lang)) {
        btn.className = 'btn-primary';
      } else {
        btn.className = 'btn-secondary';
      }
    }
  }

  const titleEl = document.getElementById('quickstart-code-title');
  const codeEl = document.getElementById('quickstart-code-block');
  if (!codeEl) return;

  const slug = activeProject?.slug || 'my-project';
  const apiKey = activeProject?.services?.auth?.apiKey?.apiKey || 'sec_key_live_98a72b4c10e';
  const baseUrl = window.location.origin;

  if (lang === 'curl') {
    if (titleEl) titleEl.textContent = 'HTTP REST API (cURL)';
    codeEl.textContent = `# ۱. ورود با نام کاربری و رمز عبور (بدون نیاز به پیامک)
curl -X POST ${baseUrl}/_baas/v1/${slug}/auth/login \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${apiKey}" \\
  -d '{"username": "dev_user", "password": "MySecretPassword123"}'

# ۲. دریافت چالش کپچا برای فرم های ورود ضد بات
curl -X GET ${baseUrl}/_baas/v1/${slug}/auth/captcha

# ۳. پرس‌وجو از دیتابیس رابطه ای
curl -X GET "${baseUrl}/_baas/v1/${slug}/rest/products?limit=10" \\
  -H "x-api-key: ${apiKey}"`;
  } else if (lang === 'node') {
    if (titleEl) titleEl.textContent = 'Node.js / TypeScript SDK Integration';
    codeEl.textContent = `import { createClient } from '@localme/sdk';

const localme = createClient({
  project: '${slug}',
  apiKey: '${apiKey}',
  endpoint: '${baseUrl}'
});

// ۱. ورود با نام کاربری و کلمه عبور (بدون نیاز به پیامک یکبارمصرف)
const { user, tokens } = await localme.auth.login({
  username: 'developer_user',
  password: 'Password123'
});
// احراز هویت با موفقیت انجام شد
const userId = user.id;

// ۲. پرس وجو از جداول داده
const products = await localme.db.table('products').select('*').limit(10);
// فهرست محصولات دریافتی: products`;
  } else if (lang === 'python') {
    if (titleEl) titleEl.textContent = 'Python SDK / Requests Integration';
    codeEl.textContent = `import requests

base_url = "${baseUrl}/_baas/v1/${slug}"
headers = {"x-api-key": "${apiKey}", "Content-Type": "application/json"}

# ۱. لاگین با نام کاربری و رمز عبور
res = requests.post(f"{base_url}/auth/login", json={
    "username": "developer_user",
    "password": "Password123"
}, headers=headers)
data = res.json()
print("Session token:", data.get("tokens", {}).get("accessToken"))

# ۲. دریافت اطلاعات از پایگاه داده
products = requests.get(f"{base_url}/rest/products?limit=10", headers=headers).json()
print(f"Loaded {len(products)} records.")`;
  } else if (lang === 'flutter') {
    if (titleEl) titleEl.textContent = 'Flutter / Dart SDK Integration';
    codeEl.textContent = `import 'package:http/http.dart' as http;
import 'dart:convert';

final baseUrl = '${baseUrl}/_baas/v1/${slug}';
final headers = {'x-api-key': '${apiKey}', 'Content-Type': 'application/json'};

// ۱. احراز هویت با نام کاربری و رمز عبور
final res = await http.post(
  Uri.parse('$baseUrl/auth/login'),
  headers: headers,
  body: jsonEncode({'username': 'mobile_user', 'password': 'Password123'}),
);
print('Login response: \${res.body}');

// ۲. واکشی داده های جدول
final data = await http.get(Uri.parse('$baseUrl/rest/products'), headers: headers);`;
  }
}

function copyQuickstartSnippet() {
  const codeEl = document.getElementById('quickstart-code-block');
  if (codeEl) {
    navigator.clipboard.writeText(codeEl.textContent).then(() => {
      showToast('نمونه کد با موفقیت در کلیپ بورد کپی شد.', 'success');
    }).catch(() => {
      prompt('کد جهت کپی:', codeEl.textContent);
    });
  }
}

function loadOverviewQuickstart() {
  switchQuickstartLang(currentQuickstartLang || 'curl');
}

// 11.2 Database Interactive SQL & Schema Inspector & Backups
async function loadTeam() {
  if (!activeProjectId) return;
  const tbody = document.getElementById('team-members-tbody');
  if (!tbody) return;

  try {
    const res = await fetch(`/_baas/v1/${activeProjectId}/team`);
    if (res.ok) {
      const team = await res.json();
      if (!team || team.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 16px;">عضوی در تیم ثبت نشده است.</td></tr>';
      } else {
        tbody.innerHTML = team.map(m => {
          const roleLabel = m.role === 'Owner' ? 'مالک' : m.role === 'Developer' ? 'توسعه دهنده' : m.role === 'Operator' ? 'اپراتور' : 'حسابدار';
          return `
            <tr>
              <td style="font-weight: 700; font-size: 14px;">${escapeHtml(m.fullName)}</td>
              <td style="font-size: 13.5px;">${escapeHtml(m.emailOrPhone)}</td>
              <td><span class="badge badge-active">${escapeHtml(roleLabel)}</span></td>
              <td><span class="badge badge-active">${escapeHtml(m.status)}</span></td>
              <td style="font-size: 13.5px;">${escapeHtml(Shamsi.formatDate(m.addedAtUtc))}</td>
              <td>
                ${m.role !== 'Owner' ? `<button type="button" class="btn-danger" style="font-size: 13px; padding: 4px 10px;" onclick="removeCollaborator('${escapeHtml(m.id)}')">حذف دسترسی</button>` : '<span style="font-size: 13px; color: var(--text-muted);">غیرقابل حذف</span>'}
              </td>
            </tr>
          `;
        }).join('');
      }
    }
  } catch (err) {
    console.warn('Team load error:', err);
  }
}

async function removeCollaborator(id) {
  if (!confirm('آیا از حذف این عضو تیم اطمینان دارید؟')) return;
  try {
    const res = await fetch(`/_baas/v1/${activeProjectId}/team/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('عضو با موفقیت از تیم حذف گردید.', 'success');
      loadTeam();
    }
  } catch (err) {
    showToast('خطا در حذف همکار: ' + err.message, 'error');
  }
}

// 9. Compliance Hub
async function loadLogs() {
  if (!activeProjectId) return;
  const tbody = document.getElementById('logs-stream-tbody');
  const serviceSel = document.getElementById('logs-filter-service');
  const levelSel = document.getElementById('logs-filter-level');
  if (!tbody) return;

  const service = serviceSel ? serviceSel.value : 'all';
  const level = levelSel ? levelSel.value : 'all';

  try {
    const res = await fetch(`/_baas/v1/${activeProjectId}/logs?service=${encodeURIComponent(service)}&level=${encodeURIComponent(level)}`);
    if (res.ok) {
      const logs = await res.json();
      if (!logs || logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 18px;">هیچ لاگی با فیلترهای انتخابی یافت نشد.</td></tr>';
      } else {
        tbody.innerHTML = logs.map(l => {
          const levelBadgeClass = l.level === 'ERROR' ? 'badge-paused' : l.level === 'WARN' ? 'badge-paused' : 'badge-active';
          return `
            <tr>
              <td style="font-size: 13.5px;">${escapeHtml(Shamsi.formatDate(l.timestampUtc))}</td>
              <td><span class="badge ${levelBadgeClass}">${escapeHtml(l.level)}</span></td>
              <td style="font-family: var(--font-persian); font-size: 13px; font-weight: 600;">${escapeHtml(l.service)}</td>
              <td style="font-size: 13.5px; color: var(--text-main);">${escapeHtml(l.message)}</td>
              <td style="font-family: var(--font-persian); font-size: 13px;">${l.statusCode ? `<span class="badge badge-active">${escapeHtml(l.statusCode)}</span>` : '-'}</td>
              <td style="font-size: 13.5px;">${l.latencyMs ? `${Shamsi.toPersianDigits(l.latencyMs)} ms` : '-'}</td>
              <td style="font-family: var(--font-persian); font-size: 13px; color: var(--text-muted);">${escapeHtml(l.traceId || '-')}</td>
            </tr>
          `;
        }).join('');
      }
    }
  } catch (err) {
    console.warn('Logs load error:', err);
  }
}



// ============================================================================
// 11. DECOUPLED SUB-STUDIO LOADERS & INTERACTIVE HANDLERS (ALL 32 SUBVIEWS)
// ============================================================================

// 11.1 Quickstart SDK Integration Studio
let currentQuickstartLang = 'curl';

async function loadAuditLogs() {
  if (!activeProjectId) return;
  const tbody = document.getElementById('telemetry-audit-tbody');
  if (!tbody) return;

  try {
    const res = await fetch(`/_baas/v1/${activeProjectId}/logs`);
    if (res.ok) {
      const logs = await res.json();
      if (!logs || logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 18px;">رویداد ثبت شده ای در لاگ حسابرسی یافت نشد.</td></tr>';
      } else {
        tbody.innerHTML = logs.map(l => `
          <tr>
            <td style="font-size: 13.5px;">${escapeHtml(Shamsi.formatDate(l.timestampUtc))}</td>
            <td style="font-weight: 700; font-size: 13.5px;">کاربر سیستم (پنل)</td>
            <td style="font-size: 13.5px;">${escapeHtml(l.message)}</td>
            <td style="font-family: var(--font-persian); font-size: 13px;">${escapeHtml(l.service)}</td>
            <td style="font-family: var(--font-persian); font-size: 13px; color: var(--text-muted);">185.190.150.12</td>
          </tr>
        `).join('');
      }
    }
  } catch (err) {
    console.warn('Audit logs load error:', err);
  }
}

// 11.10 Team Roles & RBAC Matrix
function loadTeamRoles() {
  // Static declarative permission matrix loaded in DOM
}

// 11.11 Settings Studios (General, Keys, Danger)
function loadSettingsGeneral() {
  if (!activeProject) return;
  setVal('set-proj-name', activeProject.name || '');
  setVal('set-proj-slug', activeProject.slug || '');
  setVal('set-proj-desc', activeProject.description || '');
}

function loadSettingsKeys() {
  if (!activeProject) return;
  const services = activeProject.services || {};
  setVal('db-api-key-val-settings', services.database?.apiKey?.apiKey || 'تولید نشده');
  setVal('auth-api-key-val-settings', services.auth?.apiKey?.apiKey || 'تولید نشده');
  setVal('storage-api-key-val-settings', services.storage?.apiKey?.apiKey || 'تولید نشده');
  setVal('func-api-key-val-settings', services.functions?.apiKey?.apiKey || 'تولید نشده');
}

function loadSettingsDanger() {
  // Danger zone verification
}

async function deleteCurrentProject() {
  if (!activeProject || !activeProjectId) return;
  const promptSlug = prompt(`آیا از حذف کامل و غیرقابل بازگشت پروژه "${activeProject.name}" اطمینان دارید؟\nبرای تایید، اسلاگ پروژه (${activeProject.slug}) را وارد فرمایید:`);
  if (promptSlug !== activeProject.slug) {
    showToast('اسلاگ وارد شده مطابقت نداشت. عملیات حذف لغو گردید.', 'warning');
    return;
  }

  try {
    const res = await fetch(`/_baas/v1/projects/${activeProjectId}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('پروژه با موفقیت حذف گردید.', 'success');
      setTimeout(() => {
        window.location.href = '/panel';
      }, 500);
    } else {
      showToast('خطا در حذف پروژه.', 'error');
    }
  } catch (err) {
    showToast('خطای شبکه در حذف پروژه: ' + err.message, 'error');
  }
}

// 12. Rich Dashboard Charts Renderer (Implemented in services-charts.js)

// Core Window Attachments
window.renderAllServices = renderAllServices;
window.renderDashboardCharts = renderDashboardCharts;
window.disableService = disableService;
window.regenerateServiceKey = regenerateServiceKey;
window.switchQuickstartLang = switchQuickstartLang;
window.copyQuickstartSnippet = copyQuickstartSnippet;
window.loadOverviewQuickstart = loadOverviewQuickstart;
window.loadTeam = loadTeam;
window.removeCollaborator = removeCollaborator;
window.loadTeamRoles = loadTeamRoles;
window.loadLogs = loadLogs;
window.loadAuditLogs = loadAuditLogs;
window.loadSettingsGeneral = loadSettingsGeneral;
window.loadSettingsKeys = loadSettingsKeys;
window.loadSettingsDanger = loadSettingsDanger;
window.deleteCurrentProject = deleteCurrentProject;
