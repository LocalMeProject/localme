"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenCheck, FolderTree, Library, ShieldCheck } from "lucide-react";

import { BrandMark } from "@/components/logo";
import { CultureSwitch } from "@/components/culture-switch";
import { SignOutButton } from "@/components/sign-out-button";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/**
 * The chrome every signed-in surface wears.
 *
 * Shared by the console (`/dashboard`) and the operator console (`/admin`)
 * because they are the same shell with a different nav: two copies meant the
 * culture switch existed in one of them, which is exactly the kind of "works
 * on most pages" the platform is supposed to be better than.
 *
 * Client, because it reads the active culture and needs the pathname to mark
 * the current section — a server layout cannot do either.
 */
export function PlatformHeader({
  username,
  roleLabel,
  canAccessAdmin,
  /** Rendered in a tighter container; the admin console is wider. */
  wide = false,
}: {
  username: string;
  /** "admin" / "operator", or empty for an ordinary account. */
  roleLabel?: string;
  canAccessAdmin?: boolean;
  wide?: boolean;
}) {
  const pathname = usePathname();
  const { t } = useI18n();

  const links = [
    { href: "/dashboard", label: t("nav.projects"), icon: FolderTree, show: true },
    { href: "/dashboard/library", label: t("nav.library"), icon: Library, show: true },
    { href: "/admin", label: t("nav.console"), icon: ShieldCheck, show: Boolean(canAccessAdmin) },
    { href: "/docs", label: t("nav.docs"), icon: BookOpenCheck, show: true },
  ].filter((link) => link.show);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div
        className={cn(
          "mx-auto flex h-16 w-full items-center justify-between gap-4 px-4 sm:px-6",
          wide ? "max-w-7xl" : "max-w-6xl",
        )}
      >
        <div className="flex items-center gap-6">
          <Link href="/dashboard" aria-label={t("nav.consoleLabel")}>
            <BrandMark />
          </Link>
          <nav aria-label={t("nav.primary")} className="hidden items-center gap-4 text-13px sm:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-1",
                  pathname === link.href || pathname.startsWith(`${link.href}/`)
                    ? "font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <link.icon className="h-3.5 w-3.5" />
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <CultureSwitch />
          <span className="hidden font-mono text-12.5px text-muted-foreground sm:inline">
            {username}
            {roleLabel && (
              <span className="ms-1.5 text-11px uppercase tracking-wide">{roleLabel}</span>
            )}
          </span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}