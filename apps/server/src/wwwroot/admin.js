function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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
window.alert = function(msg) {
  showToast(String(msg), 'info');
};

// LocalMe SuperAdmin & Operator Console Engine
let adminUser = null;
let cachedUsers = {};
let cachedProjects = {};
let cachedTickets = {};

document.addEventListener('DOMContentLoaded', () => {
  initAdminSession();
  initAdminNav();
  initModalForms();
});

async function initAdminSession() {
  try {
    const res = await fetch('/_baas/v1/users/me');
    if (res.ok) {
      adminUser = await res.json();

      // If user is just Developer, redirect to panel
      if (adminUser.role === 2) {
        window.location.href = '/panel';
        return;
      }

      const nameEl = document.getElementById('admin-user-name');
      if (nameEl) nameEl.textContent = adminUser.fullName;

      const roleBadge = document.getElementById('admin-user-role-badge');
      if (roleBadge) {
        roleBadge.textContent = adminUser.role === 0 ? 'مدیر ارشد' : 'اپراتور پشتیبانی';
        roleBadge.className = adminUser.role === 0 ? 'badge badge-paused' : 'badge badge-info';
      }

      // Check pricing permission (SuperAdmin only)
      if (adminUser.role === 1) { // Operator
        const pBadge = document.getElementById('pricing-access-badge');
        if (pBadge) pBadge.textContent = 'فقط خواندنی (مخصوص مدیر ارشد)';
        const saveBtn = document.getElementById('btn-save-admin-pricing');
        if (saveBtn) saveBtn.style.display = 'none';
        ['adm-p-db', 'adm-p-sms', 'adm-p-storage', 'adm-p-compute', 'adm-p-min-topup', 'adm-p-free-credit', 'adm-p-maint'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.disabled = true;
        });
      }

      loadAdminUsers();
      loadAdminProjects();
      loadAdminPricing();
      loadAdminStats();
    }
  } catch (err) {
    console.warn('Admin session error:', err);
  }
}

