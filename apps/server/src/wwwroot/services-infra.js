// LocalMe BaaS - Storage, Hosting & Iranian Compliance Infrastructure

async function loadProjectBuckets() {
  const tbody = document.getElementById('storage-buckets-tbody');
  if (!tbody || !activeProjectId) return;

  try {
    const res = await fetch(`/_baas/v1/${activeProjectId}/storage/buckets`);
    if (res.ok) {
      const buckets = await res.json();
      if (!buckets || buckets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 18px;">باکتی برای ذخیره سازی فایل ها ایجاد نشده است.</td></tr>';
        return;
      }

      tbody.innerHTML = buckets.map(b => {
        const count = b.objectCount ?? b.fileCount ?? 0;
        const bytes = b.totalSizeBytes ?? b.totalBytes ?? 0;
        return `
          <tr>
            <td style="font-family: var(--font-persian); font-weight: 700;">${escapeHtml(b.name)}</td>
            <td><span class="badge ${b.isPublic ? 'badge-info' : 'badge-paused'}">${b.isPublic ? 'عمومی' : 'محرمانه'}</span></td>
            <td>${Shamsi.toPersianDigits(count)}</td>
            <td style="font-size: 13.5px;">${(bytes / (1024*1024)).toFixed(2)} MB</td>
            <td style="font-size: 13.5px;">${escapeHtml(Shamsi.formatDate(b.createdAtUtc))}</td>
            <td>
              <div style="display: flex; gap: 4px;">
                <button type="button" class="btn-secondary" style="font-size: 12.5px; padding: 2px 8px;" onclick="switchStorageBucket('${escapeHtml(b.name)}')">فایل ها</button>
                <button type="button" class="btn-danger" style="font-size: 12.5px; padding: 2px 8px;" onclick="deleteStorageBucket('${escapeHtml(b.name)}')">حذف</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    console.warn('Buckets load error:', err);
  }
}

function switchStorageBucket(bucketName) {
  if (window.Router && typeof window.Router.navigate === 'function') {
    window.Router.navigate('storage', 'explorer');
  }
  const sel = document.getElementById('storage-explorer-bucket-select');
  if (sel) {
    sel.value = bucketName;
  }
  loadStorageExplorerForBucket(bucketName);
}

async function deleteStorageBucket(bucketName) {
  if (!activeProjectId || !bucketName) return;
  if (!confirm(`آیا از حذف باکت "${bucketName}" و کلیه فایل های درون آن اطمینان دارید؟`)) return;
  try {
    const res = await fetch(`/_baas/v1/${activeProjectId}/storage/buckets/${encodeURIComponent(bucketName)}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      showToast(`باکت "${bucketName}" با موفقیت حذف گردید.`, 'success');
      loadProjectBuckets();
      loadStorageExplorer();
      loadUsageData();
    } else {
      const err = await res.json().catch(() => ({}));
      showToast('خطا در حذف باکت: ' + (err.error || res.statusText), 'error');
    }
  } catch (err) {
    showToast('خطای شبکه در حذف باکت: ' + err.message, 'error');
  }
}

async function deleteStorageFile(bucketName, fileName) {
  if (!activeProjectId || !bucketName || !fileName) return;
  if (!confirm(`آیا از حذف فایل "${fileName}" از باکت "${bucketName}" اطمینان دارید؟`)) return;
  try {
    const res = await fetch(`/_baas/v1/${activeProjectId}/storage/${encodeURIComponent(bucketName)}/${encodeURIComponent(fileName)}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      showToast(`فایل "${fileName}" با موفقیت حذف گردید.`, 'success');
      loadStorageExplorerForBucket(bucketName);
      loadProjectBuckets();
      loadUsageData();
    } else {
      const err = await res.json().catch(() => ({}));
      showToast('خطا در حذف فایل: ' + (err.error || res.statusText), 'error');
    }
  } catch (err) {
    showToast('خطای شبکه در حذف فایل: ' + err.message, 'error');
  }
}

// 6. Subsystem: Edge Functions Studio & Syntax Highlighter
async function loadStorageExplorer() {
  if (!activeProjectId) return;
  const select = document.getElementById('storage-explorer-bucket-select');
  try {
    const res = await fetch(`/_baas/v1/${activeProjectId}/storage/buckets`);
    if (res.ok) {
      const buckets = await res.json();
      if (select) {
        if (!buckets || buckets.length === 0) {
          select.innerHTML = '<option value="">باکتی وجود ندارد</option>';
        } else {
          select.innerHTML = buckets.map(b => `<option value="${escapeHtml(b.name)}">${escapeHtml(b.name)} (${b.isPublic ? 'عمومی' : 'محرمانه'})</option>`).join('');
          loadStorageExplorerForBucket(select.value);
        }
      }
    }
  } catch (err) {
    console.warn('Storage explorer load error:', err);
  }
}

async function loadStorageExplorerForBucket(bucketName) {
  if (!activeProjectId || !bucketName) return;
  const tbody = document.getElementById('storage-files-tbody');
  const select = document.getElementById('storage-explorer-bucket-select');
  if (select && select.value !== bucketName) select.value = bucketName;
  if (!tbody) return;

  try {
    const res = await fetch(`/_baas/v1/${activeProjectId}/storage/${encodeURIComponent(bucketName)}/files`);
    if (res.ok) {
      const files = await res.json();
      if (!files || files.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 16px;">فایلی در این باکت وجود ندارد. فایل جدیدی بارگذاری فرمایید.</td></tr>';
      } else {
        tbody.innerHTML = files.map(f => {
          const sizeKb = (f.sizeBytes / 1024).toFixed(1);
          const dlUrl = f.downloadUrl || `/_baas/v1/${activeProjectId}/storage/${bucketName}/${f.fileName}`;
          return `
            <tr>
              <td style="font-family: var(--font-persian); font-weight: 700;">${escapeHtml(f.fileName)}</td>
              <td style="font-family: var(--font-persian); font-size: 13px; color: var(--text-muted);">${escapeHtml(f.contentType)}</td>
              <td style="font-size: 13.5px;">${Shamsi.toPersianDigits(sizeKb)} KB</td>
              <td style="font-size: 13.5px;">${escapeHtml(Shamsi.formatDate(f.uploadedAtUtc))}</td>
              <td>
                <div style="display: flex; gap: 4px;">
                  <button type="button" class="btn-secondary" style="font-size: 12.5px; padding: 2px 8px;" onclick="copyFileDownloadLink('${escapeHtml(dlUrl)}')">کپی لینک</button>
                  <a href="${escapeHtml(dlUrl)}" target="_blank" class="btn-secondary" style="font-size: 12.5px; padding: 2px 8px; text-decoration: none;">دانلود</a>
                  <button type="button" class="btn-danger" style="font-size: 12.5px; padding: 2px 8px;" onclick="deleteStorageFile('${escapeHtml(bucketName)}', '${escapeHtml(f.fileName)}')">حذف</button>
                </div>
              </td>
            </tr>
          `;
        }).join('');
      }
    }
  } catch (err) {
    console.warn('Bucket files load error:', err);
  }
}

function copyFileDownloadLink(relUrl) {
  const fullUrl = window.location.origin + relUrl;
  navigator.clipboard.writeText(fullUrl).then(() => {
    showToast('آدرس مستقیم امن بارگیری فایل در کلیپ بورد کپی شد.', 'success');
  }).catch(() => {
    prompt('آدرس فایل:', fullUrl);
  });
}

async function handleDirectFileUpload() {
  if (!activeProjectId) return;
  const select = document.getElementById('storage-explorer-bucket-select');
  const fileInput = document.getElementById('storage-upload-file-input');
  if (!select || !select.value) {
    showToast('لطفاً ابتدا باکت مقصد را انتخاب فرمایید.', 'warning');
    return;
  }
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    showToast('لطفاً فایلی را جهت بارگذاری انتخاب نمایید.', 'warning');
    return;
  }

  const bucket = select.value;
  const file = fileInput.files[0];
  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch(`/_baas/v1/${activeProjectId}/storage/${encodeURIComponent(bucket)}/upload`, {
      method: 'POST',
      body: formData
    });

    if (res.ok) {
      showToast('فایل با موفقیت در باکت ابری ذخیره گردید.', 'success');
      fileInput.value = '';
      loadStorageExplorerForBucket(bucket);
      loadProjectBuckets();
      loadUsageData();
    } else {
      showToast('خطا در بارگذاری فایل.', 'error');
    }
  } catch (err) {
    showToast('خطای شبکه در آپلود فایل: ' + err.message, 'error');
  }
}

function loadStoragePolicies() {
  if (!activeProject) return;
  const cfg = activeProject.services?.storage?.settings || {};
  setVal('storage-policy-cdn-ttl', cfg.cdn_cache_ttl || '86400');
  setVal('storage-policy-max-mb', cfg.max_upload_size_mb || '50');
  const forceDl = document.getElementById('storage-policy-force-download');
  if (forceDl) forceDl.checked = !!cfg.force_download;
}

async function saveStoragePolicies(e) {
  if (e) e.preventDefault();
  if (!activeProjectId) return;
  const settings = {
    cdn_cache_ttl: document.getElementById('storage-policy-cdn-ttl').value,
    max_upload_size_mb: document.getElementById('storage-policy-max-mb').value,
    force_download: document.getElementById('storage-policy-force-download')?.checked || false
  };
  await saveServiceConfig('storage', true, settings);
  showToast('سیاست های ذخیره سازی ابری با موفقیت ذخیره شدند.', 'success');
}

// 11.5 Edge Functions Traces & Env & Live Testing
// (Environment variables managed in services-compute.js)

async function loadHosting() {
  if (!activeProjectId || !activeProject) return;
  const liveUrlEl = document.getElementById('hosting-live-url');
  if (liveUrlEl) {
    const url = `https://${activeProject.slug}.localme.ir`;
    liveUrlEl.href = url;
    liveUrlEl.textContent = url;
  }

  // Load Deployments
  const depTbody = document.getElementById('hosting-deployments-tbody');
  if (depTbody) {
    try {
      const res = await fetch(`/_baas/v1/${activeProjectId}/hosting/deployments`);
      if (res.ok) {
        const deps = await res.json();
        if (!deps || deps.length === 0) {
          depTbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 16px;">هنوز نسخه ای مستقر نشده است.</td></tr>';
        } else {
          depTbody.innerHTML = deps.map(d => `
            <tr>
              <td style="font-family: var(--font-persian); font-weight: 700;">${escapeHtml(d.id)}</td>
              <td style="font-family: var(--font-persian);">${escapeHtml(d.branch)}</td>
              <td style="font-family: var(--font-persian); font-size: 13px;">${escapeHtml(d.commitSha)}</td>
              <td style="font-family: var(--font-persian); color: var(--color-info);">${escapeHtml(d.domain)}</td>
              <td><span class="badge badge-active">${escapeHtml(d.status)}</span></td>
              <td>${Shamsi.toPersianDigits((d.sizeBytes / (1024 * 1024)).toFixed(1))} MB</td>
              <td style="font-size: 13.5px;">${escapeHtml(Shamsi.formatDate(d.deployedAtUtc))}</td>
              <td><a href="${escapeHtml(d.previewUrl)}" target="_blank" class="btn-secondary" style="font-size: 13px; padding: 3px 10px; text-decoration: none;">پیش نمایش</a></td>
            </tr>
          `).join('');
        }
      }
    } catch (err) {
      console.warn('Deployments load error:', err);
    }
  }

  // Load Custom Domains
  await loadHostingDomains();
}

const verifyCustomDomain = verifyDomain;


async function loadHostingDomains() {
  if (!activeProjectId) return;
  const tbody = document.getElementById('hosting-domains-tbody');
  if (!tbody) return;

  try {
    const res = await fetch(`/_baas/v1/${activeProjectId}/hosting/domains`);
    if (res.ok) {
      const doms = await res.json();
      if (!doms || doms.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 16px;">هیچ دامنه اختصاصی ثبت نشده است. برای ثبت «+ افزودن دامنه جدید» را بزنید.</td></tr>';
      } else {
        tbody.innerHTML = doms.map(d => `
          <tr>
            <td style="font-family: var(--font-persian); font-weight: 700;">${escapeHtml(d.domain)}</td>
            <td style="font-family: var(--font-persian); font-size: 13px; color: var(--text-muted);">cname.localme.ir</td>
            <td><span class="badge ${d.isVerified ? 'badge-active' : 'badge-paused'}">${d.isVerified ? 'متصل و تایید شده' : 'در انتظار DNS'}</span></td>
            <td><span class="badge ${d.isVerified ? 'badge-active' : 'badge-paused'}">${d.isVerified ? "فعال (Let's Encrypt)" : 'در انتظار گواهی'}</span></td>
            <td style="font-size: 13.5px;">${escapeHtml(Shamsi.formatDate(d.createdAtUtc))}</td>
            <td>
              <div style="display: flex; gap: 4px; align-items: center;">
                ${!d.isVerified ? `<button type="button" class="btn-secondary" style="font-size: 12.5px; padding: 2px 8px;" onclick="verifyDomain('${escapeHtml(d.domain)}')">بررسی DNS</button>` : `<button type="button" class="btn-secondary" style="font-size: 12.5px; padding: 2px 8px;" onclick="renewDomainSsl('${escapeHtml(d.domain)}')">تمدید SSL</button>`}
                <button type="button" class="btn-danger" style="font-size: 12.5px; padding: 2px 8px;" onclick="deleteCustomDomain('${escapeHtml(d.domain)}')">حذف</button>
              </div>
            </td>
          </tr>
        `).join('');
      }
    }
  } catch (err) {
    console.warn('Hosting domains load error:', err);
  }
}

async function verifyDomain(domain) {
  if (!activeProjectId || !domain) return;
  try {
    const res = await fetch(`/_baas/v1/${activeProjectId}/hosting/domains/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain })
    });
    if (res.ok) {
      const data = await res.json();
      showToast(data.isVerified ? 'دامنه با موفقیت تایید شد و گواهی امنیتی SSL صادر گردید.' : 'رکورد CNAME دامنه هنوز در DNS عمومی منتشر نشده است. لطفاً دقایقی دیگر مجدداً بررسی فرمایید.', data.isVerified ? 'success' : 'warning');
      loadHostingDomains();
    }
  } catch (err) {
    showToast('خطا در بررسی دامنه: ' + err.message, 'error');
  }
}

async function renewDomainSsl(domain) {
  if (!activeProjectId || !domain) return;
  try {
    const res = await fetch(`/_baas/v1/${activeProjectId}/hosting/domains/${encodeURIComponent(domain)}/ssl`, {
      method: 'POST'
    });
    if (res.ok) {
      const data = await res.json();
      showToast(`گواهی امنیتی SSL برای دامنه "${domain}" با موفقیت تمدید گردید.`, 'success');
      loadHostingDomains();
    } else {
      const err = await res.json().catch(() => ({}));
      showToast('خطا در صدور یا تمدید گواهی SSL: ' + (err.error || res.statusText), 'error');
    }
  } catch (err) {
    showToast('خطای شبکه در صدور گواهی SSL: ' + err.message, 'error');
  }
}

async function deleteCustomDomain(domain) {
  if (!activeProjectId || !domain) return;
  if (!confirm(`آیا از حذف دامنه اختصاصی "${domain}" اطمینان دارید؟`)) return;
  try {
    const res = await fetch(`/_baas/v1/${activeProjectId}/hosting/domains/${encodeURIComponent(domain)}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      showToast(`دامنه "${domain}" با موفقیت حذف گردید.`, 'success');
      loadHostingDomains();
    } else {
      const err = await res.json().catch(() => ({}));
      showToast('خطا در حذف دامنه: ' + (err.error || res.statusText), 'error');
    }
  } catch (err) {
    showToast('خطای شبکه در حذف دامنه: ' + err.message, 'error');
  }
}

// 11.8 Compliance & Mobile Deeplinks Studio
async function loadCompliance() {
  if (!activeProjectId) return;
  try {
    const res = await fetch(`/_baas/v1/${activeProjectId}/compliance`);
    if (res.ok) {
      const cfg = await res.json();
      setVal('comp-enamad-token', cfg.enamadToken || '');
      setVal('comp-enamad-symbol', cfg.enamadSymbolCode || '');
      setVal('comp-samandehi-code', cfg.samandehiCode || '');
      setVal('comp-android-pkg', cfg.androidPackageName || '');
      setVal('comp-android-sha', cfg.androidSha256Fingerprint || '');
    }
  } catch (err) {
    console.warn('Compliance load error:', err);
  }
}

// 10. Live Logs & Telemetry Stream
var logsInterval = window.logsInterval = window.logsInterval || null;

async function loadComplianceDeeplinks() {
  if (!activeProjectId) return;
  try {
    const res = await fetch(`/_baas/v1/${activeProjectId}/compliance`);
    if (res.ok) {
      const cfg = await res.json();
      setVal('comp-android-pkg', cfg.androidPackageName || '');
      setVal('comp-android-sha256', cfg.androidSha256Fingerprint || '');
      setVal('comp-apple-team', cfg.appleTeamId || '');
      setVal('comp-apple-bundle', cfg.appleBundleId || '');
    }
  } catch (err) {
    console.warn('Compliance deeplinks load error:', err);
  }
}

async function saveDeeplinksConfig(e) {
  if (e) e.preventDefault();
  if (!activeProjectId) return;
  const androidPackageName = document.getElementById('comp-android-pkg')?.value.trim() || '';
  const androidSha256Fingerprint = document.getElementById('comp-android-sha256')?.value.trim() || '';
  const appleTeamId = document.getElementById('comp-apple-team')?.value.trim() || '';
  const appleBundleId = document.getElementById('comp-apple-bundle')?.value.trim() || '';

  try {
    const res = await fetch(`/_baas/v1/${activeProjectId}/compliance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        androidPackageName,
        androidSha256Fingerprint,
        appleTeamId,
        appleBundleId
      })
    });
    if (res.ok) {
      showToast('تنظیمات دیپ لینک اپلیکیشن موبایل با موفقیت در فایلهای assetlinks و apple-app-site-association ذخیره گردید.', 'success');
    }
  } catch (err) {
    showToast('خطا در ذخیره دیپ لینک: ' + err.message, 'error');
  }
}

// 11.9 Telemetry Audit Logs

// Infra Window Attachments
window.loadProjectBuckets = loadProjectBuckets;
window.switchStorageBucket = switchStorageBucket;
window.deleteStorageBucket = deleteStorageBucket;
window.deleteStorageFile = deleteStorageFile;
window.loadStorageExplorer = loadStorageExplorer;
window.loadStorageExplorerForBucket = loadStorageExplorerForBucket;
window.copyFileDownloadLink = copyFileDownloadLink;
window.handleDirectFileUpload = handleDirectFileUpload;
window.loadStoragePolicies = loadStoragePolicies;
window.saveStoragePolicies = saveStoragePolicies;
window.loadHosting = loadHosting;
window.loadHostingDomains = loadHostingDomains;
window.verifyDomain = verifyDomain;
window.renewDomainSsl = renewDomainSsl;
window.deleteCustomDomain = deleteCustomDomain;
window.loadCompliance = loadCompliance;
window.loadComplianceDeeplinks = loadComplianceDeeplinks;
window.saveDeeplinksConfig = saveDeeplinksConfig;
