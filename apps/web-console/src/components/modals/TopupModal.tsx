import React, { useState } from 'react';
import { X, Wallet, CreditCard } from 'lucide-react';

interface TopupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTopup: (amountIrr: number, gateway: string) => void;
}

export const TopupModal: React.FC<TopupModalProps> = ({
  isOpen,
  onClose,
  onTopup,
}) => {
  const [selectedToman, setSelectedToman] = useState<number>(50000);
  const [customToman, setCustomToman] = useState<string>('');
  const [gateway, setGateway] = useState<string>('ZARINPAL');

  if (!isOpen) return null;

  const quickAmounts = [20000, 50000, 100000, 200000, 500000];

  const handleSelectQuick = (amount: number) => {
    setSelectedToman(amount);
    setCustomToman('');
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    setCustomToman(val);
    if (val) setSelectedToman(parseInt(val, 10));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedToman || selectedToman < 5000) {
      alert('حداقل مبلغ افزایش اعتبار ۵٬۰۰۰ تومان است.');
      return;
    }

    onTopup(selectedToman * 10, gateway);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="topup-modal-title"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 text-slate-800 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Wallet className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 id="topup-modal-title" className="text-base font-bold text-slate-900">
                افزایش اعتبار کیف پول پروژه
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                شارژ موجودی ریالی از طریق درگاه‌های پرداخت عضو شتاب
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
            <label className="block text-slate-700 font-medium mb-2">انتخاب مبلغ شارژ (تومان)</label>
            <div className="grid grid-cols-3 gap-2">
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handleSelectQuick(amt)}
                  className={`py-2 px-3 rounded-lg border text-xs font-medium transition ${
                    selectedToman === amt && !customToman
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-bold'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                  dir="ltr"
                >
                  {amt.toLocaleString('fa-IR')} تومان
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1.5">مبلغ دلخواه (تومان)</label>
            <input
              type="text"
              placeholder="مثال: ۷۵۰۰۰"
              value={customToman}
              onChange={handleCustomChange}
              dir="ltr"
              className="w-full px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:outline-none text-slate-900 font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1.5">انتخاب درگاه پرداخت</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setGateway('ZARINPAL')}
                className={`p-2.5 rounded-lg border text-right transition flex items-center gap-2 ${
                  gateway === 'ZARINPAL'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-bold'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <CreditCard className="w-4 h-4 text-emerald-600" />
                <span>زرین‌پال</span>
              </button>

              <button
                type="button"
                onClick={() => setGateway('BEHPARDAKHT')}
                className={`p-2.5 rounded-lg border text-right transition flex items-center gap-2 ${
                  gateway === 'BEHPARDAKHT'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-bold'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <CreditCard className="w-4 h-4 text-emerald-600" />
                <span>به‌پرداخت ملت</span>
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
              انتقال به درگاه پرداخت
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