function initAdminNav() {
  const links = document.querySelectorAll('.sidebar-link');
  const views = document.querySelectorAll('.tab-view');
  const bcViewName = document.getElementById('admin-bc-view-name');

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

  const refreshProjBtn = document.getElementById('btn-admin-refresh-projs');
  if (refreshProjBtn) refreshProjBtn.addEventListener('click', loadAdminProjects);

  const pricingForm = document.getElementById('form-admin-pricing');
  if (pricingForm) {
    pricingForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (adminUser.role !== 0) {
        showToast('تنها مدیر ارشد سامانه مجاز به تغییر تعرفه ها می باشد.', 'warning');
        return;
      }

      const payload = {
        DbQueryPer1kIrr: parseInt(document.getElementById('adm-p-db')?.value, 10) || 100,
        SmsPerMessageIrr: parseInt(document.getElementById('adm-p-sms')?.value, 10) || 800,
        StorageGbMonthIrr: parseInt(document.getElementById('adm-p-storage')?.value, 10) || 500,
        ComputePer100msIrr: parseInt(document.getElementById('adm-p-compute')?.value, 10) || 10,
        EgressGbIrr: parseInt(document.getElementById('adm-p-egress')?.value, 10) || 2000,
        MinWalletTopupIrr: parseInt(document.getElementById('adm-p-min-topup')?.value, 10) || 100000,
        InitialFreeCreditIrr: parseInt(document.getElementById('adm-p-free-credit')?.value, 10) || 5000000,

        MaxProjectsPerDeveloperTier: parseInt(document.getElementById('adm-cfg-max-projects')?.value, 10) || 1,
        MaxTeamMembersPerDeveloperTier: parseInt(document.getElementById('adm-cfg-max-members')?.value, 10) || 1,
        DefaultStorageQuotaMb: parseInt(document.getElementById('adm-cfg-storage-quota')?.value, 10) || 1024,
        DefaultMaxFileSizeMb: parseInt(document.getElementById('adm-cfg-max-filesize')?.value, 10) || 50,
        DefaultFunctionsMemoryMb: parseInt(document.getElementById('adm-cfg-func-memory')?.value, 10) || 16,
        DefaultFunctionsTimeoutMs: parseInt(document.getElementById('adm-cfg-func-timeout')?.value, 10) || 5000,
        DefaultDbMaxConnections: parseInt(document.getElementById('adm-cfg-db-conn')?.value, 10) || 20,

        SmsDefaultProvider: document.getElementById('adm-sms-provider')?.value || 'kavenegar',
        SmsDefaultApiKey: document.getElementById('adm-sms-key')?.value?.trim() || '',
        SmsDefaultSenderNumber: document.getElementById('adm-sms-sender')?.value?.trim() || '3000777',
        SmsDefaultPatternCode: document.getElementById('adm-sms-pattern')?.value?.trim() || 'localme-verify',
        SmsDefaultOtpLength: parseInt(document.getElementById('adm-sms-otp-len')?.value, 10) || 6,
        SmsDefaultOtpExpirySeconds: parseInt(document.getElementById('adm-sms-otp-ttl')?.value, 10) || 120,

        IpgDefaultPsp: document.getElementById('adm-ipg-psp')?.value || 'zarinpal',
        IpgDefaultMerchantId: document.getElementById('adm-ipg-merchant')?.value?.trim() || '',
        IpgCallbackBaseUrl: document.getElementById('adm-ipg-callback')?.value?.trim() || '',
        ShaparakWageIrr: parseInt(document.getElementById('adm-ipg-wage')?.value, 10) || 1200,

        JwtSecret: document.getElementById('adm-sec-jwt-secret')?.value?.trim() || '',
        JwtExpiryHours: parseInt(document.getElementById('adm-sec-jwt-hours')?.value, 10) || 72,
        RefreshTokenExpiryDays: parseInt(document.getElementById('adm-sec-refresh-days')?.value, 10) || 30,
        MaxLoginFailedAttempts: parseInt(document.getElementById('adm-sec-max-retries')?.value, 10) || 5,
        LockoutDurationMinutes: parseInt(document.getElementById('adm-sec-lockout-mins')?.value, 10) || 15,
        CorsAllowedOrigins: document.getElementById('adm-sec-cors')?.value?.trim() || '*',

        PlatformName: document.getElementById('adm-infra-name')?.value?.trim() || 'لوکال می (LocalMe)',
        DefaultRegion: document.getElementById('adm-infra-region')?.value?.trim() || 'ir-thr-milad1',
        SovereignEgressNat: document.getElementById('adm-infra-nat')?.value?.trim() || '',

        MaintenanceMode: !!document.getElementById('adm-p-maint')?.checked,
        MaintenanceMessage: document.getElementById('adm-cfg-maint-msg')?.value?.trim() || '',
        SystemBroadcastMessage: document.getElementById('adm-cfg-broadcast-msg')?.value?.trim() || '',

        PlatformLogLevel: document.getElementById('adm-log-level')?.value || 'Information',
        LoggingGranularity: document.getElementById('adm-log-granularity')?.value || 'Standard',
        IsPlatformLoggingActive: !!document.getElementById('adm-log-platform-active')?.checked,
        ConsoleLoggingEnabled: !!document.getElementById('adm-log-console-enabled')?.checked
      };

      try {
        const res = await fetch('/_baas/v1/admin/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          showToast('تنظیمات کلان سامانه و متغیرهای عملیاتی با موفقیت به روزرسانی و در سامانه اعمال شدند.', 'success');
          loadAdminPricing();
          loadAdminStats();
        } else {
          showToast('خطا در به روزرسانی تنظیمات کلان سامانه.', 'error');
        }
      } catch (err) {
        showToast('خطای شبکه در ارتباط با سرور: ' + (err?.message || ''), 'error');
      }
    });
  }
}

