import { useEffect, useMemo, useRef, useState } from "react";
import { Check, FileCode2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function CodeEditor({
  path,
  value,
  language,
  dirty,
  saving,
  onChange,
  onSave,
  className,
}: {
  path: string;
  value: string;
  language: string;
  dirty: boolean;
  saving?: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
  className?: string;
}) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });

  const lineNumbers = useMemo(() => {
    const count = Math.max(value.split("\n").length, 1);
    return Array.from({ length: count }, (_item, index) => index + 1);
  }, [value]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        onSave();
      }
    };
    const node = areaRef.current;
    node?.addEventListener("keydown", handler);
    return () => node?.removeEventListener("keydown", handler);
  }, [onSave]);

  return (
    <div className={cn("flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <FileCode2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate font-mono text-xs">{path}</span>
          <Badge variant="outline">{language}</Badge>
          {dirty && <Badge variant="warning">unsaved</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden font-mono text-[10px] text-muted-foreground sm:block">
            Ln {cursor.line}, Col {cursor.column}
          </span>
          <Button size="sm" variant="signal" onClick={onSave} disabled={saving || !dirty}>
            {saving ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? "Saving" : "Save"}
          </Button>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1">
        <div className="select-none overflow-hidden border-r border-border bg-muted/30 px-2 py-2 text-right font-mono text-[11px] leading-5 text-muted-foreground/70">
          {lineNumbers.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
        <textarea
          ref={areaRef}
          value={value}
          spellCheck={false}
          onChange={(event) => {
            onChange(event.target.value);
            const upToCursor = event.target.value.slice(0, event.target.selectionStart);
            const lines = upToCursor.split("\n");
            setCursor({ line: lines.length, column: lines[lines.length - 1].length + 1 });
          }}
          onKeyUp={(event) => {
            const upToCursor = event.currentTarget.value.slice(0, event.currentTarget.selectionStart);
            const lines = upToCursor.split("\n");
            setCursor({ line: lines.length, column: lines[lines.length - 1].length + 1 });
          }}
          className="min-h-[380px] w-full flex-1 resize-none bg-transparent px-3 py-2 font-mono text-[12.5px] leading-5 outline-none scrollbar-thin"
        />
      </div>
    </div>
  );
}
