import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { DateRange } from "react-day-picker";

type SortColumn = "name" | "stage" | "value" | "status" | "source" | "createdDate" | "updatedDate";
type SortDirection = "asc" | "desc";

type StoredDateRange = { from?: string; to?: string } | null;

type OpportunitiesFilters = {
  hasHydrated: boolean;
  dateField: "updatedDate" | "createdDate";
  /** Stored as ISO strings so sessionStorage persistence is stable. */
  dateRange: StoredDateRange;
  showAlternatingColors: boolean;

  stageFilter: string[];
  sourceFilter: string[];
  statusFilter: string[];
  appointmentFilter: "all" | "with" | "without";
  salesRepFilter: string[];
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  currentPage: number;

  setHasHydrated: (value: boolean) => void;
  setDateField: (value: "updatedDate" | "createdDate") => void;
  setDateRange: (range: DateRange | undefined) => void;
  setShowAlternatingColors: (value: boolean) => void;

  setStageFilter: (value: string[]) => void;
  setSourceFilter: (value: string[]) => void;
  setStatusFilter: (value: string[]) => void;
  setAppointmentFilter: (value: "all" | "with" | "without") => void;
  setSalesRepFilter: (value: string[]) => void;
  setSort: (column: SortColumn, direction: SortDirection) => void;
  setCurrentPage: (page: number) => void;
  clearTableFilters: () => void;

  reset: () => void;
};

const initialState = {
  hasHydrated: false,
  dateField: "updatedDate" as const,
  dateRange: null as StoredDateRange,
  showAlternatingColors: true,

  stageFilter: [] as string[],
  sourceFilter: [] as string[],
  statusFilter: [] as string[],
  appointmentFilter: "all" as const,
  salesRepFilter: [] as string[],
  sortColumn: "updatedDate" as const,
  sortDirection: "desc" as const,
  currentPage: 1,
};

export const useOpportunitiesFilters = create<OpportunitiesFilters>()(
  persist(
    (set) => ({
      ...initialState,
      setHasHydrated: (value) => set({ hasHydrated: value }),
      setDateField: (value) => set({ dateField: value, currentPage: 1 }),
      setDateRange: (range) =>
        set({
          dateRange: range?.from
            ? {
                from: range.from.toISOString(),
                to: range.to ? range.to.toISOString() : undefined,
              }
            : null,
        }),
      setShowAlternatingColors: (value) => set({ showAlternatingColors: value }),

      setStageFilter: (value) => set({ stageFilter: value }),
      setSourceFilter: (value) => set({ sourceFilter: value }),
      setStatusFilter: (value) => set({ statusFilter: value }),
      setAppointmentFilter: (value) => set({ appointmentFilter: value }),
      setSalesRepFilter: (value) => set({ salesRepFilter: value }),
      setSort: (column, direction) => set({ sortColumn: column, sortDirection: direction }),
      setCurrentPage: (page) => set({ currentPage: page }),
      clearTableFilters: () =>
        set({
          stageFilter: [],
          sourceFilter: [],
          statusFilter: [],
          appointmentFilter: "all",
          salesRepFilter: [],
          currentPage: 1,
        }),
      reset: () => set(initialState),
    }),
    {
      name: "opportunities_filters_v1",
      storage: createJSONStorage(() => sessionStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      partialize: (state) => ({
        dateField: state.dateField,
        dateRange: state.dateRange,
        showAlternatingColors: state.showAlternatingColors,

        stageFilter: state.stageFilter,
        sourceFilter: state.sourceFilter,
        statusFilter: state.statusFilter,
        appointmentFilter: state.appointmentFilter,
        salesRepFilter: state.salesRepFilter,
        sortColumn: state.sortColumn,
        sortDirection: state.sortDirection,
        currentPage: state.currentPage,
      }),
    }
  )
);
