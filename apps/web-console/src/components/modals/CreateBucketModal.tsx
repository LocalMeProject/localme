import React, { useState } from 'react';
import { X, HardDrive, Shield, Globe } from 'lucide-react';
import { StorageBucket } from '../../types';

interface CreateBucketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (bucket: StorageBucket) => void;
}

export const CreateBucketModal: React.FC<CreateBucketModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [bucketName, setBucketName] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bucketName.trim()) return;

    onCreate({
      name: bucketName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      isPublic,
      filesCount: 0,
      totalSizeBytes: 0,
      createdAt: 'هم‌اکنون',
    });

    setBucketName('');
    setIsPublic(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-bucket-modal-title"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 text-slate-800 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
              <HardDrive className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 id="create-bucket-modal-title" className="text-base font-bold text-slate-900">
                ایجاد باکت ابری جدید
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                فضای اختصاصی برای ذخیره و مدیریت فایل‌ها
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="بستن"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-medium mb-1.5">نام باکت</label>
            <input
              type="text"
              required
              placeholder="user-avatars"
              value={bucketName}
              onChange={(e) => setBucketName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
              dir="ltr"
              className="w-full px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:outline-none text-slate-900 font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1.5">سطح دسترسی</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsPublic(false)}
                className={`p-3 rounded-xl border text-right transition flex items-center gap-2.5 ${
                  !isPublic
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Shield className="w-4 h-4 text-emerald-600" />
                <div>
                  <div className="font-bold text-xs">خصوصی (Private)</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">نیازمند امضای توکن امنیتی</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsPublic(true)}
                className={`p-3 rounded-xl border text-right transition flex items-center gap-2.5 ${
                  isPublic
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Globe className="w-4 h-4 text-emerald-600" />
                <div>
                  <div className="font-bold text-xs">عمومی (Public)</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">دسترسی مستقیم بدون احراز هویت</div>
                </div>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition shadow-xs"
            >
              ایجاد باکت
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
