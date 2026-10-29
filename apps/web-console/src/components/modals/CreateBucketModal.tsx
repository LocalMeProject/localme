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

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-bucket-modal-title"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-[#171717] border border-[#242424] shadow-2xl p-6 text-zinc-100 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-[#242424]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#3ECF8E]/10 border border-[#3ECF8E]/20 flex items-center justify-center text-[#3ECF8E]">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h3 id="create-bucket-modal-title" className="text-base font-bold text-white">ساخت باکت ابری جدید</h3>
              <p className="text-xs text-zinc-400">پشتیبانی از آپلود ادامه‌دار TUS و تبدیل خودکار عکس‌ها</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="بستن"
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1f1f1f] transition-colors"
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
              className="w-full px-3.5 py-2 rounded-xl bg-[#0f0f0f] border border-[#242424] focus:border-[#3ECF8E] focus:outline-none text-zinc-100 font-mono"
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1.5">آداپتور و محل ذخیره‌سازی</label>
            <select
              value={adapter}
              onChange={(e) => setAdapter(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-[#0f0f0f] border border-[#242424] focus:border-[#3ECF8E] focus:outline-none text-zinc-100 font-mono"
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
                    ? 'border-[#3ECF8E]/50 bg-[#3ECF8E]/10 text-[#3ECF8E]'
                    : 'border-[#242424] bg-[#0f0f0f] text-zinc-400 hover:bg-[#1a1a1a]'
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
                    ? 'border-[#3ECF8E]/50 bg-[#3ECF8E]/10 text-[#3ECF8E]'
                    : 'border-[#242424] bg-[#0f0f0f] text-zinc-400 hover:bg-[#1a1a1a]'
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

          <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-[#242424]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-[#242424] hover:bg-[#2e2e2e] text-[#ededed] border border-[#2e2e2e] font-medium text-xs px-4 py-2 transition-colors"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-full bg-[#3ECF8E] hover:bg-[#34b27b] text-[#0f0f0f] font-medium text-xs px-5 py-2 transition-colors"
            >
              ایجاد باکت
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
