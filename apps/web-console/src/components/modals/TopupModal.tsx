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

export type TopupGateway = 'ZARINPAL' | 'BEHPARDAKHT' | 'SEP' | 'SADAD';

export const TopupModal: React.FC<TopupModalProps> = ({
  isOpen,
  onClose,
  onTopup,
}) => {
  const [amountToman, setAmountToman] = useState<number>(500_000);
  const [gateway, setGateway] = useState<TopupGateway>('ZARINPAL');

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const amountIrr = amountToman * 10;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amountIrr <= 0) return;
    onTopup(amountIrr, gateway);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="topup-modal-title"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-[#171717] border border-[#242424] shadow-2xl p-6 text-zinc-100 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-[#242424]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#3ECF8E]/10 border border-[#3ECF8E]/20 flex items-center justify-center text-[#3ECF8E]">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h3 id="topup-modal-title" className="text-base font-bold text-white">شارژ کیف پول ریالی پروژه (IRR)</h3>
              <p className="text-xs text-zinc-400">پرداخت امن از طریق درگاه‌های شاپرک با کارت‌های عضو شتاب</p>
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
            <label className="block text-zinc-300 font-medium mb-2">مبلغ مورد نظر (تومان)</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
              {PRESET_AMOUNTS.map((preset) => (
                <button
                  type="button"
                  key={preset.toman}
                  onClick={() => setAmountToman(preset.toman)}
                  className={`p-2.5 rounded-xl border text-center transition ${
                    amountToman === preset.toman
                      ? 'border-[#3ECF8E] bg-[#3ECF8E]/10 text-[#3ECF8E] font-bold'
                      : 'border-[#242424] bg-[#0f0f0f] text-zinc-400 hover:bg-[#1a1a1a]'
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
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0f0f0f] border border-[#242424] focus:border-[#3ECF8E] focus:outline-none text-zinc-100 font-mono text-sm"
                dir="ltr"
              />
              <span className="absolute left-3 top-2.5 text-zinc-500 text-xs">تومان</span>
            </div>

            <div className="mt-1.5 flex items-center justify-between text-[11px] text-zinc-400 font-mono">
              <span>معادل در دفترکل ریالی (IRR BigInt):</span>
              <span className="text-[#3ECF8E] font-bold">{amountIrr.toLocaleString('fa-IR')} ریال</span>
            </div>
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1.5">انتخاب درگاه پرداخت شاپرک</label>
            <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="درگاه‌های پرداخت">
              {[
                { id: 'ZARINPAL', name: 'زرین‌پال (Zarinpal ZarinGate)' },
                { id: 'BEHPARDAKHT', name: 'به‌پرداخت ملت (Mellat PSP)' },
                { id: 'SEP', name: 'پرداخت الکترونیک سامان (SEP)' },
                { id: 'SADAD', name: 'سداد بانک ملی (Sadad)' },
              ].map((gw) => (
                <div
                  key={gw.id}
                  onClick={() => setGateway(gw.id as TopupGateway)}
                  role="radio"
                  aria-checked={gateway === gw.id}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      setGateway(gw.id as TopupGateway);
                    }
                  }}
                  className={`cursor-pointer p-3 rounded-xl border flex items-center space-x-2 transition ${
                    gateway === gw.id
                      ? 'border-[#3ECF8E]/60 bg-[#3ECF8E]/10 text-[#3ECF8E]'
                      : 'border-[#242424] bg-[#0f0f0f] text-zinc-400 hover:bg-[#1a1a1a]'
                  }`}
                >
                  <CreditCard className="w-4 h-4 shrink-0 text-[#3ECF8E]" />
                  <span className="text-xs font-medium">{gw.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#0f0f0f] border border-[#242424] flex items-center space-x-2 text-[11px] text-zinc-400">
            <ShieldCheck className="w-4 h-4 text-[#3ECF8E] shrink-0" />
            <span>آی‌پی سرور شما در فهرست سفید درگاه‌های بانکی شاپرک (NAT 2.180.12.94) قرار دارد.</span>
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
              className="rounded-full bg-[#3ECF8E] hover:bg-[#34b27b] text-[#0f0f0f] font-medium text-xs px-5 py-2 transition-colors flex items-center space-x-1.5"
            >
              <span>اتصال به درگاه بانکی شاپرک</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
