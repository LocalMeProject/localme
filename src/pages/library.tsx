import { useQuery } from "convex/react";
import { Layers } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { LibraryManager } from "@/components/library-manager";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { formatBytes } from "@/lib/format";
import { useSessionStore } from "@/lib/session";

export function LibraryPage() {
  const token = useSessionStore((state) => state.token) ?? "";
  const overview = useQuery(api.accounts.overview, token ? { token } : "skip");
  const listing = useQuery(api.storage.libraryList, token ? { token } : "skip");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="shared storage"
        title="Library"
        description="Assets that live outside any single project and can be referenced from all of them at /library/<name>."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Assets" value={listing?.entries.length ?? "—"} icon={Layers} tone="blueprint" />
        <StatCard
          label="Library used"
          value={listing ? formatBytes(listing.used) : "—"}
          hint={listing ? `of ${formatBytes(listing.bonus)} bonus allowance` : undefined}
        />
        <StatCard
          label="Account storage"
          value={overview ? formatBytes(overview.storage.used) : "—"}
          hint={overview ? `of ${formatBytes(overview.storage.cap)} total` : undefined}
          tone="signal"
        />
      </div>

      <LibraryManager />
    </div>
  );
}
