import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type DispatchFilters = {
  hasHydrated: boolean;
  dateRangeFrom: string | null;
  dateRangeTo: string | null;

  setHasHydrated: (value: boolean) => void;
  setDateRange: (from: string | null, to: string | null) => void;
  reset: () => void;
};

const initialState = {
  hasHydrated: false,
  dateRangeFrom: null as string | null,
  dateRangeTo: null as string | null,
};

export const useDispatchFilters = create<DispatchFilters>()(
  persist(
    (set) => ({
      ...initialState,
      setHasHydrated: (value) => set({ hasHydrated: value }),
      setDateRange: (from, to) => set({ dateRangeFrom: from, dateRangeTo: to }),
      reset: () => set(initialState),
    }),
    {
      name: "dispatch_filters_v1",
      storage: createJSONStorage(() => sessionStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      partialize: (state) => ({
        dateRangeFrom: state.dateRangeFrom,
        dateRangeTo: state.dateRangeTo,
      }),
    }
  )
);
