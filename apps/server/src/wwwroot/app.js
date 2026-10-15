// LocalMe Apple-Design Client Controller & BaaS Integration Engine
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initOverview();
  initDagStudio();
  initDatabaseStudio();
  initAuthStudio();
  initIpgStudio();
  initStorageStudio();
  initComputeLab();
  initComplianceStudio();
});

// 1. Tab Navigation System
function initTabs() {
  const tabs = document.querySelectorAll('.nav-tab');
  const contents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.dataset.tab;
      
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      const targetContent = document.getElementById(targetId);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });
}

// 2. Toast Notifications
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  
  let icon = 'ℹ️';
  let borderColor = 'rgba(255, 255, 255, 0.16)';
  if (type === 'success') {
    icon = '✅';
    borderColor = 'rgba(48, 209, 88, 0.4)';
  } else if (type === 'error') {
    icon = '⚠️';
    borderColor = 'rgba(255, 69, 58, 0.4)';
  } else if (type === 'gold') {
    icon = '🪙';
    borderColor = 'rgba(245, 158, 11, 0.4)';
  }

  toast.style.borderColor = borderColor;
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 200ms ease';
    setTimeout(() => toast.remove(), 200);
  }, 4000);
}

// Utility: Format IRR to Persian Toman
function formatToman(amountIrr) {
  const toman = Math.floor(amountIrr / 10);
  return `${toman.toLocaleString('fa-IR')} تومان`;
}

function formatIrr(amountIrr) {
  return `${amountIrr.toLocaleString('en-US')} IRR`;
}

// 3. System Overview
async function initOverview() {
  try {
    const res = await fetch('/_baas/v1/config');
    if (res.ok) {
      const data = await res.json();
      const regionEl = document.getElementById('ov-region');
      if (regionEl) regionEl.textContent = data.region || 'ir-central-tehran';
      const stackEl = document.getElementById('ov-stack');
      if (stackEl) stackEl.textContent = data.stack || '.NET 10 + PostgreSQL 18.1';
    }
  } catch (err) {
    console.warn('Overview fetch error:', err);
  }

  // Ping health check periodically
  const pingEl = document.getElementById('header-ping-time');
  if (pingEl) {
    const start = performance.now();
    fetch('/healthz')
      .then(r => r.json())
      .then(() => {
        const ms = Math.round(performance.now() - start);
        pingEl.textContent = `${ms} ms`;
      })
      .catch(() => {
        pingEl.textContent = 'Active';
      });
  }
}

// 4. DAG Matrix Studio
function initDagStudio() {
  const primitives = [
    { code: 'AUTH_01', name: 'Domestic Mobile OTP', state: 'Active', tier: 'P0' },
    { code: 'REST_02', name: 'Dynamic PostgREST SQL', state: 'Active', tier: 'P0' },
    { code: 'PAY_03', name: 'Shaparak/Zarinpal IPG', state: 'Active', tier: 'P0' },
    { code: 'STOR_04', name: 'Universal Blob Storage', state: 'Active', tier: 'P1' },
    { code: 'EDGE_05', name: 'Jint Edge JavaScript Host', state: 'Active', tier: 'P1' },
    { code: 'SMS_06', name: 'Domestic SMS Aggregator', state: 'Active', tier: 'P2' },
    { code: 'PUSH_07', name: 'Direct Socket Fallback Push', state: 'Active', tier: 'P2' }
  ];

  const grid = document.getElementById('dag-primitives-grid');
  if (grid) {
    grid.innerHTML = primitives.map(p => `
      <div class="glass-panel" style="padding: 16px; border-radius: 12px; display: flex; align-items: center; justify-content: space-between;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-family: var(--font-mono); font-size: 11px; font-weight: 700; color: var(--apple-blue);">${p.code}</span>
            <span class="badge badge-green">${p.tier}</span>
          </div>
          <div style="font-size: 14px; font-weight: 600; margin-top: 4px;">${p.name}</div>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <span class="pulse-indicator"></span>
          <span style="font-size: 12px; color: var(--apple-green); font-weight: 600;">${p.state}</span>
        </div>
      </div>
    `).join('');
  }
}

