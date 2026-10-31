import React, { useState, useEffect, useCallback } from 'react';
import { Project } from '../types';
import {
  Settings,
  Key,
  Trash2,
  Copy,
  Check,
  Network,
  Users,
  Save,
} from 'lucide-react';
import { ConfirmModal } from '../components/modals/ConfirmModal';
import { AlertModal } from '../components/modals/AlertModal';

interface SettingsViewProps {
  project: Project;
  onUpdateProject: (updated: Partial<Project>) => void;
  onDeleteProject: () => void;
  activeSubView?: string;
  onSubViewChange?: (subView: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  project,
  onUpdateProject,
  onDeleteProject,
  activeSubView = 'general',
}) => {
  const [name, setName] = useState(project.name);
  const [desc, setDesc] = useState(project.description);
  const [projectPassword, setProjectPassword] = useState('');
  const [hasPassword, setHasPassword] = useState(project.hasPassword);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Team collaborators
  const [teamMembers, setTeamMembers] = useState<
    { id: string; name: string; role: string; contact: string }[]
  >([]);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberContact, setNewMemberContact] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('Developer');

  // Network Settings
  const [egressRegion, setEgressRegion] = useState('ir-tehran');
  const [isDedicatedIp, setIsDedicatedIp] = useState(false);

  // Modals
  const [showRemovePasswordModal, setShowRemovePasswordModal] = useState(false);
  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'error' | 'success' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });

  const fetchTeam = useCallback(async () => {
    try {
      const res = await fetch(`/_baas/v1/${project.slug}/team`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setTeamMembers(
            data.map((m: Record<string, unknown>) => ({
              id: String(m.id || ''),
              name: String(m.name || m.fullName || 'همکار'),
              role: String(m.role || 'Developer'),
              contact: String(m.contact || m.phone || m.email || ''),
            }))
          );
        }
      }
    } catch {
      // ignore
    }
  }, [project.slug]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  // Real API: Save General
  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingGeneral(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch(`/_baas/v1/projects/${project.slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: desc }),
      });
      if (res.ok) {
        onUpdateProject({ name, description: desc });
        setFeedbackMsg('مشخصات عمومی پروژه با موفقیت ذخیره گردید.');
      } else {
        setFeedbackMsg('خطا در ذخیره‌سازی مشخصات پروژه.');
      }
    } catch {
      setFeedbackMsg('خطا در ارتباط با سرور.');
    } finally {
      setIsSavingGeneral(false);
    }
  };

  // Real API: Set Password
  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectPassword || projectPassword.length < 4) {
      setAlertState({
        isOpen: true,
        title: 'رمز عبور نامعتبر است',
        message: 'رمز عبور پروژه باید حداقل ۴ کاراکتر باشد.',
        type: 'error',
      });
      return;
    }
    try {
      const res = await fetch(`/_baas/v1/projects/${project.slug}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: projectPassword }),
      });
      if (res.ok) {
        setHasPassword(true);
        setProjectPassword('');
        setAlertState({
          isOpen: true,
          title: 'تنظیم موفق رمز عبور',
          message: 'رمز عبور اختصاصی پروژه با موفقیت تنظیم گردید.',
          type: 'success',
        });
      } else {
        setAlertState({
          isOpen: true,
          title: 'خطا در تنظیم رمز عبور',
          message: 'تنظیم رمز عبور پروژه با خطا مواجه شد.',
          type: 'error',
        });
      }
    } catch {
      setAlertState({
        isOpen: true,
        title: 'خطای ارتباط با سرور',
        message: 'برقراری ارتباط با سرور ناموفق بود.',
        type: 'error',
      });
    }
  };

  // Real API: Remove Password
  const handleRemovePassword = () => {
    setShowRemovePasswordModal(true);
  };

  const executeRemovePassword = async () => {
    setShowRemovePasswordModal(false);
    try {
      const res = await fetch(`/_baas/v1/projects/${project.slug}/password`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setHasPassword(false);
        setAlertState({
          isOpen: true,
          title: 'حذف رمز عبور',
          message: 'رمز عبور اختصاصی پروژه با موفقیت حذف گردید.',
          type: 'success',
        });
      }
    } catch {
      setAlertState({
        isOpen: true,
        title: 'خطای ارتباط با سرور',
        message: 'خطا در حذف رمز عبور پروژه.',
        type: 'error',
      });
    }
  };

  // Real API: Add Team Member
  const handleAddTeamMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim() || !newMemberContact.trim()) return;

    try {
      const res = await fetch(`/_baas/v1/${project.slug}/team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newMemberName.trim(),
          contact: newMemberContact.trim(),
          role: newMemberRole,
        }),
      });
      if (res.ok) {
        setNewMemberName('');
        setNewMemberContact('');
        fetchTeam();
      }
    } catch {
      // ignore
    }
  };

  const handleCopyKey = (keyName: string, val: string) => {
    navigator.clipboard.writeText(val);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const apiKeys: Record<string, string> = {
    database: `lm_db_${project.id.slice(0, 8)}_live_99a8b7`,
    auth: `lm_auth_${project.id.slice(0, 8)}_live_44c3d2`,
    storage: `lm_str_${project.id.slice(0, 8)}_live_77e6f5`,
    functions: `lm_fn_${project.id.slice(0, 8)}_live_11g2h3`,
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              پیکربندی پروژه
            </span>
            <span className="text-xs text-slate-400 font-mono" dir="ltr">
              {project.slug}
            </span>
          </div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-600" />
            {activeSubView === 'network'
              ? 'موقعیت سرور و مسیریابی شبکه'
              : activeSubView === 'team'
              ? 'اعضای تیم و سطوح دسترسی'
              : 'تنظیمات عمومی و کلیدهای دسترسی'}
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            مدیریت مشخصات فنی پروژه، کلیدهای ارتباطی سرویس‌ها، رمز عبور، اعضای تیم و گزینه‌های شبکه.
          </p>
        </div>
      </div>

      {/* Sub-View: Network */}
      {activeSubView === 'network' && (
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs max-w-2xl space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Network className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">مسیریابی شبکه و موقعیت سرور خروجی</h3>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1.5">منطقه پردازشی پیش‌فرض</label>
              <select
                value={egressRegion}
                onChange={(e) => setEgressRegion(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-xs focus:outline-none focus:border-emerald-500 shadow-xs"
              >
                <option value="ir-tehran">ایران - تهران (برج میلاد آسیاتک)</option>
                <option value="cross-de">نود خروجی فرامرزی - آلمان (فرانکفورت)</option>
                <option value="cross-nl">نود خروجی فرامرزی - هلند (آمستردام)</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <div className="font-semibold text-slate-800">آدرس IP ثابت اختصاصی (Dedicated IP)</div>
                <div className="text-[11px] text-slate-400">تخصیص آدرس IP اختصاصی برای درخواست‌های خروجی پروژه</div>
              </div>
              <input
                type="checkbox"
                checked={isDedicatedIp}
                onChange={(e) => setIsDedicatedIp(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
              />
            </div>
          </div>
        </div>
      )}

      {/* Sub-View: Team */}
      {activeSubView === 'team' && (
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs max-w-3xl space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Users className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">اعضای همکار در این پروژه ({teamMembers.length})</h3>
          </div>

          <form onSubmit={handleAddTeamMember} className="flex flex-col sm:flex-row items-end gap-3 pb-4 border-b border-slate-100 text-xs">
            <div className="flex-1 w-full sm:w-auto">
              <label className="text-slate-600 block mb-1">نام همکار</label>
              <input
                type="text"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                placeholder="مثال: علی رضایی"
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 shadow-xs"
              />
            </div>
            <div className="flex-1 w-full sm:w-auto">
              <label className="text-slate-600 block mb-1">شماره تماس یا ایمیل</label>
              <input
                type="text"
                value={newMemberContact}
                onChange={(e) => setNewMemberContact(e.target.value)}
                placeholder="0912... یا email"
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xs text-slate-800 focus:outline-none focus:border-emerald-500 shadow-xs"
                dir="ltr"
              />
            </div>
            <div className="w-full sm:w-36">
              <label className="text-slate-600 block mb-1">نقش دسترسی</label>
              <select
                value={newMemberRole}
                onChange={(e) => setNewMemberRole(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 shadow-xs"
              >
                <option value="Developer">توسعه‌دهنده</option>
                <option value="Operator">اپراتور</option>
                <option value="Accountant">حسابدار</option>
              </select>
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition shadow-xs shrink-0"
            >
              افزودن عضو
            </button>
          </form>

          <div className="space-y-2">
            {teamMembers.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">هنوز عضوی به این پروژه افزوده نشده است.</p>
            ) : (
              teamMembers.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <div>
                    <div className="font-bold text-slate-800">{m.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono" dir="ltr">{m.contact}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-white border border-slate-200 text-slate-600 font-medium">
                    {m.role}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Sub-View: General (Default) */}
      {(activeSubView === 'general' || (!activeSubView && activeSubView !== 'network' && activeSubView !== 'team')) && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* General Information */}
          <div className="lg:col-span-6 p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 border-b border-slate-100 pb-3">
              مشخصات عمومی پروژه
            </h3>

            <form onSubmit={handleSaveGeneral} className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-600 font-medium block mb-1">نام پروژه</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none shadow-xs"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-600 font-medium block mb-1">توضیحات پروژه</label>
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  rows={3}
                  className="w-full px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none leading-relaxed shadow-xs"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="submit"
                  disabled={isSavingGeneral}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingGeneral ? 'در حال ذخیره‌سازی...' : 'ذخیره تغییرات عمومی'}</span>
                </button>

                {feedbackMsg && (
                  <span className="text-xs text-emerald-700 font-medium">{feedbackMsg}</span>
                )}
              </div>
            </form>
          </div>

          {/* Access Protection */}
          <div className="lg:col-span-6 p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 border-b border-slate-100 pb-3">
              امنیت و رمز عبور اختصاصی
            </h3>

            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-800">حفاظت با رمز عبور</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {hasPassword ? 'پروژه دارای رمز عبور اختصاصی است.' : 'بدون رمز عبور اختصاصی'}
                  </div>
                </div>
                <span
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    hasPassword
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {hasPassword ? 'فعال' : 'غیرفعال'}
                </span>
              </div>

              <form onSubmit={handleSetPassword} className="space-y-2">
                <label className="text-[11px] text-slate-600 font-medium block">
                  {hasPassword ? 'تغییر رمز عبور پروژه' : 'تنظیم رمز عبور جدید'}
                </label>
                <input
                  type="password"
                  value={projectPassword}
                  onChange={(e) => setProjectPassword(e.target.value)}
                  placeholder="حداقل ۴ کاراکتر"
                  className="w-full px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none shadow-xs"
                  dir="ltr"
                />
                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition shadow-xs"
                  >
                    {hasPassword ? 'به‌روزرسانی رمز' : 'ثبت رمز عبور'}
                  </button>
                  {hasPassword && (
                    <button
                      type="button"
                      onClick={handleRemovePassword}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs transition"
                    >
                      حذف رمز
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* API Keys */}
          <div className="lg:col-span-12 p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-1.5">
              <Key className="w-4 h-4 text-emerald-600" />
              کلیدهای دسترسی مستقیم API
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(apiKeys).map(([keyName, keyVal]) => (
                <div key={keyName} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 uppercase">{keyName} API Key</span>
                    <button
                      type="button"
                      onClick={() => handleCopyKey(keyName, keyVal)}
                      className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:underline"
                    >
                      {copiedKey === keyName ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>کپی شد</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>کپی کلید</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-slate-200 font-mono text-[11px] text-slate-600 truncate" dir="ltr">
                    {keyVal}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Danger Zone */}
          <div className="lg:col-span-12 p-5 rounded-2xl bg-white border border-rose-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-rose-700 flex items-center gap-1.5">
              <Trash2 className="w-4 h-4" />
              حذف دائمی پروژه
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
              با حذف این پروژه، تمامی پایگاه‌های داده، اسکیماها، فایل‌های ذخیره‌سازی، توابع و اطلاعات کاربران برای همیشه پاکسازی خواهند شد.
            </p>
            <button
              type="button"
              onClick={onDeleteProject}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs transition shadow-xs"
            >
              حذف دائمی این پروژه
            </button>
          </div>
        </div>
      )}

      {/* Accessible Confirm Modal for Removing Password */}
      <ConfirmModal
        isOpen={showRemovePasswordModal}
        title="حذف رمز عبور پروژه"
        message="آیا از حذف رمز عبور اختصاصی پروژه اطمینان دارید؟ پس از حذف، ورود به کنسول نیاز به گذرواژه نخواهد داشت."
        confirmLabel="حذف رمز عبور"
        isDanger={true}
        onConfirm={executeRemovePassword}
        onCancel={() => setShowRemovePasswordModal(false)}
      />

      {/* Accessible Alert Modal */}
      <AlertModal
        isOpen={alertState.isOpen}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
        onClose={() => setAlertState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
