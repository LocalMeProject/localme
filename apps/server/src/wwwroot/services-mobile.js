// LocalMe BaaS - Mobile Platform Services (Push Notifications, Cafe Bazaar & Myket IAP, Realtime WebSockets)

// 1. Push Notifications
async function loadPushDevices() {
  if (!activeProjectId) return;
  try {
    const res = await apiFetch(`/_baas/v1/${activeProjectId}/push/devices`);
    if (res.ok) {
      const data = await res.json();
      const tbody = document.getElementById('mobile-push-devices-tbody');
      if (tbody) {
        if (!data.devices || data.devices.length === 0) {
          tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">هیچ دستگاه موبایلی تاکنون ثبت نشده است. با استفاده از SDK موبایل اقدام به ثبت توکن کنید.</td></tr>`;
        } else {
          tbody.innerHTML = data.devices.map(d => `
            <tr>
              <td><code>${escapeHtml(d.deviceId)}</code></td>
              <td><span class="badge ${d.platform === 'ios' ? 'badge-active' : 'badge-neutral'}">${escapeHtml(d.platform.toUpperCase())}</span></td>
              <td><code>${escapeHtml(d.provider.toUpperCase())}</code></td>
              <td>${escapeHtml(d.userId || 'مهمان')}</td>
              <td><span title="${escapeHtml(d.pushToken)}">${escapeHtml(d.pushToken.substring(0, 16))}...</span></td>
              <td>
                <button type="button" class="btn-danger" style="font-size: 11px; padding: 2px 8px;" onclick="unregisterPushDevice('${escapeHtml(d.deviceId)}')">حذف</button>
              </td>
            </tr>
          `).join('');
        }
      }
      const countEl = document.getElementById('mobile-push-total-count');
      if (countEl) countEl.textContent = Shamsi.toPersianDigits(data.total || 0);
    }
  } catch (err) {
    console.error('Failed to load push devices:', err);
  }
}

