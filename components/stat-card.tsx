import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "default" | "signal" | "blueprint";
  className?: string;
}) {
  return (
    <div className={cn("panel p-5", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="mono-label">{label}</div>
        {Icon && (
          <Icon
            className={cn(
              "h-4 w-4",
              tone === "signal" ? "text-signal" : tone === "blueprint" ? "text-blueprint" : "text-muted-foreground",
            )}
          />
        )}
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
      {hint && <div className="mt-1.5 text-[11.5px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function MeterBar({
  value,
  max,
  tone = "signal",
  className,
}: {
  value: number;
  max: number;
  tone?: "signal" | "blueprint" | "destructive";
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className={cn(
          "h-full rounded-full transition-all",
          tone === "signal" ? "bg-signal" : tone === "blueprint" ? "bg-blueprint" : "bg-destructive",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
