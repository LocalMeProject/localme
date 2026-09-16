import { useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { Loader2, Pencil, Plus, Send, Trash2, Webhook } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useProject } from "@/components/project-layout";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { errorText } from "@/lib/errors";
import { formatDateTime, fromNow } from "@/lib/format";

type WebhookRow = {
  id: Id<"webhooks">;
  url: string;
  events: string[];
  hasSecret: boolean;
  isActive: boolean;
  description: string;
  createdAt: number;
};

type Delivery = {
  id: string;
  event: string;
  responseStatus: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  deliveredAt: number;
};

const empty = { url: "", secret: "", description: "", events: [] as string[] };

export function ProjectWebhooks() {
  const { project, token } = useProject();
  const projectId = project.id as Id<"projects">;

  const data = useQuery(api.automation.listWebhooks, { token, projectId });
  const createWebhook = useMutation(api.automation.createWebhook);
  const updateWebhook = useMutation(api.automation.updateWebhook);
  const deleteWebhook = useMutation(api.automation.deleteWebhook);
  const testWebhook = useAction(api.automation.testWebhook);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"webhooks"> | null>(null);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WebhookRow | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  const webhooks: WebhookRow[] = data?.webhooks ?? [];
  const deliveries: Delivery[] = data?.deliveries ?? [];
  const availableEvents: string[] = data?.availableEvents ?? [];

  const guard = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(null);
    }
  };

  const toggleEvent = (name: string) =>
    setForm((current) => ({
      ...current,
      events: current.events.includes(name)
        ? current.events.filter((event) => event !== name)
        : [...current.events, name],
    }));

  return (
    <div className="space-y-5">
      {error && <Alert variant="destructive">{error}</Alert>}
      {notice && (
        <div className="flex items-center gap-2 text-[11px] text-signal">
          <span className="h-1.5 w-1.5 rounded-full bg-signal" />
          {notice}
        </div>
      )}

      <div className="panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div>
            <div className="text-sm font-medium">Webhooks</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Up to 20 endpoints receive JSON POSTs. Sign payloads with a secret and verify the{" "}
              <span className="font-mono text-foreground">x-webhook-signature</span> header.
            </div>
          </div>
          <Button
            variant="signal"
            size="sm"
            onClick={() => {
              setEditingId(null);
              setForm({ ...empty, events: ["project.updated"] });
              setOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add webhook
          </Button>
        </div>

        {data === undefined ? (
          <div className="space-y-2 p-5">
            {[0, 1].map((index) => (
              <Skeleton key={index} className="h-9 w-full" />
            ))}
          </div>
        ) : webhooks.length === 0 ? (
          <EmptyState
            className="m-5"
            icon={Webhook}
            title="No webhooks registered"
            description="Add an endpoint to forward project events to Slack, your own API or an automation platform."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Endpoint</TableHead>
                <TableHead>Events</TableHead>
                <TableHead className="w-24 text-center">Signed</TableHead>
                <TableHead className="w-20 text-center">Live</TableHead>
                <TableHead className="w-40" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {webhooks.map((webhook) => (
                <TableRow key={webhook.id}>
                  <TableCell>
                    <div className="max-w-[20rem] truncate font-mono text-[11px]">{webhook.url}</div>
                    {webhook.description && (
                      <div className="mt-0.5 text-[10px] text-muted-foreground">{webhook.description}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {webhook.events.map((event) => (
                        <Badge key={event} variant="blueprint">
                          {event}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-[11px] text-muted-foreground">
                    {webhook.hasSecret ? "HMAC" : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={webhook.isActive}
                      disabled={busy === webhook.id}
                      onCheckedChange={(checked) =>
                        guard(webhook.id, async () => {
                          await updateWebhook({ token, projectId, webhookId: webhook.id, isActive: checked });
                        })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy === webhook.id}
                        onClick={() =>
                          guard(webhook.id, async () => {
                            const result = await testWebhook({ token, projectId, webhookId: webhook.id });
                            setNotice(`Test delivery sent to ${result?.url ?? webhook.url}`);
                          })
                        }
                      >
                        {busy === webhook.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                        Test
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Edit webhook"
                        onClick={() => {
                          setEditingId(webhook.id);
                          setForm({
                            url: webhook.url,
                            secret: "",
                            description: webhook.description,
                            events: webhook.events,
                          });
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Delete webhook"
                        onClick={() => setDeleteTarget(webhook)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="panel">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <div className="text-sm font-medium">Recent deliveries</div>
            <div className="mt-0.5 text-xs text-muted-foreground">The 40 most recent delivery attempts.</div>
          </div>
        </div>
        {data === undefined ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-8 w-full" />
            ))}
          </div>
        ) : deliveries.length === 0 ? (
          <div className="px-5 py-8 text-center text-xs text-muted-foreground">
            Nothing delivered yet. Use <span className="font-mono text-foreground">Test</span> to send a sample payload.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead>Response</TableHead>
                <TableHead className="w-36 text-right">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveries.map((delivery) => (
                <TableRow key={delivery.id}>
                  <TableCell className="font-mono text-[11px]">{delivery.event}</TableCell>
                  <TableCell>
                    {delivery.errorMessage ? (
                      <Badge variant="destructive">failed</Badge>
                    ) : (
                      <Badge variant={delivery.responseStatus && delivery.responseStatus < 300 ? "success" : "warning"}>
                        {delivery.responseStatus ?? "—"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[26rem] truncate font-mono text-[11px] text-muted-foreground">
                    {delivery.errorMessage ?? delivery.responseBody ?? "—"}
                  </TableCell>
                  <TableCell className="text-right text-[11px] text-muted-foreground">
                    {fromNow(delivery.deliveredAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit webhook" : "Add webhook"}</DialogTitle>
            <DialogDescription>
              Deliveries are POSTed with a 30 second timeout and retried by your provider if you respond with an error.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="webhook-url">Endpoint URL</Label>
              <Input
                id="webhook-url"
                value={form.url}
                onChange={(event) => setForm({ ...form, url: event.target.value })}
                placeholder="https://hooks.example.com/localme"
                className="font-mono text-xs"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="webhook-secret">Signing secret (optional)</Label>
              <Input
                id="webhook-secret"
                value={form.secret}
                onChange={(event) => setForm({ ...form, secret: event.target.value })}
                placeholder={editingId ? "leave empty to keep the current secret" : "shared secret"}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="webhook-description">Description (optional)</Label>
              <Input
                id="webhook-description"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="Posts to the ops channel"
              />
            </div>
            <div className="space-y-2">
              <Label>Events</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {availableEvents.map((event) => (
                  <label
                    key={event}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2"
                  >
                    <Checkbox checked={form.events.includes(event)} onCheckedChange={() => toggleEvent(event)} />
                    <span className="font-mono text-[11px]">{event}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="signal"
              disabled={busy !== null || !form.url.trim() || form.events.length === 0}
              onClick={() =>
                guard("form", async () => {
                  if (editingId) {
                    await updateWebhook({
                      token,
                      projectId,
                      webhookId: editingId,
                      url: form.url,
                      events: form.events,
                      description: form.description,
                      ...(form.secret ? { secret: form.secret } : {}),
                    });
                    setNotice("Webhook updated");
                  } else {
                    await createWebhook({
                      token,
                      projectId,
                      url: form.url,
                      events: form.events,
                      description: form.description || undefined,
                      secret: form.secret || undefined,
                    });
                    setNotice("Webhook registered");
                  }
                  setOpen(false);
                })
              }
            >
              {busy === "form" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {editingId ? "Save webhook" : "Add webhook"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this webhook?"
        description={
          <span>
            <span className="font-mono text-foreground">{deleteTarget?.url}</span> stops receiving events and its
            delivery history is deleted.
          </span>
        }
        confirmLabel="Delete webhook"
        pending={busy !== null}
        onConfirm={() =>
          guard("delete", async () => {
            if (!deleteTarget) return;
            await deleteWebhook({ token, projectId, webhookId: deleteTarget.id });
            setNotice("Webhook deleted");
          })
        }
      />

      <div className="panel p-5">
        <div className="text-sm font-medium">Payload shape</div>
        <Textarea
          readOnly
          rows={11}
          className="mt-3 font-mono text-[11.5px]"
          value={`POST ${webhookSampleUrl(webhooks)} 
content-type: application/json
x-localme-event: user.login
x-webhook-signature: sha256=<hmac of the raw body>

{
  "event": "user.login",
  "timestamp": "${new Date().toISOString()}",
  "project_id": "${project.id}",
  "data": { "username": "jane", "role": "Member" }
}`}
        />
        <p className="mt-2 text-[11px] text-muted-foreground">
          Last delivery recorded {deliveries[0] ? formatDateTime(deliveries[0].deliveredAt) : "—"}.
        </p>
      </div>
    </div>
  );
}

function webhookSampleUrl(webhooks: WebhookRow[]): string {
  return webhooks[0]?.url ?? "https://hooks.example.com/localme";
}
