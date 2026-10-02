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
import { useI18n } from "@/lib/i18n/client";

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
  const { t, fmt } = useI18n();

  const exportSelected = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) {
        toast.error(t("transfer.selectFirst"));
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
        toast.success(t("transfer.exported", { count: fmt.number(result.items.length) }));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("transfer.exportFailed"));
      }
    },
    [allIds.length, feature, projectId, t, fmt],
  );

  const runImport = useCallback(async () => {
    setBusy(true);
    try {
      const parsed: unknown = JSON.parse(payload);
      if (!Array.isArray(parsed)) throw new Error(t("transfer.notArray"));
      const result = await apiPost<{ written: number }>(`/api/transfer?projectId=${projectId}`, {
        feature,
        mode,
        items: parsed,
      });
      toast.success(t("transfer.imported", { count: fmt.number(result.written) }));
      setImportOpen(false);
      setPayload("");
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("transfer.importFailed"));
    } finally {
      setBusy(false);
    }
  }, [feature, mode, onChanged, payload, projectId, t, fmt]);

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
          ? t("transfer.copiedRoles", { roles: result.rolesCreated.join(", ") })
          : "";
        toast.success(`${t("transfer.copied", { count: fmt.number(result.written) })}${created}`);
        setCopyOpen(false);
        await onChanged();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("transfer.copyFailed"));
      } finally {
        setBusy(false);
      }
    },
    [feature, onChanged, projectId, t, fmt],
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
            ? t("transfer.exportSelectedTitle", { count: fmt.number(selected.length) })
            : t("transfer.exportAllTitle", { label: featureLabel })
        }
      >
        <ArrowUpFromLine className="h-3.5 w-3.5" />
        {selected.length > 0
          ? t("transfer.exportSelected", { count: fmt.number(selected.length) })
          : t("transfer.export")}
      </Button>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
          <ArrowDownToLine className="h-3.5 w-3.5" /> {t("action.import")}
        </Button>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("transfer.importTitle", { label: featureLabel })}</DialogTitle>
            <DialogDescription>{t("transfer.importDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t("transfer.mode")}</Label>
              <Select value={mode} onValueChange={(value) => setMode(value as "merge" | "replace")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="merge">{t("transfer.mode.merge")}</SelectItem>
                  <SelectItem value="replace">{t("transfer.mode.replace")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Textarea
              value={payload}
              onChange={(event) => setPayload(event.target.value)}
              rows={10}
              placeholder='[{"…": "…"}]'
              className="ltr-content font-mono text-12px"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              {t("action.cancel")}
            </Button>
            <Button disabled={busy || !payload.trim()} onClick={() => void runImport()}>
              {busy ? t("transfer.importing") : t("action.import")}
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
          {selected.length > 0
            ? t("transfer.deleteCount", { count: fmt.number(selected.length) })
            : t("transfer.delete")}
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
  const { t, fmt } = useI18n();

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
        <FolderInput className="h-3.5 w-3.5" /> {t("transfer.copyFrom")}
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("transfer.copyFromTitle", { label: featureLabel })}</DialogTitle>
          <DialogDescription>{t("transfer.copyFromDescription")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t("transfer.sourceProject")}</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger>
                <SelectValue placeholder={t("transfer.chooseProject")} />
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
          <label className="flex items-center gap-2 text-13px">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[hsl(var(--signal))]"
              checked={useSelected}
              disabled={selected.length === 0}
              onChange={(event) => setUseSelected(event.target.checked)}
            />
            {t("transfer.onlySelected", { count: fmt.number(selected.length) })}
            {selected.length === 0 && t("transfer.onlySelectedHint")}
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("action.cancel")}
          </Button>
          <Button
            disabled={busy || !source}
            onClick={() => void onCopy(Number(source), useSelected ? selected : [])}
          >
            {busy ? t("transfer.copying") : t("transfer.copy")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}