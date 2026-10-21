// LocalMe BaaS - Edge Functions Script Studio
var funcEnvVars = window.funcEnvVars = window.funcEnvVars || [];

const SCRIPT_TEMPLATES = {
  webhook: `// استاندارد مدیریت وب‌هوک ورودی (JSON Webhook Handler)
function handler(req) {
  const body = req || {};
  // پردازش و ذخیره ورودی وب‌هوک
  const rawPayload = JSON.stringify(body);
  
  return {
    success: true,
    message: "وب‌هوک با موفقیت پردازش شد",
    event_id: "evt_" + Math.random().toString(36).substring(2, 9),
    processed_at: new Date().toISOString()
  };
}
handler(context);`,

  validator: `// اعتبارسنجی ورودی داده‌های تراکنش و فیلتر کردن مقادیر
function handler(req) {
  const data = req || {};
  const errors = [];
  
  if (!data.phone || data.phone.length < 11) {
    errors.push("شماره همراه نامعتبر است");
  }
  if (!data.amount || Number(data.amount) <= 0) {
    errors.push("مبلغ تراکنش باید بیشتر از صفر باشد");
  }
  
  if (errors.length > 0) {
    return { valid: false, errors: errors, code: 400 };
  }
  
  return {
    valid: true,
    sanitized: {
      phone: data.phone.trim(),
      amount_irr: Number(data.amount),
      amount_toman: Math.floor(Number(data.amount) / 10)
    }
  };
}
handler(context);`,

  shaparak: `// پردازش کال‌بک درگاه پرداخت شاپرک
function handler(req) {
  const authority = req ? req.authority : "";
  const status = req ? req.status : "";
  
  if (status === "OK") {
    return {
      verified: true,
      reference_id: "REF_" + Math.floor(100000 + Math.random() * 900000),
      message: "تراکنش بانکی تایید شد"
    };
  }
  
  return {
    verified: false,
    message: "تراکنش توسط کاربر لغو شد یا خطای بانکی رخ داد"
  };
}
handler(context);`,

  sms: `// تریگر هوشمند ارسال پیامک کد تایید و پیام خوش‌آمد
function handler(req) {
  const phone = req ? req.phone : "09120000000";
  const code = Math.floor(100000 + Math.random() * 900000);
  
  // پیامک کد تایید ارسال گردید
  return {
    status: "dispatched",
    provider: "kavenegar",
    recipient: phone,
    otp_code: code,
    expires_in_seconds: 120
  };
}
handler(context);`,

  transform: `// تغییر و غنی‌سازی ساختار داده (Data Transformation)
function handler(req) {
  const items = (req && req.items) ? req.items : [
    { title: "لپ‌تاپ گیمینگ", price: 45000000 },
    { title: "ماوس بی‌سیم", price: 1200000 }
  ];
  
  const enriched = items.map(function(item) {
    return {
      title: item.title,
      price_irr: item.price,
      price_toman: Math.floor(item.price / 10),
      tax_irr: Math.floor(item.price * 0.1)
    };
  });
  
  const total = enriched.reduce(function(acc, i) { return acc + i.price_irr; }, 0);
  
  return {
    items_count: enriched.length,
    total_irr: total,
    total_toman: Math.floor(total / 10),
    data: enriched
  };
}
handler(context);`
};

