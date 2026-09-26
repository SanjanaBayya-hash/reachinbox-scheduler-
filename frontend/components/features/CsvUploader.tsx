'use client';

import Papa from 'papaparse';
import { useRef, useState } from 'react';
import { parseLeads, type ParsedLeads } from '../../lib/leadParser';

export type { ParsedLeads };

export function CsvUploader({ onParsed }: { onParsed: (result: ParsedLeads) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [summary, setSummary] = useState<ParsedLeads | null>(null);

  function handleFile(file: File) {
    setFileName(file.name);
    Papa.parse<string[]>(file, {
      complete: (results) => {
        const flat = results.data.flat().map((v) => String(v ?? ''));
        const parsed = parseLeads(flat);
        setSummary(parsed);
        onParsed(parsed);
      },
      skipEmptyLines: true,
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full rounded-card border-2 border-dashed border-gray-300 py-6 text-center text-sm text-gray-500 hover:border-brand-400 hover:text-brand-600"
      >
        {fileName ? `Selected: ${fileName}` : 'Click to upload a CSV or TXT file of lead emails'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.txt"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      {summary && (
        <p className="text-xs text-gray-500">
          {summary.valid.length} valid emails detected
          {summary.duplicateCount > 0 && `, ${summary.duplicateCount} duplicates skipped`}
          {summary.invalidCount > 0 && `, ${summary.invalidCount} invalid entries skipped`}.
        </p>
      )}
    </div>
  );
}
