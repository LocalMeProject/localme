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
        alert('تنها مدیر ارشد سامانه مجاز به تغییر تعرفه‌ها می‌باشد.');
        return;
      }

      const payload = {
        DbQueryPer1kIrr: parseInt(document.getElementById('adm-p-db').value, 10),
        SmsPerMessageIrr: parseInt(document.getElementById('adm-p-sms').value, 10),
        StorageGbMonthIrr: parseInt(document.getElementById('adm-p-storage').value, 10),
        ComputePer100msIrr: parseInt(document.getElementById('adm-p-compute').value, 10),
        MinWalletTopupIrr: parseInt(document.getElementById('adm-p-min-topup').value, 10),
        InitialFreeCreditIrr: parseInt(document.getElementById('adm-p-free-credit').value, 10),
        MaintenanceMode: document.getElementById('adm-p-maint').checked
      };

      try {
        const res = await fetch('/_baas/v1/admin/pricing', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          alert('تعرفه‌ها و متغیرهای عملیاتی با موفقیت به‌روزرسانی و در سامانه اعمال شدند.');
          loadAdminPricing();
          loadAdminStats();
        } else {
          alert('خطا در به‌روزرسانی تعرفه‌ها.');
        }
      } catch {
        alert('خطای شبکه.');
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
          alert('پاسخ با موفقیت ارسال شد و وضعیت تیکت به‌روزرسانی گردید.');
          await loadAdminStats();
          openTicketModal(ticketId);
        } else {
          alert('خطا در ارسال پاسخ تیکت.');
        }
      } catch {
        alert('خطای ارتباط با سرور.');
      }
    });
  }

  // User Credit Form
  const creditForm = document.getElementById('form-user-credit');
  if (creditForm) {
    creditForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (adminUser.role !== 0) {
        alert('تنها مدیر ارشد سامانه مجاز به تنظیم اعتبار کیف پول است.');
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
          alert(`اعتبار کیف پول کاربر به میزان ${Shamsi.toPersianDigits(amountToman.toLocaleString())} تومان افزایش یافت.`);
          openUserModal(userId);
          loadAdminUsers();
        } else {
          alert('خطا در اعمال تغییر اعتبار.');
        }
      } catch {
        alert('خطای ارتباط با سرور.');
      }
    });
  }

  // User Role Save Button
  const saveRoleBtn = document.getElementById('btn-save-user-role');
  if (saveRoleBtn) {
    saveRoleBtn.addEventListener('click', async () => {
      if (adminUser.role !== 0) {
        alert('تنها مدیر ارشد سامانه مجاز به تغییر نقش‌ها می‌باشد.');
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
        alert('تنها مدیر ارشد سامانه مجاز به تغییر وضعیت حساب است.');
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
          alert(`حساب کاربری با موفقیت ${newStatus ? 'فعال' : 'مسدود'} گردید.`);
          openUserModal(userId);
          loadAdminUsers();
        }
      } catch {
        alert('خطا در تغییر وضعیت حساب کاربر.');
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
          alert(`وضعیت پروژه با موفقیت به "${newStatus === 'Active' ? 'فعال' : 'معلق'}" تغییر یافت.`);
          openProjectModal(projId);
          loadAdminProjects();
        }
      } catch {
        alert('خطا در تغییر وضعیت پروژه.');
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
        const roleLabel = u.role === 0 ? 'مدیر ارشد' : u.role === 1 ? 'اپراتور' : 'توسعه‌دهنده';
        const roleBadgeClass = u.role === 0 ? 'badge-paused' : u.role === 1 ? 'badge-info' : 'badge-active';
        const statusLabel = u.isActive ? 'فعال' : 'مسدود';
        const statusBadge = u.isActive ? 'badge-active' : 'badge-danger';

        return `
          <tr class="table-row-clickable" onclick="openUserModal('${u.id}')" title="برای مشاهده جزئیات کلیک کنید">
            <td style="font-family: var(--font-mono); font-size: 11.5px; color: var(--color-info);">${u.id}</td>
            <td style="font-weight: 700;">${u.fullName}</td>
            <td style="font-family: var(--font-mono);">${u.phone}</td>
            <td style="font-family: var(--font-mono); font-size: 12px; color: var(--text-muted);">${u.email}</td>
            <td><span class="badge ${roleBadgeClass}">${roleLabel}</span></td>
            <td><span class="badge ${statusBadge}">${statusLabel}</span></td>
            <td style="font-size: 11.5px;">${Shamsi.formatDate(u.createdAtUtc)}</td>
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
    projsTbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">در حال دریافت پروژه‌ها...</td></tr>';
    try {
      const res = await fetch(`/_baas/v1/users/${userId}/projects`);
      if (res.ok) {
        const projs = await res.json();
        if (projs.length === 0) {
          projsTbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">کاربر تاکنون پروژه‌ای ایجاد نکرده است.</td></tr>';
        } else {
          projsTbody.innerHTML = projs.map(p => `
            <tr>
              <td style="font-family: var(--font-mono); font-size: 11px;">${p.id}</td>
              <td style="font-weight: 600;">${p.name}</td>
              <td style="font-family: var(--font-mono); font-size: 11px;">${p.region}</td>
              <td><span class="badge ${p.status === 'Active' ? 'badge-active' : 'badge-paused'}">${p.status === 'Active' ? 'فعال' : 'معلق'}</span></td>
            </tr>
          `).join('');
        }
      }
    } catch {
      projsTbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--color-danger);">خطا در دریافت لیست پروژه‌ها.</td></tr>';
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
      alert('نقش کاربر با موفقیت تغییر یافت.');
      loadAdminUsers();
    }
  } catch {
    alert('خطا در تغییر نقش.');
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
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 18px;">هیچ پروژه‌ای تعریف نشده است.</td></tr>';
        return;
      }

      tbody.innerHTML = projs.map(p => `
        <tr class="table-row-clickable" onclick="openProjectModal('${p.id}')" title="برای مدیریت و مشاهده جزئیات کلیک کنید">
          <td style="font-family: var(--font-mono); font-size: 11.5px; color: var(--color-info);">${p.id}</td>
          <td style="font-weight: 700;">${p.name}</td>
          <td style="font-family: var(--font-mono); font-size: 12px;">${p.slug}</td>
          <td style="font-family: var(--font-mono);">${p.ownerPhone}</td>
          <td><span class="badge ${p.status === 'Active' ? 'badge-active' : 'badge-paused'}">${p.status === 'Active' ? 'فعال' : 'معلق'}</span></td>
          <td style="font-size: 11.5px;">${Shamsi.formatDate(p.createdAtUtc)}</td>
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
    toggleBtn.textContent = p.status === 'Active' ? 'مسدودسازی موقت پروژه (Suspended)' : 'فعال‌سازی مجدد پروژه (Active)';
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
              <code style="font-family: var(--font-mono); font-size: 11px; background: var(--bg-main); padding: 2px 6px; border: 1px solid var(--border-color); border-radius: 4px;">${apiKey}</code>
              <button type="button" class="btn-secondary" style="padding: 2px 6px; font-size: 10px;" onclick="copyApiKey('${apiKey}')">کپی</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  openModal('modal-project');
}

// 3. Pricing Catalog
async function loadAdminPricing() {
  try {
    const res = await fetch('/_baas/v1/admin/pricing');
    if (res.ok) {
      const p = await res.json();
      setVal('adm-p-db', p.dbQueryPer1kIrr);
      setVal('adm-p-sms', p.smsPerMessageIrr);
      setVal('adm-p-storage', p.storageGbMonthIrr);
      setVal('adm-p-compute', p.computePer100msIrr);
      setVal('adm-p-min-topup', p.minWalletTopupIrr);
      setVal('adm-p-free-credit', p.initialFreeCreditIrr);
      const maint = document.getElementById('adm-p-maint');
      if (maint) maint.checked = p.maintenanceMode;
    }
  } catch (err) {
    console.warn('Pricing load error:', err);
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

          return `
            <tr class="table-row-clickable" onclick="openTicketModal('${t.id}')" title="برای مشاهده و پاسخ به تیکت کلیک کنید">
              <td style="font-family: var(--font-mono); font-size: 11.5px;">${t.id}</td>
              <td style="font-family: var(--font-mono); font-weight: 600;">${t.customerPhone}</td>
              <td style="font-weight: 700;">${t.subject}</td>
              <td style="font-size: 12px; color: var(--text-muted);">${t.message.length > 50 ? t.message.substring(0, 50) + '...' : t.message}</td>
              <td><span class="badge ${statusBadge}">${statusLabel}</span></td>
              <td>
                <button type="button" class="btn-secondary" style="font-size: 11px; padding: 2px 8px;">
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
          <span style="font-weight: 700; color: var(--text-main);">کاربر / توسعه‌دهنده (${t.customerPhone})</span>
          <span>${Shamsi.formatDate(t.createdAtUtc)}</span>
        </div>
        <div>${t.message}</div>
      </div>
    `;

    if (t.replies && t.replies.length > 0) {
      t.replies.forEach(r => {
        const isStaff = r.senderRole === 'Admin' || r.senderRole === 'Operator';
        threadHtml += `
          <div class="thread-msg ${isStaff ? 'thread-msg-reply' : 'thread-msg-customer'}">
            <div class="thread-meta">
              <span style="font-weight: 700; color: ${isStaff ? 'var(--brand-dark)' : 'var(--text-main)'};">
                ${r.senderName} (${isStaff ? 'پشتیبانی' : 'کاربر'})
              </span>
              <span>${Shamsi.formatDate(r.createdAtUtc)}</span>
            </div>
            <div>${r.message}</div>
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
    alert('کلید با موفقیت در کلیپ‌بورد کپی شد.');
  }).catch(() => {
    prompt('کلید دسترسی:', key);
  });
}

function getServicePersianName(srv) {
  switch (srv.toLowerCase()) {
    case 'database': return 'پایگاه داده رابطه‌ای (PostgreSQL)';
    case 'auth': return 'احراز هویت پیامکی (SMS OTP)';
    case 'storage': return 'ذخیره‌سازی ابری فایل (Storage)';
    case 'functions': return 'توابع سرورلس لبه (Functions)';
    case 'sms': return 'سامانه پیام‌رسان (SMS)';
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
