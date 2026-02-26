import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type SortColumn = 'project_number' | 'address' | 'status' | 'salesperson' | 'project_manager' | 'sold_amount' | 'est_proj_cost' | 'bills_received' | 'bills_paid' | 'inv_collected' | 'inv_balance' | 'proj_balance' | 'commission' | 'expected_profit' | 'total_cash';
type SortDirection = 'asc' | 'desc';

export type ColumnKey = 'salesperson' | 'source' | 'sold_amount' | 'est_proj_cost' | 'bills_received' | 'bills_paid' | 'inv_collected' | 'inv_balance' | 'proj_balance' | 'expected_profit' | 'total_cash';

type ProductionFilters = {
  hasHydrated: boolean;
  searchQuery: string;
  selectedStatuses: string[];
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  showAlternatingColors: boolean;
  showArchived: boolean;
  hiddenColumns: ColumnKey[];

  setHasHydrated: (value: boolean) => void;
  setSearchQuery: (value: string) => void;
  setSelectedStatuses: (value: string[]) => void;
  setSort: (column: SortColumn, direction: SortDirection) => void;
  setShowAlternatingColors: (value: boolean) => void;
  setShowArchived: (value: boolean) => void;
  setHiddenColumns: (value: ColumnKey[]) => void;
  toggleColumn: (column: ColumnKey) => void;
  reset: () => void;
};

const initialState = {
  hasHydrated: false,
  searchQuery: "",
  selectedStatuses: ["New Job", "In-Progress", "On-Hold", "Completed", "Cancelled"],
  sortColumn: "project_number" as SortColumn,
  sortDirection: "desc" as SortDirection,
  showAlternatingColors: true,
  showArchived: false,
  hiddenColumns: ["salesperson", "source"] as ColumnKey[],
};

export const useProductionFilters = create<ProductionFilters>()(
  persist(
    (set) => ({
      ...initialState,
      setHasHydrated: (value) => set({ hasHydrated: value }),
      setSearchQuery: (value) => set({ searchQuery: value }),
      setSelectedStatuses: (value) => set({ selectedStatuses: value }),
      setSort: (column, direction) => set({ sortColumn: column, sortDirection: direction }),
      setShowAlternatingColors: (value) => set({ showAlternatingColors: value }),
      setShowArchived: (value) => set({ showArchived: value }),
      setHiddenColumns: (value) => set({ hiddenColumns: value }),
      toggleColumn: (column) => set((state) => ({
        hiddenColumns: state.hiddenColumns.includes(column)
          ? state.hiddenColumns.filter(c => c !== column)
          : [...state.hiddenColumns, column],
      })),
      reset: () => set(initialState),
    }),
    {
      name: "production_filters_v1",
      storage: createJSONStorage(() => sessionStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      partialize: (state) => ({
        searchQuery: state.searchQuery,
        selectedStatuses: state.selectedStatuses,
        sortColumn: state.sortColumn,
        sortDirection: state.sortDirection,
        showAlternatingColors: state.showAlternatingColors,
        showArchived: state.showArchived,
        hiddenColumns: state.hiddenColumns,
      }),
    }
  )
);
