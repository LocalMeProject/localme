import { redirect } from "next/navigation";
import Link from "next/link";
import { BookOpenCheck, FolderTree, Library, ShieldCheck } from "lucide-react";

import { BrandMark } from "@/components/logo";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { SignOutButton } from "@/components/sign-out-button";

/**
 * Server-side gate and chrome for the operator console.
 *
 * The API under `/api/admin/*` was already protected, but `/admin` itself
 * rendered its shell for any signed-in user and only showed a toast once the
 * requests came back 403. Resolving the session here means a non-operator never
 * receives the operator UI at all.
 *
 * Operators reach the console too (see `requireOperator`): their account runs
 * the platform day to day, and the page hides the handful of admin-only
 * controls from them. The gate runs against the *current* session, so
 * impersonating an ordinary user correctly hides the console and lands on
 * /dashboard — where the banner still offers a way back.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { getSessionUser } = await import("@/lib/server/sessions");
  const user = await getSessionUser();
  if (!user) redirect("/auth?returnTo=%2Fadmin");
  if (!user.isAdmin && !user.isOperator) redirect("/dashboard");
  return (
    <>
      {user.impersonatedBy && <ImpersonationBanner operator={user.impersonatedBy} />}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link href="/admin" aria-label="LocalMe operator console">
              <BrandMark />
            </Link>
            <nav className="flex items-center gap-4 text-[13px]">
              <span className="flex items-center gap-1.5 font-medium">
                <ShieldCheck className="h-3.5 w-3.5" /> Console
              </span>
              <Link
                href="/dashboard"
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <FolderTree className="h-3.5 w-3.5" /> Projects
              </Link>
              <Link
                href="/dashboard/library"
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <Library className="h-3.5 w-3.5" /> Library
              </Link>
              <a href="/docs" className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                <BookOpenCheck className="h-3.5 w-3.5" /> API docs
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden font-mono text-[12.5px] text-muted-foreground sm:inline">
              {user.username}
              <span className="ml-1.5 text-[11px] uppercase tracking-wide">
                {user.isAdmin ? "admin" : user.isOperator ? "operator" : ""}
              </span>
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </>
  );
}