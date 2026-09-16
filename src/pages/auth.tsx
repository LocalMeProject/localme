import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Database,
  Eye,
  EyeOff,
  HardDrive,
  Loader2,
  Lock,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Sun,
  UserRound,
  Zap,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { BrandMark } from "@/components/logo";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/lib/session";
import { useTheme } from "@/lib/theme";
import { useSeo } from "@/lib/seo";
import { errorText } from "@/lib/errors";
import { getDemo, DEMOS } from "@/lib/demo-apps";

type Mode = "login" | "signup";

const BENEFITS = [
  {
    icon: Database,
    title: "A database the moment you need one",
    body: "Query and store JSON documents with a single fetch call. No schema, no migrations.",
  },
  {
    icon: HardDrive,
    title: "Storage, auth and routing included",
    body: "Uploads, visitor accounts with roles, and login-gated pages are configuration, not code.",
  },
  {
    icon: Zap,
    title: "Nothing to deploy",
    body: "Your project is live the second you save a file. Add a domain whenever you are ready.",
  },
];

export function AuthPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const setToken = useSessionStore((state) => state.setToken);
  const token = useSessionStore((state) => state.token);
  const { theme, toggle } = useTheme();

  const importId = params.get("import");
  const pendingDemo = getDemo(importId);
  const returnTo = params.get("returnTo") ?? (importId ? `/dashboard?import=${importId}` : "/dashboard");

  const [mode, setMode] = useState<Mode>(params.get("mode") === "signup" ? "signup" : "login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [answer, setAnswer] = useState("");
  const [challenge, setChallenge] = useState<{ captchaId: string; question: string } | null>(null);
  const [captchaLoading, setCaptchaLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const info = useQuery(api.settings.publicInfo);
  const session = useQuery(api.accounts.me, token ? { token } : "skip");

  const createCaptcha = useMutation(api.accounts.createCaptcha);
  const login = useMutation(api.accounts.login);
  const signup = useMutation(api.accounts.signup);

  useSeo({
    title: mode === "signup" ? "Create your LocalMe account" : "Sign in to LocalMe",
    description:
      "Sign in to LocalMe to create projects, manage databases, storage, visitor accounts, routes and secrets, and publish frontend-only apps.",
    path: "/auth",
    noIndex: true,
  });

  const refreshCaptcha = useCallback(async () => {
    setAnswer("");
    setCaptchaLoading(true);
    try {
      const next = await createCaptcha({});
      setChallenge(next);
    } catch {
      setChallenge(null);
    } finally {
      setCaptchaLoading(false);
    }
  }, [createCaptcha]);

  useEffect(() => {
    void refreshCaptcha();
  }, [refreshCaptcha]);

  const passwordHint = useMemo(() => {
    if (mode !== "signup" || !password) return null;
    const checks = [
      { label: "8+ characters", ok: password.length >= 8 },
      { label: "a number", ok: /\d/.test(password) },
      { label: "a letter", ok: /[a-zA-Z]/.test(password) },
    ];
    return checks;
  }, [mode, password]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result =
        mode === "signup"
          ? await signup({
              username,
              password,
              email: email || undefined,
              captchaId: challenge?.captchaId,
              captchaAnswer: answer,
            })
          : await login({
              username,
              password,
              captchaId: challenge?.captchaId,
              captchaAnswer: answer,
            });
      setToken(result.token);
      navigate(returnTo, { replace: true });
    } catch (caught) {
      setError(errorText(caught));
      await refreshCaptcha();
    } finally {
      setPending(false);
    }
  };

  // Already signed in? Go straight to the console.
  if (token && session) {
    return <Navigate to={returnTo} replace />;
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Value panel */}
      <div className="blueprint-grid relative hidden flex-col justify-between border-r border-border bg-card/40 p-10 lg:flex">
        <div className="glow-signal pointer-events-none absolute -left-20 top-20 h-72 w-72 opacity-20 blur-3xl" aria-hidden />
        <Link to="/" className="relative">
          <BrandMark />
        </Link>

        <div className="relative max-w-lg">
          <Badge variant="signal" className="mb-5">
            <Sparkles className="h-3 w-3" />
            free tier · no credit card
          </Badge>
          <h1 className="text-balance text-display-sm">
            Everything your frontend needs — already running.
          </h1>
          <p className="copy mt-3">
            Create an account and you get a hosted URL, a document database, file storage, visitor accounts, routing,
            encrypted secrets and a proxy. No backend repo, no server to deploy.
          </p>

          <ul className="mt-8 space-y-5">
            {BENEFITS.map((benefit) => (
              <li key={benefit.title} className="flex gap-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
                  <benefit.icon className="h-4 w-4 text-signal" />
                </span>
                <div>
                  <div className="text-[13px] font-medium">{benefit.title}</div>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">{benefit.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">5 MB storage</Badge>
            <Badge variant="outline">100 free views / project / month</Badge>
            <Badge variant="outline">unlimited projects</Badge>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            scrypt password hashing · sessions expire after 20 minutes idle
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 flex items-center justify-between">
            <Link to="/" className="lg:hidden">
              <BrandMark compact />
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto"
              onClick={toggle}
              aria-label="Toggle theme"
              title="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>

          {pendingDemo && (
            <div className="mb-6 rounded-lg border border-signal/40 bg-signal/[0.06] p-4">
              <div className="flex items-center gap-2 text-[13px] font-medium">
                <Sparkles className="h-4 w-4 text-signal" />
                {pendingDemo.name} is waiting for you
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                Finish signing up and we will create the project, write{" "}
                <span className="font-mono text-foreground">{pendingDemo.path}</span> with the exact app you just used,
                and hand you the live URL.
              </p>
            </div>
          )}

          <div className="mb-6">
            <div className="mono-label mb-2">{mode === "signup" ? "create account" : "welcome back"}</div>
            <h2 className="text-xl font-semibold tracking-tight">
              {mode === "signup" ? "Start building on LocalMe" : "Sign in to your console"}
            </h2>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              {mode === "signup"
                ? "The first account on a fresh deployment becomes the administrator."
                : "Your projects, data and configuration are waiting."}
            </p>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg border border-border bg-card p-1">
            {(["login", "signup"] as Mode[]).map((candidate) => (
              <button
                key={candidate}
                type="button"
                onClick={() => {
                  setMode(candidate);
                  setError(null);
                }}
                aria-pressed={mode === candidate}
                className={cn(
                  "min-h-10 touch:min-h-11 rounded-md px-3 text-[13px] font-medium transition-colors",
                  mode === candidate ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {candidate === "login" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-[13px] text-foreground/80">
                Username
              </Label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="your_handle"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="pl-10"
                  required
                />
              </div>
              <p className="text-[11.5px] text-muted-foreground">3–32 characters: letters, numbers, underscores.</p>
            </div>

            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[13px] text-foreground/80">
                  Email <span className="text-muted-foreground">(optional, for account recovery)</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password" className="text-[13px] text-foreground/80">
                Password
              </Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="at least 8 characters"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  className="pl-10 pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="tap absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordHint && (
                <ul className="flex flex-wrap gap-x-4 gap-y-1 pt-0.5">
                  {passwordHint.map((check) => (
                    <li
                      key={check.label}
                      className={cn("flex items-center gap-1.5 text-[11.5px]", check.ok ? "text-signal" : "text-muted-foreground")}
                    >
                      <Check className={cn("h-3 w-3", !check.ok && "opacity-40")} />
                      {check.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="captcha" className="text-[13px] text-foreground/80">
                  Human check
                </Label>
                <button
                  type="button"
                  onClick={() => void refreshCaptcha()}
                  className="tap flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <RefreshCw className={cn("h-3 w-3", captchaLoading && "animate-spin")} />
                  new challenge
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span
                  aria-live="polite"
                  className="flex h-11 min-w-[7.5rem] select-none items-center justify-center rounded-md border border-border bg-card px-3 font-mono text-sm text-blueprint"
                >
                  {challenge ? `${challenge.question} = ?` : captchaLoading ? "loading…" : "unavailable"}
                </span>
                <Input
                  id="captcha"
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  placeholder="answer"
                  inputMode="numeric"
                  autoComplete="off"
                  className="flex-1"
                  required
                />
              </div>
            </div>

            {error && <Alert variant="destructive">{error}</Alert>}

            <Button type="submit" variant="signal" size="lg" className="w-full" disabled={pending || !challenge}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signup" ? "Create account" : "Sign in"}
              {!pending && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-[12px] text-muted-foreground">
            <Link to="/" className="link-quiet inline-flex items-center gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to the site
            </Link>
            <Link to="/docs" className="link-quiet">
              API reference
            </Link>
          </div>

          <div className="mt-8 border-t border-border pt-5">
            <p className="text-[11.5px] text-muted-foreground">
              {info?.stats.accounts
                ? `Join ${info.stats.accounts} account${info.stats.accounts === 1 ? "" : "s"} building on this deployment.`
                : "Every project you create includes the full platform."}{" "}
              Try the{" "}
              <a href="/#demo" className="text-signal underline-offset-4 hover:underline">
                live demo
              </a>{" "}
              — {DEMOS.length} real apps, no account needed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
