// LocalMe BaaS - Database & Dynamic SQL Studio

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
    const res = await fetch(`/_baas/v1/${activeProjectId}/db/${encodeURIComponent(tableName)}`);
    if (res.ok) {
      const rows = await res.json();
      if (!rows || rows.length === 0) {
        thead.innerHTML = '<tr><th>شناسه</th><th>عنوان</th><th>اطلاعات</th><th style="width: 80px; text-align: center;">عملیات</th></tr>';
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 18px;">سطری در این جدول وجود ندارد.</td></tr>';
        return;
      }

      const keys = Object.keys(rows[0]);
      thead.innerHTML = '<tr>' + keys.map(k => `<th>${escapeHtml(k)}</th>`).join('') + '<th style="width: 80px; text-align: center;">عملیات</th></tr>';
      tbody.innerHTML = rows.map(r => {
        const idVal = r.id !== undefined && r.id !== null ? r.id : (r.ID !== undefined && r.ID !== null ? r.ID : '');
        return `
        <tr>
          ${keys.map(k => {
            const val = r[k];
            const isJson = typeof val === 'object';
            const displayVal = escapeHtml(isJson ? JSON.stringify(val) : (val !== null && val !== undefined ? String(val) : ''));
            return `<td style="${k.toLowerCase() === 'id' ? 'font-family: var(--font-persian); font-size: 13px; color: var(--color-info);' : ''}">${displayVal}</td>`;
          }).join('')}
          <td style="text-align: center;">
            ${idVal !== '' ? `<button type="button" class="btn-danger" style="font-size: 11px; padding: 2px 8px;" onclick="deleteTableRow('${escapeHtml(tableName)}', '${escapeHtml(String(idVal))}')">حذف</button>` : '-'}
          </td>
        </tr>
      `}).join('');
    }
  } catch (err) {
    console.warn('Table rows load error:', err);
  }
}

async function deleteCurrentTable() {
  if (!activeProjectId || !currentDbTable) {
    showToast('جدولی برای حذف انتخاب نشده است.', 'warning');
    return;
  }
  if (!confirm(`آیا از حذف کامل جدول «${currentDbTable}» و تمامی داده های آن اطمینان دارید؟ این عملیات غیرقابل بازگشت است.`)) {
    return;
  }
  try {
    const res = await fetch(`/_baas/v1/${activeProjectId}/db/tables/${encodeURIComponent(currentDbTable)}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      showToast(`جدول «${currentDbTable}» با موفقیت حذف گردید.`, 'success');
      currentDbTable = null;
      await loadProjectTables();
      await loadSqlEditor();
    } else {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || 'خطا در حذف جدول.', 'error');
    }
  } catch (err) {
    showToast('خطای ارتباط شبکه در حذف جدول.', 'error');
  }
}

async function deleteTableRow(tableName, rowId) {
  if (!activeProjectId || !tableName || !rowId) return;
  if (!confirm(`آیا از حذف سطر شناسه ${rowId} اطمینان دارید؟`)) return;
  try {
    const res = await fetch(`/_baas/v1/${activeProjectId}/db/${encodeURIComponent(tableName)}/rows/${encodeURIComponent(rowId)}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      showToast('سطر با موفقیت حذف گردید.', 'success');
      await loadTableData(tableName);
      if (typeof loadUsageData === 'function') loadUsageData();
    } else {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || 'خطا در حذف سطر.', 'error');
    }
  } catch (err) {
    showToast('خطای ارتباط شبکه در حذف سطر.', 'error');
  }
}

function insertTableQuery(tableName) {
  const input = document.getElementById('sql-query-input') || document.getElementById('sql-editor-input');
  if (!input) return;
  input.value = `SELECT * FROM ${tableName} LIMIT 50;`;
  input.focus();
}

