import { useMemo, useState } from "react";
import { Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function JsonField({
  label,
  value,
  onChange,
  rows = 6,
  placeholder,
  hint,
  className,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  hint?: string;
  className?: string;
}) {
  const [touched, setTouched] = useState(false);
  const error = useMemo(() => {
    if (!value.trim()) return null;
    try {
      JSON.parse(value);
      return null;
    } catch (parseError) {
      return parseError instanceof Error ? parseError.message : "Invalid JSON";
    }
  }, [value]);

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <div className="flex items-center justify-between">
          <Label>{label}</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px]"
            onClick={() => {
              try {
                onChange(JSON.stringify(JSON.parse(value), null, 2));
                setTouched(true);
              } catch {
                setTouched(true);
              }
            }}
          >
            <Wand2 className="h-3 w-3" />
            Format
          </Button>
        </div>
      )}
      <Textarea
        value={value}
        rows={rows}
        spellCheck={false}
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value);
          setTouched(true);
        }}
        className="font-mono text-[12.5px] leading-5"
      />
      {error && touched ? (
        <p className="font-mono text-[11px] text-destructive">{error}</p>
      ) : (
        hint && <p className="text-[11px] text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
