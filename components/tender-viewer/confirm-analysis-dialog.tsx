"use client";

import { useState, useRef, useCallback } from "react";
import { analyzeTenderValidity, saveAiRelevance } from "@/actions/ai-analysis";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Zap, Square } from "lucide-react";

interface ConfirmAnalysisDialogProps {
  filteredRows: Record<string, unknown>[];
  onComplete: () => void;
  onProgress?: (state: { isAnalyzing: boolean; currentIndex: number | null; results: Record<number, { valid: boolean; reason: string }> }) => void;
}

export default function ConfirmAnalysisDialog({
  filteredRows,
  onComplete,
  onProgress,
}: ConfirmAnalysisDialogProps) {
  const [open, setOpen] = useState(false);
  const [reRunAll, setReRunAll] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState({ done: 0, total: 0 });
  const abortRef = useRef(false);
  const localResultsRef = useRef<Record<number, { valid: boolean; reason: string }>>({});

  const runAnalysis = useCallback(async (checked: boolean) => {
    abortRef.current = false;
    setIsAnalyzing(true);
    setAnalysisProgress({ done: 0, total: 0 });
    localResultsRef.current = {};
    onProgress?.({ isAnalyzing: true, currentIndex: null, results: {} });

    const targets = filteredRows.filter(r => {
      const brief = String(r.tenderBrief ?? "");
      if (!brief || brief === "\u2014") return false;
      if (!checked && r.aiRelevanceValid) return false;
      return true;
    });

    setAnalysisProgress({ done: 0, total: targets.length });
    setOpen(false);

    for (let i = 0; i < targets.length; i++) {
      if (abortRef.current) break;

      const row = targets[i];
      const brief = String(row.tenderBrief ?? "");
      const originalIdx = (row as any)._keyIndex as number;

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
          await saveAiRelevance({
            id: Number(row.id),
            type: row.type as "Gem" | "Non-Gem",
            valid: result.data.valid,
            reason: result.data.reason,
          });
        } catch {
          console.error("Failed to save AI relevance");
        }

        localResultsRef.current[originalIdx] = result.data;
        onProgress?.({
          isAnalyzing: true,
          currentIndex: originalIdx,
          results: { ...localResultsRef.current },
        });
      } catch {
        console.error("Analysis failed");
      }

      setAnalysisProgress(prev => ({ ...prev, done: prev.done + 1 }));
    }

    setIsAnalyzing(false);
    setAnalysisProgress({ done: 0, total: 0 });
    onProgress?.({ isAnalyzing: false, currentIndex: null, results: {} });
    onComplete();
  }, [filteredRows, onComplete, onProgress]);

  const handleStop = useCallback(() => {
    abortRef.current = true;
  }, []);

  if (isAnalyzing) {
    return (
      <button className="export-btn" onClick={handleStop} style={{ color: "#f87171" }}>
        <Square className="size-3.5 fill-current" />
        Stop ({analysisProgress.done}/{analysisProgress.total})
      </button>
    );
  }

  return (
    <>
      <button className="export-btn" onClick={() => setOpen(true)}>
        <Zap className="size-3.5" />
        AI Analysis
      </button>
      <AlertDialog open={open} onOpenChange={setOpen} >
        <AlertDialogContent className={`rounded-sm`}>
          <AlertDialogHeader>
            <AlertDialogTitle>Run AI Analysis</AlertDialogTitle>
            <AlertDialogDescription>
              Run AI analysis on {filteredRows.length} filtered tenders?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex items-center gap-2 text-sm pb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={reRunAll}
              onChange={(e) => setReRunAll(e.target.checked)}
              className="size-3.5"
            />
            <span className="text-muted-foreground">Re-analyze already analyzed tenders</span>
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel className={`rounded-sm`}>Cancel</AlertDialogCancel>
            <AlertDialogAction className={`rounded-sm`} onClick={() => runAnalysis(reRunAll)}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
