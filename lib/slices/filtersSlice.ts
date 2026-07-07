import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { SortingState, ColumnSizingState, VisibilityState } from "@tanstack/react-table";

type DeadlinePreset = "thisWeek" | "thisMonth" | "thisYear";

interface FiltersState {
  exclusionFilter: string | null;
  deadlinePreset: DeadlinePreset | null;
  deadlineDateFrom: string | null;
  deadlineDateTo: string | null;
  globalFilter: string;
  sorting: SortingState;
  columnVisibility: VisibilityState;
  columnSizing: ColumnSizingState;
  typeFilter: "all" | "Gem" | "Non-Gem";
  aiRelevanceFilter: "all" | "yes" | "no";
  showFilterTray: boolean;
}

const initialState: FiltersState = {
  exclusionFilter: null,
  deadlinePreset: null,
  deadlineDateFrom: null,
  deadlineDateTo: null,
  globalFilter: "",
  sorting: [],
  columnVisibility: {},
  columnSizing: {},
  typeFilter: "all",
  aiRelevanceFilter: "all",
  showFilterTray: false,
};

export const filtersSlice = createSlice({
  name: "filters",
  initialState,
  reducers: {
    setExclusionFilter(state, action: PayloadAction<string | null>) {
      state.exclusionFilter = action.payload;
    },
    setDeadlinePreset(state, action: PayloadAction<DeadlinePreset | null>) {
      state.deadlinePreset = action.payload;
      if (action.payload) {
        state.deadlineDateFrom = null;
        state.deadlineDateTo = null;
      }
    },
    setDeadlineDateRange(state, action: PayloadAction<{ from: string | null; to: string | null }>) {
      state.deadlineDateFrom = action.payload.from;
      state.deadlineDateTo = action.payload.to;
      if (action.payload.from) {
        state.deadlinePreset = null;
      }
    },
    clearDeadlineFilter(state) {
      state.deadlinePreset = null;
      state.deadlineDateFrom = null;
      state.deadlineDateTo = null;
    },
    setGlobalFilter(state, action: PayloadAction<string>) {
      state.globalFilter = action.payload;
    },
    setSorting(state, action: PayloadAction<SortingState>) {
      state.sorting = action.payload;
    },
    setColumnVisibility(state, action: PayloadAction<VisibilityState>) {
      state.columnVisibility = action.payload;
    },
    setColumnSizing(state, action: PayloadAction<ColumnSizingState>) {
      state.columnSizing = action.payload;
    },
    setTypeFilter(state, action: PayloadAction<"all" | "Gem" | "Non-Gem">) {
      state.typeFilter = action.payload;
    },
    setAiRelevanceFilter(state, action: PayloadAction<"all" | "yes" | "no">) {
      state.aiRelevanceFilter = action.payload;
    },
    toggleFilterTray(state) {
      state.showFilterTray = !state.showFilterTray;
    },
    setShowFilterTray(state, action: PayloadAction<boolean>) {
      state.showFilterTray = action.payload;
    },
    resetAllFilters(state) {
      state.exclusionFilter = null;
      state.deadlinePreset = null;
      state.deadlineDateFrom = null;
      state.deadlineDateTo = null;
      state.typeFilter = "all";
      state.aiRelevanceFilter = "all";
      state.globalFilter = "";
    },
  },
});

export const {
  setExclusionFilter,
  setDeadlinePreset,
  setDeadlineDateRange,
  clearDeadlineFilter,
  setGlobalFilter,
  setSorting,
  setColumnVisibility,
  setColumnSizing,
  setTypeFilter,
  setAiRelevanceFilter,
  toggleFilterTray,
  setShowFilterTray,
  resetAllFilters,
} = filtersSlice.actions;

export type { DeadlinePreset };

export default filtersSlice.reducer;
