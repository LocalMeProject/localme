import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Save, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Sliders 
} from 'lucide-react';
import { api } from '../../utils/apiClient';
import { formatToman } from '../../utils/persian';

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
  const [egressIp, setEgressIp] = useState('2.180.12.94');
  const [maxProjectsPerUser, setMaxProjectsPerUser] = useState(10);
  const [storageQuotaMb, setStorageQuotaMb] = useState(1024);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

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

  const handleSave = async (e: React.FormEvent) => {
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
        minWalletTopupIrr: Number(minTopup),
      });

      setFeedback({
        type: 'success',
        message: 'تعرفه‌ها و سهمیه‌های پایه با موفقیت ذخیره و در کل کلاستر پلتفرم منتشر شد.',
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

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2 mb-1">
          <DollarSign className="w-5 h-5 text-emerald-600" />
          <h2 className="text-base font-bold text-slate-900">تعرفه‌گذاری کلان، سهمیه‌های پایه و IP خروجی</h2>
        </div>
        <p className="text-xs text-slate-500">
          تنظیم مدل اقتصادی پلتفرم، حداقل شارژ کیف پول و متغیرهای عملیاتی کلان سامانه.
        </p>
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
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <RefreshCw className="w-6 h-6 animate-spin text-emerald-600 mb-2" />
          <span className="text-xs text-slate-500">در حال دریافت تعرفه‌ها...</span>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          
          {/* Pricing Catalog */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 pb-3 border-b border-slate-100">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>کاتالوگ قیمت‌گذاری منابع (به ریال)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  آبونمان پایه ماهانه هر پروژه (ریال)
                </label>
                <input
                  type="number"
                  min={0}
                  value={baseFee}
                  onChange={(e) => setBaseFee(parseInt(e.target.value, 10) || 0)}
                  dir="ltr"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  معادل {formatToman(baseFee)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  قیمت هر گیگابایت فضای استوریج در ماه (ریال)
                </label>
                <input
                  type="number"
                  min={0}
                  value={storageGb}
                  onChange={(e) => setStorageGb(parseInt(e.target.value, 10) || 0)}
                  dir="ltr"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  معادل {formatToman(storageGb)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  قیمت هر ۱۰۰۰ سطر دیتابیس در ماه (ریال)
                </label>
                <input
                  type="number"
                  min={0}
                  value={dbRows}
                  onChange={(e) => setDbRows(parseInt(e.target.value, 10) || 0)}
                  dir="ltr"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  معادل {formatToman(dbRows)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  قیمت هر ۱۰ هزار فراخوانی تابع اج (ریال)
                </label>
                <input
                  type="number"
                  min={0}
                  value={edgeCalls}
                  onChange={(e) => setEdgeCalls(parseInt(e.target.value, 10) || 0)}
                  dir="ltr"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  معادل {formatToman(edgeCalls)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  قیمت هر ۱۰۰۰ کاربر فعال احراز هویت ماهانه (ریال)
                </label>
                <input
                  type="number"
                  min={0}
                  value={authUsers}
                  onChange={(e) => setAuthUsers(parseInt(e.target.value, 10) || 0)}
                  dir="ltr"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  معادل {formatToman(authUsers)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  حداقل مبلغ شارژ کیف پول (ریال)
                </label>
                <input
                  type="number"
                  min={10000}
                  value={minTopup}
                  onChange={(e) => setMinTopup(parseInt(e.target.value, 10) || 100000)}
                  dir="ltr"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  معادل {formatToman(minTopup)}
                </span>
              </div>
            </div>
          </div>

          {/* Operational Settings & Egress */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 pb-3 border-b border-slate-100">
              <Sliders className="w-4 h-4 text-emerald-600" />
              <span>متغیرهای عملیاتی و سهمیه‌های پلتفرم</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  آی‌پی استاتیک خروجی (Egress NAT IP)
                </label>
                <input
                  type="text"
                  value={egressIp}
                  onChange={(e) => setEgressIp(e.target.value)}
                  placeholder="2.180.12.94"
                  dir="ltr"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  جهت تعریف IP مجاز در درگاه‌های شاپرک و PSPها
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  حداکثر پروژه مجاز برای هر کاربر
                </label>
                <input
                  type="number"
                  min={1}
                  value={maxProjectsPerUser}
                  onChange={(e) => setMaxProjectsPerUser(parseInt(e.target.value, 10) || 10)}
                  dir="ltr"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  سهمیه پیش‌فرض استوریج (مگابایت)
                </label>
                <input
                  type="number"
                  min={100}
                  value={storageQuotaMb}
                  onChange={(e) => setStorageQuotaMb(parseInt(e.target.value, 10) || 1024)}
                  dir="ltr"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                />
              </div>

              <div className="sm:col-span-3 pt-2">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={maintenanceMode}
                    onChange={(e) => setMaintenanceMode(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                  />
                  <span>فعال‌سازی حالت نگهداری عمومی پلتفرم (Maintenance Mode)</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition disabled:opacity-50 shadow-xs"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>ذخیره کلیه تعرفه‌ها و متغیرها</span>
            </button>
          </div>

        </form>
      )}

    </div>
  );
}
