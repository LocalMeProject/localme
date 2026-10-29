import React, { useState } from 'react';
import { Project, LedgerTransaction } from '../types';
import {
  CreditCard,
  ShieldCheck,
  Play,
  Receipt,
  CheckCircle2,
} from 'lucide-react';

interface IpgViewProps {
  project: Project;
}

const INITIAL_TRANSACTIONS: LedgerTransaction[] = [];

export type PspGateway = 'ZARINPAL' | 'BEHPARDAKHT' | 'SEP' | 'SADAD';

export const IpgView: React.FC<IpgViewProps> = ({ project }) => {
  const [transactions, setTransactions] = useState<LedgerTransaction[]>(INITIAL_TRANSACTIONS);
  const [defaultPsp, setDefaultPsp] = useState<PspGateway>('ZARINPAL');
  const [isSandbox, setIsSandbox] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Shetab Simulator State
  const [simCard, setSimCard] = useState('6037-9918-1234-5678');
  const [simCvv2, setSimCvv2] = useState('382');
  const [simAmountToman, setSimAmountToman] = useState('50000');
  const [simOtp, setSimOtp] = useState('123456');
  const [simFeedback, setSimFeedback] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const detectBankName = (num: string) => {
    const clean = num.replace(/-/g, '').slice(0, 6);
    switch (clean) {
      case '603799': return 'بانک ملی ایران';
      case '610433': return 'بانک ملت';
      case '621986': return 'بانک سامان';
      case '502229': return 'بانک پاسارگاد';
      case '627412': return 'بانک اقتصاد نوین';
      default: return 'کارت بانکی عضو شتاب';
    }
  };

  const handleSimulatePayment = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSimulating(true);
    setSimFeedback(null);

    setTimeout(() => {
      setIsSimulating(false);
      const amountIrr = parseInt(simAmountToman, 10) * 10;
      const trackingCode = `TRK_${Math.floor(100000 + Math.random() * 900000)}`;

      const newTx: LedgerTransaction = {
        id: `tx-${Date.now().toString().slice(-4)}`,
        trackingCode,
        gateway: defaultPsp,
        amountIrr,
        customerPhone: '09121112233',
        status: 'VERIFIED',
        createdAt: 'هم‌اکنون',
      };

      setTransactions((prev) => [newTx, ...prev]);
      setSimFeedback(`تراکنش شتاب با موفقیت تایید شد. کد رهگیری شاپرک: ${trackingCode}`);
    }, 500);
  };

  const handleRequestOtp = () => {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    setSimOtp(otp);
    alert(`رمز پویای پیامکی شتاب: ${otp}`);
  };

  const handleSaveSettings = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-[#171717] border border-[#242424] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[#3ECF8E]" />
            درگاه پرداخت شاپرک و دفترکل ریالی (IPG Studio & IRR Ledger)
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            اتصال مستقیم ۱ به ۱ پذیرنده برای پروژه {project.name} با آی‌پی استاتیک ملی (Whitelisted NAT) و ثبت دفترکل دوبل ریالی.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="px-3 py-1 rounded-full bg-[#0f0f0f] border border-[#242424] text-xs font-mono text-zinc-300">
            استاندارد ارز: <strong className="text-[#3ECF8E]">IRR (ریال دقیق)</strong>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* PSP Gateway Configuration */}
        <div className="lg:col-span-6 p-5 rounded-2xl bg-[#171717] border border-[#242424] space-y-4">
          <div className="flex items-center justify-between border-b border-[#242424] pb-3">
            <h4 className="text-xs font-bold text-zinc-200 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#3ECF8E]" />
              تنظیمات درگاه‌های شاپرک پروژه
            </h4>
            {saveSuccess && (
              <span className="flex items-center gap-1 text-[11px] text-[#3ECF8E] font-medium animate-fadeIn">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>ذخیره شد</span>
              </span>
            )}
          </div>

          <div className="space-y-3.5">
            <div>
              <label className="text-[11px] text-zinc-400 block mb-1">درگاه پیش‌فرض شاپرک (Default PSP)</label>
              <select
                value={defaultPsp}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDefaultPsp(e.target.value as PspGateway)}
                className="w-full px-3 py-2 rounded-xl bg-[#0f0f0f] border border-[#242424] text-xs font-semibold text-zinc-200 focus:border-[#3ECF8E] focus:outline-none"
              >
                <option value="ZARINPAL">زرین‌پال (ZarinPal REST v4)</option>
                <option value="BEHPARDAKHT">به‌پرداخت ملت (Mellat bpPayRequest)</option>
                <option value="SEP">سامان‌کیش سپ (SEP Shaparak)</option>
                <option value="SADAD">پرداخت الکترونیک سداد ملی (Sadad)</option>
              </select>
            </div>

            {defaultPsp === 'ZARINPAL' && (
              <div className="p-3.5 rounded-xl bg-[#0f0f0f] border border-[#242424] space-y-3">
                <div className="text-[11px] font-bold text-[#3ECF8E]">مشخصات درگاه زرین‌پال</div>
                <div>
                  <label className="text-[10px] text-zinc-400 block mb-1">کد ۳۶ کاراکتری مرچنت (Merchant ID)</label>
                  <input
                    type="text"
                    defaultValue="7c9e6679-7425-40de-944b-e07fc1f90ae7"
                    className="w-full px-3 py-1.5 rounded-lg bg-[#171717] border border-[#242424] font-mono text-xs text-zinc-200 focus:border-[#3ECF8E] focus:outline-none"
                    dir="ltr"
                  />
                </div>
                <label className="flex items-center space-x-2 text-xs text-zinc-400 cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded border-[#242424] bg-[#171717] text-[#3ECF8E] focus:ring-[#3ECF8E]" />
                  <span>فعال‌سازی درگاه مستقیم زرین‌گیت (ZarinGate)</span>
                </label>
              </div>
            )}

            {defaultPsp === 'BEHPARDAKHT' && (
              <div className="p-3.5 rounded-xl bg-[#0f0f0f] border border-[#242424] space-y-3">
                <div className="text-[11px] font-bold text-[#3ECF8E]">مشخصات درگاه به‌پرداخت ملت</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-1">کد پایانه (TerminalId)</label>
                    <input type="text" defaultValue="1234567" className="w-full px-3 py-1.5 rounded-lg bg-[#171717] border border-[#242424] font-mono text-xs text-zinc-200 focus:border-[#3ECF8E] focus:outline-none" dir="ltr" />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-1">نام کاربری وب‌سرویس</label>
                    <input type="text" defaultValue="mellat_usr" className="w-full px-3 py-1.5 rounded-lg bg-[#171717] border border-[#242424] font-mono text-xs text-zinc-200 focus:border-[#3ECF8E] focus:outline-none" dir="ltr" />
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between p-3 rounded-xl bg-[#0f0f0f] border border-[#242424] text-xs">
              <span className="text-zinc-400">حالت آزمایشی (سندباکس تست):</span>
              <button
                type="button"
                onClick={() => setIsSandbox(!isSandbox)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                  isSandbox ? 'bg-[#3ECF8E]/10 text-[#3ECF8E] border border-[#3ECF8E]/30' : 'bg-[#242424] text-zinc-500'
                }`}
              >
                {isSandbox ? 'Sandbox فعال' : 'محیط عملیاتی'}
              </button>
            </div>

            <button
              onClick={handleSaveSettings}
              className="w-full py-2.5 rounded-full bg-[#242424] hover:bg-[#2e2e2e] text-[#ededed] border border-[#2e2e2e] font-medium text-xs transition-colors"
            >
              ذخیره و اعتبارسنجی پذیرنده
            </button>
          </div>
        </div>

        {/* Shetab Payment Simulator */}
        <div className="lg:col-span-6 p-5 rounded-2xl bg-[#171717] border border-[#242424] space-y-4">
          <h4 className="text-xs font-bold text-zinc-200 flex items-center justify-between border-b border-[#242424] pb-3">
            <span className="flex items-center gap-2">
              <Play className="w-4 h-4 text-[#3ECF8E]" />
              شبیه‌ساز پرداخت شاپرک (Shetab Simulator)
            </span>
            <span className="text-[10px] text-zinc-400 font-mono">
              {detectBankName(simCard)}
            </span>
          </h4>

          <form onSubmit={handleSimulatePayment} className="space-y-3">
            <div>
              <label className="text-[11px] text-zinc-400 block mb-1">شماره کارت ۱۶ رقمی شتاب</label>
              <input
                type="text"
                value={simCard}
                onChange={(e) => setSimCard(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-[#0f0f0f] border border-[#242424] font-mono text-xs text-zinc-200 focus:border-[#3ECF8E] focus:outline-none"
                dir="ltr"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">کد CVV2</label>
                <input
                  type="text"
                  value={simCvv2}
                  onChange={(e) => setSimCvv2(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#0f0f0f] border border-[#242424] font-mono text-xs text-zinc-200 focus:border-[#3ECF8E] focus:outline-none"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">مبلغ آزمایشی (تومان)</label>
                <input
                  type="number"
                  value={simAmountToman}
                  onChange={(e) => setSimAmountToman(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#0f0f0f] border border-[#242424] font-mono text-xs text-zinc-200 focus:border-[#3ECF8E] focus:outline-none"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] text-zinc-400 block mb-1">رمز پویا (OTP)</label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={simOtp}
                  onChange={(e) => setSimOtp(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#0f0f0f] border border-[#242424] font-mono text-xs text-zinc-200 focus:border-[#3ECF8E] focus:outline-none"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={handleRequestOtp}
                  className="px-4 py-1.5 rounded-full bg-[#242424] hover:bg-[#2e2e2e] text-[#ededed] border border-[#2e2e2e] text-xs font-medium whitespace-nowrap transition-colors"
                >
                  دریافت رمز پویا
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSimulating}
              className="w-full py-2.5 rounded-full bg-[#3ECF8E] hover:bg-[#34b27b] text-[#0f0f0f] font-medium text-xs transition-colors disabled:opacity-50"
            >
              {isSimulating ? 'در حال تایید پرداخت شاپرک...' : 'تایید و پرداخت آزمایشی شتاب'}
            </button>

            {simFeedback && (
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-xs text-[#3ECF8E] leading-relaxed">
                {simFeedback}
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Double-Entry Rial Ledger Table */}
      <div className="p-5 rounded-2xl bg-[#171717] border border-[#242424] space-y-3">
        <div className="flex items-center justify-between border-b border-[#242424] pb-3">
          <span className="text-xs font-bold text-zinc-200 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#3ECF8E]" />
            دفترکل اسناد و تراکنش‌های حسابداری ریالی (Double-Entry Ledger)
          </span>
          <span className="text-[10px] text-zinc-400 font-mono">
            {transactions.length} تراکنش ثبت‌شده
          </span>
        </div>

        <div className="rounded-xl border border-[#242424] overflow-hidden" dir="ltr">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-[#242424] bg-[#1a1a1a] text-zinc-400">
                <th className="py-2.5 px-3">شناسه سند</th>
                <th className="py-2.5 px-3">کد رهگیری شاپرک</th>
                <th className="py-2.5 px-3">درگاه</th>
                <th className="py-2.5 px-3">مبلغ ریالی (IRR)</th>
                <th className="py-2.5 px-3">معادل تومان</th>
                <th className="py-2.5 px-3">موبایل مشتری</th>
                <th className="py-2.5 px-3">وضعیت</th>
                <th className="py-2.5 px-3">تاریخ و زمان</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#242424]">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-zinc-500">
                    هیچ تراکنشی ثبت نشده است
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[#1f1f1f] transition-colors">
                    <td className="py-2.5 px-3 font-bold text-zinc-300">{tx.id}</td>
                    <td className="py-2.5 px-3 text-[#3ECF8E]">{tx.trackingCode}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#0f0f0f] border border-[#242424] text-zinc-300">
                        {tx.gateway}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-zinc-200 font-bold">{tx.amountIrr.toLocaleString('fa-IR')}</td>
                    <td className="py-2.5 px-3 text-[#3ECF8E]">{Math.floor(tx.amountIrr / 10).toLocaleString('fa-IR')}</td>
                    <td className="py-2.5 px-3 text-zinc-400">{tx.customerPhone}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          tx.status === 'VERIFIED'
                            ? 'bg-[#3ECF8E]/10 text-[#3ECF8E] border border-[#3ECF8E]/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-zinc-500 text-[11px]">{tx.createdAt}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
