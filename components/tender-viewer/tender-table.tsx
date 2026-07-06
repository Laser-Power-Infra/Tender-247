"use client";

import { useState, useCallback, useRef, useMemo } from "react";
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
  type Header,
} from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { analyzeTenderValidity, saveAiRelevance } from "@/actions/ai-analysis";
import {
  Loader2,
  Zap,
  Square,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Columns3,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

interface TenderTableProps {
  columns: string[];
  rows: Record<string, string>[];
  fileName: string;
  loadingTenders?: boolean;
  totalFiles?: number;
  completedFiles?: number;
}

function formatHeader(col: string): string {
  if (col === "AI relevance") return "AI RELEVANCE";
  if (col === "type") return "Type";
  if (col === "id") return "ID";
  return col
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

const ALWAYS_VISIBLE = new Set(["type", "referenceNo"]);

const PAGE_SIZES = [20, 50, 100];

function SortIndicator({ header }: { header: Header<Record<string, string>, unknown> }) {
  const sorted = header.column.getIsSorted();
  if (sorted === "asc") return <ChevronUp className="size-3" />;
  if (sorted === "desc") return <ChevronDown className="size-3" />;
  if (header.column.getCanSort()) return <ChevronsUpDown className="size-3 text-white/30" />;
  return null;
}

export default function TenderTable({
  columns,
  rows,
  fileName,
  loadingTenders,
  totalFiles,
  completedFiles,
}: TenderTableProps) {
  const [analysisResults, setAnalysisResults] = useState<
    Record<number, { valid: boolean; reason: string }>
  >({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const abortRef = useRef(false);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [exclusionFilter, setExclusionFilter] = useState<"cable" | "conductors" | "both" | null>(null);

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

  const hasDbResults = useMemo(() => Object.keys(dbResults).length > 0, [dbResults]);

  const combinedResults = useMemo(
    () => ({ ...dbResults, ...analysisResults }),
    [dbResults, analysisResults],
  );

  const resultsCount = Object.keys(combinedResults).length;
  const validCount = Object.values(combinedResults).filter((r) => r.valid).length;

  const showAiColumn = isAnalyzing || hasDbResults || resultsCount > 0;

  const tableData = useMemo(() => {
    let filtered = rows;
    if (exclusionFilter === "cable") {
      filtered = rows.filter((r) => r.excludedCategory?.includes("cable"));
    } else if (exclusionFilter === "conductors") {
      filtered = rows.filter((r) => r.excludedCategory?.includes("conductors"));
    } else if (exclusionFilter === "both") {
      filtered = rows.filter((r) => r.excludedCategory === "cable,conductors");
    }
    return filtered.map((row, i) => ({ ...row, _rowIndex: String(i) }));
  }, [rows, exclusionFilter]);

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
          col === "type" ? 100 :
          col === "referenceNo" ? 170 :
          col === "id" ? 80 :
          undefined,
        cell: ({ getValue }) => {
          const val = getValue() as string | undefined;

          if (col === "type") {
            return (
              <Badge
                variant={val === "Gem" ? "default" : "secondary"}
                className={cn(
                  "text-[10px] font-medium",
                  val === "Gem"
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-slate-100 text-slate-600 border-slate-200",
                )}
              >
                {val}
              </Badge>
            );
          }

          return (
            <div className="max-h-[100px] overflow-y-auto py-1.5 whitespace-normal break-words">
              {val || "\u2014"}
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

          if (skip) return <span className="text-slate-300">\u2014</span>;
          if (isCurrent)
            return (
              <span className="flex items-center gap-1.5 text-blue-500">
                <Loader2 className="size-3 animate-spin" />
                <span className="text-[11px]">Analyzing...</span>
              </span>
            );
          if (isPending)
            return <span className="text-slate-300 text-[11px]">Pending</span>;
          if (result)
            return (
              <div className="flex flex-col gap-0.5">
                <Badge
                  className={cn(
                    "inline-flex w-fit text-[10px] font-medium",
                    result.valid
                      ? "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                      : "bg-red-100 text-red-700 border-red-200 hover:bg-red-100",
                  )}
                >
                  {result.valid ? "YES" : "NO"}
                </Badge>
                <span className="text-[11px] text-slate-500 leading-snug">
                  {result.reason}
                </span>
              </div>
            );
          return <span className="text-slate-300">\u2014</span>;
        },
      });
    }

    return defs;
  }, [columns, showAiColumn, analysisResults, dbResults, isAnalyzing, currentIndex]);

  const table = useReactTable({
    data: tableData,
    columns: columnDefs,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnSizingChange: setColumnSizing,
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      globalFilter,
      columnSizing,
      columnVisibility,
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

  if (!rows.length && !loadingTenders) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-12 text-sm text-slate-400">
        No tenders found for {fileName}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="bg-white px-5 py-3 text-primary flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/10 shrink-0">
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
              {fileName}
            </p>
            <p className="text-[11px]">
              {table.getPrePaginationRowModel().rows.length} tender
              {table.getPrePaginationRowModel().rows.length !== 1 ? "s" : ""} found
              {loadingTenders && totalFiles && completedFiles !== undefined && (
                <span className="text-amber-500 ml-1.5">
                  (loading {completedFiles}/{totalFiles})
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
            <input
              value={globalFilter ?? ""}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Search..."
              className="h-8 w-44 rounded-lg border border-input bg-transparent pl-7 pr-2.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>

          <div className="flex items-center gap-1">
            {(["cable", "conductors", "both"] as const).map((key) => (
              <Button
                key={key}
                size="xs"
                variant={exclusionFilter === key ? "default" : "outline"}
                onClick={() => setExclusionFilter(exclusionFilter === key ? null : key)}
                className={cn(
                  "text-xs capitalize",
                  exclusionFilter === key && "bg-blue-600 hover:bg-blue-700",
                )}
              >
                {key === "both" ? "Both" : key}
              </Button>
            ))}
          </div>

          <div className="relative">
            <Button
              size="xs"
              variant="outline"
              onClick={() => setShowColumnPicker((v) => !v)}
              className="text-xs"
            >
              <Columns3 className="size-3" />
              Columns
            </Button>
            {showColumnPicker && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowColumnPicker(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-lg bg-white shadow-md ring-1 ring-slate-200 p-2 max-h-80 overflow-y-auto">
                  <p className="text-[11px] font-medium text-slate-500 px-1 py-1.5 uppercase tracking-wider">
                    Toggle Columns
                  </p>
                  {table
                    .getAllLeafColumns()
                    .filter((c) => c.getCanHide())
                    .map((column) => (
                      <label
                        key={column.id}
                        className="flex items-center gap-2 py-1.5 px-1.5 hover:bg-slate-50 rounded cursor-pointer text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={column.getIsVisible()}
                          onChange={column.getToggleVisibilityHandler()}
                          className="size-3.5 accent-blue-600"
                        />
                        {formatHeader(column.id)}
                      </label>
                    ))}
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            {resultsCount > 0 && !isAnalyzing && (
              <Badge
                className={cn(
                  "text-[10px]",
                  validCount === resultsCount
                    ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                    : "bg-amber-100 text-amber-700 border-amber-200",
                )}
              >
                {validCount}/{resultsCount} valid
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
          </div>
        </div>
      </div>

      <div
        className={cn("overflow-auto max-h-[65vh]", isResizing && "select-none")}
      >
        <Table
          className="border-collapse w-full"
          style={{ tableLayout: "fixed" }}
        >
          <colgroup>
            {table.getAllLeafColumns().map((column) => (
              <col
                key={column.id}
                style={{ width: column.getSize() }}
              />
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
                        colId === "type" && "bg-[#0f2847]",
                        header.column.getCanSort() && "cursor-pointer select-none",
                      )}
                      style={{
                        width: header.getSize(),
                      }}
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
                      </div>

                      {header.column.getCanResize() && (
                        <div
                          onDoubleClick={() => header.column.resetSize()}
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={cn(
                            "absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize rounded-full",
                            "group-hover:bg-blue-300/50 active:bg-blue-400/70",
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
                  {row.getVisibleCells().map((cell) => {
                    const colId = cell.column.id;
                    return (
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
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between px-5 py-2.5 border-t border-slate-200 bg-white">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>
            Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}
            {" "}\u2013{" "}
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
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
