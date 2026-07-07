// @ts-nocheck
"use client";

import React, { useState, useCallback, useRef, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnSizingState,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import {
  setDeadlinePreset,
  setDeadlineDateRange,
  clearDeadlineFilter,
  setGlobalFilter,
  setSorting,
  setColumnVisibility,
  setColumnSizing,
  toggleFilterTray,
} from "@/lib/slices/filtersSlice";
import {
  updateTenderCell,
  updateTenderAssignments,
} from "@/lib/slices/tendersSlice";
import {
  Combobox,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipsInput,
  ComboboxValue,
  ComboboxContent,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import { analyzeTenderValidity, saveAiRelevance } from "@/actions/ai-analysis";
import {
  Loader2,
  Zap,
  Square,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
} from "date-fns";
import FilterTray from "@/components/tender-viewer/filter-tray";
import { DateRangeFilter } from "@/components/data-table";
import { SearchFilter } from "@/components/data-table/filters/search-filter";
import { ColumnPicker } from "@/components/data-table/filters/column-picker";
import { SortIndicator } from "@/components/data-table/filters/sort-indicator";
import { ExcelExport as ExcelExportComponent } from "@/components/data-table/filters/excel-export";

/* ----------------------------------------------------------------
   Types
   ---------------------------------------------------------------- */
interface ReferenceTenderTableProps {
  columns: string[];
  rows: Record<string, string>[];
  associations: { id: number; name: string; email: string }[];
  fileName: string;
  loadingTenders?: boolean;
  totalFiles?: number;
  completedFiles?: number;
  onRefresh?: () => void;
}

/* ----------------------------------------------------------------
   Helpers
   ---------------------------------------------------------------- */
function formatHeader(col: string): string {
  if (col === "AI relevance") return "AI RELEVANCE";
  if (col === "type") return "Type";
  if (col === "id") return "ID";
  return col
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

const ALWAYS_VISIBLE = new Set(["type", "referenceNo", "assignedTo"]);

/* ----------------------------------------------------------------
   AssignedToCell (memo)
   ---------------------------------------------------------------- */
const AssignedToCell = React.memo(function AssignedToCell({
  value,
  rowIndex,
  rowType,
  rowId,
  associations,
  onAssignmentChange,
}: {
  value: string;
  rowIndex: number;
  rowType: string;
  rowId: string;
  associations: { id: number; name: string; email: string }[];
  onAssignmentChange: (
    rowIndex: number,
    type: string,
    id: string,
    associationIds: string[],
  ) => void;
}) {
  const selectedIds = (value || "").split(",").filter(Boolean);
  const anchor = useComboboxAnchor();

  return (
    <div className="w-full">
      <Combobox
        multiple
        autoHighlight
        value={selectedIds}
        onValueChange={(ids: string[]) =>
          onAssignmentChange(rowIndex, rowType, rowId, ids)
        }
      >
        <ComboboxChips ref={anchor} className="w-full rounded-sm">
          <ComboboxValue>
            {(values: string[]) => (
              <>
                {values.map((id: string) => (
                  <ComboboxChip key={id}>
                    {associations.find((a) => a.id === parseInt(id))?.name ??
                      id}
                  </ComboboxChip>
                ))}
                <ComboboxChipsInput />
              </>
            )}
          </ComboboxValue>
        </ComboboxChips>
        <ComboboxContent
          anchor={anchor}
          className={`rounded-sm py-2 px-2 w-64`}
        >
          <ComboboxList>
            {associations.map((a) => (
              <ComboboxItem key={String(a.id)} value={String(a.id)}>
                {a.name}
              </ComboboxItem>
            ))}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
});

/* ================================================================
   ReferenceTenderTable
   ================================================================ */
export default function ReferenceTenderTable({
  columns,
  rows,
  associations,
  fileName,
  loadingTenders,
  totalFiles,
  completedFiles,
}: ReferenceTenderTableProps) {
  /* ---- AI analysis state ---- */
  const [analysisResults, setAnalysisResults] = useState<
    Record<number, { valid: boolean; reason: string }>
  >({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const abortRef = useRef(false);

  /* ---- Redux state ---- */
  const dispatch = useAppDispatch();
  const sorting = useAppSelector((s) => s.filters.sorting);
  const globalFilter = useAppSelector((s) => s.filters.globalFilter);
  const columnSizing = useAppSelector((s) => s.filters.columnSizing);
  const columnVisibility = useAppSelector((s) => s.filters.columnVisibility);
  const exclusionFilter = useAppSelector((s) => s.filters.exclusionFilter);
  const deadlinePreset = useAppSelector((s) => s.filters.deadlinePreset);
  const deadlineDateFrom = useAppSelector(
    (s) => s.filters.deadlineDateFrom,
  );
  const deadlineDateTo = useAppSelector((s) => s.filters.deadlineDateTo);
  const typeFilter = useAppSelector((s) => s.filters.typeFilter);
  const aiRelevanceFilter = useAppSelector(
    (s) => s.filters.aiRelevanceFilter,
  );
  const showFilterTray = useAppSelector((s) => s.filters.showFilterTray);

  /* ---- decision & assignment handlers ---- */
  const handleDecisionClick = useCallback(
    (
      col: string,
      rowIndex: number,
      type: string,
      id: string,
      value: string,
    ) => {
      const oldValue = rows[rowIndex]?.[col] ?? "";
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
    [rows, dispatch],
  );

  const handleAssignmentChange = useCallback(
    (
      rowIndex: number,
      type: string,
      id: string,
      associationIds: string[],
    ) => {
      const oldValue = rows[rowIndex]?.assignedTo ?? "";
      const numericIds = associationIds.map(Number);
      dispatch(
        updateTenderAssignments({
          rowIndex,
          gemTenderId: type === "Gem" ? parseInt(id, 10) : undefined,
          nonGemTenderId:
            type === "Non-Gem" ? parseInt(id, 10) : undefined,
          associationIds: numericIds,
          oldValue,
        }),
      );
    },
    [rows, dispatch],
  );

  /* ---- DB results (persisted AI results) ---- */
  const dbResults = useMemo(() => {
    const map: Record<number, { valid: boolean; reason: string }> = {};
    for (let i = 0; i < rows.length; i++) {
      const v = rows[i]?.aiRelevanceValid;
      const r = rows[i]?.aiRelevanceReason;
      if (v && r) {
        map[i] = { valid: v === "true", reason: r };
      }
    }
    return map;
  }, [rows]);

  const hasDbResults = useMemo(
    () => Object.keys(dbResults).length > 0,
    [dbResults],
  );

  const combinedResults = useMemo(
    () => ({ ...dbResults, ...analysisResults }),
    [dbResults, analysisResults],
  );

  const resultsCount = Object.keys(combinedResults).length;
  const validCount = Object.values(combinedResults).filter(
    (r) => r.valid,
  ).length;

  const showAiColumn = isAnalyzing || hasDbResults || resultsCount > 0;

  /* ---- pre-filter rows (exclusion, deadline, type, ai) ---- */
  const tableData = useMemo(() => {
    let from: Date | null = null;
    let to: Date | null = null;
    const now = new Date();

    if (deadlinePreset === "thisWeek") {
      from = startOfWeek(now, { weekStartsOn: 1 });
      to = endOfWeek(now, { weekStartsOn: 1 });
    } else if (deadlinePreset === "thisMonth") {
      from = startOfMonth(now);
      to = endOfMonth(now);
    } else if (deadlinePreset === "thisYear") {
      from = startOfYear(now);
      to = endOfYear(now);
    } else if (deadlineDateFrom) {
      from = new Date(deadlineDateFrom);
      to = deadlineDateTo ? new Date(deadlineDateTo) : null;
    }

    let filtered = rows.map((row, i) => ({ row, _originalIndex: i }));

    if (from || to) {
      const toEnd = to
        ? new Date(
            to.getFullYear(),
            to.getMonth(),
            to.getDate(),
            23,
            59,
            59,
            999,
          )
        : null;
      filtered = filtered.filter(({ row }) => {
        if (!row.deadline) return false;
        const d = new Date(row.deadline);
        if (from && d < from) return false;
        if (toEnd && d > toEnd) return false;
        return true;
      });
    }

    if (exclusionFilter) {
      filtered = filtered.filter(({ row }) => {
        const cat = row.excludedCategory;
        if (!cat) return true;
        if (exclusionFilter === "cable" && cat.includes("cable")) return false;
        if (exclusionFilter === "conductors" && cat.includes("conductors"))
          return false;
        if (
          exclusionFilter === "both" &&
          (cat.includes("cable") || cat.includes("conductors"))
        )
          return false;
        return true;
      });
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter(({ row }) => row.type === typeFilter);
    }

    if (aiRelevanceFilter !== "all") {
      filtered = filtered.filter(({ _originalIndex }) => {
        const result = combinedResults[_originalIndex];
        if (!result) return false;
        return aiRelevanceFilter === "yes" ? result.valid : !result.valid;
      });
    }

    return filtered.map(({ row, _originalIndex }) => ({
      ...row,
      _rowIndex: String(_originalIndex),
    }));
  }, [
    rows,
    exclusionFilter,
    deadlinePreset,
    deadlineDateFrom,
    deadlineDateTo,
    typeFilter,
    aiRelevanceFilter,
    combinedResults,
  ]);

  /* ---- column definitions ---- */
  const columnDefs = useMemo<ColumnDef<Record<string, string>>[]>(() => {
    const defs: ColumnDef<Record<string, string>>[] = [];

    for (const col of columns) {
      if (col === "AI relevance") continue;

      defs.push({
        id: col,
        accessorFn: (row) => row[col],
        header: formatHeader(col),
        enableResizing: col !== "type",
        enableHiding: !ALWAYS_VISIBLE.has(col),
        size:
          col === "type"
            ? 100
            : col === "referenceNo"
              ? 170
              : col === "id"
                ? 80
                : undefined,
        cell: ({ getValue, row: tanRow }) => {
          const val = getValue() as string | undefined;
          const rowIndex = parseInt(tanRow.original._rowIndex, 10);
          const rowType = tanRow.original.type;
          const rowId = tanRow.original.id;

          if (col === "type") {
            return (
              <Badge
                variant={val === "Gem" ? "default" : "secondary"}
                className={cn(
                  "text-[10px] font-medium",
                  val === "Gem"
                    ? "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200"
                    : "bg-slate-100 text-slate-600 border-slate-200",
                )}
              >
                {val}
              </Badge>
            );
          }

          if (col === "app" || col === "aps" || col === "apm") {
            const isYes = val === "YES";
            const isNo = val === "NO";

            return (
              <div className="flex gap-1 py-1">
                <button
                  type="button"
                  onClick={() =>
                    handleDecisionClick(col, rowIndex, rowType, rowId, "YES")
                  }
                  className={cn(
                    "w-7 h-7 rounded text-xs font-bold border transition-colors",
                    isYes
                      ? "bg-green-500 text-white border-green-600"
                      : "bg-white text-slate-400 border-slate-300 hover:border-slate-400",
                  )}
                >
                  Y
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleDecisionClick(col, rowIndex, rowType, rowId, "NO")
                  }
                  className={cn(
                    "w-7 h-7 rounded text-xs font-bold border transition-colors",
                    isNo
                      ? "bg-red-500 text-white border-red-600"
                      : "bg-white text-slate-400 border-slate-300 hover:border-slate-400",
                  )}
                >
                  N
                </button>
              </div>
            );
          }

          if (col === "assignedTo") {
            return (
              <AssignedToCell
                value={val ?? ""}
                rowIndex={rowIndex}
                rowType={rowType ?? ""}
                rowId={rowId ?? ""}
                associations={associations}
                onAssignmentChange={handleAssignmentChange}
              />
            );
          }

          if (col === "deadline") {
            return (
              <div className="max-h-[100px] overflow-y-auto py-1.5 whitespace-normal break-words">
                {val ? formatDate(val) : "-"}
              </div>
            );
          }

          return (
            <div className="max-h-[100px] overflow-y-auto py-1.5 whitespace-normal break-words">
              {val || "-"}
            </div>
          );
        },
      });
    }

    if (showAiColumn) {
      defs.splice(2, 0, {
        id: "AI relevance",
        header: "AI RELEVANCE",
        enableResizing: true,
        enableHiding: true,
        size: 200,
        cell: ({ row: tanRow }) => {
          const i = parseInt(tanRow.original._rowIndex, 10);
          const result = analysisResults[i] ?? dbResults[i];
          const isCurrent = isAnalyzing && currentIndex === i;
          const isPending =
            isAnalyzing && currentIndex !== null && i > currentIndex;
          const brief = tanRow.original?.tenderBrief;
          const skip = !brief || brief === "\u2014";

          if (skip) return <span className="text-slate-300">-</span>;
          if (isCurrent)
            return (
              <span className="flex items-center gap-1.5 text-primary/80">
                <Loader2 className="size-3 animate-spin" />
                <span className="text-[11px]">Analyzing...</span>
              </span>
            );
          if (isPending)
            return (
              <span className="text-slate-300 text-[11px]">Pending</span>
            );
          if (result)
            return (
              <div className="flex flex-col gap-0.5">
                <Badge
                  className={cn(
                    "inline-flex w-fit text-[10px] font-medium",
                    result.valid
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                      : "bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-100",
                  )}
                >
                  {result.valid ? "YES" : "NO"}
                </Badge>
                <span className="text-[11px] text-slate-500 leading-snug">
                  {result.reason}
                </span>
              </div>
            );
          return <span className="text-slate-300">-</span>;
        },
      });
    }

    return defs;
  }, [
    columns,
    showAiColumn,
    analysisResults,
    dbResults,
    isAnalyzing,
    currentIndex,
    associations,
    handleDecisionClick,
    handleAssignmentChange,
  ]);

  /* ---- AI analysis ---- */
  const runAnalysis = useCallback(async () => {
    abortRef.current = false;
    setIsAnalyzing(true);
    setAnalysisResults({});

    for (let i = 0; i < rows.length; i++) {
      if (abortRef.current) break;
      setCurrentIndex(i);

      const brief = rows[i]?.tenderBrief;
      if (!brief || brief === "\u2014") continue;
      if (dbResults[i]) continue;

      try {
        const result = await analyzeTenderValidity(brief);
        if (!result.success) {
          if (result.error === "rate_limit") {
            abortRef.current = true;
            break;
          }
          continue;
        }
        try {
          const currentRow = rows[i];
          if (currentRow) {
            await saveAiRelevance({
              id: Number(currentRow.id),
              type: currentRow.type as "Gem" | "Non-Gem",
              valid: result.data.valid,
              reason: result.data.reason,
            });
          }
        } catch {
          console.error(`Failed to save AI relevance for row ${i}`);
        }

        setAnalysisResults((prev) => ({
          ...prev,
          [i]: result.data,
        }));
      } catch {
        console.error(`Analysis failed for row ${i}`);
      }
    }

    setIsAnalyzing(false);
    setCurrentIndex(null);
  }, [rows, dbResults]);

  const stopAnalysis = useCallback(() => {
    abortRef.current = true;
  }, []);

  /* ---- Excel export row formatter ---- */
  const formatExportRow = useCallback(
    (
      row: Record<string, string>,
      visibleColumnIds: string[],
    ): Record<string, string> => {
      const obj: Record<string, string> = {};
      for (const colId of visibleColumnIds) {
        const label = formatHeader(colId);
        let val = row[colId] ?? "";
        if (colId === "AI relevance") {
          const valid = row.aiRelevanceValid;
          const reason = row.aiRelevanceReason;
          val =
            valid && reason
              ? `${valid === "true" ? "Yes" : "No"} Reason:${reason}`
              : "";
        }
        if (colId === "app" || colId === "aps" || colId === "apm") {
          val = val !== "YES" && val !== "NO" ? "" : val;
        }
        if (colId === "assignedTo") {
          const ids = (val || "").split(",").filter(Boolean);
          val = ids
            .map((id) => {
              const a = associations.find(
                (assoc) => assoc.id === parseInt(id),
              );
              return a ? `${a.name}(${a.email})` : "";
            })
            .filter(Boolean)
            .join("\n");
        }
        obj[label] = val.length > 32767 ? val.slice(0, 32767) : val;
      }
      return obj;
    },
    [associations],
  );

  /* ---- empty state ---- */
  if (!rows.length && !loadingTenders) {
    return (
      <div className="flex items-center justify-center rounded-sm border border-slate-200 bg-white p-12 text-sm text-slate-400">
        No tenders found for {fileName}
      </div>
    );
  }

  /* ---- header filters (attached to specific columns) ---- */
  const headerFilters: Record<string, React.ReactNode> = {
    deadline: (
      <DateRangeFilter
        preset={deadlinePreset}
        dateFrom={deadlineDateFrom}
        dateTo={deadlineDateTo}
        onPresetChange={(p) => dispatch(setDeadlinePreset(p))}
        onDateRangeChange={(from, to) =>
          dispatch(setDeadlineDateRange({ from, to }))
        }
        onClear={() => dispatch(clearDeadlineFilter())}
      />
    ),
  };

  /* ---- subtitle ---- */
  const subtitle = (
    <>
      {tableData.length} tender{tableData.length !== 1 ? "s" : ""} found
      {loadingTenders && totalFiles && completedFiles !== undefined && (
        <span className="text-blue-500 ml-1.5">
          (loading {completedFiles}/{totalFiles})
        </span>
      )}
    </>
  );

  /* ---- toolbar center (filters toggle) ---- */
  const toolbarCenter = (
    <Button
      size="xs"
      variant={showFilterTray ? "default" : "outline"}
      onClick={() => dispatch(toggleFilterTray())}
      className={cn(
        "text-xs",
        showFilterTray && "bg-blue-100 text-blue-800 hover:bg-blue-200",
      )}
    >
      <SlidersHorizontal className="size-3" />
      Filters
    </Button>
  );

  /* ---- toolbar actions (right side) ---- */
  const toolbarActions = (
    <>
      {resultsCount > 0 && !isAnalyzing && (
        <Badge
          className={cn(
            "text-[10px]",
            validCount === resultsCount
              ? "bg-blue-50 text-blue-700 border-blue-200"
              : "bg-blue-100 text-blue-800 border-blue-300",
          )}
        >
          {validCount} valid
        </Badge>
      )}
      <Badge className="bg-white/10 border-white/20 text-[10px] hover:bg-white/20 text-slate-600 border-slate-200">
        {rows.length} Records
      </Badge>
      {!isAnalyzing ? (
        <Button size="xs" onClick={runAnalysis}>
          <Zap className="size-3" />
          {hasDbResults
            ? "Analyze remaining"
            : resultsCount > 0
              ? "Re-run AI Analysis"
              : "Run AI Analysis"}
        </Button>
      ) : (
        <Button size="xs" variant="destructive" onClick={stopAnalysis}>
          <Square className="size-3 fill-current" />
          Stop ({Object.keys(analysisResults).length}/{rows.length})
        </Button>
      )}
    </>
  );

  /* ---- render ---- */
  return (
    <div>
      {/* The DataTable handles everything except the filter tray which sits between toolbar and table */}
      <DataTableWithFilterTray
        columns={columnDefs}
        data={tableData}
        title={`${fileName} (Generalized)`}
        subtitle={subtitle}
        toolbarCenter={toolbarCenter}
        toolbarActions={toolbarActions}
        headerFilters={headerFilters}
        formatHeader={formatHeader}
        showFilterTray={showFilterTray}
        /* Sync state to Redux */
        sorting={sorting}
        onSortingChange={(s) => dispatch(setSorting(s))}
        globalFilter={globalFilter}
        onGlobalFilterChange={(f) => dispatch(setGlobalFilter(f))}
        columnSizing={columnSizing}
        onColumnSizingChange={(s) => dispatch(setColumnSizing(s))}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={(v) => dispatch(setColumnVisibility(v))}
        formatExportRow={formatExportRow}
        associations={associations}
      />
    </div>
  );
}

/* ================================================================
   DataTableWithFilterTray
   ================================================================
   A thin wrapper that injects the FilterTray between the toolbar
   and the table body. This uses DataTable's composition approach:
   we render DataTable normally and add the filter tray via a
   wrapper component.
   ================================================================ */

/* All imports are at the top of the file */

const PAGE_SIZES = [20, 50, 100];

/**
 * This is a custom version of DataTable that supports a filter tray
 * rendered between the toolbar and the table grid. It mirrors DataTable
 * exactly in appearance but adds the FilterTray insertion point.
 */
function DataTableWithFilterTray({
  columns,
  data,
  title,
  subtitle,
  toolbarCenter,
  toolbarActions,
  headerFilters,
  formatHeader: formatHeaderFn,
  showFilterTray,
  sorting: sortingProp,
  onSortingChange,
  globalFilter: globalFilterProp,
  onGlobalFilterChange,
  columnSizing: columnSizingProp,
  onColumnSizingChange,
  columnVisibility: columnVisibilityProp,
  onColumnVisibilityChange,
  formatExportRow,
  associations,
}: {
  columns: ColumnDef<Record<string, string>>[];
  data: Record<string, string>[];
  title: string;
  subtitle: React.ReactNode;
  toolbarCenter: React.ReactNode;
  toolbarActions: React.ReactNode;
  headerFilters: Record<string, React.ReactNode>;
  formatHeader: (id: string) => string;
  showFilterTray: boolean;
  sorting: SortingState;
  onSortingChange: (s: SortingState) => void;
  globalFilter: string;
  onGlobalFilterChange: (f: string) => void;
  columnSizing: ColumnSizingState;
  onColumnSizingChange: (s: ColumnSizingState) => void;
  columnVisibility: VisibilityState;
  onColumnVisibilityChange: (v: VisibilityState) => void;
  formatExportRow: (row: Record<string, string>, cols: string[]) => Record<string, string>;
  associations: { id: number; name: string; email: string }[];
}) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: (updater) =>
      onSortingChange(
        typeof updater === "function" ? updater(sortingProp) : updater,
      ),
    onGlobalFilterChange: (updater) =>
      onGlobalFilterChange(
        typeof updater === "function" ? updater(globalFilterProp) : updater,
      ),
    onColumnSizingChange: (updater) =>
      onColumnSizingChange(
        typeof updater === "function" ? updater(columnSizingProp) : updater,
      ),
    onColumnVisibilityChange: (updater) =>
      onColumnVisibilityChange(
        typeof updater === "function" ? updater(columnVisibilityProp) : updater,
      ),
    state: {
      sorting: sortingProp,
      globalFilter: globalFilterProp,
      columnSizing: columnSizingProp,
      columnVisibility: columnVisibilityProp,
    },
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    defaultColumn: {
      minSize: 60,
      maxSize: 800,
    },
    initialState: {
      pagination: { pageSize: 50 },
    },
    globalFilterFn: "includesString",
  });

  const isResizing = !!table.getState().columnSizingInfo.isResizingColumn;

  return (
    <div className="rounded-sm border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* ======== TOOLBAR ======== */}
      <div className="bg-white px-5 py-3 text-primary flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-6 h-6 rounded-sm bg-white/10 shrink-0">
            <svg
              className="size-3.5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M10.875 12c-.621 0-1.125.504-1.125 1.125M12 12c.621 0 1.125.504 1.125 1.125m0 0v1.5c0 .621-.504 1.125-1.125 1.125M12 15.375c-.621 0-1.125-.504-1.125-1.125v-1.5"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-primary tracking-wide truncate">
              {title}
            </p>
            <p className="text-[11px]">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <SearchFilter
            value={globalFilterProp}
            onChange={onGlobalFilterChange}
          />
          {toolbarCenter}
          <ColumnPicker table={table} formatHeader={formatHeaderFn} />
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            {toolbarActions}
            <ExcelExportComponent
              table={table}
              fileName="tenders"
              formatHeader={formatHeaderFn}
              formatRow={formatExportRow}
            />
          </div>
        </div>
      </div>

      {/* ======== FILTER TRAY ======== */}
      {showFilterTray && <FilterTray />}

      {/* ======== TABLE ======== */}
      <div
        className={cn(
          "overflow-auto max-h-[65vh]",
          isResizing && "select-none",
        )}
      >
        <table
          className="border-collapse w-full"
          style={{ tableLayout: "fixed", minWidth: "max-content" }}
        >
          <colgroup>
            {table.getAllLeafColumns().map((column) => (
              <col key={column.id} style={{ width: column.getSize() }} />
            ))}
          </colgroup>
          <TableHeader className="sticky top-0 z-20">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="h-10">
                {headerGroup.headers.map((header) => {
                  const colId = header.column.id;
                  return (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      className={cn(
                        "bg-[#0f2847] h-10 text-white text-[11px] font-semibold overflow-hidden uppercase tracking-wider",
                        "px-3 py-2 text-left border-b border-r border-[#1a3a63] last:border-r-0",
                        "truncate relative group",
                        header.column.getCanSort() &&
                          "cursor-pointer select-none",
                      )}
                      style={{ width: header.getSize() }}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-1.5">
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                        {header.column.getCanSort() && (
                          <SortIndicator header={header} />
                        )}
                        {headerFilters[colId]}
                      </div>

                      {header.column.getCanResize() && (
                        <div
                          onDoubleClick={() => header.column.resetSize()}
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={cn(
                            "absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize rounded-full",
                            "group-hover:bg-primary/20 active:bg-primary/30",
                          )}
                        />
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={table.getAllLeafColumns().length}
                  className="h-24 text-center text-sm text-slate-400"
                >
                  No results match your search.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(
                    "transition-colors h-[52px]",
                    "hover:bg-slate-100/50",
                    "bg-white",
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        "px-3 py-0 text-xs text-slate-600 border-b border-r border-slate-200 last:border-r-0",
                        "whitespace-normal break-words leading-relaxed overflow-hidden h-[52px]",
                      )}
                      style={{ width: cell.column.getSize() }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </table>
      </div>

      {/* ======== PAGINATION ======== */}
      <div className="flex items-center justify-between px-5 py-2.5 border-t border-slate-200 bg-white">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>
            Showing{" "}
            {table.getState().pagination.pageIndex *
              table.getState().pagination.pageSize +
              1}{" "}
            –{" "}
            {Math.min(
              (table.getState().pagination.pageIndex + 1) *
                table.getState().pagination.pageSize,
              table.getPrePaginationRowModel().rows.length,
            )}{" "}
            of {table.getPrePaginationRowModel().rows.length}
          </span>
          <select
            value={table.getState().pagination.pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
            className="ml-2 h-7 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1">
          <Button
            size="xs"
            variant="outline"
            onClick={() => table.firstPage()}
            disabled={!table.getCanPreviousPage()}
            className="size-7 p-0"
          >
            <ChevronsLeft className="size-3" />
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="size-7 p-0"
          >
            <ChevronLeft className="size-3" />
          </Button>
          <span className="text-xs text-slate-500 px-2 min-w-[80px] text-center">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </span>
          <Button
            size="xs"
            variant="outline"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="size-7 p-0"
          >
            <ChevronRight className="size-3" />
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={() => table.lastPage()}
            disabled={!table.getCanNextPage()}
            className="size-7 p-0"
          >
            <ChevronsRight className="size-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
