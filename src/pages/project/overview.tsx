import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import {
  AlertTriangle,
  BookLock,
  CheckCircle2,
  Circle,
  Database,
  FileCode2,
  Globe2,
  HardDrive,
  Layers,
  Route as RouteIcon,
  Users,
  Webhook,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useProject } from "@/components/project-layout";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBytes, fromNow } from "@/lib/format";
import { siteUrl } from "@/lib/convex";

const CHECKLIST = [
  { key: "hasIndexHtml", label: "index.html present", hint: "Served at the project root route" },
  { key: "has404", label: "Custom 404.html", hint: "Returned with status 404 when nothing matches" },
  { key: "hasManifest", label: "PWA manifest", hint: "manifest.json in project storage" },
  { key: "hasServiceWorker", label: "Service worker", hint: "sw.js — delete it to disable PWA behaviour" },
] as const;

export function ProjectOverview() {
  const { project, token } = useProject();
  const overview = useQuery(api.insights.projectOverview, { token, projectId: project.id as Id<"projects"> });
  const activity = useQuery(api.insights.projectActivity, { token, projectId: project.id as Id<"projects"> });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Storage"
          value={overview ? formatBytes(overview.storageUsed) : "—"}
          hint={overview ? `${overview.files} file(s)` : undefined}
          icon={HardDrive}
          tone="signal"
        />
        <StatCard
          label="Documents"
          value={overview?.documents ?? "—"}
          hint={overview ? `${overview.tables} table(s)` : undefined}
          icon={Database}
        />
        <StatCard
          label="Routes"
          value={overview?.routes ?? "—"}
          hint={overview ? `${overview.proxyRoutes} proxy route(s)` : undefined}
          icon={RouteIcon}
        />
        <StatCard
          label="Visitors"
          value={overview?.visitors ?? "—"}
          hint={overview ? `${overview.webhooks} webhook(s)` : undefined}
          icon={Users}
          tone="blueprint"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="panel">
          <div className="border-b border-border px-5 py-3">
            <div className="text-sm font-medium">Platform readiness</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              The seeded pieces every project starts with, plus what you have added since.
            </div>
          </div>
          <div className="divide-y divide-border">
            {overview === undefined
              ? [0, 1, 2, 3].map((index) => <Skeleton key={index} className="m-4 h-6" />)
              : CHECKLIST.map((item) => {
                  const done = Boolean(overview[item.key]);
                  return (
                    <div key={item.key} className="flex items-center gap-3 px-5 py-3">
                      {done ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                      ) : (
                        <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium">{item.label}</div>
                        <div className="text-[11px] text-muted-foreground">{item.hint}</div>
                      </div>
                      <Badge variant={done ? "success" : "outline"}>{done ? "ready" : "missing"}</Badge>
                    </div>
                  );
                })}
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-border px-5 py-4 sm:grid-cols-4">
            {[
              { label: "Secrets", value: overview?.secrets ?? 0, icon: BookLock, to: "secrets" },
              { label: "Domains", value: overview?.domains ?? 0, icon: Globe2, to: "domains" },
              { label: "Library", value: "shared", icon: Layers, to: "library" },
              { label: "Webhooks", value: overview?.webhooks ?? 0, icon: Webhook, to: "webhooks" },
            ].map((item) => (
              <Link
                key={item.label}
                to={`/projects/${project.id}/${item.to}`}
                className="rounded-md border border-border p-3 transition-colors hover:border-signal/40"
              >
                <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
                <div className="mt-2 text-sm font-semibold">{item.value}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{item.label}</div>
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="panel overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <FileCode2 className="h-3.5 w-3.5 text-signal" />
              <span className="mono-label">call the platform</span>
            </div>
            <pre className="overflow-auto px-4 py-4 font-mono text-[11px] leading-5 text-muted-foreground scrollbar-thin">
              <code>{`// Inside ${project.name}/index.html
await fetch('/api/db/insert', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    table: 'notes',
    document: { id: Date.now(), body: 'hello' }
  })
});

// The platform resolves this project from
// ${siteUrl}/${project.ownerUsername}/${project.name}/`}</code>
            </pre>
          </div>

          {overview && overview.visitsUsedThisMonth >= overview.freeVisitsPerMonth && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div className="text-xs">
                <div className="font-medium">Free visit allowance reached</div>
                <p className="mt-1 text-muted-foreground">
                  Page views return <span className="font-mono">402</span> until the counter resets next month.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="border-b border-border px-5 py-3">
          <div className="text-sm font-medium">Recent project activity</div>
          <div className="mt-0.5 text-xs text-muted-foreground">Audit trail for this project only.</div>
        </div>
        {(activity ?? []).length === 0 ? (
          <div className="px-5 py-8 text-center text-xs text-muted-foreground">No recorded activity yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Detail</TableHead>
                <TableHead className="text-right">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(activity ?? []).map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <Badge
                      variant={entry.level === "error" ? "destructive" : entry.level === "warning" ? "warning" : "outline"}
                    >
                      {entry.event}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{entry.message}</TableCell>
                  <TableCell className="text-right font-mono text-[11px] text-muted-foreground">
                    {fromNow(entry.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
