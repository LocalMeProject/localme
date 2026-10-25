function updateProfileModalData(user) {
  if (!user) return;
  const setT = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  setT('modal-profile-fullname', user.fullName || 'سینا والی زاده');
  setT('modal-profile-id', user.id || 'usr_developer_03');
  setT('modal-profile-phone', user.phone || '+989121112233');
  setT('modal-profile-email', user.email || 'sina@example.com');
  setT('modal-profile-username', user.username || 'sina');
  if (typeof Shamsi !== 'undefined') {
    setT('modal-profile-wallet', Shamsi.formatToman(user.walletBalanceIrr));
  }
  const roleEl = document.getElementById('modal-profile-role');
  if (roleEl) {
    if (user.isProjectScoped) {
      roleEl.textContent = 'دسترسی تک پروژه';
      roleEl.className = 'badge badge-info';
    } else {
      roleEl.textContent = user.role === 0 ? 'مدیر ارشد' : user.role === 1 ? 'اپراتور' : 'توسعه دهنده';
      roleEl.className = 'badge badge-active';
    }
  }
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = "flex";
  if (id === 'modal-user-profile' && typeof currentUser !== 'undefined' && currentUser) {
    updateProfileModalData(currentUser);
  }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = "none";
}

window.openModal = openModal;
window.closeModal = closeModal;
window.updateProfileModalData = updateProfileModalData;

