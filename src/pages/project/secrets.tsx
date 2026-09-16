import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { BookLock, Check, Copy, Eye, EyeOff, Loader2, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useProject } from "@/components/project-layout";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { errorText } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";

type SecretRow = {
  id: Id<"secrets">;
  keyName: string;
  preview: string;
  createdAt: number;
  updatedAt: number;
};

export function ProjectSecrets() {
  const { project, token } = useProject();
  const projectId = project.id as Id<"projects">;

  const secrets = useQuery(api.secrets.list, { token, projectId }) as SecretRow[] | undefined;
  const setSecret = useMutation(api.secrets.set);
  const removeSecret = useMutation(api.secrets.remove);
  const revealSecret = useMutation(api.secrets.reveal);

  const [open, setOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SecretRow | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(timer);
  }, [notice]);

  const guard = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="panel flex flex-wrap items-start gap-4 p-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-signal/40 bg-signal/10">
          <BookLock className="h-4 w-4 text-signal" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">Encrypted at rest with AES-256-GCM</div>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            Secret values never reach your visitors. Reference them from a proxy route as{" "}
            <span className="font-mono text-foreground">{"{{KEY_NAME}}"}</span> inside a header value, and the platform
            substitutes the real value server-side.
          </p>
        </div>
      </div>

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
            <div className="text-sm font-medium">Project secrets</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Keys must be SCREAMING_SNAKE_CASE, 2–64 characters. Values are write-only except for an owner reveal.
            </div>
          </div>
          <Button
            variant="signal"
            size="sm"
            onClick={() => {
              setKeyName("");
              setValue("");
              setOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add secret
          </Button>
        </div>

        {secrets === undefined ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-8 w-full" />
            ))}
          </div>
        ) : secrets.length === 0 ? (
          <EmptyState
            className="m-5"
            icon={BookLock}
            title="No secrets stored"
            description="Add an API key or token here, then reference it from a proxy route header."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Value</TableHead>
                <TableHead className="w-40">Updated</TableHead>
                <TableHead className="w-40" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {secrets.map((secret) => (
                <TableRow key={secret.id}>
                  <TableCell className="font-mono text-xs">{secret.keyName}</TableCell>
                  <TableCell>
                    <code className="rounded border border-border bg-card px-2 py-1 font-mono text-[11px] text-muted-foreground">
                      {revealed[secret.keyName] ?? secret.preview}
                    </code>
                  </TableCell>
                  <TableCell className="text-[11px] text-muted-foreground">
                    {formatDateTime(secret.updatedAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        title="Reveal value"
                        onClick={() =>
                          guard(async () => {
                            if (revealed[secret.keyName]) {
                              setRevealed((current) => {
                                const next = { ...current };
                                delete next[secret.keyName];
                                return next;
                              });
                              return;
                            }
                            const result = await revealSecret({ token, projectId, keyName: secret.keyName });
                            if (result?.value !== undefined) {
                              setRevealed((current) => ({ ...current, [secret.keyName]: String(result.value) }));
                            }
                          })
                        }
                      >
                        {revealed[secret.keyName] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        {revealed[secret.keyName] ? "Hide" : "Reveal"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Copy value"
                        disabled={!revealed[secret.keyName]}
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(revealed[secret.keyName]);
                            setCopied(secret.keyName);
                            setTimeout(() => setCopied(null), 1400);
                          } catch {
                            /* clipboard unavailable */
                          }
                        }}
                      >
                        {copied === secret.keyName ? (
                          <Check className="h-3.5 w-3.5 text-signal" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Delete secret"
                        onClick={() => setDeleteTarget(secret)}
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

      <div className="panel overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <ShieldAlert className="h-3.5 w-3.5 text-blueprint" />
          <span className="mono-label">use it from a proxy route</span>
        </div>
        <div className="grid gap-4 p-5 lg:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">
              Create a proxy route in <span className="font-mono text-foreground">Routing</span> that targets your
              provider, then reference the secret in a header. The browser only ever sees your own path.
            </p>
            <Textarea
              readOnly
              rows={7}
              className="mt-3 font-mono text-[11.5px]"
              value={`// Proxy route: /api/payments/create
// Target: https://api.stripe.com/v1/payment_intents
// Headers: { "Authorization": "Bearer {{STRIPE_KEY}}" }

const res = await fetch('/api/payments/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ amount: 1000, currency: 'usd' })
});`}
            />
          </div>
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex items-start gap-2">
              <Badge variant="signal">1</Badge>
              Store the provider key here.
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="signal">2</Badge>
              Reference it in the proxy header map.
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="signal">3</Badge>
              Calls to{" "}
              <span className="font-mono">
                /{project.ownerUsername}/{project.name}/api/…
              </span>{" "}
              are forwarded with the substituted header.
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="signal">4</Badge>
              Rotate the key when it leaks — updating the secret is enough, no redeploy needed.
            </div>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add a secret</DialogTitle>
            <DialogDescription>
              Stored encrypted with the platform master key. Existing keys are overwritten.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="secret-key">Key name</Label>
              <Input
                id="secret-key"
                value={keyName}
                onChange={(event) => setKeyName(event.target.value.toUpperCase())}
                placeholder="STRIPE_KEY"
                className="font-mono"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="secret-value">Value</Label>
              <Input
                id="secret-value"
                type="password"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="sk_live_…"
                className="font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="signal"
              disabled={busy || !keyName.trim() || !value}
              onClick={() =>
                guard(async () => {
                  await setSecret({ token, projectId, keyName: keyName.trim(), value });
                  setNotice(`${keyName.trim()} stored`);
                  setOpen(false);
                })
              }
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save secret
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.keyName ?? "secret"}?`}
        description="Proxy routes referencing this key will start failing until you store it again."
        confirmLabel="Delete secret"
        pending={busy}
        onConfirm={() =>
          guard(async () => {
            if (!deleteTarget) return;
            await removeSecret({ token, projectId, keyName: deleteTarget.keyName });
            setNotice(`${deleteTarget.keyName} deleted`);
          })
        }
      />
    </div>
  );
}
