import React from 'react';
import { Archive, RefreshCw, Plus, CheckCircle2, AlertTriangle, Download, RotateCcw } from 'lucide-react';
import { SnapshotItem } from '../DatabaseView';

export interface DatabaseBackupsViewProps {
  projectSlug: string;
  snapshots: SnapshotItem[];
  isLoadingSnapshots: boolean;
  isCreatingSnapshot: boolean;
  restoringSnapshotId: string | null;
  backupMessage: string | null;
  backupError: string | null;
  onFetchSnapshots: () => void;
  onCreateSnapshot: () => void;
  onRestoreSnapshot: (id: string) => void;
}

export const DatabaseBackupsView: React.FC<DatabaseBackupsViewProps> = ({
  projectSlug,
  snapshots,
  isLoadingSnapshots,
  isCreatingSnapshot,
  restoringSnapshotId,
  backupMessage,
  backupError,
  onFetchSnapshots,
  onCreateSnapshot,
  onRestoreSnapshot,
}) => {
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
            onClick={onFetchSnapshots}
            disabled={isLoadingSnapshots}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSnapshots ? 'animate-spin' : ''}`} />
            <span>بازخوانی</span>
          </button>
          <button
            onClick={onCreateSnapshot}
            disabled={isCreatingSnapshot}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition shadow-xs disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isCreatingSnapshot ? 'در حال تهیه اسنپ‌شات...' : 'تهیه اسنپ‌شات جدید'}</span>
          </button>
        </div>
      </div>

      {backupMessage && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{backupMessage}</span>
        </div>
      )}

      {backupError && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{backupError}</span>
        </div>
      )}

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
                        <Download className="w-3 h-3" />
                        <span>دانلود</span>
                      </a>
                      <button
                        onClick={() => onRestoreSnapshot(s.id)}
                        disabled={restoringSnapshotId === s.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-medium transition disabled:opacity-50"
                      >
                        <RotateCcw className={`w-3 h-3 ${restoringSnapshotId === s.id ? 'animate-spin' : ''}`} />
                        <span>{restoringSnapshotId === s.id ? 'در حال بازیابی...' : 'بازیابی داده'}</span>
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
  );
};
