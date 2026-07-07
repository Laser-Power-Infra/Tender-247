"use client";

import { useRef, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import {
  addFiles,
  removeFile,
  uploadFiles,
} from "@/lib/slices/uploadSlice";

function UploadIcon() {
  return (
    <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="size-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function FileUpload() {
  const dispatch = useAppDispatch();
  const pendingFiles = useAppSelector((s) => s.upload.pendingFiles);
  const parsing = useAppSelector((s) => s.upload.parsing);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) {
        dispatch(addFiles(e.target.files));
        e.target.value = "";
      }
    },
    [dispatch],
  );

  const handleParse = useCallback(async () => {
    if (!pendingFiles.length) return;
    dispatch(uploadFiles(pendingFiles));
  }, [dispatch, pendingFiles]);

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex-1 flex flex-col rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-primary to-primary/80 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/10">
              <UploadIcon />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white tracking-wide">
                Upload Tenders
              </h3>
              <p className="text-[11px] text-primary/60">
                Excel files (.xlsx, .xls)
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleUploadClick}
            disabled={parsing}
            className="text-white hover:bg-white/10 hover:text-white border border-white/20 text-xs h-8 px-3 rounded-lg transition-all"
          >
            <UploadIcon />
            <span className="ml-1.5">Browse</span>
          </Button>
        </div>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".xlsx,.xls"
          className="sr-only"
          onChange={handleInputChange}
        />

        <div className="flex-1 flex flex-col p-5">
          {pendingFiles.length === 0 && (
            <div
              className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-lg p-6 cursor-pointer hover:border-primary/30 hover:bg-primary/5 transition-all"
              onClick={handleUploadClick}
            >
              <div className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center mb-3">
                <svg className="size-5 text-primary/60" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
                </svg>
              </div>
              <p className="text-xs text-slate-500 text-center">
                Click to browse or drag files here
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                .xlsx and .xls files supported
              </p>
            </div>
          )}

          {pendingFiles.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {pendingFiles.map((file, i) => (
                  <Badge
                    key={file.name + file.size}
                    variant="secondary"
                    className="inline-flex items-center gap-1.5 py-1.5 pr-1 pl-2.5 text-xs font-normal max-w-full rounded-lg bg-slate-100 text-slate-700 border border-slate-200"
                  >
                    <span className="truncate">{file.name}</span>
                    <span className="shrink-0 text-[10px] text-slate-400">
                      {formatFileSize(file.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() => dispatch(removeFile(i))}
                      className="flex shrink-0 items-center justify-center rounded-md p-0.5 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors ml-0.5"
                      aria-label={`Remove ${file.name}`}
                    >
                      <XIcon />
                    </button>
                  </Badge>
                ))}
              </div>

              <Button
                size="sm"
                onClick={handleParse}
                disabled={parsing}
                className="bg-primary text-primary-foreground hover:bg-primary/80 rounded-lg h-9 px-5 text-xs font-medium transition-all shadow-sm"
              >
                {parsing ? (
                  <>
                    <Spinner />
                    <span className="ml-1.5">Parsing...</span>
                  </>
                ) : (
                  `Parse ${pendingFiles.length} File${pendingFiles.length !== 1 ? "s" : ""}`
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
