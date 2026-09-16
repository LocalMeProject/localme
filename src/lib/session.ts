import { create } from "zustand";

const STORAGE_KEY = "localme.session";

function readStoredToken(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

interface SessionState {
  token: string | null;
  setToken: (token: string | null) => void;
  clear: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  token: readStoredToken(),
  setToken: (token) => {
    try {
      if (token) window.localStorage.setItem(STORAGE_KEY, token);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage may be unavailable; the session still works for this tab */
    }
    set({ token });
  },
  clear: () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    set({ token: null });
  },
}));

export function currentToken(): string | null {
  return useSessionStore.getState().token;
}
