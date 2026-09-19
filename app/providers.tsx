"use client";

import { useEffect } from "react";
import { useTheme } from "@/lib/theme";

/** Client-only glue that must run inside the React tree. */
export function Providers({ children }: { children: React.ReactNode }) {
  const setTheme = useTheme((state) => state.set);

  useEffect(() => {
    // Re-apply persisted theme after hydration so toggles stay in sync.
    try {
      const stored = window.localStorage.getItem("localme.theme");
      setTheme(stored === "light" ? "light" : "dark");
    } catch {
      /* ignore */
    }
  }, [setTheme]);

  return <>{children}</>;
}
