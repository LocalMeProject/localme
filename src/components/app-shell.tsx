import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import {
  BookOpenCheck,
  ExternalLink,
  FolderKanban,
  HardDrive,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Plus,
  ShieldCheck,
  Sun,
  UserCog,
  X,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { BrandMark } from "@/components/logo";
import { MeterBar } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatBytes, formatPercent } from "@/lib/format";
import { siteUrl } from "@/lib/convex";
import { useSessionStore } from "@/lib/session";
import { useTheme } from "@/lib/theme";

const PRIMARY_NAV = [
  { to: "/dashboard", label: "Projects", icon: FolderKanban, hint: "Everything you have shipped" },
  { to: "/library", label: "Shared library", icon: HardDrive, hint: "Assets reused across projects" },
  { to: "/account", label: "Account", icon: UserCog, hint: "Profile, password and sessions" },
];

const PLATFORM_NAV = [
  { to: "/docs", label: "API reference", icon: BookOpenCheck, hint: "Every endpoint, error and limit" },
  { to: "/docs#limits", label: "Limits & quotas", icon: HelpCircle, hint: "What the free tier allows" },
];

function NavItem({
  to,
  label,
  hint,
  icon: Icon,
  onNavigate,
}: {
  to: string;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "group relative flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
          isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            aria-hidden
            className={cn(
              "absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-signal transition-opacity",
              isActive ? "opacity-100" : "opacity-0",
            )}
          />
          <Icon className={cn("h-4 w-4 shrink-0", isActive && "text-signal")} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium">{label}</span>
            {hint && <span className="block truncate text-[11px] text-muted-foreground">{hint}</span>}
          </span>
        </>
      )}
    </NavLink>
  );
}

export function AppShell() {
  const token = useSessionStore((state) => state.token);
  const clear = useSessionStore((state) => state.clear);
  const overview = useQuery(api.accounts.overview, token ? { token } : "skip");
  const logout = useMutation(api.accounts.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggle } = useTheme();

  const user = overview?.user;
  const storage = overview?.storage;
  const isAdmin = user?.role === "admin" || user?.role === "operator";

  const handleSignOut = async () => {
    if (token) await logout({ token }).catch(() => undefined);
    clear();
    navigate("/");
  };

  // Close the mobile drawer on navigation and on Escape.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  const navigation = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col gap-6">
      <div>
        <div className="mono-label px-3 pb-2">Workspace</div>
        <nav className="flex flex-col gap-0.5" aria-label="Workspace">
          {PRIMARY_NAV.map((item) => (
            <NavItem key={item.to} {...item} onNavigate={onNavigate} />
          ))}
          {isAdmin && (
            <NavItem
              to="/admin"
              label="Administration"
              hint="Users, config and audit log"
              icon={ShieldCheck}
              onNavigate={onNavigate}
            />
          )}
        </nav>
      </div>

      <div>
        <div className="mono-label px-3 pb-2">Platform</div>
        <nav className="flex flex-col gap-0.5" aria-label="Platform">
          {PLATFORM_NAV.map((item) => (
            <NavItem key={item.to} {...item} onNavigate={onNavigate} />
          ))}
          <a
            href={`${siteUrl}/health`}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <LayoutDashboard className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-[13px] font-medium">Status</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <a
            href={siteUrl}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-[13px] font-medium">Hosted apps</span>
          </a>
        </nav>
      </div>

      <div className="mt-auto space-y-3">
        {storage && (
          <div className="rounded-lg border border-border bg-background/60 p-3">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="font-medium">Storage</span>
              <span className="font-mono tabular-nums">
                {formatBytes(storage.used)} / {formatBytes(storage.cap)}
              </span>
            </div>
            <MeterBar className="mt-2" value={storage.used} max={storage.cap} />
            <div className="mt-1.5 text-[10.5px] text-muted-foreground">{formatPercent(storage.used, storage.cap)} used</div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Link
            to="/account"
            onClick={onNavigate}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background font-mono text-xs uppercase transition-colors hover:border-signal/50"
            title="Account settings"
          >
            {user?.username?.slice(0, 2) ?? "??"}
          </Link>
          <Link to="/account" onClick={onNavigate} className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium">{user?.username ?? "—"}</div>
            <div className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {user?.role ?? ""}
            </div>
          </Link>
          <Button variant="ghost" size="icon-sm" title="Sign out" aria-label="Sign out" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>

      <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-card/50 p-3 lg:flex">
        <div className="flex h-12 items-center px-3">
          <Link to="/">
            <BrandMark />
          </Link>
        </div>
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto scrollbar-thin">{navigation()}</div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <div className="absolute inset-y-0 left-0 flex w-[19rem] max-w-[86vw] animate-fade-in flex-col border-r border-border bg-card p-3 shadow-raised">
            <div className="flex h-12 items-center justify-between px-1">
              <Link to="/" onClick={() => setMobileOpen(false)}>
                <BrandMark />
              </Link>
              <Button variant="ghost" size="icon-sm" aria-label="Close navigation" onClick={() => setMobileOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-4 min-h-0 flex-1 overflow-y-auto scrollbar-thin">{navigation(() => setMobileOpen(false))}</div>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/90 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/75 sm:px-5">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </Button>
          <Link to="/" className="lg:hidden" aria-label="LocalMe home">
            <BrandMark compact />
          </Link>

          <div className="hidden min-w-0 lg:block">
            <div className="truncate text-sm font-medium">
              {user?.username ? `${user.username}'s workspace` : "Loading workspace…"}
            </div>
            <div className="truncate font-mono text-[11px] text-muted-foreground">
              role {user?.role ?? "—"}
              {overview ? ` · ${overview.projectCount} project${overview.projectCount === 1 ? "" : "s"}` : ""}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme" title="Toggle theme">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="signal" size="sm" asChild className="touch:min-h-11">
              <Link to="/dashboard?new=1">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New project</span>
                <span className="sm:hidden">New</span>
              </Link>
            </Button>
          </div>
        </header>

        <main id="main" className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
