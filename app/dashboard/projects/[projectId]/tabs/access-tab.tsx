"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  KeyRound,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RowCheckbox, SelectAllCheckbox, SelectionToolbar } from "@/components/selection-toolbar";
import { TransferControls } from "@/components/transfer-controls";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/client";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/app/console";

export interface RoleRow {
  id: number;
  name: string;
  permissions: string[];
}

export interface VisitorRow {
  id: number;
  username: string;
  isActive: boolean;
  role: string;
  createdAt: string;
}

export interface ApiKeyRow {
  id: number;
  name: string;
  prefix: string;
  permissions: string[];
  createdAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
}

export function RolesPanel({
  projectId,
  roles,
  permissions,
  visitors,
  onChanged,
}: {
  projectId: number;
  roles: RoleRow[];
  permissions: string[];
  visitors: VisitorRow[];
  onChanged: () => void | Promise<void>;
}) {
  const { t, fmt } = useI18n();
  const [newRole, setNewRole] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<RoleRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<RoleRow | null>(null);
  const [onDelete, setOnDelete] = useState<"leave_role" | "delete_visitors" | "move_to">("leave_role");
  const [moveTo, setMoveTo] = useState("");
  const [busy, setBusy] = useState(false);

  const holders = (role: RoleRow) => visitors.filter((visitor) => visitor.role === role.name).length;

  async function createRole(event: React.FormEvent) {
    event.preventDefault();
    const name = newRole.trim();
    if (!name) return;
    try {
      await apiPost(`/api/roles?projectId=${projectId}`, { name, permissions: [] });
      setNewRole("");
      toast.success(t("roles.create.done", { name }));
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("roles.create.failed"));
    }
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    try {
      await apiPatch(`/api/roles/${editing.id}?projectId=${projectId}`, {
        name: editName.trim() || editing.name,
        permissions: editPermissions,
      });
      toast.success(t("roles.update.done"));
      setEditing(null);
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("roles.update.failed"));
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      const params = new URLSearchParams({ projectId: String(projectId), onDelete });
      if (onDelete === "move_to" && moveTo) params.set("moveToRoleId", moveTo);
      await apiDelete(`/api/roles/${deleting.id}?${params}`);
      const count = holders(deleting);
      toast.success(
        onDelete === "delete_visitors"
          ? t("roles.delete.doneVisitors", { count: fmt.number(count) })
          : onDelete === "move_to"
            ? t("roles.delete.doneMoved", { count: fmt.number(count) })
            : t("roles.delete.doneLeft", { count: fmt.number(count) }),
      );
      setDeleting(null);
      setSelected([]);
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("roles.delete.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 border-t border-border pt-4">
      <div className="flex flex-wrap items-end gap-2">
        <form onSubmit={createRole} className="flex items-end gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="role-name">{t("roles.new.label")}</Label>
            <Input
              id="role-name"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="ltr-input w-44 font-mono text-12.5px"
              dir="ltr"
              pattern="[a-zA-Z][a-zA-Z0-9_-]{0,31}"
              placeholder="Editor"
              required
            />
          </div>
          <Button type="submit" size="sm" variant="outline">
            <Plus className="h-3.5 w-3.5" /> {t("roles.new.submit")}
          </Button>
        </form>
        {roles.length > 0 && (
          <div className="ms-auto flex items-end gap-2">
            <TransferControls
              projectId={projectId}
              feature="roles"
              featureLabel="roles"
              selected={selected}
              allIds={roles.map((role) => role.name)}
              supportsCopyFrom
              onChanged={onChanged}
            />
          </div>
        )}
      </div>

      {roles.length === 0 ? (
        <p className="text-12.5px text-muted-foreground">{t("roles.empty")}</p>
      ) : (
        <div className="overflow-hidden rounded-md border border-border">
          <SelectionToolbar
            selected={selected}
            noun="selection.role"
            onClear={() => setSelected([])}
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <SelectAllCheckbox
                    selected={selected}
                    total={roles.length}
                    label={t("roles.selectAll")}
                    onToggle={(all) => setSelected(all ? roles.map((role) => role.name) : [])}
                  />
                </TableHead>
                <TableHead>{t("roles.table.role")}</TableHead>
                <TableHead className="w-24 text-end">{t("roles.table.visitors")}</TableHead>
                <TableHead>{t("roles.table.permissions")}</TableHead>
                <TableHead className="w-40" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <TableRow
                  key={role.id}
                  className={cn(selected.includes(role.name) && "bg-muted/40")}
                >
                  <TableCell>
                    <RowCheckbox
                      id={role.name}
                      selected={selected}
                      onToggle={(id, next) =>
                        setSelected((prev) => (next ? [...prev, id] : prev.filter((x) => x !== id)))
                      }
                    />
                  </TableCell>
                  <TableCell className="ltr-content font-mono text-12.5px">{role.name}</TableCell>
                  <TableCell className="nums text-end text-12.5px text-muted-foreground">
                    {fmt.number(holders(role))}
                  </TableCell>
                  <TableCell>
                    {role.permissions.length === 0 ? (
                      <span className="text-12px text-muted-foreground">{t("roles.none")}</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {role.permissions.slice(0, 4).map((permission) => (
                          <Badge key={permission} variant="outline" className="font-mono text-10px">
                            {permission}
                          </Badge>
                        ))}
                        {role.permissions.length > 4 && (
                          <Badge variant="outline" className="text-10px">
                            {t("roles.morePermissions", { count: fmt.number(role.permissions.length - 4) })}
                          </Badge>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" title={t("roles.manageTitle", { name: role.name })}>
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => {
                            setEditing(role);
                            setEditName(role.name);
                            setEditPermissions(role.permissions);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" /> {t("roles.menu.edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() => {
                            setDeleting(role);
                            setOnDelete("leave_role");
                            setMoveTo("");
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> {t("roles.menu.delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit: name and grants in one dialog. */}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={saveEdit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{t("roles.edit.title")}</DialogTitle>
              <DialogDescription>{t("roles.edit.description")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="edit-role-name">{t("roles.edit.nameLabel")}</Label>
              <Input
                id="edit-role-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="ltr-input font-mono text-12.5px"
                dir="ltr"
                pattern="[a-zA-Z][a-zA-Z0-9_-]{0,31}"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("roles.edit.permissionsLabel", { count: fmt.number(editPermissions.length) })}</Label>
              <div className="max-h-64 overflow-y-auto rounded-md border border-border p-2">
                {permissions.length === 0 ? (
                  <p className="px-1 py-2 text-12px text-muted-foreground">
                    {t("roles.edit.noCatalogue")}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {permissions.map((permission) => {
                      const on = editPermissions.includes(permission);
                      return (
                        <button
                          key={permission}
                          type="button"
                          aria-pressed={on}
                          onClick={() =>
                            setEditPermissions((prev) =>
                              on ? prev.filter((p) => p !== permission) : [...prev, permission],
                            )
                          }
                          className={cn(
                            "rounded border px-2 py-0.5 font-mono text-11px transition-colors",
                            on
                              ? "border-signal bg-signal/10 text-signal"
                              : "border-border text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {permission}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                {t("action.cancel")}
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? t("action.saving") : t("roles.edit.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete: what happens to the visitors who hold this role. */}
      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="ltr-content">{t("roles.delete.title", { name: deleting?.name ?? "" })}</DialogTitle>
            <DialogDescription>
              {(() => {
                const count = holders(deleting ?? { id: 0, name: "", permissions: [] });
                return count === 1
                  ? t("roles.delete.holdersOne")
                  : t("roles.delete.description", { count: fmt.number(count) });
              })()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {(
              [
                {
                  value: "leave_role",
                  title: t("roles.delete.option.leave_title"),
                  detail: t("roles.delete.option.leave_detail"),
                },
                {
                  value: "move_to",
                  title: t("roles.delete.option.move_title"),
                  detail: t("roles.delete.option.move_detail"),
                },
                {
                  value: "delete_visitors",
                  title: t("roles.delete.option.remove_title"),
                  detail: t("roles.delete.option.remove_detail"),
                },
              ] as const
            ).map((option) => (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors",
                  onDelete === option.value
                    ? "border-signal bg-signal/5"
                    : "border-border hover:border-foreground/25",
                )}
              >
                <input
                  type="radio"
                  name="role-on-delete"
                  className="mt-0.5 h-4 w-4 accent-[hsl(var(--signal))]"
                  checked={onDelete === option.value}
                  onChange={() => setOnDelete(option.value)}
                />
                <span className="min-w-0">
                  <span className="block text-13px font-medium">{option.title}</span>
                  <span className="block text-12px text-muted-foreground">{option.detail}</span>
                </span>
              </label>
            ))}
            {onDelete === "move_to" && (
              <div className="space-y-1.5 pt-1">
                <Label>{t("roles.delete.moveToLabel")}</Label>
                <Select value={moveTo} onValueChange={setMoveTo}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("roles.delete.chooseRole")} />
                  </SelectTrigger>
                  <SelectContent>
                    {roles
                      .filter((role) => role.id !== deleting?.id)
                      .map((role) => (
                        <SelectItem key={role.id} value={String(role.id)}>
                          {t("roles.delete.roleOption", {
                            name: role.name,
                            count: fmt.number(role.permissions.length),
                          })}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              {t("action.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={busy || (onDelete === "move_to" && !moveTo)}
              onClick={() => void confirmDelete()}
            >
              {busy ? t("roles.delete.deleting") : t("roles.delete.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AccessTab({ projectId, base }: { projectId: number; base: string | null }) {
  const { t, fmt } = useI18n();
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [visitors, setVisitors] = useState<VisitorRow[]>([]);
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [newVisitor, setNewVisitor] = useState("");
  const [newVisitorPassword, setNewVisitorPassword] = useState("");
  const [newVisitorRole, setNewVisitorRole] = useState("Member");
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<string[]>([]);
  const [freshKey, setFreshKey] = useState<string | null>(null);
  // Multi-select drives the bulk toolbar and the selective export/copy.
  const [visitorSelected, setVisitorSelected] = useState<string[]>([]);

  const load = useCallback(async () => {
    const [rolesRes, visitorsRes, keysRes] = await Promise.allSettled([
      apiGet<{ data: RoleRow[] }>(`/api/roles?projectId=${projectId}`),
      apiGet<{ data: VisitorRow[] }>(`/api/visitors?projectId=${projectId}`),
      apiGet<{ data: ApiKeyRow[]; availablePermissions?: string[] }>(`/api/keys?projectId=${projectId}`),
    ]);
    if (rolesRes.status === "fulfilled") setRoles(rolesRes.value.data);
    if (visitorsRes.status === "fulfilled") setVisitors(visitorsRes.value.data);
    if (keysRes.status === "fulfilled") {
      setKeys(keysRes.value.data);
      if (keysRes.value.availablePermissions) setAvailablePermissions(keysRes.value.availablePermissions);
    }
  }, [projectId]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function changeVisitorRole(visitor: VisitorRow, role: string) {
    if (visitor.role === role) return;
    try {
      await apiPatch(`/api/visitors/${visitor.id}?projectId=${projectId}`, { role });
      toast.success(t("access.roleChanged", { name: visitor.username, role }));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("access.roleFailed"));
    }
  }

  async function createVisitor(event: React.FormEvent) {
    event.preventDefault();
    try {
      await apiPost(`/api/visitors?projectId=${projectId}`, {
        username: newVisitor,
        password: newVisitorPassword,
        role: newVisitorRole,
      });
      setNewVisitor("");
      setNewVisitorPassword("");
      toast.success(t("access.visitors.done"));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("access.visitors.failed"));
    }
  }

  async function deleteVisitor(id: number) {
    try {
      await apiDelete(`/api/visitors/${id}?projectId=${projectId}`);
      toast.success(t("access.visitors.removed"));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("files.delete.failed"));
    }
  }

  async function createKey(event: React.FormEvent) {
    event.preventDefault();
    try {
      const result = await apiPost<{ key: string }>(`/api/keys?projectId=${projectId}`, {
        name: newKeyName,
        permissions: newKeyPermissions,
      });
      setFreshKey(result.key);
      setNewKeyName("");
      setNewKeyPermissions([]);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("access.keys.failed"));
    }
  }

  async function deleteSelectedVisitors(ids: string[]) {
    const targets = visitors.filter((visitor) => ids.includes(visitor.username));
    if (!window.confirm(t("access.visitors.deleteConfirm", { count: fmt.number(targets.length) }))) return;
    for (const visitor of targets) {
      await apiDelete(`/api/visitors/${visitor.id}?projectId=${projectId}`).catch(() => undefined);
    }
    toast.success(t("access.visitors.removedCount", { count: fmt.number(targets.length) }));
    setVisitorSelected([]);
    await load();
  }

  async function revokeKey(id: number) {
    try {
      await apiDelete(`/api/keys/${id}?projectId=${projectId}`);
      toast.success(t("access.keys.revokeDone"));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("access.keys.revokeFailed"));
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-signal" /> {t("access.visitors.title")}
          </CardTitle>
          <CardDescription className="text-12.5px">
            {t("access.visitors.description")}{" "}
            {base ? <span className="ltr-content font-mono">{base}/auth/login</span> : t("access.visitors.urlHint")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={createVisitor} className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="visitor-name">{t("label.username")}</Label>
              <Input
                id="visitor-name"
                value={newVisitor}
                onChange={(e) => setNewVisitor(e.target.value)}
                className="ltr-input w-40 font-mono text-12.5px"
                dir="ltr"
                pattern="[a-z0-9_-]{3,32}"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="visitor-password">{t("label.password")}</Label>
              <Input
                id="visitor-password"
                type="password"
                value={newVisitorPassword}
                onChange={(e) => setNewVisitorPassword(e.target.value)}
                className="w-44"
                minLength={8}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("label.role")}</Label>
              <Select value={newVisitorRole} onValueChange={setNewVisitorRole}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Member">Member</SelectItem>
                  {roles.filter((r) => r.name !== "Member").map((role) => (
                    <SelectItem key={role.id} value={role.name}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" size="sm" variant="outline">
              <Plus className="h-3.5 w-3.5" /> {t("access.visitors.add")}
            </Button>
          </form>
          <SelectionToolbar
            selected={visitorSelected}
            noun="selection.visitor"
            onClear={() => setVisitorSelected([])}
          >
            <span className="text-12px text-muted-foreground">
              {t("access.visitors.selectionHint")}
            </span>
          </SelectionToolbar>
          {visitors.length > 0 && (
            <div className="rounded-lg border border-border">
              <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
                <span className="mono-label">{t("access.visitors.label")}</span>
                <span className="ms-auto">
                  <TransferControls
                    projectId={projectId}
                    feature="auth"
                    featureLabel="visitors"
                    selected={visitorSelected}
                    allIds={visitors.map((visitor) => visitor.username)}
                    supportsCopyFrom
                    onChanged={load}
                    showDelete
                    onDelete={deleteSelectedVisitors}
                  />
                </span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <SelectAllCheckbox
                        selected={visitorSelected}
                        total={visitors.length}
                        label={t("access.visitors.selectAll")}
                        onToggle={(all) =>
                          setVisitorSelected(all ? visitors.map((visitor) => visitor.username) : [])
                        }
                      />
                    </TableHead>
                    <TableHead>{t("label.username")}</TableHead>
                    <TableHead>{t("label.role")}</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visitors.map((visitor) => (
                    <TableRow
                      key={visitor.id}
                      className={cn(
                        visitorSelected.includes(visitor.username) && "bg-muted/40",
                      )}
                    >
                      <TableCell>
                        <RowCheckbox
                          id={visitor.username}
                          selected={visitorSelected}
                          onToggle={(id, next) =>
                            setVisitorSelected((prev) =>
                              next ? [...prev, id] : prev.filter((entry) => entry !== id),
                            )
                          }
                        />
                      </TableCell>
                      <TableCell className="ltr-content font-mono text-12.5px">{visitor.username}</TableCell>
                      <TableCell>
                        <Select
                          value={visitor.role}
                          onValueChange={(value) => void changeVisitorRole(visitor, value)}
                        >
                          <SelectTrigger
                            className="h-7 w-40 text-12px"
                            aria-label={t("access.visitors.roleFor", { name: visitor.username })}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map((role) => (
                              <SelectItem key={role.id} value={role.name}>
                                {role.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-muted-foreground hover:text-destructive"
                          title={t("action.delete")}
                          onClick={() => void deleteVisitor(visitor.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <RolesPanel
            projectId={projectId}
            roles={roles}
            permissions={availablePermissions}
            visitors={visitors}
            onChanged={load}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-signal" /> {t("access.keys.title")}
          </CardTitle>
          <CardDescription className="text-12.5px">
            {t("access.keys.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {freshKey && (
            <div className="rounded-lg border border-signal/40 bg-signal/5 p-3">
              <p className="text-12px text-muted-foreground">
                {t("access.keys.once")}
              </p>
              <code className="mt-1 block break-all font-mono text-12.5px">{freshKey}</code>
            </div>
          )}
          <form onSubmit={createKey} className="flex items-end gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="key-name">{t("access.keys.nameLabel")}</Label>
              <Input
                id="key-name"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="ltr-input w-48"
                dir="ltr"
                placeholder="ci-deploy"
                required
              />
            </div>
            <Button type="submit" size="sm" variant="outline">
              <Plus className="h-3.5 w-3.5" /> {t("access.keys.create")}
            </Button>
          </form>
          {availablePermissions.length > 0 && (
            <div className="rounded-md border border-border p-3">
              <div className="text-11px font-medium">
                {t("access.keys.permissionsHint")}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                {availablePermissions.map((permission) => (
                  <label key={permission} className="flex items-center gap-2 font-mono text-11.5px">
                    <Checkbox
                      checked={newKeyPermissions.includes(permission)}
                      onCheckedChange={(checked) =>
                        setNewKeyPermissions((prev) =>
                          checked === true
                            ? [...prev, permission]
                            : prev.filter((p) => p !== permission),
                        )
                      }
                    />
                    {permission}
                  </label>
                ))}
              </div>
            </div>
          )}
          {keys.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("access.keys.table.name")}</TableHead>
                  <TableHead>{t("access.keys.table.prefix")}</TableHead>
                  <TableHead>{t("access.keys.table.status")}</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="text-12.5px">
                      {key.name}
                      {key.permissions.length > 0 && (
                        <span className="ms-2 font-mono text-10.5px text-muted-foreground">
                          {t("access.keys.permissionCount", { count: fmt.number(key.permissions.length) })}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="ltr-content font-mono text-12px text-muted-foreground">{key.prefix}…</TableCell>
                    <TableCell>
                      {key.revokedAt ? (
                        <Badge variant="outline">{t("access.keys.revoked")}</Badge>
                      ) : (
                        <Badge variant="default">{t("access.keys.active")}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-end">
                      {!key.revokedAt && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-muted-foreground hover:text-destructive"
                          title={t("action.delete")}
                          onClick={() => void revokeKey(key.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
