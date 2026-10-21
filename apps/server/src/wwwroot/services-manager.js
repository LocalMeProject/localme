// =====================================================================
// LocalMe BaaS - Central Services Manager, Dedicated Config & Dashboards
// =====================================================================

(function() {
  const SERVICES_LIST = [
    {
      key: 'database',
      module: 'db',
      title: 'پایگاه داده رابطه‌ای (PostgreSQL REST)',
      desc: 'اسکیمای مجزا و دسترسی مستقیم RESTful با سقف اتصالات مشخص و امنیت سطح ردیف.',
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
      defaultRoute: 'dashboard',
      dashboardView: 'view-db-dashboard'
    },
    {
      key: 'auth',
      module: 'auth',
      title: 'احراز هویت جامع و کاربران (Auth)',
      desc: 'ورود پیامکی OTP با خط خدماتی، کلمه عبور ایمن، کپچای خودکار و نشست‌های JWT.',
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
      defaultRoute: 'dashboard',
      dashboardView: 'view-auth-dashboard'
    },
    {
      key: 'storage',
      module: 'storage',
      title: 'ذخیره‌سازی ابری چندرسانه‌ای (Storage)',
      desc: 'باکت‌های ذخیره فایل‌ها، تصاویر و اسناد با صدور آدرس امن و کنترل حجم مصرفی.',
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
      defaultRoute: 'dashboard',
      dashboardView: 'view-storage-dashboard'
    },
    {
      key: 'functions',
      module: 'functions',
      title: 'توابع سرورلس لبه (Edge Functions)',
      desc: 'اجرای کدهای جاوااسکریپت در محیط ایزوله فوق‌سریع Jint با IP خروجی ایستا.',
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>',
      defaultRoute: 'dashboard',
      dashboardView: 'view-functions-dashboard'
    },
    {
      key: 'ipg',
      module: 'ipg',
      title: 'درگاه پرداخت شاپرک (Payment Gateway)',
      desc: 'تراکنش‌های شتابی آنلاین با کلیه بانک‌های عضو شاپرک، تسویه خودکار و شبیه‌ساز تست.',
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
      defaultRoute: 'dashboard',
      dashboardView: 'view-ipg-dashboard'
    },
    {
      key: 'mobile',
      module: 'mobile',
      title: 'سرویس‌های موبایل، پوش و خرید (Mobile)',
      desc: 'سامانه اعلان به اپلیکیشن‌های اندروید و iOS، تایید خریدهای بازار و مایکت و وب‌سوکت.',
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>',
      defaultRoute: 'dashboard',
      dashboardView: 'view-mobile-dashboard'
    },
    {
      key: 'hosting',
      module: 'hosting',
      title: 'میزبانی وب و استقرار ایستا (Hosting)',
      desc: 'استقرار وب‌اپلیکیشن‌ها و SPA با دامنه اختصاصی و صدور گواهی SSL خودکار.',
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
      defaultRoute: 'dashboard',
      dashboardView: 'view-hosting-dashboard'
    },
    {
      key: 'compliance',
      module: 'compliance',
      title: 'انطباق قانونی، اینماد و دیپ‌لینک (Compliance)',
      desc: 'مدیریت تاییدیه نماد اعتماد الکترونیکی، ساماندهی و نگاشت دیپ‌لینک اپلیکیشن.',
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
      defaultRoute: 'dashboard',
      dashboardView: 'view-compliance-dashboard'
    }
  ];
  window.SERVICES_LIST = SERVICES_LIST;

  // 1. Render Project Overview Active & Inactive Services
  function renderOverviewServices() {
    const activeContainer = document.getElementById('overview-active-services-list');
    const inactiveContainer = document.getElementById('overview-inactive-services-list');
    const activeCountEl = document.getElementById('ov-val-active-services');
    if (!window.activeProject) return;

    const project = window.activeProject;
    const services = SERVICES_LIST;
    const active = [];
    const inactive = [];

    services.forEach(s => {
      const cfg = project.services?.[s.key];
      if (cfg && cfg.isEnabled) active.push({ s, cfg });
      else inactive.push({ s, cfg: cfg || { isEnabled: false } });
    });

    if (activeCountEl) {
      activeCountEl.textContent = `${Shamsi.toPersianDigits(active.length)} / ${Shamsi.toPersianDigits(services.length)}`;
    }

    // Render Active Services at TOP
    if (activeContainer) {
      if (active.length === 0) {
        activeContainer.innerHTML = `
          <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: var(--radius-sm); padding: 18px; text-align: center; color: var(--text-muted); font-size: 13.5px;">
            هیچ سرویسی برای این پروژه هنوز فعال نشده است. از بخش زیر سرویس‌های مورد نیاز خود را فعال نمایید.
          </div>
        `;
      } else {
        activeContainer.innerHTML = active.map(({ s, cfg }) => {
          const metricBadge = getServiceMetricBadge(s.key);
          return `
            <div class="service-row-card active-card" style="background: #ffffff; border: 1px solid #10b981; border-right: 4px solid #10b981; border-radius: var(--radius-sm); padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 10px;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 38px; height: 38px; border-radius: 8px; background: rgba(16, 185, 129, 0.1); display: flex; align-items: center; justify-content: center; color: #059669;">
                  ${s.icon}
                </div>
                <div>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <strong style="font-size: 14px; color: var(--text-main);">${escapeHtml(s.title)}</strong>
                    <span class="badge badge-active">فعال</span>
                    ${metricBadge}
                  </div>
                  <div style="font-size: 12.5px; color: var(--text-muted); margin-top: 2px;">${escapeHtml(s.desc)}</div>
                </div>
              </div>
              <div style="display: flex; gap: 8px; align-items: center;">
                <button type="button" class="btn-primary" style="font-size: 12.5px; padding: 5px 14px; background: #059669;" onclick="Router.navigate('${s.module}', 'dashboard')">
                  داشبورد اختصاصی سرویس ↗
                </button>
                <button type="button" class="btn-secondary" style="font-size: 12.5px; padding: 5px 12px;" onclick="Router.navigate('service', '${s.key}')">
                  پیکربندی و تنظیمات
                </button>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // Render Inactive Services at BOTTOM
    if (inactiveContainer) {
      if (inactive.length === 0) {
        inactiveContainer.innerHTML = `
          <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: var(--radius-sm); padding: 14px 18px; text-align: center; color: #065f46; font-size: 13.5px; font-weight: 600;">
            ✓ تمامی ۸ سرویس ابری پلتفرم برای این پروژه فعال هستند.
          </div>
        `;
      } else {
        inactiveContainer.innerHTML = inactive.map(({ s, cfg }) => {
          return `
            <div class="service-row-card inactive-card" style="background: #f8fafc; border: 1px solid var(--border-color); border-right: 4px solid #cbd5e1; border-radius: var(--radius-sm); padding: 12px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 8px; opacity: 0.92;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 36px; height: 36px; border-radius: 8px; background: #e2e8f0; display: flex; align-items: center; justify-content: center; color: #64748b;">
                  ${s.icon}
                </div>
                <div>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <strong style="font-size: 13.5px; color: var(--text-main);">${escapeHtml(s.title)}</strong>
                    <span class="badge badge-paused">غیرفعال (API مسدود)</span>
                  </div>
                  <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">${escapeHtml(s.desc)}</div>
                </div>
              </div>
              <div style="display: flex; gap: 8px; align-items: center;">
                <button type="button" class="btn-primary" style="font-size: 12.5px; padding: 5px 14px;" onclick="Router.navigate('service', '${s.key}')">
                  پیکربندی و فعال‌سازی سرویس
                </button>
              </div>
            </div>
          `;
        }).join('');
      }
    }
  }
  window.renderOverviewServices = renderOverviewServices;

  function getServiceMetricBadge(key) {
    if (!window.activeProject) return '';
    const pid = window.activeProjectId;
    switch(key) {
      case 'database':
        const tables = window.cachedProjectTables || [];
        return `<span class="badge" style="background: #e0f2fe; color: #0369a1; font-size: 11.5px;">${Shamsi.toPersianDigits(tables.length)} جدول</span>`;
      case 'storage':
        const buckets = window.cachedProjectBuckets || [];
        return `<span class="badge" style="background: #fef3c7; color: #92400e; font-size: 11.5px;">${Shamsi.toPersianDigits(buckets.length)} باکت</span>`;
      case 'functions':
        const funcs = Object.keys(window.projectFunctionsMap || {});
        return `<span class="badge" style="background: #ede9fe; color: #6d28d9; font-size: 11.5px;">${Shamsi.toPersianDigits(funcs.length)} تابع</span>`;
      case 'ipg':
        return `<span class="badge" style="background: #dcfce7; color: #15803d; font-size: 11.5px;">شاپرک فعال</span>`;
      case 'mobile':
        return `<span class="badge" style="background: #fae8ff; color: #86198f; font-size: 11.5px;">پوش و سوکت</span>`;
      default:
        return '';
    }
  }

  // 2. Render Full Services Manager Page
  function renderServicesManager() {
    const container = document.getElementById('services-manager-grid');
    if (!container || !window.activeProject) return;

    const project = window.activeProject;
    const services = SERVICES_LIST;
    let activeCount = 0;

    const cardsHtml = services.map(s => {
      const cfg = project.services?.[s.key] || { isEnabled: false };
      const isEn = cfg.isEnabled;
      if (isEn) activeCount++;

      return `
        <div class="card" style="border: 1px solid ${isEn ? '#10b981' : 'var(--border-color)'}; border-top: 4px solid ${isEn ? '#10b981' : '#94a3b8'}; transition: all 0.2s ease;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 40px; height: 40px; border-radius: 8px; background: ${isEn ? 'rgba(16, 185, 129, 0.1)' : '#f1f5f9'}; display: flex; align-items: center; justify-content: center; color: ${isEn ? '#059669' : '#64748b'};">
                ${s.icon}
              </div>
              <div>
                <strong style="font-size: 14.5px; color: var(--text-main); display: block;">${escapeHtml(s.title)}</strong>
                <span class="badge ${isEn ? 'badge-active' : 'badge-paused'}" style="margin-top: 3px;">
                  ${isEn ? 'فعال و در دسترس' : 'غیرفعال (API مسدود)'}
                </span>
              </div>
            </div>
          </div>
          <p style="font-size: 13px; color: var(--text-muted); line-height: 1.6; margin-bottom: 16px; min-height: 42px;">
            ${escapeHtml(s.desc)}
          </p>
          <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid var(--border-color);">
            <button type="button" class="btn-secondary" style="font-size: 12.5px; padding: 5px 12px;" onclick="Router.navigate('service', '${s.key}')">
              پیکربندی اختصاصی
            </button>
            ${isEn ? `
              <button type="button" class="btn-primary" style="font-size: 12.5px; padding: 5px 14px; background: #059669;" onclick="Router.navigate('${s.module}', 'dashboard')">
                داشبورد سرویس ↗
              </button>
            ` : `
              <button type="button" class="btn-primary" style="font-size: 12.5px; padding: 5px 14px;" onclick="Router.navigate('service', '${s.key}')">
                فعال‌سازی سرویس
              </button>
            `}
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = cardsHtml;

    const countEl = document.getElementById('services-manager-summary-text');
    if (countEl) {
      countEl.textContent = `${Shamsi.toPersianDigits(activeCount)} سرویس از ${Shamsi.toPersianDigits(services.length)} سرویس ابری در این پروژه فعال است.`;
    }
  }
  window.renderServicesManager = renderServicesManager;

  // 3. Render Dedicated Service Configuration Page
  function renderServiceConfigPage(serviceKey) {
    const container = document.getElementById('service-config-content');
    if (!container || !window.activeProject) return;

    const key = serviceKey || 'database';
    const sDef = SERVICES_LIST.find(s => s.key === key) || SERVICES_LIST[0];
    const project = window.activeProject;
    const cfg = project.services?.[sDef.key] || { isEnabled: false, settings: {}, apiKey: { apiKey: 'تولید نشده' } };
    const isEn = cfg.isEnabled;
    const settings = cfg.settings || {};
    const apiKey = cfg.apiKey?.apiKey || 'تولید نشده';

    const retentionDays = 10;
    const disabledAt = settings['disabled_at_utc'] ? Shamsi.toShamsi(settings['disabled_at_utc']) : null;
    const retentionUntil = settings['retention_until_utc'] ? Shamsi.toShamsi(settings['retention_until_utc']) : null;

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <button type="button" class="btn-secondary" style="font-size: 13px; padding: 6px 12px;" onclick="Router.navigate('services')">
            ← بازگشت به فهرست سرویس‌ها
          </button>
          <div>
            <h2 style="font-size: 19px; font-weight: 800; color: var(--text-main); margin-bottom: 2px;">پیکربندی اختصاصی: ${escapeHtml(sDef.title)}</h2>
            <div style="font-size: 13px; color: var(--text-muted);">${escapeHtml(sDef.desc)}</div>
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          ${isEn ? `
            <button type="button" class="btn-primary" style="font-size: 13px; padding: 6px 16px; background: #059669;" onclick="Router.navigate('${sDef.module}', 'dashboard')">
              ورود به داشبورد اختصاصی سرویس ↗
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Status Banner -->
      ${isEn ? `
        <div style="background: #ecfdf5; border: 1px solid #10b981; border-radius: var(--radius-sm); padding: 16px 20px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 24px; color: #059669;">✓</span>
            <div>
              <strong style="color: #065f46; font-size: 14.5px;">این سرویس هم‌اکنون برای این پروژه فعال است.</strong>
              <div style="color: #047857; font-size: 13px; margin-top: 2px;">
                کلیه فراخوانی‌های RESTful و اندپوینت‌های API این سرویس مجاز بوده و فعالانه در حال پاسخگویی می‌باشند.
              </div>
            </div>
          </div>
          <span class="badge badge-active" style="font-size: 13px; padding: 5px 12px;">وضعیت: فعال</span>
        </div>
      ` : `
        <div style="background: #fffbeb; border: 1px solid #f59e0b; border-radius: var(--radius-sm); padding: 16px 20px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 24px; color: #d97706;">⚠</span>
            <div>
              <strong style="color: #92400e; font-size: 14.5px;">این سرویس در حال حاضر برای این پروژه غیرفعال است.</strong>
              <div style="color: #b45309; font-size: 13px; margin-top: 2px;">
                دسترسی به APIهای این سرویس کاملاً مسدود بوده و با خطای ۴۰۳ (SERVICE_DISABLED) رد می‌شود. داده‌های قبلی تا ${retentionDays} روز محفوظ خواهند بود.
                ${retentionUntil ? `<strong style="margin-right: 6px;">(مهلت نگهداری تا: ${retentionUntil})</strong>` : ''}
              </div>
            </div>
          </div>
          <span class="badge badge-paused" style="font-size: 13px; padding: 5px 12px;">وضعیت: غیرفعال</span>
        </div>
      `}

      <!-- API Key & Service Secret Card -->
      <div class="card" style="margin-bottom: 20px;">
        <div class="card-header">
          <div>
            <div class="card-title">کلید اختصاصی دسترسی به سرویس (API Key)</div>
            <div class="card-desc">از این کلید در هدر Authorization یا X-LocalMe-Key درخواست‌های کلاینت به این سرویس استفاده نمایید.</div>
          </div>
          <button type="button" class="btn-secondary" style="font-size: 12.5px; padding: 4px 12px;" onclick="regenerateServiceKey('${sDef.key}')">
            صدور مجدد کلید
          </button>
        </div>
        <div style="display: flex; gap: 10px;">
          <input type="text" id="dedicated-cfg-api-key" class="input-field" value="${escapeHtml(apiKey)}" readonly style="font-family: monospace; font-size: 13.5px; direction: ltr;" />
          <button type="button" class="btn-secondary" style="font-size: 13px;" onclick="copyFieldValue('dedicated-cfg-api-key')">کپی کلید</button>
        </div>
      </div>

      <!-- Specific Service Parameters Form -->
      <div class="card" style="margin-bottom: 20px;">
        <div class="card-header">
          <div>
            <div class="card-title">پارامترها و پیکربندی عملیاتی سرویس</div>
            <div class="card-desc">تنظیم متغیرها و رفتارهای اختصاصی سرویس در سطح پروژه</div>
          </div>
        </div>

        <form id="dedicated-service-config-form" onsubmit="handleDedicatedConfigSubmit(event, '${sDef.key}')">
          <div id="dedicated-service-fields-container">
            ${renderServiceFields(sDef.key, settings)}
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border-color);">
            ${isEn ? `
              <button type="submit" class="btn-primary" style="font-size: 13.5px; padding: 7px 20px;">
                ذخیره تنظیمات سرویس
              </button>
            ` : `
              <button type="button" class="btn-primary" style="font-size: 13.5px; padding: 7px 24px; background: #059669;" onclick="enableDedicatedService('${sDef.key}')">
                ⚡ فعال‌سازی این سرویس
              </button>
            `}
          </div>
        </form>
      </div>

      <!-- Deactivation & Retention Notice Card -->
      ${isEn ? `
        <div class="card" style="border: 1px solid #fecaca; background: #fff5f5;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
            <div>
              <div style="font-size: 14.5px; font-weight: 800; color: #991b1b; display: flex; align-items: center; gap: 8px;">
                <span>غیرفعال‌سازی سرویس و سیاست نگهداری ۱۰ روزه داده‌ها</span>
              </div>
              <div style="font-size: 13px; color: #7f1d1d; margin-top: 4px; line-height: 1.6; max-width: 680px;">
                با کلیک بر روی دکمه زیر، دسترسی کلیه کلاینت‌ها و کاربران اپلیکیشن به APIهای این سرویس فوراً مسدود خواهد شد.
                مطابق استاندارد امنیت ابری لوکال‌می، کلیه رکوردهای دیتابیس، فایل‌ها و تنظیمات پروژه شما به مدت <strong>۱۰ روز کامل</strong> محفوظ مانده و حذف نمی‌شوند تا در صورت نیاز به راحتی قابل بازگشت باشند.
              </div>
            </div>
            <button type="button" class="btn-danger" style="font-size: 13px; padding: 8px 18px;" onclick="disableDedicatedService('${sDef.key}')">
              غیرفعال‌سازی این سرویس
            </button>
          </div>
        </div>
      ` : ''}
    `;
  }
  window.renderServiceConfigPage = renderServiceConfigPage;

  function renderServiceFields(key, settings) {
    switch (key) {
      case 'database':
        return `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
            <div>
              <label style="font-size: 13px; font-weight: 700; display: block; margin-bottom: 6px;">نام اسکیمای اختصاصی PostgreSQL</label>
              <input type="text" id="cfg-field-schema" class="input-field" value="${escapeHtml(settings['schema'] || `public_${window.activeProjectId}`)}" required />
              <span style="font-size: 11.5px; color: var(--text-muted); display: block; margin-top: 4px;">فضای نام ایزوله جداول و رکوردهای داده شما در پایگاه‌داده مرکزی.</span>
            </div>
            <div>
              <label style="font-size: 13px; font-weight: 700; display: block; margin-bottom: 6px;">حداکثر اتصالات همزمان (Max Connections)</label>
              <input type="number" id="cfg-field-max-conn" class="input-field" value="${escapeHtml(settings['max_connections'] || '20')}" required />
              <span style="font-size: 11.5px; color: var(--text-muted); display: block; margin-top: 4px;">سقف کانکشن‌های استخر اتصالات اختصاص‌یافته به پروژه.</span>
            </div>
          </div>
        `;
      case 'auth':
        return `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
            <div>
              <label style="font-size: 13px; font-weight: 700; display: block; margin-bottom: 6px;">درگاه پیش‌فرض ارسال پیامک OTP</label>
              <select id="cfg-field-sms-provider" class="input-field">
                <option value="kavenegar" ${settings['sms_provider'] === 'kavenegar' ? 'selected' : ''}>کاوانگار (Kavenegar)</option>
                <option value="melipayamak" ${settings['sms_provider'] === 'melipayamak' ? 'selected' : ''}>ملی‌پیامک (MeliPayamak)</option>
                <option value="magfa" ${settings['sms_provider'] === 'magfa' ? 'selected' : ''}>مگفا (Magfa)</option>
              </select>
            </div>
            <div>
              <label style="font-size: 13px; font-weight: 700; display: block; margin-bottom: 6px;">کلید وب‌سرویس پیامک (API Key اختصاصی)</label>
              <input type="text" id="cfg-field-sms-key" class="input-field" value="${escapeHtml(settings['sms_api_key'] || '')}" placeholder="اختیاری - در صورت خالی بودن از درگاه پلتفرم استفاده می‌شود" />
            </div>
            <div>
              <label style="font-size: 13px; font-weight: 700; display: block; margin-bottom: 6px;">شماره خط فرستنده پیامک</label>
              <input type="text" id="cfg-field-sms-num" class="input-field" value="${escapeHtml(settings['sms_sender_number'] || '3000777')}" />
            </div>
            <div>
              <label style="font-size: 13px; font-weight: 700; display: block; margin-bottom: 6px;">طول کد تایید پیامکی (OTP Length)</label>
              <input type="number" id="cfg-field-otp-len" class="input-field" value="${escapeHtml(settings['otp_length'] || '6')}" min="4" max="8" />
            </div>
          </div>
        `;
      case 'storage':
        return `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
            <div>
              <label style="font-size: 13px; font-weight: 700; display: block; margin-bottom: 6px;">سقف فضای ذخیره‌سازی ابری (مگابایت)</label>
              <input type="number" id="cfg-field-quota-mb" class="input-field" value="${escapeHtml(settings['quota_mb'] || '1024')}" required />
            </div>
            <div>
              <label style="font-size: 13px; font-weight: 700; display: block; margin-bottom: 6px;">حداکثر حجم مجاز هر فایل (مگابایت)</label>
              <input type="number" id="cfg-field-max-file" class="input-field" value="${escapeHtml(settings['max_file_size_mb'] || '50')}" required />
            </div>
            <div>
              <label style="font-size: 13px; font-weight: 700; display: block; margin-bottom: 6px;">دامنه‌های مجاز CORS</label>
              <input type="text" id="cfg-field-cors" class="input-field" value="${escapeHtml(settings['cors'] || '*')}" required />
            </div>
            <div>
              <label style="font-size: 13px; font-weight: 700; display: block; margin-bottom: 6px;">نام باکت عمومی پیش‌فرض</label>
              <input type="text" id="cfg-field-default-bucket" class="input-field" value="${escapeHtml(settings['default_bucket'] || 'assets')}" required />
            </div>
          </div>
        `;
      case 'functions':
        return `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
            <div>
              <label style="font-size: 13px; font-weight: 700; display: block; margin-bottom: 6px;">سقف حافظه رم تخصیصی به هر تابع (MB)</label>
              <input type="number" id="cfg-field-func-mem" class="input-field" value="${escapeHtml(settings['memory_limit_mb'] || '16')}" min="8" max="128" required />
            </div>
            <div>
              <label style="font-size: 13px; font-weight: 700; display: block; margin-bottom: 6px;">حداکثر زمان مجاز اجرای تابع (میلی‌ثانیه)</label>
              <input type="number" id="cfg-field-func-timeout" class="input-field" value="${escapeHtml(settings['timeout_seconds'] || '5000')}" min="500" max="30000" required />
            </div>
          </div>
        `;
      case 'ipg':
        return `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
            <div>
              <label style="font-size: 13px; font-weight: 700; display: block; margin-bottom: 6px;">درگاه پرداخت شاپرک فعال</label>
              <select id="cfg-field-ipg-psp" class="input-field">
                <option value="zarinpal" ${settings['psp'] === 'zarinpal' ? 'selected' : ''}>زرین‌پال (ZarinPal)</option>
                <option value="behpardakht" ${settings['psp'] === 'behpardakht' ? 'selected' : ''}>به‌پرداخت ملت (Mellat)</option>
                <option value="sep" ${settings['psp'] === 'sep' ? 'selected' : ''}>سامان کیش - سپ (SEP)</option>
                <option value="sadad" ${settings['psp'] === 'sadad' ? 'selected' : ''}>سداد بانک ملی (Sadad)</option>
              </select>
            </div>
            <div>
              <label style="font-size: 13px; font-weight: 700; display: block; margin-bottom: 6px;">کد پذیرنده / مرچنت آیدی (Merchant ID)</label>
              <input type="text" id="cfg-field-ipg-merchant" class="input-field" value="${escapeHtml(settings['merchant_id'] || 'test-merchant-localme')}" required />
            </div>
          </div>
        `;
      case 'mobile':
        return `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
            <div>
              <label style="font-size: 13px; font-weight: 700; display: block; margin-bottom: 6px;">درگاه پیش‌فرض ارسال پوش نوتیفیکیشن</label>
              <select id="cfg-field-mobile-push-provider" class="input-field">
                <option value="fcm" ${settings['default_provider'] === 'fcm' ? 'selected' : ''}>Firebase Cloud Messaging (FCM)</option>
                <option value="najva" ${settings['default_provider'] === 'najva' ? 'selected' : ''}>نجوا (Najva Push)</option>
                <option value="apns" ${settings['default_provider'] === 'apns' ? 'selected' : ''}>Apple APNs</option>
              </select>
            </div>
            <div>
              <label style="font-size: 13px; font-weight: 700; display: block; margin-bottom: 6px;">شناسه کلاینت کافه‌بازار (IAB Client ID)</label>
              <input type="text" id="cfg-field-mobile-bazaar-id" class="input-field" value="${escapeHtml(settings['bazaar_client_id'] || '')}" />
            </div>
          </div>
        `;
      case 'hosting':
        return `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
            <div>
              <label style="font-size: 13px; font-weight: 700; display: block; margin-bottom: 6px;">دامنه اختصاصی متصل به پروژه</label>
              <input type="text" id="cfg-field-hosting-domain" class="input-field" value="${escapeHtml(settings['custom_domain'] || '')}" placeholder="app.mydomain.ir" />
            </div>
            <div>
              <label style="font-size: 13px; font-weight: 700; display: block; margin-bottom: 6px;">سقف ترافیک ماهانه (گیگابایت)</label>
              <input type="number" id="cfg-field-hosting-bw" class="input-field" value="${escapeHtml(settings['max_bandwidth_gb'] || '100')}" />
            </div>
          </div>
        `;
      case 'compliance':
        return `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
            <div>
              <label style="font-size: 13px; font-weight: 700; display: block; margin-bottom: 6px;">کد اعتبارسنجی نماد اعتماد الکترونیکی (اینماد)</label>
              <input type="text" id="cfg-field-compliance-enamad" class="input-field" value="${escapeHtml(settings['enamad_token'] || '')}" />
            </div>
            <div>
              <label style="font-size: 13px; font-weight: 700; display: block; margin-bottom: 6px;">کد اعتبارسنجی ستاد ساماندهی</label>
              <input type="text" id="cfg-field-compliance-samandehi" class="input-field" value="${escapeHtml(settings['samandehi_token'] || '')}" />
            </div>
          </div>
        `;
      default:
        return `<p style="font-size: 13px; color: var(--text-muted);">پیکربندی استانداردی برای این سرویس تعریف نشده است.</p>`;
    }
  }

  window.handleDedicatedConfigSubmit = async function(e, serviceKey) {
    e.preventDefault();
    const settings = collectSettingsForService(serviceKey);
    await saveServiceConfig(serviceKey, true, settings);
    renderServiceConfigPage(serviceKey);
  };

  window.enableDedicatedService = async function(serviceKey) {
    const settings = collectSettingsForService(serviceKey);
    await saveServiceConfig(serviceKey, true, settings);
    renderServiceConfigPage(serviceKey);
  };

  window.disableDedicatedService = async function(serviceKey) {
    if (!confirm('آیا از غیرفعال‌سازی این سرویس اطمینان دارید؟ دسترسی کلاینت‌ها به API مسدود شده و داده‌های شما به مدت ۱۰ روز بدون تغییر در سرور نگهداری خواهند شد.')) {
      return;
    }
    await saveServiceConfig(serviceKey, false, {});
    renderServiceConfigPage(serviceKey);
  };

  function collectSettingsForService(key) {
    const s = {};
    switch (key) {
      case 'database':
        s['schema'] = (document.getElementById('cfg-field-schema')?.value || `public_${window.activeProjectId}`).trim();
        s['max_connections'] = document.getElementById('cfg-field-max-conn')?.value || '20';
        break;
      case 'auth':
        s['sms_provider'] = document.getElementById('cfg-field-sms-provider')?.value || 'kavenegar';
        s['sms_api_key'] = (document.getElementById('cfg-field-sms-key')?.value || '').trim();
        s['sms_sender_number'] = (document.getElementById('cfg-field-sms-num')?.value || '3000777').trim();
        s['otp_length'] = document.getElementById('cfg-field-otp-len')?.value || '6';
        break;
      case 'storage':
        s['quota_mb'] = document.getElementById('cfg-field-quota-mb')?.value || '1024';
        s['max_file_size_mb'] = document.getElementById('cfg-field-max-file')?.value || '50';
        s['cors'] = document.getElementById('cfg-field-cors')?.value || '*';
        s['default_bucket'] = (document.getElementById('cfg-field-default-bucket')?.value || 'assets').trim();
        break;
      case 'functions':
        s['memory_limit_mb'] = document.getElementById('cfg-field-func-mem')?.value || '16';
        s['timeout_seconds'] = document.getElementById('cfg-field-func-timeout')?.value || '5000';
        break;
      case 'ipg':
        s['psp'] = document.getElementById('cfg-field-ipg-psp')?.value || 'zarinpal';
        s['merchant_id'] = (document.getElementById('cfg-field-ipg-merchant')?.value || '').trim();
        break;
      case 'mobile':
        s['default_provider'] = document.getElementById('cfg-field-mobile-push-provider')?.value || 'fcm';
        s['bazaar_client_id'] = (document.getElementById('cfg-field-mobile-bazaar-id')?.value || '').trim();
        break;
      case 'hosting':
        s['custom_domain'] = (document.getElementById('cfg-field-hosting-domain')?.value || '').trim();
        s['max_bandwidth_gb'] = document.getElementById('cfg-field-hosting-bw')?.value || '100';
        break;
      case 'compliance':
        s['enamad_token'] = (document.getElementById('cfg-field-compliance-enamad')?.value || '').trim();
        s['samandehi_token'] = (document.getElementById('cfg-field-compliance-samandehi')?.value || '').trim();
        break;
    }
    return s;
  }

})();