// 5. Project CRUD & Modals
function initModals() {
  const openCreateBtns = [
    document.getElementById('btn-create-proj-modal'),
    document.getElementById('btn-create-first-proj')
  ];

  openCreateBtns.forEach(btn => {
    if (btn) btn.addEventListener('click', () => openModal('modal-create-proj'));
  });

  const formCreate = document.getElementById('form-create-new-project');
  if (formCreate) {
    formCreate.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('new-proj-name').value.trim();
      const slug = document.getElementById('new-proj-slug').value.trim();
      const desc = document.getElementById('new-proj-desc').value.trim();

      try {
        const res = await fetch('/_baas/v1/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, slug, description: desc })
        });

        if (res.ok) {
          const newProj = await res.json();
          closeModal('modal-create-proj');
          formCreate.reset();
          showToast('پروژه جدید با موفقیت ایجاد شد.', 'success');
          await loadUserProjects(newProj.id);
        } else {
          const err = await res.json().catch(() => ({}));
          showToast(err.error || 'خطا در ایجاد پروژه.', 'error');
        }
      } catch {
        showToast('خطای شبکه در ارتباط با سرور.', 'error');
      }
    });
  }

  const formUpdate = document.getElementById('form-update-project');
  if (formUpdate) {
    formUpdate.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeProjectId) return;

      const name = document.getElementById('set-proj-name').value.trim();
      const slug = document.getElementById('set-proj-slug').value.trim();
      const desc = document.getElementById('set-proj-desc').value.trim();

      try {
        const res = await fetch(`/_baas/v1/projects/${activeProjectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, slug, description: desc })
        });

        if (res.ok) {
          showToast('مشخصات پروژه با موفقیت ذخیره شد.', 'success');
          await loadUserProjects(activeProjectId);
        } else {
          showToast('خطا در به روزرسانی پروژه.', 'error');
        }
      } catch {
        showToast('خطای شبکه در ارتباط با سرور.', 'error');
      }
    });
  }

  const btnDelete = document.getElementById('btn-delete-project');
  if (btnDelete) {
    btnDelete.addEventListener('click', async () => {
      if (!activeProjectId) return;

      if (!confirm(`آیا مطمئن هستید که می خواهید پروژه "${activeProject.name}" را برای همیشه حذف کنید؟`)) {
        return;
      }

      try {
        const res = await fetch(`/_baas/v1/projects/${activeProjectId}`, {
          method: 'DELETE'
        });

        if (res.ok) {
          showToast('پروژه با موفقیت حذف گردید.', 'success');
          await loadUserProjects();
        } else {
          showToast('خطا در حذف پروژه.', 'error');
        }
      } catch {
        showToast('خطای شبکه در ارتباط با سرور.', 'error');
      }
    });
  }

  const topupBtn = document.getElementById('btn-open-topup');
  if (topupBtn) {
    topupBtn.addEventListener('click', () => openModal('modal-topup'));
  }

  const formTopup = document.getElementById('form-topup');
  if (formTopup) {
    formTopup.addEventListener('submit', async (e) => {
      e.preventDefault();
      const gateway = document.getElementById('topup-gateway').value;
      const amountToman = parseInt(document.getElementById('topup-amount-toman').value, 10);
      const amountIrr = amountToman * 10;

      try {
        const idempotencyKey = 'topup_' + Date.now();
        const res = await fetch('/_baas/v1/pay/initiate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amountIrr,
            customerPhone: currentUser.phone,
            gateway,
            callbackUrl: window.location.href,
            idempotencyKey,
            description: 'شارژ کیف پول توسعه دهنده'
          })
        });

        if (res.ok) {
          const initRes = await res.json();
          const authority = initRes.authorityToken || initRes.authority;
          const vRes = await fetch('/_baas/v1/pay/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              authority,
              authorityToken: authority,
              trackingCode: initRes.trackingCode,
              customerPhone: currentUser.phone,
              status: 'OK',
              gateway
            })
          });

          if (vRes.ok) {
            const vData = await vRes.json();
            const refId = vData.shaparakRefId || vData.referenceId || vData.trackingCode || 'موفق';
            const newBal = vData.newWalletBalanceIrr ?? vData.balanceIrr ?? 0;
            showToast(`پرداخت الکترونیک موفق شاپرک. شماره پیگیری: ${refId} - موجودی جدید: ${Shamsi.toPersianDigits(Math.floor(newBal / 10).toLocaleString())} تومان`, 'success');
            updateWalletDisplay(newBal);
            closeModal('modal-topup');
          }
        }
      } catch {
        showToast('خطا در برقراری ارتباط با درگاه پرداخت.', 'error');
      }
    });
  }

  // Deploy Function Modal & Form
  const btnDeployModal = document.getElementById('btn-modal-deploy-func');
  if (btnDeployModal) {
    btnDeployModal.addEventListener('click', () => openModal('modal-deploy-func'));
  }

  const formDeployFunc = document.getElementById('form-deploy-func');
  if (formDeployFunc) {
    formDeployFunc.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeProjectId) {
        showToast('لطفاً ابتدا یک پروژه انتخاب نمایید.', 'warning');
        return;
      }

      const name = document.getElementById('deploy-func-name').value.trim();
      const slug = document.getElementById('deploy-func-slug').value.trim();
      const script = document.getElementById('deploy-func-script').value;

      try {
        const res = await fetch(`/_baas/v1/${activeProjectId}/functions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, slug, script })
        });

        if (res.ok) {
          const deployed = await res.json();
          closeModal('modal-deploy-func');
          formDeployFunc.reset();
          showToast(`تابع "${deployed.name}" با موفقیت در لبه شبکه مستقر گردید.`, 'success');
          await loadProjectFunctions();
          selectTestFunc(deployed.slug);
        } else {
          showToast('خطا در استقرار تابع.', 'error');
        }
      } catch (err) {
        showToast('خطای ارتباط با سرور: ' + err.message, 'error');
      }
    });
  }

  // Add Project User Modal & Form
  const btnAddUserModal = document.getElementById('btn-modal-add-user');
  if (btnAddUserModal) {
    btnAddUserModal.addEventListener('click', () => {
      openModal('modal-add-user');
      if (typeof window.toggleAddUserPasswordFields === 'function') {
        window.toggleAddUserPasswordFields(document.getElementById('new-user-provider')?.value || 'password');
      }
    });
  }

  window.toggleAddUserPasswordFields = function(provider) {
    const pwWrap = document.getElementById('new-user-password-wrap');
    const unWrap = document.getElementById('new-user-username-wrap');
    if (pwWrap) pwWrap.style.display = provider === 'password' ? 'block' : 'none';
    if (unWrap) unWrap.style.display = provider === 'password' ? 'block' : 'none';
  };

  const formAddUser = document.getElementById('form-add-project-user');
  if (formAddUser) {
    formAddUser.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeProjectId) return;

      const provider = document.getElementById('new-user-provider').value;
      const identifier = document.getElementById('new-user-identifier').value.trim();
      const fullName = document.getElementById('new-user-name').value.trim();
      const username = document.getElementById('new-user-username')?.value.trim() || null;
      const password = document.getElementById('new-user-password')?.value || null;

      const isPhone = identifier.startsWith('+') || /^\d+$/.test(identifier);
      const payload = {
        provider,
        phone: isPhone ? identifier : null,
        email: !isPhone ? identifier : null,
        username: username,
        password: password,
        full_name: fullName
      };

      try {
        const res = await fetch(`/_baas/v1/${activeProjectId}/auth/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          closeModal('modal-add-user');
          formAddUser.reset();
          showToast('کاربر جدید با موفقیت در پروژه ثبت گردید.', 'success');
          if (typeof loadProjectUsers === 'function') {
            await loadProjectUsers();
          }
        } else {
          const err = await res.json().catch(() => ({}));
          showToast(err.error || 'خطا در ثبت کاربر.', 'error');
        }
      } catch {
        showToast('خطای ارتباط با سرور.', 'error');
      }
    });
  }

  // Create Storage Bucket Modal & Form
  const btnCreateBucketModal = document.getElementById('btn-modal-create-bucket');
  if (btnCreateBucketModal) {
    btnCreateBucketModal.addEventListener('click', () => openModal('modal-create-bucket'));
  }

  const formCreateBucket = document.getElementById('form-create-bucket');
  if (formCreateBucket) {
    formCreateBucket.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeProjectId) return;

      const name = document.getElementById('new-bucket-name').value.trim();
      const isPublic = document.getElementById('new-bucket-public').value === 'true';

      try {
        const res = await fetch(`/_baas/v1/${activeProjectId}/storage/buckets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, is_public: isPublic })
        });

        if (res.ok) {
          closeModal('modal-create-bucket');
          formCreateBucket.reset();
          showToast(`باکت "${name}" با موفقیت ایجاد گردید.`, 'success');
          await loadProjectBuckets();
        } else {
          showToast('خطا در ایجاد باکت.', 'error');
        }
      } catch {
        showToast('خطای ارتباط با سرور.', 'error');
      }
    });
  }

  // Create Database Table Modal & Form
  const btnCreateTableModal = document.getElementById('btn-modal-create-table');
  if (btnCreateTableModal) {
    btnCreateTableModal.addEventListener('click', () => openModal('modal-create-table'));
  }

  const formCreateTable = document.getElementById('form-create-table');
  if (formCreateTable) {
    formCreateTable.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeProjectId) return;

      const name = document.getElementById('new-table-name').value.trim();

      try {
        const res = await fetch(`/_baas/v1/${activeProjectId}/db/tables`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        });

        if (res.ok) {
          closeModal('modal-create-table');
          formCreateTable.reset();
          showToast(`جدول "${name}" با موفقیت ایجاد شد.`, 'success');
          await loadProjectTables();
        } else {
          showToast('خطا: جدول با این نام از قبل وجود دارد.', 'error');
        }
      } catch {
        showToast('خطای ارتباط با سرور.', 'error');
      }
    });
  }

  const formInsert = document.getElementById('form-insert-db-row');
  if (formInsert) {
    formInsert.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeProjectId || !currentDbTable) return;

      const title = document.getElementById('db-input-title').value.trim();
      const category = document.getElementById('db-input-category').value.trim();
      const price = parseInt(document.getElementById('db-input-price').value, 10);

      try {
        const res = await fetch(`/_baas/v1/${activeProjectId}/db/${currentDbTable}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, category, price, created_at: new Date().toISOString() })
        });

        if (res.ok) {
          document.getElementById('db-input-title').value = '';
          loadTableData(currentDbTable);
          loadUsageData();
        }
      } catch (err) {
        console.warn('Row insert error:', err);
      }
    });
  }

  const refreshDbBtn = document.getElementById('btn-refresh-db');
  if (refreshDbBtn) {
    refreshDbBtn.addEventListener('click', () => {
      if (currentDbTable) loadTableData(currentDbTable);
    });
  }

  // 1. SQL Runner Trigger
  const btnRunSql = document.getElementById('btn-run-sql');
  if (btnRunSql) {
    btnRunSql.addEventListener('click', () => runSqlQuery());
  }

  // 2. Shetab IPG Simulator Test Button & Config Form
  const btnTestPay = document.getElementById('btn-test-shetab-payment');
  if (btnTestPay) {
    btnTestPay.addEventListener('click', async () => {
      if (!activeProjectId || !currentUser) {
        showToast('لطفاً ابتدا وارد پنل شده و پروژه را انتخاب نمایید.', 'warning');
        return;
      }
      try {
        const idempotencyKey = 'test_ipg_' + Date.now();
        const res = await fetch('/_baas/v1/pay/initiate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amountIrr: 500000,
            customerPhone: currentUser.phone,
            gateway: document.getElementById('ipg-default-psp')?.value || 'ZARINPAL',
            callbackUrl: window.location.origin + '/panel',
            idempotencyKey,
            description: 'تست درگاه پرداخت شتاب پلتفرم لوکال می'
          })
        });
        if (res.ok) {
          const initRes = await res.json();
          if (initRes.redirectUrl) {
            window.location.href = initRes.redirectUrl;
          }
        }
      } catch (err) {
        showToast('خطا در شروع تراکنش تستی: ' + err.message, 'error');
      }
    });
  }

  const formIpg = document.getElementById('form-ipg-config');
  if (formIpg) {
    formIpg.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeProjectId) return;

      const defaultPsp = document.getElementById('ipg-default-psp')?.value || 'ZARINPAL';
      const isSandbox = (document.getElementById('ipg-is-sandbox') || document.getElementById('ipg-sandbox-mode'))?.checked ?? (document.getElementById('ipg-sandbox-mode')?.value === 'true');
      const enforceShetabCardMask = document.getElementById('ipg-mask-card')?.checked !== false;

      const mellatTerminalId = document.getElementById('ipg-mellat-terminal')?.value.trim() || null;
      const mellatUserName = document.getElementById('ipg-mellat-username')?.value.trim() || null;
      const mellatUserPassword = document.getElementById('ipg-mellat-password')?.value.trim() || null;
      const mellatPayerId = document.getElementById('ipg-mellat-payerid')?.value.trim() || null;

      const sepTerminalId = document.getElementById('ipg-sep-terminal')?.value.trim() || null;
      const sepMerchantId = document.getElementById('ipg-sep-merchant')?.value.trim() || null;
      const sepCellNumber = document.getElementById('ipg-sep-cell')?.value.trim() || null;

      const zarinpalMerchantId = document.getElementById('ipg-zarinpal-merchant')?.value.trim() || null;
      const zarinpalIsZarinGate = document.getElementById('ipg-zarinpal-zaringate')?.checked || false;
      const zarinpalSandbox = (document.getElementById('ipg-is-sandbox') || document.getElementById('ipg-zarinpal-sandbox'))?.checked || false;

      const sadadMerchantId = document.getElementById('ipg-sadad-merchant')?.value.trim() || null;
      const sadadTerminalId = document.getElementById('ipg-sadad-terminal')?.value.trim() || null;
      const sadadTerminalKey = document.getElementById('ipg-sadad-key')?.value.trim() || null;

      let terminalId = '';
      let merchantKey = '';
      if (defaultPsp === 'BEHPARDAKHT') {
        terminalId = mellatTerminalId || '';
        merchantKey = mellatUserName || '';
      } else if (defaultPsp === 'SEP') {
        terminalId = sepTerminalId || '';
        merchantKey = sepMerchantId || '';
      } else if (defaultPsp === 'ZARINPAL') {
        terminalId = zarinpalMerchantId || '';
        merchantKey = zarinpalMerchantId || '';
      } else if (defaultPsp === 'SADAD') {
        terminalId = sadadTerminalId || '';
        merchantKey = sadadTerminalKey || '';
      }

      const alertEl = document.getElementById('ipg-validation-alert');
      if (alertEl) {
        alertEl.style.display = 'none';
        alertEl.textContent = '';
      }

      const payload = {
        defaultPsp,
        terminalId,
        merchantKey,
        isSandbox,
        enforceShetabCardMask,
        mellatTerminalId,
        mellatUserName,
        mellatUserPassword,
        mellatPayerId,
        sepTerminalId,
        sepMerchantId,
        sepCellNumber,
        zarinpalMerchantId,
        zarinpalIsZarinGate,
        zarinpalSandbox,
        sadadMerchantId,
        sadadTerminalId,
        sadadTerminalKey
      };

      try {
        const res = await fetch(`/_baas/v1/${activeProjectId}/ipg/config`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          showToast('تنظیمات درگاه شاپرک با موفقیت اعتبارسنجی و در پایگاه داده پایدار ذخیره گردید.', 'success');
          await loadIpgStudio();
        } else {
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData.error || errData.title || 'خطا در اعتبارسنجی تنظیمات درگاه شاپرک';
          if (alertEl) {
            alertEl.style.display = 'block';
            alertEl.textContent = 'خطای اعتبارسنجی شاپرک: ' + errMsg;
          }
          showToast('خطای اعتبارسنجی شاپرک: ' + errMsg, 'error');
        }
      } catch (err) {
        if (alertEl) {
          alertEl.style.display = 'block';
          alertEl.textContent = 'خطای ارتباط با سرور: ' + err.message;
        }
        showToast('خطای ارتباط با سرور: ' + err.message, 'error');
      }
    });
  }

  // 3. Hosting & Deployments Modals & Forms
  const formDep = document.getElementById('form-create-deployment');
  if (formDep) {
    formDep.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeProjectId) return;
      const branch = document.getElementById('new-dep-branch').value.trim();
      const commitSha = document.getElementById('new-dep-commit').value.trim();
      const domain = document.getElementById('new-dep-domain').value.trim();

      try {
        const res = await fetch(`/_baas/v1/${activeProjectId}/hosting/deployments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ branch, commit_sha: commitSha, domain })
        });
        if (res.ok) {
          closeModal('modal-create-deployment');
          formDep.reset();
          showToast('استقرار جدید با موفقیت بر روی CDN ملی ثبت گردید.', 'success');
          loadHosting();
          loadLogs();
        }
      } catch (err) {
        showToast('خطا در استقرار: ' + err.message, 'error');
      }
    });
  }

  const formDom = document.getElementById('form-add-domain');
  if (formDom) {
    formDom.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeProjectId) return;
      const domain = document.getElementById('new-domain-name').value.trim();

      try {
        const res = await fetch(`/_baas/v1/${activeProjectId}/hosting/domains`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain })
        });
        if (res.ok) {
          closeModal('modal-add-domain');
          formDom.reset();
          showToast('دامنه با موفقیت ثبت شد. لطفاً رکورد CNAME را طبق راهنما تنظیم فرمایید.', 'success');
          loadHosting();
        }
      } catch (err) {
        showToast('خطا در ثبت دامنه: ' + err.message, 'error');
      }
    });
  }

  // 4. Team Collaborator Form
  const formCollab = document.getElementById('form-add-collaborator');
  if (formCollab) {
    formCollab.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeProjectId) return;
      const fullName = document.getElementById('new-collab-name').value.trim();
      const contact = document.getElementById('new-collab-contact').value.trim();
      const role = document.getElementById('new-collab-role').value;

      try {
        const res = await fetch(`/_baas/v1/${activeProjectId}/team`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ full_name: fullName, email_or_phone: contact, role })
        });
        if (res.ok) {
          closeModal('modal-add-collaborator');
          formCollab.reset();
          showToast('همکار جدید با موفقیت به تیم پروژه ملحق گردید.', 'success');
          loadTeam();
          loadLogs();
        } else {
          const errData = await res.json().catch(() => ({}));
          showToast(errData.error || 'خطا در افزودن همکار: سقف اعضای پلن تکمیل است.', 'error');
        }
      } catch (err) {
        showToast('خطا در افزودن همکار: ' + err.message, 'error');
      }
    });
  }

  // 5. Compliance Form
  const formComp = document.getElementById('form-compliance-config');
  if (formComp) {
    formComp.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeProjectId) return;
      const enamadToken = document.getElementById('comp-enamad-token').value.trim();
      const enamadSymbolCode = document.getElementById('comp-enamad-symbol').value.trim();
      const samandehiCode = document.getElementById('comp-samandehi-code').value.trim();
      const androidPackageName = document.getElementById('comp-android-pkg').value.trim();
      const androidSha256Fingerprint = (document.getElementById('comp-android-sha256') || document.getElementById('comp-android-sha'))?.value.trim() || '';

      try {
        const res = await fetch(`/_baas/v1/${activeProjectId}/compliance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            enamadToken,
            enamadSymbolCode,
            samandehiCode,
            androidPackageName,
            androidSha256Fingerprint,
            appleTeamId: 'TEAMIRAN99',
            appleAppBundleId: androidPackageName
          })
        });
        if (res.ok) {
          showToast('تنظیمات انطباق و مجوزها با موفقیت ذخیره گردید.', 'success');
        }
      } catch (err) {
        showToast('خطا در ذخیره انطباق: ' + err.message, 'error');
      }
    });
  }

  // 6. Logs Listeners & Polling
  const btnRefLogs = document.getElementById('btn-refresh-logs');
  if (btnRefLogs) btnRefLogs.addEventListener('click', () => loadLogs());
  const filterSvc = document.getElementById('logs-filter-service');
  if (filterSvc) filterSvc.addEventListener('change', () => loadLogs());
  const filterLvl = document.getElementById('logs-filter-level');
  if (filterLvl) filterLvl.addEventListener('change', () => loadLogs());

  var logsInterval = window.logsInterval = window.logsInterval || null;
  if (!logsInterval) {
    logsInterval = window.logsInterval = setInterval(() => {
      const activeTab = document.querySelector('.tab-view.active');
      const autoRefresh = document.getElementById('logs-auto-refresh');
      if (activeTab && activeTab.id === 'view-logs' && autoRefresh && autoRefresh.checked) {
        loadLogs();
      }
    }, 3000);
  }
}

