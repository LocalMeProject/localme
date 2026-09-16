import { useQuery } from "convex/react";
import { Activity, Eye, FileText, Users } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useProject } from "@/components/project-layout";
import { MeterBar, StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCount, formatPercent, fromNow } from "@/lib/format";

export function ProjectUsage() {
  const { project, token } = useProject();
  const usage = useQuery(api.insights.projectUsage, { token, projectId: project.id as Id<"projects"> });

  if (!usage) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const peak = Math.max(1, ...usage.series.map((point) => point.visits));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Visits this month"
          value={formatCount(usage.visitsUsedThisMonth)}
          hint={`${usage.remainingVisits} of ${usage.freeVisitsPerMonth} free visits left`}
          icon={Eye}
          tone="signal"
        />
        <StatCard label="Visits today" value={formatCount(usage.visitsToday)} hint="Since 00:00 UTC" icon={Activity} />
        <StatCard
          label="Unique visitors"
          value={formatCount(usage.uniqueVisitors)}
          hint="Deduplicated within 5 minutes"
          icon={Users}
          tone="blueprint"
        />
        <StatCard label="Logged page views" value={formatCount(usage.totalLoggedVisits)} hint={`${usage.files} stored files`} icon={FileText} />
      </div>

      <div className="panel p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Monthly visit allowance</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Only HTML page serves count. Assets, 404s and 403s are free, and refreshes inside five minutes are
              deduplicated.
            </div>
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            {formatPercent(usage.visitsUsedThisMonth, usage.freeVisitsPerMonth)}
          </span>
        </div>
        <MeterBar
          className="mt-3"
          value={usage.visitsUsedThisMonth}
          max={usage.freeVisitsPerMonth}
          tone={usage.remainingVisits === 0 ? "destructive" : "signal"}
        />
      </div>

      <div className="panel">
        <div className="border-b border-border px-5 py-3">
          <div className="text-sm font-medium">Last 14 days</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Aggregated nightly by the GenerateDailyStats task, with live counts merged in.
          </div>
        </div>
        <div className="flex h-48 items-end gap-1.5 px-5 py-5">
          {usage.series.map((point) => (
            <div key={point.date} className="group flex flex-1 flex-col items-center justify-end gap-1.5">
              <span className="text-[9px] tabular-nums text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                {point.visits}
              </span>
              <div
                className="w-full rounded-sm bg-signal/70 transition-colors group-hover:bg-signal"
                style={{ height: `${Math.max(2, (point.visits / peak) * 100)}%` }}
                title={`${point.date}: ${point.visits} visits, ${point.unique} unique`}
              />
              <span className="font-mono text-[9px] text-muted-foreground">{point.date.slice(8)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="border-b border-border px-5 py-3">
          <div className="text-sm font-medium">Recent page views</div>
          <div className="mt-0.5 text-xs text-muted-foreground">The 25 most recent HTML serves for this project.</div>
        </div>
        {usage.recent.length === 0 ? (
          <div className="px-5 py-8 text-center text-xs text-muted-foreground">No visits recorded yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Route</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Signed in</TableHead>
                <TableHead className="text-right">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usage.recent.map((visit, index) => (
                <TableRow key={`${visit.visitedAt}-${index}`}>
                  <TableCell className="font-mono text-[11px]">{visit.route}</TableCell>
                  <TableCell className="max-w-[16rem] truncate text-[11px] text-muted-foreground">
                    {visit.ip ?? "unknown"}
                  </TableCell>
                  <TableCell>
                    {visit.signedIn ? <Badge variant="blueprint">visitor</Badge> : <Badge variant="outline">anonymous</Badge>}
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
    </div>
  );
}
