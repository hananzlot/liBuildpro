import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type AnalyticsFilters = {
  hasHydrated: boolean;
  activeTab: string;
  dateRangeFrom: string | null;
  dateRangeTo: string | null;
  selectedProjects: string[];
  selectedSalespeople: string[];

  setHasHydrated: (value: boolean) => void;
  setActiveTab: (value: string) => void;
  setDateRange: (from: string | null, to: string | null) => void;
  setSelectedProjects: (value: string[]) => void;
  setSelectedSalespeople: (value: string[]) => void;
  reset: () => void;
};

const initialState = {
  hasHydrated: false,
  activeTab: "",
  dateRangeFrom: null as string | null,
  dateRangeTo: null as string | null,
  selectedProjects: [] as string[],
  selectedSalespeople: [] as string[],
};

export const useAnalyticsFilters = create<AnalyticsFilters>()(
  persist(
    (set) => ({
      ...initialState,
      setHasHydrated: (value) => set({ hasHydrated: value }),
      setActiveTab: (value) => set({ activeTab: value }),
      setDateRange: (from, to) => set({ dateRangeFrom: from, dateRangeTo: to }),
      setSelectedProjects: (value) => set({ selectedProjects: value }),
      setSelectedSalespeople: (value) => set({ selectedSalespeople: value }),
      reset: () => set(initialState),
    }),
    {
      name: "analytics_filters_v1",
      storage: createJSONStorage(() => sessionStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      partialize: (state) => ({
        activeTab: state.activeTab,
        dateRangeFrom: state.dateRangeFrom,
        dateRangeTo: state.dateRangeTo,
        selectedProjects: state.selectedProjects,
        selectedSalespeople: state.selectedSalespeople,
      }),
    }
  )
);
