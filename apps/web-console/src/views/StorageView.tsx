import React, { useState, useEffect, useCallback } from 'react';
import { Project, StorageBucket, StorageFile } from '../types';
import {
  HardDrive,
  Upload,
  FileText,
  Copy,
  Trash2,
  CheckCircle2,
  Plus,
  Folder,
  RefreshCw,
  Shield,
} from 'lucide-react';
import { ConfirmModal } from '../components/modals/ConfirmModal';
import { AlertModal } from '../components/modals/AlertModal';

interface StorageViewProps {
  project: Project;
  onOpenCreateBucketModal: () => void;
  activeSubView?: string;
  onSubViewChange?: (subView: string) => void;
}

export const StorageView: React.FC<StorageViewProps> = ({
  project,
  onOpenCreateBucketModal,
  activeSubView = 'buckets',
}) => {
  const [buckets, setBuckets] = useState<StorageBucket[]>([]);
  const [selectedBucket, setSelectedBucket] = useState<string>('');
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [isLoadingBuckets, setIsLoadingBuckets] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Modals state
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [bucketToDelete, setBucketToDelete] = useState<string | null>(null);
  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'error' | 'success' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });

  // Real API: Fetch Buckets
  const fetchBuckets = useCallback(async () => {
    setIsLoadingBuckets(true);
    try {
      const res = await fetch(`/_baas/v1/${project.slug}/storage/buckets`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const mapped: StorageBucket[] = data.map((b: Record<string, unknown> | string) => {
            if (typeof b === 'string') {
              return { name: b, isPublic: true, filesCount: 0, totalSizeBytes: 0, createdAt: '' };
            }
            return {
              name: String(b.name || b.Name || ''),
              isPublic: Boolean(b.isPublic ?? b.IsPublic ?? true),
              filesCount: Number(b.filesCount ?? b.fileCount ?? b.FileCount ?? 0),
              totalSizeBytes: Number(b.totalSizeBytes ?? b.sizeBytes ?? b.SizeBytes ?? 0),
              createdAt: String(b.createdAt || b.CreatedAt || ''),
            };
          });
          setBuckets(mapped);
          if (mapped.length > 0 && !selectedBucket) {
            setSelectedBucket(mapped[0].name);
          }
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingBuckets(false);
    }
  }, [project.slug, selectedBucket]);

  // Real API: Fetch Files for selected bucket
  const fetchFiles = useCallback(async (bucketName: string) => {
    if (!bucketName) {
      setFiles([]);
      return;
    }
    setIsLoadingFiles(true);
    try {
      const res = await fetch(`/_baas/v1/${project.slug}/storage/${bucketName}/files`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setFiles(
            data.map((f: Record<string, unknown> | string) => {
              const name = typeof f === 'string' ? f : String(f.name || f.Name || '');
              const size = typeof f === 'object' ? Number(f.size ?? f.Size ?? f.sizeBytes ?? 0) : 0;
              const type = typeof f === 'object' ? String(f.contentType || f.ContentType || 'application/octet-stream') : 'application/octet-stream';
              return {
                name,
                bucket: bucketName,
                contentType: type,
                sizeBytes: size,
                uploadedAt: typeof f === 'object' && f.uploadedAt ? String(f.uploadedAt) : 'هم‌اکنون',
                url: `${window.location.origin}/_baas/v1/${project.slug}/storage/${bucketName}/${name}`,
              };
            })
          );
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingFiles(false);
    }
  }, [project.slug]);

  useEffect(() => {
    fetchBuckets();
  }, [fetchBuckets]);

  useEffect(() => {
    if (selectedBucket) {
      fetchFiles(selectedBucket);
    }
  }, [selectedBucket, fetchFiles]);

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  // Real API: Delete File
  const handleDeleteFile = (fileName: string) => {
    setFileToDelete(fileName);
  };

  const executeDeleteFile = async (fileName: string) => {
    setFileToDelete(null);
    try {
      const res = await fetch(
        `/_baas/v1/${project.slug}/storage/${selectedBucket}/${encodeURIComponent(fileName)}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        setFiles((prev) => prev.filter((f) => f.name !== fileName));
        setAlertState({
          isOpen: true,
          title: 'حذف فایل موفق',
          message: `فایل «${fileName}» با موفقیت حذف گردید.`,
          type: 'success',
        });
      }
    } catch {
      setAlertState({
        isOpen: true,
        title: 'خطای ارتباط با سرور',
        message: 'خطا در ارسال درخواست حذف فایل.',
        type: 'error',
      });
    }
  };

  // Real API: Delete Bucket
  const handleDeleteBucket = (bucketName: string) => {
    setBucketToDelete(bucketName);
  };

  const executeDeleteBucket = async (bucketName: string) => {
    setBucketToDelete(null);
    try {
      const res = await fetch(`/_baas/v1/${project.slug}/storage/buckets/${bucketName}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setBuckets((prev) => prev.filter((b) => b.name !== bucketName));
        if (selectedBucket === bucketName) {
          setSelectedBucket(buckets[0]?.name || '');
        }
        setAlertState({
          isOpen: true,
          title: 'حذف باکت موفق',
          message: `باکت «${bucketName}» با موفقیت حذف گردید.`,
          type: 'success',
        });
      }
    } catch {
      setAlertState({
        isOpen: true,
        title: 'خطای ارتباط با سرور',
        message: 'خطا در ارسال درخواست حذف باکت.',
        type: 'error',
      });
    }
  };

  // Real API: Upload File
  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0 || !selectedBucket) return;
    const file = fileList[0];

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(
        `/_baas/v1/${project.slug}/storage/${selectedBucket}/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (res.ok) {
        await fetchFiles(selectedBucket);
        setAlertState({
          isOpen: true,
          title: 'بارگذاری فایل موفق',
          message: `فایل «${file.name}» با موفقیت در باکت بارگذاری شد.`,
          type: 'success',
        });
      } else {
        const err = await res.json().catch(() => null);
        setAlertState({
          isOpen: true,
          title: 'خطا در بارگذاری فایل',
          message: err?.error || 'بارگذاری فایل در باکت با خطا مواجه شد.',
          type: 'error',
        });
      }
    } catch (err) {
      setAlertState({
        isOpen: true,
        title: 'خطای ارتباط با سرور',
        message: 'خطا در ارتباط با سرور ذخیره‌سازی.',
        type: 'error',
      });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              فضای ذخیره‌سازی ابری
            </span>
            <span className="text-xs text-slate-400 font-mono" dir="ltr">
              {project.slug}
            </span>
          </div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-emerald-600" />
            {activeSubView === 'explorer'
              ? 'مرورگر فایل‌ها و اسناد'
              : activeSubView === 'policies'
              ? 'سیاست‌ها و سهمیه‌های ذخیره‌سازی'
              : 'مدیریت باکت‌های ذخیره‌سازی'}
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            ذخیره‌سازی انواع فایل‌ها و اسناد، بهینه‌سازی خودکار و صدور پیوندهای دانلود مستقیم با شبکه توزیع اختصاصی.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchBuckets}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition shadow-xs"
            title="بازخوانی باکت‌ها"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingBuckets ? 'animate-spin' : ''}`} />
            <span>بازخوانی</span>
          </button>
          <button
            onClick={onOpenCreateBucketModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>ایجاد باکت جدید</span>
          </button>
        </div>
      </div>

      {/* Sub-View: Policies */}
      {activeSubView === 'policies' && (
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs max-w-2xl space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Shield className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">سهمیه‌ها و دسترسی عمومی باکت‌ها</h3>
          </div>
          <div className="space-y-3 text-xs text-slate-600">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span>حداکثر حجم هر فایل:</span>
              <strong className="font-mono text-slate-800" dir="ltr">50 MB</strong>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span>محدودیت کلی باکت‌های پروژه:</span>
              <strong className="font-mono text-slate-800" dir="ltr">1,024 MB</strong>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span>دسترسی مستقیم CORS:</span>
              <span className="text-emerald-700 font-semibold">فعال (تمام دامنه‌ها)</span>
            </div>
          </div>
        </div>
      )}

      {/* Buckets Grid & File Explorer (Buckets / Explorer Views) */}
      {activeSubView !== 'policies' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Buckets List */}
          <div className="lg:col-span-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-bold text-slate-900">
                باکت‌های پروژه ({buckets.length})
              </span>
            </div>

            <div className="space-y-1.5 max-h-[460px] overflow-y-auto">
              {isLoadingBuckets ? (
                <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                  <span>در حال دریافت باکت‌ها...</span>
                </div>
              ) : buckets.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 rounded-xl border border-dashed border-slate-200 space-y-2">
                  <p>هنوز باکتی ایجاد نشده است.</p>
                  <button
                    onClick={onOpenCreateBucketModal}
                    className="text-xs text-emerald-700 hover:underline font-medium"
                  >
                    + ایجاد اولین باکت
                  </button>
                </div>
              ) : (
                buckets.map((b) => (
                  <div
                    key={b.name}
                    className={`w-full p-2.5 rounded-xl border text-right transition flex items-center justify-between ${
                      selectedBucket === b.name
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <button
                      onClick={() => setSelectedBucket(b.name)}
                      className="flex items-center gap-2.5 truncate flex-1 text-right"
                    >
                      <Folder className={`w-4 h-4 shrink-0 ${selectedBucket === b.name ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span className="text-xs font-mono font-bold truncate" dir="ltr">{b.name}</span>
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-500">
                        {b.isPublic ? 'عمومی' : 'خصوصی'}
                      </span>
                      <button
                        onClick={() => handleDeleteBucket(b.name)}
                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="حذف باکت"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Files Explorer */}
          <div className="lg:col-span-8 p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-bold text-slate-900">
                  فایل‌های باکت: <span className="font-mono text-emerald-700 font-bold" dir="ltr">{selectedBucket || 'انتخاب نشده'}</span>
                </span>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  تعداد اسناد: {files.length}
                </div>
              </div>

              {selectedBucket && (
                <label className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-medium text-xs cursor-pointer transition border border-emerald-200 shadow-xs">
                  <Upload className={`w-3.5 h-3.5 text-emerald-600 ${isUploading ? 'animate-bounce' : ''}`} />
                  <span>{isUploading ? 'در حال آپلود...' : 'آپلود فایل جدید'}</span>
                  <input
                    type="file"
                    onChange={handleUploadFile}
                    disabled={isUploading}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-right text-xs" dir="rtl">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                    <th className="py-2.5 px-3">نام فایل</th>
                    <th className="py-2.5 px-3 text-center">نوع فایل</th>
                    <th className="py-2.5 px-3 text-center">حجم</th>
                    <th className="py-2.5 px-3 text-center">زمان آپلود</th>
                    <th className="py-2.5 px-3 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingFiles ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-xs text-slate-500">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                          <span>در حال دریافت لیست فایل‌ها...</span>
                        </div>
                      </td>
                    </tr>
                  ) : files.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-xs text-slate-400">
                        {selectedBucket
                          ? 'هیچ فایلی در این باکت وجود ندارد. فایل‌های خود را آپلود کنید.'
                          : 'ابتدا یک باکت از ستون کناری انتخاب نمایید.'}
                      </td>
                    </tr>
                  ) : (
                    files.map((f) => (
                      <tr key={f.name} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 px-3 font-mono text-slate-800 font-bold" dir="ltr">
                          <div className="flex items-center gap-2">
                            <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="truncate max-w-xs">{f.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-500 text-[11px]" dir="ltr">
                          {f.contentType}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-600 text-[11px]" dir="ltr">
                          {(f.sizeBytes / 1024).toFixed(1)} KB
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-500 text-[11px]">
                          {f.uploadedAt}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleCopyUrl(f.url)}
                              className="p-1 rounded-md text-slate-500 hover:text-emerald-700 hover:bg-slate-100 transition"
                              title="کپی لینک مستقیم فایل"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            {copiedUrl === f.url && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            )}
                            <button
                              onClick={() => handleDeleteFile(f.name)}
                              className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                              title="حذف فایل"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Accessible Confirm Modal for File Deletion */}
      <ConfirmModal
        isOpen={Boolean(fileToDelete)}
        title="حذف فایل از فضای ذخیره‌سازی"
        message={`آیا از حذف دائم فایل «${fileToDelete}» اطمینان دارید؟`}
        confirmLabel="حذف فایل"
        isDanger={true}
        onConfirm={() => {
          if (fileToDelete) executeDeleteFile(fileToDelete);
        }}
        onCancel={() => setFileToDelete(null)}
      />

      {/* Accessible Confirm Modal for Bucket Deletion */}
      <ConfirmModal
        isOpen={Boolean(bucketToDelete)}
        title="حذف کامل باکت ذخیره‌سازی"
        message={`آیا از حذف کامل باکت «${bucketToDelete}» و تمامی فایل‌های درون آن اطمینان دارید؟`}
        confirmLabel="حذف باکت"
        isDanger={true}
        onConfirm={() => {
          if (bucketToDelete) executeDeleteBucket(bucketToDelete);
        }}
        onCancel={() => setBucketToDelete(null)}
      />

      {/* Accessible Alert Modal */}
      <AlertModal
        isOpen={alertState.isOpen}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
        onClose={() => setAlertState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
