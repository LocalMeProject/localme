import React, { useState, useEffect } from 'react';
import { 
  HardDrive, 
  Cloud, 
  Server, 
  Save, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Globe, 
  Key, 
  Lock,
  Layers
} from 'lucide-react';
import { api } from '../../utils/apiClient';

export function StorageBucketsView() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Storage Config Fields
  const [adapterType, setAdapterType] = useState<'LocalDisk' | 'ArvanS3'>('LocalDisk');
  const [arvanEndpoint, setArvanEndpoint] = useState('https://s3.ir-thr-at1.arvanstorage.ir');
  const [arvanBucket, setArvanBucket] = useState('localme-storage');
  const [arvanAccessKey, setArvanAccessKey] = useState('');
  const [arvanSecretKey, setArvanSecretKey] = useState('');
  const [arvanCdnUrl, setArvanCdnUrl] = useState('');

  // Storage Quota Controls
  const [defaultStorageQuotaMb, setDefaultStorageQuotaMb] = useState(1024);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const cfg = await api.get('/_baas/v1/admin/config');
      if (cfg) {
        setAdapterType(cfg.storageAdapterType === 'ArvanS3' ? 'ArvanS3' : 'LocalDisk');
        if (cfg.arvanS3Endpoint) setArvanEndpoint(cfg.arvanS3Endpoint);
        if (cfg.arvanS3Bucket) setArvanBucket(cfg.arvanS3Bucket);
        if (cfg.arvanS3AccessKey) setArvanAccessKey(cfg.arvanS3AccessKey);
        if (cfg.arvanS3SecretKey) setArvanSecretKey(cfg.arvanS3SecretKey);
        if (cfg.arvanS3CdnUrl) setArvanCdnUrl(cfg.arvanS3CdnUrl);
        if (cfg.defaultStorageQuotaMb) setDefaultStorageQuotaMb(cfg.defaultStorageQuotaMb);
      }
    } catch (err: any) {
      console.error('Failed to load storage config', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      // First get existing config to preserve other platform keys
      const existing = await api.get('/_baas/v1/admin/config');
      const updated = {
        ...existing,
        storageAdapterType: adapterType,
        arvanS3Endpoint: arvanEndpoint.trim(),
        arvanS3Bucket: arvanBucket.trim(),
        arvanS3AccessKey: arvanAccessKey.trim(),
        arvanS3SecretKey: arvanSecretKey.trim(),
        arvanS3CdnUrl: arvanCdnUrl.trim(),
        defaultStorageQuotaMb: Number(defaultStorageQuotaMb),
      };

      await api.put('/_baas/v1/admin/config', updated);

      setFeedback({
        type: 'success',
        message: 'تنظیمات فضای ذخیره‌سازی با موفقیت در پایگاه‌داده ذخیره شد و رویداد ابطال کش (NOTIFY) به کلاستر ارسال گردید (<۵ میلی‌ثانیه).',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'خطا در ذخیره‌سازی تنظیمات استوریج.',
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
          <HardDrive className="w-5 h-5 text-emerald-600" />
          <h2 className="text-base font-bold text-slate-900">پیکربندی استوریج ابری و باکت‌های S3 ابرآروان</h2>
        </div>
        <p className="text-xs text-slate-500">
          تغییر درلحظه و بدون راه‌اندازی مجدد بین دیسک محلی و ذخیره‌سازی ابری توزیع‌شده سازگار با S3 (ابرآروان، مین‌آیو یا سایر ارائه‌دهندگان ایرانی).
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
          <span className="text-xs text-slate-500">در حال دریافت تنظیمات استوریج از پایگاه‌داده...</span>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          
          {/* Adapter Selection Switcher */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
            <h3 className="text-xs font-bold text-slate-900 mb-3 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>انتخاب آداپتور ذخیره‌سازی پیش‌فرض پلتفرم</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Option 1: Local Disk */}
              <div
                onClick={() => setAdapterType('LocalDisk')}
                className={`p-4 rounded-xl border-2 cursor-pointer transition select-none flex items-start gap-3 ${
                  adapterType === 'LocalDisk'
                    ? 'border-emerald-500 bg-emerald-50/40 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                }`}
              >
                <div className={`p-2.5 rounded-lg ${adapterType === 'LocalDisk' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">دیسک محلی سرور (Local Disk)</span>
                    {adapterType === 'LocalDisk' && (
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">فعال</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    ذخیره‌سازی فایل‌ها روی دیسک میزبان یا 볼وم Docker (`/app/storage`). مناسب محیط توسعه یا سرورهای تک‌نود.
                  </p>
                </div>
              </div>

              {/* Option 2: Arvan S3 Cloud Storage */}
              <div
                onClick={() => setAdapterType('ArvanS3')}
                className={`p-4 rounded-xl border-2 cursor-pointer transition select-none flex items-start gap-3 ${
                  adapterType === 'ArvanS3'
                    ? 'border-emerald-500 bg-emerald-50/40 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                }`}
              >
                <div className={`p-2.5 rounded-lg ${adapterType === 'ArvanS3' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">فضای ابری ابرآروان (AbrArvan S3)</span>
                    {adapterType === 'ArvanS3' && (
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">فعال</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    ذخیره‌سازی در باکت‌های امن S3 ابرآروان با پایداری ۹۹.۹۹۹٪، ترافیک نامحدود داخلی و توزیع از طریق CDN آروان.
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* S3 Configuration Details (Shown if ArvanS3 or for configuring it) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Cloud className="w-4 h-4 text-emerald-600" />
                <span>مشخصات اتصال به درگاه S3 ابرآروان</span>
              </h3>
              <span className="text-[11px] text-slate-400 font-mono">S3-Compatible API</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  آدرس اندپوینت S3 (Endpoint URL)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={arvanEndpoint}
                    onChange={(e) => setArvanEndpoint(e.target.value)}
                    placeholder="https://s3.ir-thr-at1.arvanstorage.ir"
                    dir="ltr"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  />
                  <Globe className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  نام باکت اصلی (Bucket Name)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={arvanBucket}
                    onChange={(e) => setArvanBucket(e.target.value)}
                    placeholder="localme-storage"
                    dir="ltr"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  />
                  <HardDrive className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  کلید دسترسی (Access Key)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={arvanAccessKey}
                    onChange={(e) => setArvanAccessKey(e.target.value)}
                    placeholder="01234567-89ab-cdef-0123-456789abcdef"
                    dir="ltr"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  />
                  <Key className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  کلید امنیتی محرمانه (Secret Key)
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={arvanSecretKey}
                    onChange={(e) => setArvanSecretKey(e.target.value)}
                    placeholder="••••••••••••••••••••••••••••••••"
                    dir="ltr"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  />
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  دامنه اختصاصی توزیع CDN (اختیاری)
                </label>
                <input
                  type="text"
                  value={arvanCdnUrl}
                  onChange={(e) => setArvanCdnUrl(e.target.value)}
                  placeholder="https://cdn.yourdomain.ir یا خالی جهت استفاده از لینک مستقیم باکت"
                  dir="ltr"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                />
              </div>
            </div>
          </div>

          {/* Storage Quota Controls */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
            <h3 className="text-xs font-bold text-slate-900 mb-3">سهمیه‌ها و محدودیت‌های پیش‌فرض ذخیره‌سازی</h3>
            <div className="max-w-xs">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                سهمیه رایگان هر پروژه (مگابایت)
              </label>
              <input
                type="number"
                min={100}
                value={defaultStorageQuotaMb}
                onChange={(e) => setDefaultStorageQuotaMb(parseInt(e.target.value, 10) || 1024)}
                dir="ltr"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
              />
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition disabled:opacity-50 shadow-xs"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>ذخیره در پایگاه‌داده و اعمال به کل کلاستر</span>
            </button>
          </div>

        </form>
      )}

    </div>
  );
}
