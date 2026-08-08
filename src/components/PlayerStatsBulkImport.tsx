import React, { useState, useEffect } from "react";
import { ExcelUtils, parsePlayerStatsExcel } from "../lib/excelUtils";
import { supabase } from "../lib/supabase";
import { Download, Upload, User, CheckCircle2, AlertTriangle, ChevronDown, Calendar } from "lucide-react";
import { UserProfile, UserRole } from "../types";

interface MatchOption {
  id: string;
  date: string;
  opponent: string;
  venue: string;
  label: string;
}

interface PlayerStatsBulkImportProps {
  currentUser?: UserProfile | null;
  onImportSuccess?: () => void;
}

export default function PlayerStatsBulkImport({ currentUser, onImportSuccess }: PlayerStatsBulkImportProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [matchOptions, setMatchOptions] = useState<MatchOption[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>('');
  const [loadingMatches, setLoadingMatches] = useState(true);

  const isStaff = currentUser
    ? (currentUser.role === UserRole.HeadCoach ||
       currentUser.role === UserRole.Manager ||
       currentUser.role === UserRole.Analyst ||
       currentUser.isAdmin)
    : true;

  // Fetch matches from public.matches ordered by date descending
  useEffect(() => {
    const fetchMatches = async () => {
      setLoadingMatches(true);
      try {
        const { data, error } = await (supabase.from('matches') as any)
          .select('id, date, opponent, venue, home_away')
          .order('date', { ascending: false })
          .limit(50);

        if (!error && Array.isArray(data) && data.length > 0) {
          const options: MatchOption[] = data.map((m: any) => {
            const venueLabel = m.venue || m.home_away || 'Home';
            const dateLabel = m.date ? String(m.date).slice(0, 10) : 'Unknown date';
            const oppLabel = m.opponent || 'Unknown Opponent';
            return {
              id:       String(m.id).trim(),
              date:     dateLabel,
              opponent: oppLabel,
              venue:    venueLabel,
              label:    `${dateLabel} | vs ${oppLabel} (${venueLabel})`
            };
          });
          setMatchOptions(options);
          // Default to the most recent match
          setSelectedMatchId(options[0].id);
        } else {
          // Fallback: allow manual entry
          setMatchOptions([]);
          setSelectedMatchId('M01');
        }
      } catch (e) {
        console.warn('Failed to load matches for selector:', e);
        setSelectedMatchId('M01');
      } finally {
        setLoadingMatches(false);
      }
    };
    fetchMatches();
  }, []);

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    if (!selectedMatchId) {
      setStatus({ success: false, message: 'Please select a target match before uploading.' });
      return;
    }
    setIsUploading(true);
    setStatus(null);

    try {
      // Pass selectedMatchId so every row gets the correct match_id
      const res = await parsePlayerStatsExcel(file, selectedMatchId);
      setStatus({
        success: true,
        message: `Successfully uploaded ${res.count} player stat records into public.player_stats for match: ${selectedMatchId}.`
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
    if (file) handleFileUpload(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  const selectedMatch = matchOptions.find(m => m.id === selectedMatchId);

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
              Select a match, download the pre-filled template, enter player stats, then upload.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => ExcelUtils.downloadPlayerPerformanceTemplate(selectedMatchId || 'M01')}
          className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold py-2 px-3 rounded-lg text-cyan-300 transition-colors shadow-sm cursor-pointer shrink-0"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Download Template</span>
        </button>
      </div>

      {/* Match Selector */}
      <div className="space-y-1.5">
        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-300 uppercase tracking-wide">
          <Calendar className="h-3.5 w-3.5 text-cyan-400" />
          Target Match:
        </label>
        <div className="relative">
          {loadingMatches ? (
            <div className="w-full bg-slate-800/70 border border-slate-700 rounded-lg px-3 py-2.5 text-xs text-slate-400 animate-pulse">
              Loading matches...
            </div>
          ) : matchOptions.length > 0 ? (
            <>
              <select
                id="player-stats-match-selector"
                value={selectedMatchId}
                onChange={e => setSelectedMatchId(e.target.value)}
                className="w-full appearance-none bg-slate-800/70 border border-slate-700 hover:border-cyan-500/50 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 rounded-lg px-3 py-2.5 pr-9 text-xs text-white transition-colors outline-none cursor-pointer"
              >
                {matchOptions.map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            </>
          ) : (
            /* Fallback to manual text input if no matches found */
            <input
              id="player-stats-match-id-input"
              type="text"
              value={selectedMatchId}
              onChange={e => setSelectedMatchId(e.target.value)}
              placeholder="Enter match ID (e.g. M01)"
              className="w-full bg-slate-800/70 border border-slate-700 rounded-lg px-3 py-2.5 text-xs text-white outline-none focus:border-cyan-500 transition-colors"
            />
          )}
        </div>
        {selectedMatch && (
          <p className="text-[11px] text-cyan-400/70 pl-0.5">
            Match ID: <span className="font-mono font-bold text-cyan-300">{selectedMatchId}</span> — all uploaded rows will be assigned to this match.
          </p>
        )}
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
              Supports .xlsx, .xls, or .csv — all rows target match <span className="text-cyan-300 font-mono">{selectedMatchId || '(select above)'}</span>
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
