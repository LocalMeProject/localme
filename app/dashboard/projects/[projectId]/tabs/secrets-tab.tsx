"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { EyeOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RowCheckbox, SelectAllCheckbox, SelectionToolbar } from "@/components/selection-toolbar";
import { TransferControls } from "@/components/transfer-controls";
import { SectionHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/client";
import { apiDelete, apiGet, apiPost, apiPut } from "@/app/console";

export interface SecretRow {
  key: string;
  updatedAt: string;
}

export function SecretsTab({ projectId }: { projectId: number }) {
  const { t, fmt } = useI18n();
  const [secrets, setSecrets] = useState<SecretRow[]>([]);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    try {
      const { data } = await apiGet<{ data: SecretRow[] }>(`/api/secrets?projectId=${projectId}`);
      setSecrets(data);
      // Drop selections for keys that no longer exist so the toolbar can never
      // point at a row that is gone (e.g. after a delete or an import replace).
      setSelected((prev) => prev.filter((key) => data.some((row) => row.key === key)));
      setRevealed((prev) => {
        const alive = Object.keys(prev).filter((key) => data.some((row) => row.key === key));
        if (alive.length === Object.keys(prev).length) return prev;
        const next: Record<string, string> = {};
        for (const key of alive) next[key] = prev[key];
        return next;
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("secrets.loadFailed"));
    }
  }, [projectId, t]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function saveSecret(event: React.FormEvent) {
    event.preventDefault();
    try {
      await apiPut(`/api/secrets?projectId=${projectId}`, { key: newKey, value: newValue });
      setNewKey("");
      setNewValue("");
      toast.success(t("secrets.sealed"));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("secrets.saveFailed"));
    }
  }

  async function reveal(key: string) {
    if (revealed[key]) {
      setRevealed(({ [key]: _drop, ...rest }) => rest);
      return;
    }
    try {
      const result = await apiPost<{ value: string }>(`/api/secrets/get?projectId=${projectId}`, { key });
      setRevealed((prev) => ({ ...prev, [key]: result.value }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("secrets.revealFailed"));
    }
  }

  async function remove(key: string) {
    if (!window.confirm(t("secrets.deleteConfirm", { key }))) return;
    try {
      await apiDelete(`/api/secrets?key=${encodeURIComponent(key)}&projectId=${projectId}`);
      toast.success(t("secrets.deleted"));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("secrets.deleteFailed"));
    }
  }

  async function deleteSelected(keys: string[]) {
    if (keys.length === 0) return;
    if (!window.confirm(t("secrets.deleteConfirmCount", { count: fmt.number(keys.length) }))) return;
    for (const key of keys) {
      await apiDelete(`/api/secrets?key=${encodeURIComponent(key)}&projectId=${projectId}`).catch(() => undefined);
    }
    toast.success(t("secrets.removedCount", { count: fmt.number(keys.length) }));
    setSelected([]);
  }

  async function hideAll() {
    setRevealed({});
  }

  // The list is short in practice but unbounded in principle; filtering keeps
  // the select-all affordance honest by acting on what is actually shown.
  const visible = query.trim()
    ? secrets.filter((row) => row.key.toLowerCase().includes(query.trim().toLowerCase()))
    : secrets;
  const visibleKeys = visible.map((row) => row.key);
  const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every((key) => selected.includes(key));

  return (
    <div className="space-y-4">
      <SectionHeader
        title={t("secrets.title")}
        description={t("secrets.description")}
        actions={
          <TransferControls
            projectId={projectId}
            feature="secrets"
            featureLabel="secrets"
            selected={selected}
            allIds={secrets.map((secret) => secret.key)}
            onChanged={load}
            supportsCopyFrom
            showDelete
            onDelete={deleteSelected}
          />
        }
      />
      {secrets.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("secrets.filter.placeholder")}
                className="h-8 w-56 text-12.5px"
                aria-label={t("secrets.filter.ariaLabel")}
              />
              <span className="nums text-12px text-muted-foreground">
                {t("secrets.shownOf", { shown: fmt.number(visible.length), total: fmt.number(secrets.length) })}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="ms-auto h-8"
                onClick={() => void hideAll()}
                disabled={Object.keys(revealed).length === 0}
              >
                <EyeOff className="h-3.5 w-3.5" /> {t("secrets.hideAll")}
              </Button>
            </div>
            <SelectionToolbar selected={selected} noun="selection.secret" onClear={() => setSelected([])} />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <SelectAllCheckbox
                      selected={selected}
                      total={visibleKeys.length}
                      label={t("secrets.selectAll")}
                      allSelected={allVisibleSelected}
                      hiddenSelected={selected.length - visibleKeys.filter((k) => selected.includes(k)).length}
                      onToggle={(all) =>
                        setSelected((prev) =>
                          all ? [...new Set([...prev, ...visibleKeys])] : prev.filter((k) => !visibleKeys.includes(k)),
                        )
                      }
                    />
                  </TableHead>
                  <TableHead>{t("label.key")}</TableHead>
                  <TableHead>{t("secrets.table.value")}</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((secret) => (
                  <TableRow
                    key={secret.key}
                    className={cn(selected.includes(secret.key) && "bg-muted/40")}
                  >
                    <TableCell>
                      <RowCheckbox
                        id={secret.key}
                        selected={selected}
                        onToggle={(id, next) =>
                          setSelected((prev) => (next ? [...prev, id] : prev.filter((x) => x !== id)))
                        }
                      />
                    </TableCell>
                    <TableCell className="ltr-content font-mono text-12.5px">{secret.key}</TableCell>
                    <TableCell className="max-w-0 truncate font-mono text-12px">
                      {revealed[secret.key] ? (
                        revealed[secret.key]
                      ) : (
                        <button
                          type="button"
                          className="text-signal hover:underline"
                          onClick={() => void reveal(secret.key)}
                        >
                          {t("secrets.reveal")}
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="text-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-muted-foreground hover:text-destructive"
                        title={t("action.delete")}
                        onClick={() => void remove(secret.key)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {visible.length === 0 && (
              <p className="px-3 py-6 text-center text-13px text-muted-foreground">
                {t("secrets.empty.filtered", { query })}
              </p>
            )}
          </CardContent>
        </Card>
      )}
      {secrets.length === 0 && (
        <p className="text-13px text-muted-foreground">{t("secrets.empty.body")}</p>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("secrets.form.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveSecret} className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="secret-key">{t("label.key")}</Label>
              <Input
                id="secret-key"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value.toUpperCase())}
                className="ltr-input w-44 font-mono text-12.5px"
                dir="ltr"
                pattern="[a-zA-Z_][a-zA-Z0-9_]{0,63}"
                placeholder="STRIPE_KEY"
                required
              />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="secret-value">{t("secrets.form.valueLabel")}</Label>
              <Input
                id="secret-value"
                type="password"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                required
              />
            </div>
            <Button type="submit" size="sm" variant="outline">
              {t("secrets.form.submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
