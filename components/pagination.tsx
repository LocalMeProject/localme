"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

/**
 * Page control for a server-paged list.
 *
 * Paging happens in SQL (see /api/admin/users and /api/admin/projects), so this
 * renders a real window of pages rather than slicing an already-loaded array.
 */
export function Pagination({
  state,
  onPageChange,
  onPageSizeChange,
  className,
  label = "rows",
}: {
  state: PaginationState;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  className?: string;
  label?: string;
}) {
  const pages = Math.max(1, Math.ceil(state.total / Math.max(1, state.pageSize)));
  const page = Math.min(Math.max(1, state.page), pages);
  const from = state.total === 0 ? 0 : (page - 1) * state.pageSize + 1;
  const to = Math.min(state.total, page * state.pageSize);

  // Windowed page numbers: first, last, and a run around the current page.
  const numbers: (number | "gap")[] = [];
  for (let index = 1; index <= pages; index += 1) {
    if (index === 1 || index === pages || Math.abs(index - page) <= 1) numbers.push(index);
    else if (numbers[numbers.length - 1] !== "gap") numbers.push("gap");
  }

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 px-3 py-2.5", className)}>
      <span className="text-[11.5px] text-muted-foreground tabular-nums">
        {state.total === 0 ? "Nothing to show" : `${from}–${to} of ${state.total} ${label}`}
      </span>
      <div className="flex items-center gap-1.5">
        {onPageSizeChange && (
          <select
            aria-label="Rows per page"
            value={state.pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="h-8 rounded-md border border-border bg-background px-2 text-[12px] text-muted-foreground"
          >
            {[10, 25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </select>
        )}
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        {numbers.map((entry, index) =>
          entry === "gap" ? (
            <span key={`gap-${index}`} className="px-1 text-[12px] text-muted-foreground">
              …
            </span>
          ) : (
            <Button
              key={entry}
              variant={entry === page ? "secondary" : "ghost"}
              size="icon-sm"
              aria-current={entry === page ? "page" : undefined}
              onClick={() => onPageChange(entry)}
              className="tabular-nums"
            >
              {entry}
            </Button>
          ),
        )}
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Next page"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}