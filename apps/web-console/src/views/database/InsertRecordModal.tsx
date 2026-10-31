import React, { useState } from 'react';
import { DatabaseColumn } from '../../types';
import { Plus, X, Code, FormInput } from 'lucide-react';
import { AlertModal } from '../../components/modals/AlertModal';

interface InsertRecordModalProps {
  isOpen: boolean;
  tableName: string;
  columns: DatabaseColumn[];
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => Promise<{ success: boolean; error?: string; code?: string; detail?: string }>;
}

export const InsertRecordModal: React.FC<InsertRecordModalProps> = ({
  isOpen,
  tableName,
  columns,
  onClose,
  onSubmit,
}) => {
  const [isRawJson, setIsRawJson] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [jsonText, setJsonText] = useState('{\n  \n}');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorModal, setErrorModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    code?: string;
    detail?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
  });

  if (!isOpen) return null;

  const handleInputChange = (colName: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [colName]: value,
    }));
  };

  const getColTypeCategory = (dataType: string) => {
    const dt = (dataType || '').toLowerCase();
    if (dt.includes('int') || dt.includes('serial') || dt.includes('decimal') || dt.includes('numeric') || dt.includes('float') || dt.includes('double')) {
      return 'number';
    }
    if (dt.includes('bool')) {
      return 'boolean';
    }
    if (dt.includes('json')) {
      return 'json';
    }
    if (dt.includes('timestamp') || dt.includes('date') || dt.includes('time')) {
      return 'datetime';
    }
    return 'text';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    let payload: Record<string, unknown> = {};

    if (isRawJson) {
      try {
        payload = JSON.parse(jsonText);
      } catch (err) {
        setIsSubmitting(false);
        setErrorModal({
          isOpen: true,
          title: 'فرمت JSON نامعتبر است',
          message: 'لطفاً ساختار داده را به صورت یک شیء معتبر JSON وارد نمایید.',
          detail: String(err),
        });
        return;
      }
    } else {
      for (const col of columns) {
        const val = formData[col.name];
        // Skip empty id if primary key so DB sequence can auto-generate
        if (col.isPrimaryKey && (!val || val.trim() === '')) {
          continue;
        }

        if (val === undefined || val === '') {
          if (!col.isNullable && !col.defaultValue && !col.isPrimaryKey) {
            setIsSubmitting(false);
            setErrorModal({
              isOpen: true,
              title: 'فیلد اجباری تکمیل نشده است',
              message: `ستون «${col.name}» نمی‌تواند تهی (NULL) باشد.`,
            });
            return;
          }
          continue;
        }

        const category = getColTypeCategory(col.dataType);
        if (category === 'number') {
          payload[col.name] = Number(val);
        } else if (category === 'boolean') {
          payload[col.name] = val === 'true';
        } else if (category === 'json') {
          try {
            payload[col.name] = JSON.parse(val);
          } catch {
            payload[col.name] = val;
          }
        } else {
          payload[col.name] = val;
        }
      }
    }

    const res = await onSubmit(payload);
    setIsSubmitting(false);

    if (res.success) {
      setFormData({});
      setJsonText('{\n  \n}');
      onClose();
    } else {
      setErrorModal({
        isOpen: true,
        title: 'خطا در ثبت رکورد جدید',
        message: res.error || 'عملیات ثبت سطر جدید در پایگاه داده با خطا مواجه شد.',
        code: res.code,
        detail: res.detail,
      });
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
        <div
          className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col"
          role="dialog"
          aria-modal="true"
        >
          {/* Header */}
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  افزودن رکورد جدید به جدول <span className="font-mono text-emerald-700" dir="ltr">{tableName}</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  مقادیر ستون‌ها را وارد کنید؛ فیلدهای با کلید اصلی یا پیش‌فرض در صورت خالی بودن خودکار مقداردهی می‌شوند.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsRawJson(!isRawJson)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  isRawJson
                    ? 'bg-slate-900 text-white border-slate-800'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                }`}
              >
                {isRawJson ? <FormInput className="w-3.5 h-3.5" /> : <Code className="w-3.5 h-3.5" />}
                <span>{isRawJson ? 'فرم ساختاریافته' : 'ورود مستقیم JSON'}</span>
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {isRawJson ? (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 block">
                    شیء داده (JSON Object):
                  </label>
                  <textarea
                    rows={12}
                    value={jsonText}
                    onChange={(e) => setJsonText(e.target.value)}
                    dir="ltr"
                    className="w-full p-3 font-mono text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    placeholder="{\n  &quot;title&quot;: &quot;Sample&quot;,\n  &quot;is_active&quot;: true\n}"
                  />
                  <p className="text-[11px] text-slate-500">
                    ستون‌های جدول: {columns.map((c) => c.name).join(', ')}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {columns.map((col) => {
                    const category = getColTypeCategory(col.dataType);
                    const isPK = col.isPrimaryKey;
                    const isAutoId = isPK && (col.name === 'id');

                    return (
                      <div key={col.name} className={`space-y-1.5 ${category === 'json' ? 'sm:col-span-2' : ''}`}>
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                            <span className="font-mono font-bold" dir="ltr">{col.name}</span>
                            {isPK && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-700 border border-amber-200 font-sans">
                                کلید اصلی
                              </span>
                            )}
                            {!col.isNullable && !isPK && (
                              <span className="text-rose-500 text-[10px] font-sans">* اجباری</span>
                            )}
                          </label>
                          <span className="text-[10px] font-mono text-slate-400 uppercase" dir="ltr">
                            {col.dataType}
                          </span>
                        </div>

                        {category === 'boolean' ? (
                          <select
                            value={formData[col.name] ?? ''}
                            onChange={(e) => handleInputChange(col.name, e.target.value)}
                            dir="ltr"
                            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-500"
                          >
                            <option value="">(پیش‌فرض / خالی)</option>
                            <option value="true">true (صحیح)</option>
                            <option value="false">false (غلط)</option>
                          </select>
                        ) : category === 'json' ? (
                          <textarea
                            rows={3}
                            value={formData[col.name] ?? ''}
                            onChange={(e) => handleInputChange(col.name, e.target.value)}
                            placeholder={'{ "key": "value" }'}
                            dir="ltr"
                            className="w-full p-2.5 font-mono text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-500"
                          />
                        ) : category === 'number' ? (
                          <input
                            type="number"
                            step="any"
                            value={formData[col.name] ?? ''}
                            onChange={(e) => handleInputChange(col.name, e.target.value)}
                            placeholder={isAutoId ? 'تولید خودکار توسط دیتابیس (اختیاری)' : 'مقدار عددی'}
                            dir="ltr"
                            className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-500"
                          />
                        ) : category === 'datetime' ? (
                          <input
                            type="text"
                            value={formData[col.name] ?? ''}
                            onChange={(e) => handleInputChange(col.name, e.target.value)}
                            placeholder="2026-10-31T12:00:00Z یا CURRENT_TIMESTAMP"
                            dir="ltr"
                            className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-500"
                          />
                        ) : (
                          <input
                            type="text"
                            value={formData[col.name] ?? ''}
                            onChange={(e) => handleInputChange(col.name, e.target.value)}
                            placeholder={isAutoId ? 'تولید خودکار شناسه در صورت خالی بودن' : ''}
                            dir="ltr"
                            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-500"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 transition"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs transition disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'در حال ثبت...' : 'افزودن رکورد'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      <AlertModal
        isOpen={errorModal.isOpen}
        title={errorModal.title}
        message={errorModal.message}
        code={errorModal.code}
        detail={errorModal.detail}
        type="error"
        onClose={() => setErrorModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </>
  );
};
