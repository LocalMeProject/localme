import React, { useState } from 'react';
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
} from 'lucide-react';

interface StorageViewProps {
  project: Project;
  onOpenCreateBucketModal: () => void;
}

const INITIAL_BUCKETS: StorageBucket[] = [];
const INITIAL_FILES: StorageFile[] = [];

export const StorageView: React.FC<StorageViewProps> = ({ project, onOpenCreateBucketModal }) => {
  const [buckets] = useState<StorageBucket[]>(INITIAL_BUCKETS);
  const [selectedBucket, setSelectedBucket] = useState<string>('');
  const [files, setFiles] = useState<StorageFile[]>(INITIAL_FILES);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const filteredFiles = files.filter((f) => f.bucket === selectedBucket);

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const handleDeleteFile = (fileName: string) => {
    if (!confirm(`آیا از حذف فایل "${fileName}" اطمینان دارید؟`)) return;
    setFiles((prev) => prev.filter((f) => f.name !== fileName));
  };

  const handleSimulatedUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];

    const newFile: StorageFile = {
      name: file.name,
      bucket: selectedBucket,
      contentType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      uploadedAt: 'لحظاتی پیش',
      url: `https://${project.slug}.localme.ir/_baas/v1/storage/${selectedBucket}/${file.name}`,
    };

    setFiles((prev) => [newFile, ...prev]);
    alert(`فایل "${file.name}" با موفقیت آپلود گردید.`);
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
            مدیریت باکت‌ها و ذخیره‌سازی فایل‌ها
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            ذخیره‌سازی انواع فایل‌ها و اسناد، بهینه‌سازی خودکار تصاویر و دسترسی امن با پیوندهای مستقیم دانلود.
          </p>
        </div>

        <button
          onClick={onOpenCreateBucketModal}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>ایجاد باکت جدید</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Buckets List */}
        <div className="lg:col-span-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="text-xs font-bold text-slate-900">
              باکت‌های ذخیره‌سازی ({buckets.length})
            </span>
          </div>

          <div className="space-y-1.5 max-h-[460px] overflow-y-auto">
            {buckets.length === 0 ? (
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
                <button
                  key={b.name}
                  onClick={() => setSelectedBucket(b.name)}
                  className={`w-full p-3 rounded-xl border text-right transition flex items-center justify-between ${
                    selectedBucket === b.name
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Folder className={`w-4 h-4 ${selectedBucket === b.name ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span className="text-xs font-mono font-bold truncate" dir="ltr">{b.name}</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-500">
                    {b.isPublic ? 'عمومی' : 'خصوصی'}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Files Explorer */}
        <div className="lg:col-span-8 p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <span className="text-xs font-bold text-slate-900">
                فایل‌های باکت: <span className="font-mono text-emerald-700" dir="ltr">{selectedBucket || 'انتخاب نشده'}</span>
              </span>
              <div className="text-[11px] text-slate-400 mt-0.5">
                تعداد فایل‌ها: {filteredFiles.length}
              </div>
            </div>

            {selectedBucket && (
              <label className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-medium text-xs cursor-pointer transition border border-emerald-200">
                <Upload className="w-3.5 h-3.5 text-emerald-600" />
                <span>آپلود فایل جدید</span>
                <input
                  type="file"
                  onChange={handleSimulatedUpload}
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
                {filteredFiles.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-xs text-slate-400">
                      {selectedBucket ? 'هیچ فایلی در این باکت وجود ندارد.' : 'ابتدا یک باکت انتخاب نمایید.'}
                    </td>
                  </tr>
                ) : (
                  filteredFiles.map((f) => (
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

          {copiedUrl && (
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="truncate">پیوند دانلود فایل کپی شد: {copiedUrl}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