// 5. PostgREST Database Studio
async function initDatabaseStudio() {
  const tableSelect = document.getElementById('db-table-select');
  const refreshBtn = document.getElementById('db-refresh-btn');
  const insertForm = document.getElementById('db-insert-form');

  async function loadTableData() {
    const table = tableSelect ? tableSelect.value : 'products';
    const tbody = document.getElementById('db-table-body');
    const thead = document.getElementById('db-table-head');
    if (!tbody || !thead) return;

    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 24px;">بارگذاری داده‌ها...</td></tr>`;

    try {
      const res = await fetch(`/_baas/v1/rest/${table}`);
      if (!res.ok) throw new Error('Fetch failed');
      const rows = await res.json();

      if (!rows || rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 24px;">جدول خالی است.</td></tr>`;
        return;
      }

      // Build headers
      const keys = Object.keys(rows[0]);
      thead.innerHTML = `<tr>${keys.map(k => `<th>${k}</th>`).join('')}</tr>`;

      // Build rows
      tbody.innerHTML = rows.map(r => `
        <tr>
          ${keys.map(k => {
            let val = r[k];
            if (k.includes('price') || k.includes('total')) {
              return `<td class="num-tabular" style="font-weight: 600; color: var(--sovereign-gold);">${formatToman(val)} <span style="font-size: 10px; color: var(--text-tertiary);">(${val} IRR)</span></td>`;
            }
            if (typeof val === 'object' && val !== null) val = JSON.stringify(val);
            return `<td>${val ?? ''}</td>`;
          }).join('')}
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--apple-red); padding: 24px;">خطا در دریافت اطلاعات جدول.</td></tr>`;
      showToast('خطا در برقراری ارتباط با دیتابیس', 'error');
    }
  }

  if (tableSelect) tableSelect.addEventListener('change', loadTableData);
  if (refreshBtn) refreshBtn.addEventListener('click', loadTableData);

  if (insertForm) {
    insertForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const table = tableSelect ? tableSelect.value : 'products';
      const title = document.getElementById('db-in-title')?.value;
      const priceToman = parseInt(document.getElementById('db-in-price')?.value || '0', 10);
      const stock = parseInt(document.getElementById('db-in-stock')?.value || '1', 10);
      const category = document.getElementById('db-in-category')?.value || 'General';

      if (!title) {
        showToast('لطفا عنوان کالا را وارد کنید', 'error');
        return;
      }

      const payload = {
        title,
        price_irr: priceToman * 10,
        stock,
        category
      };

      try {
        const res = await fetch(`/_baas/v1/rest/${table}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          showToast('رکورد جدید با موفقیت درج شد', 'success');
          document.getElementById('db-in-title').value = '';
          document.getElementById('db-in-price').value = '';
          loadTableData();
        } else {
          showToast('خطا در درج رکورد', 'error');
        }
      } catch (err) {
        showToast('خطای شبکه', 'error');
      }
    });
  }

  loadTableData();
}

// 6. Domestic OTP & Auth Studio
function initAuthStudio() {
  const requestBtn = document.getElementById('otp-request-btn');
  const verifyBtn = document.getElementById('otp-verify-btn');
  const phoneInput = document.getElementById('otp-phone-input');
  const codeInput = document.getElementById('otp-code-input');
  const statusBox = document.getElementById('otp-status-box');
  const tokenBox = document.getElementById('otp-token-box');
  const simulatedSmsBox = document.getElementById('otp-simulated-sms');

  let countdownInterval = null;

  if (requestBtn) {
    requestBtn.addEventListener('click', async () => {
      const phone = phoneInput ? phoneInput.value.trim() : '';
      if (!phone || phone.length < 10) {
        showToast('شماره موبایل نامعتبر است', 'error');
        return;
      }

      requestBtn.disabled = true;
      requestBtn.textContent = 'در حال ارسال...';

      try {
        const res = await fetch('/_baas/v1/auth/otp/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ Phone: phone, Channel: 'sms' })
        });
        const data = await res.json();

        if (data.success) {
          showToast('کد تایید پیامک شد', 'success');
          if (simulatedSmsBox && data.codeForTesting) {
            simulatedSmsBox.style.display = 'block';
            simulatedSmsBox.innerHTML = `
              <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 4px;">پیامک شبیه‌سازی‌شده (Local Dev Direct Dispatch):</div>
              <div style="font-weight: 700; color: #fff;">کد تایید ورود شما به سامانه LocalMe: <span style="font-family: var(--font-mono); color: var(--sovereign-gold); font-size: 18px;">${data.codeForTesting}</span></div>
            `;
            if (codeInput) codeInput.value = data.codeForTesting;
          }

          // 120s timer
          let remaining = 120;
          if (countdownInterval) clearInterval(countdownInterval);
          countdownInterval = setInterval(() => {
            remaining--;
            if (statusBox) statusBox.textContent = `مهلت اعتبار کد: ${remaining} ثانیه`;
            if (remaining <= 0) {
              clearInterval(countdownInterval);
              requestBtn.disabled = false;
              requestBtn.textContent = 'ارسال مجدد کد تایید';
              if (statusBox) statusBox.textContent = 'کد منقضی شده است.';
            }
          }, 1000);
        } else {
          showToast(data.message || 'خطا در درخواست کد', 'error');
          requestBtn.disabled = false;
          requestBtn.textContent = 'دریافت کد تایید';
        }
      } catch (err) {
        showToast('خطای شبکه در ارسال پیامک', 'error');
        requestBtn.disabled = false;
        requestBtn.textContent = 'دریافت کد تایید';
      }
    });
  }

  if (verifyBtn) {
    verifyBtn.addEventListener('click', async () => {
      const phone = phoneInput ? phoneInput.value.trim() : '';
      const code = codeInput ? codeInput.value.trim() : '';

      if (!phone || !code) {
        showToast('شماره و کد تایید الزامی است', 'error');
        return;
      }

      verifyBtn.disabled = true;
      try {
        const res = await fetch('/_baas/v1/auth/otp/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ Phone: phone, Code: code })
        });
        const data = await res.json();

        if (data.success) {
          showToast('احراز هویت با موفقیت انجام شد', 'success');
          if (tokenBox) {
            tokenBox.style.display = 'block';
            tokenBox.innerHTML = `
              <div style="font-size: 12px; font-weight: 700; color: var(--apple-green); margin-bottom: 6px;">نشست کاربر احراز شده (Ed25519 Token):</div>
              <pre style="font-family: var(--font-mono); font-size: 11px; background: rgba(0,0,0,0.5); padding: 12px; border-radius: 8px; overflow-x: auto; color: var(--apple-teal);">${JSON.stringify(data.tokens, null, 2)}</pre>
            `;
          }
        } else {
          showToast(data.message || 'کد وارد شده نامعتبر است', 'error');
        }
      } catch (err) {
        showToast('خطای شبکه در تایید کد', 'error');
      } finally {
        verifyBtn.disabled = false;
      }
    });
  }
}

// 7. Shaparak IPG & Double-Entry Ledger Simulator
function initIpgStudio() {
  const payBtn = document.getElementById('ipg-pay-btn');
  const gatewaySelect = document.getElementById('ipg-gateway-select');
  const amountInput = document.getElementById('ipg-amount-toman');
  const phoneInput = document.getElementById('ipg-phone-input');
  const balanceEl = document.getElementById('wallet-current-balance');
  const ledgerTbody = document.getElementById('ipg-ledger-tbody');

  async function refreshWallet() {
    const phone = phoneInput ? phoneInput.value.trim() : '+989121112233';
    try {
      const res = await fetch(`/_baas/v1/pay/wallet/${encodeURIComponent(phone)}`);
      if (res.ok) {
        const wallet = await res.json();
        if (balanceEl) balanceEl.textContent = wallet.formattedToman;
        
        // Update header wallet too
        const headerWallet = document.getElementById('header-wallet-amount');
        if (headerWallet) headerWallet.textContent = wallet.formattedToman;

        if (ledgerTbody && wallet.recentTransactions) {
          ledgerTbody.innerHTML = wallet.recentTransactions.flatMap(tx => 
            tx.entries.map(e => `
              <tr>
                <td style="font-family: var(--font-mono); font-size: 11px;">${tx.transactionId.substring(0, 10)}...</td>
                <td><span class="badge ${e.accountType === 'Asset' ? 'badge-blue' : 'badge-gold'}">${e.accountNumber} - ${e.accountName}</span></td>
                <td class="num-tabular" style="color: var(--apple-green); font-weight: 600;">${e.debitIrr > 0 ? formatToman(e.debitIrr) : '-'}</td>
                <td class="num-tabular" style="color: var(--apple-orange); font-weight: 600;">${e.creditIrr > 0 ? formatToman(e.creditIrr) : '-'}</td>
                <td style="font-size: 12px; color: var(--text-secondary);">${e.description}</td>
              </tr>
            `)
          ).join('');
        }
      }
    } catch (err) {
      console.warn('Wallet refresh failed:', err);
    }
  }

  if (payBtn) {
    payBtn.addEventListener('click', async () => {
      const gateway = gatewaySelect ? gatewaySelect.value : 'SEP';
      const amountToman = parseInt(amountInput?.value || '1000000', 10);
      const phone = phoneInput ? phoneInput.value.trim() : '+989121112233';
      const idempotencyKey = `pay_req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      payBtn.disabled = true;
      payBtn.textContent = 'در حال اتصال به شاپرک...';

      try {
        // Step 1: Initiate Payment
        const initRes = await fetch('/_baas/v1/pay/initiate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            Gateway: gateway,
            AmountIrr: amountToman * 10,
            CallbackUrl: '/dashboard',
            Description: 'شارژ آنلاین حساب از طریق درگاه امن شاپرک',
            CustomerPhone: phone,
            IdempotencyKey: idempotencyKey
          })
        });
        const initData = await initRes.json();

        if (!initData.success) {
          showToast(initData.message || 'خطا در دریافت توکن شاپرک', 'error');
          payBtn.disabled = false;
          payBtn.textContent = 'پرداخت امن با شاپرک';
          return;
        }

        showToast(`توکن شاپرک دریافت شد (${initData.authorityToken.substring(0, 14)}...)`, 'gold');

        // Step 2: Simulate Instant Successful Bank Verification
        setTimeout(async () => {
          try {
            const verifyRes = await fetch('/_baas/v1/pay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                Gateway: gateway,
                AuthorityToken: initData.authorityToken,
                Status: 'OK'
              })
            });
            const verifyData = await verifyRes.json();

            if (verifyData.success) {
              showToast(`تراکنش تایید شد! کد پیگیری: ${verifyData.referenceId}`, 'success');
              refreshWallet();
            } else {
              showToast(verifyData.message || 'خطا در تایید تراکنش بانکی', 'error');
            }
          } catch {
            showToast('خطا در تایید بانکی', 'error');
          } finally {
            payBtn.disabled = false;
            payBtn.textContent = 'پرداخت امن با شاپرک';
          }
        }, 800);

      } catch (err) {
        showToast('خطای شبکه در تراکنش بانکی', 'error');
        payBtn.disabled = false;
        payBtn.textContent = 'پرداخت امن با شاپرک';
      }
    });
  }

  refreshWallet();
}

