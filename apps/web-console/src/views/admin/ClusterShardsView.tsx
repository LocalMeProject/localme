import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Database, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  Server, 
  RefreshCw, 
  Trash2, 
  Edit3, 
  Wifi, 
  AlertCircle,
  Eye,
  EyeOff,
  Copy,
  Check,
  Activity
} from 'lucide-react';
import { api } from '../../utils/apiClient';
import { toPersianDigits } from '../../utils/persian';

export interface PlatformShard {
  id: string;
  name: string;
  connectionString: string;
  region: string;
  isActive: boolean;
  isAcceptingNewProjects: boolean;
  maxCapacityProjects: number;
  currentProjectCount: number;
  createdAtUtc: string;
}

export function ClusterShardsView() {
  const navigate = useNavigate();
  const [shards, setShards] = useState<PlatformShard[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingShardId, setTestingShardId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; latencyMs?: number; message?: string }>>({});
  const [visibleConnStrings, setVisibleConnStrings] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShard, setEditingShard] = useState<PlatformShard | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Form Fields
  const [shardId, setShardId] = useState('');
  const [name, setName] = useState('');
  const [connectionString, setConnectionString] = useState('');
  const [region, setRegion] = useState('ir-tehran-1');
  const [maxCapacity, setMaxCapacity] = useState(5000);
  const [isActive, setIsActive] = useState(true);
  const [isAccepting, setIsAccepting] = useState(true);

  const fetchShards = async () => {
    setLoading(true);
    try {
      const data = await api.get('/_baas/v1/admin/shards');
      if (Array.isArray(data)) {
        setShards(data);
      }
    } catch (err) {
      console.error('Failed to load shards', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShards();
  }, []);

  const openCreateModal = () => {
    setEditingShard(null);
    setShardId('');
    setName('');
    setConnectionString('');
    setRegion('ir-tehran-1');
    setMaxCapacity(5000);
    setIsActive(true);
    setIsAccepting(true);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (shard: PlatformShard) => {
    setEditingShard(shard);
    setShardId(shard.id);
    setName(shard.name);
    setConnectionString(shard.connectionString);
    setRegion(shard.region || 'ir-tehran-1');
    setMaxCapacity(shard.maxCapacityProjects || 5000);
    setIsActive(shard.isActive ?? true);
    setIsAccepting(shard.isAcceptingNewProjects ?? true);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleTestConnection = async (id: string) => {
    setTestingShardId(id);
    try {
      const res = await api.post(`/_baas/v1/admin/shards/${encodeURIComponent(id)}/test`);
      setTestResults((prev) => ({
        ...prev,
        [id]: {
          ok: res.success || res.status === 'OK',
          latencyMs: res.latencyMs,
          message: res.message || (res.version ? `پایگاه‌داده پاسخگو است (${res.version.slice(0, 32)}...)` : 'اتصال زنده با موفقیت برقرار شد.'),
        },
      }));
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [id]: {
          ok: false,
          message: err.message || 'خطا در برقراری اتصال به شارد.',
        },
      }));
    } finally {
      setTestingShardId(null);
    }
  };

  const toggleConnVisibility = (id: string) => {
    setVisibleConnStrings((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyConnectionString = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const maskConnectionString = (str: string) => {
    if (!str) return '---';
    return str.replace(/Password=[^;]+/gi, 'Password=••••••••')
              .replace(/:([^:@]+)@/, ':••••••••@');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!shardId.trim() || !name.trim() || !connectionString.trim()) {
      setFormError('لطفا تمامی فیلدهای الزامی را تکمیل نمایید.');
      return;
    }

    setFormSubmitting(true);
    try {
      const payload = {
        id: shardId.trim().toLowerCase(),
        name: name.trim(),
        connectionString: connectionString.trim(),
        region: region.trim(),
        maxCapacityProjects: Number(maxCapacity),
        isActive,
        isAcceptingNewProjects: isAccepting,
      };

      if (editingShard) {
        await api.put(`/_baas/v1/admin/shards/${encodeURIComponent(editingShard.id)}`, payload);
      } else {
        await api.post('/_baas/v1/admin/shards', payload);
      }

      setIsModalOpen(false);
      await fetchShards();
    } catch (err: any) {
      setFormError(err.message || 'خطا در ثبت اطلاعات شارد.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteShard = async (id: string) => {
    if (id === 'shard-a') {
      alert('شارد اصلی (shard-a) هسته پلتفرم است و امکان حذف آن وجود ندارد.');
      return;
    }

    if (!window.confirm(`آیا از حذف شارد «${id}» از کاتالوگ پلتفرم اطمینان دارید؟`)) {
      return;
    }

    try {
      await api.delete(`/_baas/v1/admin/shards/${encodeURIComponent(id)}`);
      await fetchShards();
    } catch (err: any) {
      alert(`خطا در حذف شارد: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Database className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">مدیریت خوشه‌ها و شاردهای پایگاه‌داده (Database Shards)</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
              {toPersianDigits(shards.length)} شارد
            </span>
          </div>
          <p className="text-xs text-slate-500">
            توزیع پروژه‌های لوکال می میان سرورهای مستقل PostgreSQL با مقیاس‌پذیری نامحدود و همگام‌سازی بلادرنگ کلاستر باس.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate('/admin/activity')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition"
          >
            <Activity className="w-4 h-4 text-slate-500" />
            <span>پایش کوئری‌های زنده</span>
          </button>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>افزودن شارد جدید</span>
          </button>
        </div>
      </div>

      {/* Shards List / Cards Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <RefreshCw className="w-6 h-6 animate-spin text-emerald-600 mb-2" />
          <span className="text-xs text-slate-500">در حال دریافت کاتالوگ شاردهای پایگاه‌داده...</span>
        </div>
      ) : shards.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <Server className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700 mb-1">هیچ شاردی تعریف نشده است</h3>
          <p className="text-xs text-slate-400 mb-4">تمامی پروژه‌ها به صورت پیش‌فرض در شارد محلی یا اولیه مستقر هستند.</p>
          <button
            onClick={openCreateModal}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium"
          >
            تعریف اولین شارد
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {shards.map((shard) => {
            const usagePercent = Math.min(
              100,
              Math.round(((shard.currentProjectCount || 0) / (shard.maxCapacityProjects || 1)) * 100)
            );
            const testResult = testResults[shard.id];
            const isConnVisible = !!visibleConnStrings[shard.id];

            return (
              <div
                key={shard.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition flex flex-col justify-between space-y-4"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">{shard.name}</span>
                        <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded font-semibold" dir="ltr">
                          {shard.id}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 mt-0.5 block font-mono" dir="ltr">
                        {shard.region || 'ir-tehran-1'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {shard.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>فعال</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          <XCircle className="w-3 h-3 text-rose-600" />
                          <span>غیرفعال</span>
                        </span>
                      )}

                      {shard.isAcceptingNewProjects ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-cyan-50 text-cyan-700 border border-cyan-200">
                          پذیرش پروژه جدید
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          تکمیل ظرفیت / قفل
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Real Connection String Viewer with Masking */}
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs mb-3 space-y-1">
                    <div className="flex items-center justify-between text-slate-500 text-[11px]">
                      <span>رشته اتصال PostgreSQL:</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => toggleConnVisibility(shard.id)}
                          className="flex items-center gap-1 text-slate-500 hover:text-slate-800 transition"
                          title={isConnVisible ? 'مخفی‌سازی رمز' : 'نمایش رمز عبور'}
                        >
                          {isConnVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          <span>{isConnVisible ? 'مخفی' : 'نمایش'}</span>
                        </button>
                        <button
                          onClick={() => copyConnectionString(shard.id, shard.connectionString)}
                          className="flex items-center gap-1 text-slate-500 hover:text-slate-800 transition mr-2"
                          title="کپی رشته اتصال"
                        >
                          {copiedId === shard.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedId === shard.id ? 'کپی شد' : 'کپی'}</span>
                        </button>
                      </div>
                    </div>
                    <div className="font-mono text-[11px] text-slate-800 break-all bg-white p-2 rounded-lg border border-slate-200" dir="ltr">
                      {isConnVisible ? shard.connectionString : maskConnectionString(shard.connectionString)}
                    </div>
                  </div>

                  {/* Capacity Bar */}
                  <div className="space-y-1.5 mb-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span>ظرفیت تننت‌های مستقر:</span>
                      <span className="font-mono font-medium">
                        {toPersianDigits(shard.currentProjectCount || 0)} / {toPersianDigits(shard.maxCapacityProjects)} پروژه ({toPersianDigits(usagePercent)}٪)
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          usagePercent > 85 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${usagePercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Test Connection Result */}
                  {testResult && (
                    <div
                      className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                        testResult.ok
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-rose-50 border-rose-200 text-rose-800'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        {testResult.ok ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        )}
                        <span className="line-clamp-2">{testResult.message}</span>
                      </div>
                      {testResult.latencyMs !== undefined && (
                        <span className="font-mono font-bold text-[11px] shrink-0 mr-2" dir="ltr">
                          {toPersianDigits(testResult.latencyMs)} ms
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Actions Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <button
                    onClick={() => handleTestConnection(shard.id)}
                    disabled={testingShardId === shard.id}
                    className="flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-slate-200 transition"
                  >
                    {testingShardId === shard.id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                    ) : (
                      <Wifi className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <span>تست اتصال زنده</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openEditModal(shard)}
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                      title="ویرایش شارد"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    {shard.id !== 'shard-a' && (
                      <button
                        onClick={() => handleDeleteShard(shard.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="حذف شارد"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" dir="rtl">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-900">
                {editingShard ? 'ویرایش شارد پایگاه‌داده' : 'افزودن شارد جدید به کلاستر'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  شناسه یکتای شارد (ID)
                </label>
                <input
                  type="text"
                  value={shardId}
                  disabled={!!editingShard}
                  onChange={(e) => setShardId(e.target.value)}
                  placeholder="shard-tehran-2"
                  dir="ltr"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-mono disabled:opacity-60 focus:bg-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  نام نمایشی خوشه
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="سرور دیتابیس تهران ۲"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  رشته اتصال کامل (PostgreSQL Connection String)
                </label>
                <textarea
                  value={connectionString}
                  onChange={(e) => setConnectionString(e.target.value)}
                  placeholder="Host=10.0.0.5;Port=5432;Database=localme_shard2;Username=postgres;Password=secret;"
                  dir="ltr"
                  rows={3}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    شناسه منطقه (Region)
                  </label>
                  <input
                    type="text"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    placeholder="ir-tehran-1"
                    dir="ltr"
                    required
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    حداکثر ظرفیت پروژه
                  </label>
                  <input
                    type="number"
                    value={maxCapacity}
                    onChange={(e) => setMaxCapacity(Number(e.target.value))}
                    min={1}
                    max={50000}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                  />
                  <span>شارد فعال باشد</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={isAccepting}
                    onChange={(e) => setIsAccepting(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                  />
                  <span>پذیرش پروژه‌های جدید</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition disabled:opacity-50 shadow-xs"
                >
                  {formSubmitting ? 'در حال ثبت...' : editingShard ? 'ذخیره تغییرات' : 'ثبت و اتصال شارد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
