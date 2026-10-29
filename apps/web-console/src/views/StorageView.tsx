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
      <div className="p-5 rounded-2xl bg-[#171717] border border-[#242424] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-[#3ECF8E]/10 text-[#3ECF8E] border border-[#3ECF8E]/30">
              S3 / TUSDOTNET BLOB STORAGE
            </span>
            <span className="text-xs text-zinc-400 font-mono">
              PROJECT: {project.slug}
            </span>
          </div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-[#3ECF8E]" />
            ذخیره‌سازی ابری چندرسانه‌ای (Blob Storage)
          </h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-2xl leading-relaxed">
            پشتیبانی از آبجکت‌استوریج سازگار با S3، ریلود تکه‌ای TUS و تغییر سایز بلادرنگ تصاویر با ImageSharp.
          </p>
        </div>

        <button
          onClick={onOpenCreateBucketModal}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#3ECF8E] hover:bg-[#34b27b] text-black font-semibold text-xs transition shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>ساخت باکت جدید</span>
        </button>
      </div>

      {/* Multi-Adapter Status Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <div className="p-3.5 rounded-xl bg-[#171717] border border-[#242424] flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-white">S3 Object Storage Adapter</div>
            <div className="text-[10px] text-zinc-500 font-mono">ایران (مرکز داده آسیاتک)</div>
          </div>
          <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-[#3ECF8E]/10 text-[#3ECF8E] border border-[#3ECF8E]/30">
            CONNECTED
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-[#171717] border border-[#242424] flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-white">TUS Protocol Chunk Resumption</div>
            <div className="text-[10px] text-zinc-500 font-mono">TusDotNet Middleware</div>
          </div>
          <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-[#3ECF8E]/10 text-[#3ECF8E] border border-[#3ECF8E]/30">
            ENABLED
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-[#171717] border border-[#242424] flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-white">ImageSharp WebP Optimization</div>
            <div className="text-[10px] text-zinc-500 font-mono">In-Process WebP & WebM</div>
          </div>
          <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-[#3ECF8E]/10 text-[#3ECF8E] border border-[#3ECF8E]/30">
            ACTIVE
          </span>
        </div>
      </div>

      {/* Main Grid: Buckets and Files */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Bucket List */}
        <div className="lg:col-span-4 space-y-3">
          <div className="p-3.5 rounded-xl bg-[#171717] border border-[#242424] space-y-3">
            <div className="text-xs font-semibold text-zinc-400 flex items-center justify-between">
              <span>باکت‌های پروژه ({buckets.length})</span>
              <span className="text-[10px] text-zinc-500 font-mono">S3 Protocol</span>
            </div>

            <div className="space-y-2 max-h-[480px] overflow-y-auto">
              {buckets.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-500 rounded-xl border border-dashed border-[#242424]">
                  هیچ باکتی ایجاد نشده است
                </div>
              ) : (
                buckets.map((b) => (
                  <div
                    key={b.name}
                    onClick={() => setSelectedBucket(b.name)}
                    className={`cursor-pointer p-3.5 rounded-xl border transition ${
                      selectedBucket === b.name
                        ? 'bg-[#1f1f1f] border-[#3ECF8E]/40 shadow-sm'
                        : 'bg-[#171717] border-[#242424] hover:border-[#3ECF8E]/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs font-bold text-[#3ECF8E] dir-ltr">{b.name}</span>
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase font-mono ${
                          b.isPublic
                            ? 'bg-[#3ECF8E]/10 text-[#3ECF8E] border border-[#3ECF8E]/30'
                            : 'bg-[#1f1f1f] text-zinc-400 border border-[#2e2e2e]'
                        }`}
                      >
                        {b.isPublic ? 'Public' : 'Private'}
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-400 font-mono flex items-center justify-between mt-1.5">
                      <span>{b.filesCount} files</span>
                      <span>{(b.totalSizeBytes / (1024 * 1024)).toFixed(1)} MB</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* File Explorer & Uploader */}
        <div className="lg:col-span-8 p-5 rounded-2xl bg-[#171717] border border-[#242424] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#242424] pb-3">
            <div>
              <span className="text-xs font-bold text-white">
                کاوشگر فایل‌های باکت: <span className="font-mono text-[#3ECF8E]">{selectedBucket || 'بدون باکت'}</span>
              </span>
              <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                تعداد فایل‌ها: {filteredFiles.length}
              </div>
            </div>

            {/* Upload Button */}
            <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#1f1f1f] hover:bg-[#282828] text-zinc-200 font-semibold text-xs transition border border-[#2e2e2e] shadow-sm">
              <Upload className="w-3.5 h-3.5 text-[#3ECF8E]" />
              <span>آپلود فایل به باکت</span>
              <input type="file" onChange={handleSimulatedUpload} className="hidden" />
            </label>
          </div>

          {/* Files Table */}
          <div className="overflow-x-auto rounded-xl border border-[#242424]">
            <table className="w-full text-left text-xs font-mono" dir="ltr">
              <thead>
                <tr className="border-b border-[#242424] bg-[#1a1a1a] text-zinc-400">
                  <th className="py-2.5 px-3">File Name</th>
                  <th className="py-2.5 px-3">Content Type</th>
                  <th className="py-2.5 px-3">Size</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#242424]">
                {filteredFiles.map((f) => (
                  <tr key={f.name} className="hover:bg-[#1f1f1f] transition">
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-[#3ECF8E]" />
                        <span className="font-bold text-white">{f.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-zinc-400">{f.contentType}</td>
                    <td className="py-2.5 px-3 text-zinc-300">{(f.sizeBytes / 1024).toFixed(1)} KB</td>
                    <td className="py-2.5 px-3 text-zinc-400">{f.uploadedAt}</td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleCopyUrl(f.url)}
                          className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-[#1f1f1f]"
                          title="Copy Link"
                        >
                          {copiedUrl === f.url ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#3ECF8E]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteFile(f.name)}
                          className="p-1 rounded-full text-zinc-500 hover:text-red-400 hover:bg-[#1f1f1f]"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredFiles.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-zinc-500 font-sans" dir="rtl">
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
