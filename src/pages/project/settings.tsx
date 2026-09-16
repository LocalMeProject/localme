import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, Check, Copy, ExternalLink, Loader2, Save, Settings2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useProject } from "@/components/project-layout";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { errorText } from "@/lib/errors";
import { formatDate, formatBytes, formatPercent } from "@/lib/format";
import { projectUrl } from "@/lib/convex";

export function ProjectSettings() {
  const { project, token } = useProject();
  const projectId = project.id as Id<"projects">;
  const navigate = useNavigate();

  const updateProject = useMutation(api.projects.update);
  const removeProject = useMutation(api.projects.remove);
  const roles = useQuery(api.access.listRoles, { token, projectId }) as { name: string }[] | undefined;

  const [description, setDescription] = useState(project.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const liveUrl = projectUrl(project.ownerUsername, project.name);

  useEffect(() => {
    setDescription(project.description ?? "");
  }, [project.description]);

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

  return (
    <div className="space-y-5">
      {error && <Alert variant="destructive">{error}</Alert>}
      {notice && (
        <div className="flex items-center gap-2 text-[11px] text-signal">
          <span className="h-1.5 w-1.5 rounded-full bg-signal" />
          {notice}
        </div>
      )}

      <div className="panel">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <Settings2 className="h-3.5 w-3.5 text-signal" />
          <div>
            <div className="text-sm font-medium">Project identity</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              The name is part of your public URL and cannot change. Create a new project to rename.
            </div>
          </div>
        </div>
        <div className="grid gap-4 p-5 lg:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="project-name">Project name</Label>
            <Input id="project-name" value={project.name} readOnly className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label>Live URL</Label>
            <div className="flex items-center gap-2">
              <Input value={liveUrl} readOnly className="font-mono text-[11px]" />
              <Button
                variant="ghost"
                size="icon-sm"
                title="Copy URL"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(liveUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  } catch {
                    /* clipboard unavailable */
                  }
                }}
              >
                {copied ? <Check className="h-3.5 w-3.5 text-signal" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
              <Button variant="outline" size="icon-sm" title="Open live site" asChild>
                <a href={liveUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            </div>
          </div>
          <div className="space-y-1.5 lg:col-span-2">
            <Label htmlFor="project-description">Description</Label>
            <Input
              id="project-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What this project does"
              maxLength={280}
            />
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">Shown on the projects list. Up to 280 characters.</p>
              <span className="font-mono text-[10px] text-muted-foreground">{description.length}/280</span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <Badge variant="outline">created {formatDate(project.createdAt)}</Badge>
            <Badge variant="outline">
              storage {formatBytes(project.storageUsed)} / {formatBytes(project.storageCapBytes)}
            </Badge>
            <Badge variant="outline">
              visits {project.visitsUsedThisMonth}/{project.freeVisitsPerMonth} (
              {formatPercent(project.visitsUsedThisMonth, project.freeVisitsPerMonth)})
            </Badge>
          </div>
          <Button
            variant="signal"
            size="sm"
            disabled={busy || description === (project.description ?? "")}
            onClick={() =>
              guard(async () => {
                await updateProject({ token, projectId, description });
                setNotice("Description saved");
              })
            }
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save changes
          </Button>
        </div>
      </div>

      <div className="panel">
        <div className="border-b border-border px-5 py-3">
          <div className="text-sm font-medium">Behaviour</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            These switches take effect immediately for every visitor.
          </div>
        </div>
        <div className="divide-y divide-border">
          <ToggleRow
            title="Project active"
            description="When disabled, every request returns a platform maintenance response."
            checked={project.isActive}
            busy={busy}
            onChange={(checked) =>
              guard(async () => {
                await updateProject({ token, projectId, isActive: checked });
                setNotice(checked ? "Project enabled" : "Project disabled");
              })
            }
          />
          <ToggleRow
            title="Visitor login"
            description="Serve the built-in login flow and accept visitor sessions at /auth/*."
            checked={project.visitorAuthEnabled}
            busy={busy}
            onChange={(checked) =>
              guard(async () => {
                await updateProject({ token, projectId, visitorAuthEnabled: checked });
              })
            }
          />
          <ToggleRow
            title="Public visitor signup"
            description="Allow visitors to register themselves instead of provisioning accounts manually."
            checked={project.signupEnabled}
            busy={busy}
            onChange={(checked) =>
              guard(async () => {
                await updateProject({ token, projectId, signupEnabled: checked });
              })
            }
          />
          <ToggleRow
            title="Platform watermark"
            description="Append the attribution badge to served HTML. Disable it for a fully unbranded experience."
            checked={project.watermarkEnabled}
            busy={busy}
            onChange={(checked) =>
              guard(async () => {
                await updateProject({ token, projectId, watermarkEnabled: checked });
              })
            }
          />
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div className="min-w-0">
              <div className="text-xs font-medium">Default visitor role</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Assigned to every visitor that signs up through your pages.
              </div>
            </div>
            <Select
              value={project.defaultVisitorRole}
              onValueChange={(value) =>
                guard(async () => {
                  await updateProject({ token, projectId, defaultVisitorRole: value });
                  setNotice(`Default role set to ${value}`);
                })
              }
            >
              <SelectTrigger className="w-48 text-xs">
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
          </div>
        </div>
      </div>

      <div className="panel p-5">
        <div className="text-sm font-medium">Publishing</div>
        <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
          There is no build step. Files you save in Storage are served immediately at{" "}
          <span className="font-mono text-foreground">{liveUrl}</span>, so the editor is your deploy pipeline. Keep a ZIP
          export from the Backup tab before large changes.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={`/projects/${project.id}/storage`}>Open storage</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/projects/${project.id}/backup`}>Export a backup</Link>
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-5">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span className="text-sm font-medium text-destructive">Danger zone</span>
        </div>
        <p className="mt-1.5 max-w-3xl text-xs text-muted-foreground">
          Deleting a project permanently removes its files, library references, routes, roles, visitors, documents,
          secrets, webhooks, domains, API keys and usage history. There is no trash can and no recovery.
        </p>
        <Button variant="destructive" size="sm" className="mt-3" onClick={() => setDeleteOpen(true)}>
          Delete this project
        </Button>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${project.name}?`}
        description="Every file, document, visitor and configuration record for this project is erased. Export a backup first if you might need it."
        confirmWord={project.name}
        confirmLabel="Delete project forever"
        pending={busy}
        onConfirm={() =>
          guard(async () => {
            await removeProject({ token, projectId, confirmName: project.name });
            navigate("/dashboard");
          })
        }
      />
    </div>
  );
}

function ToggleRow({
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
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div className="min-w-0">
        <div className="text-xs font-medium">{title}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>
      </div>
      <Switch checked={checked} disabled={busy} onCheckedChange={onChange} />
    </div>
  );
}
