"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowUpFromLine, FolderInput, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { apiGet, apiPost } from "@/app/console";

export type TransferFeature = "routes" | "secrets" | "auth" | "roles";

/**
 * Selective export/import + "Add from project…" for one feature.
 *
 * The per-feature `/api/export/{feature}` endpoint is destructive (it replaces a
 * whole feature on import), which is right for a restore and wrong for a console.
 * `/api/transfer` is the additive counterpart: it exports exactly the ids you
 * pick, merges on import by default, and can copy straight from another project
 * the owner controls, creating any role the destination is missing.
 */
export function TransferControls({
  projectId,
  feature,
  selected,
  allIds,
  featureLabel,
  supportsCopyFrom = false,
  onChanged,
  showDelete,
  onDelete,
}: {
  projectId: number;
  feature: TransferFeature;
  selected: string[];
  allIds: string[];
  /** Shown when nothing is selected: "export everything" is still allowed. */
  featureLabel: string;
  supportsCopyFrom?: boolean;
  onChanged: () => void | Promise<void>;
  showDelete?: boolean;
  onDelete?: (ids: string[]) => void | Promise<void>;
}) {
  const [importOpen, setImportOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [payload, setPayload] = useState("");
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [busy, setBusy] = useState(false);

  const exportSelected = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) {
        toast.error("Select at least one row first.");
        return;
      }
      try {
        const query = new URLSearchParams({ projectId: String(projectId), feature });
        if (ids.length < allIds.length) query.set("ids", ids.join(","));
        const result = await apiGet<{ items: unknown[]; ids: string[] }>(`/api/transfer?${query}`);
        const name = `${feature}-${ids.length === allIds.length ? "all" : ids.join("_")}.json`;
        const blob = new Blob([JSON.stringify(result.items, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = name;
        link.click();
        URL.revokeObjectURL(url);
        toast.success(`Exported ${result.items.length} ${result.items.length === 1 ? "item" : "items"}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Export failed.");
      }
    },
    [allIds.length, feature, projectId],
  );

  const runImport = useCallback(async () => {
    setBusy(true);
    try {
      const parsed: unknown = JSON.parse(payload);
      if (!Array.isArray(parsed)) throw new Error("Payload must be a JSON array.");
      const result = await apiPost<{ written: number }>(`/api/transfer?projectId=${projectId}`, {
        feature,
        mode,
        items: parsed,
      });
      toast.success(`Imported ${result.written} ${result.written === 1 ? "item" : "items"}`);
      setImportOpen(false);
      setPayload("");
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }, [feature, mode, onChanged, payload, projectId]);

  const copyFrom = useCallback(
    async (sourceProjectId: number, ids: string[]) => {
      setBusy(true);
      try {
        const result = await apiPost<{
          written: number;
          rolesCreated: string[];
        }>(`/api/transfer?projectId=${projectId}`, {
          feature,
          mode: "copy-from",
          sourceProjectId,
          ids,
        });
        const created = result.rolesCreated.length
          ? ` · created roles: ${result.rolesCreated.join(", ")}`
          : "";
        toast.success(`Copied ${result.written} ${result.written === 1 ? "item" : "items"}${created}`);
        setCopyOpen(false);
        await onChanged();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Copy failed.");
      } finally {
        setBusy(false);
      }
    },
    [feature, onChanged, projectId],
  );

  const removeSelected = useCallback(async () => {
    if (!onDelete) return;
    setBusy(true);
    try {
      await onDelete(selected);
      await onChanged();
    } finally {
      setBusy(false);
    }
  }, [onDelete, onChanged, selected]);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => void exportSelected(selected)}
        title={
          selected.length > 0
            ? `Export ${selected.length} selected`
            : `Export every ${featureLabel} in this project`
        }
      >
        <ArrowUpFromLine className="h-3.5 w-3.5" />
        {selected.length > 0 ? `Export ${selected.length}` : "Export"}
      </Button>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
          <ArrowDownToLine className="h-3.5 w-3.5" /> Import
        </Button>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import {featureLabel}</DialogTitle>
            <DialogDescription>
              Paste a JSON array in the shape produced by <span className="font-mono">Export</span>.
              {" "}
              <strong>Merge</strong> upserts the items sent and leaves everything else untouched;
              {" "}
              <strong>Replace</strong> deletes the existing rows first. Password hashes and secret
              values are never exported, so imported visitors start disabled.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Mode</Label>
              <Select value={mode} onValueChange={(value) => setMode(value as "merge" | "replace")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="merge">Merge — keep everything else</SelectItem>
                  <SelectItem value="replace">Replace — delete existing first</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Textarea
              value={payload}
              onChange={(event) => setPayload(event.target.value)}
              rows={10}
              placeholder='[{"…": "…"}]'
              className="font-mono text-[12px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy || !payload.trim()} onClick={() => void runImport()}>
              {busy ? "Importing…" : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {supportsCopyFrom && (
        <CopyFromProjectDialog
          projectId={projectId}
          featureLabel={featureLabel}
          selected={selected}
          open={copyOpen}
          onOpenChange={setCopyOpen}
          busy={busy}
          onCopy={copyFrom}
        />
      )}

      {showDelete && onDelete && (
        <Button
          variant="ghost"
          size="sm"
          disabled={busy || selected.length === 0}
          className="text-muted-foreground hover:text-destructive"
          onClick={() => void removeSelected()}
        >
          <Trash2 className="h-3.5 w-3.5" />
          {selected.length > 0 ? `Delete ${selected.length}` : "Delete"}
        </Button>
      )}
    </>
  );
}

/**
 * "Add From Project…" — copies the selected rows out of another project the
 * owner controls. Missing roles are created automatically from the source's
 * permissions, which is the whole point: without it, copying visitors whose role
 * does not exist here would simply fail.
 */
function CopyFromProjectDialog({
  projectId,
  featureLabel,
  selected,
  open,
  onOpenChange,
  busy,
  onCopy,
}: {
  projectId: number;
  featureLabel: string;
  selected: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  onCopy: (sourceProjectId: number, ids: string[]) => Promise<void>;
}) {
  const [projects, setProjects] = useState<Array<{ id: number; name: string }>>([]);
  const [source, setSource] = useState("");
  const [useSelected, setUseSelected] = useState(false);

  // The project list only changes when the owner adds or removes one, and there
  // are never many, so it is fetched fresh each time the dialog opens.
  const load = useCallback(async () => {
    try {
      const { data } = await apiGet<{ data: Array<{ id: number; name: string }> }>("/api/projects");
      setProjects(data.filter((entry) => entry.id !== projectId));
    } catch {
      setProjects([]);
    }
  }, [projectId]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (next) void load();
      }}
    >
      <Button variant="outline" size="sm" onClick={() => onOpenChange(true)}>
        <FolderInput className="h-3.5 w-3.5" /> Add from project…
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add {featureLabel} from another project</DialogTitle>
          <DialogDescription>
            Copies rows into <span className="font-mono">this</span> project. Existing rows with
            the same key are updated; nothing else is touched. Roles the destination is missing
            are created automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Source project</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={String(project.id)}>
                    {project.name} (#{project.id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[hsl(var(--signal))]"
              checked={useSelected}
              disabled={selected.length === 0}
              onChange={(event) => setUseSelected(event.target.checked)}
            />
            Only the {selected.length} selected {selected.length === 1 ? "row" : "rows"}
            {selected.length === 0 && " (select rows here first to enable)"}
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={busy || !source}
            onClick={() => void onCopy(Number(source), useSelected ? selected : [])}
          >
            {busy ? "Copying…" : "Copy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}