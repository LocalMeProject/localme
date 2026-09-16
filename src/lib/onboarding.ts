import { create } from "zustand";

/**
 * First-run progress.
 *
 * Derived facts (account exists, a project exists) are computed from live data
 * by the caller; this store only records the two milestones that are about
 * behaviour rather than state — opening the file editor and configuring how the
 * app is served.
 */

export type Milestone = "editor" | "structure";

const STORAGE_KEY = "localme.onboarding";

interface Persisted {
  editor: boolean;
  structure: boolean;
  dismissed: boolean;
}

function read(): Persisted {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { editor: false, structure: false, dismissed: false };
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return {
      editor: Boolean(parsed.editor),
      structure: Boolean(parsed.structure),
      dismissed: Boolean(parsed.dismissed),
    };
  } catch {
    return { editor: false, structure: false, dismissed: false };
  }
}

interface OnboardingState extends Persisted {
  mark: (milestone: Milestone) => void;
  dismiss: () => void;
  reset: () => void;
}

function persist(state: Persisted) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private mode — progress simply resets next visit */
  }
}

export const useOnboarding = create<OnboardingState>((set, get) => ({
  ...read(),
  mark: (milestone) => {
    if (get()[milestone]) return;
    const next = { ...get(), [milestone]: true };
    persist(next);
    set({ [milestone]: true } as Partial<OnboardingState>);
  },
  dismiss: () => {
    persist({ ...get(), dismissed: true });
    set({ dismissed: true });
  },
  reset: () => {
    const next = { editor: false, structure: false, dismissed: false };
    persist(next);
    set(next);
  },
}));

/** Records a milestone from anywhere in the console. */
export function markMilestone(milestone: Milestone) {
  useOnboarding.getState().mark(milestone);
}
