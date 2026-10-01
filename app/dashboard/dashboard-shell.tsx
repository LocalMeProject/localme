"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Braces, BookOpenCheck, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/logo";
import { SignOutButton } from "@/components/sign-out-button";
import { cn } from "@/lib/utils";

/**
 * Dashboard chrome. The session is already verified by `layout.tsx` on the
 * server, so this component only renders the shell and owns the sign-out
 * transition — no second `/auth/me` round trip on every navigation.
 */
export default function DashboardShell({
  username,
  children,
  canAccessAdmin = false,
}: {
  username: string;
  children: React.ReactNode;
  /** Operators and admins get the console link; ordinary accounts do not. */
  canAccessAdmin?: boolean;
}) {
  const pathname = usePathname();

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
              <Link
                href="/dashboard/library"
                className={cn(
                  "text-[13px]",
                  pathname.startsWith("/dashboard/library")
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Library
              </Link>
              {canAccessAdmin && (
                <Link
                  href="/admin"
                  className={cn(
                    "flex items-center gap-1 text-[13px]",
                    pathname.startsWith("/admin")
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <ShieldCheck className="h-3.5 w-3.5" /> Console
                </Link>
              )}
              <a href="/docs" className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                <BookOpenCheck className="h-3.5 w-3.5" /> API docs
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden font-mono text-[12.5px] text-muted-foreground sm:inline">{username}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <footer className="border-t border-border py-6">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 text-[12.5px] text-muted-foreground sm:px-6">
          <span className="flex items-center gap-1.5">
            <Braces className="h-3.5 w-3.5" /> LocalMe console
          </span>
          <span className="font-mono text-[11.5px]">SQLite-first · Postgres-ready · docs are the contract</span>
        </div>
      </footer>
    </div>
  );
}
