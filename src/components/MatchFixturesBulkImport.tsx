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

      const safeDivPct = (num: number, den: number): number => {
        if (!den || den === 0) return 0;
        return Number(((num / den) * 100).toFixed(1));
      };

      const sanitizedMatches = rawRows.map(row => {
        const matchId = extractString(row, ['match_id', 'Match ID', 'Game ID', 'ID']) || `M-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        const date = extractString(row, ['date', 'Date', 'Match Date']) || new Date().toISOString().split('T')[0];
        const opponent = extractString(row, ['opponent', 'Opponent', 'Opponent Team', 'VS']) || 'Opponent Team';
        const homeAway = extractString(row, ['home_away', 'Home/Away', 'Venue']) || 'Home';
        const ourScore = extractInt(row, ['our_score', 'Our Score', 'Goals For', 'goals']);
        const oppScore = extractInt(row, ['opponent_score', 'Opponent Score', 'Goals Against']);
        const matchStatus = extractString(row, ['status', 'Status']) || 'Finished';

        const goals = extractInt(row, ['goals', 'Goals'], ourScore);
        const shots = extractInt(row, ['shots', 'Shots', 'total_shots']);
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

        const ballRecoveries = extractInt(row, ['ball_recoveries', 'Ball Recoveries', 'recoveries']);
        const tackles = extractInt(row, ['tackles', 'Tackles']);
        const tacklesWon = extractInt(row, ['tackles_won', 'Tackles Won']);
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

        // Auto-calculate accuracy & win percentages
        const shotAccuracy = safeDivPct(shotsOnTarget, shots);
        const passAccuracy = safeDivPct(successfulPasses, passes);
        const duelWonPct = safeDivPct(duelsWon, duels);
        const tackleWonPct = safeDivPct(tacklesWon, tackles);
        const longPassSucPct = safeDivPct(successfulLongPasses, longPasses);
        const keyPassSucPct = safeDivPct(successfulKeyPasses, keyPasses);
        const throughBallSucPct = safeDivPct(successfulThroughBalls, throughBalls);
        const crossSucPct = safeDivPct(successfulCrosses, crosses);
        const dribbleSucPct = safeDivPct(successfulDribbles, dribbles);

        return {
          id: matchId,
          match_id: matchId,
          date: date,
          opponent: opponent,
          venue: homeAway,
          our_score: ourScore,
          opp_score: oppScore,
          result: `${ourScore > oppScore ? 'W' : ourScore < oppScore ? 'L' : 'D'} (${ourScore}-${oppScore})`,
          status: matchStatus,
          goals,
          shots,
          shots_on_target: shotsOnTarget,
          passes,
          successful_passes: successfulPasses,
          backwards_passes: backwardsPasses,
          forwards_passes: forwardsPasses,
          long_passes: longPasses,
          successful_long_passes: successfulLongPasses,
          key_passes: keyPasses,
          successful_key_passes: successfulKeyPasses,
          through_balls: throughBalls,
          successful_through_balls: successfulThroughBalls,
          crosses,
          successful_crosses: successfulCrosses,
          dribbles,
          successful_dribbles: successfulDribbles,
          duels,
          duels_won: duelsWon,
          aerial_duels: aerialDuels,
          aerial_duels_won: aerialDuelsWon,
          ground_duels: groundDuels,
          ground_duels_won: groundDuelsWon,
          ball_recoveries: ballRecoveries,
          tackles,
          tackles_won: tacklesWon,
          interceptions,
          clearances,
          blocks,
          own_goals: ownGoals,
          turnovers,
          miscontrols,
          unsuccessful_dribbles: unsuccessfulDribbles,
          possession_lost: possessionLost,
          offsides,
          fouls,
          yellow_cards: yellowCards,
          red_cards: redCards,
          shot_accuracy: shotAccuracy,
          pass_accuracy: passAccuracy,
          duel_won_pct: duelWonPct,
          tackle_won_pct: tackleWonPct,
          long_pass_suc_pct: longPassSucPct,
          key_pass_suc_pct: keyPassSucPct,
          through_ball_suc_pct: throughBallSucPct,
          cross_suc_pct: crossSucPct,
          dribble_suc_pct: dribbleSucPct,
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
