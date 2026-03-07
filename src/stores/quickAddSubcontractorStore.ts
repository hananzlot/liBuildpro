import { create } from "zustand";

export interface QuickAddSubDraft {
  companyName: string;
  contactName: string;
  phone: string;
  subType: string;
}

const DEFAULT_DRAFT: QuickAddSubDraft = {
  companyName: "",
  contactName: "",
  phone: "",
  subType: "Subcontractor",
};

interface QuickAddSubStore {
  draft: QuickAddSubDraft;
  hasDraft: boolean;
  updateDraft: (partial: Partial<QuickAddSubDraft>) => void;
  clearDraft: () => void;
}

export const useQuickAddSubStore = create<QuickAddSubStore>((set) => ({
  draft: { ...DEFAULT_DRAFT },
  hasDraft: false,
  updateDraft: (partial) =>
    set((state) => ({
      draft: { ...state.draft, ...partial },
      hasDraft: true,
    })),
  clearDraft: () =>
    set({ draft: { ...DEFAULT_DRAFT }, hasDraft: false }),
}));