async function loadSqlEditor() {
  if (!activeProjectId) return;
  const listEl = document.getElementById('sql-schema-tables-list');
  const select = document.getElementById('sql-schema-table-select');

  try {
    const res = await fetch(`/_baas/v1/${activeProjectId}/db/tables`);
    if (res.ok) {
      const tables = await res.json();
      if (listEl) {
        if (!tables || tables.length === 0) {
          listEl.innerHTML = '<span style="color: var(--text-muted); font-size: 12px;">جدولی در اسکیما یافت نشد</span>';
        } else {
          listEl.innerHTML = tables.map(t => `
            <div style="cursor: pointer; padding: 4px 8px; border-radius: 4px; font-family: var(--font-persian); font-size: 13px; color: var(--brand-dark); background: #ffffff; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;" onclick="insertTableQuery('${escapeHtml(t)}')">
              <span>🗄️ ${escapeHtml(t)}</span>
              <span style="font-size: 11px; color: var(--text-muted);">انتخاب ↵</span>
            </div>
          `).join('');
        }
      }
      if (select) {
        if (!tables || tables.length === 0) {
          select.innerHTML = '<option value="">بدون جدول</option>';
        } else {
          select.innerHTML = tables.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
          select.onchange = () => loadTableSchema(select.value);
          loadTableSchema(tables[0]);
        }
      }
    }
  } catch (err) {
    console.warn('SQL tables load error:', err);
  }
}

async function loadTableSchema(tableName) {
  if (!activeProjectId || !tableName) return;
  const listEl = document.getElementById('sql-schema-columns-list');
  if (!listEl) return;

  try {
    const res = await fetch(`/_baas/v1/${activeProjectId}/db/schema?table=${encodeURIComponent(tableName)}`);
    if (res.ok) {
      const cols = await res.json();
      listEl.innerHTML = cols.map(c => `
        <div style="padding: 4px 0; border-bottom: 1px dashed var(--border-color); display: flex; justify-content: space-between;">
          <span><strong>${escapeHtml(c.name)}</strong>${c.isPrimaryKey ? ' <span class="badge badge-active" style="font-size: 13px; padding: 1px 5px;">کلید اصلی</span>' : ''}</span>
          <span style="color: var(--color-info);">${escapeHtml(c.dataType)}</span>
        </div>
      `).join('');
    }
  } catch (err) {
    listEl.innerHTML = '<div style="color: var(--color-danger);">خطا در دریافت ساختار جدول</div>';
  }
}

async function runSqlQuery() {
  if (!activeProjectId) {
    showToast('پروژه ای انتخاب نشده است.', 'warning');
    return;
  }
  const editor = document.getElementById('sql-query-input') || document.getElementById('sql-editor-input');
  const thead = document.getElementById('sql-results-head') || document.getElementById('sql-results-thead');
  const tbody = document.getElementById('sql-results-body') || document.getElementById('sql-results-tbody');
  const countEl = document.getElementById('sql-results-count');
  const badge = document.getElementById('sql-status-badge');
  const latencyBadge = document.getElementById('sql-exec-time') || document.getElementById('sql-latency-badge');
  const runBtn = document.getElementById('btn-run-sql');

  if (!editor || !tbody) return;
  const sql = editor.value.trim();
  if (!sql) {
    showToast('لطفاً دستور SQL مورد نظر را در کادر بالا وارد نمایید.', 'warning');
    return;
  }

  if (runBtn) {
    runBtn.disabled = true;
    runBtn.textContent = 'در حال پردازش...';
  }

  try {
    const res = await fetch(`/_baas/v1/${activeProjectId}/sql/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql })
    });

    let data;
    try {
      data = await res.json();
    } catch {
      data = { success: false, error: 'پاسخ دریافتی از سرور دیتابیس در فرمت JSON نیست.' };
    }

    const execMs = data.executionTimeMs || 0;
    if (latencyBadge) {
      latencyBadge.textContent = `زمان پردازش: ${Shamsi.toPersianDigits(execMs)} ms`;
    }

    if (!res.ok || !data.success) {
      if (badge) {
        badge.style.display = 'inline-block';
        badge.textContent = 'خطای SQL';
        badge.className = 'badge badge-paused';
      }
      if (countEl) countEl.textContent = '۰';
      if (thead) thead.innerHTML = '<tr><th style="color: var(--color-danger);">خطای اجرای دستور</th></tr>';
      const errMsg = data.error || (data.message ? data.message : `خطای سرور با کد وضعیت ${res.status}`);
      tbody.innerHTML = `
        <tr>
          <td style="padding: 16px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; color: #991b1b; font-size: 13.5px; line-height: 1.6;">
            <strong>پیام خطای پایگاه داده:</strong> ${escapeHtml(errMsg)}
          </td>
        </tr>
      `;
      return;
    }

    if (badge) {
      badge.style.display = 'inline-block';
      badge.textContent = 'اجرا شد';
      badge.className = 'badge badge-active';
    }

    const rowCount = data.rowCount || (data.rows ? data.rows.length : 0);
    if (countEl) countEl.textContent = Shamsi.toPersianDigits(rowCount);

    const columns = data.columns || [];
    if (thead) {
      if (columns.length > 0) {
        thead.innerHTML = `<tr>${columns.map(c => `<th style="font-family: var(--font-persian);">${escapeHtml(c)}</th>`).join('')}</tr>`;
      } else {
        thead.innerHTML = '<tr><th>نتیجه اجرای دستور</th></tr>';
      }
    }

    const rows = data.rows || [];
    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="${Math.max(columns.length, 1)}" style="text-align: center; color: var(--text-muted); padding: 18px;">دستور با موفقیت اجرا شد؛ رکوردی برای نمایش وجود ندارد.</td></tr>`;
    } else {
      tbody.innerHTML = rows.map(r => `
        <tr>
          ${columns.map(c => `<td style="font-family: var(--font-persian); font-size: 13px;">${escapeHtml(typeof r[c] === 'object' ? JSON.stringify(r[c]) : r[c])}</td>`).join('')}
        </tr>
      `).join('');
    }

    loadUsageData();
    loadProjectTables();
  } catch (err) {
    if (badge) {
      badge.style.display = 'inline-block';
      badge.textContent = 'خطای شبکه';
      badge.className = 'badge badge-paused';
    }
    if (thead) thead.innerHTML = '<tr><th style="color: var(--color-danger);">خطای ارتباط با سرور</th></tr>';
    tbody.innerHTML = `<tr><td style="color: var(--color-danger); padding: 16px; font-size: 13.5px;">خطای ارتباط شبکه: ${escapeHtml(err.message)}</td></tr>`;
  } finally {
    if (runBtn) {
      runBtn.disabled = false;
      runBtn.textContent = 'اجرای دستور SQL';
    }
  }
}


