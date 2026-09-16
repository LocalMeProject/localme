import { useEffect, useRef, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { convex } from "@/lib/convex";
import {
  Archive,
  BookLock,
  Boxes,
  CalendarClock,
  Database,
  Download,
  FileJson,
  Globe2,
  KeyRound,
  Loader2,
  Route as RouteIcon,
  Server,
  ShieldCheck,
  Upload,
  Webhook,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useProject } from "@/components/project-layout";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { errorText } from "@/lib/errors";
import { formatBytes } from "@/lib/format";
import { downloadBase64, downloadText, readFileAsBase64 } from "@/lib/upload";

const FEATURES = [
  { key: "routes", label: "Routes", description: "Path patterns, targets and access rules", icon: RouteIcon },
  { key: "api", label: "API endpoints", description: "Per-endpoint enable and auth toggles", icon: Server },
  { key: "roles", label: "Roles", description: "Custom roles and their permission sets", icon: ShieldCheck },
  { key: "secrets", label: "Secrets", description: "Secret names only — values are never exported", icon: BookLock },
  { key: "cron", label: "Cron", description: "Task enablement and parameters", icon: CalendarClock },
  { key: "webhooks", label: "Webhooks", description: "Endpoints, events and signing flags", icon: Webhook },
  { key: "dns", label: "DNS", description: "Registered domains and verification state", icon: Globe2 },
  { key: "auth", label: "Auth", description: "Visitor auth settings and visitor accounts", icon: KeyRound },
] as const;

type Mode = "merge" | "replace";

export function ProjectBackup() {
  const { project, token } = useProject();
  const projectId = project.id as Id<"projects">;

  const exportAll = useAction(api.transfer.exportAll);
  const importFeature = useMutation(api.transfer.importFeature);
  const importAll = useAction(api.transfer.importAll);

  const [mode, setMode] = useState<Mode>("merge");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [archive, setArchive] = useState<{ filename: string; bytes: number; entries: number } | null>(null);
  const featureInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const archiveInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div>
            <div className="text-sm font-medium">Full project archive</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              A ZIP containing <span className="font-mono text-foreground">storage/</span>,{" "}
              <span className="font-mono text-foreground">lib/</span>,{" "}
              <span className="font-mono text-foreground">config/config.json</span> and{" "}
              <span className="font-mono text-foreground">config/secrets.json</span>.
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <Label className="text-[11px] text-muted-foreground">Import mode</Label>
              <Select value={mode} onValueChange={(value) => setMode(value as Mode)}>
                <SelectTrigger className="h-8 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="merge">Merge</SelectItem>
                  <SelectItem value="replace">Replace</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => archiveInput.current?.click()}>
              <Upload className="h-3.5 w-3.5" />
              Import ZIP
            </Button>
            <Button
              variant="signal"
              size="sm"
              disabled={busy !== null}
              onClick={() =>
                guard("archive", async () => {
                  const result = await exportAll({ token, projectId });
                  if (result?.base64) {
                    downloadBase64(result.filename ?? "project.zip", result.base64, "application/zip");
                    setArchive({
                      filename: result.filename ?? "project.zip",
                      bytes: result.bytes ?? 0,
                      entries: result.entries ?? 0,
                    });
                    setNotice(`${result.filename} downloaded`);
                  }
                })
              }
            >
              {busy === "archive" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Archive className="h-3.5 w-3.5" />
              )}
              Export ZIP
            </Button>
          </div>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-3">
          <div className="rounded-md border border-border p-3">
            <div className="mono-label">last archive</div>
            <div className="mt-1.5 truncate font-mono text-xs">{archive?.filename ?? "—"}</div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="mono-label">size</div>
            <div className="mt-1.5 font-mono text-xs">{archive ? formatBytes(archive.bytes) : "—"}</div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="mono-label">entries</div>
            <div className="mt-1.5 font-mono text-xs">{archive?.entries ?? "—"}</div>
          </div>
        </div>
        <div className="border-t border-border px-5 py-3 text-[11px] text-muted-foreground">
          Exports are capped at 8 MB per archive. Export features individually if the project is larger.
        </div>
        <input
          ref={archiveInput}
          type="file"
          accept=".zip,application/zip"
          hidden
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            await guard("import-archive", async () => {
              const base64 = await readFileAsBase64(file);
              const result = await importAll({ token, projectId, base64, mode });
              setNotice(
                `Restored ${result?.restored?.files ?? 0} file(s), ${result?.restored?.library ?? 0} library asset(s) and ${result?.restored?.secrets ?? 0} secret(s)`,
              );
            });
            if (archiveInput.current) archiveInput.current.value = "";
          }}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {FEATURES.map((feature) => (
          <div key={feature.key} className="panel flex flex-col p-4">
            <div className="flex items-center gap-2">
              <feature.icon className="h-3.5 w-3.5 text-blueprint" />
              <span className="text-xs font-medium">{feature.label}</span>
            </div>
            <p className="mt-1.5 flex-1 text-[11px] text-muted-foreground">{feature.description}</p>
            <div className="mt-3 flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={busy !== null}
                onClick={() =>
                  guard(`export-${feature.key}`, async () => {
                    const result = await convex.query(api.transfer.exportFeature, {
                      token,
                      projectId,
                      feature: feature.key,
                    });
                    const filename = `${project.name}-${feature.key}.json`;
                    downloadText(filename, JSON.stringify(result, null, 2));
                    setNotice(`${filename} downloaded`);
                  })
                }
              >
                {busy === `export-${feature.key}` ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Export
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy !== null}
                onClick={() => featureInputs.current[feature.key]?.click()}
              >
                {busy === `import-${feature.key}` ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                Import
              </Button>
              <input
                ref={(node) => {
                  featureInputs.current[feature.key] = node;
                }}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  await guard(`import-${feature.key}`, async () => {
                    const payload = await file.text();
                    await importFeature({ token, projectId, feature: feature.key, payload, mode });
                    setNotice(`${feature.label} imported (${mode})`);
                  });
                  const node = featureInputs.current[feature.key];
                  if (node) node.value = "";
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="panel p-5">
        <div className="flex items-center gap-2">
          <FileJson className="h-3.5 w-3.5 text-signal" />
          <span className="text-sm font-medium">Feature export shape</span>
          <Badge variant="outline">version 1</Badge>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Feature exports share the same envelope as the <span className="font-mono">config/config.json</span> entry
          inside an archive, so a feature file can be re-imported on its own or extracted from a full backup.
        </p>
        <pre className="mt-3 overflow-auto rounded-md border border-border bg-card px-3 py-3 font-mono text-[11px] leading-5 text-muted-foreground scrollbar-thin">
          <code>{`{
  "feature": "routes",
  "exportedAt": "2026-07-23T12:00:00.000Z",
  "data": [ { "path": "/", "target": "/index.html", "requires_auth": false } ]
}`}</code>
        </pre>
      </div>

      <div className="panel p-5">
        <div className="flex items-center gap-2">
          <Boxes className="h-3.5 w-3.5 text-blueprint" />
          <span className="text-sm font-medium">What is not exported</span>
        </div>
        <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
          <li>
            <Database className="mr-1.5 inline h-3 w-3" />
            Database documents are not part of a ZIP export. Use the Database tab's query builder to export tables you
            care about.
          </li>
          <li>Visit logs and audit trails stay on the platform for retention and abuse review.</li>
          <li>Secret values are omitted from feature exports; only key names are included.</li>
        </ul>
      </div>
    </div>
  );
}
