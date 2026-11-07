import { useState, useEffect, type FormEvent } from 'react';
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
  Layers,
  Trash2,
  FileText,
  Wifi
} from 'lucide-react';
import { api } from '../../utils/apiClient';
import { toPersianDigits } from '../../utils/persian';

interface StorageFileItem {
  bucket: string;
  objectKey: string;
  sizeBytes: number;
  contentType: string;
  lastModified: string;
}

export function StorageBucketsView() {
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Storage Config Fields
  const [adapterType, setAdapterType] = useState<'LocalDisk' | 'ArvanS3'>('LocalDisk');
  const [endpoint, setEndpoint] = useState('https://s3.ir-thr-at1.arvanstorage.ir');
  const [bucket, setBucket] = useState('localme-storage');
  const [accessKey, setAccessKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [cdnUrl, setCdnUrl] = useState('');
  const [defaultStorageQuotaMb, setDefaultStorageQuotaMb] = useState(1024);

  // Storage Probe Test State
  const [testingStorage, setTestingStorage] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; latencyMs?: number; message?: string } | null>(null);

  // File Browser State
  const [files, setFiles] = useState<StorageFileItem[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const fetchConfig = async () => {
    try {
      const cfg = await api.get('/_baas/v1/admin/config');
      if (cfg) {
        setAdapterType(cfg.storageAdapterType === 'ArvanS3' || cfg.storageAdapterType === 'S3_COMPATIBLE' ? 'ArvanS3' : 'LocalDisk');
        if (cfg.arvanS3Endpoint) setEndpoint(cfg.arvanS3Endpoint);
        if (cfg.arvanS3Bucket) setBucket(cfg.arvanS3Bucket);
        if (cfg.arvanS3AccessKey) setAccessKey(cfg.arvanS3AccessKey);
        if (cfg.arvanS3SecretKey) setSecretKey(cfg.arvanS3SecretKey);
        if (cfg.arvanS3CdnUrl) setCdnUrl(cfg.arvanS3CdnUrl);
        if (cfg.defaultStorageQuotaMb) setDefaultStorageQuotaMb(cfg.defaultStorageQuotaMb);
      }
    } catch (err: any) {
      console.error('Failed to load storage config', err);
    }
  };

  const fetchFiles = async () => {
    setLoadingFiles(true);
    try {
      const list = await api.get('/_baas/v1/admin/storage/files?bucket=default');
      if (Array.isArray(list)) {
        setFiles(list);
      }
    } catch (err) {
      console.error('Failed to fetch storage files', err);
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchFiles();
  }, []);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const existing = await api.get('/_baas/v1/admin/config');
      const updated = {
        ...existing,
        storageAdapterType: adapterType,
        arvanS3Endpoint: endpoint.trim(),
        arvanS3Bucket: bucket.trim(),
        arvanS3AccessKey: accessKey.trim(),
        arvanS3SecretKey: secretKey.trim(),
        arvanS3CdnUrl: cdnUrl.trim(),
        defaultStorageQuotaMb: Number(defaultStorageQuotaMb),
      };

      await api.put('/_baas/v1/admin/config', updated);

      setFeedback({
        type: 'success',
        message: 'تنظیمات فضای ذخیره‌سازی ذخیره شد و رویداد کلاستر باس برای ابطال کش ارسال گردید (<۵ میلی‌ثانیه).',
      });
      fetchFiles();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'خطا در ذخیره‌سازی تنظیمات استوریج.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestStorageProbe = async () => {
    setTestingStorage(true);
    setTestResult(null);
    try {
      const res = await api.post('/_baas/v1/admin/storage/test');
      setTestResult({
        success: res.success ?? true,
        latencyMs: res.latencyMs,
        message: res.message || 'تست استوریج با موفقیت انجام شد.',
      });
      fetchFiles();
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'خطا در تست ارتباط با فضای ذخیره‌سازی.',
      });
    } finally {
      setTestingStorage(false);
    }
  };

  const handleDeleteFile = async (fileKey: string) => {
    if (!window.confirm(`آیا از حذف فایل «${fileKey}» از استوریج اطمینان دارید؟`)) return;

    setDeletingKey(fileKey);
    try {
      await api.delete(`/_baas/v1/admin/storage/files?bucket=default&key=${encodeURIComponent(fileKey)}`);
      setFiles((prev) => prev.filter((f) => f.objectKey !== fileKey));
    } catch (err: any) {
      alert(`خطا در حذف فایل: ${err.message}`);
    } finally {
      setDeletingKey(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '۰ بایت';
    if (bytes < 1024) return `${toPersianDigits(bytes)} بایت`;
    if (bytes < 1024 * 1024) return `${toPersianDigits((bytes / 1024).toFixed(1))} کیلوبایت`;
    return `${toPersianDigits((bytes / (1024 * 1024)).toFixed(2))} مگابایت`;
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <HardDrive className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">پیکربندی استوریج ابری و باکت‌های شیء (Object Storage / S3)</h2>
          </div>
          <p className="text-xs text-slate-500">
            سوئیچ بدون راه‌اندازی مجدد میان دیسک محلی و ذخیره‌سازهای سازگار با S3 (ابرآروان، MinIO، کلودفلر R2، و سرورهای اختصاصی).
          </p>
        </div>

        <button
          onClick={handleTestStorageProbe}
          disabled={testingStorage}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition disabled:opacity-50"
        >
          {testingStorage ? (
            <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
          ) : (
            <Wifi className="w-4 h-4 text-emerald-600" />
          )}
          <span>تست عملیاتی خواندن و نوشتن استوریج</span>
        </button>
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

      {testResult && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between animate-in fade-in ${
            testResult.success
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{testResult.message}</span>
          </div>
          {testResult.latencyMs !== undefined && (
            <span className="font-mono font-bold text-xs shrink-0 mr-2" dir="ltr">
              {toPersianDigits(testResult.latencyMs)} ms
            </span>
          )}
        </div>
      )}

      {/* Configuration Form */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <form onSubmit={handleSave} className="space-y-6">
          
          {/* Adapter Selection Cards */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              نوع آداپتور فعال ذخیره‌سازی فایل (Storage Adapter)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              <div
                onClick={() => setAdapterType('LocalDisk')}
                className={`p-4 rounded-xl border-2 cursor-pointer transition flex items-start gap-3 ${
                  adapterType === 'LocalDisk'
                    ? 'border-emerald-500 bg-emerald-50/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <Server className="w-5 h-5 text-slate-700 mt-0.5" />
                <div>
                  <div className="font-bold text-xs text-slate-900">دیسک محلی سرور (Local Disk)</div>
                  <div className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    ذخیره‌سازی روی دیسک میزبان یا والیوم داکر (مناسب استقرار تک‌سرور و توسعه).
                  </div>
                </div>
              </div>

              <div
                onClick={() => setAdapterType('ArvanS3')}
                className={`p-4 rounded-xl border-2 cursor-pointer transition flex items-start gap-3 ${
                  adapterType === 'ArvanS3'
                    ? 'border-emerald-500 bg-emerald-50/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <Cloud className="w-5 h-5 text-emerald-600 mt-0.5" />
                <div>
                  <div className="font-bold text-xs text-slate-900">ذخیره‌سازی ابری S3 سازگار (S3 Compatible)</div>
                  <div className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    اتصال به باکت‌های S3 (ابرآروان، MinIO، R2، پارس‌پک، AWS) با مقیاس‌پذیری و CDN.
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* S3 Details */}
          {adapterType === 'ArvanS3' && (
            <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-4 animate-in fade-in">
              <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-600" />
                <span>مشخصات اتصال و کلیدهای باکت S3</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    نشانی نقطه اتصال (S3 Endpoint)
                  </label>
                  <input
                    type="url"
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                    placeholder="https://s3.ir-thr-at1.arvanstorage.ir"
                    dir="ltr"
                    required={adapterType === 'ArvanS3'}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    نام باکت (Bucket Name)
                  </label>
                  <input
                    type="text"
                    value={bucket}
                    onChange={(e) => setBucket(e.target.value)}
                    placeholder="localme-storage"
                    dir="ltr"
                    required={adapterType === 'ArvanS3'}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    کلید دسترسی (Access Key)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={accessKey}
                      onChange={(e) => setAccessKey(e.target.value)}
                      placeholder="e.g. 5d7e...a9"
                      dir="ltr"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 font-mono focus:outline-none focus:border-emerald-500"
                    />
                    <Key className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    رمز امنیتی (Secret Key)
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={secretKey}
                      onChange={(e) => setSecretKey(e.target.value)}
                      placeholder="••••••••••••••••••••"
                      dir="ltr"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 font-mono focus:outline-none focus:border-emerald-500"
                    />
                    <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    دامنه اختصاصی توزیع محتوا یا CDN (اختیاری)
                  </label>
                  <input
                    type="url"
                    value={cdnUrl}
                    onChange={(e) => setCdnUrl(e.target.value)}
                    placeholder="https://cdn.example.com"
                    dir="ltr"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Quota Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                سهمیه پیش‌فرض ذخیره‌سازی هر پروژه (مگابایت)
              </label>
              <input
                type="number"
                value={defaultStorageQuotaMb}
                onChange={(e) => setDefaultStorageQuotaMb(Number(e.target.value))}
                min={50}
                max={100000}
                required
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition disabled:opacity-50 shadow-xs"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'در حال ذخیره‌سازی...' : 'ذخیره و اعمال در کلاستر'}</span>
            </button>
          </div>

        </form>
      </div>

      {/* Storage Files Browser */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold text-slate-900">مرورگر فایل‌های ذخیره‌شده در استوریج (Storage Files)</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 font-mono">
              {toPersianDigits(files.length)} فایل
            </span>
          </div>

          <button
            onClick={fetchFiles}
            className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingFiles ? 'animate-spin text-emerald-600' : ''}`} />
            <span>تازه سازی لیست فایل‌ها</span>
          </button>
        </div>

        {loadingFiles && files.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            در حال دریافت فهرست فایل‌های استوریج...
          </div>
        ) : files.length === 0 ? (
          <div className="py-12 text-center">
            <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <span className="text-xs text-slate-500">فایلی در باکت پیش‌فرض ذخیره نشده است.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">مسیر / نام فایل (Object Key)</th>
                  <th className="p-3">نوع محتوا</th>
                  <th className="p-3">حجم</th>
                  <th className="p-3">تاریخ ثبت</th>
                  <th className="p-3">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {files.map((f) => (
                  <tr key={f.objectKey} className="hover:bg-slate-50/80 transition">
                    <td className="p-3 font-mono text-slate-800 break-all" dir="ltr">
                      {f.objectKey}
                    </td>
                    <td className="p-3 font-mono text-[11px] text-slate-500" dir="ltr">
                      {f.contentType || 'application/octet-stream'}
                    </td>
                    <td className="p-3 font-mono font-medium text-slate-800">
                      {formatFileSize(f.sizeBytes)}
                    </td>
                    <td className="p-3 text-slate-500 text-[11px]" dir="ltr">
                      {f.lastModified ? new Date(f.lastModified).toLocaleDateString('fa-IR') : '---'}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => handleDeleteFile(f.objectKey)}
                        disabled={deletingKey === f.objectKey}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="حذف فایل از استوریج"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
