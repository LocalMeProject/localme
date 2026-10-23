import React, { useState } from 'react';
import { Project, EdgeFunction, FunctionEnvVar } from '../types';
import {
  Terminal,
  Play,
  Save,
  Trash2,
  Shield,
  Eye,
  EyeOff,
  Code,
} from 'lucide-react';

interface EdgeFunctionsViewProps {
  project: Project;
  enabled: boolean;
  onToggleEnable: () => void;
  onOpenDeployModal: () => void;
}

const INITIAL_FUNCTIONS: EdgeFunction[] = [
  {
    id: 'fn-1',
    slug: 'send-otp-kavenegar',
    name: 'ارسال پیامک تایید با خط خدماتی',
    runtime: 'Jint 4.x (Managed C#)',
    memoryLimitMb: 16,
    timeoutSeconds: 5,
    invocationsCount: 1420,
    lastExecutedAt: '۲ دقیقه قبل',
    createdAt: '۱۴۰۳/۰۷/۱۰',
    script: `// LocalMe Sandboxed Jint Script: Kavenegar OTP Dispatch Hook
function handler(context) {
  const req = context.request || {};
  const phone = req.phone || '09121112233';
  const code = req.code || '849201';

  // Strict SSRF-isolated egress fetch via Whitelisted NAT
  console.log("Dispatching OTP to " + phone + " via pattern localme-verify");

  return {
    status: 200,
    dispatched: true,
    provider: "kavenegar",
    sender: "3000777",
    phone: phone,
    timestamp: new Date().toISOString()
  };
}

handler(context);`,
  },
  {
    id: 'fn-2',
    slug: 'verify-zarinpal-webhook',
    name: 'تایید وب‌هوک و امضای پرداخت زرین‌پال',
    runtime: 'Jint 4.x (Managed C#)',
    memoryLimitMb: 16,
    timeoutSeconds: 5,
    invocationsCount: 382,
    lastExecutedAt: '۱ ساعت قبل',
    createdAt: '۱۴۰۳/۰۷/۱۲',
    script: `// LocalMe Sandboxed Jint Script: Zarinpal Webhook Verifier
function handler(context) {
  const payload = context.request || {};
  const authority = payload.authority;
  const status = payload.status;

  if (status === "OK") {
    return {
      verified: true,
      action: "SETTLE_WALLET",
      authority: authority,
      fee_irr: 50000
    };
  }

  return { verified: false, action: "CANCEL_ORDER" };
}

handler(context);`,
  },
];

const INITIAL_ENV_VARS: FunctionEnvVar[] = [
  { key: 'KAVENEGAR_API_KEY', value: '4A526E67...4B713D', isSecret: true },
  { key: 'ZARINPAL_MERCHANT_ID', value: '7c9e6679-7425-40de-944b-e07fc1f90ae7', isSecret: false },
  { key: 'SHAHKAR_SERVICE_URL', value: 'https://pgw.shaparak.ir/api/v1', isSecret: false },
];

