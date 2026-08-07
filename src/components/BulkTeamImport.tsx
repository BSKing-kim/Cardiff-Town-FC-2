import React, { useState } from "react";
import { ExcelUtils, parseAndUploadExcel, selfSimulateExcelUpload } from "../lib/excelUtils";
import { Download, Upload, Users, CheckCircle2, AlertTriangle, PlayCircle } from "lucide-react";
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
        message: `Successfully registered and synced ${res.count} team/roster entries into Supabase database.`,
      });

      if (onTeamsUpdated) {
        onTeamsUpdated();
      }
    } catch (err: any) {
      setStatus({
        success: false,
        message: `Error parsing Team & Roster Excel: ${err?.message || String(err)}`
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
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display font-black text-sm text-white uppercase tracking-wider">
              Team & Roster Bulk Import (Admin Only)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Register squad members, coaching staff, and league opponent rosters using the Team Roster Excel Template.
            </p>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => ExcelUtils.downloadTeamRosterTemplate()}
            className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold py-2 px-3 rounded-lg text-cyan-300 transition-colors shadow-sm cursor-pointer shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download Template</span>
          </button>

          <button
            type="button"
            onClick={handleRunSelfTest}
            disabled={isUploading}
            className="inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 px-3 rounded-lg transition-all cursor-pointer shadow-md shrink-0 disabled:opacity-50"
          >
            <PlayCircle className="h-3.5 w-3.5" />
            <span>Simulate Upload</span>
          </button>
        </div>
      </div>

      {/* Upload Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
          dragOver ? "border-cyan-400 bg-cyan-500/10" : "border-slate-700 hover:border-slate-600 bg-slate-900/50"
        } ${!isStaff ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <input
          type="file"
          accept=".xlsx, .xls, .csv"
          onChange={handleInputChange}
          disabled={!isStaff || isUploading}
          className="hidden"
          id="team-excel-input"
        />

        <label htmlFor="team-excel-input" className="cursor-pointer block space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Upload className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">
              {isUploading ? "Syncing Team & Roster to Supabase..." : "Click or Drag & Drop Team Roster Excel File"}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Supports .xlsx, .xls, or .csv pre-formatted files
            </p>
          </div>
        </label>
      </div>

      {/* Status Feedback */}
      {status && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 text-xs font-sans font-semibold ${
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
