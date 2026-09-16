import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSessionStore } from "@/lib/session";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Wraps every authenticated route. Signed-out users are sent to `/auth` with
 * their intended path preserved in `returnTo`.
 */
export function RequireAuth() {
  const location = useLocation();
  const token = useSessionStore((state) => state.token);
  const clear = useSessionStore((state) => state.clear);
  const user = useQuery(api.accounts.me, token ? { token } : "skip");

  const expired = Boolean(token) && user === null;

  useEffect(() => {
    if (expired) clear();
  }, [expired, clear]);

  if (!token || expired) {
    const returnTo = `${location.pathname}${location.search}`;
    return <Navigate to={`/auth?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  if (user === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-full max-w-sm space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-24 w-full" />
          <p className="mono-label">restoring session…</p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
