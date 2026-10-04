"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Copy,
  Plus,
  RefreshCw,
  Trash2,
  Webhook,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
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
import { useI18n } from "@/lib/i18n/client";
import { apiDelete, apiGet, apiPost, apiPut } from "@/app/console";

export interface CronRow {
  task: string;
  isEnabled: boolean;
  lastRunAt: string | null;
}

export interface WebhookRow {
  id: number;
  url: string;
  events: string[];
  isActive: boolean;
}

export const WEBHOOK_EVENTS = [
  "project.created",
  "project.updated",
  "project.deleted",
  "user.signup",
  "user.login",
  "storage.uploaded",
  "storage.cap_exceeded",
  "cron.started",
  "cron.completed",
  "cron.failed",
  "daily.summary",
  "document.created",
  "document.updated",
  "document.deleted",
  "*",
];

export interface DeliveryRow {
  id: number;
  webhookId: number;
  url: string;
  event: string;
  responseStatus: number | null;
  error: string | null;
  deliveredAt: string;
}

export const NAMED_ENDPOINTS = [
  { id: "db.find", label: "db.find" },
  { id: "db.get", label: "db.get" },
  { id: "db.count", label: "db.count" },
  { id: "db.insert", label: "db.insert" },
  { id: "db.update", label: "db.update" },
  { id: "db.delete", label: "db.delete" },
];

export interface EndpointPolicy {
  isEnabled: boolean;
  requiresAuth: boolean;
}

