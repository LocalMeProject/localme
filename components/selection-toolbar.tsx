"use client";

import { CheckSquare, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/**
 * A "N selected" action bar for multi-select tables.
 *
 * The bar only appears while something is selected, and it is where every bulk
 * action lives — so a destructive bulk action is never one keystroke away from an
 * unselected table.
 */
export function SelectionToolbar({
  selected,
  onClear,
  children,
  noun = "row",
  className,
}: {
  selected: string[];
  onClear: () => void;
  children?: React.ReactNode;
  noun?: string;
  className?: string;
}) {
  if (selected.length === 0) return null;
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 border-b border-signal/30 bg-signal/[0.06] px-3 py-2",
        className,
      )}
      role="region"
      aria-label={`${selected.length} ${noun} selected`}
    >
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-[12px]"
        onClick={onClear}
        title="Clear selection"
      >
        <X className="h-3.5 w-3.5" />
        Clear
      </Button>
      <span className="text-[12px] font-medium tabular-nums">
        {selected.length} {noun}{selected.length === 1 ? "" : "s"} selected
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

/**
 * Header checkbox that selects or clears every row on the page.
 *
 * `allSelected` overrides the derived state for tables whose selection can
 * contain rows that are not currently visible — a filtered file list or secret
 * list, where comparing counts against the visible total would claim "all" when
 * some hidden rows are actually unchecked.
 */
export function SelectAllCheckbox({
  selected,
  total,
  onToggle,
  label,
  allSelected,
  hiddenSelected = 0,
}: {
  selected: string[];
  total: number;
  onToggle: (selectAll: boolean) => void;
  label: string;
  allSelected?: boolean;
  hiddenSelected?: number;
}) {
  const all = allSelected ?? (total > 0 && selected.length === total);
  const some = !all && (selected.length > 0 || hiddenSelected > 0);
  return (
    <span className="flex items-center gap-2" title={label}>
      <Checkbox
        checked={all ? true : some ? "indeterminate" : false}
        onCheckedChange={(checked) => onToggle(checked === true)}
        aria-label={label}
      />
      {some && <span className="font-mono text-[10px] text-muted-foreground">{selected.length}</span>}
    </span>
  );
}

/** Compact two-state icon used where a full checkbox would be too heavy. */
export function RowCheckbox({
  id,
  selected,
  onToggle,
}: {
  id: string;
  selected: string[];
  onToggle: (id: string, next: boolean) => void;
}) {
  const checked = selected.includes(id);
  return (
    <span className="flex items-center gap-2">
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onToggle(id, value === true)}
        aria-label={`Select ${id}`}
      />
      {checked ? (
        <CheckSquare className="h-3.5 w-3.5 text-signal sm:hidden" aria-hidden />
      ) : (
        <Square className="h-3.5 w-3.5 text-muted-foreground sm:hidden" aria-hidden />
      )}
    </span>
  );
}