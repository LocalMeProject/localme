import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n/client";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  confirmWord,
  danger = true,
  onConfirm,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  /** Defaults to the translated "Confirm". */
  confirmLabel?: string;
  confirmWord?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  pending?: boolean;
}) {
  const [typed, setTyped] = useState("");
  const { t } = useI18n();
  const blocked = Boolean(confirmWord) && typed !== confirmWord;
  const label = confirmLabel ?? t("action.confirm");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setTyped("");
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg border border-destructive/40 bg-destructive/10">
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </div>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {confirmWord && (
          <div className="space-y-2">
            <Label htmlFor="confirm-word">
              {t("confirm.typeWord", { word: confirmWord })}
            </Label>
            <Input
              id="confirm-word"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              placeholder={confirmWord}
              autoComplete="off"
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("action.cancel")}
          </Button>
          <Button
            variant={danger ? "destructive" : "default"}
            disabled={blocked || pending}
            onClick={async () => {
              await onConfirm();
              setTyped("");
              onOpenChange(false);
            }}
          >
            {pending ? t("action.working") : label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
