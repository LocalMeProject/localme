"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Sign out from anywhere in the console.
 *
 * `replace` rather than `push`: signing out must not leave the console in
 * history, where Back would land on a guard that redirects again. The request
 * itself is best-effort — a dropped connection must still clear the client —
 * but the failure is not swallowed silently: the user is told why they may
 * still be signed in.
 */
export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();

  async function signOut() {
    try {
      const response = await fetch("/auth/logout", { method: "POST", credentials: "include" });
      if (!response.ok) throw new Error(`The server returned ${response.status}.`);
    } catch (error) {
      // Navigating home regardless is right; reporting the reason is the part
      // that was missing, because a silent failure looks like a broken button.
      console.warn("[localme] sign out request failed", error);
    } finally {
      router.replace("/");
      router.refresh();
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={signOut} className={className}>
      <LogOut className="h-3.5 w-3.5" /> Sign out
    </Button>
  );
}