export function EndpointToggles({ projectId }: { projectId: number }) {
  const { t } = useI18n();
  const [state, setState] = useState<Record<string, EndpointPolicy>>({});

  useEffect(() => {
    let cancelled = false;
    void apiGet<{ data: Array<{ endpoint: string; isEnabled: boolean; requiresAuth: boolean }> }>(
      `/api/endpoints?projectId=${projectId}`,
    )
      .then(({ data }) => {
        if (cancelled) return;
        setState(
          Object.fromEntries(
            data.map((row) => [
              row.endpoint,
              { isEnabled: row.isEnabled, requiresAuth: row.requiresAuth },
            ]),
          ),
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function update(endpoint: string, patch: Partial<EndpointPolicy>) {
    const current = state[endpoint] ?? { isEnabled: true, requiresAuth: true };
    const next = { ...current, ...patch };
    setState((prev) => ({ ...prev, [endpoint]: next }));
    try {
      await apiPut(`/api/endpoints?projectId=${projectId}`, {
        endpoint,
        isEnabled: next.isEnabled,
        requiresAuth: next.requiresAuth,
      });
    } catch (error) {
      setState((prev) => ({ ...prev, [endpoint]: current }));
      toast.error(error instanceof Error ? error.message : t("automate.endpoints.updateFailed"));
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-10px uppercase tracking-[0.14em] text-muted-foreground">
        <span>{t("label.endpoint")}</span>
        <span className="flex gap-6">
          <span>{t("label.enabled")}</span>
          <span className="w-14 text-end">{t("automate.endpoints.public")}</span>
        </span>
      </div>
      {NAMED_ENDPOINTS.map(({ id, label }) => {
        const policy = state[id] ?? { isEnabled: true, requiresAuth: true };
        return (
          <div key={id} className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2">
            <span className="ltr-content font-mono text-12.5px">{label}</span>
            <span className="flex items-center gap-6">
              <Switch
                checked={policy.isEnabled}
                onCheckedChange={(checked) => void update(id, { isEnabled: checked })}
              />
              <Switch
                checked={!policy.requiresAuth}
                disabled={!policy.isEnabled}
                onCheckedChange={(checked) => void update(id, { requiresAuth: !checked })}
              />
            </span>
          </div>
        );
      })}
      <p className="text-11px text-muted-foreground">{t("automate.endpoints.hint")}</p>
    </div>
  );
}

export function AutomateTab({ projectId }: { projectId: number }) {
  const { t, fmt } = useI18n();
  const [cron, setCron] = useState<CronRow[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [hookUrl, setHookUrl] = useState("");
  const [hookEvents, setHookEvents] = useState<string[]>(["*"]);
  const [freshSecret, setFreshSecret] = useState<string | null>(null);

  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);

  const load = useCallback(async () => {
    const [cronRes, hookRes, deliveryRes] = await Promise.allSettled([
      apiGet<{ data: CronRow[]; available: string[] }>(`/api/cron?projectId=${projectId}`),
      apiGet<{ data: WebhookRow[] }>(`/api/webhooks?projectId=${projectId}`),
      apiGet<{ data: DeliveryRow[] }>(`/api/webhooks/deliveries?projectId=${projectId}`),
    ]);
    if (cronRes.status === "fulfilled") setCron(cronRes.value.data);
    if (hookRes.status === "fulfilled") setWebhooks(hookRes.value.data);
    if (deliveryRes.status === "fulfilled") setDeliveries(deliveryRes.value.data);
  }, [projectId]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function toggleTask(task: string, isEnabled: boolean) {
    try {
      await apiPut(`/api/cron?projectId=${projectId}`, { task, isEnabled });
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("automate.cron.toggleFailed"));
    }
  }

  async function runTask(task: string) {
    try {
      await apiPost(`/api/cron/run?projectId=${projectId}`, { task });
      toast.success(t("automate.cron.done", { task }));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("automate.cron.failed"));
    }
  }

  async function createWebhook(event: React.FormEvent) {
    event.preventDefault();
    try {
      const result = await apiPost<{ secret: string }>(`/api/webhooks?projectId=${projectId}`, {
        url: hookUrl,
        events: hookEvents,
      });
      setFreshSecret(result.secret);
      setHookUrl("");
      toast.success(t("automate.hooks.created"));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("automate.hooks.createFailed"));
    }
  }

  async function deleteWebhook(id: number) {
    try {
      await apiDelete(`/api/webhooks?id=${id}&projectId=${projectId}`);
      toast.success(t("automate.hooks.deleted"));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("automate.hooks.deleteFailed"));
    }
  }

  function toggleEvent(name: string) {
    setHookEvents((prev) =>
      prev.includes(name) ? prev.filter((e) => e !== name) : [...prev, name],
    );
  }

  async function sendTest(id: number) {
    try {
      const result = await apiPost<{ delivered: { delivered: number; skipped: number } }>(
        `/api/webhooks/test?projectId=${projectId}&id=${id}`,
        {},
      );
      toast.success(
        result.delivered.delivered > 0
          ? t("automate.hooks.testDelivered")
          : t("automate.hooks.testNothing"),
      );
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("automate.hooks.testFailed"));
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-signal" /> {t("automate.cron.title")}
          </CardTitle>
          <CardDescription className="text-12.5px">
            {t("automate.cron.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("automate.cron.table.task")}</TableHead>
                <TableHead className="w-28">{t("automate.cron.table.lastRun")}</TableHead>
                <TableHead className="w-24">{t("label.enabled")}</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {cron.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-13px text-muted-foreground">
                    {t("state.loading")}
                  </TableCell>
                </TableRow>
              )}
              {cron.map((row) => (
                <TableRow key={row.task}>
                  <TableCell className="ltr-content font-mono text-12.5px">{row.task}</TableCell>
                  <TableCell className="text-12px text-muted-foreground">
                    {row.lastRunAt ? fmt.dateTime(new Date(row.lastRunAt).getTime()) : t("state.never")}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={row.isEnabled}
                      onCheckedChange={(checked) => void toggleTask(row.task, checked)}
                    />
                  </TableCell>
                  <TableCell className="text-end">
                    <Button variant="outline" size="sm" className="h-7" onClick={() => void runTask(row.task)}>
                      {t("automate.cron.runNow")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Webhook className="h-4 w-4 text-signal" /> {t("automate.hooks.title")}
          </CardTitle>
          <CardDescription className="text-12.5px">
            {t("automate.hooks.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {freshSecret && (
            <div className="rounded-lg border border-signal/40 bg-signal/5 p-3">
              <p className="text-12px text-muted-foreground">{t("automate.hooks.once")}</p>
              <code className="mt-1 block break-all font-mono text-12.5px">{freshSecret}</code>
            </div>
          )}
          <form onSubmit={createWebhook} className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label htmlFor="hook-url">{t("automate.hooks.urlLabel")}</Label>
                <Input
                  id="hook-url"
                  type="url"
                  value={hookUrl}
                  onChange={(e) => setHookUrl(e.target.value)}
                  placeholder="https://example.com/hooks/localme"
                  dir="ltr"
                  className="ltr-input"
                  required
                />
              </div>
              <Button type="submit" size="sm" variant="outline">
                <Plus className="h-3.5 w-3.5" /> {t("automate.hooks.add")}
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {WEBHOOK_EVENTS.map((name) => (
                <button key={name} type="button" onClick={() => toggleEvent(name)}>
                  <Badge
                    variant={hookEvents.includes(name) ? "default" : "outline"}
                    className="font-mono cursor-pointer"
                  >
                    {name}
                  </Badge>
                </button>
              ))}
            </div>
          </form>
          {webhooks.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[22rem]">{t("automate.hooks.urlLabel")}</TableHead>
                  <TableHead>{t("automate.hooks.table.events")}</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.map((hook) => (
                  <TableRow key={hook.id}>
                    <TableCell className="align-top">
                      <span className="ltr-content block break-all font-mono text-12px leading-relaxed">{hook.url}</span>
                      {!hook.isActive && (
                        <Badge variant="outline" className="mt-1">
                          {t("routes.disabled")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-wrap gap-1">
                        {hook.events.map((name) => (
                          <Badge key={name} variant="signal" className="font-mono text-10px">
                            {name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-end align-top">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title={t("automate.hooks.copyTitle")}
                          onClick={() => {
                            void navigator.clipboard.writeText(hook.url).then(
                              () => toast.success(t("automate.hooks.copied")),
                              () => toast.error(t("automate.hooks.clipboardFailed")),
                            );
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="outline" size="sm" className="h-7" onClick={() => void sendTest(hook.id)}>
                          {t("automate.hooks.test")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-muted-foreground hover:text-destructive"
                          title={t("action.delete")}
                          onClick={() => void deleteWebhook(hook.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {deliveries.length > 0 && (
            <div className="border-t border-border pt-4">
              <Label className="mb-2 block text-12.5px">{t("automate.hooks.deliveries")}</Label>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("automate.hooks.table.event")}</TableHead>
                    <TableHead className="w-64">{t("automate.hooks.table.endpoint")}</TableHead>
                    <TableHead className="w-20 text-end">{t("label.status")}</TableHead>
                    <TableHead className="w-40">{t("automate.hooks.table.when")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.slice(0, 10).map((delivery) => (
                    <TableRow key={delivery.id}>
                      <TableCell className="ltr-content font-mono text-12px">{delivery.event}</TableCell>
                      <TableCell className="align-top">
                        <span className="ltr-content block break-all font-mono text-11.5px leading-relaxed text-muted-foreground">
                          {delivery.url}
                        </span>
                        {delivery.error && (
                          <span className="mt-0.5 block text-11.5px text-destructive">{delivery.error}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-end">
                        <Badge
                          variant={
                            delivery.responseStatus && delivery.responseStatus < 300 ? "default" : "outline"
                          }
                          className="font-mono text-10px"
                        >
                          {delivery.responseStatus ?? t("automate.hooks.error")}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-top text-11.5px text-muted-foreground">
                        {delivery.deliveredAt ? fmt.dateTime(new Date(delivery.deliveredAt).getTime()) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="border-t border-border pt-4">
            <Label className="mb-2 block text-12.5px">{t("automate.endpoints.title")}</Label>
            <p className="mb-3 text-12px text-muted-foreground">
              {t("automate.endpoints.description")}
            </p>
            <EndpointToggles projectId={projectId} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
