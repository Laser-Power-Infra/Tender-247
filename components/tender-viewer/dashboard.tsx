"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import ActionArea from "@/components/tender-viewer/action-area";
import TenderTable from "@/components/tender-viewer/tender-table";
import FileUpload from "@/components/upload/file-upload";

interface FileItem {
  id: number;
  fileName: string;
  totalCount: number | null;
  excludedCount: number | null;
  status: string | null;
}

interface TenderData {
  fileName: string;
  columns: string[];
  rows: Record<string, string>[];
  totalGem: number;
  totalNonGem: number;
}

export default function Dashboard() {
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null);
  const [tenderData, setTenderData] = useState<TenderData | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingTenders, setLoadingTenders] = useState(false);

  const fetchFiles = useCallback(async (date: Date) => {
    setLoadingFiles(true);
    setSelectedFileId(null);
    setTenderData(null);
    try {
      const dateStr = format(date, "yyyy-MM-dd");
      const res = await fetch(`/api/files?date=${dateStr}`);
      const data = await res.json();
      setFiles(data.files || []);
    } catch {
      setFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  const fetchTenders = useCallback(async (fileId: number) => {
    setLoadingTenders(true);
    setTenderData(null);
    try {
      const res = await fetch(`/api/tenders?fileId=${fileId}`);
      const data = await res.json();
      setTenderData(data);
    } catch {
      setTenderData(null);
    } finally {
      setLoadingTenders(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles(selectedDate);
  }, [selectedDate, fetchFiles]);

  useEffect(() => {
    if (selectedFileId !== null) {
      fetchTenders(selectedFileId);
    } else {
      setTenderData(null);
    }
  }, [selectedFileId, fetchTenders]);

  const handleDateChange = useCallback((date: Date | undefined) => {
    if (date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      setSelectedDate(d);
    }
  }, []);

  const handleFileSelect = useCallback((fileId: number | null) => {
    setSelectedFileId(fileId);
  }, []);

  return (
    <div className="flex flex-col flex-1 gap-6 p-6 lg:p-8">
      {/* Top Row: File Upload + Action Area side by side */}
      <div className="flex flex-col lg:flex-row gap-6 items-stretch">
        <div className="flex-1 min-w-0">
          <FileUpload />
        </div>
        <div className="flex-1 min-w-0">
          <ActionArea
            files={files}
            selectedFileId={selectedFileId}
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
            onFileSelect={handleFileSelect}
          />
        </div>
      </div>

      {/* Bottom: Table Section */}
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

        {loadingTenders && (
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
            Loading tenders...
          </div>
        )}

        {tenderData && !loadingTenders && (
          <TenderTable
            columns={tenderData.columns}
            rows={tenderData.rows}
            fileName={tenderData.fileName}
          />
        )}

        {selectedFileId !== null && !tenderData && !loadingTenders && (
          <div className="flex items-center justify-center py-12 text-sm text-slate-400 bg-white rounded-xl border border-slate-200">
            No tender data found
          </div>
        )}
      </div>
    </div>
  );
}