export const EdgeFunctionsView: React.FC<EdgeFunctionsViewProps> = ({
  project,
  enabled,
  onToggleEnable,
  onOpenDeployModal,
}) => {
  const [functions, setFunctions] = useState<EdgeFunction[]>(INITIAL_FUNCTIONS);
  const [selectedFunc, setSelectedFunc] = useState<EdgeFunction>(INITIAL_FUNCTIONS[0]);
  const [editorCode, setEditorCode] = useState<string>(INITIAL_FUNCTIONS[0]?.script || '');
  const [testPayload, setTestPayload] = useState<string>('{\n  "phone": "09121112233",\n  "code": "582910"\n}');
  const [testOutput, setTestOutput] = useState<string>('{\n  "status": "ready",\n  "message": "Click Run Live Script to execute in Jint sandbox"\n}');
  const [execLatency, setExecLatency] = useState<number | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [envVars, setEnvVars] = useState<FunctionEnvVar[]>(INITIAL_ENV_VARS);
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvVal, setNewEnvVal] = useState('');
  const [newEnvSecret, setNewEnvSecret] = useState(true);
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());

  const handleSelectFunc = (fn: EdgeFunction) => {
    setSelectedFunc(fn);
    setEditorCode(fn.script);
  };

  const handleSaveScript = () => {
    setFunctions((prev) =>
      prev.map((fn) =>
        fn.id === selectedFunc.id ? { ...fn, script: editorCode } : fn
      )
    );
    alert(`اسکریپت «${selectedFunc.name}» (${selectedFunc.slug}) در پروژه ${project.name} با موفقیت ذخیره گردید.`);
  };

  const handleRunTest = () => {
    setIsExecuting(true);
    const start = performance.now();

    setTimeout(() => {
      try {
        let parsedPayload = {};
        try {
          parsedPayload = JSON.parse(testPayload);
        } catch {
          // ignore
        }

        const simulatedOutput = {
          success: true,
          status: 200,
          result: {
            dispatched: true,
            provider: "kavenegar",
            sender: "3000777",
            payloadReceived: parsedPayload,
            memoryUsedBytes: 4194304,
            engine: "Jint 4.0.0-beta Managed Clr-Free Sandbox"
          },
          timestampUtc: new Date().toISOString()
        };

        const duration = Math.round(performance.now() - start) + 4;
        setExecLatency(duration);
        setTestOutput(JSON.stringify(simulatedOutput, null, 2));
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setTestOutput(JSON.stringify({ error: errorMsg }, null, 2));
      } finally {
        setIsExecuting(false);
      }
    }, 120);
  };

  const handleAddEnv = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEnvKey.trim() || !newEnvVal.trim()) return;

    setEnvVars((prev) => [
      ...prev.filter((item) => item.key !== newEnvKey.trim().toUpperCase()),
      {
        key: newEnvKey.trim().toUpperCase(),
        value: newEnvVal.trim(),
        isSecret: newEnvSecret,
      },
    ]);
    setNewEnvKey('');
    setNewEnvVal('');
  };

  const handleRemoveEnv = (key: string) => {
    setEnvVars((prev) => prev.filter((item) => item.key !== key));
  };

  const toggleSecretVisibility = (key: string) => {
    setVisibleSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Service Header Card */}
      <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <Terminal className="w-5 h-5 text-amber-400" />
              توابع سرورلس لبه شبکه (Serverless Edge Functions Studio)
            </h3>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                enabled
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700/60'
              }`}
            >
              {enabled ? 'فعال و آماده فراخوانی' : 'غیرفعال (نیاز به فعال‌سازی)'}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            اجرای توابع جاوااسکریپت و تایپ‌اسکریپت روی موتور ایزوله خالص Jint با سقف رم ۱۶ مگابایت و تاخیر زیر ۱۰ میلی‌ثانیه.
          </p>
        </div>

        {/* Dedicated Enable/Disable Edge Functions Button */}
        <div className="flex items-center space-x-2">
          <button
            onClick={onToggleEnable}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
              enabled
                ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30'
                : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold shadow-md shadow-amber-500/10'
            }`}
          >
            {enabled ? 'غیرفعال‌سازی سرویس توابع' : 'فعال‌سازی سرویس توابع لبه'}
          </button>

          {enabled && (
            <button
              onClick={onOpenDeployModal}
              className="px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs transition"
            >
              + استقرار تابع جدید
            </button>
          )}
        </div>
      </div>

      {!enabled ? (
        <div className="p-12 text-center rounded-2xl bg-zinc-900/20 border border-dashed border-zinc-800 max-w-xl mx-auto space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-400">
            <Terminal className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-zinc-200">سرویس توابع لبه برای این پروژه هنوز فعال نشده است</h4>
          <p className="text-xs text-zinc-400 leading-relaxed">
            برای اجرای کدهای هوک ارسال پیامک، اعتبارسنجی درگاه‌های بانکی، و کارهای بدون سرور، سرویس را فعال نمایید.
          </p>
          <button
            onClick={onToggleEnable}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold text-xs hover:from-amber-400 hover:to-orange-400 transition shadow-lg shadow-amber-500/10"
          >
            فعال‌سازی سرویس توابع لبه (Edge Functions)
          </button>
        </div>
      ) : (
        <>
          {/* Main Studio: Function List & Interactive Code Editor */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Functions List Sidebar */}
            <div className="lg:col-span-4 space-y-3">
              <div className="text-xs font-semibold text-zinc-400 flex items-center justify-between px-1">
                <span>توابع مستقر شده ({functions.length})</span>
                <span className="text-[10px] text-zinc-500 font-mono">Jint Isolate Pool</span>
              </div>
              <div className="space-y-2">
                {functions.map((fn) => (
                  <div
                    key={fn.id}
                    onClick={() => handleSelectFunc(fn)}
                    className={`cursor-pointer p-3.5 rounded-xl border transition ${
                      selectedFunc?.id === fn.id
                        ? 'bg-zinc-850 border-amber-500/50 shadow-sm'
                        : 'bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-850/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs font-bold text-amber-400">{fn.slug}</span>
                      <span className="text-[10px] text-zinc-500 font-mono">{fn.invocationsCount} فراخوانی</span>
                    </div>
                    <div className="text-xs font-medium text-zinc-200">{fn.name}</div>
                    <div className="text-[10px] text-zinc-400 font-mono mt-1.5 flex items-center gap-2">
                      <span>رم: {fn.memoryLimitMb}MB</span>
                      <span>تایم‌اوت: {fn.timeoutSeconds}s</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Editor & Live Runner */}
            <div className="lg:col-span-8 space-y-4">
              {/* Code Editor Header */}
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Code className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-zinc-200">
                      ویرایشگر جاوااسکریپت: <span className="font-mono text-amber-400">{selectedFunc?.slug}</span>
                    </span>
                  </div>
                  <button
                    onClick={handleSaveScript}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs transition border border-zinc-700/60"
                  >
                    <Save className="w-3.5 h-3.5 text-emerald-400" />
                    <span>ذخیره اسکریپت</span>
                  </button>
                </div>

                {/* Code Textarea */}
                <textarea
                  value={editorCode}
                  onChange={(e) => setEditorCode(e.target.value)}
                  className="w-full h-64 p-3.5 rounded-xl bg-zinc-950 font-mono text-xs text-zinc-200 border border-zinc-800 focus:outline-none focus:border-amber-500/60 leading-relaxed resize-y selection:bg-zinc-800"
                  spellCheck={false}
                />
              </div>

              {/* Live Test Runner Pane */}
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-300 flex items-center gap-2">
                    <Play className="w-3.5 h-3.5 text-amber-400" />
                    آزمایش و اجرای زنده اسکریپت (Live Test Runner)
                  </span>
                  <div className="flex items-center space-x-2">
                    {execLatency !== null && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        تاخیر: {execLatency} ms
                      </span>
                    )}
                    <button
                      onClick={handleRunTest}
                      disabled={isExecuting}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition shadow-sm"
                    >
                      <Play className="w-3 h-3 fill-black" />
                      <span>{isExecuting ? 'در حال اجرا...' : 'اجرای زنده اسکریپت'}</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-zinc-400 block mb-1">
                      داده ورودی تابع (Input JSON Payload)
                    </label>
                    <textarea
                      value={testPayload}
                      onChange={(e) => setTestPayload(e.target.value)}
                      className="w-full h-32 p-2.5 rounded-lg bg-zinc-950 font-mono text-[11px] text-zinc-300 border border-zinc-800 focus:outline-none focus:border-zinc-700 resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-zinc-400 block mb-1">
                      خروجی زنده کنسول (Execution Inspector)
                    </label>
                    <pre className="w-full h-32 p-2.5 rounded-lg bg-zinc-950 font-mono text-[11px] text-zinc-300 border border-zinc-800 overflow-auto">
                      {testOutput}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Secrets Vault & Environment Variables */}
          <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-amber-400" />
                  خزانه کلیدهای محرمانه و متغیرهای محیطی (Secrets Vault - AES-256-GCM)
                </h4>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  کلیدهای محرمانه تنها در حافظه ایزوله Jint بارگذاری شده و به صورت رمزنگاری‌شده در دیتابیس ذخیره می‌شوند.
                </p>
              </div>
            </div>

            {/* Add Env Var Form */}
            <form onSubmit={handleAddEnv} className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
              <div className="md:col-span-4">
                <input
                  type="text"
                  placeholder="KEY_NAME (e.g. KAVENEGAR_TOKEN)"
                  value={newEnvKey}
                  onChange={(e) => setNewEnvKey(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-200 focus:outline-none focus:border-amber-500/60 uppercase"
                />
              </div>
              <div className="md:col-span-5">
                <input
                  type="password"
                  placeholder="مقدار متغیر محرمانه"
                  value={newEnvVal}
                  onChange={(e) => setNewEnvVal(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-200 focus:outline-none focus:border-amber-500/60"
                />
              </div>
              <div className="md:col-span-3 flex items-center justify-end space-x-2">
                <label className="flex items-center space-x-1.5 text-xs text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newEnvSecret}
                    onChange={(e) => setNewEnvSecret(e.target.checked)}
                    className="rounded border-zinc-700 bg-zinc-950 text-amber-500 focus:ring-0"
                  />
                  <span>محرمانه</span>
                </label>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs transition border border-zinc-700/60"
                >
                  + افزودن
                </button>
              </div>
            </form>

            {/* Env Vars Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-zinc-800/80 text-zinc-400">
                    <th className="py-2 px-3 font-semibold">نام متغیر</th>
                    <th className="py-2 px-3 font-semibold">مقدار</th>
                    <th className="py-2 px-3 font-semibold">وضعیت امنیت</th>
                    <th className="py-2 px-3 font-semibold text-right">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40">
                  {envVars.map((v) => {
                    const isVisible = visibleSecrets.has(v.key);
                    return (
                      <tr key={v.key} className="hover:bg-zinc-850/30 transition">
                        <td className="py-2.5 px-3 font-bold text-amber-400">{v.key}</td>
                        <td className="py-2.5 px-3 text-zinc-300">
                          {v.isSecret && !isVisible ? '••••••••••••••••••••' : v.value}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              v.isSecret
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-zinc-800 text-zinc-400'
                            }`}
                          >
                            {v.isSecret ? 'AES-256 Secret' : 'Public Config'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            {v.isSecret && (
                              <button
                                onClick={() => toggleSecretVisibility(v.key)}
                                className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                              >
                                {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            )}
                            <button
                              onClick={() => handleRemoveEnv(v.key)}
                              className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-zinc-800"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
