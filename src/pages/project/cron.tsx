import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { CheckCircle2, Clock, History, Loader2, MinusCircle, Play, Timer, XCircle } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useProject } from "@/components/project-layout";
import { EmptyState } from "@/components/empty-state";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorText } from "@/lib/errors";
import { formatDateTime, fromNow } from "@/lib/format";

type Task = {
  name: string;
  description: string;
  schedule: string;
  defaultParameters: Record<string, unknown>;
  isEnabled: boolean;
  parameters: Record<string, unknown>;
  lastRunAt: number | null;
  lastStatus: string | null;
  lastMessage: string | null;
};

type Run = {
  id: string;
  taskName: string;
  status: string;
  message: string;
  affected: number;
  startedAt: number;
  finishedAt: number;
  durationMs: number;
};

export function ProjectCron() {
  const { project, token } = useProject();
  const projectId = project.id as Id<"projects">;

  const data = useQuery(api.automation.listCron, { token, projectId });
  const updateCron = useMutation(api.automation.updateCron);
  const runCronNow = useMutation(api.automation.runCronNow);

  const [drafts, setDrafts] = useState<Record<string, Record<string, unknown>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(timer);
  }, [notice]);

  const tasks: Task[] = data?.tasks ?? [];
  const runs: Run[] = data?.runs ?? [];
  const webhookOptions: { id: string; url: string }[] = data?.webhookOptions ?? [];

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

  const parametersFor = (task: Task) => drafts[task.name] ?? task.parameters ?? {};

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
        <div className="border-b border-border px-5 py-3">
          <div className="text-sm font-medium">Scheduled tasks</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Five built-in jobs run on the platform scheduler. Disabling one only affects this project.
          </div>
        </div>

        {data === undefined ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <EmptyState className="m-5" icon={Timer} title="No tasks configured" />
        ) : (
          <div className="divide-y divide-border">
            {tasks.map((task) => {
              const parameters = parametersFor(task);
              const supportsRetention = "retention_days" in (task.defaultParameters ?? {});
              const supportsWebhook = "webhook_id" in (task.defaultParameters ?? {});
              return (
                <div key={task.name} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Timer className="h-3.5 w-3.5 text-signal" />
                        <span className="font-mono text-xs font-medium">{task.name}</span>
                        <Badge variant="outline">{task.schedule}</Badge>
                        {task.lastStatus && (
                          <Badge
                            variant={
                              task.lastStatus === "success"
                                ? "success"
                                : task.lastStatus === "failed"
                                  ? "destructive"
                                  : "outline"
                            }
                          >
                            {task.lastStatus}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">{task.description}</p>
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {task.lastRunAt ? `last run ${fromNow(task.lastRunAt)}` : "never run"}
                        </span>
                        {task.lastMessage && <span className="truncate">· {task.lastMessage}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">enabled</span>
                        <Switch
                          checked={task.isEnabled}
                          disabled={busy === task.name}
                          onCheckedChange={(checked) =>
                            guard(task.name, async () => {
                              await updateCron({ token, projectId, taskName: task.name, isEnabled: checked });
                            })
                          }
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy === task.name}
                        onClick={() =>
                          guard(task.name, async () => {
                            const result = await runCronNow({ token, projectId, taskName: task.name });
                            setNotice(result?.message ?? `${task.name} queued`);
                          })
                        }
                      >
                        {busy === task.name ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                        Run now
                      </Button>
                    </div>
                  </div>

                  {(supportsRetention || supportsWebhook) && (
                    <div className="mt-4 flex flex-wrap items-end gap-3 rounded-md border border-border bg-muted/20 p-3">
                      {supportsRetention && (
                        <div className="space-y-1.5">
                          <Label className="text-[11px]">Retention (days)</Label>
                          <Input
                            type="number"
                            min={1}
                            max={365}
                            value={Number(parameters.retention_days ?? 7)}
                            onChange={(event) =>
                              setDrafts((current) => ({
                                ...current,
                                [task.name]: { ...parameters, retention_days: Number(event.target.value) },
                              }))
                            }
                            className="h-8 w-28 text-xs"
                          />
                        </div>
                      )}
                      {supportsWebhook && (
                        <div className="space-y-1.5">
                          <Label className="text-[11px]">Target webhook</Label>
                          <Select
                            value={String(parameters.webhook_id ?? "") || undefined}
                            onValueChange={(value) =>
                              setDrafts((current) => ({
                                ...current,
                                [task.name]: { ...parameters, webhook_id: value },
                              }))
                            }
                          >
                            <SelectTrigger className="h-8 w-72 text-xs">
                              <SelectValue placeholder="Select a webhook" />
                            </SelectTrigger>
                            <SelectContent>
                              {webhookOptions.map((option) => (
                                <SelectItem key={option.id} value={option.id} className="font-mono text-[11px]">
                                  {option.url}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {webhookOptions.length === 0 && (
                            <p className="text-[11px] text-amber-500">
                              Add a webhook on the Webhooks tab to send daily summaries.
                            </p>
                          )}
                        </div>
                      )}
                      <Button
                        variant="signal"
                        size="sm"
                        disabled={busy === task.name || !drafts[task.name]}
                        onClick={() =>
                          guard(task.name, async () => {
                            await updateCron({
                              token,
                              projectId,
                              taskName: task.name,
                              parameters: parametersFor(task),
                            });
                            setDrafts((current) => {
                              const next = { ...current };
                              delete next[task.name];
                              return next;
                            });
                            setNotice(`${task.name} parameters saved`);
                          })
                        }
                      >
                        Save parameters
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <History className="h-3.5 w-3.5 text-muted-foreground" />
          <div>
            <div className="text-sm font-medium">Run history</div>
            <div className="mt-0.5 text-xs text-muted-foreground">The 30 most recent executions for this project.</div>
          </div>
        </div>
        {data === undefined ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-8 w-full" />
            ))}
          </div>
        ) : runs.length === 0 ? (
          <div className="px-5 py-8 text-center text-xs text-muted-foreground">
            No runs recorded yet. Use <span className="font-mono text-foreground">Run now</span> to trigger a task.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead>Message</TableHead>
                <TableHead className="w-24 text-right">Affected</TableHead>
                <TableHead className="w-24 text-right">Duration</TableHead>
                <TableHead className="w-40 text-right">Finished</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow key={run.id}>
                  <TableCell className="font-mono text-[11px]">{run.taskName}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5">
                      {run.status === "success" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      ) : run.status === "failed" ? (
                        <XCircle className="h-3.5 w-3.5 text-destructive" />
                      ) : (
                        <MinusCircle className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <span className="text-[11px]">{run.status}</span>
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[22rem] truncate text-[11px] text-muted-foreground" title={run.message}>
                    {run.message}
                  </TableCell>
                  <TableCell className="text-right font-mono text-[11px]">{run.affected}</TableCell>
                  <TableCell className="text-right font-mono text-[11px]">{run.durationMs} ms</TableCell>
                  <TableCell className="text-right text-[11px] text-muted-foreground">
                    {formatDateTime(run.finishedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="panel p-5">
        <div className="text-sm font-medium">What each task does</div>
        <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
          <li>
            <span className="font-mono text-foreground">CleanExpiredSessions</span> — drops session rows past their idle
            timeout so sign-in stays fast.
          </li>
          <li>
            <span className="font-mono text-foreground">CleanOldLogs</span> — trims the visit log so usage reports stay
            inside the retention window.
          </li>
          <li>
            <span className="font-mono text-foreground">GenerateDailyStats</span> — rolls yesterday's visits into the
            daily aggregates shown on the Usage tab.
          </li>
          <li>
            <span className="font-mono text-foreground">SendDailySummaryWebhook</span> — posts a summary payload to a
            webhook you choose.
          </li>
          <li>
            <span className="font-mono text-foreground">CleanOrphanedUploads</span> — removes upload artefacts that were
            never registered to a file record.
          </li>
        </ul>
      </div>
    </div>
  );
}
