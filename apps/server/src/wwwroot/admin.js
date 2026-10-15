// LocalMe SuperAdmin & Operator Console Engine
let adminUser = null;

document.addEventListener('DOMContentLoaded', () => {
  initAdminSession();
  initAdminNav();
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

// 1. Users Management
async function loadAdminUsers() {
  const tbody = document.getElementById('admin-users-tbody');
  if (!tbody) return;

  try {
    const res = await fetch('/_baas/v1/users');
    if (res.ok) {
      const users = await res.json();
      tbody.innerHTML = users.map(u => {
        const roleLabel = u.role === 0 ? 'مدیر ارشد' : u.role === 1 ? 'اپراتور' : 'توسعه‌دهنده';
        const roleBadgeClass = u.role === 0 ? 'badge-paused' : u.role === 1 ? 'badge-info' : 'badge-active';

        return `
          <tr>
            <td style="font-family: var(--font-mono); font-size: 11.5px; color: var(--color-info);">${u.id}</td>
            <td style="font-weight: 700;">${u.fullName}</td>
            <td style="font-family: var(--font-mono);">${u.phone}</td>
            <td style="font-family: var(--font-mono); font-size: 12px; color: var(--text-muted);">${u.email}</td>
            <td><span class="badge ${roleBadgeClass}">${roleLabel}</span></td>
            <td>
              ${adminUser.role === 0 ? `
                <select class="input-field" style="padding: 2px 6px; font-size: 11.5px; width: auto;" onchange="changeUserRole('${u.id}', this.value)">
                  <option value="Admin" ${u.role === 0 ? 'selected' : ''}>مدیر ارشد</option>
                  <option value="Operator" ${u.role === 1 ? 'selected' : ''}>اپراتور</option>
                  <option value="Developer" ${u.role === 2 ? 'selected' : ''}>توسعه‌دهنده</option>
                </select>
              ` : `<span style="font-size: 11px; color: var(--text-light);">-</span>`}
            </td>
            <td style="font-size: 11.5px;">${Shamsi.formatDate(u.createdAtUtc)}</td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    console.warn('Users load error:', err);
  }
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
      if (!projs || projs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 18px;">هیچ پروژه‌ای تعریف نشده است.</td></tr>';
        return;
      }

      tbody.innerHTML = projs.map(p => `
        <tr>
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

// 4. System Stats & Tickets
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
        tbody.innerHTML = stats.recentTickets.map(t => {
          const statusBadge = t.status === 'Resolved' ? 'badge-active' : t.status === 'Investigating' ? 'badge-info' : 'badge-paused';
          const statusLabel = t.status === 'Resolved' ? 'حل شده' : t.status === 'Investigating' ? 'در حال بررسی' : 'باز';

          return `
            <tr>
              <td style="font-family: var(--font-mono); font-size: 11.5px;">${t.id}</td>
              <td style="font-family: var(--font-mono); font-weight: 600;">${t.customerPhone}</td>
              <td style="font-weight: 700;">${t.subject}</td>
              <td style="font-size: 12px; color: var(--text-muted);">${t.message}</td>
              <td><span class="badge ${statusBadge}">${statusLabel}</span></td>
              <td>
                <select class="input-field" style="padding: 2px 6px; font-size: 11.5px; width: auto;" onchange="updateTicketStatus('${t.id}', this.value)">
                  <option value="Open" ${t.status === 'Open' ? 'selected' : ''}>باز</option>
                  <option value="Investigating" ${t.status === 'Investigating' ? 'selected' : ''}>در حال بررسی</option>
                  <option value="Resolved" ${t.status === 'Resolved' ? 'selected' : ''}>حل شده</option>
                </select>
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

async function updateTicketStatus(ticketId, status) {
  try {
    const res = await fetch(`/_baas/v1/admin/tickets/${ticketId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      alert('وضعیت تیکت به‌روزرسانی شد.');
      loadAdminStats();
    }
  } catch {
    alert('خطا در به‌روزرسانی تیکت.');
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
