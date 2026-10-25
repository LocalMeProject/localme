// =====================================================================
// LocalMe BaaS Admin - System & Console Logging Stream Engine
// =====================================================================

(function() {
  let autoRefreshTimer = null;
  let isFetching = false;

  document.addEventListener('DOMContentLoaded', () => {
    initAdminLogs();
  });

  function initAdminLogs() {
    const refreshBtn = document.getElementById('btn-admin-refresh-logs');
    if (refreshBtn) refreshBtn.addEventListener('click', () => fetchAdminLogs(true));

    const clearBtn = document.getElementById('btn-admin-clear-logs');
    if (clearBtn) clearBtn.addEventListener('click', clearAdminLogs);

    const filterBtn = document.getElementById('btn-admin-apply-log-filter');
    if (filterBtn) filterBtn.addEventListener('click', () => fetchAdminLogs(true));

    const levelSelect = document.getElementById('adm-filter-log-level');
    if (levelSelect) levelSelect.addEventListener('change', () => fetchAdminLogs(true));

    const limitSelect = document.getElementById('adm-filter-log-limit');
    if (limitSelect) limitSelect.addEventListener('change', () => fetchAdminLogs(true));

    const searchInput = document.getElementById('adm-filter-log-search');
    if (searchInput) {
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          fetchAdminLogs(true);
        }
      });
    }

    // Auto-refresh timer toggle
    const autoBox = document.getElementById('adm-logs-auto-refresh');
    if (autoBox) {
      autoBox.addEventListener('change', () => {
        setupAutoRefresh();
      });
    }

    // When the logs tab is clicked in sidebar, trigger initial fetch
    const logsTabBtn = document.querySelector('.sidebar-link[data-view="admin-view-logs"]');
    if (logsTabBtn) {
      logsTabBtn.addEventListener('click', () => {
        fetchAdminLogs(true);
      });
    }

    setupAutoRefresh();
  }

  function setupAutoRefresh() {
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer);
      autoRefreshTimer = null;
    }
    const autoBox = document.getElementById('adm-logs-auto-refresh');
    if (autoBox && autoBox.checked) {
      autoRefreshTimer = setInterval(() => {
        const viewLogs = document.getElementById('admin-view-logs');
        if (viewLogs && viewLogs.classList.contains('active')) {
          fetchAdminLogs(false);
        }
      }, 3000);
    }
  }

  async function fetchAdminLogs(showToasts = false) {
    if (isFetching) return;
    isFetching = true;

    try {
      const level = document.getElementById('adm-filter-log-level')?.value || 'all';
      const search = document.getElementById('adm-filter-log-search')?.value?.trim() || '';
      const limit = document.getElementById('adm-filter-log-limit')?.value || '100';

      const params = new URLSearchParams();
      if (level && level !== 'all') params.append('level', level);
      if (search) params.append('search', search);
      params.append('limit', limit);

      const [logsRes, cfgRes] = await Promise.all([
        fetch(`/_baas/v1/admin/logs?${params.toString()}`),
        fetch('/_baas/v1/admin/config')
      ]);

      if (cfgRes.ok) {
        const cfg = await cfgRes.json();
        updateLoggingStats(cfg);
      }

      if (logsRes.ok) {
        const logs = await logsRes.json();
        renderLogsTable(logs);
        const countEl = document.getElementById('adm-logs-stat-count');
        if (countEl) countEl.textContent = Shamsi.toPersianDigits(logs.length);
        if (showToasts) {
          showToast(`فهرست لاگ ها به روزرسانی گردید (${logs.length} رکورد).`, 'info');
        }
      } else if (showToasts) {
        showToast('خطا در دریافت لاگ های پلتفرم از سرور.', 'error');
      }
    } catch (err) {
      console.warn('Logs fetch error:', err);
      if (showToasts) {
        showToast('خطای شبکه در دریافت لاگ ها: ' + (err?.message || ''), 'error');
      }
    } finally {
      isFetching = false;
    }
  }

  function updateLoggingStats(cfg) {
    const platEl = document.getElementById('adm-logs-stat-platform');
    if (platEl) {
      const isPlat = cfg.isPlatformLoggingActive !== false;
      platEl.textContent = isPlat ? 'فعال' : 'غیرفعال';
      platEl.className = isPlat ? 'badge badge-active' : 'badge badge-paused';
    }

    const conEl = document.getElementById('adm-logs-stat-console');
    if (conEl) {
      const isCon = cfg.consoleLoggingEnabled !== false;
      conEl.textContent = isCon ? 'فعال' : 'غیرفعال';
      conEl.className = isCon ? 'badge badge-active' : 'badge badge-paused';
    }

    const lvlEl = document.getElementById('adm-logs-stat-level');
    if (lvlEl) {
      lvlEl.textContent = cfg.platformLogLevel || 'Information';
    }
  }

  function renderLogsTable(logs) {
    const tbody = document.getElementById('admin-logs-tbody');
    if (!tbody) return;

    if (!logs || logs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 24px;">
            هیچ لاگی با فیلترهای انتخابی در بافر موجود نیست.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = logs.map(log => {
      const lvl = (log.logLevel || 'Info').toUpperCase();
      let badgeClass = 'badge-info';
      if (lvl.includes('ERR') || lvl.includes('CRIT')) badgeClass = 'badge-paused';
      else if (lvl.includes('WARN')) badgeClass = 'badge-warning';
      else if (lvl.includes('DEBUG') || lvl.includes('TRACE')) badgeClass = '';

      const dt = new Date(log.timestampUtc);
      const timeStr = dt.toTimeString().split(' ')[0] + '.' + String(dt.getMilliseconds()).padStart(3, '0');
      const shamsiDate = Shamsi.formatDate(dt);

      const hasEx = !!log.exception;
      const exBlock = hasEx ? `
        <div style="margin-top: 6px;">
          <details>
            <summary style="font-size: 11.5px; color: #ef4444; cursor: pointer; user-select: none;">نمایش پشته خطای سیستمی (Stack Trace)</summary>
            <pre style="margin-top: 4px; padding: 8px; font-size: 11.5px; background: #1e1e24; color: #f87171; border-radius: 4px; overflow-x: auto; direction: ltr; text-align: left; font-family: monospace;">${escapeHtml(log.exception)}</pre>
          </details>
        </div>
      ` : '';

      return `
        <tr>
          <td style="font-family: monospace; font-size: 12px; direction: ltr; text-align: right;">
            <div>${escapeHtml(timeStr)}</div>
            <div style="font-size: 10.5px; color: var(--text-muted);">${escapeHtml(shamsiDate)}</div>
          </td>
          <td>
            <span class="badge ${badgeClass}" style="font-family: monospace; font-size: 11px;">${escapeHtml(lvl)}</span>
          </td>
          <td style="font-family: monospace; font-size: 12px; direction: ltr; text-align: right; color: var(--text-muted);">
            ${escapeHtml(log.category || 'General')}
          </td>
          <td style="font-size: 13px; line-height: 1.5; word-break: break-word;">
            <span>${escapeHtml(log.message || '')}</span>
            ${exBlock}
          </td>
        </tr>
      `;
    }).join('');
  }

  async function clearAdminLogs() {
    try {
      const res = await fetch('/_baas/v1/admin/logs', { method: 'DELETE' });
      if (res.ok) {
        showToast('تمام لاگ های پلتفرم از بافر حافظه با موفقیت پاک سازی شدند.', 'success');
        fetchAdminLogs(false);
      } else {
        showToast('خطا در پاک سازی لاگ ها.', 'error');
      }
    } catch (err) {
      showToast('خطای شبکه در پاک سازی لاگ ها: ' + (err?.message || ''), 'error');
    }
  }

  window.fetchAdminLogs = fetchAdminLogs;
  window.clearAdminLogs = clearAdminLogs;
})();
