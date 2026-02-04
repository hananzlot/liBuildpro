import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { DateRange } from "react-day-picker";

type OpportunitiesFilters = {
  dateField: "updatedDate" | "createdDate";
  dateRange: DateRange | undefined;
  showAlternatingColors: boolean;
  setDateField: (value: "updatedDate" | "createdDate") => void;
  setDateRange: (range: DateRange | undefined) => void;
  setShowAlternatingColors: (value: boolean) => void;
  reset: () => void;
};

const initialState = {
  dateField: "updatedDate" as const,
  dateRange: undefined as DateRange | undefined,
  showAlternatingColors: true,
};

export const useOpportunitiesFilters = create<OpportunitiesFilters>()(
  persist(
    (set) => ({
      ...initialState,
      setDateField: (value) => set({ dateField: value }),
      setDateRange: (range) => set({ dateRange: range }),
      setShowAlternatingColors: (value) => set({ showAlternatingColors: value }),
      reset: () => set(initialState),
    }),
    {
      name: "opportunities_filters_v1",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        dateField: state.dateField,
        dateRange: state.dateRange,
        showAlternatingColors: state.showAlternatingColors,
      }),
    }
  )
);
