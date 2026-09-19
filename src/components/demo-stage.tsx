import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Code2, RotateCcw, Sparkles, Terminal } from "lucide-react";
import { DEMOS, demoDocument, stageDemoImport, type DemoApp, type DemoId } from "@/lib/demo-apps";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { siteUrl, siteUrlIsPublic } from "@/lib/convex";

interface LogEntry {
  id: number;
  method: string;
  path: string;
  status: number;
  ms: number;
  request: Record<string, unknown>;
  response: Record<string, unknown>;
}

/** Human summary of the most interesting field in a payload. */
function summarize(payload: Record<string, unknown>) {
  const data = payload.data as unknown[] | undefined;
  if (Array.isArray(data)) return `${data.length} document${data.length === 1 ? "" : "s"}`;
  if (typeof payload.total === "number") return `${payload.total} total`;
  if (typeof payload.deleted === "number") return `${payload.deleted} deleted`;
  if (typeof payload.matched === "number") return `${payload.matched} matched`;
  if (payload.document) return "1 document written";
  if (payload.error) return String(payload.error);
  return "ok";
}

export function DemoStage({ className }: { className?: string }) {
  const [activeId, setActiveId] = useState<DemoId>(DEMOS[0].id);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [showCode, setShowCode] = useState(false);
  const [generation, setGeneration] = useState(0);
  const counter = useRef(0);

  const demo = useMemo<DemoApp>(() => DEMOS.find((entry) => entry.id === activeId) ?? DEMOS[0], [activeId]);
  const document = useMemo(() => demoDocument(demo), [demo]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const payload = event.data as Record<string, unknown> | null;
      if (!payload || payload.source !== "localme-demo") return;
      counter.current += 1;
      const entry: LogEntry = {
        id: counter.current,
        method: String(payload.method ?? "POST"),
        path: String(payload.path ?? "/api/db"),
        status: Number(payload.status ?? 200),
        ms: Number(payload.ms ?? 0),
        request: (payload.request as Record<string, unknown>) ?? {},
        response: (payload.response as Record<string, unknown>) ?? {},
      };
      setLog((previous) => [entry, ...previous].slice(0, 40));
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const reset = useCallback(() => {
    setLog([]);
    counter.current = 0;
    setGeneration((value) => value + 1);
  }, []);

  const selectDemo = useCallback((id: DemoId) => {
    setActiveId(id);
    setLog([]);
    counter.current = 0;
    setGeneration((value) => value + 1);
  }, []);

  const failures = log.filter((entry) => entry.status >= 400).length;
  const average = log.length ? Math.round(log.reduce((sum, entry) => sum + entry.ms, 0) / log.length) : 0;

  return (
    <div className={cn("w-full", className)}>
      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Example applications"
        className="flex gap-1.5 overflow-x-auto rounded-xl border border-border bg-card/70 p-1.5 no-scrollbar"
      >
        {DEMOS.map((entry) => {
          const selected = entry.id === activeId;
          return (
            <button
              key={entry.id}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`demo-panel-${entry.id}`}
              onClick={() => selectDemo(entry.id)}
              className={cn(
                "tap flex min-h-10 flex-1 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-xs font-medium transition-colors",
                selected
                  ? "bg-secondary text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", selected ? "bg-signal" : "bg-muted-foreground/50")} />
              {entry.name}
            </button>
          );
        })}
      </div>

      {/* Stage */}
      <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card shadow-raised">
        <div className="flex items-center gap-2 border-b border-border bg-background/60 px-3 py-2.5">
          <span className="flex gap-1.5" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
          </span>
          <span className="ml-1 truncate font-mono text-[11px] text-muted-foreground">
            {siteUrlIsPublic ? `${siteUrl}/you/${demo.id}-app/` : `/{your-username}/${demo.id}-app/`}
          </span>
          <Badge variant="signal" className="ml-auto hidden sm:inline-flex">
            live sandbox
          </Badge>
        </div>

        <div
          id={`demo-panel-${demo.id}`}
          role="tabpanel"
          aria-label={`${demo.name} example`}
          className="bg-background"
        >
          <iframe
            key={`${demo.id}-${generation}`}
            title={`${demo.name} — running LocalMe example app`}
            srcDoc={document}
            sandbox="allow-scripts"
            loading="lazy"
            className="h-[420px] w-full border-0 sm:h-[440px]"
          />
        </div>

        {/* Request inspector */}
        <div className="border-t border-border bg-card/60">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
            <span className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
              <Terminal className="h-3.5 w-3.5 text-signal" />
              requests
            </span>
            <span className="font-mono text-[11px] text-foreground tabular-nums">{log.length}</span>
            <span className="font-mono text-[11px] text-muted-foreground tabular-nums">avg {average || "—"} ms</span>
            {failures > 0 && (
              <span className="font-mono text-[11px] text-destructive tabular-nums">{failures} failed</span>
            )}
            <div className="ml-auto flex items-center gap-1.5">
              <Button variant="ghost" size="sm" onClick={() => setShowCode((value) => !value)}>
                <Code2 className="h-3.5 w-3.5" />
                {showCode ? "Hide source" : "View source"}
              </Button>
              <Button variant="ghost" size="sm" onClick={reset}>
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </Button>
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto border-t border-border scrollbar-thin">
            {log.length === 0 ? (
              <p className="px-3 py-4 text-xs text-muted-foreground">
                This is a real app. Add a task, sign the guestbook or cast a vote — every request it makes lands here.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {log.map((entry) => (
                  <li key={entry.id} className="animate-fade-in px-3 py-2">
                    <details className="group">
                      <summary className="flex cursor-pointer list-none items-center gap-2 font-mono text-[11px]">
                        <span
                          className={cn(
                            "inline-flex h-4 w-4 items-center justify-center rounded",
                            entry.status >= 400 ? "bg-destructive/15 text-destructive" : "bg-emerald-500/15 text-emerald-500",
                          )}
                          aria-hidden
                        >
                          {entry.status >= 400 ? "!" : "✓"}
                        </span>
                        <span className="text-foreground">{entry.method}</span>
                        <span className="truncate text-muted-foreground">{entry.path}</span>
                        <span className={cn("tabular-nums", entry.status >= 400 ? "text-destructive" : "text-emerald-500")}>
                          {entry.status}
                        </span>
                        <span className="ml-auto shrink-0 text-muted-foreground tabular-nums">{entry.ms} ms</span>
                      </summary>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <JsonBlock label="request" value={entry.request} />
                        <JsonBlock label="response" value={entry.response} />
                      </div>
                    </details>
                    <p className="mt-1 pl-6 text-[11px] text-muted-foreground">{summarize(entry.response)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {showCode && (
            <div className="border-t border-border">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                  {demo.path} · app code — styles are added when you save it
                </span>
                <CopyButton text={demo.html} />
              </div>
              <pre className="max-h-64 overflow-auto border-t border-border px-3 py-3 font-mono text-[11px] leading-5 text-muted-foreground scrollbar-thin">
                <code>{demo.html.trim()}</code>
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Handoff */}
      <div className="mt-3 flex flex-col gap-3 rounded-xl border border-signal/30 bg-signal/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 shrink-0 text-signal" />
            Keep this app — it takes one click
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Create a free account and LocalMe creates the project, writes <span className="font-mono text-foreground">{demo.path}</span>{" "}
            with the exact file above and hands you the live URL.
          </p>
        </div>
        <Button
          variant="signal"
          onClick={() => stageDemoImport(demo.id)}
          className="tap w-full shrink-0 sm:w-auto"
          asChild
        >
          <Link to={`/auth?mode=signup&import=${demo.id}`}>
            Get this app
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function JsonBlock({ label, value }: { label: string; value: Record<string, unknown> }) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-background/60">
      <div className="border-b border-border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <pre className="max-h-32 overflow-auto px-2 py-1.5 font-mono text-[10.5px] leading-4 text-muted-foreground scrollbar-thin">
        <code>{JSON.stringify(value, null, 2)}</code>
      </pre>
    </div>
  );
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          /* clipboard blocked */
        }
      }}
    >
      {copied ? "Copied" : label}
    </Button>
  );
}
