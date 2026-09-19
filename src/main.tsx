import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConvexProvider } from "convex/react";
import { Toaster } from "sonner";
import { App } from "@/App";
import { convex } from "@/lib/convex";
import "./index.css";

const container = document.getElementById("root");
if (!container) throw new Error("Root container missing in index.html");

createRoot(container).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      <BrowserRouter>
        {/*
          Public screens (landing page, live demo, docs) render even when no
          backend is reachable. Screens that need data show <BackendNotice />
          instead of failing silently — see RequireAuth and the auth page.
        */}
        <App />
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
