import { useState, useEffect, type FormEvent } from 'react';
import { 
  DollarSign, 
  Save, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Sliders,
  Radio,
  ShieldAlert,
  Network,
  Database,
  Cpu,
  Gift,
  Bell
} from 'lucide-react';
import { api } from '../../utils/apiClient';
import { formatToman, toPersianDigits } from '../../utils/persian';

export function PricingQuotasView() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Pricing & Billing Variables (IRR)
  const [dbQueryPer1kIrr, setDbQueryPer1kIrr] = useState<number>(100);
  const [storageGbMonthIrr, setStorageGbMonthIrr] = useState<number>(500);
  const [smsPerMessageIrr, setSmsPerMessageIrr] = useState<number>(800);
  const [computePer100msIrr, setComputePer100msIrr] = useState<number>(10);
  const [egressGbIrr, setEgressGbIrr] = useState<number>(2000);
  const [minWalletTopupIrr, setMinWalletTopupIrr] = useState<number>(100000);
  const [initialFreeCreditIrr, setInitialFreeCreditIrr] = useState<number>(5000000);

  // Quotas & Operational Limits
  const [sovereignEgressNat, setSovereignEgressNat] = useState<string>('2.180.12.94 (Static Domestic NAT Active)');
  const [pspEgressWhitelist, setPspEgressWhitelist] = useState<string>('2.180.12.94, 185.143.232.0/24');
  const [maxProjectsPerDeveloperTier, setMaxProjectsPerDeveloperTier] = useState<number>(1);
  const [maxTeamMembersPerDeveloperTier, setMaxTeamMembersPerDeveloperTier] = useState<number>(1);
  const [defaultStorageQuotaMb, setDefaultStorageQuotaMb] = useState<number>(1024);
  const [defaultMaxFileSizeMb, setDefaultMaxFileSizeMb] = useState<number>(50);
  const [defaultDbMaxConnections, setDefaultDbMaxConnections] = useState<number>(20);
  const [defaultFunctionsMemoryMb, setDefaultFunctionsMemoryMb] = useState<number>(16);
  const [defaultFunctionsTimeoutMs, setDefaultFunctionsTimeoutMs] = useState<number>(5000);

  // Operational & Maintenance
  const [systemBroadcastMessage, setSystemBroadcastMessage] = useState<string>('');
  const [maintenanceMode, setMaintenanceMode] = useState<boolean>(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState<string>('سامانه در حال به روزرسانی زیرساختی می باشد. لطفا دقایقی دیگر مراجعه فرمایید.');

  // Cluster Bus Manual Test State
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{ ok: boolean; latencyMs?: number; message?: string } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pricing, config] = await Promise.all([
        api.get('/_baas/v1/admin/pricing'),
        api.get('/_baas/v1/admin/config'),
      ]);

      if (pricing) {
        if (pricing.dbQueryPer1kIrr !== undefined) setDbQueryPer1kIrr(pricing.dbQueryPer1kIrr);
        if (pricing.storageGbMonthIrr !== undefined) setStorageGbMonthIrr(pricing.storageGbMonthIrr);
        if (pricing.smsPerMessageIrr !== undefined) setSmsPerMessageIrr(pricing.smsPerMessageIrr);
        if (pricing.computePer100msIrr !== undefined) setComputePer100msIrr(pricing.computePer100msIrr);
        if (pricing.egressGbIrr !== undefined) setEgressGbIrr(pricing.egressGbIrr);
        if (pricing.minWalletTopupIrr !== undefined) setMinWalletTopupIrr(pricing.minWalletTopupIrr);
        if (pricing.initialFreeCreditIrr !== undefined) setInitialFreeCreditIrr(pricing.initialFreeCreditIrr);
      }

      if (config) {
        if (config.sovereignEgressNat || config.egressNatIp) setSovereignEgressNat(config.sovereignEgressNat || config.egressNatIp);
        if (config.pspEgressWhitelist) setPspEgressWhitelist(config.pspEgressWhitelist);
        if (config.maxProjectsPerDeveloperTier !== undefined) setMaxProjectsPerDeveloperTier(config.maxProjectsPerDeveloperTier);
        if (config.maxTeamMembersPerDeveloperTier !== undefined) setMaxTeamMembersPerDeveloperTier(config.maxTeamMembersPerDeveloperTier);
        if (config.defaultStorageQuotaMb !== undefined) setDefaultStorageQuotaMb(config.defaultStorageQuotaMb);
        if (config.defaultMaxFileSizeMb !== undefined) setDefaultMaxFileSizeMb(config.defaultMaxFileSizeMb);
        if (config.defaultDbMaxConnections !== undefined) setDefaultDbMaxConnections(config.defaultDbMaxConnections);
        if (config.defaultFunctionsMemoryMb !== undefined) setDefaultFunctionsMemoryMb(config.defaultFunctionsMemoryMb);
        if (config.defaultFunctionsTimeoutMs !== undefined) setDefaultFunctionsTimeoutMs(config.defaultFunctionsTimeoutMs);
        if (config.systemBroadcastMessage !== undefined) setSystemBroadcastMessage(config.systemBroadcastMessage);
        if (typeof config.maintenanceMode === 'boolean') setMaintenanceMode(config.maintenanceMode);
        if (config.maintenanceMessage) setMaintenanceMessage(config.maintenanceMessage);
      }
    } catch (err) {
      console.error('Failed to load pricing/quotas', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      // 1. Update Pricing Catalog
      await api.put('/_baas/v1/admin/pricing', {
        dbQueryPer1kIrr: Number(dbQueryPer1kIrr),
        storageGbMonthIrr: Number(storageGbMonthIrr),
        smsPerMessageIrr: Number(smsPerMessageIrr),
        computePer100msIrr: Number(computePer100msIrr),
        egressGbIrr: Number(egressGbIrr),
        minWalletTopupIrr: Number(minWalletTopupIrr),
        initialFreeCreditIrr: Number(initialFreeCreditIrr),
        maintenanceMode,
      });

      // 2. Update In-DB Platform Config
      const existingConfig = await api.get('/_baas/v1/admin/config');
      await api.put('/_baas/v1/admin/config', {
        ...existingConfig,
        dbQueryPer1kIrr: Number(dbQueryPer1kIrr),
        storageGbMonthIrr: Number(storageGbMonthIrr),
        smsPerMessageIrr: Number(smsPerMessageIrr),
        computePer100msIrr: Number(computePer100msIrr),
        egressGbIrr: Number(egressGbIrr),
        minWalletTopupIrr: Number(minWalletTopupIrr),
        initialFreeCreditIrr: Number(initialFreeCreditIrr),
        sovereignEgressNat: sovereignEgressNat.trim(),
        pspEgressWhitelist: pspEgressWhitelist.trim(),
        maxProjectsPerDeveloperTier: Number(maxProjectsPerDeveloperTier),
        maxTeamMembersPerDeveloperTier: Number(maxTeamMembersPerDeveloperTier),
        defaultStorageQuotaMb: Number(defaultStorageQuotaMb),
        defaultMaxFileSizeMb: Number(defaultMaxFileSizeMb),
        defaultDbMaxConnections: Number(defaultDbMaxConnections),
        defaultFunctionsMemoryMb: Number(defaultFunctionsMemoryMb),
        defaultFunctionsTimeoutMs: Number(defaultFunctionsTimeoutMs),
        systemBroadcastMessage: systemBroadcastMessage.trim(),
        maintenanceMode,
        maintenanceMessage: maintenanceMessage.trim(),
      });

      setFeedback({
        type: 'success',
        message: 'تعرفه‌ها، سهمیه‌ها و متغیرهای عملیاتی با موفقیت در پایگاه‌داده ذخیره شد و در سراسر کلاستر منتشر گردید.',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'خطا در ذخیره تعرفه‌ها.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleBroadcastTest = async () => {
    setBroadcasting(true);
    setBroadcastResult(null);
    try {
      const res = await api.post('/_baas/v1/admin/cluster/broadcast', {
        tag: 'admin_test',
        action: 'ping',
      });
      setBroadcastResult({
        ok: res.success ?? true,
        latencyMs: res.latencyMs,
        message: res.message || 'پیام NOTIFY در کلاستر باس منتشر شد.',
      });
    } catch (err: any) {
      setBroadcastResult({
        ok: false,
        message: err.message || 'خطا در ارسال پیام به گذرگاه رویدادهای کلاستر.',
      });
    } finally {
      setBroadcasting(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">تعرفه‌ها، سهمیه‌ها و متغیرهای عملیاتی سرور</h2>
          </div>
          <p className="text-xs text-slate-500">
            کنترل بلادرنگ هزینه‌های پردازش ابری، ترافیک اینترنت ملی، سهمیه‌های پایه تننت‌ها، و حالت تعمیرات سراسری.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition disabled:opacity-50"
            title="بازخوانی داده‌ها"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : 'text-slate-400'}`} />
            <span>بازخوانی</span>
          </button>
          <button
            type="button"
            onClick={handleBroadcastTest}
            disabled={broadcasting}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition disabled:opacity-50 shadow-xs"
          >
            {broadcasting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Radio className="w-4 h-4 text-emerald-400" />
            )}
            <span>تست زنده کلاستر باس (NOTIFY)</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center gap-2.5 animate-in fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {broadcastResult && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between animate-in fade-in ${
            broadcastResult.ok
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {broadcastResult.ok ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{broadcastResult.message}</span>
          </div>
          {broadcastResult.latencyMs !== undefined && (
            <span className="font-mono font-bold text-xs shrink-0 mr-2" dir="ltr">
              {toPersianDigits(broadcastResult.latencyMs)} ms
            </span>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <RefreshCw className="w-6 h-6 animate-spin text-emerald-600 mb-2" />
          <span className="text-xs text-slate-500">در حال دریافت تعرفه‌ها و متغیرهای عملیاتی سرور...</span>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <form onSubmit={handleSave} className="space-y-6">
            
            {/* Pricing Section */}
            <div>
              <h3 className="text-xs font-bold text-slate-900 mb-3 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <span>تعرفه مصرف منابع بر مبنای ریال (Billing & Rates)</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Database className="w-3.5 h-3.5 text-slate-400" />
                    <span>پایگاه‌داده (به ازای هر ۱,۰۰۰ کوئری)</span>
                  </label>
                  <input
                    type="number"
                    value={dbQueryPer1kIrr}
                    onChange={(e) => setDbQueryPer1kIrr(Number(e.target.value))}
                    min={0}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    معادل {formatToman(dbQueryPer1kIrr)}
                  </span>
                </div>



                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Cpu className="w-3.5 h-3.5 text-slate-400" />
                    <span>اج فانکشن (به ازای هر ۱۰۰ میلی‌ثانیه پردازش)</span>
                  </label>
                  <input
                    type="number"
                    value={computePer100msIrr}
                    onChange={(e) => setComputePer100msIrr(Number(e.target.value))}
                    min={0}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    معادل {formatToman(computePer100msIrr)}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Network className="w-3.5 h-3.5 text-slate-400" />
                    <span>ترافیک خروجی سرور (هر گیگابایت Egress)</span>
                  </label>
                  <input
                    type="number"
                    value={egressGbIrr}
                    onChange={(e) => setEgressGbIrr(Number(e.target.value))}
                    min={0}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    معادل {formatToman(egressGbIrr)}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    حداقل مبلغ افزایش شارژ کیف پول (ریال)
                  </label>
                  <input
                    type="number"
                    value={minWalletTopupIrr}
                    onChange={(e) => setMinWalletTopupIrr(Number(e.target.value))}
                    min={10000}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    معادل {formatToman(minWalletTopupIrr)}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Gift className="w-3.5 h-3.5 text-slate-400" />
                    <span>اعتبار هدیه ثبت‌نام اولیه توسعه‌دهندگان (ریال)</span>
                  </label>
                  <input
                    type="number"
                    value={initialFreeCreditIrr}
                    onChange={(e) => setInitialFreeCreditIrr(Number(e.target.value))}
                    min={0}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    معادل {formatToman(initialFreeCreditIrr)}
                  </span>
                </div>
              </div>
            </div>

            {/* Quotas & System Limits Section */}
            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold text-slate-900 mb-3 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-emerald-600" />
                <span>سهمیه‌ها و محدودیت‌های توسعه‌دهنده و منابع</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    آدرس آی‌پی ثابت خروجی سرور (Sovereign Egress NAT)
                  </label>
                  <input
                    type="text"
                    value={sovereignEgressNat}
                    onChange={(e) => setSovereignEgressNat(e.target.value)}
                    dir="ltr"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    وایت‌لیست IPهای مجاز اتصال به شاپرک (PSP Egress Whitelist)
                  </label>
                  <input
                    type="text"
                    value={pspEgressWhitelist}
                    onChange={(e) => setPspEgressWhitelist(e.target.value)}
                    dir="ltr"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    حداکثر پروژه مجاز هر توسعه‌دهنده
                  </label>
                  <input
                    type="number"
                    value={maxProjectsPerDeveloperTier}
                    onChange={(e) => setMaxProjectsPerDeveloperTier(Number(e.target.value))}
                    min={1}
                    max={1000}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    حداکثر اعضای تیم مجاز در هر پروژه
                  </label>
                  <input
                    type="number"
                    value={maxTeamMembersPerDeveloperTier}
                    onChange={(e) => setMaxTeamMembersPerDeveloperTier(Number(e.target.value))}
                    min={1}
                    max={100}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>



                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    سقف کانکشن‌های پایگاه‌داده هر پروژه
                  </label>
                  <input
                    type="number"
                    value={defaultDbMaxConnections}
                    onChange={(e) => setDefaultDbMaxConnections(Number(e.target.value))}
                    min={5}
                    max={500}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    سقف حافظه رم مجاز اج فانکشن (MB)
                  </label>
                  <input
                    type="number"
                    value={defaultFunctionsMemoryMb}
                    onChange={(e) => setDefaultFunctionsMemoryMb(Number(e.target.value))}
                    min={8}
                    max={512}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    مهلت زمان اجرای اج فانکشن (میلی‌ثانیه)
                  </label>
                  <input
                    type="number"
                    value={defaultFunctionsTimeoutMs}
                    onChange={(e) => setDefaultFunctionsTimeoutMs(Number(e.target.value))}
                    min={500}
                    max={60000}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Broadcast & Operational Notices */}
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <h3 className="text-xs font-bold text-slate-900 mb-3 flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-emerald-600" />
                <span>پیام سراسری و اطلاعیه‌های سیستم (Platform Broadcast)</span>
              </h3>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  پیام اعلان سراسری برای تمام کاربران (نمایش در بالای داشبورد توسعه‌دهنده):
                </label>
                <input
                  type="text"
                  value={systemBroadcastMessage}
                  onChange={(e) => setSystemBroadcastMessage(e.target.value)}
                  placeholder="متن اعلان عمومی سامانه (در صورت خالی بودن اعلانی نمایش داده نمی‌شود)..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Maintenance Mode */}
              <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={maintenanceMode}
                    onChange={(e) => setMaintenanceMode(e.target.checked)}
                    className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
                  />
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    <span>فعال‌سازی وضعیت ارتقا و نگهداری کلان سرور (Maintenance Mode)</span>
                  </span>
                </label>

                {maintenanceMode && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      پیام نمایشی در زمان فعال بودن وضعیت تعمیرات:
                    </label>
                    <input
                      type="text"
                      value={maintenanceMessage}
                      onChange={(e) => setMaintenanceMessage(e.target.value)}
                      placeholder="سامانه در حال به روزرسانی زیرساختی می باشد..."
                      className="w-full px-3 py-2 rounded-xl bg-white border border-rose-300 text-xs text-slate-900 focus:outline-none focus:border-rose-500"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition disabled:opacity-50 shadow-xs"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'در حال ذخیره‌سازی...' : 'ذخیره تمامی تعرفه‌ها و اعمال در کل کلاستر'}</span>
              </button>
            </div>

          </form>
        </div>
      )}

    </div>
  );
}
