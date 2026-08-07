import React, { useState } from "react";
import { ExcelUtils, parsePlayerStatsExcel } from "../lib/excelUtils";
import { Download, Upload, User, CheckCircle2, AlertTriangle } from "lucide-react";
import { UserProfile, UserRole } from "../types";

interface PlayerStatsBulkImportProps {
  currentUser?: UserProfile | null;
  onImportSuccess?: () => void;
}

export default function PlayerStatsBulkImport({ currentUser, onImportSuccess }: PlayerStatsBulkImportProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<{
    success: boolean;
    message: string;
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
      const res = await parsePlayerStatsExcel(file);
      setStatus({
        success: true,
        message: `Successfully uploaded & synced ${res.count} individual player performance records into public.player_stats.`
      });

      if (onImportSuccess) onImportSuccess();
    } catch (err: any) {
      setStatus({
        success: false,
        message: `Error uploading Player Performance Excel: ${err?.message || String(err)}`
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
    <div className="rounded-xl border border-slate-800 bg-[#0f172a] p-5 shadow-xl text-white space-y-4" id="player-stats-bulk-import-root">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="bg-cyan-500/15 border border-cyan-500/30 p-2 rounded-lg text-cyan-400">
            <User className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display font-black text-sm text-white uppercase tracking-wider">
              Player Stats Bulk Import (Admin Center)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Batch upload individual player match logs directly into public.player_stats using Player_Performance_Template.xlsx.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => ExcelUtils.downloadPlayerPerformanceTemplate()}
          className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold py-2 px-3 rounded-lg text-cyan-300 transition-colors shadow-sm cursor-pointer shrink-0"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Download Template</span>
        </button>
      </div>

      {/* Upload Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-5 text-center transition-all ${
          dragOver ? "border-cyan-400 bg-cyan-500/10" : "border-slate-700 hover:border-slate-600 bg-slate-900/50"
        } ${!isStaff ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <input
          type="file"
          accept=".xlsx, .xls, .csv"
          onChange={handleInputChange}
          disabled={!isStaff || isUploading}
          className="hidden"
          id="player-stats-excel-input"
        />

        <label htmlFor="player-stats-excel-input" className="cursor-pointer block space-y-2">
          <div className="mx-auto w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Upload className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">
              {isUploading ? "Uploading Player Performance Stats..." : "Click or Drag & Drop Player Stats Excel File"}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Supports .xlsx, .xls, or .csv pre-formatted files
            </p>
          </div>
        </label>
      </div>

      {/* Status Feedback */}
      {status && (
        <div className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs font-sans font-semibold ${
          status.success
            ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-300"
            : "bg-rose-950/40 border-rose-800/60 text-rose-300"
        }`}>
          {status.success ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
          )}
          <div>
            <p className="font-bold">{status.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
