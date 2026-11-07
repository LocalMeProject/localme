import { useState, useEffect, type FormEvent } from 'react';
import { 
  DollarSign, 
  Save, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Sliders,
  Radio,
  ShieldAlert
} from 'lucide-react';
import { api } from '../../utils/apiClient';
import { formatToman, toPersianDigits } from '../../utils/persian';

export function PricingQuotasView() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Pricing Fields
  const [baseFee, setBaseFee] = useState(0);
  const [storageGb, setStorageGb] = useState(50000);
  const [dbRows, setDbRows] = useState(10000);
  const [edgeCalls, setEdgeCalls] = useState(2500);
  const [authUsers, setAuthUsers] = useState(15000);
  const [minTopup, setMinTopup] = useState(100000);

  // Quotas & System Config
  const [egressIp, setEgressIp] = useState('');
  const [maxProjectsPerUser, setMaxProjectsPerUser] = useState(10);
  const [storageQuotaMb, setStorageQuotaMb] = useState(1024);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('سامانه در حال ارتقا و نگهداری دوره‌ای است. لطفا شکیبا باشید.');

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
        setBaseFee(pricing.baseMonthlyFeeIrr ?? 0);
        setStorageGb(pricing.storagePricePerGbMonthIrr ?? 50000);
        setDbRows(pricing.databasePricePer1000RowsMonthIrr ?? 10000);
        setEdgeCalls(pricing.edgeFunctionPricePer10kCallsIrr ?? 2500);
        setAuthUsers(pricing.authPricePer1kMonthlyActiveUsersIrr ?? 15000);
        setMinTopup(pricing.minWalletTopupIrr ?? 100000);
      }

      if (config) {
        if (config.egressNatIp) setEgressIp(config.egressNatIp);
        if (config.defaultMaxProjectsPerUser) setMaxProjectsPerUser(config.defaultMaxProjectsPerUser);
        if (config.defaultStorageQuotaMb) setStorageQuotaMb(config.defaultStorageQuotaMb);
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
        baseMonthlyFeeIrr: Number(baseFee),
        storagePricePerGbMonthIrr: Number(storageGb),
        databasePricePer1000RowsMonthIrr: Number(dbRows),
        edgeFunctionPricePer10kCallsIrr: Number(edgeCalls),
        authPricePer1kMonthlyActiveUsersIrr: Number(authUsers),
        minWalletTopupIrr: Number(minTopup),
      });

      // 2. Update In-DB Platform Config
      const existingConfig = await api.get('/_baas/v1/admin/config');
      await api.put('/_baas/v1/admin/config', {
        ...existingConfig,
        egressNatIp: egressIp.trim(),
        defaultMaxProjectsPerUser: Number(maxProjectsPerUser),
        defaultStorageQuotaMb: Number(storageQuotaMb),
        maintenanceMode,
        maintenanceMessage: maintenanceMessage.trim(),
        minWalletTopupIrr: Number(minTopup),
      });

      setFeedback({
        type: 'success',
        message: 'تعرفه‌ها و سهمیه‌های پایه با موفقیت در پایگاه‌داده ذخیره شد و در سراسر کلاستر منتشر گردید.',
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
            <h2 className="text-base font-bold text-slate-900">تعرفه‌ها، سهمیه‌ها و پیکربندی عملیاتی سرور</h2>
          </div>
          <p className="text-xs text-slate-500">
            تنظیم قیمت مصرف منابع (دیتابیس، استوریج، توابع، احراز هویت)، سهمیه کاربر، و پیام اضطراری کلاستر.
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
            onClick={handleBroadcastTest}
            disabled={broadcasting}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition disabled:opacity-50"
          >
            {broadcasting ? (
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
            ) : (
              <Radio className="w-4 h-4 text-emerald-600" />
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

      {/* Pricing Form */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <form onSubmit={handleSave} className="space-y-6">
          
          <div>
            <h3 className="text-xs font-bold text-slate-900 mb-3 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>نرخ‌های تعرفه و مصرف منابع (ریال)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  آبونمان پایه ماهانه هر پروژه (ریال)
                </label>
                <input
                  type="number"
                  value={baseFee}
                  onChange={(e) => setBaseFee(Number(e.target.value))}
                  min={0}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 font-mono"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  معادل {formatToman(baseFee)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  فضای ذخیره‌سازی ابری (گیگابایت / ماه)
                </label>
                <input
                  type="number"
                  value={storageGb}
                  onChange={(e) => setStorageGb(Number(e.target.value))}
                  min={0}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 font-mono"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  معادل {formatToman(storageGb)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  پایگاه‌داده (به ازای هر ۱,۰۰۰ رکورد ماهانه)
                </label>
                <input
                  type="number"
                  value={dbRows}
                  onChange={(e) => setDbRows(Number(e.target.value))}
                  min={0}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 font-mono"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  معادل {formatToman(dbRows)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  توابع ابری (به ازای هر ۱۰,۰۰۰ فراخوانی)
                </label>
                <input
                  type="number"
                  value={edgeCalls}
                  onChange={(e) => setEdgeCalls(Number(e.target.value))}
                  min={0}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 font-mono"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  معادل {formatToman(edgeCalls)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  احراز هویت (به ازای هر ۱,۰۰۰ کاربر ماهانه فعال)
                </label>
                <input
                  type="number"
                  value={authUsers}
                  onChange={(e) => setAuthUsers(Number(e.target.value))}
                  min={0}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 font-mono"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  معادل {formatToman(authUsers)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  حداقل مبلغ شارژ کیف پول (ریال)
                </label>
                <input
                  type="number"
                  value={minTopup}
                  onChange={(e) => setMinTopup(Number(e.target.value))}
                  min={10000}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 font-mono"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  معادل {formatToman(minTopup)}
                </span>
              </div>
            </div>
          </div>

          {/* Operational Config */}
          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-900 mb-3 flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-emerald-600" />
              <span>پیکربندی سهمیه‌ها و وضعیت سرور</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  آدرس IP ثابت خروجی سرور (Egress NAT)
                </label>
                <input
                  type="text"
                  value={egressIp}
                  onChange={(e) => setEgressIp(e.target.value)}
                  placeholder="IP سرور یا گیت‌وی خروجی"
                  dir="ltr"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  حداکثر پروژه مجاز هر توسعه‌دهنده
                </label>
                <input
                  type="number"
                  value={maxProjectsPerUser}
                  onChange={(e) => setMaxProjectsPerUser(Number(e.target.value))}
                  min={1}
                  max={1000}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  سهمیه پیش‌فرض استوریج هر پروژه (MB)
                </label>
                <input
                  type="number"
                  value={storageQuotaMb}
                  onChange={(e) => setStorageQuotaMb(Number(e.target.value))}
                  min={50}
                  max={500000}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Maintenance Mode */}
            <div className="mt-4 p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={maintenanceMode}
                  onChange={(e) => setMaintenanceMode(e.target.checked)}
                  className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
                />
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <span>فعال‌سازی وضعیت ارتقا و نگهداری کلان (Maintenance Mode)</span>
                </span>
              </label>

              {maintenanceMode && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    پیام نمایشی به کاربران در زمان نگهداری:
                  </label>
                  <input
                    type="text"
                    value={maintenanceMessage}
                    onChange={(e) => setMaintenanceMessage(e.target.value)}
                    placeholder="سامانه در حال ارتقا است..."
                    className="w-full px-3 py-2 rounded-xl bg-white border border-rose-200 text-xs text-slate-900 focus:outline-none focus:border-rose-500"
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
              <span>{saving ? 'در حال ذخیره‌سازی...' : 'ذخیره تعرفه‌ها و اعمال در کلاستر'}</span>
            </button>
          </div>

        </form>
      </div>

    </div>
  );
}