// 8. Universal Storage Explorer
function initStorageStudio() {
  const uploadBtn = document.getElementById('storage-upload-btn');
  const fileInput = document.getElementById('storage-file-input');
  const tbody = document.getElementById('storage-table-body');

  async function loadObjects() {
    if (!tbody) return;
    try {
      const res = await fetch('/_baas/v1/storage/list');
      if (res.ok) {
        const items = await res.json();
        if (items.length === 0) {
          tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 24px;">باکت خالی است.</td></tr>`;
          return;
        }
        tbody.innerHTML = items.map(item => `
          <tr>
            <td style="font-weight: 600; color: #fff;">${item.name}</td>
            <td style="font-family: var(--font-mono); font-size: 11px;">${(item.size / 1024).toFixed(1)} KB</td>
            <td style="font-size: 12px; color: var(--text-secondary);">${item.contentType}</td>
            <td style="font-size: 11px; color: var(--text-tertiary);">${new Date(item.lastModified).toLocaleDateString('fa-IR')}</td>
            <td>
              <a href="/_baas/v1/storage/download/${encodeURIComponent(item.name)}" target="_blank" class="btn-apple btn-apple-secondary" style="padding: 4px 10px; font-size: 11px;">دانلود</a>
            </td>
          </tr>
        `).join('');
      }
    } catch {
      if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 24px;">فایلی یافت نشد.</td></tr>`;
    }
  }

  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('file', file);

      showToast(`در حال آپلود ${file.name}...`, 'info');
      try {
        const res = await fetch('/_baas/v1/storage/upload', {
          method: 'POST',
          body: formData
        });
        if (res.ok) {
          showToast('فایل با موفقیت در باکت ذخیره شد', 'success');
          loadObjects();
        } else {
          showToast('خطا در ذخیره‌سازی فایل', 'error');
        }
      } catch {
        showToast('خطای شبکه هنگام آپلود فایل', 'error');
      }
    });
  }

  loadObjects();
}

