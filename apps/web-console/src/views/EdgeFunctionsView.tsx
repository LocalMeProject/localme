import React, { useState, useEffect, useCallback } from 'react';
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
  RefreshCw,
  Clock,
} from 'lucide-react';

interface EdgeFunctionsViewProps {
  project: Project;
  enabled: boolean;
  onToggleEnable: () => void;
  onOpenDeployModal: () => void;
  activeSubView?: string;
  onSubViewChange?: (subView: string) => void;
}

export const EdgeFunctionsView: React.FC<EdgeFunctionsViewProps> = ({
  project,
  enabled,
  onToggleEnable,
  onOpenDeployModal,
  activeSubView = 'list',
}) => {
  const [functions, setFunctions] = useState<EdgeFunction[]>([]);
  const [selectedFunc, setSelectedFunc] = useState<EdgeFunction | null>(null);
  const [editorCode, setEditorCode] = useState<string>('');
  const [testPayload, setTestPayload] = useState<string>('{\n  "userId": "1001",\n  "action": "verify"\n}');
  const [testOutput, setTestOutput] = useState<string>('{\n  "status": "ready",\n  "message": "برای تست و اجرای تابع، دکمه «اجرای تابع» را بزنید"\n}');
  const [execLatency, setExecLatency] = useState<number | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isLoadingFunctions, setIsLoadingFunctions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Environment Variables
  const [envVars, setEnvVars] = useState<FunctionEnvVar[]>([]);
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvVal, setNewEnvVal] = useState('');
  const [newEnvSecret, setNewEnvSecret] = useState(true);
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());

  // Real API: Fetch Functions
  const fetchFunctions = useCallback(async () => {
    setIsLoadingFunctions(true);
    try {
      const res = await fetch(`/_baas/v1/${project.slug}/functions`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const mapped: EdgeFunction[] = data.map((f: Record<string, unknown>) => ({
            id: String(f.id || f.slug || ''),
            name: String(f.name || f.slug || ''),
            slug: String(f.slug || f.name || ''),
            runtime: String(f.runtime || 'nodejs20'),
            script: String(f.script || f.code || '// LocalMe Edge Function\nreturn { success: true, message: "Hello from Edge!" };'),
            memoryLimitMb: Number(f.memoryLimitMb || 16),
            timeoutSeconds: Number(f.timeoutSeconds || 3),
            invocationsCount: Number(f.invocationsCount || 0),
            createdAt: String(f.createdAt || 'هم‌اکنون'),
            deployedAt: String(f.updatedAt || f.deployedAt || 'هم‌اکنون'),
            invocations24h: Number(f.invocations24h || 0),
          }));
          setFunctions(mapped);
          if (mapped.length > 0 && !selectedFunc) {
            setSelectedFunc(mapped[0]);
            setEditorCode(mapped[0].script);
          }
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingFunctions(false);
    }
  }, [project.slug, selectedFunc]);

  useEffect(() => {
    fetchFunctions();
  }, [fetchFunctions]);

  const handleSelectFunc = (fn: EdgeFunction) => {
    setSelectedFunc(fn);
    setEditorCode(fn.script);
  };

  // Real API: Save Script
  const handleSaveScript = async () => {
    if (!selectedFunc) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/_baas/v1/${project.slug}/functions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selectedFunc.name,
          slug: selectedFunc.slug,
          runtime: selectedFunc.runtime || 'nodejs20',
          code: editorCode,
        }),
      });
      if (res.ok) {
        setFunctions((prev) =>
          prev.map((fn) =>
            fn.id === selectedFunc.id ? { ...fn, script: editorCode } : fn
          )
        );
        alert(`کد تابع «${selectedFunc.name}» با موفقیت در سرور ذخیره شد.`);
      } else {
        alert('خطا در ذخیره کد تابع.');
      }
    } catch {
      alert('خطا در برقراری ارتباط با سرور.');
    } finally {
      setIsSaving(false);
    }
  };

  // Real API: Execute Function
  const handleRunTest = async () => {
    if (!selectedFunc) return;
    setIsExecuting(true);
    const start = performance.now();

    try {
      let parsedPayload = {};
      try {
        parsedPayload = JSON.parse(testPayload);
      } catch {
        // ignore
      }

      const res = await fetch(`/_baas/v1/${project.slug}/functions/${selectedFunc.slug}/invoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsedPayload),
      });

      const duration = Math.round(performance.now() - start);
      setExecLatency(duration);

      const data = await res.json().catch(() => ({ status: res.status, statusText: res.statusText }));
      setTestOutput(JSON.stringify(data, null, 2));
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setTestOutput(JSON.stringify({ error: errorMsg }, null, 2));
    } finally {
      setIsExecuting(false);
    }
  };

  // Real API: Delete Function
  const handleDeleteFunc = async (slug: string) => {
    if (!confirm(`آیا از حذف تابع "${slug}" اطمینان دارید؟`)) return;
    try {
      const res = await fetch(`/_baas/v1/${project.slug}/functions/${slug}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const remaining = functions.filter((f) => f.slug !== slug);
        setFunctions(remaining);
        if (selectedFunc?.slug === slug) {
          setSelectedFunc(remaining[0] || null);
          setEditorCode(remaining[0]?.script || '');
        }
      }
    } catch {
      // ignore
    }
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
            {activeSubView === 'env'
              ? 'متغیرهای محیطی و تنظیمات توابع'
              : activeSubView === 'deploy'
              ? 'ثبت و استقرار تابع جدید'
              : 'فهرست و محیط اجرای توابع لبه'}
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            اجرای توابع اختصاصی، وب‌هوک‌ها، محاسبات پرداخت و پردازش رویدادها با حداقل زمان تاخیر.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchFunctions}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition shadow-xs"
            title="بازخوانی توابع"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFunctions ? 'animate-spin' : ''}`} />
            <span>بازخوانی</span>
          </button>
          <button
            onClick={onToggleEnable}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition border ${
              enabled
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent shadow-xs'
            }`}
          >
            {enabled ? 'غیرفعال‌سازی سرویس' : 'فعال‌سازی سرویس'}
          </button>
          <button
            onClick={onOpenDeployModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>استقرار تابع جدید</span>
          </button>
        </div>
      </div>

      {/* Sub-View: Environment Variables */}
      {activeSubView === 'env' && (
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs max-w-3xl space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Shield className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">متغیرهای محیطی و کلیدهای محرمانه توابع</h3>
          </div>

          <form onSubmit={handleAddEnv} className="flex flex-col sm:flex-row items-end gap-3 pb-4 border-b border-slate-100">
            <div className="flex-1 w-full sm:w-auto">
              <label className="text-xs text-slate-600 block mb-1">نام کلید (KEY)</label>
              <input
                type="text"
                value={newEnvKey}
                onChange={(e) => setNewEnvKey(e.target.value)}
                placeholder="JWT_SECRET"
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xs text-slate-800 focus:outline-none focus:border-emerald-500 shadow-xs uppercase"
                dir="ltr"
              />
            </div>
            <div className="flex-1 w-full sm:w-auto">
              <label className="text-xs text-slate-600 block mb-1">مقدار (VALUE)</label>
              <input
                type="text"
                value={newEnvVal}
                onChange={(e) => setNewEnvVal(e.target.value)}
                placeholder="sk_live_..."
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xs text-slate-800 focus:outline-none focus:border-emerald-500 shadow-xs"
                dir="ltr"
              />
            </div>
            <label className="flex items-center gap-1.5 text-xs text-slate-600 pb-2.5 cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={newEnvSecret}
                onChange={(e) => setNewEnvSecret(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
              />
              <span>محرمانه (Secret)</span>
            </label>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition shadow-xs shrink-0"
            >
              افزودن متغیر
            </button>
          </form>

          <div className="space-y-2">
            {envVars.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">هنوز متغیر محیطی تعریف نشده است.</p>
            ) : (
              envVars.map((env) => (
                <div key={env.key} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-slate-800" dir="ltr">{env.key}</span>
                    <span className="font-mono text-xs text-slate-500" dir="ltr">
                      {env.isSecret && !visibleSecrets.has(env.key) ? '••••••••••••' : env.value}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {env.isSecret && (
                      <button
                        onClick={() => toggleSecretVisibility(env.key)}
                        className="p-1 text-slate-400 hover:text-slate-600"
                      >
                        {visibleSecrets.has(env.key) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    <button
                      onClick={() => handleRemoveEnv(env.key)}
                      className="p-1 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Main Functions Studio (List & Code Editor) */}
      {activeSubView !== 'env' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Functions Sidebar List */}
          <div className="lg:col-span-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-bold text-slate-900">
                فهرست توابع ({functions.length})
              </span>
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {isLoadingFunctions ? (
                <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                  <span>در حال دریافت توابع...</span>
                </div>
              ) : functions.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 rounded-xl border border-dashed border-slate-200 space-y-2">
                  <p>هنوز تابعی ایجاد نشده است.</p>
                  <button
                    onClick={onOpenDeployModal}
                    className="text-xs text-emerald-700 hover:underline font-medium"
                  >
                    + استقرار اولین تابع
                  </button>
                </div>
              ) : (
                functions.map((fn) => (
                  <div
                    key={fn.slug}
                    className={`w-full p-3 rounded-xl border text-right transition flex items-center justify-between ${
                      selectedFunc?.slug === fn.slug
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <button
                      onClick={() => handleSelectFunc(fn)}
                      className="flex items-center gap-2.5 truncate flex-1 text-right"
                    >
                      <Code className={`w-4 h-4 shrink-0 ${selectedFunc?.slug === fn.slug ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <div className="truncate">
                        <div className="text-xs font-bold truncate">{fn.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono" dir="ltr">/{fn.slug}</div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleDeleteFunc(fn.slug)}
                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                      title="حذف تابع"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Code Editor & Test Console */}
          <div className="lg:col-span-8 space-y-4">
            {selectedFunc ? (
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 font-mono" dir="ltr">
                      {selectedFunc.name} ({selectedFunc.runtime})
                    </h3>
                    <div className="text-[10px] text-slate-400 font-mono" dir="ltr">
                      POST /_baas/v1/{project.slug}/functions/{selectedFunc.slug}/invoke
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveScript}
                      disabled={isSaving}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition shadow-xs disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{isSaving ? 'در حال ذخیره...' : 'ذخیره کد'}</span>
                    </button>
                    <button
                      onClick={handleRunTest}
                      disabled={isExecuting}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs transition shadow-xs disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{isExecuting ? 'در حال اجرا...' : 'اجرای تابع'}</span>
                    </button>
                  </div>
                </div>

                {/* Code Canvas */}
                <div>
                  <label className="text-[11px] text-slate-500 font-medium block mb-1">
                    کد جاوااسکریپت تابع لبه:
                  </label>
                  <textarea
                    value={editorCode}
                    onChange={(e) => setEditorCode(e.target.value)}
                    rows={10}
                    className="w-full p-3 rounded-xl bg-slate-900 text-emerald-300 font-mono text-xs focus:outline-none border border-slate-800 shadow-xs"
                    dir="ltr"
                    spellCheck={false}
                  />
                </div>

                {/* Tester Payload & Output */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="text-[11px] text-slate-500 font-medium block mb-1">
                      ورودی JSON درخواست:
                    </label>
                    <textarea
                      value={testPayload}
                      onChange={(e) => setTestPayload(e.target.value)}
                      rows={5}
                      className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-mono text-xs focus:outline-none focus:border-emerald-500"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] text-slate-500 font-medium">
                        خروجی اجرای زنده:
                      </label>
                      {execLatency !== null && (
                        <span className="text-[10px] text-emerald-700 font-mono flex items-center gap-1" dir="ltr">
                          <Clock className="w-3 h-3" /> {execLatency} ms
                        </span>
                      )}
                    </div>
                    <textarea
                      value={testOutput}
                      readOnly
                      rows={5}
                      className="w-full p-2.5 rounded-xl bg-slate-900 text-slate-200 font-mono text-xs focus:outline-none border border-slate-800"
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200 shadow-xs">
                جهت مشاهده، ویرایش و تست، یک تابع از ستون کناری انتخاب نمایید.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
