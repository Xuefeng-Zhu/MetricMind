"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ChangeEvent, DragEvent, useRef, useState } from "react";
import { FileSpreadsheet, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";

interface CsvUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (fileName: string) => void;
}

export function CsvUploadDialog({ open, onOpenChange, onUpload }: CsvUploadDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("q1_board_metrics.csv");
  const [dragging, setDragging] = useState(false);

  function chooseFile() {
    inputRef.current?.click();
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      setFileName(file.name);
    }
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(true);
  }

  function handleDragLeave() {
    setDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      setFileName(file.name);
    }
  }

  function handleUpload() {
    onUpload(fileName);
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/40 data-[state=open]:animate-in data-[state=closed]:animate-out" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(560px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border border-[#E5E7EB] bg-white shadow-xl focus-visible:outline-none">
          <div className="flex items-start justify-between gap-4 border-b border-[#E5E7EB] p-5">
            <div>
              <Dialog.Title className="text-lg font-semibold text-[#111827]">
                Upload CSV
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-[#6B7280]">
                Profile a CSV file with mock ingestion and AI semantic suggestions.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close CSV upload"
                className="rounded-md p-2 text-[#6B7280] hover:bg-[#F3F4F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-4 p-5">
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={handleFileChange}
              aria-label="Choose CSV file"
            />

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                dragging
                  ? "border-[#2563EB] bg-[#EFF6FF]"
                  : "border-[#CBD5E1] bg-[#F8FAFC]"
              }`}
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-white text-[#2563EB] shadow-sm">
                <Upload className="h-6 w-6" aria-hidden="true" />
              </div>
              <p className="mt-4 text-sm font-semibold text-[#111827]">
                Drag and drop a CSV, or choose a file
              </p>
              <p className="mt-2 text-sm text-[#6B7280]">
                Mock upload only. Files are not sent to a backend.
              </p>
              <Button type="button" variant="outline" onClick={chooseFile} className="mt-4">
                Choose file
              </Button>
            </div>

            <div className="rounded-md border border-[#E5E7EB] bg-white p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                  <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#111827]">{fileName}</p>
                  <p className="text-xs text-[#6B7280]">
                    Expected columns: metric_name, quarter, actual_value, plan_value
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md bg-[#F9FAFB] p-3">
                <p className="text-xs font-medium text-[#6B7280]">Max file size</p>
                <p className="mt-1 text-sm font-semibold text-[#111827]">50 MB</p>
              </div>
              <div className="rounded-md bg-[#F9FAFB] p-3">
                <p className="text-xs font-medium text-[#6B7280]">Encoding</p>
                <p className="mt-1 text-sm font-semibold text-[#111827]">UTF-8</p>
              </div>
              <div className="rounded-md bg-[#F9FAFB] p-3">
                <p className="text-xs font-medium text-[#6B7280]">Rows</p>
                <p className="mt-1 text-sm font-semibold text-[#111827]">Auto-profiled</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[#E5E7EB] bg-[#F9FAFB] p-4">
            <Dialog.Close asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Dialog.Close>
            <Button type="button" onClick={handleUpload} className="gap-2">
              <Upload className="h-4 w-4" aria-hidden="true" />
              Import CSV
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