async function unregisterPushDevice(deviceId) {
  if (!confirm('آیا از حذف این دستگاه از سامانه پوش اطمینان دارید؟')) return;
  try {
    const res = await apiFetch(`/_baas/v1/${activeProjectId}/push/devices/${deviceId}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('دستگاه با موفقیت حذف شد', 'success');
      loadPushDevices();
    }
  } catch {
    showToast('خطا در حذف دستگاه', 'error');
  }
}

async function loadPushConfig() {
  if (!activeProjectId) return;
  try {
    const res = await apiFetch(`/_baas/v1/${activeProjectId}/push/config`);
    if (res.ok) {
      const data = await res.json();
      const cfg = data.config || {};
      setVal('push-cfg-fcm-key', cfg.fcmServerKey || '');
      setVal('push-cfg-najva-token', cfg.najvaApiToken || '');
      setVal('push-cfg-pushy-key', cfg.pushyApiKey || '');
      setVal('push-cfg-apns-key', cfg.apnsKeyId || '');
      setVal('push-cfg-apns-team', cfg.apnsTeamId || '');
      setVal('push-cfg-apns-bundle', cfg.apnsBundleId || '');
      const fallbackCheck = document.getElementById('push-cfg-domestic-fallback');
      if (fallbackCheck) fallbackCheck.checked = cfg.enableDomesticFallback !== false;
    }
  } catch (err) {
    console.error('Failed to load push config:', err);
  }
}

async function savePushConfig(e) {
  if (e) e.preventDefault();
  if (!activeProjectId) return;
  try {
    const body = {
      fcmServerKey: document.getElementById('push-cfg-fcm-key')?.value.trim() || null,
      najvaApiToken: document.getElementById('push-cfg-najva-token')?.value.trim() || null,
      pushyApiKey: document.getElementById('push-cfg-pushy-key')?.value.trim() || null,
      apnsKeyId: document.getElementById('push-cfg-apns-key')?.value.trim() || null,
      apnsTeamId: document.getElementById('push-cfg-apns-team')?.value.trim() || null,
      apnsBundleId: document.getElementById('push-cfg-apns-bundle')?.value.trim() || null,
      enableDomesticFallback: document.getElementById('push-cfg-domestic-fallback')?.checked ?? true
    };
    const res = await apiFetch(`/_baas/v1/${activeProjectId}/push/config`, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
    if (res.ok) {
      showToast('تنظیمات درگاه های پوش ذخیره شد', 'success');
    }
  } catch {
    showToast('خطا در ذخیره تنظیمات پوش', 'error');
  }
}

async function sendTestPush(e) {
  if (e) e.preventDefault();
  if (!activeProjectId) return;
  const title = document.getElementById('push-test-title')?.value.trim();
  const body = document.getElementById('push-test-body')?.value.trim();
  const platform = document.getElementById('push-test-platform')?.value;

  if (!title || !body) {
    showToast('عنوان و متن پیام الزامی است', 'warning');
    return;
  }

  try {
    const payload = {
      title,
      body,
      targetPlatforms: platform === 'all' ? null : [platform]
    };
    const res = await apiFetch(`/_baas/v1/${activeProjectId}/push/send`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const data = await res.json();
      showToast(`پیام به ${Shamsi.toPersianDigits(data.dispatchedCount)} دستگاه ارسال شد`, 'success');
    } else {
      showToast('ارسال اعلان با خطا مواجه شد', 'error');
    }
  } catch {
    showToast('خطا در ارسال تست پوش', 'error');
  }
}

// 2. Mobile In-App Purchases (Cafe Bazaar & Myket)
async function loadIapPurchases() {
  if (!activeProjectId) return;
  try {
    const res = await apiFetch(`/_baas/v1/${activeProjectId}/iap/purchases`);
    if (res.ok) {
      const data = await res.json();
      const tbody = document.getElementById('mobile-iap-purchases-tbody');
      if (tbody) {
        if (!data.purchases || data.purchases.length === 0) {
          tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 24px;">تراکنش خرید درون برنامه ای تاییدشده ای یافت نشد.</td></tr>`;
        } else {
          tbody.innerHTML = data.purchases.map(p => `
            <tr>
              <td><code>${escapeHtml(p.transactionId)}</code></td>
              <td><span class="badge ${p.store === 'cafebazaar' ? 'badge-active' : 'badge-neutral'}">${p.store === 'cafebazaar' ? 'کافه بازار' : 'مایکت'}</span></td>
              <td><code>${escapeHtml(p.productId)}</code></td>
              <td>${escapeHtml(p.userId || '-')}</td>
              <td>${Shamsi.toPersianDigits(Number(p.amountIrr / 10).toLocaleString('fa-IR'))} تومان</td>
              <td><span class="badge badge-active">${escapeHtml(p.consumptionState)}</span></td>
              <td>${Shamsi.formatDateTime(p.verifiedAtUtc)}</td>
            </tr>
          `).join('');
        }
      }
    }
  } catch (err) {
    console.error('Failed to load IAP purchases:', err);
  }
}

