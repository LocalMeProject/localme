import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  Check,
  Copy,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useProject } from "@/components/project-layout";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { StatCard } from "@/components/stat-card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorText } from "@/lib/errors";
import { formatDate, formatDateTime, fromNow } from "@/lib/format";

type RoleRow = {
  id: Id<"roles">;
  name: string;
  isSystem: boolean;
  permissions: Record<string, boolean>;
  permissionList: string[];
  visitorCount: number;
};

type VisitorRow = {
  id: Id<"visitors">;
  username: string;
  roleId: Id<"roles"> | null;
  roleName: string;
  isActive: boolean;
  createdAt: number;
  lastLoginAt: number | null;
  locked: boolean;
};

type ApiKeyRow = {
  id: Id<"apiKeys">;
  name: string;
  prefix: string;
  roleName: string;
  isActive: boolean;
  createdAt: number;
  lastUsedAt: number | null;
  expiresAt: number;
  expired: boolean;
};

export function ProjectAccess() {
  const { project, token } = useProject();
  const projectId = project.id as Id<"projects">;

  const roles = useQuery(api.access.listRoles, { token, projectId }) as RoleRow[] | undefined;
  const visitors = useQuery(api.access.listVisitors, { token, projectId }) as VisitorRow[] | undefined;
  const keys = useQuery(api.access.listApiKeys, { token, projectId }) as ApiKeyRow[] | undefined;
  const sessions = useQuery(api.access.visitorSessions, { token, projectId });
  const activity = useQuery(api.access.visitorLoginActivity, { token, projectId, limit: 25 });
  const catalog = useQuery(api.access.permissionCatalog, {});

  const updateProject = useMutation(api.projects.update);
  const createRole = useMutation(api.access.createRole);
  const updateRole = useMutation(api.access.updateRole);
  const deleteRole = useMutation(api.access.deleteRole);
  const createVisitor = useMutation(api.access.createVisitor);
  const updateVisitor = useMutation(api.access.updateVisitor);
  const deleteVisitor = useMutation(api.access.deleteVisitor);
  const resetPassword = useMutation(api.access.resetVisitorPassword);
  const createApiKey = useMutation(api.access.createApiKey);
  const revokeApiKey = useMutation(api.access.revokeApiKey);
  const revokeSessions = useMutation(api.access.revokeVisitorSessions);
  const rotateSecrets = useMutation(api.access.rotateProjectSecrets);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [roleOpen, setRoleOpen] = useState(false);
  const [roleName, setRoleName] = useState("");
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [editingRole, setEditingRole] = useState<RoleRow | null>(null);
  const [deleteRoleTarget, setDeleteRoleTarget] = useState<RoleRow | null>(null);

  const [visitorOpen, setVisitorOpen] = useState(false);
  const [visitorForm, setVisitorForm] = useState({ username: "", password: "", roleName: "Member" });
  const [deleteVisitorTarget, setDeleteVisitorTarget] = useState<VisitorRow | null>(null);
  const [passwordReset, setPasswordReset] = useState<{ username: string; password: string } | null>(null);

  const [keyOpen, setKeyOpen] = useState(false);
  const [keyForm, setKeyForm] = useState({ name: "", roleName: "Member" });
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyRow | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(timer);
  }, [notice]);

  const roleNames: string[] = (roles ?? []).map((role) => role.name);

  const guard = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  };

  const togglePermission = (list: string[], name: string) =>
    list.includes(name) ? list.filter((item) => item !== name) : [...list, name];

  return (
    <div className="space-y-5">
      {error && <Alert variant="destructive">{error}</Alert>}
      {notice && (
        <div className="flex items-center gap-2 text-[11px] text-signal">
          <span className="h-1.5 w-1.5 rounded-full bg-signal" />
          {notice}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Visitors" value={visitors?.length ?? "—"} hint={`${project.visitorsTotal} provisioned`} icon={Users} />
        <StatCard
          label="Active API keys"
          value={keys ? keys.filter((key) => key.isActive && !key.expired).length : "—"}
          icon={KeyRound}
          tone="blueprint"
        />
        <StatCard label="Live sessions" value={Array.isArray(sessions) ? sessions.length : "—"} icon={ShieldCheck} />
        <StatCard
          label="Visitor login"
          value={project.visitorAuthEnabled ? "enabled" : "disabled"}
          hint={`default role ${project.defaultVisitorRole}`}
          tone={project.visitorAuthEnabled ? "signal" : "default"}
          icon={Lock}
        />
      </div>

      <div className="panel">
        <div className="border-b border-border px-5 py-3">
          <div className="text-sm font-medium">Visitor authentication</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Controls whether your project's visitors can create accounts and sign in.
          </div>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <SettingRow
            title="Visitor login"
            description="Serve the built-in login page and accept visitor sessions."
            checked={project.visitorAuthEnabled}
            busy={busy}
            onChange={(checked) =>
              guard(async () => {
                await updateProject({ token, projectId, visitorAuthEnabled: checked });
              })
            }
          />
          <SettingRow
            title="Public signup"
            description="Let visitors create their own accounts from your pages."
            checked={project.signupEnabled}
            busy={busy}
            onChange={(checked) =>
              guard(async () => {
                await updateProject({ token, projectId, signupEnabled: checked });
              })
            }
          />
          <SettingRow
            title="Watermark"
            description="Append the platform attribution badge to served HTML pages."
            checked={project.watermarkEnabled}
            busy={busy}
            onChange={(checked) =>
              guard(async () => {
                await updateProject({ token, projectId, watermarkEnabled: checked });
              })
            }
          />
          <div className="space-y-1.5">
            <Label className="text-xs">Default role for new visitors</Label>
            <Select
              value={project.defaultVisitorRole}
              onValueChange={(value) =>
                guard(async () => {
                  await updateProject({ token, projectId, defaultVisitorRole: value });
                })
              }
            >
              <SelectTrigger className="text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Admin", "Member", "Guest", ...roleNames].map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Owner is never assignable to visitors; it belongs to the project owner.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Rotation &amp; recovery</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() =>
                  guard(async () => {
                    const result = await revokeSessions({ token, projectId });
                    setNotice(`${result?.revoked ?? 0} visitor session(s) revoked`);
                  })
                }
              >
                <LogOut className="h-3.5 w-3.5" />
                Revoke all sessions
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={busy}
                onClick={() =>
                  guard(async () => {
                    const result = await rotateSecrets({ token, projectId });
                    setNotice(`Rotated credentials · ${result?.revokedKeys ?? 0} API key(s) revoked`);
                  })
                }
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Rotate secrets
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Rotation signs every visitor out and disables all API keys. Issue new keys afterwards.
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="visitors">
        <TabsList>
          <TabsTrigger value="visitors">
            <Users className="h-3.5 w-3.5" />
            Visitors
          </TabsTrigger>
          <TabsTrigger value="roles">
            <ShieldCheck className="h-3.5 w-3.5" />
            Roles
          </TabsTrigger>
          <TabsTrigger value="keys">
            <KeyRound className="h-3.5 w-3.5" />
            API keys
          </TabsTrigger>
          <TabsTrigger value="sessions">
            <Lock className="h-3.5 w-3.5" />
            Sessions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visitors">
          <div className="panel">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
              <div>
                <div className="text-sm font-medium">Visitor accounts</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Pre-provision accounts for your project, or let visitors self-register.
                </div>
              </div>
              <Button
                variant="signal"
                size="sm"
                onClick={() => {
                  setVisitorForm({ username: "", password: "", roleName: "Member" });
                  setVisitorOpen(true);
                }}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Add visitor
              </Button>
            </div>
            {visitors === undefined ? (
              <div className="space-y-2 p-5">
                {[0, 1, 2].map((index) => (
                  <Skeleton key={index} className="h-8 w-full" />
                ))}
              </div>
            ) : visitors.length === 0 ? (
              <EmptyState
                className="m-5"
                icon={Users}
                title="No visitors yet"
                description="Enable public signup so visitors can register themselves, or add accounts here."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead className="w-40">Role</TableHead>
                    <TableHead className="w-28 text-center">Active</TableHead>
                    <TableHead className="w-32">Last login</TableHead>
                    <TableHead className="w-44" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visitors.map((visitor) => (
                    <TableRow key={visitor.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">{visitor.username}</span>
                          {visitor.locked && <Badge variant="destructive">locked</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={visitor.roleName}
                          onValueChange={(value) =>
                            guard(async () => {
                              await updateVisitor({ token, projectId, visitorId: visitor.id, roleName: value });
                              setNotice(`${visitor.username} → ${value}`);
                            })
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {["Member", "Guest", ...roleNames].map((name) => (
                              <SelectItem key={name} value={name}>
                                {name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={visitor.isActive}
                          disabled={busy}
                          onCheckedChange={(checked) =>
                            guard(async () => {
                              await updateVisitor({ token, projectId, visitorId: visitor.id, isActive: checked });
                            })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">
                        {visitor.lastLoginAt ? fromNow(visitor.lastLoginAt) : "never"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Reset password"
                            disabled={busy}
                            onClick={() =>
                              guard(async () => {
                                const result = await resetPassword({
                                  token,
                                  projectId,
                                  visitorId: visitor.id,
                                });
                                if (result) setPasswordReset(result);
                              })
                            }
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Reset
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Delete visitor"
                            onClick={() => setDeleteVisitorTarget(visitor)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="panel mt-5">
            <div className="border-b border-border px-5 py-3">
              <div className="text-sm font-medium">Recent visit log</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Signed-in and anonymous page views, deduplicated inside the five minute window.
              </div>
            </div>
            {!Array.isArray(activity) || activity.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-muted-foreground">No visits recorded yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Route</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="w-32">Type</TableHead>
                    <TableHead className="w-32 text-right">When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activity.map((visit: { route: string; visitedAt: number; ip: string | null; signedIn: boolean; isUnique: boolean }, index: number) => (
                    <TableRow key={`${visit.visitedAt}-${index}`}>
                      <TableCell className="font-mono text-[11px]">{visit.route}</TableCell>
                      <TableCell className="max-w-[16rem] truncate text-[11px] text-muted-foreground">
                        {visit.ip ?? "unknown"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={visit.signedIn ? "blueprint" : "outline"}>
                          {visit.signedIn ? "visitor" : "anonymous"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-[11px] text-muted-foreground">
                        {fromNow(visit.visitedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="roles">
          <div className="panel">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
              <div>
                <div className="text-sm font-medium">Roles &amp; permissions</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Four built-in roles ship with every project. Custom roles are additive.
                </div>
              </div>
              <Button
                variant="signal"
                size="sm"
                onClick={() => {
                  setEditingRole(null);
                  setRoleName("");
                  setRolePermissions([]);
                  setRoleOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Add role
              </Button>
            </div>
            {roles === undefined ? (
              <div className="space-y-2 p-5">
                {[0, 1, 2, 3].map((index) => (
                  <Skeleton key={index} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-40">Role</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead className="w-24 text-right">Visitors</TableHead>
                    <TableHead className="w-32" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">{role.name}</span>
                          {role.isSystem && <Badge variant="outline">built-in</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {role.permissionList.length === 0 ? (
                            <span className="text-[11px] text-muted-foreground">no permissions</span>
                          ) : (
                            role.permissionList.map((permission) => (
                              <Badge key={permission} variant="blueprint">
                                {permission}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-[11px] text-muted-foreground">
                        {role.visitorCount}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={role.name === "Owner"}
                            onClick={() => {
                              setEditingRole(role);
                              setRoleName(role.name);
                              setRolePermissions(role.permissionList);
                              setRoleOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Delete role"
                            disabled={role.isSystem}
                            onClick={() => setDeleteRoleTarget(role)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="keys">
          <div className="panel">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
              <div>
                <div className="text-sm font-medium">API keys</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Scoped to storage operations for this project, for agents and CLI tools. Send them as{" "}
                  <span className="font-mono text-foreground">X-API-Key</span>.
                </div>
              </div>
              <Button
                variant="signal"
                size="sm"
                onClick={() => {
                  setKeyForm({ name: "", roleName: "Member" });
                  setKeyOpen(true);
                }}
              >
                <KeyRound className="h-3.5 w-3.5" />
                Generate key
              </Button>
            </div>
            {keys === undefined ? (
              <div className="space-y-2 p-5">
                {[0, 1].map((index) => (
                  <Skeleton key={index} className="h-8 w-full" />
                ))}
              </div>
            ) : keys.length === 0 ? (
              <EmptyState
                className="m-5"
                icon={KeyRound}
                title="No API keys"
                description="Generate a key to upload and list storage files from an automated client."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-36">Prefix</TableHead>
                    <TableHead className="w-32">Role</TableHead>
                    <TableHead className="w-32">Last used</TableHead>
                    <TableHead className="w-32">Expires</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.map((key) => (
                    <TableRow key={key.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-xs">{key.name}</span>
                          {!key.isActive && <Badge variant="outline">revoked</Badge>}
                          {key.expired && <Badge variant="warning">expired</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-[11px]">{key.prefix}…</TableCell>
                      <TableCell>
                        <Badge variant="blueprint">{key.roleName}</Badge>
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">
                        {key.lastUsedAt ? fromNow(key.lastUsedAt) : "never"}
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">{formatDate(key.expiresAt)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={!key.isActive}
                            onClick={() => setRevokeTarget(key)}
                          >
                            Revoke
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="sessions">
          <div className="panel">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
              <div>
                <div className="text-sm font-medium">Live visitor sessions</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Sessions expire automatically after the configured idle timeout.
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() =>
                  guard(async () => {
                    const result = await revokeSessions({ token, projectId });
                    setNotice(`${result?.revoked ?? 0} session(s) revoked`);
                  })
                }
              >
                <LogOut className="h-3.5 w-3.5" />
                Revoke all
              </Button>
            </div>
            {!Array.isArray(sessions) ? (
              <div className="space-y-2 p-5">
                {[0, 1].map((index) => (
                  <Skeleton key={index} className="h-8 w-full" />
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-muted-foreground">No visitor is signed in right now.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Visitor</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="w-40">Started</TableHead>
                    <TableHead className="w-40">Expires</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map(
                    (session: { id: string; visitor: string; createdAt: number; expiresAt: number; ip: string | null }) => (
                      <TableRow key={session.id}>
                        <TableCell className="font-mono text-xs">{session.visitor}</TableCell>
                        <TableCell className="max-w-[18rem] truncate text-[11px] text-muted-foreground">
                          {session.ip ?? "unknown"}
                        </TableCell>
                        <TableCell className="text-[11px] text-muted-foreground">
                          {formatDateTime(session.createdAt)}
                        </TableCell>
                        <TableCell className="text-[11px] text-muted-foreground">
                          {formatDateTime(session.expiresAt)}
                        </TableCell>
                      </TableRow>
                    ),
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={roleOpen} onOpenChange={setRoleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRole ? `Edit ${roleName}` : "New role"}</DialogTitle>
            <DialogDescription>
              Permissions are checked for every API call made with a visitor session or an API key.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {!editingRole && (
              <div className="space-y-1.5">
                <Label htmlFor="role-name">Role name</Label>
                <Input
                  id="role-name"
                  value={roleName}
                  onChange={(event) => setRoleName(event.target.value)}
                  placeholder="Editor"
                  autoFocus
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {(catalog ?? []).map((permission: { name: string; label: string }) => (
                  <label
                    key={permission.name}
                    className="flex cursor-pointer items-start gap-2 rounded-md border border-border px-3 py-2"
                  >
                    <Checkbox
                      checked={rolePermissions.includes(permission.name)}
                      onCheckedChange={() => setRolePermissions((list) => togglePermission(list, permission.name))}
                    />
                    <span className="min-w-0">
                      <span className="block font-mono text-[11px]">{permission.name}</span>
                      <span className="block text-[10px] text-muted-foreground">{permission.label}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="signal"
              disabled={busy || (!editingRole && !roleName.trim())}
              onClick={() =>
                guard(async () => {
                  if (editingRole) {
                    await updateRole({
                      token,
                      projectId,
                      roleId: editingRole.id,
                      permissions: rolePermissions,
                    });
                    setNotice(`${editingRole.name} updated`);
                  } else {
                    await createRole({ token, projectId, name: roleName.trim(), permissions: rolePermissions });
                    setNotice(`${roleName.trim()} created`);
                  }
                  setRoleOpen(false);
                })
              }
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {editingRole ? "Save role" : "Create role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={visitorOpen} onOpenChange={setVisitorOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add a visitor</DialogTitle>
            <DialogDescription>Passwords are hashed with SHA-256 based scrypt-style derivation and never stored raw.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="visitor-username">Username</Label>
              <Input
                id="visitor-username"
                value={visitorForm.username}
                onChange={(event) => setVisitorForm({ ...visitorForm, username: event.target.value })}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="visitor-password">Password</Label>
              <Input
                id="visitor-password"
                type="password"
                value={visitorForm.password}
                onChange={(event) => setVisitorForm({ ...visitorForm, password: event.target.value })}
                placeholder="at least 8 characters"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select
                value={visitorForm.roleName}
                onValueChange={(value) => setVisitorForm({ ...visitorForm, roleName: value })}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Member", "Guest", ...roleNames].map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVisitorOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="signal"
              disabled={busy || !visitorForm.username.trim() || visitorForm.password.length < 8}
              onClick={() =>
                guard(async () => {
                  await createVisitor({ token, projectId, ...visitorForm });
                  setVisitorOpen(false);
                  setNotice(`Visitor ${visitorForm.username} created`);
                })
              }
            >
              Create visitor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={keyOpen} onOpenChange={setKeyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generate API key</DialogTitle>
            <DialogDescription>
              The key is shown once, immediately after creation. Store it in your agent or CI secret store.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="key-name">Name</Label>
              <Input
                id="key-name"
                value={keyForm.name}
                onChange={(event) => setKeyForm({ ...keyForm, name: event.target.value })}
                placeholder="deploy-bot"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={keyForm.roleName} onValueChange={(value) => setKeyForm({ ...keyForm, roleName: value })}>
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Admin", "Member", "Guest", ...roleNames].map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                The role decides which permissions the key receives. Keys never gain database access.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKeyOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="signal"
              disabled={busy || !keyForm.name.trim()}
              onClick={() =>
                guard(async () => {
                  const result = await createApiKey({ token, projectId, ...keyForm });
                  setKeyOpen(false);
                  if (result?.rawKey) setNewKey(result.rawKey as string);
                })
              }
            >
              Generate key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(newKey)} onOpenChange={(open) => !open && setNewKey(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Copy your API key now</DialogTitle>
            <DialogDescription>This value cannot be retrieved again. Revoke it if it leaks.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-md border border-signal/40 bg-signal/10 p-3">
            <code className="min-w-0 flex-1 break-all font-mono text-[11px]">{newKey}</code>
            <Button
              variant="ghost"
              size="icon-sm"
              title="Copy key"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(newKey ?? "");
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {
                  /* clipboard unavailable */
                }
              }}
            >
              {copied ? <Check className="h-3.5 w-3.5 text-signal" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <DialogFooter>
            <Button variant="signal" onClick={() => setNewKey(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(passwordReset)} onOpenChange={(open) => !open && setPasswordReset(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New visitor password</DialogTitle>
            <DialogDescription>
              Share it with <span className="font-mono text-foreground">{passwordReset?.username}</span>. Lockouts are
              cleared.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-md border border-border bg-card p-3">
            <code className="min-w-0 flex-1 break-all font-mono text-sm">{passwordReset?.password}</code>
            <Button
              variant="ghost"
              size="icon-sm"
              title="Copy password"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(passwordReset?.password ?? "");
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {
                  /* clipboard unavailable */
                }
              }}
            >
              {copied ? <Check className="h-3.5 w-3.5 text-signal" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <DialogFooter>
            <Button variant="signal" onClick={() => setPasswordReset(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteVisitorTarget)}
        onOpenChange={(open) => !open && setDeleteVisitorTarget(null)}
        title={`Delete ${deleteVisitorTarget?.username ?? "visitor"}?`}
        description="The visitor account and every active session are removed."
        confirmLabel="Delete visitor"
        pending={busy}
        onConfirm={() =>
          guard(async () => {
            if (!deleteVisitorTarget) return;
            await deleteVisitor({ token, projectId, visitorId: deleteVisitorTarget.id });
            setNotice(`${deleteVisitorTarget.username} deleted`);
          })
        }
      />

      <ConfirmDialog
        open={Boolean(deleteRoleTarget)}
        onOpenChange={(open) => !open && setDeleteRoleTarget(null)}
        title={`Delete role ${deleteRoleTarget?.name ?? ""}?`}
        description={
          deleteRoleTarget && deleteRoleTarget.visitorCount > 0 ? (
            <span className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              {deleteRoleTarget.visitorCount} visitor(s) use this role and will fall back to Guest.
            </span>
          ) : (
            "This role is removed from the project."
          )
        }
        confirmLabel="Delete role"
        pending={busy}
        onConfirm={() =>
          guard(async () => {
            if (!deleteRoleTarget) return;
            await deleteRole({ token, projectId, roleId: deleteRoleTarget.id });
            setNotice(`${deleteRoleTarget.name} deleted`);
          })
        }
      />

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        title="Revoke this API key?"
        description="Any client using it will start receiving 401 responses immediately."
        confirmLabel="Revoke key"
        pending={busy}
        onConfirm={() =>
          guard(async () => {
            if (!revokeTarget) return;
            await revokeApiKey({ token, projectId, keyId: revokeTarget.id });
            setNotice(`${revokeTarget.name} revoked`);
          })
        }
      />
    </div>
  );
}

function SettingRow({
  title,
  description,
  checked,
  busy,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  busy: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2.5">
      <div className="min-w-0">
        <div className="text-xs font-medium">{title}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">{description}</div>
      </div>
      <Switch checked={checked} disabled={busy} onCheckedChange={onChange} />
    </div>
  );
}
