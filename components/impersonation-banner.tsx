"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogOut, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";

/**
 * Persistent "you are acting as someone else" banner.
 *
 * Impersonation swaps the session, so every screen the target can reach looks
 * exactly like their own. This banner is the only thing telling the operator
 * they are not themselves — so it sits above the console chrome on every
 * authenticated route, not inside the admin page they came from.
 */
export function ImpersonationBanner({ operator }: { operator: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  async function stop() {
    setBusy(true);
    try {
      await fetch("/api/admin/impersonate/stop", { method: "POST", credentials: "include" });
      router.replace("/admin");
      router.refresh();
    } catch {
      toast.error(t("impersonation.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="alert"
      className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 border-b border-signal/40 bg-signal/10 px-4 py-2 text-12.5px"
    >
      <span className="flex items-center gap-2">
        <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-signal" aria-hidden />
        <span>
          {t("impersonation.bodyPrefix")} <span className="font-mono font-medium">{operator}</span>{" "}
          {t("impersonation.bodySuffix")}
        </span>
      </span>
      <Button variant="outline" size="sm" className="h-7" disabled={busy} onClick={() => void stop()}>
        <LogOut className="h-3.5 w-3.5 rtl-flip" />
        {busy ? t("impersonation.returning") : t("impersonation.return")}
      </Button>
    </div>
  );
}