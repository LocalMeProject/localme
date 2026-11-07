import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  CreditCard, 
  Save, 
  MessageSquare, 
  Key,
  Clock,
  Hash,
  Link2
} from 'lucide-react';
import { api } from '../../utils/apiClient';
import { formatToman } from '../../utils/persian';

export function GatewaysSmsView() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // SMS Gateway Settings
  const [smsDefaultProvider, setSmsDefaultProvider] = useState<'kavenegar' | 'melipayamak' | 'magfa'>('kavenegar');
  const [smsDefaultApiKey, setSmsDefaultApiKey] = useState('');
  const [smsDefaultSenderNumber, setSmsDefaultSenderNumber] = useState('3000777');
  const [smsDefaultPatternCode, setSmsDefaultPatternCode] = useState('localme-verify');
  const [smsDefaultOtpLength, setSmsDefaultOtpLength] = useState<number>(6);
  const [smsDefaultOtpExpirySeconds, setSmsDefaultOtpExpirySeconds] = useState<number>(120);

  // Shetab IPG Settings
  const [ipgDefaultPsp, setIpgDefaultPsp] = useState<'zarinpal' | 'behpardakht' | 'sep' | 'sadad'>('zarinpal');
  const [ipgDefaultMerchantId, setIpgDefaultMerchantId] = useState('');
  const [ipgCallbackBaseUrl, setIpgCallbackBaseUrl] = useState('https://api.localme.ir/_baas/v1/pay/callback');
  const [shaparakWageIrr, setShaparakWageIrr] = useState<number>(1200);

  // Test SMS Dispatch Tool
  const [testPhone, setTestPhone] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const cfg = await api.get('/_baas/v1/admin/config');
      if (cfg) {
        if (cfg.smsDefaultProvider || cfg.smsProvider) {
          const prov = (cfg.smsDefaultProvider || cfg.smsProvider).toLowerCase();
          if (prov === 'melipayamak' || prov === 'magfa' || prov === 'kavenegar') {
            setSmsDefaultProvider(prov);
          }
        }
        if (cfg.smsDefaultApiKey || cfg.smsApiKey) setSmsDefaultApiKey(cfg.smsDefaultApiKey || cfg.smsApiKey);
        if (cfg.smsDefaultSenderNumber || cfg.smsSenderLine) setSmsDefaultSenderNumber(cfg.smsDefaultSenderNumber || cfg.smsSenderLine);
        if (cfg.smsDefaultPatternCode || cfg.smsPatternName) setSmsDefaultPatternCode(cfg.smsDefaultPatternCode || cfg.smsPatternName);
        if (cfg.smsDefaultOtpLength) setSmsDefaultOtpLength(Number(cfg.smsDefaultOtpLength));
        if (cfg.smsDefaultOtpExpirySeconds) setSmsDefaultOtpExpirySeconds(Number(cfg.smsDefaultOtpExpirySeconds));

        if (cfg.ipgDefaultPsp || cfg.defaultIpgProvider) {
          const psp = (cfg.ipgDefaultPsp || cfg.defaultIpgProvider).toLowerCase();
          if (psp === 'behpardakht' || psp === 'sep' || psp === 'sadad' || psp === 'zarinpal') {
            setIpgDefaultPsp(psp);
          }
        }
        if (cfg.ipgDefaultMerchantId || cfg.ipgMerchantId) setIpgDefaultMerchantId(cfg.ipgDefaultMerchantId || cfg.ipgMerchantId);
        if (cfg.ipgCallbackBaseUrl) setIpgCallbackBaseUrl(cfg.ipgCallbackBaseUrl);
        if (cfg.shaparakWageIrr) setShaparakWageIrr(Number(cfg.shaparakWageIrr));
      }
    } catch (err) {
      console.error('Failed to load gateways config', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const existing = await api.get('/_baas/v1/admin/config');
      const updated = {
        ...existing,
        smsDefaultProvider,
        smsDefaultApiKey: smsDefaultApiKey.trim(),
        smsDefaultSenderNumber: smsDefaultSenderNumber.trim(),
        smsDefaultPatternCode: smsDefaultPatternCode.trim(),
        smsDefaultOtpLength: Number(smsDefaultOtpLength),
        smsDefaultOtpExpirySeconds: Number(smsDefaultOtpExpirySeconds),
        ipgDefaultPsp,
        ipgDefaultMerchantId: ipgDefaultMerchantId.trim(),
        ipgCallbackBaseUrl: ipgCallbackBaseUrl.trim(),
        shaparakWageIrr: Number(shaparakWageIrr),
      };

      await api.put('/_baas/v1/admin/config', updated);

      setFeedback({
        type: 'success',
        message: 'پیکربندی درگاه‌های پیامک و بانکی با موفقیت ذخیره و در سراسر کلاستر به‌روزرسانی شد.',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'خطا در ذخیره تنظیمات درگاه‌ها.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone.match(/^09\d{9}$/)) {
      setTestResult({
        success: false,
        message: 'شماره موبایل تست نامعتبر است (باید ۱۱ رقم و با ۰۹ آغاز شود).',
      });
      return;
    }

    setTestSending(true);
    setTestResult(null);
    try {
      const res = await api.post('/_baas/v1/admin/gateways/sms/test', {
        phone: testPhone.trim(),
        provider: smsDefaultProvider,
      });
      setTestResult({
        success: res.success ?? true,
        message: res.message || 'پیامک تست با موفقیت ارسال شد.',
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'خطا در ارسال پیامک تست.',
      });
    } finally {
      setTestSending(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Radio className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">تنظیمات درگاه‌های پیامک و پرداخت شتابی (IPG)</h2>
          </div>
          <p className="text-xs text-slate-500">
            مدیریت وب‌سرویس‌های ارسال پیامک اعتبارسنجی (کاوه‌نگار، ملی‌پیامک، مگفا) و درگاه‌های پرداخت متصل به شبکه شاپرک.
          </p>
        </div>

        <button
          onClick={fetchConfig}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : 'text-slate-400'}`} />
          <span>بازخوانی</span>
        </button>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center gap-2.5 animate-in fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <RefreshCw className="w-6 h-6 animate-spin text-emerald-600 mb-2" />
          <span className="text-xs text-slate-500">در حال دریافت تنظیمات درگاه‌ها...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Config Form (2 cols) */}
          <form onSubmit={handleSave} className="lg:col-span-2 space-y-6">
            
            {/* SMS Gateways Section */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  <span>پیکربندی ارائه‌دهنده سرویس پیامک (SMS OTP)</span>
                </h3>
                <span className="text-[11px] text-slate-400">احراز هویت و ارسال اعلانات</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    سامانه وب‌سرویس پیامکی پیش‌فرض
                  </label>
                  <select
                    value={smsDefaultProvider}
                    onChange={(e: any) => setSmsDefaultProvider(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  >
                    <option value="kavenegar">کاوه‌نگار (Kavenegar REST API)</option>
                    <option value="melipayamak">ملی‌پیامک (Melipayamak)</option>
                    <option value="magfa">مگفا (Magfa Corp)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    شماره سرشماره یا خط خدماتی ارسال‌کننده
                  </label>
                  <input
                    type="text"
                    value={smsDefaultSenderNumber}
                    onChange={(e) => setSmsDefaultSenderNumber(e.target.value)}
                    placeholder="3000777"
                    dir="ltr"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    کلید اعتبارسنجی وب‌سرویس (API Key / Token)
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={smsDefaultApiKey}
                      onChange={(e) => setSmsDefaultApiKey(e.target.value)}
                      placeholder="••••••••••••••••••••••••"
                      dir="ltr"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition pl-9"
                    />
                    <Key className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    الگوی تایید پیامک (Lookup Pattern Template)
                  </label>
                  <input
                    type="text"
                    value={smsDefaultPatternCode}
                    onChange={(e) => setSmsDefaultPatternCode(e.target.value)}
                    placeholder="localme-verify"
                    dir="ltr"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    شناسه الگوی تایید سریع (بدون مسدودی بلک‌لیست)
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                      <Hash className="w-3.5 h-3.5 text-slate-400" />
                      <span>طول کد OTP</span>
                    </label>
                    <input
                      type="number"
                      min={4}
                      max={8}
                      value={smsDefaultOtpLength}
                      onChange={(e) => setSmsDefaultOtpLength(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>انقضا (ثانیه)</span>
                    </label>
                    <input
                      type="number"
                      min={30}
                      max={600}
                      value={smsDefaultOtpExpirySeconds}
                      onChange={(e) => setSmsDefaultOtpExpirySeconds(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* IPG Section */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  <span>درگاه پرداخت اینترنتی شاپرک (Shetab IPG)</span>
                </h3>
                <span className="text-[11px] text-slate-400">افزایش اعتبار کیف پول و تسویه ریالی</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ارائه‌دهنده درگاه پرداخت (PSP)
                  </label>
                  <select
                    value={ipgDefaultPsp}
                    onChange={(e: any) => setIpgDefaultPsp(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  >
                    <option value="zarinpal">زرین‌پال (ZarinPal)</option>
                    <option value="behpardakht">به‌پرداخت ملت (Mellat BPM)</option>
                    <option value="sep">سامان‌کیش (SEP Saman)</option>
                    <option value="sadad">سداد ملی (Sadad Melli)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    کد پذیرنده (Merchant ID / Terminal ID)
                  </label>
                  <input
                    type="text"
                    value={ipgDefaultMerchantId}
                    onChange={(e) => setIpgDefaultMerchantId(e.target.value)}
                    placeholder="00000000-0000-0000-0000-000000000000"
                    dir="ltr"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Link2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>آدرس بازگشت تراکنش شاپرک (Callback URL)</span>
                  </label>
                  <input
                    type="url"
                    value={ipgCallbackBaseUrl}
                    onChange={(e) => setIpgCallbackBaseUrl(e.target.value)}
                    placeholder="https://api.localme.ir/_baas/v1/pay/callback"
                    dir="ltr"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    کارمزد شاپرک تراکنش (ریال)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={shaparakWageIrr}
                    onChange={(e) => setShaparakWageIrr(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    معادل {formatToman(shaparakWageIrr)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition disabled:opacity-50 shadow-xs"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>ذخیره تنظیمات درگاه‌ها و اعمال در کلاستر</span>
              </button>
            </div>

          </form>

          {/* Test SMS Dispatch Sidebar Card (1 col) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 h-fit">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Send className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold text-slate-900">ابزار تست زنده ارسال پیامک</h3>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              جهت اطمینان از صحت وب‌سرویس پیامکی و اعتبار کلید ارائه‌دهنده، شماره همراه مورد نظر را وارد کرده و یک پیامک اعتبارسنجی ارسال نمایید.
            </p>

            <form onSubmit={handleSendTestSms} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  سامانه انتخابی تست
                </label>
                <div className="px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700">
                  {smsDefaultProvider === 'kavenegar' && 'کاوه‌نگار (Kavenegar)'}
                  {smsDefaultProvider === 'melipayamak' && 'ملی‌پیامک (Melipayamak)'}
                  {smsDefaultProvider === 'magfa' && 'مگفا (Magfa)'}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  شماره همراه مقصد تست
                </label>
                <input
                  type="tel"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="09121112233"
                  dir="ltr"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                />
              </div>

              <button
                type="submit"
                disabled={testSending}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs transition disabled:opacity-50 shadow-xs"
              >
                {testSending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>ارسال پیامک آزمایشی</span>
              </button>
            </form>

            {testResult && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2 animate-in fade-in ${
                  testResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <span className="leading-relaxed">{testResult.message}</span>
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
