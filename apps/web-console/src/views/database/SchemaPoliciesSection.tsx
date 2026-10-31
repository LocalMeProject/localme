import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Plus, Trash2 } from 'lucide-react';
import { ConfirmModal } from '../../components/modals/ConfirmModal';

export interface TablePolicy {
  name: string;
  tableName: string;
  command: string;
  roles: string;
  usingExpression: string;
  checkExpression?: string;
}

export interface SchemaPoliciesSectionProps {
  projectSlug: string;
  activeTable: string;
}

export const SchemaPoliciesSection: React.FC<SchemaPoliciesSectionProps> = ({
  projectSlug,
  activeTable,
}) => {
  const [policies, setPolicies] = useState<TablePolicy[]>([]);
  const [isLoadingPolicies, setIsLoadingPolicies] = useState(false);
  const [isAddingPolicy, setIsAddingPolicy] = useState(false);
  const [policyToDelete, setPolicyToDelete] = useState<string | null>(null);

  const [newPolicyName, setNewPolicyName] = useState('');
  const [newPolicyCmd, setNewPolicyCmd] = useState('ALL');
  const [newPolicyRole, setNewPolicyRole] = useState('authenticated');
  const [newPolicyUsing, setNewPolicyUsing] = useState('true');

  const fetchPolicies = useCallback(async () => {
    if (!activeTable) return;
    setIsLoadingPolicies(true);
    try {
      const res = await fetch(`/_baas/v1/${projectSlug}/db/tables/${activeTable}/policies`);
      if (res.ok) {
        const data = await res.json();
        setPolicies(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch policies:', err);
    } finally {
      setIsLoadingPolicies(false);
    }
  }, [activeTable, projectSlug]);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPolicyName.trim() || !activeTable) return;
    try {
      const res = await fetch(`/_baas/v1/${projectSlug}/db/tables/${activeTable}/policies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPolicyName.trim(),
          command: newPolicyCmd,
          roles: newPolicyRole,
          usingExpression: newPolicyUsing,
        }),
      });
      if (res.ok) {
        setIsAddingPolicy(false);
        setNewPolicyName('');
        setNewPolicyUsing('true');
        fetchPolicies();
      }
    } catch (err) {
      console.error('Failed to create policy:', err);
    }
  };

  const handleDeletePolicy = async (policyName: string) => {
    try {
      const res = await fetch(`/_baas/v1/${projectSlug}/db/tables/${activeTable}/policies/${encodeURIComponent(policyName)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchPolicies();
      }
    } catch (err) {
      console.error('Failed to delete policy:', err);
    } finally {
      setPolicyToDelete(null);
    }
  };

  return (
    <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-600" />
          <h4 className="text-xs font-bold text-slate-900">امنیت در سطح سطر (Row-Level Security - RLS)</h4>
        </div>
        <button
          onClick={() => setIsAddingPolicy(!isAddingPolicy)}
          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium transition"
        >
          <Plus className="w-3 h-3" />
          <span>قاعده امنیتی جدید</span>
        </button>
      </div>

      {isAddingPolicy && (
        <form
          onSubmit={handleCreatePolicy}
          className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs"
        >
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-slate-600 text-[11px] mb-1">نام قاعده (Policy Name)</label>
              <input
                type="text"
                required
                value={newPolicyName}
                onChange={(e) => setNewPolicyName(e.target.value)}
                placeholder="user_access_rule"
                dir="ltr"
                className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-600 text-[11px] mb-1">دستور مجاز</label>
              <select
                value={newPolicyCmd}
                onChange={(e) => setNewPolicyCmd(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 font-mono"
              >
                <option value="ALL">ALL (تمامی دستورات)</option>
                <option value="SELECT">SELECT</option>
                <option value="INSERT">INSERT</option>
                <option value="UPDATE">UPDATE</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-600 text-[11px] mb-1">نقش کاربری (Role)</label>
              <select
                value={newPolicyRole}
                onChange={(e) => setNewPolicyRole(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 font-mono"
              >
                <option value="authenticated">authenticated</option>
                <option value="anon">anon</option>
                <option value="public">public</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-600 text-[11px] mb-1">شرط دسترسی (USING)</label>
              <input
                type="text"
                required
                value={newPolicyUsing}
                onChange={(e) => setNewPolicyUsing(e.target.value)}
                placeholder="auth.uid() = user_id"
                dir="ltr"
                className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAddingPolicy(false)}
              className="px-3 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-3.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
            >
              ثبت قاعده RLS
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {isLoadingPolicies ? (
          <div className="text-center py-4 text-xs text-slate-400">در حال دریافت قوانین امنیتی...</div>
        ) : policies.length === 0 ? (
          <div className="text-center py-4 text-xs text-slate-400">
            هیچ قاعده RLS فعالی برای جدول {activeTable} ثبت نشده است. (دسترسی پیش‌فرض فعال است)
          </div>
        ) : (
          policies.map((p) => (
            <div
              key={p.name}
              className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between font-mono text-xs"
              dir="ltr"
            >
              <div className="flex items-center gap-3">
                <span className="font-bold text-slate-900">{p.name}</span>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px]">
                  {p.command}
                </span>
                <span className="text-slate-500 text-[11px]">TO {p.roles}</span>
                <span className="text-slate-600 text-[11px]">USING ({p.usingExpression})</span>
              </div>
              <button
                type="button"
                onClick={() => setPolicyToDelete(p.name)}
                className="p-1 text-slate-400 hover:text-rose-600 rounded-md transition"
                title="حذف قاعده RLS"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      <ConfirmModal
        isOpen={Boolean(policyToDelete)}
        title="حذف قاعده امنیتی RLS"
        message={`آیا از حذف قاعده "${policyToDelete}" اطمینان دارید؟`}
        confirmLabel="حذف قاعده"
        isDanger={true}
        onConfirm={() => {
          if (policyToDelete) {
            handleDeletePolicy(policyToDelete);
          }
        }}
        onCancel={() => setPolicyToDelete(null)}
      />
    </div>
  );
};
