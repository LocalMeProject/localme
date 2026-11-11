import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, 
  Search, 
  Download, 
  Power, 
  RefreshCw, 
  Database, 
  ArrowUpDown,
  Trash2,
  ExternalLink,
  Zap,
  ShieldCheck,
  Calendar,
  Layers,
  Phone
} from 'lucide-react';
import { api } from '../../utils/apiClient';
import { toPersianDigits } from '../../utils/persian';
import { Project } from '../../types';

interface ProjectAdminItem extends Project {
  dbClusterId?: string;
  isPaused?: boolean;
  ownerPhone?: string;
  ownerId?: string;
  createdAtUtc?: string;
}

interface PlatformShard {
  id: string;
  name: string;
  region: string;
  isActive: boolean;
  isAcceptingNewProjects: boolean;
}

export function TenantOversightView() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectAdminItem[]>([]);
  const [shards, setShards] = useState<PlatformShard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [shardFilter, setShardFilter] = useState('ALL');
  
  // Shard Reassignment Modal
  const [reassignProject, setReassignProject] = useState<ProjectAdminItem | null>(null);
  const [targetShardId, setTargetShardId] = useState('');
  const [reassigning, setReassigning] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);

  // Status Toggling State
  const [togglingProjectId, setTogglingProjectId] = useState<string | null>(null);

  // Deletion Modal
  const [deletingProject, setDeletingProject] = useState<ProjectAdminItem | null>(null);
  const [confirmSlugInput, setConfirmSlugInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [projList, shardList] = await Promise.all([
        api.get('/_baas/v1/projects'),
        api.get('/_baas/v1/admin/shards'),
      ]);

      if (Array.isArray(projList)) {
        setProjects(projList);
      }
      if (Array.isArray(shardList)) {
        setShards(shardList);
      }
    } catch (err) {
      console.error('Failed to load projects/shards', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleStatus = async (project: ProjectAdminItem) => {
    const isCurrentlyActive = project.status === 'ACTIVE';
    const newStatus = isCurrentlyActive ? 'PAUSED' : 'ACTIVE';
    setTogglingProjectId(project.id);

    try {
      await api.put(`/_baas/v1/admin/projects/${encodeURIComponent(project.id)}/status`, {
        status: newStatus,
        isPaused: !isCurrentlyActive,
      });

      setProjects((prev) =>
        prev.map((p) =>
          p.id === project.id ? { ...p, status: newStatus as any, isPaused: !isCurrentlyActive } : p
        )
      );
    } catch (err: any) {
      alert(`خطا در تغییر وضعیت پروژه: ${err.message}`);
    } finally {
      setTogglingProjectId(null);
    }
  };

  const handleDownloadArchive = (projectId: string, projectSlug: string) => {
    const downloadUrl = `/_baas/v1/${encodeURIComponent(projectId)}/db/archive/export`;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `${projectSlug}.localmepack`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const openReassignModal = (project: ProjectAdminItem) => {
    setReassignProject(project);
    setTargetShardId(project.dbClusterId || shards[0]?.id || 'shard-a');
    setReassignError(null);
  };

  const executeReassign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignProject || !targetShardId) return;

    setReassigning(true);
    setReassignError(null);

    try {
      await api.post(`/_baas/v1/admin/projects/${encodeURIComponent(reassignProject.id)}/reassign-shard`, {
        shardId: targetShardId,
      });

      setProjects((prev) =>
        prev.map((p) =>
          p.id === reassignProject.id ? { ...p, dbClusterId: targetShardId } : p
        )
      );
      setReassignProject(null);
    } catch (err: any) {
      setReassignError(err.message || 'خطا در تخصیص مجدد شارد.');
    } finally {
      setReassigning(false);
    }
  };

  const openDeleteModal = (project: ProjectAdminItem) => {
    setDeletingProject(project);
    setConfirmSlugInput('');
    setDeleteError(null);
  };

  const executeDeleteProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletingProject) return;

    if (confirmSlugInput.trim() !== deletingProject.slug) {
      setDeleteError(`برای تایید، لطفا شناسه «${deletingProject.slug}» را دقیقا تایپ نمایید.`);
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await api.delete(`/_baas/v1/admin/projects/${encodeURIComponent(deletingProject.id)}`);
      setProjects((prev) => prev.filter((p) => p.id !== deletingProject.id));
      setDeletingProject(null);
    } catch (err: any) {
      setDeleteError(err.message || 'خطا در حذف کامل پروژه و شِمای پایگاه‌داده.');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredProjects = projects.filter((p) => {
    if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
    if (shardFilter !== 'ALL' && (p.dbClusterId || 'shard-a') !== shardFilter) return false;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      p.name?.toLowerCase().includes(q) ||
      p.slug?.toLowerCase().includes(q) ||
      p.id?.toLowerCase().includes(q) ||
      p.ownerPhone?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">نظارت بر پروژه‌ها و مدیریت چندتننتی (Tenants & Projects)</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
              {toPersianDigits(projects.length)} پروژه
            </span>
          </div>
          <p className="text-xs text-slate-500">
            مشاهده، دسترسی مستقیم به استودیو، فعال/غیرفعال‌سازی، دریافت بسته جامع پشتیبان (`.localmepack`)، جابجایی شارد، و حذف شِمای پروژه‌ها.
          </p>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">همه وضعیت‌ها</option>
            <option value="ACTIVE">فقط فعال</option>
            <option value="PAUSED">فقط متوقف‌شده</option>
          </select>

          <select
            value={shardFilter}
            onChange={(e) => setShardFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
          >
            <option value="ALL">همه شاردها</option>
            {shards.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.id})
              </option>
            ))}
          </select>

          <div className="relative flex-1 sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="نام، شناسه یا شماره مالک..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition"
            title="بازخوانی"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Projects Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <RefreshCw className="w-6 h-6 animate-spin text-emerald-600 mb-2" />
          <span className="text-xs text-slate-500">در حال دریافت فهرست پروژه‌ها...</span>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700 mb-1">هیچ پروژه‌ای یافت نشد</h3>
          <p className="text-xs text-slate-400">عبارت جستجو را تغییر دهید یا در میزکار پروژه جدید بسازید.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold select-none">
                <tr>
                  <th className="py-3 px-4">نام و شناسه پروژه</th>
                  <th className="py-3 px-4">مالک پروژه</th>
                  <th className="py-3 px-4">شِمای PostgreSQL</th>
                  <th className="py-3 px-4">شارد خوشه</th>
                  <th className="py-3 px-4">سرویس‌های فعال</th>
                  <th className="py-3 px-4">وضعیت</th>
                  <th className="py-3 px-4 text-left">عملیات مدیریت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProjects.map((p) => {
                  const isActive = p.status === 'ACTIVE';
                  const isToggling = togglingProjectId === p.id;
                  const schemaName = (p.services as any)?.database?.settings?.schema || `public_${p.id}`;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{p.name}</div>
                        <div className="font-mono text-[11px] text-slate-400 mt-0.5" dir="ltr">
                          {p.slug}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {p.ownerPhone ? (
                          <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-700" dir="ltr">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{p.ownerPhone}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">{p.ownerId || '—'}</span>
                        )}
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(p.createdAt || p.createdAtUtc || '').toLocaleDateString('fa-IR')}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-mono font-semibold text-slate-800 text-[11px]" dir="ltr">
                            {schemaName}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <Database className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="font-mono font-bold text-slate-700 text-[11px]" dir="ltr">
                            {p.dbClusterId || 'shard-a'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span 
                            title={p.services?.database?.isEnabled ? 'دیتابیس فعال' : 'دیتابیس غیرفعال'}
                            className={`p-1 rounded-md text-[10px] ${p.services?.database?.isEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}
                          >
                            <Database className="w-3.5 h-3.5" />
                          </span>
                          <span 
                            title={p.services?.auth?.isEnabled ? 'احراز هویت فعال' : 'احراز هویت غیرفعال'}
                            className={`p-1 rounded-md text-[10px] ${p.services?.auth?.isEnabled ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-400'}`}
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                          </span>
                          <span 
                            title={p.services?.functions?.isEnabled ? 'اج فانکشن فعال' : 'اج فانکشن غیرفعال'}
                            className={`p-1 rounded-md text-[10px] ${p.services?.functions?.isEnabled ? 'bg-purple-50 text-purple-700' : 'bg-slate-100 text-slate-400'}`}
                          >
                            <Zap className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>فعال</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            <span>متوقف‌شده</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-left">
                        <div className="flex items-center justify-end gap-1.5">
                          
                          {/* 1-Click Open Studio in Developer Console */}
                          <button
                            onClick={() => navigate(`/panel/${p.slug}/overview`)}
                            title="ورود به استودیوی توسعه‌دهنده پروژه"
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition font-medium text-[11px]"
                          >
                            <span>استودیو</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>

                          {/* 1-Click Universal .localmepack Export */}
                          <button
                            onClick={() => handleDownloadArchive(p.id, p.slug)}
                            title="دریافت آرشیو پشتیبان (.localmepack)"
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition font-medium text-[11px]"
                          >
                            <Download className="w-3.5 h-3.5 text-slate-500" />
                            <span className="font-mono">Pack</span>
                          </button>

                          {/* Reassign Shard */}
                          <button
                            onClick={() => openReassignModal(p)}
                            title="تغییر شارد پایگاه‌داده"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
                          >
                            <ArrowUpDown className="w-4 h-4" />
                          </button>

                          {/* Toggle Active / Paused */}
                          <button
                            onClick={() => handleToggleStatus(p)}
                            disabled={isToggling}
                            title={isActive ? 'توقف موقت پروژه' : 'فعال‌سازی پروژه'}
                            className={`p-1.5 rounded-lg transition ${
                              isActive
                                ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            {isToggling ? (
                              <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                            ) : (
                              <Power className="w-4 h-4" />
                            )}
                          </button>

                          {/* Delete Project & Drop Schema Cascade */}
                          <button
                            onClick={() => openDeleteModal(p)}
                            title="حذف کامل پروژه و شِمای PostgreSQL"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reassign Shard Modal */}
      {reassignProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" dir="rtl">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Database className="w-4 h-4 text-emerald-600" />
                <span>تغییر شارد پایگاه‌داده پروژه</span>
              </h3>
              <button
                onClick={() => setReassignProject(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {reassignError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                {reassignError}
              </div>
            )}

            <form onSubmit={executeReassign} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  پروژه انتخابی:
                </label>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800">
                  {reassignProject.name} <span className="text-slate-400 font-mono">({reassignProject.slug})</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  شارد مقصد:
                </label>
                <select
                  value={targetShardId}
                  onChange={(e) => setTargetShardId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                >
                  {shards.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.id}) - {s.region}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReassignProject(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={reassigning}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition disabled:opacity-50"
                >
                  {reassigning ? 'در حال اعمال...' : 'ثبت تغییر شارد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Project Modal */}
      {deletingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" dir="rtl">
          <div className="bg-white rounded-2xl border border-rose-200 shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-rose-100 mb-4">
              <h3 className="text-sm font-bold text-rose-700 flex items-center gap-1.5">
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>حذف دائمی و برگشت‌ناپذیر تننت</span>
              </h3>
              <button
                onClick={() => setDeletingProject(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {deleteError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                {deleteError}
              </div>
            )}

            <form onSubmit={executeDeleteProject} className="space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                با حذف این پروژه، کلیه جداول، رکوردها، توابع، باکت‌های فایل و شِمای <code className="text-rose-600 font-mono font-bold">public_{deletingProject.id}</code> در پایگاه‌داده به صورت آبشاری (<span className="font-mono">CASCADE</span>) برای همیشه حذف خواهد شد.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  جهت تایید، شناسه اسلاگ پروژه <span className="font-mono text-rose-600 font-bold">{deletingProject.slug}</span> را تایپ کنید:
                </label>
                <input
                  type="text"
                  value={confirmSlugInput}
                  onChange={(e) => setConfirmSlugInput(e.target.value)}
                  placeholder={deletingProject.slug}
                  dir="ltr"
                  className="w-full bg-slate-50 border border-rose-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white transition"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeletingProject(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isDeleting || confirmSlugInput.trim() !== deletingProject.slug}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition disabled:opacity-50"
                >
                  {isDeleting ? 'در حال حذف کامل...' : 'تایید و حذف برگشت‌ناپذیر'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
