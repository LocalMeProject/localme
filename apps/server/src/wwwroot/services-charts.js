// LocalMe Sovereign BaaS — Dashboard SVG Charts & Infrastructure Health Mesh

function renderDashboardCharts() {
  const container = document.getElementById('overview-dashboard-charts');
  if (!container) return;

  const hours = ['۰۰:۰۰', '۰۴:۰۰', '۰۸:۰۰', '۱۲:۰۰', '۱۶:۰۰', '۲۰:۰۰', '۲۴:۰۰'];
  const pts = [
    { x: 20, y: 110, val: 240 },
    { x: 80, y: 95, val: 410 },
    { x: 140, y: 70, val: 780 },
    { x: 200, y: 35, val: 1420 },
    { x: 260, y: 55, val: 1050 },
    { x: 320, y: 75, val: 680 },
    { x: 380, y: 45, val: 1210 }
  ];
  const pathD = `M ${pts[0].x} ${pts[0].y} ` + pts.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
  const areaD = `${pathD} L ${pts[pts.length - 1].x} 140 L ${pts[0].x} 140 Z`;

  container.innerHTML = `
    <!-- Top Row: 24h Traffic Chart + Latency Percentiles -->
    <div class="dashboard-charts-grid">
      <!-- 24-Hour Traffic Throughput -->
      <div class="chart-card">
        <div class="chart-card-header">
          <div>
            <div class="chart-card-title">جریان ترافیک و درخواست‌های ۲۴ ساعت گذشته</div>
            <div class="chart-card-subtitle">توان عملیاتی بر حسب درخواست در دقیقه (Throughput RPM)</div>
          </div>
          <span class="badge badge-active" style="font-weight: 700;">اوکِی ۱,۴۲۰ req/m</span>
        </div>
        <div class="chart-svg-wrap">
          <svg viewBox="0 0 400 160" width="100%" height="100%" preserveAspectRatio="none">
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#10b981" stop-opacity="0.35"/>
                <stop offset="100%" stop-color="#10b981" stop-opacity="0.0"/>
              </linearGradient>
            </defs>
            <!-- Gridlines -->
            <line x1="20" y1="35" x2="380" y2="35" stroke="#e2e8f0" stroke-dasharray="3,3"/>
            <line x1="20" y1="75" x2="380" y2="75" stroke="#e2e8f0" stroke-dasharray="3,3"/>
            <line x1="20" y1="115" x2="380" y2="115" stroke="#e2e8f0" stroke-dasharray="3,3"/>
            <line x1="20" y1="140" x2="380" y2="140" stroke="#cbd5e1" stroke-width="1.5"/>
            <!-- Area & Line -->
            <path d="${areaD}" fill="url(#areaGradient)"/>
            <path d="${pathD}" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round"/>
            <!-- Dots -->
            ${pts.map(p => `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#ffffff" stroke="#059669" stroke-width="2"><title>${p.val} درخواست در دقیقه</title></circle>`).join('')}
            <!-- X Axis Labels -->
            ${pts.map((p, i) => `<text x="${p.x}" y="156" font-size="10.5" fill="#64748b" text-anchor="middle" font-family="Vazirmatn">${hours[i]}</text>`).join('')}
          </svg>
        </div>
      </div>

      <!-- Latency Distribution Percentiles -->
      <div class="chart-card">
        <div class="chart-card-header">
          <div>
            <div class="chart-card-title">توزیع تاخیر پاسخگویی (Latency Percentiles)</div>
            <div class="chart-card-subtitle">پایش SLA پلتفرم بر اساس صدک‌های واقعی شتاب و دیتابیس</div>
          </div>
          <span class="badge badge-active">SLA ۹۹.۹۸٪</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 14px; margin-top: 10px;">
          <!-- p50 -->
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; margin-bottom: 4px;">
              <span>صدک ۵۰ (میانه پاسخگویی دیتابیس و هسته):</span>
              <strong style="color: #059669;">۱۲ میلی‌ثانیه (عالی)</strong>
            </div>
            <div style="background: #e2e8f0; height: 10px; border-radius: 9999px; overflow: hidden;">
              <div style="background: #10b981; width: 14%; height: 100%; border-radius: 9999px;"></div>
            </div>
          </div>
          <!-- p95 -->
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; margin-bottom: 4px;">
              <span>صدک ۹۵ (توابع لبه و وب‌سرویس‌ها):</span>
              <strong style="color: #0284c7;">۳۸ میلی‌ثانیه (مطلوب)</strong>
            </div>
            <div style="background: #e2e8f0; height: 10px; border-radius: 9999px; overflow: hidden;">
              <div style="background: #0284c7; width: 38%; height: 100%; border-radius: 9999px;"></div>
            </div>
          </div>
          <!-- p99 -->
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; margin-bottom: 4px;">
              <span>صدک ۹۹ (تراکنش‌های شتابی و بارگذاری رسانه):</span>
              <strong style="color: #d97706;">۹۴ میلی‌ثانیه (زیر آستانه هشدار)</strong>
            </div>
            <div style="background: #e2e8f0; height: 10px; border-radius: 9999px; overflow: hidden;">
              <div style="background: #f59e0b; width: 68%; height: 100%; border-radius: 9999px;"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Second Row: Resource Gauges & Sovereign POP Status Grid -->
    <div class="dashboard-charts-grid">
      <!-- Storage & Compute Gauges -->
      <div class="chart-card">
        <div class="chart-card-header">
          <div>
            <div class="chart-card-title">شاخص‌های بار محاسباتی و منابع ابری اختصاصی</div>
            <div class="chart-card-subtitle">حافظه مقیم PostgreSQL، دیسک NVMe و محیط‌های ایزوله Jint</div>
          </div>
        </div>
        <div class="gauge-grid">
          <!-- Gauge 1: RAM Buffer -->
          <div class="gauge-item">
            <svg class="gauge-svg" viewBox="0 0 36 36">
              <path class="gauge-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <path class="gauge-bar" stroke="#10b981" stroke-dasharray="42, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <text x="18" y="21" font-size="8.5" font-weight="bold" fill="#0f172a" text-anchor="middle" transform="rotate(90 18 18)" font-family="Vazirmatn">۴۲٪</text>
            </svg>
            <div class="gauge-label">بافر رم دیتابیس</div>
            <div class="gauge-sub">۲۱۵MB / ۵۱۲MB</div>
          </div>
          <!-- Gauge 2: IOPS -->
          <div class="gauge-item">
            <svg class="gauge-svg" viewBox="0 0 36 36">
              <path class="gauge-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <path class="gauge-bar" stroke="#0284c7" stroke-dasharray="24, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <text x="18" y="21" font-size="8.5" font-weight="bold" fill="#0f172a" text-anchor="middle" transform="rotate(90 18 18)" font-family="Vazirmatn">۲۴٪</text>
            </svg>
            <div class="gauge-label">نرخ خواندن/نوشتن</div>
            <div class="gauge-sub">۱۸۵ / ۱,۰۰۰ IOPS</div>
          </div>
          <!-- Gauge 3: Workers -->
          <div class="gauge-item">
            <svg class="gauge-svg" viewBox="0 0 36 36">
              <path class="gauge-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <path class="gauge-bar" stroke="#8b5cf6" stroke-dasharray="20, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <text x="18" y="21" font-size="8.5" font-weight="bold" fill="#0f172a" text-anchor="middle" transform="rotate(90 18 18)" font-family="Vazirmatn">۲/۱۰</text>
            </svg>
            <div class="gauge-label">پردازش‌های لبه</div>
            <div class="gauge-sub">۲ ورکر فعال همزمان</div>
          </div>
        </div>
      </div>

      <!-- Sovereign Cloud Health & POP Status Grid -->
      <div class="chart-card">
        <div class="chart-card-header">
          <div>
            <div class="chart-card-title">وضعیت سلامت زیرساخت ابری ملی (Sovereign Cloud Mesh)</div>
            <div class="chart-card-subtitle">شبکه توزیع پاپ‌سایت‌های داخلی و درگاه‌های رسمی</div>
          </div>
        </div>
        <div class="uptime-grid">
          <div class="uptime-item">
            <span><span class="uptime-dot"></span>پایگاه داده PostgreSQL</span>
            <span style="color: #059669; font-weight: 700; font-size: 12px;">آسیاتک برج میلاد</span>
          </div>
          <div class="uptime-item">
            <span><span class="uptime-dot"></span>احراز هویت پیامکی Kavenegar</span>
            <span style="color: #059669; font-weight: 700; font-size: 12px;">خط ۳۰۰۰۷۷۷</span>
          </div>
          <div class="uptime-item">
            <span><span class="uptime-dot"></span>درگاه شاپرک Shetab Ledger</span>
            <span style="color: #059669; font-weight: 700; font-size: 12px;">زیرساخت زرین‌پال</span>
          </div>
          <div class="uptime-item">
            <span><span class="uptime-dot"></span>موتور اسکریپت Jint Edge</span>
            <span style="color: #059669; font-weight: 700; font-size: 12px;">افرانت بهشتی</span>
          </div>
          <div class="uptime-item">
            <span><span class="uptime-dot"></span>سرور پوش نوتیفیکیشن Push</span>
            <span style="color: #059669; font-weight: 700; font-size: 12px;">FCM / نجوا</span>
          </div>
          <div class="uptime-item">
            <span><span class="uptime-dot"></span>تایید خرید بازار و مایکت IAP</span>
            <span style="color: #059669; font-weight: 700; font-size: 12px;">OAuth API v2</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

window.renderDashboardCharts = renderDashboardCharts;
