// LocalMe BaaS - Auth Users & Policies Management

async function loadProjectUsers() {
  const tbody = document.getElementById('auth-users-tbody');
  if (!tbody || !activeProjectId) return;

  try {
    const res = await fetch(`/_baas/v1/${activeProjectId}/auth/users`);
    if (res.ok) {
      const users = await res.json();
      if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 18px;">کاربری در این پروژه ثبت نام نکرده است. برای ایجاد کاربر روی «+ ثبت و تست کاربر» کلیک کنید.</td></tr>';
        return;
      }

      tbody.innerHTML = users.map(u => {
        const identifier = u.username ? `${u.username} (${u.phone || u.email || 'بدون تماس'})` : (u.phone || u.email || '-');
        const providerName = u.provider === 'sms_otp' ? 'پیامک یکبارمصرف' :
                             u.provider === 'password' ? 'نام کاربری و رمز عبور' :
                             u.provider === 'oauth_google' ? 'گوگل' :
                             u.provider === 'oauth_github' ? 'گیت‌هاب' : (u.provider || 'سیستمی');

        const isConfirmed = u.isConfirmed !== false;
        return `
          <tr>
            <td style="font-size: 13.5px; color: var(--color-info);">${escapeHtml(u.id)}</td>
            <td style="font-weight: 600;">${escapeHtml(identifier)}</td>
            <td>${escapeHtml(u.fullName || '-')}</td>
            <td><span class="badge badge-info" style="font-size: 12.5px;">${escapeHtml(providerName)}</span></td>
            <td><span class="badge ${isConfirmed ? 'badge-active' : 'badge-paused'}">${isConfirmed ? 'فعال و تاییدشده' : 'معلق / غیرفعال'}</span></td>
            <td style="font-size: 13px;">${escapeHtml(Shamsi.formatDate(u.createdAtUtc))}</td>
            <td>
              <div style="display: flex; gap: 4px;">
                <button type="button" class="btn-secondary" style="font-size: 12.5px; padding: 2px 8px;" onclick="toggleUserStatus('${escapeHtml(u.id)}', ${!isConfirmed})" title="تغییر وضعیت فعال/معلق">
                  ${isConfirmed ? 'تعلیق' : 'فعال سازی'}
                </button>
                <button type="button" class="btn-secondary" style="font-size: 12.5px; padding: 2px 8px;" onclick="openResetPasswordModal('${escapeHtml(u.id)}', '${escapeHtml(identifier)}')" title="تغییر یا بازنشانی کلمه عبور">
                  رمز عبور
                </button>
                <button type="button" class="btn-danger" style="font-size: 12.5px; padding: 2px 8px;" onclick="deleteProjectUser('${escapeHtml(u.id)}')" title="حذف کاربر">
                  حذف
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    console.warn('Users fetch error:', err);
  }
}

async function toggleUserStatus(userId, newStatus) {
  if (!activeProjectId || !userId) return;
  try {
    const res = await fetch(`/_baas/v1/${activeProjectId}/auth/users/${userId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_confirmed: newStatus })
    });
    if (res.ok) {
      showToast('وضعیت کاربر به روزرسانی شد.', 'success');
      await loadProjectUsers();
    } else {
      showToast('خطا در تغییر وضعیت کاربر.', 'error');
    }
  } catch (err) {
    showToast('خطای شبکه: ' + err.message, 'error');
  }
}

function openResetPasswordModal(userId, desc) {
  setVal('reset-pwd-user-id', userId);
  setVal('reset-pwd-user-desc', desc);
  setVal('reset-pwd-new-pass', '');
  openModal('modal-reset-password');
}

async function handleResetPasswordSubmit(e) {
  if (e) e.preventDefault();
  const userId = getVal('reset-pwd-user-id');
  const password = getVal('reset-pwd-new-pass');
  if (!activeProjectId || !userId || !password) return;

  try {
    const res = await fetch(`/_baas/v1/${activeProjectId}/auth/users/${userId}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    if (res.ok) {
      showToast('کلمه عبور جدید کاربر با موفقیت ثبت شد.', 'success');
      closeModal('modal-reset-password');
    } else {
      const d = await res.json().catch(() => ({}));
      showToast('خطا در بازنشانی رمز عبور: ' + (d.error || 'عملیات ناموفق بود'), 'error');
    }
  } catch (err) {
    showToast('خطای شبکه: ' + err.message, 'error');
  }
}

async function deleteProjectUser(userId) {
  if (!confirm('آیا از حذف این کاربر از پروژه اطمینان دارید؟')) return;
  if (!activeProjectId || !userId) return;

  try {
    const res = await fetch(`/_baas/v1/${activeProjectId}/auth/users/${userId}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      showToast('کاربر با موفقیت حذف گردید.', 'success');
      await loadProjectUsers();
    } else {
      showToast('خطا در حذف کاربر.', 'error');
    }
  } catch (err) {
    showToast('خطای شبکه در حذف کاربر: ' + err.message, 'error');
  }
}

