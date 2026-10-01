"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { BrandMark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const router = useRouter();
  const params = useSearchParams();
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
      toast.success(mode === "signup" ? "Welcome to LocalMe" : "Welcome back");
      router.push(result.redirectUrl || "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
      setCaptcha(null); // fresh challenge for the next attempt
      setCaptchaAnswer("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="blueprint-grid flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Link href="/" aria-label="LocalMe home">
            <BrandMark />
          </Link>
        </div>
        <div className="panel p-6 sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight">
            {mode === "signup" ? "Create your account" : "Sign in to the console"}
          </h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
            {mode === "signup"
              ? "One account hosts every project. No card, no backend code."
              : "Back to your projects, databases and deploy pipelines."}
          </p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
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
              <Label htmlFor="password">Password</Label>
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
                <p className="text-[11.5px] text-muted-foreground">At least 8 characters.</p>
              )}
            </div>
            {mode === "login" && captcha && (
              <div className="space-y-1.5">
                <Label htmlFor="captcha">Captcha</Label>
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
                  placeholder="Answer"
                  required
                />
              </div>
            )}
            {error && (
              <p className="text-[13px] text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}
            </Button>
          </form>
          <div className="mt-5 border-t border-border pt-4 text-center text-[13px] text-muted-foreground">
            {mode === "signup" ? (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  className="text-signal hover:underline"
                  onClick={() => setUserMode("login")}
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                New here?{" "}
                <button
                  type="button"
                  className="text-signal hover:underline"
                  onClick={() => setUserMode("signup")}
                >
                  Create an account
                </button>
              </>
            )}
          </div>
        </div>
        <p className="mt-6 text-center text-[12.5px] text-muted-foreground">
          Looking for a hosted project&apos;s login? Visit{" "}
          <code className="font-mono text-[11.5px]">/your-project/…</code> — visitor accounts are
          per project.
        </p>
      </div>
    </main>
  );
}
