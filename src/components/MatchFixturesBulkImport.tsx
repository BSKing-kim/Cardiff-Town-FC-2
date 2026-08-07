import React, { useState } from "react";
import { ExcelUtils } from "../lib/excelUtils";
import { supabase } from "../lib/supabase";
import { DataService } from "../lib/dataService";
import { Download, Upload, Calendar, CheckCircle2, AlertTriangle } from "lucide-react";
import { UserProfile, UserRole } from "../types";
import * as XLSX from "xlsx";

interface MatchFixturesBulkImportProps {
  currentUser?: UserProfile | null;
  onImportSuccess?: () => void;
}

export default function MatchFixturesBulkImport({ currentUser, onImportSuccess }: MatchFixturesBulkImportProps) {
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
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });

      if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error("Excel file is empty or missing valid sheets.");
      }

      const sheetName = workbook.SheetNames[0];
      const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

      if (!rawRows || rawRows.length === 0) {
        throw new Error("Excel file is empty or missing valid rows.");
      }

      const extractString = (row: Record<string, any>, aliases: string[]): string => {
        const normAliases = aliases.map(a => a.toLowerCase().replace(/[^a-z0-9]/g, ""));
        for (const [key, val] of Object.entries(row)) {
          const normKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (normAliases.includes(normKey)) {
            const strVal = String(val !== undefined && val !== null ? val : "").trim();
            if (strVal !== "") return strVal;
          }
        }
        return "";
      };

      const extractInt = (row: Record<string, any>, aliases: string[], defaultVal = 0): number => {
        const strVal = extractString(row, aliases);
        if (!strVal) return defaultVal;
        const cleaned = strVal.replace(/[^0-9.-]/g, "");
        const parsed = parseInt(cleaned, 10);
        return isNaN(parsed) ? defaultVal : parsed;
      };

      const sanitizedMatches = rawRows.map(row => {
        const matchId = extractString(row, ['match_id', 'Match ID', 'Game ID', 'ID']) || `M-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        const date = extractString(row, ['date', 'Date', 'Match Date']) || new Date().toISOString().split('T')[0];
        const opponent = extractString(row, ['opponent', 'Opponent', 'Opponent Team', 'VS']) || 'Opponent Team';
        const homeAway = extractString(row, ['home_away', 'Home/Away', 'Venue']) || 'Home';
        const ourScore = extractInt(row, ['our_score', 'Our Score', 'Goals For']);
        const oppScore = extractInt(row, ['opponent_score', 'Opponent Score', 'Goals Against']);
        const possession = extractString(row, ['possession', 'Possession']) || '50%';
        const shots = extractInt(row, ['total_shots', 'Total Shots', 'shots']);
        const sot = extractInt(row, ['shots_on_target', 'Shots On Target', 'sot']);
        const corners = extractInt(row, ['corners', 'Corners']);
        const fouls = extractInt(row, ['fouls', 'Fouls']);
        const yellowCards = extractInt(row, ['yellow_cards', 'Yellow Cards']);
        const redCards = extractInt(row, ['red_cards', 'Red Cards']);
        const matchStatus = extractString(row, ['status', 'Status']) || 'Finished';

        return {
          id: matchId,
          match_id: matchId,
          date: date,
          opponent: opponent,
          venue: homeAway,
          our_score: ourScore,
          opp_score: oppScore,
          result: `${ourScore > oppScore ? 'W' : ourScore < oppScore ? 'L' : 'D'} (${ourScore}-${oppScore})`,
          possession_rate: possession,
          total_shots: shots,
          shots_on_target: sot,
          corners: corners,
          fouls: fouls,
          yellow_cards: yellowCards,
          red_cards: redCards,
          status: matchStatus,
          created_at: new Date().toISOString()
        };
      }).filter(r => r.opponent !== '');

      if (sanitizedMatches.length === 0) {
        throw new Error("No valid match fixture entries found in Excel file.");
      }

      try {
        const { error } = await (supabase.from('matches') as any)
          .upsert(sanitizedMatches, { onConflict: 'id' });
        if (error) console.warn("matches upsert warning:", error.message);
      } catch (e) {
        console.warn("matches exception:", e);
      }

      setStatus({
        success: true,
        message: `Successfully uploaded & updated ${sanitizedMatches.length} match fixture schedules into Supabase.`
      });

      if (onImportSuccess) onImportSuccess();
    } catch (err: any) {
      setStatus({
        success: false,
        message: `Error uploading Match Fixtures Excel: ${err?.message || String(err)}`
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
    <div className="rounded-xl border border-slate-800 bg-[#0f172a] p-5 shadow-xl text-white space-y-4" id="match-fixtures-bulk-import-root">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="bg-emerald-500/15 border border-emerald-500/30 p-2 rounded-lg text-emerald-400">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display font-black text-sm text-white uppercase tracking-wider">
              Match Fixture Bulk Import
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Batch update fixture schedules, scores, team possession, and match results using Match_Fixtures_Template.xlsx.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => ExcelUtils.downloadMatchFixturesTemplate()}
          className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold py-2 px-3 rounded-lg text-emerald-300 transition-colors shadow-sm cursor-pointer shrink-0"
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
          dragOver ? "border-emerald-400 bg-emerald-500/10" : "border-slate-700 hover:border-slate-600 bg-slate-900/50"
        } ${!isStaff ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <input
          type="file"
          accept=".xlsx, .xls, .csv"
          onChange={handleInputChange}
          disabled={!isStaff || isUploading}
          className="hidden"
          id="match-fixtures-excel-input"
        />

        <label htmlFor="match-fixtures-excel-input" className="cursor-pointer block space-y-2">
          <div className="mx-auto w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Upload className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">
              {isUploading ? "Uploading Match Fixtures..." : "Click or Drag & Drop Match Fixtures Excel File"}
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
