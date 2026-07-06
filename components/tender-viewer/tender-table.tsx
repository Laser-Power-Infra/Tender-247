"use client";

import { useState, useCallback, useRef, useMemo, memo } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useColumnResize } from "@/hooks/use-column-resize";
import { analyzeTenderValidity, saveAiRelevance } from "@/actions/ai-analysis";
import { Loader2, Zap, Square } from "lucide-react";

interface TenderTableProps {
  columns: string[];
  rows: Record<string, string>[];
  fileName: string;
  loadingTenders?: boolean;
  totalFiles?: number;
  completedFiles?: number;
}

function cssVar(col: string): string {
  return `--colw-${col.replace(/[^a-z0-9]/gi, "_")}`;
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
  const validCount = Object.values(combinedResults).filter(
    (r) => r.valid,
  ).length;

  const showAiColumn =
    isAnalyzing || hasDbResults || Object.keys(analysisResults).length > 0;

  const displayColumns = useMemo(
    () =>
      showAiColumn
        ? [...columns.slice(0, 2), "AI relevance", ...columns.slice(2)]
        : columns,
    [showAiColumn, columns],
  );

  const { getWidth, getResizeHandlers, isResizing } =
    useColumnResize(displayColumns);

  const colWidth = useCallback(
    (col: string) => {
      const w = getWidth(col);
      return `var(${cssVar(col)}, ${w}px)`;
    },
    [getWidth],
  );

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
  }, [rows]);

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
      <div className="bg-white px-5 py-3 text-primary flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/10">
            <svg
              className="size-3.5 "
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
          <div>
            <p className="text-sm font-semibold text-primary tracking-wide">
              {fileName}
            </p>
            <p className="text-[11px]">
              {rows.length} tender{rows.length !== 1 ? "s" : ""} found
              {loadingTenders && totalFiles && completedFiles !== undefined && (
                <span className="text-amber-500 ml-1.5">
                  (loading {completedFiles}/{totalFiles})
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
          <Badge className="bg-white/10 border-white/20 text-[10px] hover:bg-white/20">
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

      <div
        className={cn(
          "overflow-auto max-h-[65vh]",
          isResizing && "select-none",
        )}
      >
        <table
          className="w-full border-collapse text-sm"
          style={{ tableLayout: "fixed" }}
        >
          <thead className="sticky top-0 h-[52px] z-20">
            <tr className="h-[52px]">
              {displayColumns.map((col) => (
                <th
                  key={col}
                  className={cn(
                    "bg-[#0f2847] h-[52px] text-white text-[11px] font-semibold overflow-hidden uppercase tracking-wider",
                    "px-3 py-2.5 text-left border-b border-[#1a3a63]",
                    "whitespace-normal break-words relative group",
                    col === "type" && "sticky left-0 z-30 bg-[#0f2847]",
                  )}
                  style={{
                    width: colWidth(col),
                    minWidth: colWidth(col),
                    maxWidth: colWidth(col),
                  }}
                >
                  {col === "AI relevance"
                    ? "AI RELEVANCE"
                    : col === "type"
                      ? "Type"
                      : col.toLowerCase() === "t247 id"
                        ? "PORTAL ID"
                        : col.replace(/([A-Z])/g, " $1").trim()}

                  {col !== "type" && (
                    <div
                      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize group-hover:bg-blue-300/50 active:bg-blue-400/70 rounded-full"
                      onPointerDown={getResizeHandlers(col).onPointerDown}
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={isResizing ? "pointer-events-none" : ""}>
            {rows.map((row, i) => (
              <TenderRow
                key={i}
                row={row}
                index={i}
                displayColumns={displayColumns}
                colWidth={colWidth}
                analysisResults={analysisResults}
                dbResults={dbResults}
                isAnalyzing={isAnalyzing}
                currentIndex={currentIndex}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface TenderRowProps {
  row: Record<string, string>;
  index: number;
  displayColumns: string[];
  colWidth: (col: string) => string;
  analysisResults: Record<number, { valid: boolean; reason: string }>;
  dbResults: Record<number, { valid: boolean; reason: string }>;
  isAnalyzing: boolean;
  currentIndex: number | null;
}

const TenderRow = memo(function TenderRow({
  row,
  index,
  displayColumns,
  colWidth,
  analysisResults,
  dbResults,
  isAnalyzing,
  currentIndex,
}: TenderRowProps) {
  return (
    <tr
      className={cn(
        "border-b border-slate-100 transition-colors h-[52px]",
        "hover:bg-blue-50/40",
        index % 2 === 0 ? "bg-white" : "bg-slate-50/50",
      )}
    >
      {displayColumns.map((col) => {
        if (col === "AI relevance") {
          const result = analysisResults[index] ?? dbResults[index];
          const isCurrent = isAnalyzing && currentIndex === index;
          const isPending =
            isAnalyzing &&
            currentIndex !== null &&
            index > currentIndex;
          const brief = row?.tenderBrief;
          const skip = !brief || brief === "\u2014";

          return (
            <td
              key={col}
              className={cn(
                "px-3 py-0 text-xs whitespace-normal break-words leading-relaxed overflow-hidden h-[52px]",
                index % 2 === 0 ? "bg-white" : "bg-slate-50/50",
              )}
              style={{
                width: colWidth(col),
                minWidth: colWidth(col),
                maxWidth: colWidth(col),
                wordBreak: "break-word",
              }}
            >
              {skip ? (
                <span className="text-slate-300">\u2014</span>
              ) : isCurrent ? (
                <span className="flex items-center gap-1.5 text-blue-500">
                  <Loader2 className="size-3 animate-spin" />
                  <span className="text-[11px]">Analyzing...</span>
                </span>
              ) : isPending ? (
                <span className="text-slate-300 text-[11px]">Pending</span>
              ) : result ? (
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
              ) : (
                <span className="text-slate-300">\u2014</span>
              )}
            </td>
          );
        }

        return (
          <td
            key={col}
            className={cn(
              "px-3 py-0 text-xs text-slate-600",
              "whitespace-normal break-words leading-relaxed overflow-hidden h-[52px]",
              col === "type" && "sticky left-0 z-10 align-middle",
              col === "type" &&
                (index % 2 === 0 ? "bg-white" : "bg-slate-50/50"),
            )}
            style={{
              width: colWidth(col),
              minWidth: colWidth(col),
              maxWidth: colWidth(col),
              wordBreak: "break-word",
            }}
          >
            {col === "type" ? (
              <Badge
                variant={row.type === "Gem" ? "default" : "secondary"}
                className={cn(
                  "text-[10px] font-medium",
                  row.type === "Gem"
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-slate-100 text-slate-600 border-slate-200",
                )}
              >
                {row.type}
              </Badge>
            ) : (
              <div className="max-h-[100px] overflow-y-auto py-1.5 whitespace-normal break-words">
                {row[col] || "\u2014"}
              </div>
            )}
          </td>
        );
      })}
    </tr>
  );
});
