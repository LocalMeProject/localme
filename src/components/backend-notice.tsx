import { Link } from "react-router-dom";
import { ArrowLeft, Database, ExternalLink, Terminal } from "lucide-react";
import { BrandMark } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * Shown in place of console screens when the build has no backend that a
 * visitor's browser can reach. Public screens (landing page, live demo, docs)
 * are unaffected, so this only ever replaces the parts that genuinely need data.
 */
export function BackendNotice() {
  return (
    <div className="blueprint-grid flex min-h-[70vh] items-center justify-center px-5 py-12">
      <div className="panel w-full max-w-2xl p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <BrandMark />
          <Badge variant="warning">backend not connected</Badge>
        </div>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight">
          This deployment is not connected to a backend yet
        </h1>
        <p className="copy mt-3">
          Freebuff hosting serves the console and the marketing site, but the platform data — accounts, projects,
          documents, files and the REST API — lives in a Convex deployment. This build was compiled with a development
          address that only resolves inside the build sandbox, so browsers cannot reach it.
        </p>

        <div className="mt-6 rounded-lg border border-border bg-background/60 p-4">
          <div className="flex items-center gap-2 text-[13px] font-medium">
            <Database className="h-4 w-4 text-signal" />
            To finish the setup
          </div>
          <ol className="mt-3 space-y-2 text-[12.5px] leading-relaxed text-muted-foreground">
            <li>
              1. Create or open a Convex deployment that is reachable from the internet (the free tier is enough) and
              run <span className="font-mono text-foreground">bun convex dev</span> once to link it.
            </li>
            <li>
              2. Add both keys in <span className="text-foreground">Settings → Environment</span>:{" "}
              <span className="font-mono text-foreground">VITE_CONVEX_URL</span> and{" "}
              <span className="font-mono text-foreground">VITE_CONVEX_SITE_URL</span>.
            </li>
            <li>3. Redeploy — the build inlines those values, so they take effect on the next deploy.</li>
          </ol>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Button variant="signal" asChild>
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
              Back to the site
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <a href="/#demo">
              <Terminal className="h-4 w-4" />
              Play with the live demo
            </a>
          </Button>
          <span className="ml-1 text-[11.5px] text-muted-foreground">
            The demo runs entirely in your browser — no backend required.
          </span>
        </div>

        <p className="mt-5 flex items-start gap-2 border-t border-border pt-4 text-[11.5px] leading-relaxed text-muted-foreground">
          <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Until then, every public page and the in-browser demo work normally. Only accounts and project data are
          unavailable.
        </p>
      </div>
    </div>
  );
}
