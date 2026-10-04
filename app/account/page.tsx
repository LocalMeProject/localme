"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  UserRound,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  RotateCcw,
  HardDrive,
  FolderGit2,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";
import { CultureSwitch } from "@/components/culture-switch";
import { useI18n } from "@/lib/i18n/client";
import { apiGet, apiPatch, apiPost } from "@/app/console";
import { TokenSection } from "./token-section";

interface AccountDetails {
  id: number;
  username: string;
  email: string | null;
  isAdmin: boolean;
  storageCapBytes: number;
  maxProjects: number;
  projectStorageCapBytes: number;
  projectCount: number;
  usedStorageBytes: number;
  allowAgentRequests?: boolean;
  createdAt: string;
}

interface MasterKeyDetails {
  id: number;
  prefix: string;
  name: string;
  key: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.round(bytes / 1024)} KB`;
  return `${mb.toFixed(1)} MB`;
}

export default function AccountPage() {
  const { t, isRtl } = useI18n();
  const [account, setAccount] = useState<AccountDetails | null>(null);
  const [masterKey, setMasterKey] = useState<MasterKeyDetails | null>(null);
  const [keyRevealed, setKeyRevealed] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Form states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void apiGet<AccountDetails>("/api/account")
      .then((data) => {
        if (!cancelled) {
          setAccount(data);
          if (data.email) setEmail(data.email);
        }
      })
      .catch(() => undefined);

    void apiGet<MasterKeyDetails>("/api/account/key")
      .then((data) => {
        if (!cancelled) setMasterKey(data);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await apiPatch("/api/account", {
        currentPassword,
        ...(newPassword ? { newPassword } : {}),
        ...(email.trim() ? { email: email.trim() } : {}),
      });
      toast.success(t("account.toast.updated"));
      setCurrentPassword("");
      setNewPassword("");
      // Refresh account data
      const refreshed = await apiGet<AccountDetails>("/api/account");
      setAccount(refreshed);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("account.toast.failed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyKey() {
    if (!masterKey?.key) return;
    try {
      await navigator.clipboard.writeText(masterKey.key);
      setCopiedKey(true);
      toast.success(t("account.apiKey.copied"));
      setTimeout(() => setCopiedKey(false), 2000);
    } catch {
      toast.error("Failed to copy to clipboard.");
    }
  }

  async function handleRegenerateKey() {
    setRegenerating(true);
    try {
      const regenerated = await apiPost<MasterKeyDetails>("/api/account/key", {});
      setMasterKey(regenerated);
      setKeyRevealed(true);
      setRegenerateOpen(false);
      toast.success(t("account.apiKey.regenerated"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to regenerate API key.");
    } finally {
      setRegenerating(false);
    }
  }

  const projectUsagePct = account
    ? Math.min(100, Math.round((account.projectCount / Math.max(1, account.maxProjects)) * 100))
    : 0;

  const storageUsagePct = account
    ? Math.min(100, Math.round((account.usedStorageBytes / Math.max(1, account.storageCapBytes)) * 100))
    : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="mb-2 inline-flex items-center gap-1.5 text-13px text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="rtl-flip h-3.5 w-3.5" /> {t("account.backToDashboard")}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <PageHeader
            eyebrow={t("account.eyebrow")}
            title={t("account.title")}
            description={t("account.description")}
            className="min-w-0"
          />
          <CultureSwitch />
        </div>
      </div>

      {/* Quotas & Limitations Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Shield className="h-4 w-4 text-signal" />
            {t("account.limits.title")}
          </CardTitle>
          <CardDescription className="text-12.5px">
            {t("account.limits.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Project Count Limit */}
            <div className="rounded-lg border border-border/80 bg-muted/20 p-3.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <FolderGit2 className="h-3.5 w-3.5 text-signal" />
                  {t("account.limits.projects")}
                </span>
                <Badge variant="outline" className="font-mono text-11px">
                  {account ? `${account.projectCount} / ${account.maxProjects}` : "…"}
                </Badge>
              </div>
              <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-signal transition-all"
                  style={{ width: `${projectUsagePct}%` }}
                />
              </div>
              <p className="mt-2 text-11px text-muted-foreground">
                {account ? `${account.projectCount} created of ${account.maxProjects} maximum` : ""}
              </p>
            </div>

            {/* Per-Project Storage Cap */}
            <div className="rounded-lg border border-border/80 bg-muted/20 p-3.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <HardDrive className="h-3.5 w-3.5 text-signal" />
                  {t("account.limits.projectSize")}
                </span>
              </div>
              <div className="mt-2 font-mono text-lg font-semibold tracking-tight text-foreground">
                {account ? formatBytes(account.projectStorageCapBytes) : "…"}
              </div>
              <p className="mt-1 text-11px text-muted-foreground">
                Per-project size ceiling
              </p>
            </div>

            {/* Total Account Storage */}
            <div className="rounded-lg border border-border/80 bg-muted/20 p-3.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <HardDrive className="h-3.5 w-3.5 text-signal" />
                  {t("account.limits.totalStorage")}
                </span>
                <span className="font-mono text-11px text-muted-foreground">
                  {account ? `${formatBytes(account.usedStorageBytes)}` : "…"}
                </span>
              </div>
              <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-signal transition-all"
                  style={{ width: `${storageUsagePct}%` }}
                />
              </div>
              <p className="mt-2 text-11px text-muted-foreground">
                {account ? `${formatBytes(account.usedStorageBytes)} of ${formatBytes(account.storageCapBytes)}` : ""}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User Master API Key Section */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm">
                <KeyRound className="h-4 w-4 text-signal" />
                {t("account.apiKey.title")}
              </CardTitle>
              <CardDescription className="mt-1 text-12.5px">
                {t("account.apiKey.description")}
              </CardDescription>
            </div>
            {masterKey && (
              <Badge variant="outline" className="font-mono text-11px">
                prefix: {masterKey.prefix}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Input
                type={keyRevealed ? "text" : "password"}
                readOnly
                value={masterKey?.key ?? ""}
                className="ltr-content font-mono text-12.5px pr-10 select-all bg-muted/30"
                placeholder="sk_…"
              />
              <button
                type="button"
                onClick={() => setKeyRevealed((prev) => !prev)}
                className="tap absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                title={keyRevealed ? t("account.apiKey.hide") : t("account.apiKey.reveal")}
              >
                {keyRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyKey}
                disabled={!masterKey?.key}
                className="gap-1.5"
              >
                {copiedKey ? <Check className="h-3.5 w-3.5 text-signal" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedKey ? t("action.copied") : t("account.apiKey.copy")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRegenerateOpen(true)}
                className="gap-1.5 text-muted-foreground hover:text-destructive"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t("account.apiKey.regenerate")}
              </Button>
            </div>
          </div>

          {masterKey && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-11px text-muted-foreground">
              <div>
                <span>{t("account.apiKey.created")}: </span>
                <span className="font-mono text-foreground">
                  {new Date(masterKey.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div>
                <span>{t("account.apiKey.lastUsed")}: </span>
                <span className="font-mono text-foreground">
                  {masterKey.lastUsedAt ? new Date(masterKey.lastUsedAt).toLocaleDateString() : t("account.apiKey.neverUsed")}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog for Regenerating Master Key */}
      <Dialog open={regenerateOpen} onOpenChange={setRegenerateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("account.apiKey.regenerateConfirmTitle")}</DialogTitle>
            <DialogDescription>
              {t("account.apiKey.regenerateConfirmDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRegenerateOpen(false)}
              disabled={regenerating}
            >
              {t("action.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleRegenerateKey}
              disabled={regenerating}
            >
              {regenerating ? t("action.saving") : t("account.apiKey.regenerate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unified Tokens & Agent Authorization Section */}
      <TokenSection
        allowAgentRequestsInitial={Boolean(account?.allowAgentRequests)}
        isRtl={isRtl}
      />

      {/* Profile & Password Update */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <UserRound className="h-4 w-4 text-signal" />
            {account?.username ? (
              <span className="ltr-content font-mono">{account.username}</span>
            ) : (
              t("account.signedInAs")
            )}
            {account?.isAdmin && (
              <Badge variant="blueprint" className="text-11px font-mono">
                Admin
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="text-12.5px">
            {t("account.cardDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="current-password">{t("account.currentPassword")}</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">{t("account.newPassword")}</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                placeholder={t("account.keepBlank")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("label.email")}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("account.keepBlank")}
              />
            </div>
            <Button type="submit" disabled={busy || (!newPassword && email === (account?.email ?? ""))}>
              {busy ? t("action.saving") : t("action.saveChanges")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
