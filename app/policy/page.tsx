import Link from "next/link";
import { ArrowLeft, Shield, FileText } from "lucide-react";
import { BrandMark } from "@/components/logo";
import { CultureSwitch } from "@/components/culture-switch";
import { Button } from "@/components/ui/button";
import { getCachedMarkdown } from "@/lib/server/cached-markdown";
import { MarkdownViewer } from "@/components/markdown-viewer";
import { siteOrigin } from "@/lib/seo";

export const metadata = {
  title: "Policy & Terms of Service",
  description: "Terms of service, privacy policy, and autonomous AI agent usage guidelines for the LocalMe platform.",
  alternates: {
    canonical: `${siteOrigin()}/policy`,
  },
};

export default async function PolicyPage() {
  const { content, lastModified } = await getCachedMarkdown("content/policy.md");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-4 px-5">
          <div className="flex items-center gap-4">
            <Link href="/" aria-label="LocalMe">
              <BrandMark />
            </Link>
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="text-border">/</span>
              <span className="font-mono">policy</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <CultureSwitch />
            <Button variant="ghost" size="sm" asChild className="tap">
              <Link href="/">
                <ArrowLeft className="rtl-flip h-3.5 w-3.5" />
                <span className="ms-1.5">Home</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-5 py-10 sm:py-14">
        <div className="mb-8 flex items-center justify-between border-b border-border pb-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-signal/30 bg-signal/10 text-signal">
              <Shield className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Platform Policy & Terms</h1>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                Last modified: {new Date(lastModified).toLocaleDateString()}
              </p>
            </div>
          </div>

          <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">
            <Link href="/docs">
              <FileText className="h-3.5 w-3.5 me-1.5" />
              API Docs
            </Link>
          </Button>
        </div>

        <article className="rounded-xl border border-border bg-card p-6 sm:p-10 shadow-sm">
          <MarkdownViewer content={content} />
        </article>

        {/* Footer info */}
        <div className="mt-10 border-t border-border pt-6 text-center text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} LocalMe. Built by Sina Vali. Questions? Contact{" "}
            <a href="mailto:sina1vali@gmail.com" className="text-signal hover:underline">
              sina1vali@gmail.com
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
