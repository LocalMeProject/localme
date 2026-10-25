// LocalMe BaaS - Project Settings, Usage & Security

function copyFieldValue(inputId) {
  const el = document.getElementById(inputId);
  if (el) {
    navigator.clipboard.writeText(el.value).then(() => {
      showToast('کلید دسترسی با موفقیت در کلیپ بورد کپی شد.', 'success');
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



function copyFieldValue(inputId) {
  const el = document.getElementById(inputId);
  if (el) {
    navigator.clipboard.writeText(el.value).then(() => {
      showToast('کلید دسترسی با موفقیت در کلیپ بورد کپی شد.', 'success');
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
      const formattedCost = summary.formattedCostToman || summary.formattedTotalCostToman || Shamsi.toPersianDigits(Math.floor((summary.totalCostIrr || 0) / 10).toLocaleString());
      setText('usage-val-db', Shamsi.toPersianDigits(summary.totalDbQueries || 0));
      setText('usage-val-sms', Shamsi.toPersianDigits(summary.totalSmsSent || 0));
      setText('usage-val-compute', `${Shamsi.toPersianDigits(summary.totalComputeMs || 0)} ms`);
      setText('usage-val-cost', `${formattedCost} تومان`);

      setText('ov-val-queries', Shamsi.toPersianDigits(summary.totalDbQueries || 0));
      setText('ov-val-sms', Shamsi.toPersianDigits(summary.totalSmsSent || 0));
      setText('ov-val-cost', `${formattedCost} تومان`);

      const tbody = document.getElementById('usage-events-tbody');
      if (tbody && summary.recentEvents) {
        tbody.innerHTML = summary.recentEvents.map(e => {
          const resType = escapeHtml(e.resourceType || e.metricType || 'نامشخص');
          const units = Shamsi.toPersianDigits(e.units ?? e.quantity ?? 0);
          const costIrr = e.costIrr ?? 0;
          const formattedIrr = Shamsi.toPersianDigits(costIrr.toLocaleString());
          const formattedToman = Shamsi.toPersianDigits(Math.floor(costIrr / 10).toLocaleString());
          const dateStr = escapeHtml(Shamsi.formatDate(e.recordedAtUtc || e.timestampUtc));
          return `
          <tr>
            <td style="font-family: var(--font-persian); font-size: 13px; font-weight: 600;">${resType}</td>
            <td style="font-family: var(--font-persian);">${units}</td>
            <td style="font-family: var(--font-persian); font-size: 13px;">${formattedIrr}</td>
            <td style="font-weight: 700; color: var(--brand-dark);">${formattedToman} تومان</td>
            <td style="font-size: 13px;">${dateStr}</td>
          </tr>
        `;
        }).join('');
      }
    }
  } catch (err) {
    console.warn('Usage fetch error:', err);
  }
}

function initShamsiDatepicker() {
  try {
    const triggerBtn = document.getElementById('btn-shamsi-dp-trigger');
    const popoverBox = document.getElementById('shamsi-dp-popover-box');
    const filterText = document.getElementById('dp-filter-text');

    if (!triggerBtn || !popoverBox) return;

    const DatepickerClass = window.ShamsiDatepicker || (window.Shamsi && window.Shamsi.Datepicker);
    if (!DatepickerClass) {
      console.warn('ShamsiDatepicker not available');
      return;
    }

    const dp = new DatepickerClass(popoverBox, (selectedDate, isRange, rangeStart, rangeEnd) => {
      if (isRange && rangeStart && rangeEnd) {
        filterText.textContent = `فیلتر: ${rangeStart.year}/${rangeStart.month}/${rangeStart.day} تا ${rangeEnd.year}/${rangeEnd.month}/${rangeEnd.day}`;
        popoverBox.style.display = 'none';
        loadUsageData();
      } else if (selectedDate) {
        filterText.textContent = `فیلتر: ${selectedDate.year}/${selectedDate.month}/${selectedDate.day}`;
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
  } catch (err) {
    console.warn('ShamsiDatepicker initialization error safely intercepted:', err);
  }
}

// Project Scoped Password Management
async function loadProjectPasswordStatus(projectId) {
  const badge = document.getElementById('proj-password-status-badge');
  const removeBtn = document.getElementById('btn-remove-project-password');
  const msgEl = document.getElementById('project-password-msg');
  if (msgEl) msgEl.textContent = '';

  try {
    const res = await fetch(`/_baas/v1/projects/${projectId}/password-status`);
    if (res.ok) {
      const data = await res.json();
      if (data.hasPassword) {
        if (badge) {
          badge.textContent = 'رمز اختصاصی فعال است';
          badge.className = 'badge badge-active';
        }
        if (removeBtn) removeBtn.style.display = 'inline-block';
      } else {
        if (badge) {
          badge.textContent = 'رمز اختصاصی تنظیم نشده';
          badge.className = 'badge badge-paused';
        }
        if (removeBtn) removeBtn.style.display = 'none';
      }
    }
  } catch (err) {
    console.warn('Failed to load project security credential status:', err);
  }
}

function initProjectPasswordListeners() {
  const form = document.getElementById('form-project-password');
  const removeBtn = document.getElementById('btn-remove-project-password');
  const msgEl = document.getElementById('project-password-msg');
  const input = document.getElementById('input-project-password');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeProjectId) return;
      const password = input.value.trim();
      if (!password) return;

      try {
        const res = await fetch(`/_baas/v1/projects/${activeProjectId}/password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          input.value = '';
          if (msgEl) {
            msgEl.textContent = 'رمز عبور اختصاصی پروژه با موفقیت ثبت شد.';
            msgEl.style.color = 'var(--brand-dark)';
          }
          await loadProjectPasswordStatus(activeProjectId);
        } else {
          if (msgEl) {
            msgEl.textContent = data.error || 'خطا در ثبت رمز عبور پروژه.';
            msgEl.style.color = 'var(--color-danger)';
          }
        }
      } catch (err) {
        if (msgEl) {
          msgEl.textContent = 'خطای ارتباط با سرور.';
          msgEl.style.color = 'var(--color-danger)';
        }
      }
    });
  }

  if (removeBtn) {
    removeBtn.addEventListener('click', async () => {
      if (!activeProjectId) return;
      if (!confirm('آیا از حذف رمز عبور اختصاصی این پروژه اطمینان دارید؟ ورود مستقیم با اسلاگ غیرفعال خواهد شد.')) return;

      try {
        const res = await fetch(`/_baas/v1/projects/${activeProjectId}/password`, {
          method: 'DELETE'
        });
        const data = await res.json();
        if (res.ok && data.success) {
          if (msgEl) {
            msgEl.textContent = 'رمز عبور اختصاصی پروژه با موفقیت حذف شد.';
            msgEl.style.color = 'var(--brand-dark)';
          }
          await loadProjectPasswordStatus(activeProjectId);
        } else {
          showToast(data.error || 'خطا در حذف رمز عبور.', 'error');
        }
      } catch (err) {
        showToast('خطای ارتباط با سرور.', 'error');
      }
    });
  }
}

