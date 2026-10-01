import { redirect } from "next/navigation";

import DashboardShell from "./dashboard-shell";
import { ImpersonationBanner } from "@/components/impersonation-banner";

/**
 * Server-side gate for the console.
 *
 * The shell also checks `/auth/me` on the client, but a client-only guard
 * still ships the dashboard's HTML and JS to anyone who requests it and only
 * then redirects — a flash of console chrome, and the bundle on the wire for
 * every anonymous visitor. This wrapper resolves the session before the shell
 * renders, so the guard is the default rather than a fallback.
 *
 * `impersonatedBy` rides along so the banner shows on every console route: an
 * operator looking at somebody else's console is otherwise indistinguishable
 * from that person.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { getSessionUser } = await import("@/lib/server/sessions");
  const user = await getSessionUser();
  if (!user) redirect("/auth?returnTo=%2Fdashboard");
  return (
    <>
      {user.impersonatedBy && <ImpersonationBanner operator={user.impersonatedBy} />}
      <DashboardShell
        username={user.username}
        canAccessAdmin={user.isAdmin || user.isOperator}
      >
        {children}
      </DashboardShell>
    </>
  );
}