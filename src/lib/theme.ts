import { create } from "zustand";

type Theme = "light" | "dark";
const STORAGE_KEY = "localme.theme";

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function initialTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* ignore */
  }
  return "dark";
}

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  set: (theme: Theme) => void;
}

const initial = initialTheme();
applyTheme(initial);

export const useTheme = create<ThemeState>((set, get) => ({
  theme: initial,
  toggle: () => get().set(get().theme === "dark" ? "light" : "dark"),
  set: (theme) => {
    applyTheme(theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
    set({ theme });
  },
}));
