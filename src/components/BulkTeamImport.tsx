import React, { useState } from "react";
import { ExcelUtils, parseAndUploadExcel, selfSimulateExcelUpload } from "../lib/excelUtils";
import { DataService } from "../lib/dataService";
import { Download, Upload, Shield, CheckCircle2, AlertTriangle, PlayCircle, Info } from "lucide-react";
import { UserProfile, UserRole } from "../types";

interface BulkTeamImportProps {
  currentUser?: UserProfile | null;
  onTeamsUpdated?: () => void;
}

export default function BulkTeamImport({ currentUser, onTeamsUpdated }: BulkTeamImportProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<{
    success: boolean;
    message: string;
    details?: string[];
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const isStaff = currentUser
    ? (currentUser.role === UserRole.HeadCoach ||
       currentUser.role === UserRole.Manager ||
       currentUser.role === UserRole.Analyst ||
       currentUser.isAdmin)
    : true;

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setIsUploading(true);
    setStatus(null);

    try {
      const res = await parseAndUploadExcel(file, 'teams');

      setStatus({
        success: true,
        message: `Successfully full-synced ${res.count} teams into the Supabase database.`,
      });

      if (onTeamsUpdated) {
        onTeamsUpdated();
      }
    } catch (err: any) {
      setStatus({
        success: false,
        message: `Error parsing Team Registration Excel: ${err?.message || String(err)}`
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRunSelfTest = async () => {
    setIsUploading(true);
    setStatus(null);
    try {
      const result = await selfSimulateExcelUpload();
      setStatus({
        success: result.success,
        message: result.details
      });
      if (result.success && onTeamsUpdated) {
        onTeamsUpdated();
      }
    } catch (err: any) {
      setStatus({
        success: false,
        message: `Self-simulation test failed: ${err?.message || String(err)}`
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0f172a] p-5 shadow-xl text-white space-y-4" id="bulk-team-import-root">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="bg-cyan-500/15 border border-cyan-500/30 p-2 rounded-lg text-cyan-400">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display font-bold text-base text-white flex items-center gap-2">
              Bulk Team Import & Supabase Sync
            </h3>
            <p className="text-xs text-slate-400">
              Register new club teams and league opponents directly into the Supabase database.
            </p>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRunSelfTest}
            disabled={isUploading}
            className="inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 px-3 rounded-lg transition-all cursor-pointer shadow-md shrink-0 disabled:opacity-50"
          >
            <PlayCircle className="h-4 w-4" />
            <span>Run Self-Simulation Test</span>
          </button>

          <button
            type="button"
            onClick={() => ExcelUtils.downloadTeamRegistrationTemplate()}
            className="inline-flex items-center justify-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold py-2 px-3 rounded-lg transition-all cursor-pointer shadow-md shrink-0"
          >
            <Download className="h-4 w-4" />
            <span>Download Template</span>
          </button>
        </div>
      </div>

      {/* Automated Team ID Assignment Info Note */}
      <div className="bg-cyan-950/40 border border-cyan-800/50 rounded-lg p-3 text-xs text-slate-300 flex items-start gap-2.5">
        <Info className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-cyan-200">Automated Team ID Assignment</p>
          <p className="text-slate-300 text-[11px] leading-relaxed mt-0.5">
            Team IDs are automatically generated upon upload. Only <span className="text-white font-semibold">Team Name</span> is mandatory. Fields like <span className="text-slate-200 font-medium">Short Name</span>, <span className="text-slate-200 font-medium">Division</span>, and <span className="text-slate-200 font-medium">Home Venue</span> are optional.
          </p>
        </div>
      </div>

      {/* Drag and Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all ${
          dragOver 
            ? "border-cyan-400 bg-cyan-950/30" 
            : "border-slate-700/80 bg-slate-900/60 hover:border-slate-500"
        }`}
      >
        <input
          type="file"
          accept=".xlsx, .xls, .csv"
          disabled={!isStaff || isUploading}
          onChange={handleInputChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />

        <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
          <div className="bg-slate-800 border border-slate-700 p-3 rounded-full text-cyan-400">
            <Upload className={`h-6 w-6 ${isUploading ? "animate-bounce" : ""}`} />
          </div>
          <div>
            <p className="text-sm font-bold text-white">
              {isUploading ? "Parsing Spreadsheet & Upserting to Supabase..." : "Click to select or drag & drop Team Registration Excel (.xlsx / .csv)"}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Client-Side SheetJS Parsing | Recommended Headers: <span className="text-slate-200 font-semibold">Team Name (Mandatory), Short Name (Optional), Division (Optional), Home Venue (Optional)</span>
            </p>
          </div>
        </div>
      </div>

      {/* Status Output Banner */}
      {status && (
        <div className={`rounded-lg border p-4 text-xs font-sans space-y-1.5 ${
          status.success 
            ? "border-emerald-800/60 bg-emerald-950/40 text-emerald-300" 
            : "border-rose-800/60 bg-rose-950/40 text-rose-300"
        }`}>
          <div className="flex items-center gap-2 font-bold text-sm">
            {status.success ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
            )}
            <span>{status.message}</span>
          </div>

          {status.details && status.details.length > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-800/60 font-mono text-[11px] space-y-1 text-slate-300 max-h-32 overflow-y-auto">
              <p className="font-bold text-slate-200">Validation & Parsing Log:</p>
              {status.details.map((d, i) => (
                <p key={i} className="text-amber-300">• {d}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