function highlightJavaScript(code) {
  if (!code) return '';
  let text = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return text
    .replace(/(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g, '<span class="hl-comment">$1</span>')
    .replace(/('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)/g, '<span class="hl-str">$1</span>')
    .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="hl-num">$1</span>')
    .replace(/\b(async|await|break|case|catch|class|const|continue|default|delete|do|else|finally|for|function|if|let|new|return|switch|this|throw|try|typeof|var|while)\b/g, '<span class="hl-kw">$1</span>')
    .replace(/\b(context|req|JSON|console|Math|Date|Promise|Array|Object|String|Number|Boolean)\b/g, '<span class="hl-builtin">$1</span>');
}

function handleEditorInput() {
  const textarea = document.getElementById('func-editor-code');
  const highlightCode = document.getElementById('func-editor-highlight-code');
  const gutter = document.getElementById('editor-gutter');
  const infoEl = document.getElementById('editor-line-col-info');
  if (!textarea) return;

  const val = textarea.value;
  if (highlightCode) {
    highlightCode.innerHTML = highlightJavaScript(val) + '\n';
  }

  const lines = val.split('\n');
  const lineCount = lines.length;
  if (gutter) {
    gutter.innerHTML = Array.from({ length: lineCount }, (_, i) => i + 1).join('<br>');
  }
  if (infoEl) {
    infoEl.textContent = `سطرها: ${Shamsi.toPersianDigits(lineCount)} | کاراکترها: ${Shamsi.toPersianDigits(val.length)}`;
  }
}

function handleEditorScroll() {
  const textarea = document.getElementById('func-editor-code');
  const highlight = document.getElementById('func-editor-highlight');
  const gutter = document.getElementById('editor-gutter');
  if (!textarea) return;
  if (highlight) {
    highlight.scrollTop = textarea.scrollTop;
    highlight.scrollLeft = textarea.scrollLeft;
  }
  if (gutter) {
    gutter.scrollTop = textarea.scrollTop;
  }
}

function handleEditorTab(e) {
  if (e.key === 'Tab') {
    e.preventDefault();
    const textarea = e.target;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + 2;
    handleEditorInput();
  }
}

function applyScriptTemplate(key) {
  if (!key || !SCRIPT_TEMPLATES[key]) return;
  const textarea = document.getElementById('func-editor-code');
  if (textarea) {
    textarea.value = SCRIPT_TEMPLATES[key];
    handleEditorInput();
  }
}

function openScriptEditor(slug) {
  currentFuncSlug = slug;
  const func = window.projectFunctionsMap?.[slug];
  if (!func) return;

  const card = document.getElementById('func-editor-card');
  if (card) card.scrollIntoView({ behavior: 'smooth' });

  setText('func-editor-status-badge', 'در حال ویرایش: ' + func.slug);
  setVal('func-editor-name', func.name);
  setVal('func-editor-slug', func.slug);
  setVal('func-editor-endpoint', `/_baas/v1/${activeProjectId}/functions/${func.slug}/invoke`);

  const textarea = document.getElementById('func-editor-code');
  if (textarea) {
    textarea.value = func.script || '// کد اسکریپت لبه';
    handleEditorInput();
  }

  const sel = document.getElementById('func-test-select');
  if (sel) sel.value = slug;
}

async function saveActiveFunctionScript() {
  if (!activeProjectId) return;
  const slug = getVal('func-editor-slug');
  const name = getVal('func-editor-name');
  const textarea = document.getElementById('func-editor-code');
  const script = textarea ? textarea.value : '';

  if (!slug) {
    showToast('لطفاً ابتدا یک تابع را از جدول انتخاب نمایید یا روی «ویرایش در استودیو» کلیک کنید.', 'warning');
    return;
  }

  const btn = document.getElementById('btn-save-func-script');
  if (btn) { btn.disabled = true; btn.textContent = 'در حال ذخیره و استقرار...'; }

  try {
    const res = await fetch(`/_baas/v1/${activeProjectId}/functions/${slug}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, script })
    });

    if (res.ok) {
      showToast(`اسکریپت "${slug}" با موفقیت به‌روزرسانی و در پروژه ذخیره گردید.`, 'success');
      await loadProjectFunctions();
      openScriptEditor(slug);
    } else {
      const errData = await res.json().catch(() => ({}));
      showToast('خطا در ذخیره اسکریپت: ' + (errData.error || res.statusText), 'error');
    }
  } catch (err) {
    showToast('خطای ارتباط شبکه در ذخیره اسکریپت: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'ذخیره تغییرات و استقرار'; }
  }
}

async function loadProjectFunctions() {
  const tbody = document.getElementById('functions-tbody');
  if (!tbody || !activeProjectId) return;

  try {
    const res = await fetch(`/_baas/v1/${activeProjectId}/functions`);
    if (res.ok) {
      const funcs = await res.json();
      window.projectFunctionsMap = {};

      const testSel = document.getElementById('func-test-select');
      if (testSel) {
        testSel.innerHTML = '<option value="">انتخاب تابع...</option>' +
          (funcs || []).map(f => `<option value="${escapeHtml(f.slug)}">${escapeHtml(f.name)} (${escapeHtml(f.slug)})</option>`).join('');
      }

      if (!funcs || funcs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 18px;">تابعی برای این پروژه مستقر نشده است. برای شروع «+ استقرار تابع جدید» را کلیک کنید.</td></tr>';
        currentFuncSlug = null;
        setText('func-editor-status-badge', 'تابعی وجود ندارد');
        setVal('func-editor-name', '');
        setVal('func-editor-slug', '');
        setVal('func-editor-endpoint', '');
        const textarea = document.getElementById('func-editor-code');
        if (textarea) {
          textarea.value = '// تابعی ایجاد نشده است. روی + استقرار تابع جدید کلیک کنید.';
          handleEditorInput();
        }
        return;
      }

      funcs.forEach(f => {
        window.projectFunctionsMap[f.slug] = f;
      });

      tbody.innerHTML = funcs.map(f => `
        <tr>
          <td style="font-weight: 700;">${escapeHtml(f.name)}</td>
          <td style="font-size: 13px;">${escapeHtml(f.slug)}</td>
          <td style="font-size: 13px; color: var(--color-info);">/_baas/v1/${escapeHtml(activeProjectId)}/functions/${escapeHtml(f.slug)}</td>
          <td style="font-size: 13px;">${escapeHtml(Shamsi.formatDate(f.createdAtUtc))}</td>
          <td>
            <div style="display: flex; gap: 4px;">
              <button type="button" class="btn-primary" style="font-size: 12.5px; padding: 2px 8px;" onclick="openScriptEditor('${escapeHtml(f.slug)}')">ویرایش در استودیو</button>
              <button type="button" class="btn-secondary" style="font-size: 12.5px; padding: 2px 8px;" onclick="selectTestFunc('${escapeHtml(f.slug)}')">تست</button>
              <button type="button" class="btn-danger" style="font-size: 12.5px; padding: 2px 8px;" onclick="deleteProjectFunction('${escapeHtml(f.slug)}')">حذف</button>
            </div>
          </td>
        </tr>
      `).join('');

      if (currentFuncSlug && window.projectFunctionsMap[currentFuncSlug]) {
        openScriptEditor(currentFuncSlug);
      } else if (funcs.length > 0) {
        openScriptEditor(funcs[0].slug);
      }
    }
  } catch (err) {
    console.warn('Functions load error:', err);
  }
}

function selectTestFunc(slug) {
  openScriptEditor(slug);
  const testSection = document.getElementById('btn-exec-func-test');
  if (testSection) testSection.scrollIntoView({ behavior: 'smooth' });
}

async function deleteProjectFunction(slug) {
  if (!confirm(`آیا از حذف تابع "${slug}" اطمینان دارید؟`)) return;

  try {
    const res = await fetch(`/_baas/v1/${activeProjectId}/functions/${slug}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      if (currentFuncSlug === slug) currentFuncSlug = null;
      showToast('تابع با موفقیت حذف گردید.', 'success');
      await loadProjectFunctions();
    } else {
      showToast('خطا در حذف تابع.', 'error');
    }
  } catch (err) {
    console.warn('Delete function error:', err);
  }
}

function loadFunctionsEnv() {
  const tbody = document.getElementById('functions-env-tbody');
  if (!tbody) return;
  if (funcEnvVars.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 16px;">متغیر محیطی تعریف نشده است.</td></tr>';
  } else {
    tbody.innerHTML = funcEnvVars.map(ev => `
      <tr>
        <td style="font-family: var(--font-persian); font-weight: 700;">${escapeHtml(ev.key)}</td>
        <td style="font-family: var(--font-persian); font-size: 13px;">${ev.isSecret ? '••••••••••••••••' : escapeHtml(ev.val)}</td>
        <td><span class="badge ${ev.isSecret ? 'badge-paused' : 'badge-active'}">${ev.isSecret ? 'کلید محرمانه (Secret)' : 'متغیر عمومی'}</span></td>
        <td>
          <button type="button" class="btn-danger" style="font-size: 13px; padding: 2px 8px;" onclick="removeFuncEnv('${escapeHtml(ev.key)}')">حذف</button>
        </td>
      </tr>
    `).join('');
  }
}

function handleAddFuncEnv(e) {
  if (e) e.preventDefault();
  const keyInput = document.getElementById('func-env-key');
  const valInput = document.getElementById('func-env-val');
  const isSecretInput = document.getElementById('func-env-is-secret');
  if (!keyInput || !valInput) return;

  const key = keyInput.value.trim().toUpperCase();
  const val = valInput.value.trim();
  const isSecret = isSecretInput ? isSecretInput.checked : false;

  if (!key || !val) {
    showToast('لطفاً نام کلید و مقدار متغیر را وارد کنید.', 'warning');
    return;
  }

  funcEnvVars = funcEnvVars.filter(item => item.key !== key);
  funcEnvVars.push({ key, val, isSecret });
  loadFunctionsEnv();

  keyInput.value = '';
  valInput.value = '';
  if (isSecretInput) isSecretInput.checked = false;
  showToast('متغیر محیطی با موفقیت اضافه گردید.', 'success');
}

function removeFuncEnv(key) {
  if (!confirm(`آیا از حذف متغیر "${key}" اطمینان دارید؟`)) return;
  funcEnvVars = funcEnvVars.filter(item => item.key !== key);
  loadFunctionsEnv();
}

async function loadFunctionsTraces() {
  if (!activeProjectId) return;
  const tbody = document.getElementById('functions-traces-tbody');
  if (!tbody) return;

  try {
    const res = await fetch(`/_baas/v1/${activeProjectId}/logs?service=functions`);
    if (res.ok) {
      const logs = await res.json();
      if (!logs || logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 16px;">داده تله‌متری جدیدی ثبت نشده است.</td></tr>';
      } else {
        const metricTotal = document.getElementById('fn-metric-total');
        if (metricTotal) metricTotal.textContent = Shamsi.toPersianDigits(logs.length);

        tbody.innerHTML = logs.map(l => `
          <tr>
            <td style="font-family: var(--font-persian); font-weight: 700;">${escapeHtml(l.message.split(' ')[0] || 'default-fn')}</td>
            <td><span class="badge badge-active">${escapeHtml(l.statusCode || 200)} OK</span></td>
            <td style="font-size: 13.5px;">${Shamsi.toPersianDigits(l.latencyMs || 4)} ms</td>
            <td style="font-size: 13.5px;">6.4 MB</td>
            <td style="font-size: 13.5px;">${escapeHtml(Shamsi.formatDate(l.timestampUtc))}</td>
          </tr>
        `).join('');
      }
    }
  } catch (err) {
    console.warn('Functions traces load error:', err);
  }
}

async function executeFunctionTest() {
  if (!activeProjectId) return;
  const sel = document.getElementById('func-test-select');
  const slug = sel ? sel.value : currentFuncSlug;
  if (!slug) {
    showToast('لطفاً ابتدا یک تابع را برای تست انتخاب کنید.', 'warning');
    return;
  }
  const payloadEl = document.getElementById('func-test-payload') || document.getElementById('func-test-payload-input');
  const resultBox = document.getElementById('func-test-result') || document.getElementById('func-test-output-block');
  let payload = {};
  if (payloadEl && payloadEl.value.trim()) {
    try {
      payload = JSON.parse(payloadEl.value.trim());
    } catch (e) {
      showToast('فرمت بدنه ورودی باید JSON معتبر باشد.', 'error');
      return;
    }
  }

  const startTime = performance.now();
  try {
    const res = await fetch(`/_baas/v1/${activeProjectId}/functions/${slug}/invoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const latency = Math.round(performance.now() - startTime);
    const text = await res.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = text; }
    if (resultBox) {
      resultBox.textContent = typeof parsed === 'object' ? JSON.stringify(parsed, null, 2) : parsed;
    }
    const latencyVal = document.getElementById('func-test-latency-badge') || document.getElementById('func-test-latency-val') || document.getElementById('func-test-latency');
    if (latencyVal) {
      latencyVal.textContent = `${latency} ms`;
      latencyVal.style.display = 'inline-block';
      latencyVal.className = 'badge badge-active';
    }
    if (typeof loadUsageData === 'function') loadUsageData();
  } catch (err) {
    if (resultBox) resultBox.textContent = 'خطای اجرا: ' + err.message;
  }
}

// 11.6 Shetab IPG Simulator, Ledger & Reports

// Compute Window Attachments
window.loadProjectFunctions = loadProjectFunctions;
window.highlightJavaScript = highlightJavaScript;
window.handleEditorInput = handleEditorInput;
window.handleEditorScroll = handleEditorScroll;
window.handleEditorTab = handleEditorTab;
window.applyScriptTemplate = applyScriptTemplate;
window.openScriptEditor = openScriptEditor;
window.saveActiveFunctionScript = saveActiveFunctionScript;
window.deleteProjectFunction = deleteProjectFunction;
window.selectTestFunc = selectTestFunc;
window.loadFunctionsEnv = loadFunctionsEnv;
window.handleAddFuncEnv = handleAddFuncEnv;
window.removeFuncEnv = removeFuncEnv;
window.loadFunctionsTraces = loadFunctionsTraces;
window.executeFunctionTest = executeFunctionTest;
