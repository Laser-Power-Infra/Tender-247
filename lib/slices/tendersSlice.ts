import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import pLimit from "p-limit";
import { updateTenderDecision, updateTenderAssignmentsAction } from "@/actions/tender";
import { analyzeTenderValidity, saveAiRelevance } from "@/actions/ai-analysis";

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
  updatingCells: Record<string, boolean>;
  feedbackSaving: Record<string, boolean>;
  pdfDownloading: Record<string, boolean>;
  pdfParsing: Record<string, boolean>;
}

const initialState: TendersState = {
  data: null,
  loading: false,
  totalFiles: 0,
  completedFiles: 0,
  updatingCells: {},
  feedbackSaving: {},
  pdfDownloading: {},
  pdfParsing: {},
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

export const saveAiFeedback = createAsyncThunk(
  "tenders/saveAiFeedback",
  async (params: {
    tenderId: number;
    tenderType: string;
    briefText: string;
    originalAi: string;
    correctedAi: string;
    feedbackReason: string;
  }) => {
    const res = await fetch("/api/ai-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error("Failed to save feedback");
    return res.json();
  },
);

export const analyzeTender = createAsyncThunk(
  "tenders/analyzeTender",
  async (params: { id: number; type: "Gem" | "Non-Gem"; brief: string }) => {
    const result = await analyzeTenderValidity(params.brief);
    if (!result.success) throw new Error(result.error);

    await saveAiRelevance({
      id: params.id,
      type: params.type,
      valid: result.data.valid,
      reason: result.data.reason,
    });

    return { id: params.id, valid: String(result.data.valid), reason: result.data.reason };
  },
);

export const downloadTenderPdf = createAsyncThunk(
  "tenders/downloadTenderPdf",
  async (params: { id: number; gemId: string }) => {
    const res = await fetch("/api/download-pdfs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenders: [{ id: params.id, gemId: params.gemId }] }),
    });
    const data = await res.json();
    const detail = data.results?.[0];
    if (!detail?.success) throw new Error(detail?.error || "Download failed");
    return { id: params.id, tenderFileUrl: detail.pdfPath };
  },
);

export const parseTenderPdf = createAsyncThunk(
  "tenders/parseTenderPdf",
  async (params: { id: number }) => {
    const res = await fetch("/api/parse-pdfs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenders: [{ id: params.id }] }),
    });
    const data = await res.json();
    const detail = data.results?.[0];
    if (!detail?.success) throw new Error(detail?.error || "Parse failed");
    return {
      id: params.id,
      itemCategory: detail.itemCategory,
      totalQuantity: detail.totalQuantity,
      parseStatus: "COMPLETED",
    };
  },
);

