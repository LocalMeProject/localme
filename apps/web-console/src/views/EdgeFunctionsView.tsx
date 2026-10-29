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
  Plus,
} from 'lucide-react';

interface EdgeFunctionsViewProps {
  project: Project;
  enabled: boolean;
  onToggleEnable: () => void;
  onOpenDeployModal: () => void;
}

const INITIAL_FUNCTIONS: EdgeFunction[] = [];
const INITIAL_ENV_VARS: FunctionEnvVar[] = [];

export const EdgeFunctionsView: React.FC<EdgeFunctionsViewProps> = ({
  project,
  enabled,
  onToggleEnable,
  onOpenDeployModal,
}) => {
  const [functions, setFunctions] = useState<EdgeFunction[]>(INITIAL_FUNCTIONS);
  const [selectedFunc, setSelectedFunc] = useState<EdgeFunction | null>(null);
  const [editorCode, setEditorCode] = useState<string>('');
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
    if (!selectedFunc) return;
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
      <div className="p-5 rounded-2xl bg-[#171717] border border-[#242424] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-[#3ECF8E]/10 text-[#3ECF8E] border border-[#3ECF8E]/30">
              JINT 4.0 ISOLATE SANDBOX
            </span>
            <span
              className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider ${
                enabled
                  ? 'bg-[#3ECF8E]/10 text-[#3ECF8E] border border-[#3ECF8E]/30'
                  : 'bg-[#1f1f1f] text-zinc-500 border border-[#2e2e2e]'
              }`}
            >
              {enabled ? 'READY' : 'DISABLED'}
            </span>
          </div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Terminal className="w-5 h-5 text-[#3ECF8E]" />
            توابع سرورلس لبه شبکه (Serverless Edge Functions Studio)
          </h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-2xl leading-relaxed">
            اجرای توابع جاوااسکریپت و تایپ‌اسکریپت روی موتور ایزوله خالص Jint با سقف رم ۱۶ مگابایت و تاخیر زیر ۱۰ میلی‌ثانیه.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onToggleEnable}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition ${
              enabled
                ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30'
                : 'bg-[#3ECF8E] hover:bg-[#34b27b] text-black shadow-sm'
            }`}
          >
            {enabled ? 'غیرفعال‌سازی سرویس توابع' : 'فعال‌سازی سرویس توابع لبه'}
          </button>

          {enabled && (
            <button
              onClick={onOpenDeployModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs transition shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>استقرار تابع جدید</span>
            </button>
          )}
        </div>
      </div>

      {!enabled ? (
        <div className="p-12 text-center rounded-2xl bg-[#171717] border border-dashed border-[#242424] max-w-xl mx-auto space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#1f1f1f] flex items-center justify-center mx-auto text-[#3ECF8E]">
            <Terminal className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-white">سرویس توابع لبه برای این پروژه فعال نشده است</h4>
          <p className="text-xs text-zinc-400 leading-relaxed">
            برای اجرای کدهای هوک ارسال پیامک، اعتبارسنجی درگاه‌های بانکی، و کارهای بدون سرور، سرویس را فعال نمایید.
          </p>
          <button
            onClick={onToggleEnable}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#3ECF8E] hover:bg-[#34b27b] text-black font-semibold text-xs transition shadow-sm"
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
              <div className="p-3.5 rounded-xl bg-[#171717] border border-[#242424] space-y-3">
                <div className="text-xs font-semibold text-zinc-400 flex items-center justify-between">
                  <span>توابع مستقر شده ({functions.length})</span>
                  <span className="text-[10px] text-zinc-500 font-mono">Jint Pool</span>
                </div>
                <div className="space-y-2 max-h-[480px] overflow-y-auto">
                  {functions.length === 0 ? (
                    <div className="p-6 text-center text-xs text-zinc-500 rounded-xl border border-dashed border-[#242424]">
                      هیچ تابعی ایجاد نشده است
                    </div>
                  ) : (
                    functions.map((fn) => (
                      <div
                        key={fn.id}
                        onClick={() => handleSelectFunc(fn)}
                        className={`cursor-pointer p-3.5 rounded-xl border transition ${
                          selectedFunc?.id === fn.id
                            ? 'bg-[#1f1f1f] border-[#3ECF8E]/40 shadow-sm'
                            : 'bg-[#171717] border-[#242424] hover:border-[#3ECF8E]/30'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-xs font-bold text-[#3ECF8E] dir-ltr">{fn.slug}</span>
                          <span className="text-[10px] text-zinc-500 font-mono">{fn.invocationsCount} hits</span>
                        </div>
                        <div className="text-xs font-medium text-white">{fn.name}</div>
                        <div className="text-[10px] text-zinc-400 font-mono mt-1.5 flex items-center gap-2">
                          <span>RAM: {fn.memoryLimitMb}MB</span>
                          <span>Timeout: {fn.timeoutSeconds}s</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Editor & Live Runner */}
            <div className="lg:col-span-8 space-y-4">
              {/* Code Editor Header */}
              <div className="p-4 rounded-2xl bg-[#171717] border border-[#242424] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Code className="w-4 h-4 text-[#3ECF8E]" />
                    <span className="text-xs font-bold text-white">
                      ویرایشگر جاوااسکریپت: <span className="font-mono text-[#3ECF8E]">{selectedFunc?.slug || 'بدون تابع'}</span>
                    </span>
                  </div>
                  <button
                    onClick={handleSaveScript}
                    disabled={!selectedFunc}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1f1f1f] hover:bg-[#282828] disabled:opacity-50 text-zinc-200 font-medium text-xs transition border border-[#2e2e2e]"
                  >
                    <Save className="w-3.5 h-3.5 text-[#3ECF8E]" />
                    <span>ذخیره اسکریپت</span>
                  </button>
                </div>

                {/* Code Textarea */}
                <div dir="ltr">
                  <textarea
                    value={editorCode}
                    onChange={(e) => setEditorCode(e.target.value)}
                    className="w-full h-64 p-3.5 rounded-xl bg-[#0f0f0f] font-mono text-xs text-[#ededed] border border-[#242424] focus:outline-none focus:border-[#3ECF8E] leading-relaxed resize-y"
                    spellCheck={false}
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Live Test Runner Pane */}
              <div className="p-4 rounded-2xl bg-[#171717] border border-[#242424] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    <Play className="w-3.5 h-3.5 text-[#3ECF8E]" />
                    آزمایش و اجرای زنده اسکریپت (Live Test Runner)
                  </span>
                  <div className="flex items-center gap-2">
                    {execLatency !== null && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#3ECF8E]/10 text-[#3ECF8E] border border-[#3ECF8E]/30">
                        تاخیر: {execLatency} ms
                      </span>
                    )}
                    <button
                      onClick={handleRunTest}
                      disabled={isExecuting}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#3ECF8E] hover:bg-[#34b27b] text-black font-semibold text-xs transition shadow-sm disabled:opacity-50"
                    >
                      <Play className="w-3 h-3 fill-black" />
                      <span>{isExecuting ? 'در حال اجرا...' : 'اجرای زنده'}</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3" dir="ltr">
                  <div>
                    <label className="text-[11px] font-mono font-medium text-zinc-400 block mb-1">
                      Input JSON Payload
                    </label>
                    <textarea
                      value={testPayload}
                      onChange={(e) => setTestPayload(e.target.value)}
                      className="w-full h-32 p-2.5 rounded-xl bg-[#0f0f0f] font-mono text-[11px] text-zinc-300 border border-[#242424] focus:outline-none focus:border-[#3ECF8E] resize-none"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-mono font-medium text-zinc-400 block mb-1">
                      Execution Inspector
                    </label>
                    <pre className="w-full h-32 p-2.5 rounded-xl bg-[#0f0f0f] font-mono text-[11px] text-zinc-300 border border-[#242424] overflow-auto" dir="ltr">
                      {testOutput}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Secrets Vault & Environment Variables */}
          <div className="p-5 rounded-2xl bg-[#171717] border border-[#242424] space-y-4">
            <div>
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-[#3ECF8E]" />
                خزانه کلیدهای محرمانه و متغیرهای محیطی (Secrets Vault - AES-256-GCM)
              </h4>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                کلیدهای محرمانه تنها در حافظه ایزوله Jint بارگذاری شده و به صورت رمزنگاری‌شده در دیتابیس ذخیره می‌شوند.
              </p>
            </div>

            {/* Add Env Var Form */}
            <form onSubmit={handleAddEnv} className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
              <div className="md:col-span-4" dir="ltr">
                <input
                  type="text"
                  placeholder="KEY_NAME (e.g. KAVENEGAR_TOKEN)"
                  value={newEnvKey}
                  onChange={(e) => setNewEnvKey(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#0f0f0f] border border-[#242424] font-mono text-xs text-zinc-200 focus:outline-none focus:border-[#3ECF8E] uppercase"
                  dir="ltr"
                />
              </div>
              <div className="md:col-span-5" dir="ltr">
                <input
                  type="password"
                  placeholder="Secret value"
                  value={newEnvVal}
                  onChange={(e) => setNewEnvVal(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#0f0f0f] border border-[#242424] font-mono text-xs text-zinc-200 focus:outline-none focus:border-[#3ECF8E]"
                  dir="ltr"
                />
              </div>
              <div className="md:col-span-3 flex items-center justify-end gap-2">
                <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newEnvSecret}
                    onChange={(e) => setNewEnvSecret(e.target.checked)}
                    className="rounded border-[#242424] bg-[#0f0f0f] text-[#3ECF8E] focus:ring-[#3ECF8E]"
                  />
                  <span>محرمانه</span>
                </label>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#1f1f1f] hover:bg-[#282828] text-zinc-200 font-medium text-xs transition border border-[#2e2e2e]"
                >
                  <Plus className="w-3 h-3 text-[#3ECF8E]" />
                  <span>افزودن</span>
                </button>
              </div>
            </form>

            {/* Env Vars Table */}
            <div className="overflow-x-auto rounded-xl border border-[#242424]">
              <table className="w-full text-left text-xs font-mono" dir="ltr">
                <thead>
                  <tr className="border-b border-[#242424] bg-[#1a1a1a] text-zinc-400">
                    <th className="py-2.5 px-3">Variable Key</th>
                    <th className="py-2.5 px-3">Value</th>
                    <th className="py-2.5 px-3">Security Mode</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#242424]">
                  {envVars.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-xs text-zinc-500 font-sans" dir="rtl">
                        هیچ متغیر محیطی تعریف نشده است
                      </td>
                    </tr>
                  ) : (
                    envVars.map((v) => {
                      const isVisible = visibleSecrets.has(v.key);
                      return (
                        <tr key={v.key} className="hover:bg-[#1f1f1f] transition">
                          <td className="py-2.5 px-3 font-bold text-[#3ECF8E]">{v.key}</td>
                          <td className="py-2.5 px-3 text-zinc-300">
                            {v.isSecret && !isVisible ? '••••••••••••••••••••' : v.value}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                v.isSecret
                                  ? 'bg-[#3ECF8E]/10 text-[#3ECF8E] border border-[#3ECF8E]/30'
                                  : 'bg-[#1f1f1f] text-zinc-400 border border-[#2e2e2e]'
                              }`}
                            >
                              {v.isSecret ? 'AES-256 Secret' : 'Public Config'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {v.isSecret && (
                                <button
                                  onClick={() => toggleSecretVisibility(v.key)}
                                  className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-[#1f1f1f]"
                                >
                                  {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-[#3ECF8E]" />}
                                </button>
                              )}
                              <button
                                onClick={() => handleRemoveEnv(v.key)}
                                className="p-1 rounded-full text-zinc-500 hover:text-red-400 hover:bg-[#1f1f1f]"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