// 9. Edge Compute Lab (Jint 4.x Sandboxed Execution)
function initComputeLab() {
  const runBtn = document.getElementById('compute-run-btn');
  const codeEditor = document.getElementById('compute-code-editor');
  const inputEditor = document.getElementById('compute-input-editor');
  const outputViewer = document.getElementById('compute-output-viewer');
  const logViewer = document.getElementById('compute-log-viewer');
  const metricsViewer = document.getElementById('compute-metrics-viewer');

  if (runBtn) {
    runBtn.addEventListener('click', async () => {
      const script = codeEditor?.value || '';
      const inputJson = inputEditor?.value || '{}';

      runBtn.disabled = true;
      runBtn.textContent = 'در حال اجرای تابع...';

      try {
        const res = await fetch('/_baas/v1/functions/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            Script: script,
            InputJson: inputJson,
            TimeoutSeconds: 5
          })
        });

        const data = await res.json();
        if (data.success) {
          showToast(`تابع در ${data.executionTimeMs} میلی‌ثانیه با موفقیت اجرا شد`, 'success');
          if (outputViewer) {
            outputViewer.textContent = typeof data.output === 'object'
              ? JSON.stringify(data.output, null, 2)
              : String(data.output);
          }
        } else {
          showToast('خطا در اجرای تابع', 'error');
          if (outputViewer) {
            outputViewer.textContent = `خطا: ${data.error}`;
          }
        }

        if (logViewer) {
          logViewer.textContent = data.logs && data.logs.length > 0
            ? data.logs.join('\n')
            : '// هیچ لاگی از console ثبت نشد.';
        }

        if (metricsViewer) {
          metricsViewer.innerHTML = `
            <div style="display: flex; gap: 16px; font-size: 11px; font-family: var(--font-mono); color: var(--text-secondary);">
              <div>زمان اجرا: <span style="color: var(--apple-green); font-weight: 700;">${data.executionTimeMs} ms</span></div>
              <div>سقف حافظه: <span style="color: var(--apple-blue); font-weight: 700;">16 MB Hard Governor</span></div>
              <div>موتور: <span style="color: var(--sovereign-gold); font-weight: 700;">Jint 4.x Isolated</span></div>
            </div>
          `;
        }
      } catch (err) {
        showToast('خطای شبکه در فراخوانی تابع', 'error');
      } finally {
        runBtn.disabled = false;
        runBtn.textContent = 'اجرای تابع (Run Edge Function)';
      }
    });
  }
}

