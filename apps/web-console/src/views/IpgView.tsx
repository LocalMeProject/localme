import React, { useState } from 'react';
import { Project, LedgerTransaction } from '../types';
import {
  CreditCard,
  ShieldCheck,
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

  // Simulator State
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
      default: return 'کارت عضو شتاب';
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
      setSimFeedback(`تراکنش با موفقیت تایید شد. شماره پیگیری: ${trackingCode}`);
    }, 500);
  };

  const handleRequestOtp = () => {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    setSimOtp(otp);
    alert(`رمز یکبار مصرف آزمایشی: ${otp}`);
  };

  const handleSaveSettings = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              درگاه‌های پرداخت
            </span>
            <span className="text-xs text-slate-400 font-mono" dir="ltr">
              {project.slug}
            </span>
          </div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-600" />
            مدیریت درگاه‌های پرداخت و تراکنش‌ها
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            پیکربندی درگاه‌های پرداخت بانکی، بررسی صحت تراکنش‌ها و ثبت دقیق در دفترکل مالی.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
            واحد ارزی: <strong className="text-emerald-700">ریال / تومان</strong>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Transactions List */}
        <div className="lg:col-span-8 p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="text-xs font-bold text-slate-900">
              تاریخچه تراکنش‌های اخیر ({transactions.length})
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-right text-xs" dir="rtl">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                  <th className="py-2.5 px-3">کد پیگیری</th>
                  <th className="py-2.5 px-3 text-center">درگاه</th>
                  <th className="py-2.5 px-3 text-center">مبلغ</th>
                  <th className="py-2.5 px-3 text-center">شماره تماس</th>
                  <th className="py-2.5 px-3 text-center">وضعیت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-xs text-slate-400">
                      هنوز هیچ تراکنشی در این پروژه ثبت نشده است.
                    </td>
                  </tr>
                ) : (
                  transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800" dir="ltr">
                        {t.trackingCode}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700 font-medium">
                          {t.gateway}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-emerald-700" dir="ltr">
                        {(t.amountIrr / 10).toLocaleString('fa-IR')} تومان
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-600" dir="ltr">
                        {t.customerPhone}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          موفق
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Configuration and Simulator */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              تنظیمات درگاه‌های پرداخت
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] text-slate-600 font-medium block mb-1">
                  درگاه پیش‌فرض پرداخت
                </label>
                <select
                  value={defaultPsp}
                  onChange={(e) => setDefaultPsp(e.target.value as PspGateway)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                >
                  <option value="ZARINPAL">زرین‌پال</option>
                  <option value="BEHPARDAKHT">به‌پرداخت ملت</option>
                  <option value="SEP">پرداخت الکترونیک سامان (سپ)</option>
                  <option value="SADAD">سداد (بانک ملی)</option>
                </select>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-600">محیط آزمایشی (Sandbox):</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSandbox}
                    onChange={(e) => setIsSandbox(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-[11px] text-slate-500">{isSandbox ? 'فعال' : 'غیرفعال'}</span>
                </label>
              </div>

              <button
                onClick={handleSaveSettings}
                className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition shadow-xs"
              >
                ذخیره تنظیمات درگاه
              </button>

              {saveSuccess && (
                <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>تنظیمات با موفقیت ذخیره شد.</span>
                </div>
              )}
            </div>
          </div>

          {/* Test Payment Simulator */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-emerald-600" />
              تست پرداخت آزمایشی
            </h3>

            <form onSubmit={handleSimulatePayment} className="space-y-2.5 text-xs">
              <div>
                <label className="text-[11px] text-slate-600 font-medium block mb-1">
                  شماره کارت بانکی
                </label>
                <input
                  type="text"
                  value={simCard}
                  onChange={(e) => setSimCard(e.target.value)}
                  dir="ltr"
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                />
                <span className="text-[10px] text-emerald-700 mt-0.5 block">
                  {detectBankName(simCard)}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] text-slate-600 font-medium block mb-1">مبلغ (تومان)</label>
                  <input
                    type="text"
                    value={simAmountToman}
                    onChange={(e) => setSimAmountToman(e.target.value)}
                    dir="ltr"
                    className="w-full px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-600 font-medium block mb-1">CVV2</label>
                  <input
                    type="text"
                    value={simCvv2}
                    onChange={(e) => setSimCvv2(e.target.value)}
                    dir="ltr"
                    className="w-full px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-600 font-medium block mb-1">رمز یکبار مصرف</label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={simOtp}
                      onChange={(e) => setSimOtp(e.target.value)}
                      dir="ltr"
                      className="w-full px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={handleRequestOtp}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[10px] text-slate-700 whitespace-nowrap"
                    >
                      دریافت
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSimulating}
                className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition shadow-xs disabled:opacity-50"
              >
                {isSimulating ? 'در حال پردازش تراکنش...' : 'پرداخت آزمایشی'}
              </button>

              {simFeedback && (
                <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] leading-relaxed">
                  {simFeedback}
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
