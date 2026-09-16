import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Check, Fingerprint, KeyRound, Loader2, Monitor, Save, ShieldCheck, UserCog } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorText } from "@/lib/errors";
import { formatBytes, formatDate, formatDateTime, fromNow } from "@/lib/format";
import { useSessionStore } from "@/lib/session";

type SessionRow = {
  id: string;
  createdAt: number;
  lastAccessedAt: number;
  expiresAt: number;
  ip?: string;
  userAgent?: string;
  current: boolean;
};

export function AccountPage() {
  const token = useSessionStore((state) => state.token) ?? "";
  const overview = useQuery(api.accounts.overview, token ? { token } : "skip");
  const sessions = useQuery(api.accounts.sessions, token ? { token } : "skip") as SessionRow[] | undefined;
  const updateProfile = useMutation(api.accounts.updateProfile);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (overview?.user) {
      setUsername(overview.user.username);
      setEmail(overview.user.email ?? "");
    }
  }, [overview?.user]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  const guard = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(null);
    }
  };

  const user = overview?.user;
  const storage = overview?.storage;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="account"
        title="Your LocalMe account"
        description="Identity, credentials and the sessions attached to this account."
      />

      {error && <Alert variant="destructive">{error}</Alert>}
      {notice && (
        <div className="flex items-center gap-2 text-[11px] text-signal">
          <Check className="h-3 w-3" />
          {notice}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Username" value={user?.username ?? "—"} hint={user?.email ?? "no email on file"} icon={Fingerprint} tone="signal" />
        <StatCard label="Role" value={user?.role ?? "—"} hint={`joined ${formatDate(user?.createdAt)}`} icon={ShieldCheck} tone="blueprint" />
        <StatCard label="Projects" value={overview?.projectCount ?? "—"} hint={`${overview?.activeProjectCount ?? 0} live`} />
        <StatCard
          label="Storage"
          value={storage ? formatBytes(storage.used) : "—"}
          hint={storage ? `of ${formatBytes(storage.cap)} · library bonus ${formatBytes(storage.libraryBonus)}` : undefined}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="panel">
          <div className="flex items-center gap-2 border-b border-border px-5 py-3">
            <UserCog className="h-3.5 w-3.5 text-signal" />
            <div>
              <div className="text-sm font-medium">Profile</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Your username is part of every project URL, so renaming changes those addresses.
              </div>
            </div>
          </div>
          <div className="space-y-3 p-5">
            <div className="space-y-1.5">
              <Label htmlFor="account-username">Username</Label>
              <Input
                id="account-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="account-email">Email</Label>
              <Input
                id="account-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <Button
              variant="signal"
              size="sm"
              disabled={busy !== null || (username === user?.username && email === (user?.email ?? ""))}
              onClick={() =>
                guard("profile", async () => {
                  await updateProfile({ token, username, email });
                  setNotice("Profile updated");
                })
              }
            >
              {busy === "profile" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save profile
            </Button>
          </div>
        </div>

        <div className="panel">
          <div className="flex items-center gap-2 border-b border-border px-5 py-3">
            <KeyRound className="h-3.5 w-3.5 text-blueprint" />
            <div>
              <div className="text-sm font-medium">Password</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                At least 8 characters. Your current password is required to change it.
              </div>
            </div>
          </div>
          <div className="space-y-3 p-5">
            <div className="space-y-1.5">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={busy !== null || newPassword.length < 8 || !currentPassword}
              onClick={() =>
                guard("password", async () => {
                  await updateProfile({ token, currentPassword, newPassword });
                  setCurrentPassword("");
                  setNewPassword("");
                  setNotice("Password changed");
                })
              }
            >
              {busy === "password" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
              Change password
            </Button>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
          <div>
            <div className="text-sm font-medium">Active sessions</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Console sessions slide on activity and expire after 20 idle minutes.
            </div>
          </div>
        </div>
        {sessions === undefined ? (
          <div className="space-y-2 p-5">
            {[0, 1].map((index) => (
              <Skeleton key={index} className="h-8 w-full" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="px-5 py-8 text-center text-xs text-muted-foreground">No other sessions are active.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device</TableHead>
                <TableHead className="w-40">Client</TableHead>
                <TableHead className="w-44">Last seen</TableHead>
                <TableHead className="w-44">Expires</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {session.current ? <Badge variant="signal">this session</Badge> : <Badge variant="outline">other</Badge>}
                      <span className="text-[11px] text-muted-foreground">
                        started {formatDateTime(session.createdAt)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[12rem] truncate text-[11px] text-muted-foreground">
                    {session.ip ?? "unknown"}
                  </TableCell>
                  <TableCell className="text-[11px] text-muted-foreground">{fromNow(session.lastAccessedAt)}</TableCell>
                  <TableCell className="text-[11px] text-muted-foreground">{formatDateTime(session.expiresAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
