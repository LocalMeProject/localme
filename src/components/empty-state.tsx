import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "blueprint-grid-sm flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-14 text-center",
        className,
      )}
    >
      {Icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-card">
          <Icon className="h-5 w-5 text-signal" />
        </div>
      )}
      <div className="text-base font-semibold tracking-tight">{title}</div>
      {description && <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
