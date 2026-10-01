"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { apiGet, apiPatch } from "@/app/console";

export default function AccountPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Best-effort identity for the header; failures simply render generic UI.
  useEffect(() => {
    let cancelled = false;
    void apiGet<{ username: string | null }>("/auth/me")
      .then((me) => {
        if (!cancelled) setUsername(me.username);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await apiPatch("/api/account", {
        currentPassword,
        ...(newPassword ? { newPassword } : {}),
        ...(email.trim() ? { email: email.trim() } : {}),
      });
      toast.success("Account updated");
      setCurrentPassword("");
      setNewPassword("");
      setEmail("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="mb-2 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>
        <PageHeader eyebrow="Console" title="Account" description="Password and email for your platform account." />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <UserRound className="h-4 w-4 text-signal" />
            {username ? <span className="font-mono">{username}</span> : "Signed-in account"}
          </CardTitle>
          <CardDescription className="text-[12.5px]">
            Changing your password keeps existing sessions alive (they slide on activity).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                placeholder="Leave blank to keep"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Leave blank to keep"
              />
            </div>
            <Button type="submit" disabled={busy || (!newPassword && !email.trim())}>
              {busy ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