export const saveFeedbackAndReanalyze = createAsyncThunk(
  "tenders/saveFeedbackAndReanalyze",
  async (params: {
    tenderId: number;
    tenderType: string;
    briefText: string;
    originalAi: string;
    correctedAi: string;
    feedbackReason: string;
  }) => {
    const res = await fetch("/api/ai-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error("Failed to save feedback");

    const result = await analyzeTenderValidity(params.briefText);
    if (!result.success) throw new Error(result.error);

    const type = params.tenderType === "Gem" ? "Gem" : "Non-Gem";
    await saveAiRelevance({
      id: params.tenderId,
      type,
      valid: result.data.valid,
      reason: result.data.reason,
    });

    return {
      id: params.tenderId,
      valid: String(result.data.valid),
      reason: result.data.reason,
    };
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
    updateAnalysisResult(
      state,
      action: PayloadAction<{ id: number; valid: string; reason: string }>,
    ) {
      if (!state.data) return;
      const row = state.data.rows.find(
        (r) => Number(r.id) === action.payload.id,
      );
      if (row) {
        row.aiRelevanceValid = action.payload.valid;
        row.aiRelevanceReason = action.payload.reason;
      }
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchTendersIncremental.rejected, (state) => {
      state.loading = false;
    });
    builder.addCase(updateTenderCell.pending, (state, action) => {
      const { rowIndex, field, value } = action.meta.arg;
      state.updatingCells[`${rowIndex}-${field}`] = true;
      if (state.data?.rows[rowIndex]) {
        state.data.rows[rowIndex][field] = value;
      }
    });
    builder.addCase(updateTenderCell.fulfilled, (state, action) => {
      const { rowIndex, field, value } = action.meta.arg;
      state.updatingCells[`${rowIndex}-${field}`] = false;
      if (state.data?.rows[rowIndex]) {
        state.data.rows[rowIndex][field] = value;
      }
    });
    builder.addCase(updateTenderCell.rejected, (state, action) => {
      const { rowIndex, field, oldValue } = action.meta.arg;
      state.updatingCells[`${rowIndex}-${field}`] = false;
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
    builder.addCase(saveAiFeedback.pending, (state, action) => {
      const key = `${action.meta.arg.tenderId}-${action.meta.arg.tenderType}`;
      state.feedbackSaving[key] = true;
    });
    builder.addCase(saveAiFeedback.fulfilled, (state, action) => {
      const { tenderId, tenderType, correctedAi, feedbackReason } = action.meta.arg;
      const key = `${tenderId}-${tenderType}`;
      state.feedbackSaving[key] = false;
      if (state.data) {
        const row = state.data.rows.find((r) => Number(r.id) === tenderId);
        if (row) {
          row.aiFeedbackCorrected = correctedAi;
          row.aiFeedbackReason = feedbackReason;
        }
      }
    });
    builder.addCase(saveAiFeedback.rejected, (state, action) => {
      const key = `${action.meta.arg.tenderId}-${action.meta.arg.tenderType}`;
      state.feedbackSaving[key] = false;
    });

    // analyzeTender
    builder.addCase(analyzeTender.pending, (state, action) => {
      state.updatingCells[`${action.meta.arg.id}-${action.meta.arg.type}-analyze`] = true;
    });
    builder.addCase(analyzeTender.fulfilled, (state, action) => {
      const { id, valid, reason } = action.payload;
      state.updatingCells[`${id}-${action.meta.arg.type}-analyze`] = false;
      if (state.data) {
        const row = state.data.rows.find((r) => Number(r.id) === id);
        if (row) {
          row.aiRelevanceValid = valid;
          row.aiRelevanceReason = reason;
        }
      }
    });
    builder.addCase(analyzeTender.rejected, (state, action) => {
      state.updatingCells[`${action.meta.arg.id}-${action.meta.arg.type}-analyze`] = false;
    });

    // downloadTenderPdf
    builder.addCase(downloadTenderPdf.pending, (state, action) => {
      state.pdfDownloading[String(action.meta.arg.id)] = true;
    });
    builder.addCase(downloadTenderPdf.fulfilled, (state, action) => {
      const { id, tenderFileUrl } = action.payload;
      state.pdfDownloading[String(id)] = false;
      if (state.data) {
        const row = state.data.rows.find((r) => Number(r.id) === id);
        if (row) {
          row.tenderFileUrl = tenderFileUrl;
        }
      }
    });
    builder.addCase(downloadTenderPdf.rejected, (state, action) => {
      state.pdfDownloading[String(action.meta.arg.id)] = false;
    });

    // parseTenderPdf
    builder.addCase(parseTenderPdf.pending, (state, action) => {
      state.pdfParsing[String(action.meta.arg.id)] = true;
    });
    builder.addCase(parseTenderPdf.fulfilled, (state, action) => {
      const { id, itemCategory, totalQuantity, parseStatus } = action.payload;
      state.pdfParsing[String(id)] = false;
      if (state.data) {
        const row = state.data.rows.find((r) => Number(r.id) === id);
        if (row) {
          row.itemCategory = itemCategory;
          row.totalQuantity = totalQuantity;
          row.parseStatus = parseStatus;
        }
      }
    });
    builder.addCase(parseTenderPdf.rejected, (state, action) => {
      state.pdfParsing[String(action.meta.arg.id)] = false;
    });

    // saveFeedbackAndReanalyze
    builder.addCase(saveFeedbackAndReanalyze.pending, (state, action) => {
      const key = `${action.meta.arg.tenderId}-${action.meta.arg.tenderType}`;
      state.feedbackSaving[key] = true;
    });
    builder.addCase(saveFeedbackAndReanalyze.fulfilled, (state, action) => {
      const { id, valid, reason } = action.payload;
      const { tenderType, correctedAi, feedbackReason } = action.meta.arg;
      const key = `${id}-${tenderType}`;
      state.feedbackSaving[key] = false;
      if (state.data) {
        const row = state.data.rows.find((r) => Number(r.id) === id);
        if (row) {
          row.aiRelevanceValid = valid;
          row.aiRelevanceReason = reason;
          row.aiFeedbackCorrected = correctedAi;
          row.aiFeedbackReason = feedbackReason;
        }
      }
    });
    builder.addCase(saveFeedbackAndReanalyze.rejected, (state, action) => {
      const key = `${action.meta.arg.tenderId}-${action.meta.arg.tenderType}`;
      state.feedbackSaving[key] = false;
    });
  },
});

export const { startFetch, mergeFile, finishFetch, updateAnalysisResult } =
  tendersSlice.actions;
export default tendersSlice.reducer;