function initModalForms() {
  // Ticket Reply Form
  const ticketReplyForm = document.getElementById('form-ticket-reply');
  if (ticketReplyForm) {
    ticketReplyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const ticketId = document.getElementById('modal-ticket-reply-id').value;
      const message = document.getElementById('modal-ticket-reply-msg').value;
      const status = document.getElementById('modal-ticket-reply-status').value;

      try {
        const res = await fetch(`/_baas/v1/admin/tickets/${ticketId}/reply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, status })
        });
        if (res.ok) {
          document.getElementById('modal-ticket-reply-msg').value = '';
          showToast('پاسخ با موفقیت ارسال شد و وضعیت تیکت به روزرسانی گردید.', 'success');
          await loadAdminStats();
          openTicketModal(ticketId);
        } else {
          showToast('خطا در ارسال پاسخ تیکت.', 'error');
        }
      } catch {
        showToast('خطای ارتباط با سرور.', 'error');
      }
    });
  }

  // User Credit Form
  const creditForm = document.getElementById('form-user-credit');
  if (creditForm) {
    creditForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (adminUser.role !== 0) {
        showToast('تنها مدیر ارشد سامانه مجاز به تنظیم اعتبار کیف پول است.', 'warning');
        return;
      }
      const userId = document.getElementById('modal-user-id').textContent;
      const amountToman = parseInt(document.getElementById('modal-user-credit-toman').value, 10);
      if (isNaN(amountToman) || amountToman <= 0) return;

      try {
        const res = await fetch(`/_baas/v1/users/${userId}/credit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deltaToman: amountToman })
        });
        if (res.ok) {
          const data = await res.json();
          cachedUsers[userId] = data.user;
          document.getElementById('modal-user-credit-toman').value = '';
          showToast(`اعتبار کیف پول کاربر به میزان ${Shamsi.toPersianDigits(amountToman.toLocaleString())} تومان افزایش یافت.`, 'success');
          openUserModal(userId);
          loadAdminUsers();
        } else {
          showToast('خطا در اعمال تغییر اعتبار.', 'error');
        }
      } catch {
        showToast('خطای ارتباط با سرور.', 'error');
      }
    });
  }

  // User Role Save Button
  const saveRoleBtn = document.getElementById('btn-save-user-role');
  if (saveRoleBtn) {
    saveRoleBtn.addEventListener('click', async () => {
      if (adminUser.role !== 0) {
        showToast('تنها مدیر ارشد سامانه مجاز به تغییر نقش ها می باشد.', 'warning');
        return;
      }
      const userId = document.getElementById('modal-user-id').textContent;
      const newRole = document.getElementById('modal-user-role-select').value;
      await changeUserRole(userId, newRole);
      openUserModal(userId);
    });
  }

  // User Block / Unblock Toggle
  const toggleUserBtn = document.getElementById('btn-toggle-user-status');
  if (toggleUserBtn) {
    toggleUserBtn.addEventListener('click', async () => {
      if (adminUser.role !== 0) {
        showToast('تنها مدیر ارشد سامانه مجاز به تغییر وضعیت حساب است.', 'warning');
        return;
      }
      const userId = document.getElementById('modal-user-id').textContent;
      const u = cachedUsers[userId];
      if (!u) return;

      const newStatus = !u.isActive;
      try {
        const res = await fetch(`/_baas/v1/users/${userId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: newStatus })
        });
        if (res.ok) {
          const data = await res.json();
          cachedUsers[userId] = data.user;
          showToast(`حساب کاربری با موفقیت ${newStatus ? 'فعال' : 'مسدود'} گردید.`, 'success');
          openUserModal(userId);
          loadAdminUsers();
        }
      } catch {
        showToast('خطا در تغییر وضعیت حساب کاربر.', 'error');
      }
    });
  }

  // Project Status Toggle Button
  const toggleProjBtn = document.getElementById('btn-toggle-proj-status');
  if (toggleProjBtn) {
    toggleProjBtn.addEventListener('click', async () => {
      const projId = document.getElementById('modal-proj-id').textContent;
      const p = cachedProjects[projId];
      if (!p) return;

      const newStatus = p.status === 'Active' ? 'Suspended' : 'Active';
      try {
        const res = await fetch(`/_baas/v1/admin/projects/${projId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        });
        if (res.ok) {
          p.status = newStatus;
          showToast(`وضعیت پروژه با موفقیت به "${newStatus === 'Active' ? 'فعال' : 'معلق'}" تغییر یافت.`, 'success');
          openProjectModal(projId);
          loadAdminProjects();
        }
      } catch {
        showToast('خطا در تغییر وضعیت پروژه.', 'error');
      }
    });
  }
}

