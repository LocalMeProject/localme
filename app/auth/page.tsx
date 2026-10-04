"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { BrandMark } from "@/components/logo";
import { CultureSwitch } from "@/components/culture-switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n/client";
import { apiGet, apiPost } from "@/app/console";

/**
 * POST /auth/token — console login or signup. Sessions are 20-minute sliding
 * cookies; the platform dashboard lives at /dashboard.
 */
export default function AuthPage() {
  return (
    <Suspense>
      <AuthForm />
    </Suspense>
  );
}

function AuthForm() {
  const params = useSearchParams();
  const { t } = useI18n();
  // ?mode=signup seeds the toggle; explicit user choice wins over the param.
  const paramMode = params.get("mode") === "signup" ? ("signup" as const) : ("login" as const);
  const [userMode, setUserMode] = useState<"login" | "signup" | null>(null);
  const mode = userMode ?? paramMode;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captcha, setCaptcha] = useState<{ challengeId: string; svg: string } | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState("");

  const returnTo = params.get("returnTo") ?? "/dashboard";

  // Logins are captcha-gated (Blueprint §7.2); fetch the challenge lazily.
  useEffect(() => {
    if (mode !== "login" || captcha) return;
    let cancelled = false;
    void apiGet<{ challengeId: string; svg: string }>("/auth/captcha").then((challenge) => {
      if (!cancelled) setCaptcha(challenge);
    });
    return () => {
      cancelled = true;
    };
  }, [mode, captcha]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await apiPost<{ redirectUrl: string }>("/auth/token", {
        action: mode,
        username,
        password,
        returnUrl: returnTo,
        ...(mode === "login" && captcha
          ? { captchaId: captcha.challengeId, captchaAnswer }
          : {}),
      });
      toast.success(mode === "signup" ? t("auth.toast.welcome") : t("auth.toast.welcomeBack"));
      window.location.href = result.redirectUrl || "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.toast.failed"));
      setCaptcha(null); // fresh challenge for the next attempt
      setCaptchaAnswer("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="blueprint-grid flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link href="/" aria-label="LocalMe">
            <BrandMark />
          </Link>
          <CultureSwitch />
        </div>
        <div className="panel p-6 sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight">
            {mode === "signup" ? t("auth.title.signup") : t("auth.title.login")}
          </h1>
          <p className="mt-1.5 text-13px leading-relaxed text-muted-foreground">
            {mode === "signup" ? t("auth.subtitle.signup") : t("auth.subtitle.login")}
          </p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">{t("label.username")}</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                required
                minLength={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t("label.password")}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                required
                minLength={8}
              />
              {mode === "signup" && (
                <p className="text-11.5px text-muted-foreground">{t("auth.password.hint")}</p>
              )}
            </div>
            {mode === "login" && captcha && (
              <div className="space-y-1.5">
                <Label htmlFor="captcha">{t("auth.captcha.label")}</Label>
                <div
                  className="w-full overflow-hidden rounded-md border border-border"
                  dangerouslySetInnerHTML={{ __html: captcha.svg }}
                />
                <Input
                  id="captcha"
                  value={captchaAnswer}
                  onChange={(e) => setCaptchaAnswer(e.target.value)}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder={t("auth.captcha.placeholder")}
                  required
                />
              </div>
            )}
            {error && (
              <p className="text-13px text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy
                ? t("auth.submit.working")
                : mode === "signup"
                  ? t("auth.submit.signup")
                  : t("auth.submit.login")}
            </Button>
          </form>
          <div className="mt-5 border-t border-border pt-4 text-center text-13px text-muted-foreground">
            {mode === "signup" ? (
              <>
                {t("auth.switch.haveAccount")}{" "}
                <button
                  type="button"
                  className="text-signal hover:underline"
                  onClick={() => setUserMode("login")}
                >
                  {t("action.signIn")}
                </button>
              </>
            ) : (
              <>
                {t("auth.switch.newHere")}{" "}
                <button
                  type="button"
                  className="text-signal hover:underline"
                  onClick={() => setUserMode("signup")}
                >
                  {t("auth.switch.create")}
                </button>
              </>
            )}
          </div>
        </div>
        <p className="mt-6 text-center text-12.5px text-muted-foreground">
          {t("auth.visitorNote")}
        </p>
      </div>
    </main>
  );
}