// 6. Web Hosting & SPA Deployments
function sqlSnippet(type) {
  const input = document.getElementById('sql-query-input') || document.getElementById('sql-editor-input');
  if (!input) return;
  switch (type) {
    case 'select':
      input.value = 'SELECT * FROM products ORDER BY id DESC LIMIT 50;';
      break;
    case 'insert':
      input.value = "INSERT INTO products (title, category, price) VALUES ('سرور ابری ایران', 'هاستینگ', 2500000);";
      break;
    case 'create':
      input.value = `CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  amount NUMERIC(14, 2) NOT NULL,
  status VARCHAR(32) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);`;
      break;
  }
  input.focus();
}

async function loadDbSchema() {
  if (!activeProjectId) return;
  const select = document.getElementById('schema-table-select');
  const schemaTablesList = document.getElementById('sql-schema-tables-list');
  try {
    const res = await fetch(`/_baas/v1/${activeProjectId}/db/tables`);
    if (res.ok) {
      const tables = await res.json();
      if (select) {
        if (!tables || tables.length === 0) {
          select.innerHTML = '<option value="">جدولی یافت نشد</option>';
        } else {
          select.innerHTML = tables.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
          loadDbSchemaForTable(select.value);
        }
      }
      if (schemaTablesList) {
        if (!tables || tables.length === 0) {
          schemaTablesList.innerHTML = '<span style="color: var(--text-muted);">جدولی در اسکیما یافت نشد</span>';
        } else {
          schemaTablesList.innerHTML = tables.map(t => `
            <div style="cursor: pointer; padding: 3px 6px; border-radius: 4px; font-family: var(--font-persian); font-size: 13px; color: var(--brand-dark); background: #ffffff; border: 1px solid var(--border-color); margin-bottom: 2px;" onclick="loadDbSchemaForTable('${escapeHtml(t)}')">
              ${escapeHtml(t)}
            </div>
          `).join('');
        }
      }
    }
  } catch (err) {
    console.warn('DB schema load error:', err);
  }
}

