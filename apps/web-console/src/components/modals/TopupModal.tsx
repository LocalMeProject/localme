import React, { useState } from 'react';
import { X, Wallet, CreditCard, ShieldCheck } from 'lucide-react';

interface TopupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTopup: (amountIrr: number, gateway: string) => void;
}

const PRESET_AMOUNTS = [
  { toman: 50_000, label: '۵۰ هزار تومان' },
  { toman: 100_000, label: '۱۰۰ هزار تومان' },
  { toman: 500_000, label: '۵۰۰ هزار تومان' },
  { toman: 1_000_000, label: '۱ میلیون تومان' },
  { toman: 5_000_000, label: '۵ میلیون تومان' },
];

export const TopupModal: React.FC<TopupModalProps> = ({
  isOpen,
  onClose,
  onTopup,
}) => {
  const [amountToman, setAmountToman] = useState<number>(500_000);
  const [gateway, setGateway] = useState<'ZARINPAL' | 'BEHPARDAKHT' | 'SEP' | 'SADAD'>('ZARINPAL');

  if (!isOpen) return null;

  const amountIrr = amountToman * 10;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amountIrr <= 0) return;
    onTopup(amountIrr, gateway);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl p-6 text-zinc-100 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100">شارژ کیف پول ریالی پروژه (IRR)</h3>
              <p className="text-xs text-zinc-400">پرداخت امن از طریق درگاه‌های شاپرک با کارت‌های عضو شتاب</p>
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
            <label className="block text-zinc-300 font-medium mb-2">مبلغ مورد نظر (تومان)</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
              {PRESET_AMOUNTS.map((preset) => (
                <button
                  type="button"
                  key={preset.toman}
                  onClick={() => setAmountToman(preset.toman)}
                  className={`p-2.5 rounded-xl border text-center transition ${
                    amountToman === preset.toman
                      ? 'border-amber-500 bg-amber-500/10 text-amber-400 font-bold'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:bg-zinc-900'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <input
                type="number"
                min="10000"
                step="5000"
                value={amountToman}
                onChange={(e) => setAmountToman(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 focus:border-amber-500 focus:outline-none text-zinc-100 font-mono text-sm"
              />
              <span className="absolute left-3 top-2.5 text-zinc-500 text-xs">تومان</span>
            </div>

            <div className="mt-1.5 flex items-center justify-between text-[11px] text-zinc-400 font-mono">
              <span>معادل در دفترکل ریالی (IRR BigInt):</span>
              <span className="text-amber-400 font-bold">{amountIrr.toLocaleString('fa-IR')} ریال</span>
            </div>
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1.5">انتخاب درگاه پرداخت شاپرک</label>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { id: 'ZARINPAL', name: 'زرین‌پال (Zarinpal ZarinGate)' },
                { id: 'BEHPARDAKHT', name: 'به‌پرداخت ملت (Mellat PSP)' },
                { id: 'SEP', name: 'پرداخت الکترونیک سامان (SEP)' },
                { id: 'SADAD', name: 'سداد بانک ملی (Sadad)' },
              ].map((gw) => (
                <div
                  key={gw.id}
                  onClick={() => setGateway(gw.id as any)}
                  className={`cursor-pointer p-3 rounded-xl border flex items-center space-x-2 transition ${
                    gateway === gw.id
                      ? 'border-amber-500/60 bg-amber-500/10 text-amber-300'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:bg-zinc-900'
                  }`}
                >
                  <CreditCard className="w-4 h-4 shrink-0 text-amber-400" />
                  <span className="text-xs font-medium">{gw.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center space-x-2 text-[11px] text-zinc-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>آی‌پی سرور شما در فهرست سفید درگاه‌های بانکی شاپرک (NAT 2.180.12.94) قرار دارد.</span>
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
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold transition shadow-lg shadow-amber-500/10 flex items-center space-x-1.5"
            >
              <span>اتصال به درگاه بانکی شاپرک</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
