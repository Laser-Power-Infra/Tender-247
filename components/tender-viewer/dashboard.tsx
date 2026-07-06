"use client";

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { fetchFiles } from "@/lib/slices/filesSlice";
import { fetchTendersIncremental } from "@/lib/slices/tendersSlice";
import ActionArea from "@/components/tender-viewer/action-area";
import TenderTable from "@/components/tender-viewer/tender-table";
import FileUpload from "@/components/upload/file-upload";

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

  return (
    <div className="flex flex-col flex-1 gap-6 p-6 lg:p-8">
      <div className="flex flex-col lg:flex-row gap-6 items-stretch">
        <div className="flex-1 min-w-0">
          <FileUpload />
        </div>
        <div className="flex-1 min-w-0">
          <ActionArea />
        </div>
      </div>

      <div>
        {loadingFiles && (
          <div className="flex items-center justify-center py-12 text-sm text-slate-400">
            <svg
              className="size-5 animate-spin mr-2 text-blue-500"
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
            fileName={tenderData.fileName}
            loadingTenders={loadingTenders}
            totalFiles={totalFiles}
            completedFiles={completedFiles}
          />
        )}

        {!loadingFiles && files.length > 0 && !tenderData && (
          <div className="flex items-center justify-center py-12 text-sm text-slate-400 bg-white rounded-xl border border-slate-200">
            No tender data found
          </div>
        )}
      </div>
    </div>
  );
}
