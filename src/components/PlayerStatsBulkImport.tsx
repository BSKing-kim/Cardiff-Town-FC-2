import React, { useState } from "react";
import { ExcelUtils, parseAndUploadExcel } from "../lib/excelUtils";
import { supabase } from "../lib/supabase";
import { DataService } from "../lib/dataService";
import { Download, Upload, User, CheckCircle2, AlertTriangle, Info, FileSpreadsheet } from "lucide-react";
import { UserProfile, UserRole } from "../types";
import * as XLSX from "xlsx";

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

      // Fetch profiles for username & player_id mapping
      const { data: profiles } = await (supabase.from('profiles') as any).select('*');
      const profileMap = new Map<string, any>();
      if (profiles && Array.isArray(profiles)) {
        profiles.forEach((p: any) => {
          if (p.username) profileMap.set(p.username.trim().toLowerCase(), p);
          if (p.full_name) profileMap.set(p.full_name.trim().toLowerCase(), p);
        });
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

      const sanitizedRows = rawRows.map(row => {
        const username = extractString(row, ['username', 'Username', 'User Name', 'player_name', 'Player Name', '선수명']);
        const matchId = extractString(row, ['match_id', 'Match ID', 'Game ID', 'Match', '매치ID']) || 'M01';
        
        const matchedProfile = profileMap.get(username.toLowerCase());
        const playerId = matchedProfile?.player_id || matchedProfile?.id || matchedProfile?.user_id || `PLR-${username.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
        const playerName = matchedProfile?.full_name || username;

        const goals = extractInt(row, ['goals', 'Goals']);
        const shots = extractInt(row, ['shots', 'Shots']);
        const shotsOnTarget = extractInt(row, ['shots_on_target', 'Shots On Target', 'sot']);

        const passes = extractInt(row, ['passes', 'Passes', 'total_passes']);
        const successfulPasses = extractInt(row, ['successful_passes', 'Successful Passes', 'completed_passes']);
        const backwardsPasses = extractInt(row, ['backwards_passes', 'Backwards Passes', 'backward_passes']);
        const forwardsPasses = extractInt(row, ['forwards_passes', 'Forwards Passes', 'forward_passes']);
        const longPasses = extractInt(row, ['long_passes', 'Long Passes']);
        const successfulLongPasses = extractInt(row, ['successful_long_passes', 'Successful Long Passes']);
        const keyPasses = extractInt(row, ['key_passes', 'Key Passes']);
        const successfulKeyPasses = extractInt(row, ['successful_key_passes', 'Successful Key Passes']);
        const throughBalls = extractInt(row, ['through_balls', 'Through Balls']);
        const successfulThroughBalls = extractInt(row, ['successful_through_balls', 'Successful Through Balls']);
        const crosses = extractInt(row, ['crosses', 'Crosses']);
        const successfulCrosses = extractInt(row, ['successful_crosses', 'Successful Crosses']);

        const dribbles = extractInt(row, ['dribbles', 'Dribbles']);
        const successfulDribbles = extractInt(row, ['successful_dribbles', 'Successful Dribbles']);
        const duels = extractInt(row, ['duels', 'Duels']);
        const duelsWon = extractInt(row, ['duels_won', 'Duels Won']);
        const aerialDuels = extractInt(row, ['aerial_duels', 'Aerial Duels']);
        const aerialDuelsWon = extractInt(row, ['aerial_duels_won', 'Aerial Duels Won']);
        const groundDuels = extractInt(row, ['ground_duels', 'Ground Duels']);
        const groundDuelsWon = extractInt(row, ['ground_duels_won', 'Ground Duels Won']);

        const tackles = extractInt(row, ['tackles', 'Tackles']);
        const tacklesWon = extractInt(row, ['tackles_won', 'Tackles Won']);
        const ballRecoveries = extractInt(row, ['ball_recoveries', 'Ball Recoveries', 'recoveries']);
        const interceptions = extractInt(row, ['interceptions', 'Interceptions']);
        const clearances = extractInt(row, ['clearances', 'Clearances']);
        const blocks = extractInt(row, ['blocks', 'Blocks']);

        const ownGoals = extractInt(row, ['own_goals', 'Own Goals']);
        const turnovers = extractInt(row, ['turnovers', 'Turnovers']);
        const miscontrols = extractInt(row, ['miscontrols', 'Miscontrols']);
        const unsuccessfulDribbles = extractInt(row, ['unsuccessful_dribbles', 'Unsuccessful Dribbles']);
        const possessionLost = extractInt(row, ['possession_lost', 'Possession Lost']);
        const offsides = extractInt(row, ['offsides', 'Offsides']);
        const fouls = extractInt(row, ['fouls', 'Fouls']);
        const yellowCards = extractInt(row, ['yellow_cards', 'Yellow Cards']);
        const redCards = extractInt(row, ['red_cards', 'Red Cards']);

        const recId = `${matchId}_${username.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

        return {
          id: recId,
          match_id: matchId,
          player_id: playerId,
          player_name: playerName,
          username: username,
          goals,
          shots,
          shots_on_target: shotsOnTarget,
          passes,
          total_passes: passes,
          successful_passes: successfulPasses,
          completed_passes: successfulPasses,
          backwards_passes: backwardsPasses,
          forwards_passes: forwardsPasses,
          long_passes: longPasses,
          successful_long_passes: successfulLongPasses,
          key_passes: keyPasses,
          successful_key_passes: successfulKeyPasses,
          through_balls: throughBalls,
          successful_through_balls: successfulThroughBalls,
          crosses: crosses,
          successful_crosses: successfulCrosses,
          dribbles: dribbles,
          successful_dribbles: successfulDribbles,
          duels: duels,
          duels_won: duelsWon,
          aerial_duels: aerialDuels,
          aerial_duels_won: aerialDuelsWon,
          ground_duels: groundDuels,
          ground_duels_won: groundDuelsWon,
          tackles: tackles,
          tackles_won: tacklesWon,
          ball_recoveries: ballRecoveries,
          interceptions: interceptions,
          clearances: clearances,
          blocks: blocks,
          own_goals: ownGoals,
          turnovers: turnovers,
          miscontrols: miscontrols,
          unsuccessful_dribbles: unsuccessfulDribbles,
          possession_lost: possessionLost,
          offsides: offsides,
          fouls: fouls,
          yellow_cards: yellowCards,
          red_cards: redCards,
          created_at: new Date().toISOString()
        };
      }).filter(r => r.username !== '' || r.match_id !== '');

      if (sanitizedRows.length === 0) {
        throw new Error("No valid player stat rows found in Excel file.");
      }

      try {
        const { error } = await (supabase.from('match_logs') as any)
          .upsert(sanitizedRows, { onConflict: 'id' });
        if (error) console.warn("match_logs upsert warning:", error.message);
      } catch (e) {
        console.warn("match_logs exception:", e);
      }

      await DataService.savePlayerMatchRecords(sanitizedRows.map(r => ({
        id: r.id,
        matchId: r.match_id,
        playerId: r.player_id,
        playerName: r.player_name,
        username: r.username,
        goals: r.goals,
        shots: r.shots,
        shotsOnTarget: r.shots_on_target,
        totalPasses: r.passes,
        completedPasses: r.successful_passes,
        tackles: r.tackles,
        tacklesWon: r.tackles_won,
        interceptions: r.interceptions,
        ...r
      })));

      setStatus({
        success: true,
        message: `Successfully uploaded & synced performance stats for ${sanitizedRows.length} player match entries.`
      });

      if (onImportSuccess) onImportSuccess();
    } catch (err: any) {
      setStatus({
        success: false,
        message: `Error uploading Player Stats Excel: ${err?.message || String(err)}`
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
          <div className="bg-amber-500/15 border border-amber-500/30 p-2 rounded-lg text-amber-400">
            <User className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display font-black text-sm text-white uppercase tracking-wider">
              Player Stats Bulk Import (Admin Only)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Upload individual player performance logs using the Player Stats Excel Template.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => ExcelUtils.downloadPlayerStatsTemplate()}
          className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold py-2 px-3 rounded-lg text-amber-300 transition-colors shadow-sm cursor-pointer shrink-0"
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
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
          dragOver ? "border-amber-400 bg-amber-500/10" : "border-slate-700 hover:border-slate-600 bg-slate-900/50"
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

        <label htmlFor="player-stats-excel-input" className="cursor-pointer block space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Upload className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">
              {isUploading ? "Processing & Uploading Player Stats..." : "Click or Drag & Drop Player Stats Excel File"}
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