// 5. Subsystem: Storage Buckets
function filterUsersList(term) {
  const tbody = document.getElementById('auth-users-tbody');
  if (!tbody) return;
  const rows = tbody.getElementsByTagName('tr');
  const q = (term || '').toLowerCase().trim();
  for (let r of rows) {
    if (!q) {
      r.style.display = '';
    } else {
      r.style.display = r.textContent.toLowerCase().includes(q) ? '' : 'none';
    }
  }
}

async function loadSmsLogs() {
  const tbody = document.getElementById('auth-sms-logs-tbody');
  const totalEl = document.getElementById('sms-total-count');
  if (!tbody) return;
  if (!activeProjectId) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 18px;">ابتدا پروژه ای را انتخاب فرمایید.</td></tr>';
    if (totalEl) totalEl.textContent = '۰';
    return;
  }
  try {
    const res = await fetch(`/_baas/v1/${activeProjectId}/auth/sms-logs`);
    if (res.ok) {
      const logs = await res.json();
      if (!logs || logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 18px;">هیچ پیامک OTP ثبت یا ارسال نشده است. لاگ های ارسال زنده پیامک در اینجا نمایش داده خواهند شد.</td></tr>';
        if (totalEl) totalEl.textContent = '۰';
        return;
      }
      tbody.innerHTML = logs.map(l => {
        const phoneMatch = l.message.match(/09\d{9}/) || l.message.match(/۰۹[\u06F0-\u06F9]{9}/);
        const recipient = phoneMatch ? phoneMatch[0] : 'شماره کاربر';
        return `
          <tr>
            <td style="font-family: var(--font-persian); font-size: 13px;">${escapeHtml(l.traceId || ('sms_' + (l.id || Math.random().toString(36).substring(2, 8))))}</td>
            <td style="font-family: var(--font-persian); font-size: 13px;">${escapeHtml(recipient)}</td>
            <td style="font-size: 13.5px;">الگوی احراز هویت پیامکی (کاوه نگار)</td>
            <td><span class="badge badge-active">کاوه نگار (خط خدماتی)</span></td>
            <td><span class="badge badge-active">تحویل موفق</span></td>
            <td style="font-size: 13.5px;">${escapeHtml(Shamsi.formatDate(l.timestampUtc))}</td>
          </tr>
        `;
      }).join('');
      if (totalEl) totalEl.textContent = Shamsi.toPersianDigits(logs.length);
    }
  } catch (err) {
    console.warn('SMS logs load error:', err);
  }
}

function loadAuthPolicies() {
  if (!activeProject) return;
  const cfg = activeProject.services?.auth?.settings || {};
  setVal('policy-otp-ttl', cfg.otp_expiry_seconds || '120');
  setVal('policy-max-retries', cfg.max_retries || '5');
  setVal('policy-lockout-mins', cfg.lockout_minutes || '15');
  setVal('policy-jwt-hours', cfg.jwt_expiry_hours || '72');
  if (typeof populateServiceInputs === 'function') {
    populateServiceInputs('auth', cfg);
  }
}

async function saveAuthPolicies(e) {
  if (e) e.preventDefault();
  if (!activeProjectId) return;
  const existingCfg = activeProject.services?.auth?.settings || {};
  const settings = {
    ...existingCfg,
    otp_expiry_seconds: document.getElementById('policy-otp-ttl')?.value || existingCfg.otp_expiry_seconds || '120',
    max_retries: document.getElementById('policy-max-retries')?.value || existingCfg.max_retries || '5',
    lockout_minutes: document.getElementById('policy-lockout-mins')?.value || existingCfg.lockout_minutes || '15',
    jwt_expiry_hours: document.getElementById('policy-jwt-hours')?.value || existingCfg.jwt_expiry_hours || '72'
  };
  await saveServiceConfig('auth', true, settings);
  showToast('سیاست های امنیتی احراز هویت با موفقیت ذخیره گردید.', 'success');
}

// 11.4 Storage File Explorer & ACL Policies

// Auth Window Attachments
window.loadProjectUsers = loadProjectUsers;
window.toggleUserStatus = toggleUserStatus;
window.openResetPasswordModal = openResetPasswordModal;
window.handleResetPasswordSubmit = handleResetPasswordSubmit;
window.deleteProjectUser = deleteProjectUser;
window.filterUsersList = filterUsersList;
window.loadSmsLogs = loadSmsLogs;
window.loadAuthPolicies = loadAuthPolicies;
window.saveAuthPolicies = saveAuthPolicies;
