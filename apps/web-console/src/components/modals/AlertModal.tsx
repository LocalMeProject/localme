import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X, Copy, Check } from 'lucide-react';

export interface AlertModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  detail?: string | null;
  code?: string | null;
  type?: 'error' | 'success' | 'info';
  onClose: () => void;
}

export const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  title,
  message,
  detail,
  code,
  type = 'error',
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  if (!isOpen) return null;

  const handleCopyDetails = () => {
    const textToCopy = `Error: ${message}\nCode: ${code || 'N/A'}\nDetail: ${detail || 'N/A'}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isError = type === 'error';
  const isSuccess = type === 'success';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl ${
                  isError
                    ? 'bg-rose-50 text-rose-600 border border-rose-100'
                    : isSuccess
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                    : 'bg-blue-50 text-blue-600 border border-blue-100'
                }`}
              >
                {isError ? (
                  <AlertCircle className="w-5 h-5" />
                ) : isSuccess ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <Info className="w-5 h-5" />
                )}
              </div>
              <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              aria-label="بستن"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">{message}</p>

          {(code || detail) && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                className="text-[11px] font-medium text-slate-500 hover:text-slate-700 flex items-center gap-1 transition"
              >
                <span>{showTechnicalDetails ? 'پنهان کردن جزییات فنی' : 'نمایش جزییات فنی برای بررسی'}</span>
              </button>

              {showTechnicalDetails && (
                <div className="p-3 rounded-lg bg-slate-900 text-slate-200 text-xs font-mono space-y-1.5 overflow-x-auto text-left" dir="ltr">
                  {code && (
                    <div className="text-amber-400 font-semibold text-[11px]">
                      SQLSTATE: {code}
                    </div>
                  )}
                  {detail && (
                    <div className="text-slate-300 text-[11px] leading-relaxed break-all">
                      {detail}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2.5">
          {(code || detail) ? (
            <button
              type="button"
              onClick={handleCopyDetails}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">کپی شد</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>کپی جزییات خطا</span>
                </>
              )}
            </button>
          ) : <div />}

          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2 rounded-lg text-xs font-semibold text-white shadow-xs transition ${
              isError
                ? 'bg-rose-600 hover:bg-rose-700'
                : isSuccess
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-slate-800 hover:bg-slate-900'
            }`}
          >
            متوجه شدم
          </button>
        </div>
      </div>
    </div>
  );
};
