import { BookOpen } from "lucide-react";
import { useProject } from "@/components/project-layout";
import { LibraryManager } from "@/components/library-manager";
import { siteUrl } from "@/lib/convex";

export function ProjectLibrary() {
  const { project } = useProject();

  return (
    <div className="space-y-5">
      <div className="panel flex flex-wrap items-start gap-4 p-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-blueprint/40 bg-blueprint/10">
          <BookOpen className="h-4 w-4 text-blueprint" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">Shared across every project you own</div>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            This is your account library, not project storage. Files here are served from{" "}
            <span className="font-mono text-foreground">
              {siteUrl}/{project.ownerUsername}/{project.name}/library/&lt;name&gt;
            </span>{" "}
            and never count against this project's 5 MB. Move a project file into the library with the{" "}
            <span className="font-mono text-foreground">Move to library</span> action on the Storage tab.
          </p>
          <pre className="mt-3 overflow-auto rounded-md border border-border bg-card px-3 py-2 font-mono text-[11px] text-muted-foreground scrollbar-thin">
            <code>{`<link rel="stylesheet" href="/library/theme.css">
<script src="/library/analytics.js"></script>`}</code>
          </pre>
        </div>
      </div>

      <LibraryManager />
    </div>
  );
}
