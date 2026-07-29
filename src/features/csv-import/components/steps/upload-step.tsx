"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB — a brokerage activity export is never remotely this large; a bigger file is almost certainly not a CSV

export function UploadStep({ onFileSelected }: { onFileSelected: (file: File) => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function validateAndEmit(file: File) {
    const looksLikeCsv = file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv";
    if (!looksLikeCsv) {
      toast.error("Please choose a .csv file.");
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error("File is too large (max 10MB).");
      return;
    }
    if (file.size === 0) {
      toast.error("This file is empty.");
      return;
    }
    onFileSelected(file);
  }

  return (
    <div
      className={cn(
        "border-border flex flex-col items-center gap-3 rounded-lg border-2 border-dashed px-6 py-16 text-center transition-colors",
        isDragging && "border-primary bg-accent",
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) validateAndEmit(file);
      }}
    >
      <p className="font-medium">Drag and drop a CSV file here</p>
      <p className="text-muted-foreground text-sm">or</p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
      >
        Choose file
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) validateAndEmit(file);
          e.target.value = "";
        }}
      />
      <p className="text-muted-foreground mt-2 text-xs">
        The file is parsed in your browser and never uploaded as-is — only the resulting transactions (and a
        checksum of the file) are sent to the server.
      </p>
    </div>
  );
}
