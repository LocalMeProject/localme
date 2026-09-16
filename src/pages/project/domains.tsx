import { useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { Check, Copy, Globe2, Loader2, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
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
import { errorText } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { siteUrl } from "@/lib/convex";

/** Hostname visitors should point their DNS records at. */
const platformHost: string = (() => {
  try {
    return new URL(siteUrl).hostname;
  } catch {
    return siteUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }
})();

type DomainRow = {
  id: Id<"domains">;
  domain: string;
  verificationToken: string;
  txtRecordName: string;
  isVerified: boolean;
  sslStatus: string;
  sslExpiresAt: number | null;
  verifiedAt: number | null;
  verificationMessage: string | null;
  createdAt: number;
};

export function ProjectDomains() {
  const { project, token } = useProject();
  const projectId = project.id as Id<"projects">;

  const domains = useQuery(api.domains.list, { token, projectId }) as DomainRow[] | undefined;
  const addDomain = useMutation(api.domains.add);
  const removeDomain = useMutation(api.domains.remove);
  const verifyDomain = useAction(api.domains.verify);

  const [open, setOpen] = useState(false);
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DomainRow | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

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

  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1400);
    } catch {
      /* clipboard unavailable */
    }
  };

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
            <div className="text-sm font-medium">Custom domains</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Verify ownership with a DNS TXT record. Certificates are issued automatically once verification succeeds.
            </div>
          </div>
          <Button variant="signal" size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add domain
          </Button>
        </div>

        {domains === undefined ? (
          <div className="space-y-2 p-5">
            {[0, 1].map((index) => (
              <Skeleton key={index} className="h-9 w-full" />
            ))}
          </div>
        ) : domains.length === 0 ? (
          <EmptyState
            className="m-5"
            icon={Globe2}
            title="No custom domains"
            description={`Until you add one, this project is served from ${siteUrl}/${project.ownerUsername}/${project.name}/.`}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead className="w-32">Verification</TableHead>
                <TableHead className="w-32">Certificate</TableHead>
                <TableHead className="w-32">Verified</TableHead>
                <TableHead className="w-40" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {domains.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs">{row.domain}</TableCell>
                  <TableCell>
                    <Badge variant={row.isVerified ? "success" : "warning"}>
                      {row.isVerified ? "verified" : "pending"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        row.sslStatus === "active" ? "success" : row.sslStatus === "pending" ? "blueprint" : "outline"
                      }
                    >
                      {row.sslStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[11px] text-muted-foreground">
                    {row.verifiedAt ? formatDateTime(row.verifiedAt) : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy === row.id}
                        onClick={() =>
                          guard(row.id, async () => {
                            const result = await verifyDomain({ token, projectId, domainId: row.id });
                            setNotice(`${row.domain}: ${result?.message ?? "checked"}`);
                          })
                        }
                      >
                        {busy === row.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        Verify
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Remove domain"
                        onClick={() => setDeleteTarget(row)}
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

      {domains && domains.length > 0 && (
        <div className="space-y-4">
          {domains.map((row) => (
            <div key={row.id} className="panel p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Globe2 className="h-3.5 w-3.5 text-signal" />
                <span className="font-mono text-xs font-medium">{row.domain}</span>
                {row.isVerified ? (
                  <Badge variant="success">
                    <Check className="h-3 w-3" />
                    ownership verified
                  </Badge>
                ) : (
                  <Badge variant="warning">action required</Badge>
                )}
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <div className="text-xs font-medium">1. Add the verification record</div>
                  <div className="space-y-2 rounded-md border border-border bg-card p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="mono-label">type</span>
                      <code className="font-mono text-[11px]">TXT</code>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="mono-label">name</span>
                      <div className="flex items-center gap-1">
                        <code className="font-mono text-[11px]">{row.txtRecordName}</code>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Copy record name"
                          onClick={() => void copy(`${row.id}-name`, row.txtRecordName)}
                        >
                          {copied === `${row.id}-name` ? (
                            <Check className="h-3 w-3 text-signal" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="mono-label">value</span>
                      <div className="flex items-center gap-1">
                        <code className="max-w-[16rem] truncate font-mono text-[11px]">{row.verificationToken}</code>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Copy token"
                          onClick={() => void copy(`${row.id}-token`, row.verificationToken)}
                        >
                          {copied === `${row.id}-token` ? (
                            <Check className="h-3 w-3 text-signal" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="text-xs font-medium">2. Point the domain at the platform</div>
                  <div className="space-y-1 rounded-md border border-border bg-card p-3 font-mono text-[11px] text-muted-foreground">
                    <div>CNAME {row.domain} → {platformHost}</div>
                    <div>
                      Use an A/ALIAS record for apex domains if your provider cannot flatten CNAMEs.
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-xs font-medium">3. Verify and issue a certificate</div>
                  <p className="text-xs text-muted-foreground">
                    DNS changes can take up to 48 hours to propagate, though most providers resolve within minutes. Run
                    verification again any time.
                  </p>
                  {row.verificationMessage && (
                    <Alert variant={row.isVerified ? "info" : "warning"}>{row.verificationMessage}</Alert>
                  )}
                  <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2.5 text-xs">
                    <ShieldCheck className="h-3.5 w-3.5 text-blueprint" />
                    <span className="text-muted-foreground">
                      Certificate status: <span className="font-mono text-foreground">{row.sslStatus}</span>
                      {row.sslExpiresAt ? ` · renews ${formatDateTime(row.sslExpiresAt)}` : ""}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy === row.id}
                    onClick={() =>
                      guard(row.id, async () => {
                        const result = await verifyDomain({ token, projectId, domainId: row.id });
                        setNotice(`${row.domain}: ${result?.message ?? "checked"}`);
                      })
                    }
                  >
                    {busy === row.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    Check DNS now
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add a custom domain</DialogTitle>
            <DialogDescription>
              Enter the hostname only, without a scheme or path — for example{" "}
              <span className="font-mono text-foreground">app.example.com</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="domain">Domain</Label>
            <Input
              id="domain"
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
              placeholder="app.example.com"
              className="font-mono"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="signal"
              disabled={busy !== null || !domain.trim()}
              onClick={() =>
                guard("add", async () => {
                  const result = await addDomain({ token, projectId, domain: domain.trim() });
                  setDomain("");
                  setOpen(false);
                  setNotice(`${result?.domain ?? "Domain"} registered — add the TXT record next`);
                })
              }
            >
              {busy === "add" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Add domain
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Remove ${deleteTarget?.domain ?? "domain"}?`}
        description="The domain stops serving this project. DNS records at your provider are unaffected."
        confirmLabel="Remove domain"
        pending={busy !== null}
        onConfirm={() =>
          guard("delete", async () => {
            if (!deleteTarget) return;
            await removeDomain({ token, projectId, domainId: deleteTarget.id });
            setNotice(`${deleteTarget.domain} removed`);
          })
        }
      />
    </div>
  );
}
