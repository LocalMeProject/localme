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
  project: _project,
  enabled,
  onToggleEnable,
  onOpenDeployModal,
}) => {
  const [functions, setFunctions] = useState<EdgeFunction[]>(INITIAL_FUNCTIONS);
  const [selectedFunc, setSelectedFunc] = useState<EdgeFunction | null>(null);
  const [editorCode, setEditorCode] = useState<string>('');
  const [testPayload, setTestPayload] = useState<string>('{\n  "phone": "09121112233",\n  "code": "582910"\n}');
  const [testOutput, setTestOutput] = useState<string>('{\n  "status": "ready",\n  "message": "جهت اجرای تابع، دکمه اجرای آزمایشی را بزنید"\n}');
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
    alert(`کد تابع «${selectedFunc.name}» با موفقیت ذخیره گردید.`);
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
            payloadReceived: parsedPayload,
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
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              توابع ابری بدون سرور
            </span>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                enabled
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-slate-100 text-slate-500 border border-slate-200'
              }`}
            >
              {enabled ? 'فعال و آماده' : 'غیرفعال'}
            </span>
          </div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Terminal className="w-5 h-5 text-emerald-600" />
            اجرا و استقرار توابع بدون سرور
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            اجرای منطق بک‌اند، وب‌هوک‌ها، محاسبات اختصاصی و مدیریت رویدادها با حداقل تاخیر در لبه شبکه.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onToggleEnable}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition ${
              enabled
                ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
            }`}
          >
            {enabled ? 'غیرفعال‌سازی سرویس' : 'فعال‌سازی سرویس توابع'}
          </button>

          {enabled && (
            <button
              onClick={onOpenDeployModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>استقرار تابع جدید</span>
            </button>
          )}
        </div>
      </div>

      {!enabled ? (
        <div className="p-12 text-center rounded-2xl bg-white border border-dashed border-slate-200 max-w-xl mx-auto space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto text-emerald-600">
            <Terminal className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">سرویس توابع ابری برای این پروژه فعال نشده است</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            برای اجرای توابع سفارشی، پردازش وب‌هوک‌های پرداخت و ثبت رخدادها، این سرویس را فعال نمایید.
          </p>
          <button
            onClick={onToggleEnable}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition shadow-xs"
          >
            فعال‌سازی سرویس توابع ابری
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Functions List Sidebar */}
          <div className="lg:col-span-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-bold text-slate-900">
                فهرست توابع مستقر شده ({functions.length})
              </span>
            </div>

            <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
              {functions.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 rounded-xl border border-dashed border-slate-200 space-y-2">
                  <p>هنوز تابعی ثبت نشده است.</p>
                  <button
                    onClick={onOpenDeployModal}
                    className="text-xs text-emerald-700 hover:underline font-medium"
                  >
                    + استقرار اولین تابع
                  </button>
                </div>
              ) : (
                functions.map((fn) => (
                  <button
                    key={fn.id}
                    onClick={() => handleSelectFunc(fn)}
                    className={`w-full p-3 rounded-xl border text-right transition flex items-center justify-between ${
                      selectedFunc?.id === fn.id
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold">{fn.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5" dir="ltr">
                        {fn.slug}
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-500 font-mono" dir="ltr">
                      {fn.runtime}
                    </span>
                  </button>
                ))
              )}
            </div>

            {/* Environment Variables Box */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-600" />
                متغیرهای محیطی و کلیدهای محرمانه
              </h4>

              <form onSubmit={handleAddEnv} className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <input
                    type="text"
                    placeholder="KEY_NAME"
                    value={newEnvKey}
                    onChange={(e) => setNewEnvKey(e.target.value)}
                    dir="ltr"
                    className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                  <input
                    type="text"
                    placeholder="Value"
                    value={newEnvVal}
                    onChange={(e) => setNewEnvVal(e.target.value)}
                    dir="ltr"
                    className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newEnvSecret}
                      onChange={(e) => setNewEnvSecret(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>کلید محرمانه (Secret)</span>
                  </label>
                  <button
                    type="submit"
                    className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 transition"
                  >
                    افزودن متغیر
                  </button>
                </div>
              </form>

              {envVars.length > 0 && (
                <div className="space-y-1 max-h-32 overflow-y-auto pt-1">
                  {envVars.map((env) => (
                    <div
                      key={env.key}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px]"
                    >
                      <span className="font-mono text-slate-700 font-bold" dir="ltr">{env.key}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-slate-500" dir="ltr">
                          {env.isSecret && !visibleSecrets.has(env.key) ? '••••••••' : env.value}
                        </span>
                        {env.isSecret && (
                          <button
                            type="button"
                            onClick={() => toggleSecretVisibility(env.key)}
                            className="text-slate-400 hover:text-slate-600 p-0.5"
                          >
                            {visibleSecrets.has(env.key) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveEnv(env.key)}
                          className="text-slate-400 hover:text-rose-600 p-0.5"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Interactive Code Editor & Test Workspace */}
          <div className="lg:col-span-8 space-y-4">
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Code className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-900">
                    ویرایشگر کد تابع: <span className="font-mono text-emerald-700" dir="ltr">{selectedFunc?.name || 'انتخاب نشده'}</span>
                  </span>
                </div>
                {selectedFunc && (
                  <button
                    onClick={handleSaveScript}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition shadow-xs"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>ذخیره تغییرات</span>
                  </button>
                )}
              </div>

              <textarea
                value={editorCode}
                onChange={(e) => setEditorCode(e.target.value)}
                rows={10}
                dir="ltr"
                placeholder="// کد اسکریپت جاوااسکریپت تابع را اینجا بنویسید..."
                className="w-full p-3 rounded-xl bg-slate-900 text-emerald-400 font-mono text-xs focus:outline-none leading-relaxed"
              />

              {/* Test Execution Panel */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">اجرای آزمایشی با ورودی داده</span>
                  <button
                    onClick={handleRunTest}
                    disabled={isExecuting}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-xs transition disabled:opacity-50"
                  >
                    <Play className={`w-3.5 h-3.5 ${isExecuting ? 'animate-spin' : ''}`} />
                    <span>{isExecuting ? 'در حال اجرا...' : 'اجرای آزمایشی'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[11px] text-slate-500 font-medium block mb-1">داده ورودی (JSON)</label>
                    <textarea
                      value={testPayload}
                      onChange={(e) => setTestPayload(e.target.value)}
                      rows={5}
                      dir="ltr"
                      className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono text-[11px] text-slate-800 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] text-slate-500 font-medium">خروجی اجرا</label>
                      {execLatency !== null && (
                        <span className="text-[10px] text-emerald-700 font-mono" dir="ltr">{execLatency} ms</span>
                      )}
                    </div>
                    <textarea
                      value={testOutput}
                      readOnly
                      rows={5}
                      dir="ltr"
                      className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono text-[11px] text-slate-700 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