// 10. Regulatory & Compliance Studio
function initComplianceStudio() {
  const enamadBtn = document.getElementById('comp-enamad-btn');
  const samandehiBtn = document.getElementById('comp-samandehi-btn');
  const assetLinksBtn = document.getElementById('comp-assetlinks-btn');
  const appleAssocBtn = document.getElementById('comp-appleassoc-btn');
  const previewViewer = document.getElementById('comp-preview-viewer');

  async function showComplianceContent(url, mimeType) {
    if (!previewViewer) return;
    previewViewer.textContent = 'در حال دریافت فایل نظارتی...';
    try {
      const res = await fetch(url);
      const text = await res.text();
      previewViewer.textContent = text;
      showToast(`فایل ${url} با موفقیت دریافت شد`, 'info');
    } catch {
      previewViewer.textContent = 'خطا در دریافت سند.';
    }
  }

  if (enamadBtn) enamadBtn.addEventListener('click', () => showComplianceContent('/enamad.txt', 'text/plain'));
  if (samandehiBtn) samandehiBtn.addEventListener('click', () => showComplianceContent('/samandehi.txt', 'text/plain'));
  if (assetLinksBtn) assetLinksBtn.addEventListener('click', () => showComplianceContent('/.well-known/assetlinks.json', 'application/json'));
  if (appleAssocBtn) appleAssocBtn.addEventListener('click', () => showComplianceContent('/.well-known/apple-app-site-association', 'application/json'));
}
