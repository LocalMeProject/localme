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
  Key 
} from 'lucide-react';
import { api } from '../../utils/apiClient';

export function GatewaysSmsView() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // SMS Settings
  const [smsProvider, setSmsProvider] = useState<'kavenegar' | 'faraz' | 'melipayamak'>('kavenegar');
  const [smsApiKey, setSmsApiKey] = useState('');
  const [smsSender, setSmsSender] = useState('3000777');
  const [smsPattern, setSmsPattern] = useState('localme-verify');

  // Shetab IPG Settings
  const [defaultIpgProvider, setDefaultIpgProvider] = useState<'zarinpal' | 'saman' | 'pasargad'>('zarinpal');
  const [ipgMerchantId, setIpgMerchantId] = useState('');
  const [ipgSandbox, setIpgSandbox] = useState(true);

  // Test SMS Dispatch Tool
  const [testPhone, setTestPhone] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const cfg = await api.get('/_baas/v1/admin/config');
      if (cfg) {
        if (cfg.smsProvider) setSmsProvider(cfg.smsProvider);
        if (cfg.smsApiKey) setSmsApiKey(cfg.smsApiKey);
        if (cfg.smsSenderLine) setSmsSender(cfg.smsSenderLine);
        if (cfg.smsPatternName) setSmsPattern(cfg.smsPatternName);
        if (cfg.ipgMerchantId) setIpgMerchantId(cfg.ipgMerchantId);
        if (typeof cfg.ipgSandbox === 'boolean') setIpgSandbox(cfg.ipgSandbox);
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
        smsProvider,
        smsApiKey: smsApiKey.trim(),
        smsSenderLine: smsSender.trim(),
        smsPatternName: smsPattern.trim(),
        ipgMerchantId: ipgMerchantId.trim(),
        ipgSandbox,
      };

      await api.put('/_baas/v1/admin/config', updated);

      setFeedback({
        type: 'success',
        message: 'پیکربندی درگاه‌های پیامک و بانکی با موفقیت ذخیره و در کل کلاستر به‌روزرسانی شد.',
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
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2 mb-1">
          <Radio className="w-5 h-5 text-emerald-600" />
          <h2 className="text-base font-bold text-slate-900">تنظیمات درگاه‌های پیامک و پرداخت شتابی (IPG)</h2>
        </div>
        <p className="text-xs text-slate-500">
          مدیریت گیت‌وی‌های ارسال پیامک اعتبارسنجی (کاوه نگار، فراز، ملی پیامک) و درگاه‌های پرداخت متصل به سامانه شاپرک.
        </p>
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
                <span className="text-[11px] text-slate-400">کد یک‌بار مصرف و اعلانات</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    سامانه پیامکی
                  </label>
                  <select
                    value={smsProvider}
                    onChange={(e: any) => setSmsProvider(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  >
                    <option value="kavenegar">کاوه‌نگار (Kavenegar)</option>
                    <option value="faraz">فراز اس‌ام‌اس (FarazSMS)</option>
                    <option value="melipayamak">ملی‌پیامک (Melipayamak)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    شماره خط اختصاصی ارسال‌کننده
                  </label>
                  <input
                    type="text"
                    value={smsSender}
                    onChange={(e) => setSmsSender(e.target.value)}
                    placeholder="3000777"
                    dir="ltr"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    کلید اعتبارسنجی وب‌سرویس (API Key)
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={smsApiKey}
                      onChange={(e) => setSmsApiKey(e.target.value)}
                      placeholder="••••••••••••••••••••••••"
                      dir="ltr"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                    />
                    <Key className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    الگوی تایید پیامک (Lookup Pattern Template)
                  </label>
                  <input
                    type="text"
                    value={smsPattern}
                    onChange={(e) => setSmsPattern(e.target.value)}
                    placeholder="localme-verify"
                    dir="ltr"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    نام پترن ثبت‌شده در سامانه پیامکی جهت عبور از بلک‌لیست مخابراتی
                  </span>
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
                <span className="text-[11px] text-slate-400">شارژ کیف پول و پرداخت‌ها</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    درگاه پرداخت
                  </label>
                  <select
                    value={defaultIpgProvider}
                    onChange={(e: any) => setDefaultIpgProvider(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  >
                    <option value="zarinpal">زرین‌پال (ZarinPal)</option>
                    <option value="saman">سامان کیش (SEP)</option>
                    <option value="pasargad">پاسارگاد (PEP)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    کد پذیرنده (Merchant ID)
                  </label>
                  <input
                    type="text"
                    value={ipgMerchantId}
                    onChange={(e) => setIpgMerchantId(e.target.value)}
                    placeholder="00000000-0000-0000-0000-000000000000"
                    dir="ltr"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  />
                </div>

                <div className="sm:col-span-2 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={ipgSandbox}
                      onChange={(e) => setIpgSandbox(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                    />
                    <span>حالت آزمایشی (Sandbox) فعال باشد (تراکنش‌های شبیه‌سازی‌شده بدون کسر واقعی پول)</span>
                  </label>
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
                <span>ذخیره تنظیمات درگاه‌ها</span>
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
              جهت اطمینان از صحت کلید وب‌سرویس پیامکی، شماره همراه مورد نظر را وارد کرده و یک پیامک اعتبارسنجی ارسال نمایید.
            </p>

            <form onSubmit={handleSendTestSms} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  شماره همراه مقصد تست
                </label>
                <input
                  type="tel"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                  dir="ltr"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                />
              </div>

              <button
                type="submit"
                disabled={testSending}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs transition disabled:opacity-50 shadow-xs"
              >
                {testSending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>ارسال پیامک آزمایشی</span>
              </button>
            </form>

            {testResult && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
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
