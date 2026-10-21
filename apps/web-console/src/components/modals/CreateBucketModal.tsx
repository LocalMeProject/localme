import React, { useState } from 'react';
import { X, HardDrive, Lock, Globe } from 'lucide-react';
import { StorageBucket } from '../../types';

interface CreateBucketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (bucket: Omit<StorageBucket, 'filesCount' | 'totalSizeBytes' | 'createdAt'>) => void;
}

export const CreateBucketModal: React.FC<CreateBucketModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [adapter, setAdapter] = useState('local');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate({
      name: name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      isPublic,
    });
    setName('');
    setIsPublic(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl p-6 text-zinc-100 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100">ساخت باکت ابری جدید</h3>
              <p className="text-xs text-zinc-400">پشتیبانی از آپلود ادامه‌دار TUS و تبدیل خودکار عکس‌ها</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-zinc-300 font-medium mb-1.5">نام باکت (Bucket Name) *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
              placeholder="مثال: user-avatars یا media-files"
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 focus:border-amber-500 focus:outline-none text-zinc-100 font-mono"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1.5">آداپتور و محل ذخیره‌سازی</label>
            <select
              value={adapter}
              onChange={(e) => setAdapter(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 focus:border-amber-500 focus:outline-none text-zinc-100 font-mono"
            >
              <option value="local">Local Disk (NVMe ایزوله سرور LocalMe)</option>
              <option value="runflare">Runflare Storage Adapter (S3-Compatible ایران)</option>
              <option value="arvan">ArvanCloud S3 Object Storage</option>
              <option value="minio">MinIO Self-Hosted Cluster</option>
            </select>
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-2">سطح دسترسی باکت</label>
            <div className="grid grid-cols-2 gap-3">
              <div
                onClick={() => setIsPublic(false)}
                className={`cursor-pointer p-3 rounded-xl border flex items-center space-x-2.5 transition ${
                  !isPublic
                    ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:bg-zinc-900'
                }`}
              >
                <Lock className="w-4 h-4" />
                <div>
                  <div className="font-semibold text-xs">خصوصی (Private)</div>
                  <div className="text-[10px] opacity-70">فقط با توکن احراز هویت شده</div>
                </div>
              </div>
              <div
                onClick={() => setIsPublic(true)}
                className={`cursor-pointer p-3 rounded-xl border flex items-center space-x-2.5 transition ${
                  isPublic
                    ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:bg-zinc-900'
                }`}
              >
                <Globe className="w-4 h-4" />
                <div>
                  <div className="font-semibold text-xs">عمومی (Public)</div>
                  <div className="text-[10px] opacity-70">لینک مستقیم برای دانلود همگانی</div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-300 font-medium transition"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold transition shadow-lg shadow-amber-500/10"
            >
              ایجاد باکت
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
