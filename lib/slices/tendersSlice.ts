import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import pLimit from "p-limit";
import { updateTenderDecision, updateTenderAssignmentsAction } from "@/actions/tender";

export interface TenderData {
  fileName: string;
  columns: string[];
  rows: Record<string, string>[];
  associations: { id: number; name: string; email: string }[];
  totalGem: number;
  totalNonGem: number;
}

interface TendersState {
  data: TenderData | null;
  loading: boolean;
  totalFiles: number;
  completedFiles: number;
}

const initialState: TendersState = {
  data: null,
  loading: false,
  totalFiles: 0,
  completedFiles: 0,
};

export const updateTenderAssignments = createAsyncThunk(
  "tenders/updateAssignments",
  async (params: {
    rowIndex: number;
    gemTenderId?: number;
    nonGemTenderId?: number;
    associationIds: number[];
    oldValue: string;
  }) => {
    await updateTenderAssignmentsAction({
      gemTenderId: params.gemTenderId,
      nonGemTenderId: params.nonGemTenderId,
      associationIds: params.associationIds,
    });
  },
);

export const updateTenderCell = createAsyncThunk(
  "tenders/updateCell",
  async (params: {
    rowIndex: number;
    field: string;
    value: string;
    type: "Gem" | "Non-Gem";
    id: number;
    oldValue: string;
  }) => {
    await updateTenderDecision({
      type: params.type,
      id: params.id,
      field: params.field as "app" | "aps" | "apm",
      value: params.value as "YES" | "NO" | "NOT_DECIDED",
    });
  },
);

export const fetchTendersIncremental = createAsyncThunk(
  "tenders/fetchTendersIncremental",
  async (fileIds: number[], { dispatch }) => {
    if (fileIds.length === 0) return;

    dispatch(startFetch(fileIds.length));

    const limit = pLimit(6);

    const fetches = fileIds.map((id) =>
      limit(async () => {
        try {
          const res = await fetch(`/api/tenders?fileId=${id}`);
          if (!res.ok) return null;
          const data: TenderData = await res.json();
          dispatch(mergeFile(data));
          return data;
        } catch {
          return null;
        }
      }),
    );

    await Promise.allSettled(fetches);
    dispatch(finishFetch());
  },
);

export const appendTenders = createAsyncThunk(
  "tenders/appendTenders",
  async (fileIds: number[], { dispatch }) => {
    if (fileIds.length === 0) return;

    const limit = pLimit(6);

    const fetches = fileIds.map((id) =>
      limit(async () => {
        try {
          const res = await fetch(`/api/tenders?fileId=${id}`);
          if (!res.ok) return null;
          const data: TenderData = await res.json();
          dispatch(mergeFile(data));
          return data;
        } catch {
          return null;
        }
      }),
    );

    await Promise.allSettled(fetches);
  },
);

export const tendersSlice = createSlice({
  name: "tenders",
  initialState,
  reducers: {
    startFetch(state, action: PayloadAction<number>) {
      state.loading = true;
      state.data = null;
      state.totalFiles = action.payload;
      state.completedFiles = 0;
    },
    mergeFile(state, action: PayloadAction<TenderData>) {
      const incoming = action.payload;

      if (!state.data) {
        state.data = {
          fileName: `Files (1/${state.totalFiles})`,
          columns: [...incoming.columns],
          rows: [...incoming.rows],
          associations: incoming.associations ?? [],
          totalGem: incoming.totalGem,
          totalNonGem: incoming.totalNonGem,
        };
      } else {
        const existingColumns = new Set(state.data.columns);
        const newCols: string[] = [];
        for (const col of incoming.columns) {
          if (!existingColumns.has(col)) {
            state.data.columns.push(col);
            existingColumns.add(col);
            newCols.push(col);
          }
        }
        state.data.rows.push(...incoming.rows);
        state.data.totalGem += incoming.totalGem;
        state.data.totalNonGem += incoming.totalNonGem;
        state.data.fileName = `Files (${state.completedFiles + 1}/${state.totalFiles})`;

        console.log(
          `[mergeFile] incoming="${incoming.fileName}" cols=${incoming.columns.length} rows=${incoming.rows.length}`,
          `newCols=${newCols.length > 0 ? JSON.stringify(newCols) : "none"}`,
          `totalCols=${state.data.columns.length}`,
        );
      }

      state.completedFiles += 1;
    },
    finishFetch(state) {
      state.loading = false;
      if (state.data) {
        state.data.fileName = `All Files (${state.completedFiles})`;
      }
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchTendersIncremental.rejected, (state) => {
      state.loading = false;
    });
    builder.addCase(updateTenderCell.pending, (state, action) => {
      const { rowIndex, field, value } = action.meta.arg;
      if (state.data?.rows[rowIndex]) {
        state.data.rows[rowIndex][field] = value;
      }
    });
    builder.addCase(updateTenderCell.fulfilled, (state, action) => {
      const { rowIndex, field, value } = action.meta.arg;
      if (state.data?.rows[rowIndex]) {
        state.data.rows[rowIndex][field] = value;
      }
    });
    builder.addCase(updateTenderCell.rejected, (state, action) => {
      const { rowIndex, field, oldValue } = action.meta.arg;
      if (state.data?.rows[rowIndex]) {
        state.data.rows[rowIndex][field] = oldValue;
      }
    });
    builder.addCase(updateTenderAssignments.pending, (state, action) => {
      const { rowIndex, associationIds } = action.meta.arg;
      if (state.data?.rows[rowIndex]) {
        state.data.rows[rowIndex].assignedTo = associationIds.join(",");
      }
    });
    builder.addCase(updateTenderAssignments.fulfilled, (state, action) => {
      const { rowIndex, associationIds } = action.meta.arg;
      if (state.data?.rows[rowIndex]) {
        state.data.rows[rowIndex].assignedTo = associationIds.join(",");
      }
    });
    builder.addCase(updateTenderAssignments.rejected, (state, action) => {
      const { rowIndex, oldValue } = action.meta.arg;
      if (state.data?.rows[rowIndex]) {
        state.data.rows[rowIndex].assignedTo = oldValue;
      }
    });
  },
});

export const { startFetch, mergeFile, finishFetch } = tendersSlice.actions;
export default tendersSlice.reducer;
