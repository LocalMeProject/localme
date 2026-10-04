"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  KeyRound,
  Bot,
  Plus,
  Copy,
  Check,
  RotateCw,
  Trash2,
  Eye,
  ShieldCheck,
  History,
  AlertCircle,
  Clock,
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
import { apiGet, apiPost, apiPatch, apiDelete } from "@/app/console";

export interface PatItem {
  id: number;
  name: string;
  description: string | null;
  prefix: string;
  rotationInterval: string | null;
  nextRotationAt: string | null;
  rotationGraceUntil: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface AatItem {
  id: number;
  name: string;
  description: string | null;
  prefix: string;
  expiresAt: string;
  createdAt: string;
}

export interface AuditItem {
  id: number;
  event: string;
  tokenType: string;
  tokenPrefix: string | null;
  actor: string;
  ipAddress: string | null;
  createdAt: string;
}

interface TokenSectionProps {
  allowAgentRequestsInitial: boolean;
  isRtl?: boolean;
}

export function TokenSection({ allowAgentRequestsInitial, isRtl }: TokenSectionProps) {
  const [allowAgents, setAllowAgents] = useState(allowAgentRequestsInitial);
  const [togglingAgent, setTogglingAgent] = useState(false);

  // PAT states
  const [pats, setPats] = useState<PatItem[]>([]);
  const [loadingPats, setLoadingPats] = useState(true);
  const [createPatOpen, setCreatePatOpen] = useState(false);
  const [patName, setPatName] = useState("");
  const [patDesc, setPatDesc] = useState("");
  const [patInterval, setPatInterval] = useState<string>("none");
  const [creatingPat, setCreatingPat] = useState(false);

  // New/revealed token dialog
  const [revealedToken, setRevealedToken] = useState<{ name: string; token: string; title: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // AAT states
  const [aats, setAats] = useState<AatItem[]>([]);
  const [loadingAats, setLoadingAats] = useState(true);

  // Audit log states
  const [audits, setAudits] = useState<AuditItem[]>([]);
  const [showAudits, setShowAudits] = useState(false);

  const [prevInitial, setPrevInitial] = useState(allowAgentRequestsInitial);
  if (prevInitial !== allowAgentRequestsInitial) {
    setPrevInitial(allowAgentRequestsInitial);
    setAllowAgents(allowAgentRequestsInitial);
  }

  useEffect(() => {
    loadPats();
    loadAats();
  }, []);

  async function loadPats() {
    setLoadingPats(true);
    try {
      const data = await apiGet<PatItem[]>("/api/account/pat");
      setPats(data || []);
    } catch {
      // Ignore
    } finally {
      setLoadingPats(false);
    }
  }

  async function loadAats() {
    setLoadingAats(true);
    try {
      const data = await apiGet<AatItem[]>("/api/account/agent-tokens");
      setAats(data || []);
    } catch {
      // Ignore
    } finally {
      setLoadingAats(false);
    }
  }

  async function loadAudits() {
    try {
      const data = await apiGet<AuditItem[]>("/api/account/token-audit");
      setAudits(data || []);
    } catch {
      // Ignore
    }
  }

  async function handleToggleAgentAccess() {
    setTogglingAgent(true);
    const target = !allowAgents;
    try {
      await apiPatch<{ allowAgentRequests: boolean }>("/api/account/agent-access", { allow: target });
      setAllowAgents(target);
      toast.success(
        target
          ? (isRtl ? "دسترسی درخواست عامل فعال شد." : "Agent authorization requests enabled.")
          : (isRtl ? "دسترسی درخواست عامل غیرفعال شد." : "Agent authorization requests disabled."),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to toggle agent access");
    } finally {
      setTogglingAgent(false);
    }
  }

  async function handleCreatePat(e: React.FormEvent) {
    e.preventDefault();
    if (!patName.trim()) return;
    setCreatingPat(true);
    try {
      const res = await apiPost<{ token: PatItem; rawToken: string }>("/api/account/pat", {
        name: patName.trim(),
        description: patDesc.trim() || undefined,
        rotationInterval: patInterval === "none" ? null : patInterval,
      });
      setCreatePatOpen(false);
      setPatName("");
      setPatDesc("");
      setPatInterval("none");
      await loadPats();
      setRevealedToken({
        name: res.token.name,
        token: res.rawToken,
        title: isRtl ? "کلید شخصی جدید ایجاد شد" : "Personal Access Token Created",
      });
      toast.success(isRtl ? "توکن با موفقیت ایجاد شد." : "Token created successfully.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create token");
    } finally {
      setCreatingPat(false);
    }
  }

  async function handleRevealPat(id: number) {
    try {
      const res = await apiPost<{ id: number; name: string; rawToken: string }>("/api/account/pat/reveal", { id });
      setRevealedToken({
        name: res.name,
        token: res.rawToken,
        title: isRtl ? "نمایش کلید شخصی" : "Personal Access Token",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reveal token");
    }
  }

  async function handleRotatePat(id: number) {
    try {
      const res = await apiPost<{ token: PatItem; rawToken: string }>("/api/account/pat/rotate", { id });
      await loadPats();
      setRevealedToken({
        name: res.token.name,
        token: res.rawToken,
        title: isRtl ? "کلید با موفقیت چرخش یافت" : "Token Rotated Successfully",
      });
      toast.success(
        isRtl
          ? "کلید جدید صادر شد. کلید قبلی تا ۱ ساعت آینده معتبر خواهد بود."
          : "New token generated. The previous token remains valid during the 1h grace period.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to rotate token");
    }
  }

  async function handleRevokePat(id: number) {
    try {
      await apiDelete(`/api/account/pat?id=${id}`);
      await loadPats();
      toast.success(isRtl ? "کلید باطل شد." : "Token revoked.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke token");
    }
  }

  async function handleRevokeAat(id: number) {
    try {
      await apiDelete(`/api/account/agent-tokens?id=${id}`);
      await loadAats();
      toast.success(isRtl ? "دسترسی عامل لغو شد." : "Agent token revoked.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke agent token");
    }
  }

  async function copyTokenText(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(isRtl ? "در حافظه کپی شد." : "Copied to clipboard.");
    setTimeout(() => setCopied(false), 2000);
  }

  function formatTimeRemaining(expiryStr: string): string {
    const diff = new Date(expiryStr).getTime() - Date.now();
    if (diff <= 0) return isRtl ? "منقضی شده" : "Expired";
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  }

  return (
    <div className="space-y-6">
      {/* 1. Agent Access Toggle Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Bot className="h-4 w-4 text-signal" />
                {isRtl ? "دسترسی عامل‌های هوشمند (Agent Access)" : "Autonomous Agent Access"}
              </CardTitle>
              <CardDescription className="text-12.5px">
                {isRtl
                  ? "به عامل‌های هوش مصنوعی (مانند Gemini یا Claude) اجازه می‌دهد درخواست اتصال کوتاه‌مدت ارسال کنند."
                  : "Allow external autonomous AI agents to request short-lived, human-consented access tokens."}
              </CardDescription>
            </div>
            <button
              type="button"
              onClick={handleToggleAgentAccess}
              disabled={togglingAgent}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                allowAgents ? "bg-signal" : "bg-neutral-300 dark:bg-neutral-700"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  allowAgents ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </CardHeader>
      </Card>

      {/* 2. Personal Access Tokens (PAT) Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm">
                <KeyRound className="h-4 w-4 text-signal" />
                {isRtl ? "کلیدهای دسترسی شخصی (PAT)" : "Personal Access Tokens (PAT)"}
              </CardTitle>
              <CardDescription className="mt-1 text-12.5px">
                {isRtl
                  ? `کلیدهای طولانی‌مدت یا خودچرخشی برای اتصال ابزارهای توسعه و خط فرمان (حداکثر ۱۰ عدد - ${pats.length} فعال).`
                  : `Permanent or auto-rotating tokens for CLI and developer tools (limit 10 - ${pats.length} active).`}
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCreatePatOpen(true)}
              disabled={pats.length >= 10}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              {isRtl ? "ایجاد کلید جدید" : "Generate PAT"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingPats ? (
            <p className="text-xs text-muted-foreground py-2">{isRtl ? "در حال بارگذاری..." : "Loading..."}</p>
          ) : pats.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
              {isRtl ? "هیچ کلید شخصی فعالی وجود ندارد." : "No Personal Access Tokens found."}
            </div>
          ) : (
            <div className="divide-y divide-border rounded-lg border text-xs">
              {pats.map((pat) => (
                <div key={pat.id} className="flex flex-wrap items-center justify-between p-3 gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{pat.name}</span>
                      <Badge variant="outline" className="font-mono text-10px">
                        {pat.prefix}…
                      </Badge>
                      {pat.rotationInterval && (
                        <Badge variant="blueprint" className="text-10px">
                          <RotateCw className="w-2.5 h-2.5 me-1" />
                          {pat.rotationInterval}
                        </Badge>
                      )}
                    </div>
                    {pat.description && (
                      <p className="text-muted-foreground text-11px">{pat.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-10px text-muted-foreground">
                      <span>
                        {isRtl ? "ایجاد:" : "Created:"} {new Date(pat.createdAt).toLocaleDateString()}
                      </span>
                      {pat.nextRotationAt && (
                        <span>
                          {isRtl ? "چرخش بعدی:" : "Next rotation:"}{" "}
                          {new Date(pat.nextRotationAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-xs"
                      onClick={() => handleRevealPat(pat.id)}
                      title={isRtl ? "نمایش کلید" : "Reveal Token"}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-xs"
                      onClick={() => handleRotatePat(pat.id)}
                      title={isRtl ? "چرخش فوری کلید" : "Rotate Now"}
                    >
                      <RotateCw className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-xs text-red-500 hover:text-red-600"
                      onClick={() => handleRevokePat(pat.id)}
                      title={isRtl ? "ابطال کلید" : "Revoke Token"}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Active Agent Tokens (AAT) Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                {isRtl ? "کلیدهای فعال عامل‌ها (AAT)" : "Active Agent Access Tokens (AAT)"}
              </CardTitle>
              <CardDescription className="mt-1 text-12.5px">
                {isRtl
                  ? `کلیدهای موقت و یکبارمصرف اعطا شده به عامل‌ها با تأیید انسانی (${aats.length} از ۵۰ فعال).`
                  : `Ephemeral, human-consented tokens currently active for agents (${aats.length} of 50 active).`}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingAats ? (
            <p className="text-xs text-muted-foreground py-2">{isRtl ? "در حال بارگذاری..." : "Loading..."}</p>
          ) : aats.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
              {isRtl
                ? "در حال حاضر هیچ عامل فعالی وجود ندارد."
                : "No active agent tokens currently authorized."}
            </div>
          ) : (
            <div className="divide-y divide-border rounded-lg border text-xs">
              {aats.map((aat) => (
                <div key={aat.id} className="flex items-center justify-between p-3 gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{aat.name}</span>
                      <Badge variant="outline" className="font-mono text-10px">
                        {aat.prefix}…
                      </Badge>
                    </div>
                    {aat.description && (
                      <p className="text-muted-foreground text-11px">{aat.description}</p>
                    )}
                    <div className="flex items-center gap-1.5 text-10px text-emerald-600 dark:text-emerald-400">
                      <Clock className="w-3 h-3" />
                      <span>
                        {isRtl ? "زمان باقیمانده:" : "Expires in:"} {formatTimeRemaining(aat.expiresAt)}
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs text-red-500 hover:text-red-600"
                    onClick={() => handleRevokeAat(aat.id)}
                  >
                    {isRtl ? "لغو دسترسی" : "Revoke"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Token Audit Log Collapsible */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs text-muted-foreground"
          onClick={() => {
            if (!showAudits) loadAudits();
            setShowAudits(!showAudits);
          }}
        >
          <History className="h-3.5 w-3.5" />
          {showAudits
            ? (isRtl ? "بستن تاریخچه امنیتی کلیدها" : "Hide Token Audit History")
            : (isRtl ? "مشاهده تاریخچه امنیتی کلیدها" : "View Token Audit History")}
        </Button>

        {showAudits && (
          <div className="mt-3 rounded-lg border p-3 text-xs space-y-2 bg-muted/20">
            {audits.length === 0 ? (
              <p className="text-muted-foreground text-center py-2">
                {isRtl ? "تاریخچه‌ای ثبت نشده است." : "No audit logs found."}
              </p>
            ) : (
              <div className="divide-y divide-border">
                {audits.map((log) => (
                  <div key={log.id} className="py-2 flex items-center justify-between text-11px">
                    <div>
                      <span className="font-mono font-semibold">{log.event}</span>
                      <span className="text-muted-foreground ms-2">
                        ({log.actor} {log.ipAddress ? `from ${log.ipAddress}` : ""})
                      </span>
                    </div>
                    <span className="text-muted-foreground">
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create PAT Dialog */}
      <Dialog open={createPatOpen} onOpenChange={setCreatePatOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isRtl ? "ایجاد کلید دسترسی شخصی (PAT)" : "Create Personal Access Token"}</DialogTitle>
            <DialogDescription>
              {isRtl
                ? "یک توکن دائمی یا خودچرخشی برای ابزارهای خارجی ایجاد کنید."
                : "Create a permanent or auto-rotating token for external tools."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreatePat} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pat-name">{isRtl ? "نام کلید" : "Token Name"}</Label>
              <Input
                id="pat-name"
                value={patName}
                onChange={(e) => setPatName(e.target.value)}
                placeholder="CLI Deploy Key"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pat-desc">{isRtl ? "توضیحات (اختیاری)" : "Description (Optional)"}</Label>
              <Input
                id="pat-desc"
                value={patDesc}
                onChange={(e) => setPatDesc(e.target.value)}
                placeholder="For automated builds"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pat-interval">{isRtl ? "بازه زمانی چرخش خودکار" : "Auto-Rotation Interval"}</Label>
              <select
                id="pat-interval"
                value={patInterval}
                onChange={(e) => setPatInterval(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="none">{isRtl ? "بدون چرخش (دائمی)" : "None (Permanent)"}</option>
                <option value="4h">4 Hours</option>
                <option value="6h">6 Hours</option>
                <option value="12h">12 Hours</option>
                <option value="1d">1 Day (Start of day 00:00 UTC)</option>
                <option value="7d">7 Days</option>
                <option value="15d">15 Days</option>
                <option value="1m">1 Month (Start of month)</option>
                <option value="3m">3 Months</option>
                <option value="6m">6 Months</option>
                <option value="1y">1 Year (Start of year)</option>
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreatePatOpen(false)}>
                {isRtl ? "انصراف" : "Cancel"}
              </Button>
              <Button type="submit" disabled={creatingPat || !patName.trim()}>
                {creatingPat ? (isRtl ? "در حال ایجاد..." : "Generating...") : (isRtl ? "ایجاد کلید" : "Generate")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reveal / Copy Token Dialog */}
      <Dialog open={Boolean(revealedToken)} onOpenChange={() => setRevealedToken(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{revealedToken?.title}</DialogTitle>
            <DialogDescription>
              {isRtl
                ? "این کلید را کپی کرده و در محل امنی نگهداری کنید."
                : "Copy this token now and keep it secure."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Input
                readOnly
                value={revealedToken?.token ?? ""}
                className="ltr-content font-mono text-12px pr-10 select-all bg-muted/40"
              />
              <button
                type="button"
                onClick={() => revealedToken?.token && copyTokenText(revealedToken.token)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {copied ? <Check className="h-4 w-4 text-signal" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <div className="text-11px text-muted-foreground flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <span>
                {isRtl
                  ? "توکن‌های PAT به صورت رمزنگاری‌شده ذخیره می‌شوند و هر زمان قابل مشاهده هستند."
                  : "PAT tokens are securely encrypted and can be retrieved or rotated anytime."}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setRevealedToken(null)}>{isRtl ? "بستن" : "Done"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
