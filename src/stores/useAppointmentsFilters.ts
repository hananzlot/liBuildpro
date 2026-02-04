import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type SortColumn = 'contact' | 'start' | 'status' | 'rep' | 'address' | 'source' | 'oppStatus' | 'oppValue' | 'stage';
type SortDirection = 'asc' | 'desc';

type StoredDateRange = { from?: string; to?: string } | null;

type AppointmentsFilters = {
  hasHydrated: boolean;
  dateRange: StoredDateRange;
  statusFilter: string[];
  repFilter: string[];
  sourceFilter: string[];
  oppStatusFilter: string[];
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  currentPage: number;

  setHasHydrated: (value: boolean) => void;
  setDateRange: (from?: Date, to?: Date) => void;
  setStatusFilter: (value: string[]) => void;
  setRepFilter: (value: string[]) => void;
  setSourceFilter: (value: string[]) => void;
  setOppStatusFilter: (value: string[]) => void;
  setSort: (column: SortColumn, direction: SortDirection) => void;
  setCurrentPage: (page: number) => void;
  clearFilters: () => void;
  reset: () => void;
};

// Default to "today" for date range
function getDefaultDateRange(): StoredDateRange {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
  return { from: start.toISOString(), to: end.toISOString() };
}

const initialState = {
  hasHydrated: false,
  dateRange: getDefaultDateRange(),
  statusFilter: [] as string[],
  repFilter: [] as string[],
  sourceFilter: [] as string[],
  oppStatusFilter: [] as string[],
  sortColumn: "start" as SortColumn,
  sortDirection: "desc" as SortDirection,
  currentPage: 1,
};

export const useAppointmentsFilters = create<AppointmentsFilters>()(
  persist(
    (set) => ({
      ...initialState,
      setHasHydrated: (value) => set({ hasHydrated: value }),
      setDateRange: (from, to) =>
        set({
          dateRange: from
            ? { from: from.toISOString(), to: to ? to.toISOString() : undefined }
            : null,
        }),
      setStatusFilter: (value) => set({ statusFilter: value }),
      setRepFilter: (value) => set({ repFilter: value }),
      setSourceFilter: (value) => set({ sourceFilter: value }),
      setOppStatusFilter: (value) => set({ oppStatusFilter: value }),
      setSort: (column, direction) => set({ sortColumn: column, sortDirection: direction }),
      setCurrentPage: (page) => set({ currentPage: page }),
      clearFilters: () =>
        set({
          statusFilter: [],
          repFilter: [],
          sourceFilter: [],
          oppStatusFilter: [],
          currentPage: 1,
        }),
      reset: () => set(initialState),
    }),
    {
      name: "appointments_filters_v1",
      storage: createJSONStorage(() => sessionStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      partialize: (state) => ({
        dateRange: state.dateRange,
        statusFilter: state.statusFilter,
        repFilter: state.repFilter,
        sourceFilter: state.sourceFilter,
        oppStatusFilter: state.oppStatusFilter,
        sortColumn: state.sortColumn,
        sortDirection: state.sortDirection,
        currentPage: state.currentPage,
      }),
    }
  )
);
