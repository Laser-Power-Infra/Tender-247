"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import ActionArea from "@/components/tender-viewer/action-area";
import TenderTable from "@/components/tender-viewer/tender-table";

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

export default function TenderViewer() {
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
    <div className="space-y-4">
      <ActionArea
        files={files}
        selectedFileId={selectedFileId}
        selectedDate={selectedDate}
        onDateChange={handleDateChange}
        onFileSelect={handleFileSelect}
      />

      {loadingFiles && (
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          Loading files...
        </div>
      )}

      {loadingTenders && (
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
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
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          No tender data found
        </div>
      )}
    </div>
  );
}
