import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Copy, FilePlus2, Layers, Loader2, Trash2, Upload } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { MeterBar } from "@/components/stat-card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { errorText } from "@/lib/errors";
import { formatBytes, fromNow } from "@/lib/format";
import { useSessionStore } from "@/lib/session";
import { uploadToStorageUrl } from "@/lib/upload";

type LibraryEntry = {
  id: string;
  path: string;
  name: string;
  size: number;
  contentType: string;
  updatedAt: number;
};

export function LibraryManager({ className }: { className?: string }) {
  const token = useSessionStore((state) => state.token) ?? "";
  const listing = useQuery(api.storage.libraryList, token ? { token } : "skip");
  const uploadUrl = useMutation(api.storage.libraryUploadUrl);
  const registerUpload = useMutation(api.storage.libraryRegisterUpload);
  const libraryWrite = useMutation(api.storage.libraryWrite);
  const libraryRemove = useMutation(api.storage.libraryRemove);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<LibraryEntry | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(timer);
  }, [notice]);

  const guard = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  };

  const entries: LibraryEntry[] = listing?.entries ?? [];

  const handleUpload = (files: FileList | null) =>
    guard(async () => {
      if (!files || files.length === 0) return;
      for (const item of Array.from(files)) {
        const url = await uploadUrl({ token });
        const storageId = await uploadToStorageUrl(url, item);
        await registerUpload({
          token,
          storageId: storageId as Id<"_storage">,
          name: item.name.replace(/[^A-Za-z0-9._-]/g, "-"),
          size: item.size,
          contentType: item.type || undefined,
        });
      }
      setNotice(`${files.length} asset(s) added`);
      if (fileInput.current) fileInput.current.value = "";
    });

  return (
    <div className={className}>
      <div className="space-y-5">
        {error && <Alert variant="destructive">{error}</Alert>}
        {notice && (
          <div className="flex items-center gap-2 text-[11px] text-signal">
            <span className="h-1.5 w-1.5 rounded-full bg-signal" />
            {notice}
          </div>
        )}

        <div className="panel p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="mono-label">library storage</span>
            <span className="font-mono text-muted-foreground">
              {formatBytes(listing?.used ?? 0)} of {formatBytes(listing?.bonus ?? 0)} bonus
            </span>
          </div>
          <MeterBar className="mt-2" value={listing?.used ?? 0} max={listing?.bonus ?? 1} tone="blueprint" />
          <p className="mt-2 text-[11px] text-muted-foreground">
            Library assets do not count against your project storage. Reference them from any project as{" "}
            <span className="font-mono text-foreground">/library/&lt;name&gt;</span>. HTML files are not allowed.
          </p>
        </div>

        <div className="panel">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
            <div>
              <div className="text-sm font-medium">Shared assets</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Stylesheets, scripts, fonts and images available to every project you own.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={busy} onClick={() => fileInput.current?.click()}>
                <Upload className="h-3.5 w-3.5" />
                Upload
              </Button>
              <Button
                variant="signal"
                size="sm"
                onClick={() => {
                  setNewName("");
                  setNewContent("");
                  setCreateOpen(true);
                }}
              >
                <FilePlus2 className="h-3.5 w-3.5" />
                New asset
              </Button>
              <input
                ref={fileInput}
                type="file"
                multiple
                hidden
                onChange={(event) => void handleUpload(event.target.files)}
              />
            </div>
          </div>

          {listing === undefined ? (
            <div className="space-y-2 p-5">
              {[0, 1, 2].map((index) => (
                <Skeleton key={index} className="h-8 w-full" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <EmptyState
              className="m-5"
              icon={Layers}
              title="Your library is empty"
              description="Upload a shared stylesheet or script, or move an existing project file into the library from the Storage tab."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="w-24 text-right">Size</TableHead>
                  <TableHead className="w-28 text-right">Updated</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div className="font-mono text-xs">{entry.name}</div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">{entry.contentType}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                          {entry.path}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Copy reference"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(entry.path);
                              setCopied(entry.id);
                              setTimeout(() => setCopied(null), 1400);
                            } catch {
                              /* clipboard unavailable */
                            }
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        {copied === entry.id && <span className="font-mono text-[10px] text-signal">copied</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-[11px] text-muted-foreground">
                      {formatBytes(entry.size)}
                    </TableCell>
                    <TableCell className="text-right text-[11px] text-muted-foreground">
                      {fromNow(entry.updatedAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Delete asset"
                          onClick={() => setDeleteTarget(entry)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New library asset</DialogTitle>
            <DialogDescription>
              Text files only. The asset becomes available at <span className="font-mono">/library/&lt;name&gt;</span>{" "}
              in every project.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="library-name">File name</Label>
              <Input
                id="library-name"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="theme.css"
                className="font-mono"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="library-content">Contents</Label>
              <Textarea
                id="library-content"
                rows={10}
                value={newContent}
                onChange={(event) => setNewContent(event.target.value)}
                className="font-mono text-[12px]"
                placeholder=":root { --brand: #16a34a; }"
              />
              <Badge variant="outline">{(newContent.length / 1024).toFixed(1)} KB</Badge>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="signal"
              disabled={busy || !newName.trim()}
              onClick={() =>
                guard(async () => {
                  await libraryWrite({ token, name: newName.trim(), content: newContent });
                  setCreateOpen(false);
                  setNotice(`${newName.trim()} saved to /library`);
                })
              }
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save asset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name ?? "asset"}?`}
        description="Projects referencing this asset will start returning 404 for it."
        confirmLabel="Delete asset"
        pending={busy}
        onConfirm={() =>
          guard(async () => {
            if (!deleteTarget) return;
            await libraryRemove({ token, name: deleteTarget.name });
            setNotice(`${deleteTarget.name} deleted`);
          })
        }
      />
    </div>
  );
}
