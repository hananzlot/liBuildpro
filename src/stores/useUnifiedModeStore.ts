import { create } from "zustand";

interface UnifiedModeStore {
  isUnified: boolean;
  toggleUnified: () => void;
  setUnified: (value: boolean) => void;
}

export const useUnifiedModeStore = create<UnifiedModeStore>((set) => ({
  isUnified: typeof window !== "undefined"
    ? sessionStorage.getItem("unified_mode") === "true"
    : false,
  toggleUnified: () =>
    set((state) => {
      const next = !state.isUnified;
      sessionStorage.setItem("unified_mode", String(next));
      return { isUnified: next };
    }),
  setUnified: (value: boolean) => {
    sessionStorage.setItem("unified_mode", String(value));
    set({ isUnified: value });
  },
}));