async function verifyTestIapPurchase(e) {
  if (e) e.preventDefault();
  if (!activeProjectId) return;

  const store = document.getElementById('iap-test-store')?.value || 'bazaar';
  const packageName = document.getElementById('iap-test-pkg')?.value.trim();
  const productId = document.getElementById('iap-test-product')?.value.trim();
  const purchaseToken = document.getElementById('iap-test-token')?.value.trim();
  const priceToman = Number(document.getElementById('iap-test-price')?.value || 50000);

  if (!packageName || !productId || !purchaseToken) {
    showToast('شناسه بسته، محصول و توکن خرید الزامی است', 'warning');
    return;
  }

  const endpoint = store === 'bazaar'
    ? `/_baas/v1/${activeProjectId}/iap/verify/bazaar`
    : `/_baas/v1/${activeProjectId}/iap/verify/myket`;

  try {
    const res = await apiFetch(endpoint, {
      method: 'POST',
      body: JSON.stringify({
        packageName,
        productId,
        purchaseToken,
        priceIrr: priceToman * 10
      })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(data.message || 'خرید درون برنامه ای تایید و ثبت شد', 'success');
      loadIapPurchases();
    } else {
      showToast(data.message || 'اعتبارسنجی خرید ناموفق بود', 'error');
    }
  } catch {
    showToast('خطا در اعتبارسنجی توکن خرید', 'error');
  }
}

// 3. Duplex Realtime WebSockets Interactive Console
let realtimeWs = null;
let realtimeWsPingTimer = null;

function getRealtimeWsUrl() {
  if (!activeProjectId) return '';
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/_baas/v1/${activeProjectId}/realtime`;
}

function updateRealtimeWsUrlDisplay() {
  const urlEl = document.getElementById('mobile-ws-url-display');
  if (urlEl) {
    urlEl.textContent = getRealtimeWsUrl() || 'ws://localhost:5000/_baas/v1/PROJECT_ID/realtime';
  }
}

function appendRealtimeLog(tag, message, payload = null) {
  const logBox = document.getElementById('ws-live-logs');
  if (!logBox) return;

  const row = document.createElement('div');
  row.style.cssText = 'padding: 6px 8px; border-bottom: 1px solid #334155; font-family: monospace; font-size: 12.5px; display: flex; flex-direction: column; gap: 4px;';

  const time = new Date().toLocaleTimeString('fa-IR');
  let tagColor = '#38bdf8';
  if (tag === 'CONNECTED') tagColor = '#10b981';
  if (tag === 'CLOSED') tagColor = '#f59e0b';
  if (tag === 'ERROR') tagColor = '#ef4444';
  if (tag === 'EVENT') tagColor = '#a855f7';
  if (tag === 'SUBSCRIBE') tagColor = '#06b6d4';

  let headerHtml = `<div style="display: flex; align-items: center; justify-content: space-between;">
    <span><strong style="color: ${tagColor}">[${tag}]</strong> ${escapeHtml(message)}</span>
    <span style="color: #64748b; font-size: 11px;">${time}</span>
  </div>`;

  let payloadHtml = '';
  if (payload) {
    payloadHtml = `<pre style="margin: 0; background: #0f172a; padding: 6px; border-radius: 4px; color: #cbd5e1; font-size: 11.5px; overflow-x: auto;">${escapeHtml(JSON.stringify(payload, null, 2))}</pre>`;
  }

  row.innerHTML = headerHtml + payloadHtml;
  logBox.appendChild(row);
  logBox.scrollTop = logBox.scrollHeight;
}

function toggleRealtimeWsConnect() {
  if (realtimeWs && (realtimeWs.readyState === WebSocket.OPEN || realtimeWs.readyState === WebSocket.CONNECTING)) {
    realtimeWs.close();
    return;
  }

  const url = getRealtimeWsUrl();
  if (!url) {
    showToast('لطفاً ابتدا یک پروژه فعال را انتخاب نمایید', 'warning');
    return;
  }

  const statusBadge = document.getElementById('ws-status-badge');
  const btnToggle = document.getElementById('btn-ws-toggle');

  if (statusBadge) {
    statusBadge.textContent = 'در حال اتصال...';
    statusBadge.className = 'badge badge-info';
  }
  if (btnToggle) btnToggle.textContent = 'قطع اتصال';

  appendRealtimeLog('CONNECTING', `در حال برقراری اتصال به ${url}...`);

  try {
    realtimeWs = new WebSocket(url);

    realtimeWs.onopen = () => {
      if (statusBadge) {
        statusBadge.textContent = 'متصل به جریان زنده';
        statusBadge.className = 'badge badge-active';
      }
      if (btnToggle) {
        btnToggle.textContent = 'قطع اتصال';
        btnToggle.className = 'btn-danger';
      }
      appendRealtimeLog('CONNECTED', 'اتصال وب سوکت با موفقیت برقرار شد.');

      if (realtimeWsPingTimer) clearInterval(realtimeWsPingTimer);
      realtimeWsPingTimer = setInterval(() => {
        if (realtimeWs && realtimeWs.readyState === WebSocket.OPEN) {
          realtimeWs.send(JSON.stringify({ action: 'ping', timestamp: Date.now() }));
        }
      }, 25000);
    };

    realtimeWs.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const action = data.action || 'EVENT';
        appendRealtimeLog(action, `رویداد دریافت شد [جدول: ${data.table || 'سیستم'}]`, data);
      } catch {
        appendRealtimeLog('RAW', event.data);
      }
    };

    realtimeWs.onerror = () => {
      appendRealtimeLog('ERROR', 'خطا در ارتباط سوکت.');
    };

    realtimeWs.onclose = () => {
      if (statusBadge) {
        statusBadge.textContent = 'ارتباط قطع شد';
        statusBadge.className = 'badge badge-paused';
      }
      if (btnToggle) {
        btnToggle.textContent = 'اتصال به وب سوکت';
        btnToggle.className = 'btn-primary';
      }
      if (realtimeWsPingTimer) {
        clearInterval(realtimeWsPingTimer);
        realtimeWsPingTimer = null;
      }
      appendRealtimeLog('CLOSED', 'ارتباط با سرور سوکت پایان یافت.');
    };
  } catch (err) {
    appendRealtimeLog('ERROR', `خطای اتصال: ${err.message}`);
  }
}

function subscribeRealtimeWs() {
  const channelInput = document.getElementById('ws-channel-input');
  const channel = channelInput ? channelInput.value.trim() : 'orders';
  if (!channel) {
    showToast('نام جدول یا کانال الزامی است', 'warning');
    return;
  }
  if (!realtimeWs || realtimeWs.readyState !== WebSocket.OPEN) {
    showToast('ابتدا اتصال وب سوکت را برقرار کنید', 'warning');
    return;
  }

  realtimeWs.send(JSON.stringify({ action: 'subscribe', table: channel }));
  appendRealtimeLog('SUBSCRIBE', `درخواست عضویت در جدول/کانال '${channel}' ارسال شد.`);
  showToast(`در جدول ${channel} عضو شدید`, 'success');
}

async function sendRealtimeWsBroadcast() {
  const channelInput = document.getElementById('ws-channel-input');
  const payloadInput = document.getElementById('ws-payload-input');
  const channel = channelInput ? channelInput.value.trim() : 'orders';
  let payloadStr = payloadInput ? payloadInput.value.trim() : '{"status":"UPDATED"}';

  let parsed = {};
  try {
    parsed = JSON.parse(payloadStr);
  } catch {
    showToast('ساختار داده باید JSON معتبر باشد', 'warning');
    return;
  }

  if (!activeProjectId) return;

  try {
    const res = await apiFetch(`/_baas/v1/${activeProjectId}/realtime/broadcast`, {
      method: 'POST',
      body: JSON.stringify({
        table: channel,
        action: 'BROADCAST',
        data: parsed
      })
    });
    if (res.ok) {
      showToast('رویداد برودکست شد', 'success');
      appendRealtimeLog('BROADCAST', `رویداد به جدول '${channel}' برودکست شد.`, parsed);
    } else {
      showToast('خطا در برودکست رویداد', 'error');
    }
  } catch {
    showToast('خطای شبکه در ارسال برودکست', 'error');
  }
}

function clearRealtimeWsLogs() {
  const logBox = document.getElementById('ws-live-logs');
  if (logBox) logBox.innerHTML = '';
}

window.loadPushDevices = loadPushDevices;
window.loadPushConfig = loadPushConfig;
window.savePushConfig = savePushConfig;
window.sendTestPush = sendTestPush;
window.unregisterPushDevice = unregisterPushDevice;
window.loadIapPurchases = loadIapPurchases;
window.verifyTestIapPurchase = verifyTestIapPurchase;
window.updateRealtimeWsUrlDisplay = updateRealtimeWsUrlDisplay;
window.toggleRealtimeWsConnect = toggleRealtimeWsConnect;
window.subscribeRealtimeWs = subscribeRealtimeWs;
window.sendRealtimeWsBroadcast = sendRealtimeWsBroadcast;
window.clearRealtimeWsLogs = clearRealtimeWsLogs;

