// =====================================================================
// LocalMe BaaS - Dedicated Service Dashboards Engine
// =====================================================================

(function() {
  const SERVICES_LIST = window.SERVICES_LIST || [];

  // 4. Render Dedicated Service Dashboards
  function renderServiceDashboard(module) {
    if (!window.activeProject) return;
    const project = window.activeProject;
    const sDef = SERVICES_LIST.find(s => s.module === module);
    if (!sDef) return;

    const cfg = project.services?.[sDef.key] || { isEnabled: false, settings: {} };
    const container = document.getElementById(`view-${module}-dashboard`);
    if (!container) return;

    const isEn = cfg.isEnabled;
    const key = sDef.key;

    container.innerHTML = `
      <div class="card" style="margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px;">
          <div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(16, 185, 129, 0.1); display: flex; align-items: center; justify-content: center; color: #059669;">
                ${sDef.icon}
              </div>
              <h2 style="font-size: 19px; font-weight: 800; color: var(--text-main); margin: 0;">داشبورد اختصاصی: ${escapeHtml(sDef.title)}</h2>
              <span class="badge ${isEn ? 'badge-active' : 'badge-paused'}">${isEn ? 'سرویس فعال' : 'سرویس غیرفعال'}</span>
            </div>
            <p style="font-size: 13.5px; color: var(--text-muted); margin-top: 6px;">
              ${escapeHtml(sDef.desc)}
            </p>
          </div>
          <div style="display: flex; gap: 8px;">
            <button type="button" class="btn-secondary" style="font-size: 13px; padding: 5px 14px;" onclick="Router.navigate('service', '${key}')">
              تنظیمات و پیکربندی سرویس ⚙
            </button>
          </div>
        </div>
      </div>

      <!-- Service KPI Metric Tiles -->
      <div class="metrics-row" style="margin-bottom: 24px;">
        ${getDashboardMetricTiles(module, cfg)}
      </div>

      <!-- Quick Actions Grid -->
      <div class="card" style="margin-bottom: 20px;">
        <div class="card-header">
          <div>
            <div class="card-title">ابزارها و قابلیت‌های اختصاصی سرویس</div>
            <div class="card-desc">دسترسی سریع به زیربخش‌ها و قابلیت‌های این سرویس ابری</div>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px;">
          ${getDashboardQuickActions(module, key)}
        </div>
      </div>
    `;
  }
  window.renderServiceDashboard = renderServiceDashboard;

  function getDashboardMetricTiles(module, cfg) {
    const s = cfg.settings || {};
    switch (module) {
      case 'db':
        const tblCount = (window.cachedProjectTables || []).length;
        return `
          <div class="metric-cell">
            <div class="metric-cell-label">تعداد جداول داده</div>
            <div class="metric-cell-val">${Shamsi.toPersianDigits(tblCount)}</div>
            <div class="metric-cell-sub">در اسکیمای ${escapeHtml(s['schema'] || 'اختصاصی')}</div>
          </div>
          <div class="metric-cell">
            <div class="metric-cell-label">اتصالات فعال استخر</div>
            <div class="metric-cell-val">۱ / ${Shamsi.toPersianDigits(s['max_connections'] || '20')}</div>
            <div class="metric-cell-sub">استخر اتصالات Npgsql</div>
          </div>
          <div class="metric-cell">
            <div class="metric-cell-label">پروتکل دسترسی</div>
            <div class="metric-cell-val" style="font-size: 16px; font-weight: 700;">PostgREST + SQL</div>
            <div class="metric-cell-sub">امنیت سطح ردیف (RLS)</div>
          </div>
          <div class="metric-cell">
            <div class="metric-cell-label">وضعیت سلامت دیتابیس</div>
            <div class="metric-cell-val" style="color: #059669; font-size: 16px; font-weight: 700;">آماده و عملیاتی</div>
            <div class="metric-cell-sub">تاخیر میانگین: ۱.۲ms</div>
          </div>
        `;
      case 'auth':
        const userCount = (window.cachedProjectUsers || []).length;
        return `
          <div class="metric-cell">
            <div class="metric-cell-label">کل کاربران ثبت‌نام شده</div>
            <div class="metric-cell-val">${Shamsi.toPersianDigits(userCount)}</div>
            <div class="metric-cell-sub">کاربران احرازشده اپلیکیشن</div>
          </div>
          <div class="metric-cell">
            <div class="metric-cell-label">درگاه پیامک OTP</div>
            <div class="metric-cell-val" style="font-size: 16px; font-weight: 700;">${escapeHtml(s['sms_provider'] || 'کاوانگار')}</div>
            <div class="metric-cell-sub">خط فرستنده: ${escapeHtml(s['sms_sender_number'] || '3000777')}</div>
          </div>
          <div class="metric-cell">
            <div class="metric-cell-label">مدت اعتبار نشست JWT</div>
            <div class="metric-cell-val">${Shamsi.toPersianDigits(s['jwt_expiry_hours'] || '72')} ساعت</div>
            <div class="metric-cell-sub">امضای امن HMAC-SHA256</div>
          </div>
          <div class="metric-cell">
            <div class="metric-cell-label">محافظت ضد ربات (کپچا)</div>
            <div class="metric-cell-val" style="color: #059669; font-size: 16px; font-weight: 700;">فعال (SVG داخلی)</div>
            <div class="metric-cell-sub">بدون وابستگی خارجی</div>
          </div>
        `;
      case 'storage':
        const bCount = (window.cachedProjectBuckets || []).length;
        return `
          <div class="metric-cell">
            <div class="metric-cell-label">تعداد باکت‌های ابری</div>
            <div class="metric-cell-val">${Shamsi.toPersianDigits(bCount)}</div>
            <div class="metric-cell-sub">باکت‌های رسانه و فایل</div>
          </div>
          <div class="metric-cell">
            <div class="metric-cell-label">سقف حجم فایل آپلود</div>
            <div class="metric-cell-val">${Shamsi.toPersianDigits(s['max_file_size_mb'] || '50')} MB</div>
            <div class="metric-cell-sub">بررسی اندازه چندبخشی</div>
          </div>
          <div class="metric-cell">
            <div class="metric-cell-label">سقف فضای دیسک</div>
            <div class="metric-cell-val">${Shamsi.toPersianDigits(s['quota_mb'] || '1024')} MB</div>
            <div class="metric-cell-sub">فضای ابری اختصاصی</div>
          </div>
          <div class="metric-cell">
            <div class="metric-cell-label">سیاست CORS</div>
            <div class="metric-cell-val" style="font-size: 16px; font-weight: 700;">${escapeHtml(s['cors'] || '*')}</div>
            <div class="metric-cell-sub">دسترسی امن مرورگر</div>
          </div>
        `;
      case 'functions':
        const fCount = Object.keys(window.projectFunctionsMap || {}).length;
        return `
          <div class="metric-cell">
            <div class="metric-cell-label">توابع مستقر سرورلس</div>
            <div class="metric-cell-val">${Shamsi.toPersianDigits(fCount)}</div>
            <div class="metric-cell-sub">کدهای جاوااسکریپت لبه</div>
          </div>
          <div class="metric-cell">
            <div class="metric-cell-label">محیط ایزوله اجرا</div>
            <div class="metric-cell-val" style="font-size: 16px; font-weight: 700;">Jint V8 Engine</div>
            <div class="metric-cell-sub">ایزولاسیون کامل حافظه</div>
          </div>
          <div class="metric-cell">
            <div class="metric-cell-label">سقف حافظه رم تخصیصی</div>
            <div class="metric-cell-val">${Shamsi.toPersianDigits(s['memory_limit_mb'] || '16')} MB</div>
            <div class="metric-cell-sub">محدودکننده مصرف منابع</div>
          </div>
          <div class="metric-cell">
            <div class="metric-cell-label">سقف زمان اجرا (Timeout)</div>
            <div class="metric-cell-val">${Shamsi.toPersianDigits(s['timeout_seconds'] || '5000')} ms</div>
            <div class="metric-cell-sub">جلوگیری از حلقه بی‌نهایت</div>
          </div>
        `;
      case 'ipg':
        return `
          <div class="metric-cell">
            <div class="metric-cell-label">درگاه شاپرک متصل</div>
            <div class="metric-cell-val" style="font-size: 16px; font-weight: 700;">${escapeHtml((s['psp'] || 'زرین‌پال').toUpperCase())}</div>
            <div class="metric-cell-sub">اتصال به شبکه شتاب</div>
          </div>
          <div class="metric-cell">
            <div class="metric-cell-label">وضعیت نماد اعتماد</div>
            <div class="metric-cell-val" style="color: #059669; font-size: 16px; font-weight: 700;">احراز هویت شده</div>
            <div class="metric-cell-sub">سازگار با الزامات شاپرک</div>
          </div>
          <div class="metric-cell">
            <div class="metric-cell-label">شبیه‌ساز پرداخت آنلاین</div>
            <div class="metric-cell-val" style="color: #0369a1; font-size: 16px; font-weight: 700;">فعال (حالت آزمایشی)</div>
            <div class="metric-cell-sub">شبیه‌سازی کارت و رمز دوم</div>
          </div>
          <div class="metric-cell">
            <div class="metric-cell-label">تسویه حساب شتابی</div>
            <div class="metric-cell-val" style="font-size: 16px; font-weight: 700;">شاپرک پایا / ساتنا</div>
            <div class="metric-cell-sub">چرخه‌های تسویه منظم</div>
          </div>
        `;
      case 'mobile':
        return `
          <div class="metric-cell">
            <div class="metric-cell-label">درگاه اعلان پوش</div>
            <div class="metric-cell-val" style="font-size: 16px; font-weight: 700;">${escapeHtml((s['default_provider'] || 'FCM').toUpperCase())}</div>
            <div class="metric-cell-sub">پوش مستقیم ایرانی و خارجی</div>
          </div>
          <div class="metric-cell">
            <div class="metric-cell-label">جریان داده زنده (WebSocket)</div>
            <div class="metric-cell-val" style="color: #059669; font-size: 16px; font-weight: 700;">آماده اتصال</div>
            <div class="metric-cell-sub">بدون مصرف باتری گوشی</div>
          </div>
          <div class="metric-cell">
            <div class="metric-cell-label">خرید کافه‌بازار و مایکت</div>
            <div class="metric-cell-val" style="font-size: 16px; font-weight: 700;">اعتبارسنجی IAB</div>
            <div class="metric-cell-sub">جلوگیری از کلاهبرداری و جعل</div>
          </div>
          <div class="metric-cell">
            <div class="metric-cell-label">پشتیبانی پلتفرم</div>
            <div class="metric-cell-val" style="font-size: 16px; font-weight: 700;">Android / iOS</div>
            <div class="metric-cell-sub">فلاتر، ری‌اکت نیتیو، کاتلین</div>
          </div>
        `;
      case 'hosting':
        return `
          <div class="metric-cell">
            <div class="metric-cell-label">دامنه متصل</div>
            <div class="metric-cell-val" style="font-size: 15px; font-weight: 700;">${escapeHtml(s['custom_domain'] || 'دامنه پیش‌فرض لوکال‌می')}</div>
            <div class="metric-cell-sub">مسیریابی هوشمند لبه</div>
          </div>
          <div class="metric-cell">
            <div class="metric-cell-label">گواهی امنیتی SSL</div>
            <div class="metric-cell-val" style="color: #059669; font-size: 16px; font-weight: 700;">فعال (Let's Encrypt)</div>
            <div class="metric-cell-sub">تمدید خودکار ۹۰ روزه</div>
          </div>
          <div class="metric-cell">
            <div class="metric-cell-label">حالت SPA Fallback</div>
            <div class="metric-cell-val" style="font-size: 16px; font-weight: 700;">فعال (index.html)</div>
            <div class="metric-cell-sub">سازگار با React، Vue، Next</div>
          </div>
          <div class="metric-cell">
            <div class="metric-cell-label">ترافیک ماهانه مجاز</div>
            <div class="metric-cell-val">${Shamsi.toPersianDigits(s['max_bandwidth_gb'] || '100')} GB</div>
            <div class="metric-cell-sub">شبکه ملی اطلاعات (نیم‌بها)</div>
          </div>
        `;
      case 'compliance':
        return `
          <div class="metric-cell">
            <div class="metric-cell-label">تاییدیه نماد الکترونیکی</div>
            <div class="metric-cell-val" style="font-size: 16px; font-weight: 700;">اینماد شاپرکی</div>
            <div class="metric-cell-sub">انطباق با ماده ۳۳ تجارت الکترونیک</div>
          </div>
          <div class="metric-cell">
            <div class="metric-cell-label">ستاد ساماندهی</div>
            <div class="metric-cell-val" style="font-size: 16px; font-weight: 700;">پایگاه داده ثبت‌شده</div>
            <div class="metric-cell-sub">احراز مالکیت دامنه</div>
          </div>
          <div class="metric-cell">
            <div class="metric-cell-label">دیپ‌لینک اپلیکیشن موبایل</div>
            <div class="metric-cell-val" style="color: #059669; font-size: 16px; font-weight: 700;">فعال و تاییدشده</div>
            <div class="metric-cell-sub">بازگشت از درگاه به اپلیکیشن</div>
          </div>
          <div class="metric-cell">
            <div class="metric-cell-label">امنیت داده و سرور</div>
            <div class="metric-cell-val" style="color: #059669; font-size: 16px; font-weight: 700;">مرکز داده میلاد تهران</div>
            <div class="metric-cell-sub">IP ایستا: 2.180.12.94</div>
          </div>
        `;
      default:
        return '';
    }
  }

  function getDashboardQuickActions(mod, key) {
    switch (mod) {
      case 'db':
        return `
          <button type="button" class="btn-secondary" style="justify-content: flex-start; padding: 12px 14px; text-align: right;" onclick="Router.navigate('db', 'tables')">
            <div>
              <strong style="font-size: 13.5px; display: block;">جداول و رکوردهای داده</strong>
              <span style="font-size: 12px; color: var(--text-muted);">مشاهده، فیلتر و درج مستقیم داده‌ها</span>
            </div>
          </button>
          <button type="button" class="btn-secondary" style="justify-content: flex-start; padding: 12px 14px; text-align: right;" onclick="Router.navigate('db', 'sqleditor')">
            <div>
              <strong style="font-size: 13.5px; display: block;">ویرایشگر تعاملی SQL</strong>
              <span style="font-size: 12px; color: var(--text-muted);">اجرای مستقیم کوئری‌های خام PostgreSQL</span>
            </div>
          </button>
          <button type="button" class="btn-secondary" style="justify-content: flex-start; padding: 12px 14px; text-align: right;" onclick="Router.navigate('db', 'schema')">
            <div>
              <strong style="font-size: 13.5px; display: block;">ساختار اسکیمای پایگاه‌داده</strong>
              <span style="font-size: 12px; color: var(--text-muted);">مشاهده فیلدها و انواع داده‌ای جداول</span>
            </div>
          </button>
          <button type="button" class="btn-secondary" style="justify-content: flex-start; padding: 12px 14px; text-align: right;" onclick="Router.navigate('db', 'backups')">
            <div>
              <strong style="font-size: 13.5px; display: block;">پشتیبان‌گیری و بازیابی</strong>
              <span style="font-size: 12px; color: var(--text-muted);">ایجاد اسنپ‌شات و بکاپ از داده‌های پروژه</span>
            </div>
          </button>
        `;
      case 'auth':
        return `
          <button type="button" class="btn-secondary" style="justify-content: flex-start; padding: 12px 14px; text-align: right;" onclick="Router.navigate('auth', 'users')">
            <div>
              <strong style="font-size: 13.5px; display: block;">مدیریت کاربران اپلیکیشن</strong>
              <span style="font-size: 12px; color: var(--text-muted);">افزودن، غیرفعال‌سازی و تغییر کلمه عبور</span>
            </div>
          </button>
          <button type="button" class="btn-secondary" style="justify-content: flex-start; padding: 12px 14px; text-align: right;" onclick="Router.navigate('auth', 'sms-logs')">
            <div>
              <strong style="font-size: 13.5px; display: block;">گزارش پیامک‌های ارسالی</strong>
              <span style="font-size: 12px; color: var(--text-muted);">تحلیل وضعیت تحویل کدهای OTP</span>
            </div>
          </button>
          <button type="button" class="btn-secondary" style="justify-content: flex-start; padding: 12px 14px; text-align: right;" onclick="Router.navigate('auth', 'policies')">
            <div>
              <strong style="font-size: 13.5px; display: block;">سیاست‌های امنیتی و نشست‌ها</strong>
              <span style="font-size: 12px; color: var(--text-muted);">تنظیمات JWT، زمان انقضا و روش‌های ورود</span>
            </div>
          </button>
        `;
      case 'storage':
        return `
          <button type="button" class="btn-secondary" style="justify-content: flex-start; padding: 12px 14px; text-align: right;" onclick="Router.navigate('storage', 'buckets')">
            <div>
              <strong style="font-size: 13.5px; display: block;">باکت‌های ذخیره‌سازی ابری</strong>
              <span style="font-size: 12px; color: var(--text-muted);">ایجاد باکت عمومی/خصوصی جدید</span>
            </div>
          </button>
          <button type="button" class="btn-secondary" style="justify-content: flex-start; padding: 12px 14px; text-align: right;" onclick="Router.navigate('storage', 'explorer')">
            <div>
              <strong style="font-size: 13.5px; display: block;">کاوشگر فایل‌ها و مدیا</strong>
              <span style="font-size: 12px; color: var(--text-muted);">آپلود، دانلود و مدیریت تصاویر و مستندات</span>
            </div>
          </button>
          <button type="button" class="btn-secondary" style="justify-content: flex-start; padding: 12px 14px; text-align: right;" onclick="Router.navigate('storage', 'policies')">
            <div>
              <strong style="font-size: 13.5px; display: block;">سطوح دسترسی و کشینگ CDN</strong>
              <span style="font-size: 12px; color: var(--text-muted);">تنظیمات انقضای کش و دسترسی مستقیم</span>
            </div>
          </button>
        `;
      case 'functions':
        return `
          <button type="button" class="btn-secondary" style="justify-content: flex-start; padding: 12px 14px; text-align: right;" onclick="Router.navigate('functions', 'editor')">
            <div>
              <strong style="font-size: 13.5px; display: block;">ویرایشگر توابع لبه</strong>
              <span style="font-size: 12px; color: var(--text-muted);">کدنویسی جاوااسکریپت، تست و استقرار آنی</span>
            </div>
          </button>
          <button type="button" class="btn-secondary" style="justify-content: flex-start; padding: 12px 14px; text-align: right;" onclick="Router.navigate('functions', 'traces')">
            <div>
              <strong style="font-size: 13.5px; display: block;">مانیتورینگ زمان اجرا و حافظه</strong>
              <span style="font-size: 12px; color: var(--text-muted);">بررسی لاگ‌های خروجی و مدت زمان اجرا</span>
            </div>
          </button>
          <button type="button" class="btn-secondary" style="justify-content: flex-start; padding: 12px 14px; text-align: right;" onclick="Router.navigate('functions', 'env')">
            <div>
              <strong style="font-size: 13.5px; display: block;">متغیرهای محیطی و اسرار</strong>
              <span style="font-size: 12px; color: var(--text-muted);">کلیدهای وب‌هوک و مقادیر محرمانه توابع</span>
            </div>
          </button>
        `;
      case 'ipg':
        return `
          <button type="button" class="btn-secondary" style="justify-content: flex-start; padding: 12px 14px; text-align: right;" onclick="Router.navigate('ipg', 'config')">
            <div>
              <strong style="font-size: 13.5px; display: block;">پیکربندی درگاه شاپرک</strong>
              <span style="font-size: 12px; color: var(--text-muted);">ثبت ترمینال کد، مرچنت آیدی و کلیدهای متقارن</span>
            </div>
          </button>
          <button type="button" class="btn-secondary" style="justify-content: flex-start; padding: 12px 14px; text-align: right;" onclick="Router.navigate('ipg', 'ledger')">
            <div>
              <strong style="font-size: 13.5px; display: block;">دفترکل تراکنش‌ها و اسناد</strong>
              <span style="font-size: 12px; color: var(--text-muted);">تراکنش‌های موفق، ناموفق و کد پیگیری شتاب</span>
            </div>
          </button>
          <button type="button" class="btn-secondary" style="justify-content: flex-start; padding: 12px 14px; text-align: right;" onclick="Router.navigate('ipg', 'simulator')">
            <div>
              <strong style="font-size: 13.5px; display: block;">شبیه‌ساز پرداخت شاپرک</strong>
              <span style="font-size: 12px; color: var(--text-muted);">تست پرداخت موفق و ناموفق بدون تراکنش واقعی</span>
            </div>
          </button>
          <button type="button" class="btn-secondary" style="justify-content: flex-start; padding: 12px 14px; text-align: right;" onclick="Router.navigate('ipg', 'reports')">
            <div>
              <strong style="font-size: 13.5px; display: block;">گزارش‌های تحلیلی و مالی</strong>
              <span style="font-size: 12px; color: var(--text-muted);">نمودارهای فروش روزانه، ماهانه و کارمزد</span>
            </div>
          </button>
        `;
      case 'mobile':
        return `
          <button type="button" class="btn-secondary" style="justify-content: flex-start; padding: 12px 14px; text-align: right;" onclick="Router.navigate('mobile', 'push')">
            <div>
              <strong style="font-size: 13.5px; display: block;">سامانه اعلان (Push Notification)</strong>
              <span style="font-size: 12px; color: var(--text-muted);">ارسال پیام‌های متنی و تصویردار به گوشی کاربران</span>
            </div>
          </button>
          <button type="button" class="btn-secondary" style="justify-content: flex-start; padding: 12px 14px; text-align: right;" onclick="Router.navigate('mobile', 'iap')">
            <div>
              <strong style="font-size: 13.5px; display: block;">خرید درون‌برنامه‌ای بازار و مایکت</strong>
              <span style="font-size: 12px; color: var(--text-muted);">اعتبارسنجی سروری رسیدهای کافه‌بازار و مایکت</span>
            </div>
          </button>
          <button type="button" class="btn-secondary" style="justify-content: flex-start; padding: 12px 14px; text-align: right;" onclick="Router.navigate('mobile', 'realtime')">
            <div>
              <strong style="font-size: 13.5px; display: block;">جریان داده زنده (Realtime Stream)</strong>
              <span style="font-size: 12px; color: var(--text-muted);">کانکشن وب‌سوکت دوطرفه برای تغییرات جداول</span>
            </div>
          </button>
        `;
      case 'hosting':
        return `
          <button type="button" class="btn-secondary" style="justify-content: flex-start; padding: 12px 14px; text-align: right;" onclick="Router.navigate('hosting', 'deployments')">
            <div>
              <strong style="font-size: 13.5px; display: block;">استقرارها و نسخه‌ها</strong>
              <span style="font-size: 12px; color: var(--text-muted);">مشاهده نسخه‌های فعال و تاریخچه بیلدها</span>
            </div>
          </button>
          <button type="button" class="btn-secondary" style="justify-content: flex-start; padding: 12px 14px; text-align: right;" onclick="Router.navigate('hosting', 'domains')">
            <div>
              <strong style="font-size: 13.5px; display: block;">دامنه‌ها و گواهی SSL</strong>
              <span style="font-size: 12px; color: var(--text-muted);">اتصال دامنه جدید و اعتبارسنجی DNS</span>
            </div>
          </button>
        `;
      case 'compliance':
        return `
          <button type="button" class="btn-secondary" style="justify-content: flex-start; padding: 12px 14px; text-align: right;" onclick="Router.navigate('compliance', 'tokens')">
            <div>
              <strong style="font-size: 13.5px; display: block;">نمادهای قانونی (اینماد و ساماندهی)</strong>
              <span style="font-size: 12px; color: var(--text-muted);">ثبت کد تاییدیه و دریافت لوگوی تاییدشده</span>
            </div>
          </button>
          <button type="button" class="btn-secondary" style="justify-content: flex-start; padding: 12px 14px; text-align: right;" onclick="Router.navigate('compliance', 'deeplinks')">
            <div>
              <strong style="font-size: 13.5px; display: block;">دیپ‌لینک اپلیکیشن موبایل</strong>
              <span style="font-size: 12px; color: var(--text-muted);">پیکربندی بازگشت خودکار تراکنش‌ها به اپ</span>
            </div>
          </button>
        `;
      default:
        return '';
    }
  }
})();

