import React, { useState, useEffect } from "react";
import { MatchFixture, CustomTeam, UserProfile, UserRole } from "../types";
import { DataService } from "../lib/dataService";
import { LEAGUES, calculateDivisionStandings, TeamStanding } from "../lib/leagueData";
import { Trophy, Shield, RefreshCw, Upload, Search, Download, Filter } from "lucide-react";
import TeamLogo from "./TeamLogo";
import { ExcelUtils, parseAndUploadExcel } from "../lib/excelUtils";

interface LeagueStandingsProps {
  customTeams?: CustomTeam[];
  currentUser?: UserProfile | null;
  onSelectOpponent?: (opponent: string) => void;
  onTeamsUpdated?: () => void;
  embeddedMode?: boolean;
}

export default function LeagueStandings({
  customTeams = [],
  currentUser,
  onSelectOpponent,
  onTeamsUpdated,
  embeddedMode = false
}: LeagueStandingsProps) {
  const [activeDivisionIdx, setActiveDivisionIdx] = useState<number>(1); // Default to CCFL First Division (Cardiff Town FC's division)
  const [fixtures, setFixtures] = useState<MatchFixture[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadMessage, setUploadMessage] = useState<{ success: boolean; text: string } | null>(null);

  const isStaff = currentUser && (currentUser.isAdmin || currentUser.role !== UserRole.Player);
  const activeDivision = LEAGUES[activeDivisionIdx];

  const loadData = async () => {
    setLoading(true);
    try {
      const fixList = await DataService.getFixtures();
      setFixtures(fixList);
    } catch (e) {
      console.error("Failed to load fixtures for standings:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const standings = calculateDivisionStandings(activeDivision, fixtures, customTeams);

  const filteredStandings = searchQuery.trim() === ""
    ? standings
    : standings.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase().trim()));

  const handleTeamsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm("Uploading a new teams list will update the league roster. Continue?")) {
      e.target.value = "";
      return;
    }

    setIsUploading(true);
    setUploadMessage(null);

    try {
      const res = await parseAndUploadExcel(file, 'teams');

      setUploadMessage({
        success: true,
        text: `Successfully imported & synced ${res.count} teams across divisions into Supabase!`
      });

      if (onTeamsUpdated) onTeamsUpdated();
      await loadData();
    } catch (err: any) {
      setUploadMessage({
        success: false,
        text: err.message || "Failed to process teams Excel file."
      });
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className={`space-y-5 font-sans ${embeddedMode ? "" : "p-1"}`} id="league-standings-root">
      
      {/* Top Header & Division Tabs */}
      {!embeddedMode && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#111827] border border-[#334155] p-5 rounded-2xl shadow-xl">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="h-6 w-6 text-[#eab308]" />
              <h2 className="font-display font-black text-xl text-white tracking-wide uppercase">
                CCFL Official League Standings
              </h2>
            </div>
            <p className="text-xs text-[#94a3b8] font-mono">
              Cardiff Combination Football League • Real-time Automated Calculations
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isStaff && (
              <>
                <input
                  type="file"
                  id="standings-teams-upload"
                  accept=".xlsx, .xls"
                  className="hidden"
                  onChange={handleTeamsUpload}
                  disabled={isUploading}
                />
                <button
                  onClick={() => document.getElementById("standings-teams-upload")?.click()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[#1e293b] hover:bg-[#334155] text-white border border-[#334155] transition-all cursor-pointer"
                  title="Upload League Teams Excel File"
                  disabled={isUploading}
                >
                  <Upload className="h-4 w-4 text-[#eab308]" />
                  <span>{isUploading ? "Uploading..." : "Import Teams"}</span>
                </button>
              </>
            )}

            <button
              onClick={loadData}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[#1e293b] hover:bg-[#334155] text-[#94a3b8] hover:text-white border border-[#334155] transition-all cursor-pointer"
              title="Refresh Standings Table Data"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-[#eab308]" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      )}

      {/* Division Navigation Tabs */}
      <div className="bg-[#111827] border border-[#334155] p-2 rounded-2xl shadow-lg">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {LEAGUES.map((divName, idx) => {
            const isActive = activeDivisionIdx === idx;
            return (
              <button
                key={divName}
                onClick={() => setActiveDivisionIdx(idx)}
                className={`px-3 py-2.5 rounded-xl text-xs font-black tracking-wide transition-all cursor-pointer text-center flex flex-col items-center justify-center gap-0.5 border ${
                  isActive
                    ? "bg-[#eab308] text-[#0b0f19] border-[#eab308] shadow-md font-extrabold"
                    : "bg-[#1e293b]/60 text-[#94a3b8] hover:text-white hover:bg-[#1e293b] border-[#334155]"
                }`}
              >
                <span className="truncate w-full uppercase">{divName.replace("CCFL ", "")}</span>
                <span className={`text-[9px] font-mono uppercase tracking-widest ${isActive ? "text-[#0b0f19]/80 font-extrabold" : "text-[#64748b]"}`}>
                  Div {idx + 1}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {uploadMessage && (
        <div className={`p-3 rounded-xl border text-xs font-bold ${
          uploadMessage.success
            ? "bg-emerald-950/80 border-emerald-500/50 text-emerald-200"
            : "bg-rose-950/80 border-rose-500/50 text-rose-200"
        }`}>
          {uploadMessage.text}
        </div>
      )}

      {/* Standings Table Card */}
      <div className="bg-[#111827] border border-[#334155] rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Table Top Toolbar */}
        <div className="p-4 sm:p-5 border-b border-[#334155] bg-[#1e293b]/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Shield className="h-5 w-5 text-[#eab308]" />
            <div>
              <h3 className="font-display font-black text-sm sm:text-base text-white tracking-wide">
                {activeDivision} Table
              </h3>
              <p className="text-[11px] text-[#94a3b8] font-mono">
                {filteredStandings.length} Teams
              </p>
            </div>
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#64748b]" />
            <input
              type="text"
              placeholder="Search club name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0b0f19] border border-[#334155] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#64748b] focus:outline-none focus:border-[#eab308] transition-all"
            />
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-sans">
            <thead>
              <tr className="border-b border-[#334155] text-[#94a3b8] font-mono font-bold bg-[#0b0f19] uppercase tracking-wider text-[11px]">
                <th className="py-3 px-2 text-center w-10">Pos</th>
                <th className="py-3 px-3">Team / Club Name</th>
                <th className="py-3 px-2 text-center">P</th>
                <th className="py-3 px-2 text-center text-emerald-400">W</th>
                <th className="py-3 px-2 text-center text-amber-400">D</th>
                <th className="py-3 px-2 text-center text-rose-400">L</th>
                <th className="py-3 px-2 text-center hidden xs:table-cell">GF</th>
                <th className="py-3 px-2 text-center hidden xs:table-cell">GA</th>
                <th className="py-3 px-2 text-center">GD</th>
                <th className="py-3 px-3 text-center font-extrabold text-[#eab308] text-sm bg-[#1e293b]/40">Pts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e293b]">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[#94a3b8]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#eab308] border-t-transparent" />
                      <span className="text-xs font-mono">Calculating standings...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredStandings.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[#94a3b8] font-sans text-xs">
                    <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto p-4">
                      <Shield className="w-8 h-8 text-slate-600 mb-1" />
                      <span className="font-semibold text-slate-300">No teams registered for this division yet.</span>
                      <span className="text-slate-400 text-[11px]">Upload the League Teams template to build standings.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStandings.map((team, idx) => {
                  const isCardiffTownUs = team.name.toLowerCase().includes("cardiff town");
                  
                  return (
                    <tr
                      key={team.name}
                      className={`transition-colors hover:bg-[#1e293b]/70 ${
                        isCardiffTownUs
                          ? "bg-[#1e293b] font-bold text-white border-l-4 border-[#eab308] shadow-inner"
                          : "text-[#f8fafc]"
                      }`}
                    >
                      {/* Position */}
                      <td className="py-3 px-2 text-center font-mono font-bold text-[#94a3b8]">
                        <span className={`inline-flex items-center justify-center h-6 w-6 rounded-md text-xs font-black ${
                          idx === 0
                            ? "bg-[#eab308] text-[#0b0f19]"
                            : idx === 1
                            ? "bg-[#94a3b8] text-[#0b0f19]"
                            : idx === 2
                            ? "bg-[#b45309] text-white"
                            : "bg-[#1e293b] text-[#94a3b8]"
                        }`}>
                          {idx + 1}
                        </span>
                      </td>

                      {/* Team Name */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <TeamLogo teamName={team.name} size={22} className="shadow-md rounded-md shrink-0 border border-[#334155]" />
                          {isCardiffTownUs ? (
                            <span className="font-black text-white flex items-center gap-2 truncate text-sm">
                              <span className="truncate">{team.name}</span>
                              <span className="text-[9px] bg-[#eab308] text-[#0b0f19] px-1.5 py-0.5 rounded font-black uppercase tracking-wider shadow-sm shrink-0">
                                OUR CLUB
                              </span>
                            </span>
                          ) : (
                            <button
                              onClick={() => onSelectOpponent && onSelectOpponent(team.name)}
                              className="font-bold text-white hover:text-[#eab308] hover:underline transition-colors text-left cursor-pointer truncate text-xs sm:text-sm"
                              title={`View Analysis for ${team.name}`}
                            >
                              {team.name}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Played */}
                      <td className="py-3 px-2 text-center font-mono text-[#f8fafc] font-bold">{team.mp}</td>
                      
                      {/* Wins */}
                      <td className="py-3 px-2 text-center font-mono text-emerald-400 font-bold">{team.w}</td>
                      
                      {/* Draws */}
                      <td className="py-3 px-2 text-center font-mono text-amber-400 font-bold">{team.d}</td>
                      
                      {/* Losses */}
                      <td className="py-3 px-2 text-center font-mono text-rose-400 font-bold">{team.l}</td>
                      
                      {/* Goals For */}
                      <td className="py-3 px-2 text-center font-mono text-[#94a3b8] hidden xs:table-cell">{team.gf}</td>
                      
                      {/* Goals Against */}
                      <td className="py-3 px-2 text-center font-mono text-[#94a3b8] hidden xs:table-cell">{team.ga}</td>
                      
                      {/* Goal Difference */}
                      <td className={`py-3 px-2 text-center font-mono font-bold ${
                        team.gd > 0 ? "text-emerald-400" : team.gd < 0 ? "text-rose-400" : "text-[#94a3b8]"
                      }`}>
                        {team.gd > 0 ? `+${team.gd}` : team.gd}
                      </td>

                      {/* Points */}
                      <td className="py-3 px-3 text-center font-black text-[#eab308] text-base bg-[#1e293b]/40 font-mono">
                        {team.pts}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Legend Footer */}
        <div className="p-3 border-t border-[#334155] bg-[#0b0f19] text-[11px] text-[#94a3b8] font-mono flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#eab308]" /> 1st Place (Promotion)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#1e293b] border border-[#eab308]" /> Cardiff Town FC
            </span>
          </div>
          <span>Updated automatically from Match Schedule</span>
        </div>

      </div>

    </div>
  );
}
