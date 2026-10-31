import React, { useState, useEffect, useCallback } from 'react';
import { Archive, RefreshCw, Plus, Download, RotateCcw, Trash2 } from 'lucide-react';
import { ConfirmModal } from '../../components/modals/ConfirmModal';
import { AlertModal } from '../../components/modals/AlertModal';

export interface SnapshotItem {
  id: string;
  type: string;
  sizeBytes: number;
  status: string;
  createdAtUtc: string;
}

export interface DatabaseBackupsViewProps {
  projectSlug: string;
  onRestoreCompleted?: () => void;
}

export const DatabaseBackupsView: React.FC<DatabaseBackupsViewProps> = ({
  projectSlug,
  onRestoreCompleted,
}) => {
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false);
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  const [restoringSnapshotId, setRestoringSnapshotId] = useState<string | null>(null);
  const [snapshotToRestore, setSnapshotToRestore] = useState<string | null>(null);
  const [snapshotToDelete, setSnapshotToDelete] = useState<string | null>(null);
  const [deletingSnapshotId, setDeletingSnapshotId] = useState<string | null>(null);

  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    detail?: string;
    code?: string;
    type: 'error' | 'success' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });

  const fetchSnapshots = useCallback(async () => {
    setIsLoadingSnapshots(true);
    try {
      const res = await fetch(`/_baas/v1/${projectSlug}/db/snapshots`);
      if (res.ok) {
        const data = await res.json();
        setSnapshots(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to load snapshots:', err);
    } finally {
      setIsLoadingSnapshots(false);
    }
  }, [projectSlug]);

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  const handleCreateSnapshot = async () => {
    setIsCreatingSnapshot(true);
    try {
      const res = await fetch(`/_baas/v1/${projectSlug}/db/snapshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'دستی فوری' }),
      });
      if (res.ok) {
        await fetchSnapshots();
        setAlertState({
          isOpen: true,
          title: 'تهیه اسنپ‌شات موفق',
          message: 'اسنپ‌شات جدید پایگاه داده با موفقیت ایجاد گردید.',
          type: 'success',
        });
      } else {
        const err = await res.json().catch(() => null);
        setAlertState({
          isOpen: true,
          title: 'خطا در تهیه اسنپ‌شات',
          message: err?.error || 'تهیه اسنپ‌شات با خطا مواجه شد.',
          code: err?.code,
          detail: err?.detail,
          type: 'error',
        });
      }
    } catch (err) {
      setAlertState({
        isOpen: true,
        title: 'خطای ارتباط با سرور',
        message: 'خطا در ارسال درخواست تهیه اسنپ‌شات.',
        detail: String(err),
        type: 'error',
      });
    } finally {
      setIsCreatingSnapshot(false);
    }
  };

  const executeRestoreSnapshot = async (snapshotId: string) => {
    setSnapshotToRestore(null);
    setRestoringSnapshotId(snapshotId);
    try {
      const res = await fetch(`/_baas/v1/${projectSlug}/db/snapshots/${snapshotId}/restore`, {
        method: 'POST',
      });
      if (res.ok) {
        await fetchSnapshots();
        onRestoreCompleted?.();
        setAlertState({
          isOpen: true,
          title: 'بازیابی موفق پایگاه داده',
          message: `اسنپ‌شات «${snapshotId}» با موفقیت در پایگاه داده بازنویسی شد.`,
          type: 'success',
        });
      } else {
        const err = await res.json().catch(() => null);
        setAlertState({
          isOpen: true,
          title: 'خطا در بازیابی اسنپ‌شات',
          message: err?.error || 'بازیابی اسنپ‌شات با خطا مواجه شد.',
          code: err?.code,
          detail: err?.detail,
          type: 'error',
        });
      }
    } catch (err) {
      setAlertState({
        isOpen: true,
        title: 'خطای ارتباط با سرور',
        message: 'خطا در اجرای بازیابی اسنپ‌شات.',
        detail: String(err),
        type: 'error',
      });
    } finally {
      setRestoringSnapshotId(null);
    }
  };

  const executeDeleteSnapshot = async (snapshotId: string) => {
    setSnapshotToDelete(null);
    setDeletingSnapshotId(snapshotId);
    try {
      const res = await fetch(`/_baas/v1/${projectSlug}/db/snapshots/${snapshotId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await fetchSnapshots();
        setAlertState({
          isOpen: true,
          title: 'حذف اسنپ‌شات موفق',
          message: `اسنپ‌شات «${snapshotId}» با موفقیت حذف گردید.`,
          type: 'success',
        });
      } else {
        const err = await res.json().catch(() => null);
        setAlertState({
          isOpen: true,
          title: 'خطا در حذف اسنپ‌شات',
          message: err?.error || 'حذف اسنپ‌شات با خطا مواجه شد.',
          code: err?.code,
          detail: err?.detail,
          type: 'error',
        });
      }
    } catch (err) {
      setAlertState({
        isOpen: true,
        title: 'خطای ارتباط با سرور',
        message: 'خطا در ارسال درخواست حذف اسنپ‌شات.',
        detail: String(err),
        type: 'error',
      });
    } finally {
      setDeletingSnapshotId(null);
    }
  };

  return (
    <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <Archive className="w-5 h-5 text-emerald-600" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">نسخه‌های پشتیبان و اسنپ‌شات‌های پایگاه داده</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              پشتیبان‌گیری خودکار ۳ روزه با قابلیت بازیابی در زمان (PITR) و دانلود مستقیم اسنپ‌شات ساختار و داده‌ها.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchSnapshots}
            disabled={isLoadingSnapshots}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSnapshots ? 'animate-spin' : ''}`} />
            <span>بازخوانی</span>
          </button>
          <button
            onClick={handleCreateSnapshot}
            disabled={isCreatingSnapshot}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition shadow-xs disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isCreatingSnapshot ? 'در حال تهیه اسنپ‌شات...' : 'تهیه اسنپ‌شات جدید'}</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-xs text-right">
          <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-4">شناسه اسنپ‌شات</th>
              <th className="py-2.5 px-4">نوع عملیات</th>
              <th className="py-2.5 px-4">حجم تخمینی</th>
              <th className="py-2.5 px-4">وضعیت</th>
              <th className="py-2.5 px-4">زمان ثبت (UTC)</th>
              <th className="py-2.5 px-4 text-center">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {snapshots.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  {isLoadingSnapshots ? 'در حال دریافت اطلاعات اسنپ‌شات‌ها...' : 'هیچ اسنپ‌شاتی برای این پروژه ثبت نشده است.'}
                </td>
              </tr>
            ) : (
              snapshots.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/70 transition">
                  <td className="py-2.5 px-4 font-mono font-medium text-slate-900" dir="ltr">
                    {s.id}
                  </td>
                  <td className="py-2.5 px-4 text-slate-700">{s.type}</td>
                  <td className="py-2.5 px-4 font-mono text-slate-600" dir="ltr">
                    {(s.sizeBytes / 1024).toFixed(1)} KB
                  </td>
                  <td className="py-2.5 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {s.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 font-mono text-slate-500" dir="ltr">
                    {new Date(s.createdAtUtc).toLocaleString('fa-IR')}
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="flex items-center justify-center gap-2">
                      <a
                        href={`/_baas/v1/${projectSlug}/db/snapshots/${s.id}/download`}
                        download
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>دانلود</span>
                      </a>
                      <button
                        onClick={() => setSnapshotToRestore(s.id)}
                        disabled={restoringSnapshotId === s.id || deletingSnapshotId === s.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-medium transition disabled:opacity-50"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${restoringSnapshotId === s.id ? 'animate-spin' : ''}`} />
                        <span>{restoringSnapshotId === s.id ? 'در حال بازیابی...' : 'بازیابی داده'}</span>
                      </button>
                      <button
                        onClick={() => setSnapshotToDelete(s.id)}
                        disabled={deletingSnapshotId === s.id || restoringSnapshotId === s.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-medium transition disabled:opacity-50"
                        title="حذف دائم اسنپ‌شات"
                      >
                        <Trash2 className={`w-3.5 h-3.5 ${deletingSnapshotId === s.id ? 'animate-spin' : ''}`} />
                        <span>{deletingSnapshotId === s.id ? 'در حال حذف...' : 'حذف'}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Accessible Confirm Modal for Snapshot Restore */}
      <ConfirmModal
        isOpen={Boolean(snapshotToRestore)}
        title="بازیابی اسنپ‌شات پایگاه داده"
        message={`آیا از بازیابی اسنپ‌شات «${snapshotToRestore}» اطمینان دارید؟ تمامی داده‌های فعلی پایگاه داده بازنویسی خواهند شد.`}
        confirmLabel="بازیابی اطلاعات"
        isDanger={true}
        onConfirm={() => {
          if (snapshotToRestore) {
            executeRestoreSnapshot(snapshotToRestore);
          }
        }}
        onCancel={() => setSnapshotToRestore(null)}
      />

      {/* Accessible Confirm Modal for Snapshot Deletion */}
      <ConfirmModal
        isOpen={Boolean(snapshotToDelete)}
        title="حذف اسنپ‌شات پایگاه داده"
        message={`آیا از حذف دائم اسنپ‌شات «${snapshotToDelete}» اطمینان دارید؟ این فایل پشتیبان به صورت غیرقابل بازگشت پاک خواهد شد.`}
        confirmLabel="حذف دائم اسنپ‌شات"
        isDanger={true}
        onConfirm={() => {
          if (snapshotToDelete) {
            executeDeleteSnapshot(snapshotToDelete);
          }
        }}
        onCancel={() => setSnapshotToDelete(null)}
      />

      {/* Feedback Alert Modal */}
      <AlertModal
        isOpen={alertState.isOpen}
        title={alertState.title}
        message={alertState.message}
        detail={alertState.detail}
        code={alertState.code}
        type={alertState.type}
        onClose={() => setAlertState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
