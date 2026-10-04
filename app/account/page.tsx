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
  Lock,
  Phone,
  Mail,
  Sparkles,
  ExternalLink,
  Crown,
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
import { DEFAULT_PLANS, type SubscriptionPlan } from "@/lib/subscriptions-shared";
import { TokenSection } from "./token-section";

interface AccountDetails {
  id: number;
  username: string;
  email: string | null;
  phoneNumber?: string | null;
  isAdmin: boolean;
  isOperator?: boolean;
  subscriptionTier?: string;
  subscriptionExpiresAt?: string | null;
  storageCapBytes: number;
  maxProjects: number;
  projectStorageCapBytes: number;
  libraryStorageCapBytes?: number;
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
  const { t, locale, isRtl } = useI18n();
  const isFa = locale === "fa-IR";

  const [account, setAccount] = useState<AccountDetails | null>(null);
  const [masterKey, setMasterKey] = useState<MasterKeyDetails | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>(DEFAULT_PLANS);

  const [keyRevealed, setKeyRevealed] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Upgrade Dialog states
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<"plus" | "pro">("plus");
  const [checkingOut, setCheckingOut] = useState(false);

  // Form states
  const [email, setEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

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

    void fetch("/api/subscription/plans")
      .then((r) => r.json())
      .then((res) => {
        if (!cancelled && res.data && Array.isArray(res.data)) {
          setPlans(res.data);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSaveEmail(event: React.FormEvent) {
    event.preventDefault();
    setSavingEmail(true);
    try {
      await apiPatch("/api/account", {
        email: email.trim() ? email.trim() : null,
      });
      toast.success(isFa ? "آدرس ایمیل با موفقیت ثبت شد." : "Email address saved successfully.");
      const refreshed = await apiGet<AccountDetails>("/api/account");
      setAccount(refreshed);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update email.");
    } finally {
      setSavingEmail(false);
    }
  }

  async function handleSavePassword(event: React.FormEvent) {
    event.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      toast.error(isFa ? "رمز عبور جدید باید حداقل ۸ نویسه باشد." : "New password must be at least 8 characters.");
      return;
    }
    setSavingPassword(true);
    try {
      await apiPatch("/api/account", {
        currentPassword,
        newPassword,
      });
      toast.success(isFa ? "رمز عبور با موفقیت به‌روزرسانی شد." : "Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update password.");
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleCheckout() {
    setCheckingOut(true);
    try {
      const res = await apiPost<{ success: boolean; paymentUrl: string }>("/api/subscription/checkout", {
        tier: selectedTier,
      });
      if (res.paymentUrl) {
        window.location.href = res.paymentUrl;
      } else {
        toast.error("Failed to generate payment gateway link.");
        setCheckingOut(false);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to connect to payment gateway.");
      setCheckingOut(false);
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

  const activeTier = account?.subscriptionTier || "free";
  const currentPlan = plans.find((p) => p.id === activeTier) || plans[0];

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
            eyebrow={isFa ? "مدیریت حساب" : "Account Settings"}
            title={isFa ? "مشخصات و دسترسی‌های کاربر" : "User Profile & Credentials"}
            description={
              isFa
                ? "مشاهده مشخصات حساب، پلن اشتراک، کلیدهای دسترسی عامل هوشمند و ظرفیت‌های ذخیره‌سازی"
                : "Manage your profile details, active subscription tier, AI tokens, and quotas."
            }
            className="min-w-0"
          />
          <CultureSwitch />
        </div>
      </div>

      {/* --------------------------------- Profile Details Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <UserRound className="h-4 w-4 text-signal" />
              {isFa ? "مشخصات کاربری" : "Profile Details"}
            </CardTitle>
            <div className="flex items-center gap-1.5">
              <Badge
                variant={activeTier === "pro" ? "signal" : activeTier === "plus" ? "default" : "outline"}
                className="capitalize"
              >
                <Crown className="h-3 w-3 mr-1 inline" />
                {isFa ? (currentPlan?.nameFa || activeTier) : (currentPlan?.name || activeTier)}
              </Badge>
              {account?.isAdmin && (
                <Badge variant="blueprint" className="text-11px font-mono">
                  Admin
                </Badge>
              )}
            </div>
          </div>
          <CardDescription className="text-12.5px">
            {isFa
              ? "اطلاعات حساب و سطح دسترسی فعال شما در پلتفرم LocalMe"
              : "Your account credentials and current subscription on LocalMe."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Username (Read-Only) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="profile-username" className="text-xs">
                  {isFa ? "نام کاربری (یکتا)" : "Username (Unique)"}
                </Label>
                <span className="flex items-center gap-1 text-10px font-mono text-muted-foreground">
                  <Lock className="h-3 w-3 text-muted-foreground" />
                  {isFa ? "غیرقابل تغییر" : "Locked"}
                </span>
              </div>
              <Input
                id="profile-username"
                type="text"
                value={account?.username ?? ""}
                readOnly
                disabled
                className="ltr-content font-mono text-12.5px bg-muted/40 cursor-not-allowed border-dashed"
              />
              <p className="text-10.5px text-muted-foreground">
                {isFa
                  ? "نام کاربری به عنوان شناسه اختصاصی هاست پروژه‌ها استفاده شده و غیرقابل ویرایش است."
                  : "Used as your public project URL identifier and cannot be modified."}
              </p>
            </div>

            {/* Phone Number (Read-Only / Not yet editable) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="profile-phone" className="text-xs">
                  {isFa ? "شماره همراه" : "Phone Number"}
                </Label>
                <span className="flex items-center gap-1 text-10px font-mono text-muted-foreground">
                  <Lock className="h-3 w-3 text-muted-foreground" />
                  {isFa ? "قفل موقت" : "Read-only"}
                </span>
              </div>
              <Input
                id="profile-phone"
                type="text"
                value={account?.phoneNumber || (isFa ? "ثبت نشده" : "Not set")}
                readOnly
                disabled
                className="ltr-content font-mono text-12.5px bg-muted/40 cursor-not-allowed border-dashed"
              />
              <p className="text-10.5px text-muted-foreground">
                {isFa
                  ? "ویرایش شماره همراه در نسخه‌های آتی پلتفرم فعال خواهد شد."
                  : "Phone number editing will be available in an upcoming update."}
              </p>
            </div>
          </div>

          {/* Subscription Tier Overview & Upgrade Action */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-muted/20 p-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">
                  {isFa ? "طرح اشتراک فعال:" : "Current Plan:"}
                </span>
                <span className="text-13px font-bold text-signal">
                  {isFa ? (currentPlan?.nameFa || activeTier) : (currentPlan?.name || activeTier)}
                </span>
              </div>
              <p className="text-11px text-muted-foreground">
                {account?.subscriptionExpiresAt
                  ? (isFa
                      ? `اعتبار تا ${new Date(account.subscriptionExpiresAt).toLocaleDateString("fa-IR")}`
                      : `Valid until ${new Date(account.subscriptionExpiresAt).toLocaleDateString()}`)
                  : (isFa ? "طرح پایه با شروع سریع و بدون انقضا" : "Standard instant-start plan")}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setUpgradeOpen(true)}
              className="gap-1.5 text-xs font-medium"
            >
              <Sparkles className="h-3.5 w-3.5 text-signal" />
              {isFa ? "ارتقا یا تغییر اشتراک" : "Upgrade / Change Plan"}
            </Button>
          </div>

          {/* Email Update Form */}
          <form onSubmit={handleSaveEmail} className="space-y-3 pt-2 border-t border-border/60">
            <div className="space-y-1.5">
              <Label htmlFor="profile-email" className="text-xs">
                {isFa ? "آدرس ایمیل" : "Email Address"}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="profile-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="ltr-content text-12.5px"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={savingEmail || email.trim() === (account?.email ?? "")}
                >
                  {savingEmail ? (isFa ? "در حال ثبت..." : "Saving...") : (isFa ? "ذخیره ایمیل" : "Save Email")}
                </Button>
              </div>
              <p className="text-10.5px text-muted-foreground">
                {isFa
                  ? "جهت دریافت فاکتور پرداخت و هشدارهای سرور استفاده می‌شود."
                  : "Used for payment confirmations and essential service alerts."}
              </p>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* --------------------------------- Security & Password Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Lock className="h-4 w-4 text-signal" />
            {isFa ? "تغییر رمز عبور" : "Change Password"}
          </CardTitle>
          <CardDescription className="text-12.5px">
            {isFa
              ? "جهت حفظ امنیت حساب کاربری، رمز عبور را به‌صورت دوره‌ای تغییر دهید."
              : "Update your account password to maintain security."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSavePassword} className="space-y-4">
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
                placeholder={isFa ? "حداقل ۸ نویسه وارد کنید" : "Enter at least 8 characters"}
                required
              />
            </div>
            <Button
              type="submit"
              disabled={savingPassword || !currentPassword || !newPassword}
            >
              {savingPassword ? (isFa ? "در حال تغییر..." : "Saving...") : (isFa ? "به‌روزرسانی رمز عبور" : "Update Password")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* --------------------------------- Quotas & Limitations Section */}
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
                <Badge variant="outline" className="font-mono text-11px">
                  {account ? formatBytes(account.projectStorageCapBytes) : "…"}
                </Badge>
              </div>
              <p className="mt-4 text-11px text-muted-foreground">
                {account ? `Up to ${formatBytes(account.projectStorageCapBytes)} per project` : ""}
              </p>
            </div>

            {/* Total Account Storage Used */}
            <div className="rounded-lg border border-border/80 bg-muted/20 p-3.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <HardDrive className="h-3.5 w-3.5 text-signal" />
                  {t("account.limits.totalStorage")}
                </span>
                <Badge variant="outline" className="font-mono text-11px">
                  {account ? `${formatBytes(account.usedStorageBytes)}` : "…"}
                </Badge>
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

      {/* --------------------------------- User Master API Key Section */}
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

      {/* --------------------------------- Unified Tokens & Agent Section */}
      <TokenSection
        allowAgentRequestsInitial={Boolean(account?.allowAgentRequests)}
        isRtl={isRtl}
      />

      {/* --------------------------------- Subscription Upgrade Dialog */}
      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-signal" />
              {isFa ? "ارتقا به اشتراک‌های تجاری LocalMe" : "Upgrade LocalMe Subscription"}
            </DialogTitle>
            <DialogDescription>
              {isFa
                ? "پلن مورد نظر خود را انتخاب کرده و از طریق درگاه امن زرین‌پال پرداخت نمایید."
                : "Select a plan to unlock higher project limits and storage via ZarinPal."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {plans.filter((p) => p.id !== "free" && p.enabled).map((plan) => (
              <label
                key={plan.id}
                onClick={() => setSelectedTier(plan.id as "plus" | "pro")}
                className={`flex cursor-pointer items-start justify-between rounded-xl border p-4 transition-all ${
                  selectedTier === plan.id
                    ? "border-signal bg-signal/5 ring-1 ring-signal"
                    : "border-border bg-card hover:border-border/80"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground">
                      {isFa ? plan.nameFa : plan.name}
                    </span>
                    {plan.isPopular && (
                      <Badge variant="signal" className="text-10px">
                        {isFa ? "محبوب‌ترین" : "Popular"}
                      </Badge>
                    )}
                  </div>
                  <p className="text-11px text-muted-foreground">
                    {isFa ? plan.descriptionFa : plan.description}
                  </p>
                  <div className="pt-1 text-xs text-muted-foreground">
                    <span>{plan.maxProjects} {isFa ? "پروژه فعال" : "Projects"}</span> ·{" "}
                    <span>{plan.projectStorageCapMb}MB {isFa ? "فضای هر پروژه" : "per project"}</span>
                  </div>
                </div>
                <div className="text-end">
                  <div className="text-sm font-bold text-foreground">
                    {plan.priceToman.toLocaleString("fa-IR")}
                  </div>
                  <div className="text-10px text-muted-foreground">
                    {isFa ? "تومان / ماهانه" : "Toman / month"}
                  </div>
                </div>
              </label>
            ))}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setUpgradeOpen(false)}
              disabled={checkingOut}
            >
              {isFa ? "انصراف" : "Cancel"}
            </Button>
            <Button
              type="button"
              variant="signal"
              onClick={handleCheckout}
              disabled={checkingOut}
              className="gap-1.5"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {checkingOut
                ? (isFa ? "در حال اتصال به زرین‌پال..." : "Connecting...")
                : (isFa ? "پرداخت امن در زرین‌پال" : "Proceed to Payment")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
