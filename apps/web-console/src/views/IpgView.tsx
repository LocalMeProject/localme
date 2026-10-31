import React, { useState, useEffect, useCallback } from 'react';
import { Project, LedgerTransaction } from '../types';
import {
  CreditCard,
  ShieldCheck,
  Receipt,
  CheckCircle2,
  RefreshCw,
  Save,
} from 'lucide-react';

interface IpgViewProps {
  project: Project;
  activeSubView?: string;
  onSubViewChange?: (subView: string) => void;
}

export type PspGateway = 'ZARINPAL' | 'BEHPARDAKHT' | 'SEP' | 'SADAD';

export const IpgView: React.FC<IpgViewProps> = ({
  project,
  activeSubView = 'transactions',
}) => {
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [defaultPsp, setDefaultPsp] = useState<PspGateway>('ZARINPAL');
  const [isSandbox, setIsSandbox] = useState(true);
  const [merchantId, setMerchantId] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isLoadingTx, setIsLoadingTx] = useState(false);

  // Simulator State
  const [simCard, setSimCard] = useState('6037-9918-1234-5678');
  const [simAmountToman, setSimAmountToman] = useState('50000');
  const [simOtp, setSimOtp] = useState('123456');
  const [simFeedback, setSimFeedback] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Real API: Fetch Transactions
  const fetchTransactions = useCallback(async () => {
    setIsLoadingTx(true);
    try {
      const res = await fetch(`/_baas/v1/${project.slug}/ipg/transactions`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setTransactions(
            data.map((tx: Record<string, unknown>) => ({
              id: String(tx.id || tx.trackId || ''),
              trackingCode: String(tx.trackingCode || tx.refId || tx.id || ''),
              gateway: String(tx.gateway || tx.psp || 'ZARINPAL'),
              amountIrr: Number(tx.amountIrr || (Number(tx.amount || 0) * 10)),
              customerPhone: String(tx.customerPhone || tx.phone || '-'),
              status: (tx.status as LedgerTransaction['status']) || 'VERIFIED',
              createdAt: String(tx.createdAt || tx.settledAt || 'هم‌اکنون'),
              settledAt: String(tx.settledAt || tx.createdAt || 'هم‌اکنون'),
            }))
          );
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingTx(false);
    }
  }, [project.slug]);

  // Real API: Fetch Config
  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch(`/_baas/v1/${project.slug}/ipg/config`);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          if (data.psp) setDefaultPsp(data.psp.toUpperCase() as PspGateway);
          if (typeof data.sandbox === 'boolean') setIsSandbox(data.sandbox);
          else if (typeof data.sandbox === 'string') setIsSandbox(data.sandbox === 'true');
          if (data.merchantId) setMerchantId(String(data.merchantId));
        }
      }
    } catch {
      // ignore
    }
  }, [project.slug]);

  useEffect(() => {
    fetchTransactions();
    fetchConfig();
  }, [fetchTransactions, fetchConfig]);

  // Real API: Save Config
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    try {
      const res = await fetch(`/_baas/v1/${project.slug}/ipg/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          psp: defaultPsp.toLowerCase(),
          sandbox: isSandbox,
          merchantId,
        }),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        const err = await res.json().catch(() => null);
        setSaveError(err?.error || 'خطا در ذخیره تنظیمات درگاه.');
      }
    } catch {
      setSaveError('خطا در برقراری ارتباط با سرور جهت ذخیره تنظیمات.');
    }
  };

  // Real API: Initiate Payment
  const handleSimulatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSimulating(true);
    setSimFeedback(null);

    const amountIrr = parseInt(simAmountToman, 10) * 10;
    try {
      const res = await fetch(`/_baas/v1/${project.slug}/pay/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountIrr,
          description: `پرداخت آزمایشی شتاب - کارت ${simCard.slice(-4)}`,
          callbackUrl: `${window.location.origin}/panel/${project.slug}/ipg/transactions`,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setSimFeedback(`تراکنش بانکی با موفقیت ثبت شد. کد پیگیری: ${data.trackId || data.trackingCode}`);
        fetchTransactions();
      } else {
        setSimFeedback(`پاسخ درگاه پرداخت: ${data.error || 'تراکنش ناموفق'}`);
      }
    } catch {
      setSimFeedback('خطا در برقراری ارتباط با سوییچ درگاه پرداخت.');
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              شبکه پرداخت شتاب و شاپرک
            </span>
            <span className="text-xs text-slate-400 font-mono" dir="ltr">
              {project.slug}
            </span>
          </div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-600" />
            {activeSubView === 'gateways'
              ? 'پیکربندی درگاه‌های بانکی و شاپرک'
              : activeSubView === 'ledger'
              ? 'شبیه‌ساز پرداخت شتاب و تسویه'
              : 'گزارش تراکنش‌های پرداخت و دفتر کل'}
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            اتصال مستقیم به درگاه‌های پرداخت، مدیریت تراکنش‌ها، ممیزی مالی و دفتر کل تسویه وجوه.
          </p>
        </div>

        <button
          onClick={fetchTransactions}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition shadow-xs"
          title="بازخوانی تراکنش‌ها"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTx ? 'animate-spin' : ''}`} />
          <span>بازخوانی</span>
        </button>
      </div>

      {/* Sub-View: Gateways Config */}
      {activeSubView === 'gateways' && (
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs max-w-2xl space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">تنظیمات درگاه فعال پروژه</h3>
          </div>

          <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1.5">ارائه‌دهنده درگاه پرداخت (PSP)</label>
              <select
                value={defaultPsp}
                onChange={(e) => setDefaultPsp(e.target.value as PspGateway)}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-xs focus:outline-none focus:border-emerald-500 shadow-xs"
              >
                <option value="ZARINPAL">زرین‌پال (ZarinPal)</option>
                <option value="BEHPARDAKHT">به‌پرداخت ملت</option>
                <option value="SEP">سپ (سامان کیش)</option>
                <option value="SADAD">سداد (بانک ملی)</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1.5">کد پذیرنده (Merchant ID / Terminal ID)</label>
              <input
                type="text"
                value={merchantId}
                onChange={(e) => setMerchantId(e.target.value)}
                placeholder="mer_..."
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xs text-slate-800 focus:outline-none focus:border-emerald-500 shadow-xs"
                dir="ltr"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <div className="font-semibold text-slate-800">محیط آزمایشی (Sandbox)</div>
                <div className="text-[11px] text-slate-400">انجام تراکنش بدون کسر موجودی واقعی کارت</div>
              </div>
              <input
                type="checkbox"
                checked={isSandbox}
                onChange={(e) => setIsSandbox(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
              />
            </div>

            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>ذخیره تنظیمات درگاه</span>
            </button>

            {saveSuccess && (
              <span className="text-xs text-emerald-700 font-medium mr-3">
                تنظیمات با موفقیت ذخیره گردید.
              </span>
            )}
            {saveError && (
              <span className="text-xs text-rose-600 font-medium mr-3">
                {saveError}
              </span>
            )}
          </form>
        </div>
      )}

      {/* Sub-View: Ledger Simulator */}
      {activeSubView === 'ledger' && (
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs max-w-2xl space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Receipt className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">شبیه‌ساز پرداخت شتاب</h3>
          </div>

          <form onSubmit={handleSimulatePayment} className="space-y-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1.5">مبلغ تراکنش (تومان)</label>
              <input
                type="number"
                value={simAmountToman}
                onChange={(e) => setSimAmountToman(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xs text-slate-800 focus:outline-none focus:border-emerald-500 shadow-xs"
                dir="ltr"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1.5">شماره کارت آزمایشی</label>
                <input
                  type="text"
                  value={simCard}
                  onChange={(e) => setSimCard(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xs text-slate-800 focus:outline-none focus:border-emerald-500 shadow-xs"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1.5">رمز یکبار مصرف (OTP)</label>
                <input
                  type="text"
                  value={simOtp}
                  onChange={(e) => setSimOtp(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xs text-slate-800 focus:outline-none focus:border-emerald-500 shadow-xs"
                  dir="ltr"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSimulating}
              className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition shadow-xs disabled:opacity-50 inline-flex items-center gap-2"
            >
              {isSimulating ? 'در حال ارسال به درگاه...' : 'شروع پرداخت آزمایشی'}
            </button>

            {simFeedback && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 leading-relaxed flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{simFeedback}</span>
              </div>
            )}
          </form>
        </div>
      )}

      {/* Sub-View: Transactions Table (Default) */}
      {(activeSubView === 'transactions' || (!activeSubView && activeSubView !== 'gateways' && activeSubView !== 'ledger')) && (
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="text-xs font-bold text-slate-900">
              تراکنش‌های ثبت‌شده ({transactions.length})
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-right text-xs" dir="rtl">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                  <th className="py-2.5 px-3">کد پیگیری تراکنش</th>
                  <th className="py-2.5 px-3 text-center">درگاه</th>
                  <th className="py-2.5 px-3 text-center">مبلغ (تومان)</th>
                  <th className="py-2.5 px-3 text-center">شماره پرداخت‌کننده</th>
                  <th className="py-2.5 px-3 text-center">وضعیت</th>
                  <th className="py-2.5 px-3 text-center">زمان ثبت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoadingTx ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-xs text-slate-500">
                      در حال بارگذاری تراکنش‌ها...
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-xs text-slate-400">
                      هنوز تراکنشی در این پروژه ثبت نشده است.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800" dir="ltr">
                        {tx.trackingCode}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700 font-medium">
                          {tx.gateway}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-700" dir="ltr">
                        {(tx.amountIrr / 10).toLocaleString('fa-IR')}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-600 text-[11px]" dir="ltr">
                        {tx.customerPhone}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                          تایید شده
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-500 text-[11px]">
                        {tx.settledAt}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