// 1. Users Management
async function loadAdminUsers() {
  const tbody = document.getElementById('admin-users-tbody');
  if (!tbody) return;

  try {
    const res = await fetch('/_baas/v1/users');
    if (res.ok) {
      const users = await res.json();
      cachedUsers = {};
      users.forEach(u => cachedUsers[u.id] = u);

      tbody.innerHTML = users.map(u => {
        const roleLabel = u.role === 0 ? 'مدیر ارشد' : u.role === 1 ? 'اپراتور' : 'توسعه دهنده';
        const roleBadgeClass = u.role === 0 ? 'badge-paused' : u.role === 1 ? 'badge-info' : 'badge-active';
        const statusLabel = u.isActive ? 'فعال' : 'مسدود';
        const statusBadge = u.isActive ? 'badge-active' : 'badge-danger';

        return `
          <tr class="table-row-clickable" onclick="openUserModal('${escapeHtml(u.id)}')" title="برای مشاهده جزئیات کلیک کنید">
            <td style="font-family: var(--font-persian); font-size: 13px; color: var(--color-info);">${escapeHtml(u.id)}</td>
            <td style="font-weight: 700;">${escapeHtml(u.fullName)}</td>
            <td style="font-family: var(--font-persian);">${escapeHtml(u.phone)}</td>
            <td style="font-family: var(--font-persian); font-size: 13px; color: var(--text-muted);">${escapeHtml(u.email)}</td>
            <td><span class="badge ${roleBadgeClass}">${roleLabel}</span></td>
            <td><span class="badge ${statusBadge}">${statusLabel}</span></td>
            <td style="font-size: 13px;">${escapeHtml(Shamsi.formatDate(u.createdAtUtc))}</td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    console.warn('Users load error:', err);
  }
}

async function openUserModal(userId) {
  const u = cachedUsers[userId];
  if (!u) return;

  setText('modal-user-name', u.fullName);
  setText('modal-user-id', u.id);
  setText('modal-user-phone', u.phone);
  setText('modal-user-email', u.email);
  setText('modal-user-date', Shamsi.formatDate(u.createdAtUtc));

  const statusEl = document.getElementById('modal-user-status');
  if (statusEl) {
    statusEl.innerHTML = `<span class="badge ${u.isActive ? 'badge-active' : 'badge-danger'}">${u.isActive ? 'فعال' : 'مسدود'}</span>`;
  }

  const tomanBal = Math.floor(u.walletBalanceIrr / 10);
  setText('modal-user-wallet', `${Shamsi.toPersianDigits(tomanBal.toLocaleString())} تومان`);

  // Role select
  const roleSelect = document.getElementById('modal-user-role-select');
  if (roleSelect) {
    roleSelect.value = u.role === 0 ? 'Admin' : u.role === 1 ? 'Operator' : 'Developer';
    roleSelect.disabled = adminUser.role !== 0;
  }
  const roleBtn = document.getElementById('btn-save-user-role');
  if (roleBtn) roleBtn.style.display = adminUser.role === 0 ? 'inline-flex' : 'none';

  // Toggle button
  const toggleBtn = document.getElementById('btn-toggle-user-status');
  if (toggleBtn) {
    toggleBtn.textContent = u.isActive ? 'مسدودسازی کاربر' : 'رفع مسدودیت کاربر';
    toggleBtn.className = u.isActive ? 'btn-danger' : 'btn-primary';
    toggleBtn.style.display = adminUser.role === 0 ? 'inline-flex' : 'none';
  }

  // Load user projects
  const projsTbody = document.getElementById('modal-user-projects-tbody');
  if (projsTbody) {
    projsTbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">در حال دریافت پروژه ها...</td></tr>';
    try {
      const res = await fetch(`/_baas/v1/users/${userId}/projects`);
      if (res.ok) {
        const projs = await res.json();
        if (projs.length === 0) {
          projsTbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">کاربر تاکنون پروژه ای ایجاد نکرده است.</td></tr>';
        } else {
          projsTbody.innerHTML = projs.map(p => `
            <tr>
              <td style="font-family: var(--font-persian); font-size: 13px;">${escapeHtml(p.id)}</td>
              <td style="font-weight: 600;">${escapeHtml(p.name)}</td>
              <td style="font-family: var(--font-persian); font-size: 13px;">${escapeHtml(p.region)}</td>
              <td><span class="badge ${p.status === 'Active' ? 'badge-active' : 'badge-paused'}">${p.status === 'Active' ? 'فعال' : 'معلق'}</span></td>
            </tr>
          `).join('');
        }
      }
    } catch {
      projsTbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--color-danger);">خطا در دریافت لیست پروژه ها.</td></tr>';
    }
  }

  openModal('modal-user');
}

async function changeUserRole(userId, newRole) {
  try {
    const res = await fetch(`/_baas/v1/users/${userId}/role`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole })
    });
    if (res.ok) {
      showToast('نقش کاربر با موفقیت تغییر یافت.', 'success');
      loadAdminUsers();
    }
  } catch {
    showToast('خطا در تغییر نقش.', 'error');
  }
}

// 2. Projects Management
async function loadAdminProjects() {
  const tbody = document.getElementById('admin-projects-tbody');
  if (!tbody) return;

  try {
    const res = await fetch('/_baas/v1/projects');
    if (res.ok) {
      const projs = await res.json();
      cachedProjects = {};
      projs.forEach(p => cachedProjects[p.id] = p);

      if (!projs || projs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 18px;">هیچ پروژه ای تعریف نشده است.</td></tr>';
        return;
      }

      tbody.innerHTML = projs.map(p => `
        <tr class="table-row-clickable" onclick="openProjectModal('${escapeHtml(p.id)}')" title="برای مدیریت و مشاهده جزئیات کلیک کنید">
          <td style="font-size: 13.5px; color: var(--color-info);">${escapeHtml(p.id)}</td>
          <td style="font-weight: 700;">${escapeHtml(p.name)}</td>
          <td style="font-size: 13.5px;">${escapeHtml(p.slug)}</td>
          <td>${escapeHtml(p.ownerPhone)}</td>
          <td><span class="badge ${p.status === 'Active' ? 'badge-active' : 'badge-paused'}">${p.status === 'Active' ? 'فعال' : 'معلق'}</span></td>
          <td style="font-size: 13px;">${escapeHtml(Shamsi.formatDate(p.createdAtUtc))}</td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.warn('Projects load error:', err);
  }
}

function openProjectModal(projectId) {
  const p = cachedProjects[projectId];
  if (!p) return;

  setText('modal-proj-name', p.name);
  setText('modal-proj-id', p.id);
  setText('modal-proj-slug', p.slug);
  setText('modal-proj-owner', p.ownerPhone);
  setText('modal-proj-region', p.region);

  const statusBadge = document.getElementById('modal-proj-status-badge');
  if (statusBadge) {
    statusBadge.innerHTML = `<span class="badge ${p.status === 'Active' ? 'badge-active' : 'badge-paused'}">${p.status === 'Active' ? 'فعال' : 'معلق'}</span>`;
  }

  const toggleBtn = document.getElementById('btn-toggle-proj-status');
  if (toggleBtn) {
    toggleBtn.textContent = p.status === 'Active' ? 'مسدودسازی موقت پروژه (Suspended)' : 'فعال سازی مجدد پروژه (Active)';
  }

  // Populate services and keys
  const tbody = document.getElementById('modal-proj-services-tbody');
  if (tbody && p.services) {
    tbody.innerHTML = Object.entries(p.services).map(([sKey, sVal]) => {
      const sName = getServicePersianName(sKey);
      const isEn = sVal.isEnabled;
      const apiKey = sVal.apiKey?.apiKey || '-';

      return `
        <tr>
          <td style="font-weight: 600;">${sName}</td>
          <td><span class="badge ${isEn ? 'badge-active' : 'badge-paused'}">${isEn ? 'فعال' : 'غیرفعال'}</span></td>
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              <code style="font-size: 13.5px; background: var(--bg-main); padding: 2px 6px; border: 1px solid var(--border-color); border-radius: 4px;">${apiKey}</code>
              <button type="button" class="btn-secondary" style="padding: 2px 6px; font-size: 13px;" onclick="copyApiKey('${apiKey}')">کپی</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  openModal('modal-project');
}

// 3. Platform Master Configuration & System Variables
async function loadAdminPricing() {
  try {
    const res = await fetch('/_baas/v1/admin/config');
    if (res.ok) {
      const c = await res.json();
      // Category 1: Financial & Resource Pricing
      setVal('adm-p-db', c.dbQueryPer1kIrr);
      setVal('adm-p-sms', c.smsPerMessageIrr);
      setVal('adm-p-storage', c.storageGbMonthIrr);
      setVal('adm-p-compute', c.computePer100msIrr);
      setVal('adm-p-egress', c.egressGbIrr);
      setVal('adm-p-min-topup', c.minWalletTopupIrr);
      setVal('adm-p-free-credit', c.initialFreeCreditIrr);

      // Category 2: Tier Limits & Resource Envelopes
      setVal('adm-cfg-max-projects', c.maxProjectsPerDeveloperTier);
      setVal('adm-cfg-max-members', c.maxTeamMembersPerDeveloperTier);
      setVal('adm-cfg-storage-quota', c.defaultStorageQuotaMb);
      setVal('adm-cfg-max-filesize', c.defaultMaxFileSizeMb);
      setVal('adm-cfg-func-memory', c.defaultFunctionsMemoryMb);
      setVal('adm-cfg-func-timeout', c.defaultFunctionsTimeoutMs);
      setVal('adm-cfg-db-conn', c.defaultDbMaxConnections);

      // Category 3: SMS Gateway Defaults
      setVal('adm-sms-provider', c.smsDefaultProvider || 'kavenegar');
      setVal('adm-sms-key', c.smsDefaultApiKey || '');
      setVal('adm-sms-sender', c.smsDefaultSenderNumber || '3000777');
      setVal('adm-sms-pattern', c.smsDefaultPatternCode || 'localme-verify');
      setVal('adm-sms-otp-len', c.smsDefaultOtpLength || 6);
      setVal('adm-sms-otp-ttl', c.smsDefaultOtpExpirySeconds || 120);

      // Category 4: Shetab IPG Defaults
      setVal('adm-ipg-psp', c.ipgDefaultPsp || 'zarinpal');
      setVal('adm-ipg-merchant', c.ipgDefaultMerchantId || '');
      setVal('adm-ipg-callback', c.ipgCallbackBaseUrl || '');
      setVal('adm-ipg-wage', c.shaparakWageIrr || 1200);

      // Category 5: Security & JWT
      setVal('adm-sec-jwt-secret', c.jwtSecret || '');
      setVal('adm-sec-jwt-hours', c.jwtExpiryHours || 72);
      setVal('adm-sec-refresh-days', c.refreshTokenExpiryDays || 30);
      setVal('adm-sec-max-retries', c.maxLoginFailedAttempts || 5);
      setVal('adm-sec-lockout-mins', c.lockoutDurationMinutes || 15);
      setVal('adm-sec-cors', c.corsAllowedOrigins || '*');

      // Category 6: Sovereign Infrastructure
      setVal('adm-infra-name', c.platformName || 'لوکال می (LocalMe)');
      setVal('adm-infra-region', c.defaultRegion || 'ir-thr-milad1');
      setVal('adm-infra-nat', c.sovereignEgressNat || '2.180.12.94 (Static Domestic NAT Active)');

      // Category 7: Maintenance Mode & Broadcast
      const maint = document.getElementById('adm-p-maint');
      if (maint) maint.checked = !!c.maintenanceMode;
      setVal('adm-cfg-maint-msg', c.maintenanceMessage || '');
      setVal('adm-cfg-broadcast-msg', c.systemBroadcastMessage || '');

      // Category 8: Logging Controls
      setVal('adm-log-level', c.platformLogLevel || 'Information');
      setVal('adm-log-granularity', c.loggingGranularity || 'Standard');
      const logPlat = document.getElementById('adm-log-platform-active');
      if (logPlat) logPlat.checked = c.isPlatformLoggingActive !== false;
      const logConsole = document.getElementById('adm-log-console-enabled');
      if (logConsole) logConsole.checked = c.consoleLoggingEnabled !== false;
    }
  } catch (err) {
    console.warn('Config load error:', err);
  }
}

// 4. System Stats & Support Tickets
async function loadAdminStats() {
  try {
    const res = await fetch('/_baas/v1/admin/stats');
    if (res.ok) {
      const stats = await res.json();
      setNum('stat-total-users', stats.totalUsers);
      setNum('stat-active-projs', stats.activeProjects);
      setNum('stat-total-queries', stats.totalQueriesProcessed);
      setText('stat-total-rev', stats.formattedRevenueToman);

      // Support Tickets
      const tbody = document.getElementById('admin-tickets-tbody');
      if (tbody && stats.recentTickets) {
        cachedTickets = {};
        stats.recentTickets.forEach(t => cachedTickets[t.id] = t);

        tbody.innerHTML = stats.recentTickets.map(t => {
          const statusBadge = t.status === 'Resolved' ? 'badge-active' : t.status === 'Investigating' ? 'badge-info' : t.status === 'Closed' ? 'badge-paused' : 'badge-paused';
          const statusLabel = t.status === 'Resolved' ? 'حل شده' : t.status === 'Investigating' ? 'در حال بررسی' : t.status === 'Closed' ? 'بسته شده' : 'باز';
          const snippet = t.message.length > 50 ? t.message.substring(0, 50) + '...' : t.message;

          return `
            <tr class="table-row-clickable" onclick="openTicketModal('${escapeHtml(t.id)}')" title="برای مشاهده و پاسخ به تیکت کلیک کنید">
              <td style="font-size: 13.5px;">${escapeHtml(t.id)}</td>
              <td style="font-weight: 600;">${escapeHtml(t.customerPhone)}</td>
              <td style="font-weight: 700;">${escapeHtml(t.subject)}</td>
              <td style="font-size: 13px; color: var(--text-muted);">${escapeHtml(snippet)}</td>
              <td><span class="badge ${statusBadge}">${statusLabel}</span></td>
              <td>
                <button type="button" class="btn-secondary" style="font-size: 13px; padding: 2px 8px;">
                  مشاهده و پاسخ
                </button>
              </td>
            </tr>
          `;
        }).join('');
      }
    }
  } catch (err) {
    console.warn('Stats load error:', err);
  }
}

function openTicketModal(ticketId) {
  const t = cachedTickets[ticketId];
  if (!t) return;

  setText('modal-ticket-title', t.subject);
  setText('modal-ticket-id', `شناسه: ${t.id}`);
  setText('modal-ticket-phone', t.customerPhone);
  setText('modal-ticket-date', Shamsi.formatDate(t.createdAtUtc));

  const badgeEl = document.getElementById('modal-ticket-status-badge');
  if (badgeEl) {
    const statusBadge = t.status === 'Resolved' ? 'badge-active' : t.status === 'Investigating' ? 'badge-info' : 'badge-paused';
    const statusLabel = t.status === 'Resolved' ? 'حل شده' : t.status === 'Investigating' ? 'در حال بررسی' : t.status === 'Closed' ? 'بسته شده' : 'باز';
    badgeEl.className = `badge ${statusBadge}`;
    badgeEl.textContent = statusLabel;
  }

  document.getElementById('modal-ticket-reply-id').value = t.id;
  document.getElementById('modal-ticket-reply-status').value = t.status;

  // Build thread
  const threadEl = document.getElementById('modal-ticket-thread');
  if (threadEl) {
    let threadHtml = `
      <div class="thread-msg thread-msg-customer">
        <div class="thread-meta">
          <span style="font-weight: 700; color: var(--text-main);">کاربر / توسعه دهنده (${escapeHtml(t.customerPhone)})</span>
          <span>${escapeHtml(Shamsi.formatDate(t.createdAtUtc))}</span>
        </div>
        <div>${escapeHtml(t.message)}</div>
      </div>
    `;

    if (t.replies && t.replies.length > 0) {
      t.replies.forEach(r => {
        const isStaff = r.senderRole === 'Admin' || r.senderRole === 'Operator';
        threadHtml += `
          <div class="thread-msg ${isStaff ? 'thread-msg-reply' : 'thread-msg-customer'}">
            <div class="thread-meta">
              <span style="font-weight: 700; color: ${isStaff ? 'var(--brand-dark)' : 'var(--text-main)'};">
                ${escapeHtml(r.senderName)} (${isStaff ? 'پشتیبانی' : 'کاربر'})
              </span>
              <span>${escapeHtml(Shamsi.formatDate(r.createdAtUtc))}</span>
            </div>
            <div>${escapeHtml(r.message)}</div>
          </div>
        `;
      });
    }

    threadEl.innerHTML = threadHtml;
  }

  openModal('modal-ticket');
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'flex';
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

function copyApiKey(key) {
  navigator.clipboard.writeText(key).then(() => {
    showToast('کلید با موفقیت در کلیپ بورد کپی شد.', 'success');
  }).catch(() => {
    prompt('کلید دسترسی:', key);
  });
}

function getServicePersianName(srv) {
  switch (srv.toLowerCase()) {
    case 'database': return 'پایگاه داده رابطه ای (PostgreSQL)';
    case 'auth': return 'احراز هویت پیامکی (SMS OTP)';
    case 'storage': return 'ذخیره سازی ابری فایل (Storage)';
    case 'functions': return 'توابع سرورلس لبه (Functions)';
    case 'sms': return 'سامانه پیام رسان (SMS)';
    default: return srv;
  }
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setNum(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = Shamsi.toPersianDigits(val ?? 0);
}
