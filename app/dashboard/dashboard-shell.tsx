"use client";

import { Braces } from "lucide-react";

import { PlatformHeader } from "@/components/platform-header";
import { useI18n } from "@/lib/i18n/client";

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
  const { t } = useI18n();

  return (
    <div className="flex min-h-screen flex-col">
      <PlatformHeader username={username} canAccessAdmin={canAccessAdmin} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <footer className="border-t border-border py-6">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 text-12.5px text-muted-foreground sm:px-6">
          <span className="flex items-center gap-1.5">
            <Braces className="h-3.5 w-3.5" /> {t("nav.consoleLabel")}
          </span>
          <span className="font-mono text-11.5px">{t("nav.consoleFooterTagline")}</span>
        </div>
      </footer>
    </div>
  );
}