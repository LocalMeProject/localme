import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConvexProvider } from "convex/react";
import { Toaster } from "sonner";
import { App } from "@/App";
import { convex, convexConfigured } from "@/lib/convex";
import "./index.css";

const container = document.getElementById("root");
if (!container) throw new Error("Root container missing in index.html");

function ConfigurationNotice() {
  return (
    <div className="blueprint-grid flex min-h-screen items-center justify-center px-6">
      <div className="panel max-w-lg p-6">
        <div className="mono-label mb-2">configuration required</div>
        <h1 className="text-lg font-semibold tracking-tight">The platform backend is not connected</h1>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          This build has no <span className="font-mono text-foreground">VITE_CONVEX_URL</span>. In development the Convex
          dev process writes it to <span className="font-mono text-foreground">.env.local</span> automatically. For a
          production deployment, set <span className="font-mono text-foreground">VITE_CONVEX_URL</span> (and optionally{" "}
          <span className="font-mono text-foreground">VITE_CONVEX_SITE_URL</span>) in the hosting environment variables,
          then redeploy.
        </p>
      </div>
    </div>
  );
}

createRoot(container).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      <BrowserRouter>
        {convexConfigured ? <App /> : <ConfigurationNotice />}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "hsl(var(--card))",
              color: "hsl(var(--card-foreground))",
              border: "1px solid hsl(var(--border))",
              fontSize: "13px",
            },
          }}
        />
      </BrowserRouter>
    </ConvexProvider>
  </StrictMode>,
);
