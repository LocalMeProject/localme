import { redirect } from "next/navigation";

import { ImpersonationBanner } from "@/components/impersonation-banner";
import { PlatformHeader } from "@/components/platform-header";

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
 *
 * The header itself is a client component (`PlatformHeader`) because it carries
 * the culture switch; this file stays a server component so the gate runs
 * before any console markup is produced.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { getSessionUser } = await import("@/lib/server/sessions");
  const user = await getSessionUser();
  if (!user) redirect("/auth?returnTo=%2Fadmin");
  if (!user.isAdmin && !user.isOperator) redirect("/dashboard");
  return (
    <>
      {user.impersonatedBy && <ImpersonationBanner operator={user.impersonatedBy} />}
      <PlatformHeader
        username={user.username}
        roleLabel={user.isAdmin ? "admin" : user.isOperator ? "operator" : ""}
        canAccessAdmin
        wide
      />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </>
  );
}