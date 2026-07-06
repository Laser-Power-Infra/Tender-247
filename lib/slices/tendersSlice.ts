import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import pLimit from "p-limit";

export interface TenderData {
  fileName: string;
  columns: string[];
  rows: Record<string, string>[];
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
          totalGem: incoming.totalGem,
          totalNonGem: incoming.totalNonGem,
        };
      } else {
        const existingColumns = new Set(state.data.columns);
        for (const col of incoming.columns) {
          if (!existingColumns.has(col)) {
            state.data.columns.push(col);
            existingColumns.add(col);
          }
        }
        state.data.rows.push(...incoming.rows);
        state.data.totalGem += incoming.totalGem;
        state.data.totalNonGem += incoming.totalNonGem;
        state.data.fileName = `Files (${state.completedFiles + 1}/${state.totalFiles})`;
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
  },
});

export const { startFetch, mergeFile, finishFetch } = tendersSlice.actions;
export default tendersSlice.reducer;
