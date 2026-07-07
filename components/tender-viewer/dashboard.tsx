"use client";

import { useEffect, useCallback, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { fetchFiles } from "@/lib/slices/filesSlice";
import { fetchTendersIncremental, updateTenderCell } from "@/lib/slices/tendersSlice";
import ActionArea from "@/components/tender-viewer/action-area";
import TenderTable from "@/components/tender-viewer/tender-table";
import ReferenceTenderTable from "@/reference/TenderTable";
import FileUpload from "@/components/upload/file-upload";
import AnalyticsCards from "@/components/tender-viewer/analytics-cards";
import { OptimizedTenderTable, ColumnDef } from "@/components/tender-viewer/optimized-tender-table/OptimizedTenderTable";

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

        {tenderData && (
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
        )}
      ------------Under Development ---------------------
        {tenderData && tenderData.rows.length > 0 && (
          <div className="mt-6 flex flex-col flex-1 min-h-0 overflow-hidden">
            <OptimizedTenderTable
              columns={tenderData.columns.map((col): ColumnDef<Record<string, unknown>> => {
                const colLower = col.toLowerCase();
                
                if (col === "app" || col === "aps" || col === "apm") {
                  return {
                    header: col,
                    accessor: col as keyof Record<string, unknown>,
                    defaultWidth: 80,
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
                
                let filterType: "text" | "select" | "dateRange" | "boolean" | undefined;
                
                if (colLower.includes("date") || colLower.includes("deadline") || colLower.includes("submission")) {
                  filterType = "dateRange";
                } else if (colLower.includes("status")) {
                  filterType = "select";
                } else if (colLower.includes("type")) {
                  filterType = "select";
                } else if (colLower.includes("ai relevance")) {
                  filterType = "select";
                } else if (col === "organization") {
                  filterType = "select";
                }
                
                const options = selectFilterOptions[col];
                return {
                  header: col,
                  accessor: col as keyof Record<string, unknown>,
                  defaultWidth: 150,
                  type: filterType === "dateRange" ? "date" : undefined,
                  filter: options && filterType === "select"
                    ? { type: "select" as const, options, ...(col === "organization" ? { searchable: true as const } : {}) }
                    : filterType
                      ? { type: filterType }
                      : undefined,
                };
              })}
              rows={tenderData.rows as Record<string, unknown>[]}
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
