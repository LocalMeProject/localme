import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandMark } from "@/components/logo";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {

  return (
    <div className="blueprint-grid flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <BrandMark />
      <div>
        <div className="font-mono text-5xl font-semibold text-signal">404</div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">This route does not exist in the console.</h1>
        <p className="mt-2 max-w-md text-[13px] leading-relaxed text-muted-foreground">
          Project pages are served from the hosting origin, not from here. Check the URL, or head back to your
          workspace.
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="signal" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to projects
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Home</Link>
        </Button>
      </div>
    </div>
  );
}
