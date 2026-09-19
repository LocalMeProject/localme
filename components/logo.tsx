import { cn } from "@/lib/utils";

export function Logo({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="7" fill="hsl(var(--ink))" />
      <path d="M9 22V10h3.2v9.2H22V22z" fill="hsl(var(--signal))" />
      <circle cx="23.5" cy="10.5" r="2.4" fill="hsl(var(--blueprint))" />
    </svg>
  );
}

export function BrandMark({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <Logo size={26} />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="text-sm font-semibold tracking-tight">LocalMe</span>
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
            backend as a service
          </span>
        </span>
      )}
    </span>
  );
}
