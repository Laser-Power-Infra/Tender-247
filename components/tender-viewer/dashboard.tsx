"use client";

import { useEffect, useCallback, useMemo, useState, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { fetchFiles } from "@/lib/slices/filesSlice";
import { fetchTendersIncremental, updateTenderCell, updateTenderAssignments } from "@/lib/slices/tendersSlice";
import { setExclusionFilter } from "@/lib/slices/filtersSlice";
import ActionArea from "@/components/tender-viewer/action-area";
import ConfirmAnalysisDialog from "@/components/tender-viewer/confirm-analysis-dialog";
import TenderTable from "@/components/tender-viewer/tender-table";
import ReferenceTenderTable from "@/reference/TenderTable";
import FileUpload from "@/components/upload/file-upload";
import AnalyticsCards from "@/components/tender-viewer/analytics-cards";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { OptimizedTenderTable, ColumnDef } from "@/components/tender-viewer/optimized-tender-table/OptimizedTenderTable";


function formatColumnName(name: string): string {
  if (name === "t247Id") return "Portal ID";
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

export default function Dashboard() {
  const dispatch = useAppDispatch();
  const selectedDateFrom = useAppSelector((s) => s.files.selectedDateFrom);
  const selectedDateTo = useAppSelector((s) => s.files.selectedDateTo);
  const files = useAppSelector((s) => s.files.items);
  const loadingFiles = useAppSelector((s) => s.files.loading);
  const tenderData = useAppSelector((s) => s.tenders.data);
  const loadingTenders = useAppSelector((s) => s.tenders.loading);
  const totalFiles = useAppSelector((s) => s.tenders.totalFiles);
  const completedFiles = useAppSelector((s) => s.tenders.completedFiles);
  const uploadResults = useAppSelector((s) => s.upload.results);

  const refreshTenders = useCallback(() => {
    if (files.length > 0) {
      dispatch(fetchTendersIncremental(files.map((f) => f.id)));
    }
  }, [files, dispatch]);

  useEffect(() => {
    dispatch(fetchFiles({ from: new Date(selectedDateFrom), to: new Date(selectedDateTo) }));
  }, [selectedDateFrom, selectedDateTo, dispatch]);

  useEffect(() => {
    if (files.length > 0) {
      dispatch(fetchTendersIncremental(files.map((f) => f.id)));
    } else {
      dispatch(fetchTendersIncremental([]));
    }
  }, [files, dispatch]);

  useEffect(() => {
    if (uploadResults && uploadResults.length > 0) {
      const fileIds = uploadResults.map((r) => r.fileId);
      dispatch(fetchTendersIncremental(fileIds));
    }
  }, [uploadResults, dispatch]);

  const handleAssignmentChange = useCallback(
    (rowIndex: number, type: string, id: string, associationIds: string[]) => {
      if (!tenderData) return;
      const oldValue = tenderData.rows[rowIndex]?.assignedTo ?? "";
      dispatch(
        updateTenderAssignments({
          rowIndex,
          gemTenderId: type === "Gem" ? parseInt(id, 10) : undefined,
          nonGemTenderId: type === "Non-Gem" ? parseInt(id, 10) : undefined,
          associationIds: associationIds.map(Number),
          oldValue,
        }),
      );
    },
    [tenderData, dispatch],
  );

  const handleDecisionClick = useCallback(
    (col: string, rowIndex: number, type: string, id: string, value: string) => {
      if (!tenderData) return;
      const oldValue = tenderData.rows[rowIndex]?.[col] ?? "";
      if (oldValue === value) return;
      dispatch(
        updateTenderCell({
          rowIndex,
          field: col,
          value,
          type: type as "Gem" | "Non-Gem",
          id: parseInt(id, 10),
          oldValue,
        }),
      );
    },
    [tenderData, dispatch],
  );

  const selectFilterOptions = useMemo(() => {
    if (!tenderData) return {};
    const map: Record<string, { value: string; label: string }[]> = {};
    for (const col of tenderData.columns) {
      const vals = new Set<string>();
      for (const row of tenderData.rows) {
        const v = row[col];
        if (v != null && v !== "") vals.add(String(v));
      }
      if (vals.size > 0) {
        map[col] = Array.from(vals).sort((a, b) => a.localeCompare(b)).map(v => ({ value: v, label: v }));
      }
    }
    return map;
  }, [tenderData]);

  const orderedColumns = useMemo(() => {
    if (!tenderData) return [];
    const cols = [...tenderData.columns];
    const validIdx = cols.indexOf("aiRelevanceValid");
    if (validIdx >= 0) {
      cols.splice(validIdx, 1);
      cols.splice(2, 0, "aiRelevanceValid");
    }
    const reasonIdx = cols.indexOf("aiRelevanceReason");
    if (reasonIdx >= 0) {
      cols.splice(reasonIdx, 1);
      cols.splice(3, 0, "aiRelevanceReason");
    }
    return cols;
  }, [tenderData]);

  const [filteredRows, setFilteredRows] = useState<Record<string, unknown>[]>([]);
  const handleFilteredRowsChange = useCallback((rows: Record<string, unknown>[]) => {
    setFilteredRows(rows);
  }, []);

  const [showExclusionDropdown, setShowExclusionDropdown] = useState(false);
  const exclusionFilter = useAppSelector((s) => s.filters.exclusionFilter);

  const excludedRows = useMemo(() => {
    if (!tenderData) return [];
    if (!exclusionFilter) return tenderData.rows;
    return tenderData.rows.filter(row => {
      const cat = row.excludedCategory;
      if (!cat) return true;
      if (exclusionFilter === "cable" && cat.includes("cable")) return false;
      if (exclusionFilter === "conductors" && cat.includes("conductors")) return false;
      if (exclusionFilter === "both" && (cat.includes("cable") || cat.includes("conductors"))) return false;
      return true;
    });
  }, [tenderData, exclusionFilter]);

  const [aiAnalysisState, setAiAnalysisState] = useState<{
    isAnalyzing: boolean;
    currentIndex: number | null;
    results: Record<number, { valid: boolean; reason: string }>;
  }>({ isAnalyzing: false, currentIndex: null, results: {} });

  const aiAnalysisStateRef = useRef(aiAnalysisState);
  aiAnalysisStateRef.current = aiAnalysisState;

  const handleAnalysisProgress = useCallback((state: {
    isAnalyzing: boolean;
    currentIndex: number | null;
    results: Record<number, { valid: boolean; reason: string }>;
  }) => {
    setAiAnalysisState(state);
  }, []);

  const columnDefs = useMemo(() => {
    if (!tenderData) return [];
    return orderedColumns.map((col): ColumnDef<Record<string, unknown>> => {
      const colLower = col.toLowerCase();

      if (col === "app" || col === "aps" || col === "apm") {
        return {
          header: col,
          accessor: col as keyof Record<string, unknown>,
          defaultWidth: 120,
          sortable: false,
          renderCell: (_value: unknown, row: Record<string, unknown>) => {
            const val = String(row[col] ?? "");
            const isYes = val === "YES";
            const isNo = val === "NO";
            const rowIndex = tenderData.rows.indexOf(row as Record<string, string>);
            const rowType = String(row.type ?? "");
            const rowId = String(row.id ?? "");

            return (
              <div className="flex gap-1 py-1">
                <button
                  type="button"
                  onClick={() => handleDecisionClick(col, rowIndex, rowType, rowId, "YES")}
                  className={`w-7 h-7 rounded text-xs font-bold border transition-colors ${
                    isYes
                      ? "bg-green-500 text-white border-green-600"
                      : "bg-white text-slate-400 border-slate-300 hover:border-slate-400"
                  }`}
                >
                  Y
                </button>
                <button
                  type="button"
                  onClick={() => handleDecisionClick(col, rowIndex, rowType, rowId, "NO")}
                  className={`w-7 h-7 rounded text-xs font-bold border transition-colors ${
                    isNo
                      ? "bg-red-500 text-white border-red-600"
                      : "bg-white text-slate-400 border-slate-300 hover:border-slate-400"
                  }`}
                >
                  N
                </button>
              </div>
            );
          },
          filter: col === "apm"
            ? { type: "select" as const, options: [{ value: "YES", label: "Yes" }, { value: "NO", label: "No" }] }
            : undefined,
        };
      }

      if (col === "aiRelevanceValid") {
        return {
          header: "AI Relevance",
          accessor: col as keyof Record<string, unknown>,
          defaultWidth: 200,
          sortable: false,
          searchable: false,
          filter: {
            type: "select" as const,
            options: [
              { value: "true", label: "Yes" },
              { value: "false", label: "No" },
              { value: "not_analysed", label: "Not Analysed" },
            ],
          },
          renderCell: (_value: unknown, row: Record<string, unknown>) => {
            const state = aiAnalysisStateRef.current;
            const rowIndex = (row as any)._keyIndex as number | undefined;

            if (state.isAnalyzing && rowIndex !== undefined) {
              if (state.currentIndex === rowIndex) {
                return (
                  <span className="flex items-center gap-1.5 text-primary/80">
                    <Loader2 className="size-3 animate-spin" />
                    <span className="text-[11px]">Processing...</span>
                  </span>
                );
              }
              const result = state.results[rowIndex];
              if (result) {
                return (
                  <div className="flex flex-col gap-0.5" style={{ maxHeight: 60, overflowY: "auto", whiteSpace: "normal" }}>
                    <Badge
                      className={`inline-flex w-fit text-[10px] font-medium ${
                        result.valid
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                          : "bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-100"
                      }`}
                    >
                      {result.valid ? "YES" : "NO"}
                    </Badge>
                    <span className="text-[11px] text-slate-500 leading-snug">
                      {result.reason}
                    </span>
                  </div>
                );
              }
            }

            const valid = String(row.aiRelevanceValid ?? "");
            const reason = String(row.aiRelevanceReason ?? "");
            if (!valid) return <span className="text-slate-300">-</span>;
            const isYes = valid === "true";
            return (
              <div className="flex flex-col gap-0.5" style={{ maxHeight: 60, overflowY: "auto", whiteSpace: "normal" }}>
                <Badge
                  className={`inline-flex w-fit text-[10px] font-medium ${
                    isYes
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                      : "bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-100"
                  }`}
                >
                  {isYes ? "YES" : "NO"}
                </Badge>
                <span className="text-[11px] text-slate-500 leading-snug">
                  {reason}
                </span>
              </div>
            );
          },
        };
      }

      if (col === "aiRelevanceReason") {
        return {
          header: "AI Reason",
          accessor: col as keyof Record<string, unknown>,
          defaultWidth: 200,
          hidden: true,
          sortable: false,
          searchable: false,
        };
      }

      if (col === "assignedTo") {
        return {
          header: "Assigned To",
          accessor: col as keyof Record<string, unknown>,
          defaultWidth: 200,
          sortable: false,
          searchable: false,
          filter: { type: "select" as const, options: tenderData.associations.map(a => ({ value: String(a.id), label: a.name })) },
          renderCell: (_value: unknown, row: Record<string, unknown>) => {
            const val = String(row[col] ?? "");
            const rowIndex = tenderData.rows.indexOf(row as Record<string, string>);
            const rowType = String(row.type ?? "");
            const rowId = String(row.id ?? "");
            return (
              <select
                className="assignment-select"
                value={val}
                onChange={(e) => {
                  const ids = e.target.value ? [e.target.value] : [];
                  handleAssignmentChange(rowIndex, rowType, rowId, ids);
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <option value="">None</option>
                {tenderData.associations.map((a) => (
                  <option key={a.id} value={String(a.id)}>{a.name}</option>
                ))}
              </select>
            );
          },
        };
      }

      let filterType: "text" | "select" | "dateRange" | "boolean" | undefined;

      if (colLower.includes("date") || colLower.includes("deadline") || colLower.includes("submission")) {
        filterType = "dateRange";
      } else if (colLower.includes("status")) {
        filterType = "select";
      } else if (colLower.includes("type")) {
        filterType = "select";
      } else if (col === "organization") {
        filterType = "select";
      }

      const options = selectFilterOptions[col];
      return {
        header: formatColumnName(col),
        accessor: col as keyof Record<string, unknown>,
        defaultWidth: col === "id" ? 80 : col === "deadline" ? 300 : 200,
        searchable: col === "deadline" || col === "organization" || col === "type" ? false : undefined,
        hidden: col === "id" ? true : undefined,
        type: filterType === "dateRange" ? "date" : undefined,
        filter: options && filterType === "select"
          ? { type: "select" as const, options, ...(col === "organization" ? { searchable: true as const } : {}) }
          : filterType
            ? { type: filterType }
            : undefined,
      };
    });
  }, [orderedColumns, selectFilterOptions, tenderData, handleDecisionClick, handleAssignmentChange]);

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-6 p-6 lg:p-8">
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-auto min-w-0 shrink-0">
          <FileUpload />
        </div>
        <div className="w-full lg:w-auto min-w-0 shrink-0">
          <ActionArea />
        </div>
        <div className="flex-1 min-w-0">
          {tenderData && (
            <AnalyticsCards rows={tenderData.rows} associations={tenderData.associations ?? []} />
          )}
        </div>
      </div>

      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {loadingFiles && (
          <div className="flex items-center justify-center py-12 text-sm text-slate-400">
              <svg
                className="size-5 animate-spin mr-2 text-primary"
                fill="none"
                viewBox="0 0 24 24"
              >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Loading files...
          </div>
        )}

        {/* {tenderData && (
          <TenderTable
            columns={tenderData.columns}
            rows={tenderData.rows}
            associations={tenderData.associations ?? []}
            fileName={tenderData.fileName}
            loadingTenders={loadingTenders}
            totalFiles={totalFiles}
            completedFiles={completedFiles}
            onRefresh={refreshTenders}
          />
        )} */}
      {/* ------------Under Development --------------------- */}
        {tenderData && tenderData.rows.length > 0 && (
          <div className="mt-6 flex flex-col flex-1 min-h-0 overflow-hidden">
            <OptimizedTenderTable
               onFilteredRowsChange={handleFilteredRowsChange}
               extraToolbarActions={
                <>
                  <div className="column-picker-container">
                    <button className="export-btn" onClick={() => setShowExclusionDropdown(v => !v)}>
                      {exclusionFilter ? `Excluding: ${exclusionFilter}` : "Exclusions"}
                    </button>
                    {showExclusionDropdown && (
                      <>
                        <div className="column-picker-overlay" onClick={() => setShowExclusionDropdown(false)} />
                        <div className="column-picker-dropdown" style={{ width: 180 }}>
                          {[
                            { value: "cable", label: "Exclude cables" },
                            { value: "conductors", label: "Exclude conductors" },
                            { value: "both", label: "Exclude both" },
                          ].map(opt => (
                            <button
                              key={opt.value}
                              className="column-picker-item"
                              style={{ width: "100%", textAlign: "left", fontSize: 12 }}
                              onClick={() => {
                                dispatch(setExclusionFilter(exclusionFilter === opt.value ? null : opt.value));
                                setShowExclusionDropdown(false);
                              }}
                            >
                              {exclusionFilter === opt.value ? "✓ " : ""}{opt.label}
                            </button>
                          ))}
                          {exclusionFilter && (
                            <button
                              className="column-picker-item"
                              style={{ width: "100%", textAlign: "left", fontSize: 12, borderTop: "1px solid var(--color-border)", marginTop: 4, paddingTop: 6 }}
                              onClick={() => {
                                dispatch(setExclusionFilter(null));
                                setShowExclusionDropdown(false);
                              }}
                            >
                              Clear filter
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  <ConfirmAnalysisDialog
                    filteredRows={filteredRows}
                    onComplete={refreshTenders}
                    onProgress={handleAnalysisProgress}
                  />
                </>
              }
               columns={columnDefs}
              rows={excludedRows as Record<string, unknown>[]}
              associations={tenderData.associations ?? []}
              title="Optimized Tender Table (Generalized)"
            />
          </div>
        )}

        {/* {tenderData && (
          <div className="mt-6">
            <ReferenceTenderTable
              columns={tenderData.columns}
              rows={tenderData.rows}
              associations={tenderData.associations ?? []}
              fileName={tenderData.fileName}
              loadingTenders={loadingTenders}
              totalFiles={totalFiles}
              completedFiles={completedFiles}
              onRefresh={refreshTenders}
            />
          </div>
        )} */}

        {!loadingFiles && files.length > 0 && !tenderData && (
          <div className="flex items-center justify-center py-12 text-sm text-slate-400 bg-white rounded-sm border border-slate-200">
            No tender data found
          </div>
        )}
      </div>

    </div>
  );
}
