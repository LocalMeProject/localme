"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Braces, BookOpenCheck, LogOut } from "lucide-react";
import { BrandMark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/app/console";

interface Me {
  kind: string;
  username: string | null;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiGet<Me>("/auth/me")
      .then((data) => {
        if (!cancelled) setMe(data);
      })
      .catch(() => {
        if (!cancelled) router.replace("/auth?returnTo=" + encodeURIComponent(pathname));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router, pathname]);

  async function signOut() {
    try {
      await fetch("/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      router.push("/");
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" aria-label="LocalMe console">
              <BrandMark />
            </Link>
            <nav className="hidden items-center gap-4 text-[13px] sm:flex">
              <Link
                href="/dashboard"
                className={pathname === "/dashboard" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}
              >
                Projects
              </Link>
              <a
                href="/docs"
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <BookOpenCheck className="h-3.5 w-3.5" /> API docs
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {loading ? (
              <span className="text-[13px] text-muted-foreground">…</span>
            ) : (
              me?.username && (
                <span className="hidden font-mono text-[12.5px] text-muted-foreground sm:inline">
                  {me.username}
                </span>
              )
            )}
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <footer className="border-t border-border py-6">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 text-[12.5px] text-muted-foreground sm:px-6">
          <span className="flex items-center gap-1.5">
            <Braces className="h-3.5 w-3.5" /> LocalMe console
          </span>
          <span className="font-mono text-[11.5px]">
            SQLite-first · Postgres-ready · docs are the contract
          </span>
        </div>
      </footer>
    </div>
  );
}