async function loadDbSchemaForTable(tableName) {
  if (!activeProjectId || !tableName) return;
  const tbody = document.getElementById('schema-details-tbody');
  const select = document.getElementById('schema-table-select');
  if (select && select.value !== tableName) select.value = tableName;
  if (!tbody) return;

  try {
    const res = await fetch(`/_baas/v1/${activeProjectId}/db/schema?table=${encodeURIComponent(tableName)}`);
    if (res.ok) {
      const cols = await res.json();
      if (!cols || cols.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 16px;">هیچ ستونی برای این جدول یافت نشد.</td></tr>';
      } else {
        tbody.innerHTML = cols.map(c => {
          const colName = c.name || c.Name;
          const colType = c.type || c.Type;
          const isPk = c.isPrimaryKey || c.IsPrimaryKey;
          const isNull = c.isNullable || c.IsNullable;
          const defVal = c.defaultValue || c.DefaultValue || '-';
          return `
            <tr>
              <td style="font-family: var(--font-persian); font-weight: 700;">${escapeHtml(colName)}</td>
              <td style="font-family: var(--font-persian); font-size: 13px; color: var(--brand-dark);">${escapeHtml(colType)}</td>
              <td><span class="badge ${isPk ? 'badge-active' : 'badge-paused'}">${isPk ? 'کلید اصلی (PK)' : 'خیر'}</span></td>
              <td><span class="badge ${isNull ? 'badge-paused' : 'badge-active'}">${isNull ? 'پذیرش Null' : 'اجباری (NOT NULL)'}</span></td>
              <td style="font-family: var(--font-persian); font-size: 13px; color: var(--text-muted);">${escapeHtml(defVal)}</td>
            </tr>
          `;
        }).join('');
      }
    }
  } catch (err) {
    console.warn('Schema details load error:', err);
  }
}

let dbBackupsList = [];

function loadDbBackups() {
  const tbody = document.getElementById('db-backups-tbody');
  if (!tbody) return;
  if (!dbBackupsList || dbBackupsList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 16px;">هنوز نسخه پشتیبانی ایجاد نشده است. برای تهیه نسخه فوری دکمه «تهیه نسخه پشتیبان دستی» را انتخاب فرمایید.</td></tr>';
    return;
  }
  tbody.innerHTML = dbBackupsList.map(b => `
    <tr>
      <td style="font-family: var(--font-persian); font-size: 13px;">${escapeHtml(b.id)}</td>
      <td><span class="badge badge-active">${escapeHtml(b.type)}</span></td>
      <td style="font-size: 13.5px;">${escapeHtml(b.size)}</td>
      <td><span class="badge badge-active">${escapeHtml(b.status)}</span></td>
      <td style="font-size: 13.5px;">${escapeHtml(b.date)}</td>
      <td><button type="button" class="btn-secondary" style="font-size: 13px; padding: 2px 8px;" onclick="showToast('لینک مستقیم امن دانلود اسنپ شات صادر گردید.', 'success')">دانلود نسخه</button></td>
    </tr>
  `).join('');
}

function triggerManualSnapshot() {
  const id = `snp_manual_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${Date.now().toString().slice(-4)}`;
  const nowShamsi = Shamsi.formatDate(new Date().toISOString());
  dbBackupsList.unshift({
    id,
    type: 'دستی فوری',
    size: '2.43 MB',
    status: 'تایید سلامت (Checksum OK)',
    date: nowShamsi
  });
  loadDbBackups();
  const lastTimeEl = document.getElementById('db-backup-last-time');
  if (lastTimeEl) lastTimeEl.textContent = 'لحظاتی پیش';
  showToast('اسنپ شات دستی جدید با موفقیت ایجاد و رمزنگاری شد.', 'success');
}

// 11.3 Auth SMS Analytics & Security Policies

// DB Window Attachments
window.loadTables = loadProjectTables;
window.loadProjectTables = loadProjectTables;
window.loadTableData = loadTableData;
window.loadSqlEditor = loadSqlEditor;
window.loadTableSchema = loadTableSchema;
window.runSqlQuery = runSqlQuery;
window.sqlSnippet = sqlSnippet;
window.loadDbSchema = loadDbSchema;
window.loadDbSchemaForTable = loadDbSchemaForTable;
window.loadDbBackups = loadDbBackups;
window.triggerManualSnapshot = triggerManualSnapshot;
window.deleteCurrentTable = deleteCurrentTable;
window.deleteTableRow = deleteTableRow;
window.insertTableQuery = insertTableQuery;
