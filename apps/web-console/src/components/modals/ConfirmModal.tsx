import React, { useState, useEffect } from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
  requiredConfirmationText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'تایید',
  cancelLabel = 'انصراف',
  isDanger = false,
  requiredConfirmationText,
  onConfirm,
  onCancel,
}) => {
  const [typedText, setTypedText] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTypedText('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const isConfirmationMatched =
    !requiredConfirmationText ||
    typedText.trim() === requiredConfirmationText.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl ${
                  isDanger
                    ? 'bg-rose-50 text-rose-600 border border-rose-100'
                    : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                }`}
              >
                {isDanger ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <Info className="w-5 h-5" />
                )}
              </div>
              <h3
                id="confirm-modal-title"
                className="text-sm font-bold text-slate-900"
              >
                {title}
              </h3>
            </div>
            <button
              onClick={onCancel}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              aria-label="بستن"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">{message}</p>

          {requiredConfirmationText && (
            <div className="space-y-2 pt-1">
              <label className="text-[11px] font-medium text-slate-600">
                جهت تایید، عبارت{' '}
                <span className="font-mono font-bold text-rose-600 bg-rose-50 px-1 py-0.5 rounded border border-rose-200">
                  {requiredConfirmationText}
                </span>{' '}
                را تایپ کنید:
              </label>
              <input
                type="text"
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                placeholder={requiredConfirmationText}
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                dir="ltr"
                autoFocus
              />
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 transition"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={!isConfirmationMatched}
            onClick={() => {
              if (isConfirmationMatched) onConfirm();
            }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold text-white shadow-xs transition disabled:opacity-40 disabled:cursor-not-allowed ${
              isDanger
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
