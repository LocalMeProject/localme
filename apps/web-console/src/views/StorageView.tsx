import React, { useState } from 'react';
import { Project, StorageBucket, StorageFile } from '../types';
import {
  HardDrive,
  Upload,
  FileText,
  Copy,
  Trash2,
  CheckCircle2,
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
    alert(`فایل "${file.name}" با موفقیت در باکت "${selectedBucket}" آپلود شد.`);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-amber-400" />
            ذخیره‌سازی ابری چندرسانه‌ای (Blob Storage)
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            پشتیبانی از آداپتورهای داخلی Runflare، ابر آروان (ArvanCloud)، MinIO و دیسک محلی با پروتکل آپلود TUS.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onOpenCreateBucketModal}
            className="px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs transition shadow-sm"
          >
            + ساخت باکت جدید
          </button>
        </div>
      </div>

      {/* Multi-Adapter Status Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-zinc-200">Runflare Object Storage</div>
            <div className="text-[10px] text-zinc-500 font-mono">ایران (مرکز داده آسیاتک)</div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            متصل
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-zinc-200">Arvan S3 Compatible</div>
            <div className="text-[10px] text-zinc-500 font-mono">ایران (شهریار / بامداد)</div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            آماده
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-zinc-200">ImageSharp Dynamic Resize</div>
            <div className="text-[10px] text-zinc-500 font-mono">In-Process WebP & WebM</div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
            فعال
          </span>
        </div>
      </div>

      {/* Main Grid: Buckets and Files */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Bucket List */}
        <div className="lg:col-span-4 space-y-3">
          <div className="text-xs font-semibold text-zinc-400 flex items-center justify-between px-1">
            <span>باکت‌های پروژه ({buckets.length})</span>
            <span className="text-[10px] text-zinc-500 font-mono">TusDotNet v1.0.0</span>
          </div>

          <div className="space-y-2">
            {buckets.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-500 rounded-xl border border-dashed border-zinc-800">
                هیچ باکتی ایجاد نشده است
              </div>
            ) : (
              buckets.map((b) => (
                <div
                  key={b.name}
                  onClick={() => setSelectedBucket(b.name)}
                  className={`cursor-pointer p-3.5 rounded-xl border transition ${
                    selectedBucket === b.name
                      ? 'bg-zinc-850 border-amber-500/50 shadow-sm'
                      : 'bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-850/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-bold text-amber-400">{b.name}</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                        b.isPublic
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {b.isPublic ? 'Public' : 'Private'}
                    </span>
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono flex items-center justify-between mt-1.5">
                    <span>{b.filesCount} فایل</span>
                    <span>حجم: {(b.totalSizeBytes / (1024 * 1024)).toFixed(1)} MB</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* File Explorer & Uploader */}
        <div className="lg:col-span-8 p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
            <div>
              <span className="text-xs font-bold text-zinc-200">
                کاوشگر فایل‌های باکت: <span className="font-mono text-amber-400">{selectedBucket || 'بدون باکت'}</span>
              </span>
              <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                تعداد فایل‌ها: {filteredFiles.length}
              </div>
            </div>

            {/* Upload Button */}
            <label className="cursor-pointer flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs transition border border-zinc-700/60 shadow-sm">
              <Upload className="w-3.5 h-3.5 text-amber-400" />
              <span>آپلود فایل به باکت</span>
              <input type="file" onChange={handleSimulatedUpload} className="hidden" />
            </label>
          </div>

          {/* Files Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-zinc-800/60 text-zinc-400">
                  <th className="py-2.5 px-3">نام فایل</th>
                  <th className="py-2.5 px-3">نوع محتوا</th>
                  <th className="py-2.5 px-3">حجم</th>
                  <th className="py-2.5 px-3">تاریخ</th>
                  <th className="py-2.5 px-3 text-right">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {filteredFiles.map((f) => (
                  <tr key={f.name} className="hover:bg-zinc-850/30">
                    <td className="py-2.5 px-3">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-3.5 h-3.5 text-amber-400" />
                        <span className="font-bold text-zinc-200">{f.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-zinc-400">{f.contentType}</td>
                    <td className="py-2.5 px-3 text-zinc-300">{(f.sizeBytes / 1024).toFixed(1)} KB</td>
                    <td className="py-2.5 px-3 text-zinc-400">{f.uploadedAt}</td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => handleCopyUrl(f.url)}
                          className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                          title="کپی لینک"
                        >
                          {copiedUrl === f.url ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteFile(f.name)}
                          className="p-1 rounded text-red-400 hover:bg-zinc-800"
                          title="حذف فایل"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredFiles.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-zinc-500">
                      فایلی در این باکت وجود ندارد. از دکمه آپلود فایل برای شروع استفاده کنید.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
