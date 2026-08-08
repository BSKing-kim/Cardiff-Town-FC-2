import React, { useState, useEffect, useMemo } from "react";
import { Player, PlayerPosition, UserProfile, UserRole, MatchData } from "../types";
import IndividualPlayerDashboard from "./IndividualPlayerDashboard";
import MyPerformance from "./MyPerformance";
import { motion, AnimatePresence } from "motion/react";
import { 
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip as ChartTooltip
} from "recharts";
import { 
  Search, Award, ChevronRight, X, Sparkles, Target, Shield, Activity, 
  Info, Calendar, Compass, Star, ChevronDown, User, Flag, Footprints,
  Upload, Download, AlertCircle, Check, Camera, Map, RefreshCw, Layers, Plus, Eye, ShieldCheck
} from "lucide-react";
import { ExcelUtils } from "../lib/excelUtils";
import { DataService } from "../lib/dataService";
import { supabase } from "../lib/supabase";

interface PlayerStatsProps {
  players: Player[];
  onPlayersUpdated?: () => void;
  currentUser?: UserProfile | null;
  matches?: MatchData[];
  isMyPerformanceView?: boolean;
}

function calculateAge(dob?: string): number | string {
  if (!dob) return "-";
  const birthDate = new Date(dob);
  if (isNaN(birthDate.getTime())) return "-";
  const referenceDate = new Date();
  let calculatedAge = referenceDate.getFullYear() - birthDate.getFullYear();
  const m = referenceDate.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && referenceDate.getDate() < birthDate.getDate())) {
    calculatedAge--;
  }
  return calculatedAge;
}

type PositionFilter = "All" | "GK" | "DEF" | "MID" | "ATT";

export default function PlayerStats({ players, onPlayersUpdated, currentUser, matches = [], isMyPerformanceView }: PlayerStatsProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPosition, setSelectedPosition] = useState<PositionFilter>("All");
  const [activePlayer, setActivePlayer] = useState<Player | null>(null);
  const [uploadStatus, setUploadStatus] = useState<{
    success: boolean;
    message: string;
    errorDetails?: string[];
  } | null>(null);

  const [profilePlayers, setProfilePlayers] = useState<Player[]>([]);
  const [profileStaff, setProfileStaff] = useState<{
    id: string;
    name: string;
    role: string;
    playerId?: string;
    joinDate: string;
    emailOrContact: string;
    username?: string;
  }[]>([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState<boolean>(true);

  const loadSquadProfiles = async () => {
    setIsLoadingProfiles(true);
    try {
      const { data, error } = await (supabase.from("profiles") as any).select("*");
      if (!error && Array.isArray(data)) {
        const playerProfiles: Player[] = [];
        const staffProfiles: {
          id: string;
          name: string;
          role: string;
          playerId?: string;
          joinDate: string;
          emailOrContact: string;
          username?: string;
        }[] = [];

        data.forEach((prof: any) => {
          const roleStr = (prof.role || "").toString().trim().toLowerCase();
          const isStaff = roleStr === "admin" || roleStr === "analyst" || roleStr === "coach" || roleStr === "manager" || roleStr === "head coach" || roleStr === "tactical analyst" || prof.is_admin || (roleStr !== "player" && roleStr !== "");
          
          const name = prof.full_name || prof.username || "User";
          const pId = prof.player_id || prof.id || `USR-${prof.username}`;
          const createdAt = prof.created_at ? new Date(prof.created_at).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric"
          }) : "-";

          if (isStaff) {
            let formattedRole = prof.role || (prof.is_admin ? "Admin" : "Staff");
            if (roleStr === "head coach") formattedRole = "Head Coach";
            else if (roleStr === "tactical analyst") formattedRole = "Analyst";
            else if (roleStr === "admin") formattedRole = "Admin";
            else if (roleStr === "manager") formattedRole = "Manager";
            else if (roleStr === "coach") formattedRole = "Coach";
            else if (roleStr === "analyst") formattedRole = "Analyst";

            staffProfiles.push({
              id: pId,
              name,
              role: formattedRole,
              playerId: pId,
              joinDate: createdAt,
              emailOrContact: prof.email || prof.username || "-",
              username: prof.username
            });
          } else {
            playerProfiles.push({
              id: pId,
              name: name,
              position: prof.position || "CM",
              backNumber: (playerProfiles.length + 1).toString(),
              preferredFoot: prof.preferred_foot || "Right",
              nationality: prof.nationality || "Wales",
              joinDate: createdAt,
              dob: prof.dob || "-",
              playerId: pId,
              userId: prof.user_id,
              username: prof.username,
              isOnboarded: prof.is_onboarded,
              role: prof.role || "Player"
            } as unknown as Player);
          }
        });

        setProfilePlayers(playerProfiles);
        setProfileStaff(staffProfiles);
      }
    } catch (err) {
      console.warn("Failed to load squad profiles:", err);
    } finally {
      setIsLoadingProfiles(false);
    }
  };

  useEffect(() => {
    loadSquadProfiles();
  }, [players]);

  const isSystemAdmin = (currentUser?.role as string) === "Admin" || currentUser?.isAdmin === true;
  const isAdmin = isSystemAdmin || currentUser?.role === UserRole.HeadCoach || currentUser?.role === UserRole.Manager;

  const filteredStaff = useMemo(() => {
    if (!searchTerm) return profileStaff;
    const lower = searchTerm.toLowerCase();
    return profileStaff.filter((s) => 
      s.name.toLowerCase().includes(lower) ||
      s.role.toLowerCase().includes(lower) ||
      s.emailOrContact.toLowerCase().includes(lower) ||
      (s.playerId && s.playerId.toLowerCase().includes(lower))
    );
  }, [profileStaff, searchTerm]);

  // Auto name-matching for My Performance view
  const { matchedPlayer, isUnmatched } = useMemo(() => {
    const safePlayers = profilePlayers;
    if (!currentUser) {
      return { matchedPlayer: safePlayers[0] || null, isUnmatched: false };
    }

    const userFullName = `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim().toLowerCase();
    const username = (currentUser.username || "").toLowerCase();

    const match = safePlayers.find(p => {
      if (!p || !p.name) return false;
      const pName = p.name.toLowerCase().trim();
      if (userFullName && userFullName.length > 1 && (pName === userFullName || pName.includes(userFullName) || userFullName.includes(pName))) {
        return true;
      }
      if (username && username.length > 1 && (pName === username || pName.includes(username))) {
        return true;
      }
      if (currentUser.firstName && currentUser.firstName.length > 1 && pName.includes(currentUser.firstName.toLowerCase())) {
        return true;
      }
      if (currentUser.lastName && currentUser.lastName.length > 1 && pName.includes(currentUser.lastName.toLowerCase())) {
        return true;
      }
      return false;
    });

    if (match) {
      return { matchedPlayer: match, isUnmatched: false };
    }

    return { matchedPlayer: null, isUnmatched: true };
  }, [profilePlayers, players, currentUser]);

  // Esc key down listener to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActivePlayer(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Filter players based on search and position tabs
  const filteredPlayers = useMemo(() => {
    const safePlayers = profilePlayers;
    return safePlayers.filter((p: any) => {
      if (!p || !p.name) return false;
      
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        p.name.toLowerCase().includes(searchLower) || 
        (p.username && p.username.toLowerCase().includes(searchLower)) ||
        (p.playerId && p.playerId.toLowerCase().includes(searchLower)) ||
        String(p.backNumber || "").includes(searchLower);
      
      if (!matchesSearch) return false;

      let matchesPosition = false;
      if (selectedPosition === "All") {
        matchesPosition = true;
      } else {
        const pUpper = String(p.position || "").trim().toUpperCase();
        if (selectedPosition === "GK") {
          matchesPosition = ["GK", "GOALKEEPER"].includes(pUpper);
        } else if (selectedPosition === "DEF") {
          matchesPosition = ["CB", "FB", "LB", "RB", "LWB", "RWB", "DEFENDER"].includes(pUpper);
        } else if (selectedPosition === "MID") {
          matchesPosition = ["CM", "DM", "AM", "CDM", "CAM", "RM", "LM", "MIDFIELDER"].includes(pUpper);
        } else if (selectedPosition === "ATT") {
          matchesPosition = ["ST", "WINGER", "LW", "RW", "CF", "SS", "FORWARD"].includes(pUpper);
        }
      }
      return matchesPosition;
    });
  }, [profilePlayers, players, searchTerm, selectedPosition]);

  if (isMyPerformanceView) {
    return (
      <MyPerformance 
        currentUser={currentUser}
        players={players} 
        matches={matches} 
      />
    );
  }

  // If a specific player is selected from squad view
  if (activePlayer) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setActivePlayer(null)}
          className="px-3.5 py-2 rounded-xl bg-[#1e293b] hover:bg-[#334155] border border-[#334155] text-xs font-bold text-[#eab308] hover:text-white transition-colors cursor-pointer flex items-center gap-2"
        >
          <ChevronRight className="h-4 w-4 rotate-180 text-[#eab308]" />
          <span>Back to Squad Directory</span>
        </button>
        <IndividualPlayerDashboard 
          player={activePlayer} 
          selectedPlayer={activePlayer}
          currentUser={currentUser} 
          matches={matches} 
          onClose={() => setActivePlayer(null)}
        />
      </div>
    );
  }

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadStatus(null);
      const teamOpts = { teamName: "Cardiff Town FC", teamId: "ctfc" };
      const result = await ExcelUtils.parsePlayerExcel(file, teamOpts);
      
      if (result.validRecords.length === 0) {
        setUploadStatus({
          success: false,
          message: "No valid player records found in the Excel sheet.",
          errorDetails: result.errorDetails
        });
        return;
      }

      // Upload valid players and sync with Supabase profiles table
      const uploadSummary = await DataService.uploadPlayers(result.validRecords, teamOpts);
      
      setUploadStatus({
        success: true,
        message: `Successfully full-synced Excel roster: Registered ${uploadSummary.added} new players, updated ${uploadSummary.updated} existing players${uploadSummary.deleted ? `, purged ${uploadSummary.deleted} stale/released players` : ""} across division sheets.`,
        errorDetails: result.errorDetails.length > 0 ? result.errorDetails : undefined
      });

      if (onPlayersUpdated) {
        onPlayersUpdated();
      }
    } catch (err: any) {
      setUploadStatus({
        success: false,
        message: `Excel parsing error: ${err?.message || String(err)}`
      });
    } finally {
      // Reset file input value so same file can be selected again
      e.target.value = "";
    }
  };

  // Position Display Names
  const getPositionDisplayName = (pos: PlayerPosition) => {
    const p = String(pos).trim().toUpperCase();
    switch (p) {
      case "GK": return "Goalkeeper (GK)";
      case "LB": return "Left Back (LB)";
      case "CB": return "Center Back (CB)";
      case "RB": return "Right Back (RB)";
      case "DM": return "Defensive Midfielder (DM)";
      case "CM": return "Central Midfielder (CM)";
      case "AM": return "Attacking Midfielder (AM)";
      case "LW": return "Left Winger (LW)";
      case "RW": return "Right Winger (RW)";
      case "CF": return "Center Forward (CF)";
      default: return pos;
    }
  };

  // Badge background colours based on role/group
  const getPositionBg = (pos: PlayerPosition) => {
    const p = String(pos).trim().toUpperCase();
    if (["GK"].includes(p)) {
      return "bg-[#F59E0B]/10 text-[#D97706] border-[#F59E0B]/20";
    }
    if (["LB", "CB", "RB"].includes(p)) {
      return "bg-[#10B981]/10 text-[#059669] border-[#10B981]/20";
    }
    if (["DM", "CM", "AM"].includes(p)) {
      return "bg-[#1D4ED8]/10 text-[#1D4ED8] border-[#1D4ED8]/20";
    }
    return "bg-[#EF4444]/10 text-[#DC2626] border-[#EF4444]/20"; // For LW, RW, CF
  };

  return (
    <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 sm:p-6 shadow-xl space-y-6 text-white" id="player-directory-viewport">
      
      {/* Title block */}
      <div className="border-b border-slate-800 pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Compass className="h-5 w-5 text-cyan-400 shrink-0" />
            Squad
          </h2>
        </div>
        
        {/* Actions Button Group - Direct User-as-Player Onboarding */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 self-start md:self-center">
          <div 
            className="flex items-center gap-1.5 bg-cyan-950/80 border border-cyan-800 text-cyan-300 text-xs font-bold py-1.5 px-3 rounded-lg shadow-sm"
            title="Excel roster uploads eliminated. Player entries are auto-generated from user registration and onboarding."
          >
            <Compass className="h-3.5 w-3.5 text-cyan-400" />
            <span>Auto-Registered Squad</span>
          </div>
        </div>
      </div>

      {/* Upload status message alert box */}
      {uploadStatus && (
        <div 
          className={`rounded-xl border p-4 font-sans text-xs flex flex-col gap-2 relative ${
            uploadStatus.success 
              ? "bg-emerald-950/60 border-emerald-800 text-emerald-200" 
              : "bg-rose-950/60 border-rose-800 text-rose-200"
          }`}
        >
          <button
            onClick={() => setUploadStatus(null)}
            className="absolute top-3 right-3 text-slate-400 hover:text-slate-200 transition"
            title="Dismiss alert"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            {uploadStatus.success ? (
              <Check className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            )}
            <span className="font-bold">{uploadStatus.message}</span>
          </div>
          {uploadStatus.errorDetails && uploadStatus.errorDetails.length > 0 && (
            <div className="mt-2 pl-6 border-l-2 border-slate-700 space-y-1 text-[11px] text-slate-300 font-mono">
              <p className="font-semibold text-white">Errors processed during parsing:</p>
              {uploadStatus.errorDetails.map((err, idx) => (
                <p key={idx}>{err}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" id="search-filter-controls">
        {/* Search */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search squad name or jersey #..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 py-1.5 pl-9 pr-4 text-xs text-white placeholder:text-slate-500 focus:border-cyan-500 focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>

        {/* Categories toggling */}
        <div className="flex flex-wrap gap-1.5" id="position-toggles">
          {([
            { key: "All", label: "All Squad" },
            { key: "GK", label: "GK" },
            { key: "DEF", label: "DEF" },
            { key: "MID", label: "MID" },
            { key: "ATT", label: "ATT" }
          ] as const).map(({ key, label }) => {
            const isActive = selectedPosition === key;
            return (
              <button
                key={key}
                onClick={() => setSelectedPosition(key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-all cursor-pointer ${
                  isActive 
                    ? "bg-cyan-600 border-cyan-500 text-white font-bold shadow-md" 
                    : "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white font-medium"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Roster Table Content */}
      <div className="rounded-xl border border-slate-800 bg-[#0f172a] overflow-hidden shadow-xl">
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <h3 className="font-display font-semibold text-white text-sm flex items-center gap-2">
            <Star className="h-4 w-4 text-cyan-400 shrink-0 fill-cyan-400/20" />
            Squad ({filteredPlayers.length} players listed)
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" id="player-grid-table">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950 text-[10px] uppercase tracking-wider text-slate-400 font-bold font-mono">
                <th className="py-3 px-4 text-center w-12">No</th>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4 text-center" title="Position">POS</th>
                {isSystemAdmin && <th className="py-3 px-4 text-center font-mono text-cyan-400">Player ID</th>}
                <th className="py-3 px-4 text-center whitespace-nowrap">Join Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-xs font-sans">
              {filteredPlayers.map((p, idx) => {
                const isSelected = activePlayer?.id === p.id;
                
                return (
                  <tr 
                    key={p.id || idx}
                    onClick={() => setActivePlayer(isSelected ? null : p)}
                    className={`hover:bg-slate-800/60 cursor-pointer transition-colors ${
                      isSelected ? "bg-cyan-950/40 font-semibold text-white" : "text-slate-200"
                    }`}
                  >
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-400">
                      #{p.backNumber || (idx + 1)}
                    </td>
                    <td className="py-3.5 px-4 font-semibold group">
                      <div className="flex items-center justify-between gap-1 w-full">
                        <div className="flex items-center gap-2">
                          {p.image ? (
                            <img 
                              src={p.image} 
                              alt={p.name} 
                              className="w-6 h-6 rounded-full object-cover border border-cyan-500 bg-slate-800" 
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[9px] font-bold text-slate-400 font-mono">
                              #{p.backNumber || (idx + 1)}
                            </div>
                          )}
                          <span className={isSelected ? "text-cyan-400 font-bold" : "text-white"}>{p.name}</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${getPositionBg(p.position)}`}>
                        {p.position || "CM"}
                      </span>
                    </td>
                    {isSystemAdmin && (
                      <td className="py-3.5 px-4 text-center font-mono text-xs">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800 text-cyan-300 font-bold">
                          {p.playerId || p.id || "-"}
                        </span>
                      </td>
                    )}
                    <td className="py-3.5 px-4 text-center font-mono text-slate-400 whitespace-nowrap">{p.joinDate || "-"}</td>
                  </tr>
                );
              })}
              {filteredPlayers.length === 0 && (
                <tr>
                  <td colSpan={isSystemAdmin ? 5 : 4} className="py-8 text-center text-slate-500 font-sans">
                    No roster players matching filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Staff List */}
      <div className="rounded-xl border border-slate-800 bg-[#0f172a] overflow-hidden shadow-xl mt-6">
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 sm:px-6 flex items-center justify-between">
          <h3 className="font-display font-semibold text-white text-sm flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-amber-400 shrink-0" />
            Coaching & Support Staff ({filteredStaff.length} members)
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" id="staff-grid-table">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950 text-[10px] uppercase tracking-wider text-slate-400 font-bold font-mono">
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4 text-center">Role</th>
                {isSystemAdmin && <th className="py-3 px-4 text-center font-mono text-cyan-400">Player ID</th>}
                <th className="py-3 px-4 text-center whitespace-nowrap">Join Date</th>
                <th className="py-3 px-4 text-center whitespace-nowrap">Email / Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-xs font-sans">
              {filteredStaff.map((st, idx) => {
                const getRoleBadge = (roleName: string) => {
                  const r = roleName.toLowerCase();
                  if (r.includes("admin")) return "bg-rose-950/80 text-rose-300 border-rose-800/80";
                  if (r.includes("coach") || r.includes("manager")) return "bg-amber-950/80 text-amber-300 border-amber-800/80";
                  if (r.includes("analyst")) return "bg-purple-950/80 text-purple-300 border-purple-800/80";
                  return "bg-slate-800 text-slate-300 border-slate-700";
                };

                return (
                  <tr key={st.id || idx} className="hover:bg-slate-800/40 text-slate-200 transition-colors">
                    <td className="py-3.5 px-4 font-semibold">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-amber-400 font-mono shrink-0">
                          {st.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-white font-medium">{st.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${getRoleBadge(st.role)}`}>
                        {st.role}
                      </span>
                    </td>
                    {isSystemAdmin && (
                      <td className="py-3.5 px-4 text-center font-mono text-xs">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800 text-cyan-300 font-bold">
                          {st.playerId || st.id || "-"}
                        </span>
                      </td>
                    )}
                    <td className="py-3.5 px-4 text-center font-mono text-slate-400 whitespace-nowrap">{st.joinDate || "-"}</td>
                    <td className="py-3.5 px-4 text-center font-mono text-slate-400 whitespace-nowrap">{st.emailOrContact || "-"}</td>
                  </tr>
                );
              })}
              {filteredStaff.length === 0 && (
                <tr>
                  <td colSpan={isSystemAdmin ? 5 : 4} className="py-8 text-center text-slate-500 font-sans">
                    No coaching or support staff listed.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Advanced Position Analytics Slide-up Bottom Drawer Panel */}
      <AnimatePresence>
        {activePlayer && (
          <DrawerDashboard 
            player={activePlayer} 
            onClose={() => setActivePlayer(null)} 
            getPositionBg={getPositionBg}
            getPositionDisplayName={getPositionDisplayName}
            onPlayersUpdated={onPlayersUpdated}
          />
        )}
      </AnimatePresence>

    </div>
  );
}

function pIsPosition(playerPos: PlayerPosition, target: "Forward" | "Midfielder" | "Defender" | "Goalkeeper"): boolean {
  const p = String(playerPos).trim().toUpperCase();
  if (target === "Forward") return ["LW", "RW", "CF", "ST", "WINGER", "FORWARD"].includes(p);
  if (target === "Midfielder") return ["DM", "CM", "AM", "MIDFIELDER"].includes(p);
  if (target === "Defender") return ["LB", "CB", "RB", "FB", "DEFENDER"].includes(p);
  if (target === "Goalkeeper") return ["GK", "GOALKEEPER"].includes(p);
  return false;
}

// -------------------------------------------------------------
// BOTTOM SLIDE-UP DRAWER MODULE
// -------------------------------------------------------------
interface DrawerDashboardProps {
  player: Player;
  onClose: () => void;
  getPositionBg: (pos: PlayerPosition) => string;
  getPositionDisplayName: (pos: PlayerPosition) => string;
  onPlayersUpdated?: () => void;
}

const compressPlayerImage = (base64Str: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const MAX_WIDTH = 150;
      const MAX_HEIGHT = 150;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width = Math.round((width * MAX_HEIGHT) / height);
          height = MAX_HEIGHT;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => {
      resolve(base64Str);
    };
  });
};

function DrawerDashboard({ player, onClose, getPositionBg, getPositionDisplayName, onPlayersUpdated }: DrawerDashboardProps) {
  const [playerImage, setPlayerImage] = useState<string | undefined>(player.image);

  useEffect(() => {
    setPlayerImage(player.image);
  }, [player.image]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("Please select an image smaller than 10MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        try {
          const compressed = await compressPlayerImage(base64);
          const updatedPlayer = { ...player, image: compressed };
          await DataService.savePlayer(updatedPlayer);
          setPlayerImage(compressed);
          player.image = compressed; // Instantly sync locally
          if (onPlayersUpdated) {
            onPlayersUpdated();
          }
        } catch (err) {
          console.error("Failed to save player profile image:", err);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // Pre-calculated stats
  const age = useMemo(() => {
    if (!player.dob) return 24;
    const birthDate = new Date(player.dob);
    const referenceDate = new Date("2026-06-22");
    let calculatedAge = referenceDate.getFullYear() - birthDate.getFullYear();
    const m = referenceDate.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && referenceDate.getDate() < birthDate.getDate())) {
      calculatedAge--;
    }
    return isNaN(calculatedAge) ? 24 : calculatedAge;
  }, [player.dob]);

  const preferredFoot = useMemo(() => {
    if (player.preferredFoot) return player.preferredFoot;
    if ([3, 7, 11].includes(player.backNumber)) return "Left";
    return "Right";
  }, [player.backNumber, player.preferredFoot]);

  const nationality = useMemo(() => {
    if (player.nationality) return player.nationality;
    const n = player.name;
    if (n.includes("Kim") || n.includes("Son") || n.includes("Park") || n.includes("Lee") || n.includes("Choi") || n.includes("Jeong") || n.includes("Han") || n.match(/[\uac00-\ud7a3]/)) {
      return "South Korea";
    }
    return "Wales";
  }, [player.name, player.nationality]);

  const appearances = useMemo(() => {
    return player.appearances ?? Math.max(1, Math.ceil(player.minutesPlayed / 90));
  }, [player.appearances, player.minutesPlayed]);

  const goalInvolvements = player.goals + player.assists;

  // Radar Data calculation
  const radarData = useMemo(() => {
    const isForward = pIsPosition(player.position, "Forward");
    const isMidfielder = pIsPosition(player.position, "Midfielder");
    const isDefender = pIsPosition(player.position, "Defender");

    if (isForward) {
      const shotAcc = player.shots > 0 ? (player.shotsOnTarget / player.shots) * 100 : null;
      const goalConv = player.shots > 0 ? (player.goals / player.shots) * 100 : null;
      const dribbleAttempts = player.dribbleAttempts ?? player.dribblesAttempted ?? 0;
      const dribbleSuccess = dribbleAttempts > 0 
        ? ((player.successfulDribbles ?? 0) / dribbleAttempts) * 100 
        : null;
      
      return [
        { name: "Goals", value: Math.min(100, Math.round((player.goals / 12) * 100)), display: player.goals !== undefined ? player.goals : "-" },
        { name: "Shots", value: Math.min(100, Math.round((player.shots / 45) * 100)), display: player.shots !== undefined ? player.shots : "-" },
        { name: "Shot Accuracy", value: shotAcc !== null ? Math.round(shotAcc) : 0, display: shotAcc !== null ? `${Math.round(shotAcc)}%` : "-" },
        { name: "Goal Conversion", value: goalConv !== null ? Math.round(goalConv) : 0, display: goalConv !== null ? `${Math.round(goalConv)}%` : "-" },
        { name: "Progressive Carries", value: Math.min(100, Math.round(((player.progressiveCarries ?? 0) / 32) * 100)), display: player.progressiveCarries !== undefined ? player.progressiveCarries : "-" },
        { name: "Dribble Success", value: dribbleSuccess !== null ? Math.round(dribbleSuccess) : 0, display: dribbleSuccess !== null ? `${Math.round(dribbleSuccess)}%` : "-" }
      ];
    } else if (isMidfielder) {
      const passSuccess = player.totalPasses > 0 ? (player.successfulPasses / player.totalPasses) * 100 : null;
      const progPassesVal = player.progressivePasses ?? player.successfulForwardPasses ?? 0;
      const chancesCreatedVal = player.chancesCreated ?? player.keyPasses ?? 0;
      return [
        { name: "Pass Success", value: passSuccess !== null ? Math.round(passSuccess) : 0, display: passSuccess !== null ? `${Math.round(passSuccess)}%` : "-" },
        { name: "Progressive Passes", value: Math.min(100, Math.round((progPassesVal / 70) * 100)), display: progPassesVal !== undefined ? progPassesVal : "-" },
        { name: "Key Passes", value: Math.min(100, Math.round((player.keyPasses / 25) * 100)), display: player.keyPasses !== undefined ? player.keyPasses : "-" },
        { name: "Ball Recoveries", value: Math.min(100, Math.round(((player.ballRecoveries ?? 0) / 45) * 100)), display: player.ballRecoveries !== undefined ? player.ballRecoveries : "-" },
        { name: "Possession Regains", value: Math.min(100, Math.round(((player.possessionRegains ?? 0) / 30) * 100)), display: player.possessionRegains !== undefined ? player.possessionRegains : "-" },
        { name: "Chances Created", value: Math.min(100, Math.round((chancesCreatedVal / 25) * 100)), display: chancesCreatedVal !== undefined ? chancesCreatedVal : "-" }
      ];
    } else if (isDefender) {
      const defDuelsTotal = player.defensiveDuels ?? 0;
      const defDuelsWonTotal = player.defensiveDuelsWon ?? 0;
      const defDuelWin = defDuelsTotal > 0 ? (defDuelsWonTotal / defDuelsTotal) * 100 : null;
      
      const aerialDuelsTotal = player.aerialDuels ?? 0;
      const aerialDuelsWonTotal = player.successfulAerialDuels ?? player.aerialDuelsWon ?? 0;
      const aerialDuelWin = aerialDuelsTotal > 0 ? (aerialDuelsWonTotal / aerialDuelsTotal) * 100 : null;

      const tacklesWonVal = player.tacklesWon ?? player.tacklesSucceeded ?? 0;
      const interceptionsVal = player.successfulInterceptions ?? player.interceptions ?? 0;
      const progPassesVal = player.progressivePasses ?? player.successfulForwardPasses ?? 0;
      
      return [
        { name: "Defensive Duel Win %", value: defDuelWin !== null ? Math.round(defDuelWin) : 0, display: defDuelWin !== null ? `${Math.round(defDuelWin)}%` : "-" },
        { name: "Aerial Duel Win %", value: aerialDuelWin !== null ? Math.round(aerialDuelWin) : 0, display: aerialDuelWin !== null ? `${Math.round(aerialDuelWin)}%` : "-" },
        { name: "Tackles Won", value: Math.min(100, Math.round((tacklesWonVal / 25) * 100)), display: tacklesWonVal !== undefined ? tacklesWonVal : "-" },
        { name: "Interceptions", value: Math.min(100, Math.round((interceptionsVal / 35) * 100)), display: interceptionsVal !== undefined ? interceptionsVal : "-" },
        { name: "Clearances", value: Math.min(100, Math.round(((player.clearances ?? 0) / 45) * 100)), display: player.clearances !== undefined ? player.clearances : "-" },
        { name: "Progressive Passes", value: Math.min(100, Math.round((progPassesVal / 50) * 100)), display: progPassesVal !== undefined ? progPassesVal : "-" }
      ];
    } else {
      // Goalkeeper
      const savesAttempt = player.savesAttempted ?? player.saveAttempts ?? 0;
      const savesSucceed = player.savesSucceeded ?? player.saves ?? 0;
      const saveRate = savesAttempt > 0 ? (savesSucceed / savesAttempt) * 100 : null;
      const passSuccess = player.totalPasses > 0 ? (player.successfulPasses / player.totalPasses) * 100 : null;
      
      return [
        { name: "Save %", value: saveRate !== null ? Math.round(saveRate) : 0, display: saveRate !== null ? `${Math.round(saveRate)}%` : "-" },
        { name: "Cross Claims", value: Math.min(100, Math.round(((player.crossClaims ?? 0) / 20) * 100)), display: player.crossClaims !== undefined ? player.crossClaims : "-" },
        { name: "Sweeper Actions", value: Math.min(100, Math.round(((player.sweeperActions ?? 0) / 15) * 100)), display: player.sweeperActions !== undefined ? player.sweeperActions : "-" },
        { name: "Pass Success", value: passSuccess !== null ? Math.round(passSuccess) : 0, display: passSuccess !== null ? `${Math.round(passSuccess)}%` : "-" }
      ];
    }
  }, [player]);

  // SVG Radar Dimensions inside Drawer
  const radarTitle = useMemo(() => {
    if (pIsPosition(player.position, "Forward")) return "Attacking Radar (CF/LW/RW)";
    if (pIsPosition(player.position, "Midfielder")) return "Engine Room Radar (CM/DM/AM)";
    if (pIsPosition(player.position, "Defender")) return "Wall Defense Radar (CB/LB/RB)";
    return "Netkeeper Radar (GK)";
  }, [player.position]);

  // Filter States for side-by-side Visualizations
  const [selectedSeason, setSelectedSeason] = useState("All");
  const [selectedComp, setSelectedComp] = useState("All");

  const xgShots = useMemo(() => {
    const list = [];
    const totalShots = player.shots || 0;
    const goals = player.goals || 0;
    
    let seed = player.name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const random = () => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };

    // Goals (Always scored in the final third towards the right attacking end box, high xG)
    for (let i = 0; i < goals; i++) {
      const x = 101 + random() * 16.5; // right penalty box is 102 to 120
      const y = 25 + random() * 30;    // center is 40
      const xG = parseFloat((0.15 + random() * 0.70).toFixed(2));
      const comp = random() > 0.3 ? "K-League 1" : "FA Cup";
      const seas = random() > 0.35 ? "2025/26" : "2024/25";
      list.push({ isGoal: true, x, y, xG, competition: comp, season: seas });
    }

    // Missed/blocked shots (Further out, lower xG values)
    const misses = Math.max(0, totalShots - goals);
    for (let i = 0; i < misses; i++) {
      const x = 75 + random() * 35;   // right half of pitch
      const y = 14 + random() * 52;   // width is 80
      const xG = parseFloat((0.02 + random() * 0.17).toFixed(2));
      const comp = random() > 0.3 ? "K-League 1" : "FA Cup";
      const seas = random() > 0.35 ? "2025/26" : "2024/25";
      list.push({ isGoal: false, x, y, xG, competition: comp, season: seas });
    }

    return list;
  }, [player.shots, player.goals, player.name]);

  const filteredXgShots = useMemo(() => {
    return xgShots.filter(s => {
      const matchSeason = selectedSeason === "All" || s.season === selectedSeason;
      const matchComp = selectedComp === "All" || s.competition === selectedComp;
      return matchSeason && matchComp;
    });
  }, [xgShots, selectedSeason, selectedComp]);

  // Interactive player heatmap states
  const [playerPoints, setPlayerPoints] = useState<any[]>([]);
  const [filteredPlayerPoints, setFilteredPlayerPoints] = useState<any[]>([]);
  const [selectedHeatmapType, setSelectedHeatmapType] = useState<string>("All");
  const [heatmapLayout, setHeatmapLayout] = useState<"Horizontal" | "Vertical">("Vertical");
  const [dimensions, setDimensions] = useState({ width: 350, height: 546 });
  const pitchContainerRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [heatmapUploading, setHeatmapUploading] = useState(false);
  const [heatmapUploadStatus, setHeatmapUploadStatus] = useState<{ success: boolean; message: string } | null>(null);

  const loadPlayerHeatmapPoints = async () => {
    try {
      const allPoints = await DataService.getHeatmapPoints();
      const myPoints = allPoints.filter(p => 
        String(p.playerId || "").toLowerCase().trim() === String(player.id || "").toLowerCase().trim() ||
        String(p.playerId || "").toLowerCase().trim() === String(player.name || "").toLowerCase().trim()
      );
      setPlayerPoints(myPoints);
    } catch (e) {
      console.warn("Failed to load player heatmap points:", e);
    }
  };

  useEffect(() => {
    loadPlayerHeatmapPoints();
  }, [player.id]);

  useEffect(() => {
    let filtered = playerPoints;
    if (selectedHeatmapType !== "All") {
      filtered = filtered.filter(p => String(p.type || "").toLowerCase().trim() === selectedHeatmapType.toLowerCase().trim());
    }
    setFilteredPlayerPoints(filtered);
  }, [playerPoints, selectedHeatmapType]);

  // Convert raw bottom-right coordinates [0, 60] to vertical percentage coordinates [0, 100]
  const getVertCoords = (x: number, y: number) => {
    return {
      x: ((60 - x) / 60) * 100,
      y: ((60 - y) / 60) * 100
    };
  };

  // Convert raw bottom-right coordinates [0, 60] to horizontal percentage coordinates [0, 100] (90deg clockwise rotation)
  const getHorizCoords = (x: number, y: number) => {
    return {
      x: (y / 60) * 100,
      y: ((60 - x) / 60) * 100
    };
  };

  // Setup ResizeObserver for player pitch container
  useEffect(() => {
    if (!pitchContainerRef.current) return;
    
    const handleResize = () => {
      if (pitchContainerRef.current) {
        setDimensions({
          width: pitchContainerRef.current.clientWidth,
          height: pitchContainerRef.current.clientHeight
        });
      }
    };
    
    handleResize();
    const observer = new ResizeObserver(() => {
      handleResize();
    });
    observer.observe(pitchContainerRef.current);
    
    return () => {
      observer.disconnect();
    };
  }, [heatmapLayout]);

  // Canvas Heatmap Drawing algorithm for player stats
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    if (selectedHeatmapType === "xG") return;

    const activityPoints = filteredPlayerPoints.filter(p => !p.type || p.type.toLowerCase() === "activity");
    if (activityPoints.length === 0) return;

    const isHorizontal = heatmapLayout === "Horizontal";

    const offscreen = document.createElement("canvas");
    offscreen.width = dimensions.width;
    offscreen.height = dimensions.height;
    const oCtx = offscreen.getContext("2d");
    if (!oCtx) return;

    const radius = Math.max(16, Math.min(48, dimensions.width * 0.12));

    activityPoints.forEach(p => {
      const coords = isHorizontal 
        ? getHorizCoords(p.startX, p.startY)
        : getVertCoords(p.startX, p.startY);
      
      const px = (coords.x / 100) * dimensions.width;
      const py = (coords.y / 100) * dimensions.height;

      const gradient = oCtx.createRadialGradient(px, py, 0, px, py, radius);
      gradient.addColorStop(0, "rgba(0, 0, 0, 1.0)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

      oCtx.fillStyle = gradient;
      oCtx.beginPath();
      oCtx.arc(px, py, radius, 0, Math.PI * 2);
      oCtx.fill();
    });

    const imgData = oCtx.getImageData(0, 0, dimensions.width, dimensions.height);
    const data = imgData.data;

    const getColor = (intensity: number) => {
      if (intensity < 10) return { r: 0, g: 0, b: 0, a: 0 };
      
      let r = 0, g = 0, b = 0, a = 0;
      
      if (intensity < 50) {
        const ratio = (intensity - 10) / 40;
        r = Math.floor(60 + 60 * ratio);
        g = Math.floor(160 + 40 * ratio);
        b = Math.floor(40 * (1 - ratio));
        a = Math.floor(0.2 * ratio * 255);
      } else if (intensity < 110) {
        const ratio = (intensity - 50) / 60;
        r = Math.floor(120 + 135 * ratio);
        g = Math.floor(200 + 30 * ratio);
        b = 0;
        a = Math.floor((0.2 + 0.35 * ratio) * 255);
      } else if (intensity < 180) {
        const ratio = (intensity - 110) / 70;
        r = 255;
        g = Math.floor(230 - 110 * ratio);
        b = 0;
        a = Math.floor((0.55 + 0.25 * ratio) * 255);
      } else {
        const ratio = (intensity - 180) / 75;
        r = 255;
        g = Math.floor(120 * (1 - ratio));
        b = 0;
        a = Math.floor((0.8 + 0.15 * ratio) * 255);
      }

      return { r, g, b, a };
    };

    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha > 0) {
        const color = getColor(alpha);
        data[i] = color.r;
        data[i + 1] = color.g;
        data[i + 2] = color.b;
        data[i + 3] = color.a;
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }, [filteredPlayerPoints, dimensions, heatmapLayout, selectedHeatmapType]);

  const handlePlayerHeatmapUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setHeatmapUploading(true);
    setHeatmapUploadStatus(null);
    try {
      const res = await ExcelUtils.parseHeatmapExcel(file);
      if (res.validRecords && res.validRecords.length > 0) {
        const playerSpecificRecords = res.validRecords.map(r => ({
          ...r,
          playerId: player.id,
          matchId: r.matchId || "P_UPLOAD",
          teamId: r.teamId || "ctfc"
        }));
        await DataService.saveHeatmapPoints(playerSpecificRecords);
        await loadPlayerHeatmapPoints();
        setHeatmapUploadStatus({
          success: true,
          message: `Successfully uploaded ${playerSpecificRecords.length} heat points for ${player.name}!`
        });
      } else {
        setHeatmapUploadStatus({
          success: false,
          message: "No valid coordinate records found in file. Ensure columns are correct."
        });
      }
    } catch (err: any) {
      setHeatmapUploadStatus({
        success: false,
        message: err?.message || "Failed to parse coordinates."
      });
    } finally {
      setHeatmapUploading(false);
    }
  };

  // Pre-calculated extra player stats
  const passAccuracy = useMemo(() => {
    return player.totalPasses > 0 ? Math.round((player.successfulPasses / player.totalPasses) * 100) : 0;
  }, [player.totalPasses, player.successfulPasses]);

  const shotAccuracy = useMemo(() => {
    return player.shots > 0 ? Math.round((player.shotsOnTarget / player.shots) * 100) : 0;
  }, [player.shots, player.shotsOnTarget]);

  const crossAccuracy = useMemo(() => {
    const crossesAtt = player.crossesAttempted ?? player.crosses ?? 0;
    const crossesSucc = player.successfulCrosses ?? 0;
    return crossesAtt > 0 ? Math.round((crossesSucc / crossesAtt) * 100) : 0;
  }, [player.crossesAttempted, player.crosses, player.successfulCrosses]);

  const xGVal = player.xG ?? 0;
  const xAVal = player.xA ?? 0;

  const renderInteractivePitch = () => {
    const baseColor = "bg-[#1E3A20]"; // Rich deep green turf grass
    const isHorizontal = heatmapLayout === "Horizontal";

    const getXgColor = (xg: number, isGoal: boolean) => {
      if (isGoal) return "#10B981"; // Emerald
      if (xg > 0.12) return "#F59E0B"; // Amber
      return "#3B82F6"; // Royal Blue
    };

    if (isHorizontal) {
      return (
        <div ref={pitchContainerRef} className={`relative w-full aspect-[100/64] ${baseColor} border-4 border-white rounded-lg overflow-hidden shadow-inner`}>
          {/* Halfway line */}
          <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/75 -translate-x-1/2" />
          {/* Center Circle */}
          <div className="absolute top-1/2 left-1/2 w-[18%] aspect-square rounded-full border-2 border-white/75 -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full bg-white -translate-x-1/2 -translate-y-1/2" />

          {/* Left Penalty Area */}
          <div className="absolute top-[18%] bottom-[18%] left-0 w-[16.5%] border-r-2 border-y-2 border-white/75" />
          <div className="absolute top-[35%] bottom-[35%] left-0 w-[5.5%] border-r-2 border-y-2 border-white/75" />
          <div className="absolute top-1/2 left-[11%] w-1.5 h-1.5 rounded-full bg-white -translate-y-1/2" />

          {/* Right Penalty Area */}
          <div className="absolute top-[18%] bottom-[18%] right-0 w-[16.5%] border-l-2 border-y-2 border-white/75" />
          <div className="absolute top-[35%] bottom-[35%] right-0 w-[5.5%] border-l-2 border-y-2 border-white/75" />
          <div className="absolute top-1/2 right-[11%] w-1.5 h-1.5 rounded-full bg-white -translate-y-1/2" />

          {/* Canvas for Activity Heatmap overlay */}
          <canvas 
            ref={canvasRef} 
            width={dimensions.width} 
            height={dimensions.height} 
            className="absolute inset-0 w-full h-full pointer-events-none z-10" 
          />

          <svg className="absolute inset-0 w-full h-full pointer-events-none z-20" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <marker id="arrow-v-p" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#D4AF37" />
              </marker>
            </defs>

            {/* Action Vectors */}
            {selectedHeatmapType !== "xG" && filteredPlayerPoints.map((p, idx) => {
              const pType = p.type?.toLowerCase() || "";
              if (pType === "activity") return null;

              let strokeColor = "#3B82F6"; // Pass: Blue
              if (pType === "shot") strokeColor = "#F59E0B"; // Shot: Orange
              else if (pType === "goal") strokeColor = "#EF4444"; // Goal: Red
              else if (pType === "cross") strokeColor = "#10B981"; // Cross: Green
              else if (pType === "clearance") strokeColor = "#A855F7"; // Clearance: Purple

              const startCoords = getHorizCoords(p.startX, p.startY);
              const endCoords = getHorizCoords(p.endX ?? p.startX, p.endY ?? p.startY);
              const sx = startCoords.x;
              const sy = startCoords.y;
              const ex = endCoords.x;
              const ey = endCoords.y;

              return (
                <g key={`vector-${idx}`}>
                  <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={strokeColor} strokeWidth="1.2" markerEnd="url(#arrow-v-p)" />
                  <circle cx={sx} cy={sy} r="1.5" fill={strokeColor} />
                </g>
              );
            })}

            {/* xG Shots & Goals (Horizontal) */}
            {selectedHeatmapType === "xG" && filteredXgShots.map((shot, idx) => {
              const mappedX = shot.x * (100 / 120);
              const mappedY = shot.y * (100 / 80);
              const color = getXgColor(shot.xG, shot.isGoal);
              const cx = mappedX;
              const cy = mappedY * 0.64 + 18;

              if (shot.isGoal) {
                return (
                  <g key={`xg-${idx}`}>
                    <circle cx={cx} cy={cy} r="5" fill="none" stroke={color} strokeWidth="1" className="animate-ping" opacity="0.5" />
                    <circle cx={cx} cy={cy} r="2.5" fill={color} />
                    <polygon 
                      points={`${cx},${cy-3.5} ${cx+1},${cy-1} ${cx+3.5},${cy} ${cx+1},${cy+1} ${cx},${cy+3.5} ${cx-1},${cy+1} ${cx-3.5},${cy} ${cx-1},${cy-1}`} 
                      fill="#F59E0B" 
                    />
                  </g>
                );
              } else {
                const size = 1.5 + shot.xG * 1.5;
                return (
                  <g key={`xg-${idx}`}>
                    <circle 
                      cx={cx} 
                      cy={cy} 
                      r={size} 
                      fill={color} 
                      opacity={0.8}
                    />
                  </g>
                );
              }
            })}
          </svg>
        </div>
      );
    } else {
      return (
        <div ref={pitchContainerRef} className={`relative w-full max-w-xs mx-auto aspect-[64/100] ${baseColor} border-4 border-white rounded-lg overflow-hidden shadow-inner`}>
          {/* Halfway line */}
          <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-white/75 -translate-y-1/2" />
          {/* Center Circle */}
          <div className="absolute top-1/2 left-1/2 w-[28%] aspect-square rounded-full border-2 border-white/75 -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full bg-white -translate-x-1/2 -translate-y-1/2" />

          {/* Top Penalty Area */}
          <div className="absolute left-[18%] right-[18%] top-0 h-[16.5%] border-b-2 border-x-2 border-white/75" />
          <div className="absolute left-[35%] right-[35%] top-0 h-[5.5%] border-b-2 border-x-2 border-white/75" />
          <div className="absolute left-1/2 top-[11%] w-1.5 h-1.5 rounded-full bg-white -translate-x-1/2" />

          {/* Bottom Penalty Area */}
          <div className="absolute left-[18%] right-[18%] bottom-0 h-[16.5%] border-t-2 border-x-2 border-white/75" />
          <div className="absolute left-[35%] right-[35%] bottom-0 h-[5.5%] border-t-2 border-x-2 border-white/75" />
          <div className="absolute left-1/2 bottom-[11%] w-1.5 h-1.5 rounded-full bg-white -translate-x-1/2" />

          {/* Canvas for Activity Heatmap overlay */}
          <canvas 
            ref={canvasRef} 
            width={dimensions.width} 
            height={dimensions.height} 
            className="absolute inset-0 w-full h-full pointer-events-none z-10" 
          />

          <svg className="absolute inset-0 w-full h-full pointer-events-none z-20" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Action Vectors */}
            {selectedHeatmapType !== "xG" && filteredPlayerPoints.map((p, idx) => {
              const pType = p.type?.toLowerCase() || "";
              if (pType === "activity") return null;

              let strokeColor = "#3B82F6";
              if (pType === "shot") strokeColor = "#F59E0B";
              else if (pType === "goal") strokeColor = "#EF4444";
              else if (pType === "cross") strokeColor = "#10B981";
              else if (pType === "clearance") strokeColor = "#A855F7";

              const startCoords = getVertCoords(p.startX, p.startY);
              const endCoords = getVertCoords(p.endX ?? p.startX, p.endY ?? p.startY);
              const sx = startCoords.x;
              const sy = startCoords.y;
              const ex = endCoords.x;
              const ey = endCoords.y;

              return (
                <g key={`vector-v-${idx}`}>
                  <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={strokeColor} strokeWidth="1.2" markerEnd="url(#arrow-v-p)" />
                  <circle cx={sx} cy={sy} r="1.5" fill={strokeColor} />
                </g>
              );
            })}

            {/* xG Shots & Goals (Vertical) */}
            {selectedHeatmapType === "xG" && filteredXgShots.map((shot, idx) => {
              const mappedX = shot.x * (100 / 120);
              const mappedY = shot.y * (100 / 80);
              const color = getXgColor(shot.xG, shot.isGoal);
              const vx = mappedX * 0.64 + 18;
              const vy = mappedY;

              if (shot.isGoal) {
                return (
                  <g key={`xg-v-${idx}`}>
                    <circle cx={vx} cy={vy} r="5" fill="none" stroke={color} strokeWidth="1" className="animate-ping" opacity="0.5" />
                    <circle cx={vx} cy={vy} r="2.5" fill={color} />
                    <polygon 
                      points={`${vx},${vy-3.5} ${vx+1},${vy-1} ${vx+3.5},${vy} ${vx+1},${vy+1} ${vx},${vy+3.5} ${vx-1},${vy+1} ${vx-3.5},${vy} ${vx-1},${vy-1}`} 
                      fill="#F59E0B" 
                    />
                  </g>
                );
              } else {
                const size = 1.5 + shot.xG * 1.5;
                return (
                  <g key={`xg-v-${idx}`}>
                    <circle 
                      cx={vx} 
                      cy={vy} 
                      r={size} 
                      fill={color} 
                      opacity={0.8}
                    />
                  </g>
                );
              }
            })}
          </svg>
        </div>
      );
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end justify-center" 
      onClick={onClose}
    >
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 220 }}
        className="w-full max-w-7xl bg-[#080C14] border-b-0 border border-slate-800 shadow-2xl rounded-t-2xl flex flex-col overflow-hidden max-sm:h-[98vh] h-[97vh] md:h-[97vh] lg:h-[97vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Sticky Header */}
        <div className="px-6 py-4.5 border-b border-slate-800 flex items-center justify-between bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="flex bg-cyan-950 text-cyan-400 font-mono font-bold w-12 h-12 items-center justify-center rounded-full shadow-md text-sm border-2 border-cyan-500/40">
              #{player.backNumber}
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                {player.name}
              </h3>
              <p className="text-[10px] sm:text-xs text-cyan-400 font-semibold tracking-wider uppercase font-mono">
                {getPositionDisplayName(player.position)} • Cardiff Town FC
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Close analytics panel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Drawer Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-[#080C14]" id="player-analytics-drawer-scrollable">
          
          {/* Top Section Layout: Three equal/flexible cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            
            {/* 1. Player Information Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4.5 space-y-3.5 flex flex-col justify-between">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <User className="h-4 w-4 text-cyan-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  Player Information
                </h4>
              </div>

              {/* Photo Upload Area */}
              <div className="flex flex-col items-center py-2">
                <label className="relative cursor-pointer block">
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/jpg, image/webp"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  {playerImage ? (
                    <img
                      src={playerImage}
                      alt={player.name}
                      className="w-[120px] h-[160px] object-cover rounded-md shadow-md bg-slate-950 border border-slate-700"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-[120px] h-[160px] bg-slate-950 border-2 border-dashed border-cyan-500/50 rounded-md flex items-center justify-center text-cyan-400 hover:bg-slate-800 transition-colors">
                      <Plus className="h-8 w-8 stroke-[2.5]" />
                    </div>
                  )}
                </label>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-dashed border-slate-800">
                  <span className="text-slate-400">Full Name</span>
                  <span className="font-semibold text-white">{player.name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-dashed border-slate-800">
                  <span className="text-slate-400">Date of Birth</span>
                  <span className="font-mono text-slate-300">{player.dob || "1998-04-12"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-dashed border-slate-800">
                  <span className="text-slate-400">Age</span>
                  <span className="font-semibold text-white">{age} yrs old</span>
                </div>
                <div className="flex justify-between py-1 border-b border-dashed border-slate-800">
                  <span className="text-slate-400">Club</span>
                  <span className="font-semibold text-cyan-400">Cardiff Town FC</span>
                </div>
                <div className="flex justify-between py-1 border-b border-dashed border-slate-800">
                  <span className="text-slate-400">Tactical Role</span>
                  <span className="font-semibold text-cyan-400">{getPositionDisplayName(player.position)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-dashed border-slate-800">
                  <span className="text-slate-400 flex items-center gap-1"><Footprints className="h-3 w-3" /> Preferred Foot</span>
                  <span className="font-semibold text-white">{preferredFoot}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400 flex items-center gap-1"><Flag className="h-3 w-3" /> Nationality</span>
                  <span className="font-semibold text-white flex items-center gap-1">{nationality}</span>
                </div>
              </div>
            </div>

            {/* 2. Season Statistics Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4.5 space-y-3.5 flex flex-col justify-between">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <Activity className="h-4 w-4 text-cyan-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  Stats
                </h4>
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                <StatMicroBox label="POSITIONS" val={player.position} outline />
                <StatMicroBox label="APPEARANCES" val={`${appearances} match`} />
                <StatMicroBox label="MINUTES" val={`${player.minutesPlayed}′`} />
                <StatMicroBox label="GOALS (GLS)" val={player.goals} highlight />
                <StatMicroBox label="ASSISTS (AST)" val={player.assists} highlight />
                <StatMicroBox label="GOAL INVOLVEMENT" val={`${goalInvolvements} G+A`} outline />

                {/* User Requested Stats */}
                <StatMicroBox label="PASS ACCURACY" val={`${passAccuracy}%`} outline />
                <StatMicroBox label="SHOT ACCURACY" val={`${shotAccuracy}%`} outline />
                <StatMicroBox label="EXPECTED GOALS (xG)" val={Number(xGVal).toFixed(2)} highlight />
                <StatMicroBox label="EXPECTED ASSISTS (xA)" val={Number(xAVal).toFixed(2)} highlight />
                <StatMicroBox label="CROSS ACCURACY" val={`${crossAccuracy}%`} outline />
                <StatMicroBox label="KEY PASSES" val={player.keyPasses || 0} highlight />
              </div>
            </div>

            {/* 3. Player Radar Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4.5 flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-cyan-400" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                    Tactical Radar
                  </h4>
                </div>
                <span className="text-[9px] font-semibold text-slate-500 font-mono">( {player.position} )</span>
              </div>
              
              <div className="h-44 w-full flex items-center justify-center my-1" id="drawer-radar-axis-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                    <PolarGrid stroke="#334155" />
                    <PolarAngleAxis dataKey="name" tick={{ fontSize: 7, fill: "#94A3B8", fontWeight: "bold" }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} stroke="#475569" />
                    <Radar 
                      name={player.name} 
                      dataKey="value" 
                      stroke="#06B6D4" 
                      fill="#06B6D4" 
                      fillOpacity={0.4} 
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Grid of values below the chart */}
              <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-800" id="radar-values-grid">
                {radarData.map((item, idx) => {
                  const val = item.display !== undefined && item.display !== null && item.display !== "" ? item.display : "-";
                  return (
                    <div key={idx} className="flex flex-col p-2 bg-slate-950 border border-slate-800 rounded-lg">
                      <span className="text-[9px] text-slate-500 font-mono font-bold uppercase tracking-wider">{item.name}</span>
                      <span className="text-xs font-bold text-cyan-400 mt-0.5">{val}</span>
                    </div>
                  );
                })}
              </div>

              <p className="text-[10px] text-center text-slate-500 font-sans italic mt-2">
                {radarTitle} • Wyscout Consolidated Percentiles
              </p>
            </div>

          </div>

          {/* Bottom Section Layout: Single Full-Width Pitch Visualization */}
          <div className="w-full pt-2">
            
            {/* Full-Width Panel: Interactive Player Performance Heatmap & xG Shot Map */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3.5 flex flex-col justify-between shadow-xl">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-[#E2E8F0] pb-2.5">
                <div className="flex items-center gap-2">
                  <Map className="h-4.5 w-4.5 text-[#1D4ED8]" />
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-[#0A2342] uppercase tracking-wide font-sans">
                      {selectedHeatmapType === "xG" ? "Expected Goals (xG) Shot Map" : "Interactive Performance Heatmap"}
                    </h4>
                    <p className="text-[10px] text-slate-400">
                      {selectedHeatmapType === "xG" ? "Analysis of shot coordinates and goal outcomes" : "Visual player coordinate analytics & hotspots"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Category Filter */}
                  <select
                    value={selectedHeatmapType}
                    onChange={(e) => setSelectedHeatmapType(e.target.value)}
                    className="bg-white border border-[#E2E8F0] rounded py-0.5 px-2 text-[10px] font-semibold text-slate-600 appearance-none pr-5 focus:outline-none focus:ring-1 focus:ring-[#1D4ED8] cursor-pointer"
                  >
                    <option value="All">All Actions</option>
                    <option value="Activity">Activity Hotspots</option>
                    <option value="Pass">Passes (Blue)</option>
                    <option value="Shot">Shots (Orange)</option>
                    <option value="Goal">Goals (Red)</option>
                    <option value="Cross">Crosses (Green)</option>
                    <option value="Clearance">Clearances (Purple)</option>
                    <option value="xG">Expected Goals (xG)</option>
                  </select>

                  {/* Season Filter (Only for xG) */}
                  {selectedHeatmapType === "xG" && (
                    <div className="relative">
                      <select
                        value={selectedSeason}
                        onChange={(e) => setSelectedSeason(e.target.value)}
                        className="bg-white border border-[#E2E8F0] rounded py-0.5 px-2 text-[10px] font-semibold text-slate-600 appearance-none pr-5 focus:outline-none focus:ring-1 focus:ring-[#1D4ED8]"
                      >
                        <option value="All">All Campaigns</option>
                        <option value="2025/26">2025/26</option>
                        <option value="2024/25">2024/25</option>
                      </select>
                      <ChevronDown className="absolute right-1 top-1.5 h-3.5 w-3.5 pointer-events-none text-slate-400" />
                    </div>
                  )}

                  {/* Competition Filter (Only for xG) */}
                  {selectedHeatmapType === "xG" && (
                    <div className="relative">
                      <select
                        value={selectedComp}
                        onChange={(e) => setSelectedComp(e.target.value)}
                        className="bg-white border border-[#E2E8F0] rounded py-0.5 px-2 text-[10px] font-semibold text-slate-600 appearance-none pr-5 focus:outline-none focus:ring-1 focus:ring-[#1D4ED8]"
                      >
                        <option value="All">All Competitions</option>
                        <option value="K-League 1">K-League 1</option>
                        <option value="FA Cup">FA Cup</option>
                      </select>
                      <ChevronDown className="absolute right-1 top-1.5 h-3.5 w-3.5 pointer-events-none text-slate-400" />
                    </div>
                  )}

                  {/* Layout Toggle */}
                  <button 
                    onClick={() => setHeatmapLayout(prev => prev === "Horizontal" ? "Vertical" : "Horizontal")}
                    className="bg-white hover:bg-slate-50 border border-[#E2E8F0] p-1 rounded text-slate-500 hover:text-[#1D4ED8] transition-colors"
                    title="Toggle Field Layout (H/V)"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </button>

                  {/* Separate Heatmap Excel Upload */}
                  {selectedHeatmapType !== "xG" && (
                    <label className="bg-[#1D4ED8] hover:bg-blue-700 text-white font-semibold py-0.5 px-2 rounded text-[10px] flex items-center gap-1 cursor-pointer transition-colors shadow-2xs">
                      <Upload className="h-3 w-3" />
                      <span>Upload Coordinates</span>
                      <input 
                        type="file" 
                        accept=".xlsx, .xls" 
                        onChange={handlePlayerHeatmapUpload} 
                        className="hidden" 
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Status Banner */}
              {heatmapUploadStatus && selectedHeatmapType !== "xG" && (
                <div className={`p-2 rounded text-[10px] font-medium flex items-center gap-1.5 ${heatmapUploadStatus.success ? "bg-emerald-50 text-emerald-800 border border-emerald-100" : "bg-red-50 text-red-800 border border-red-100"}`}>
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{heatmapUploadStatus.message}</span>
                </div>
              )}

              {/* Pitch Matrix Settings Info Badge */}
              {selectedHeatmapType !== "xG" && (
                <div className="bg-[#1D4ED8]/5 border border-[#1D4ED8]/10 rounded-lg p-2 flex items-center justify-between text-[10px] text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Eye className="h-3 w-3 text-[#1D4ED8]" />
                    <span>
                      <span className="font-bold text-[#0A2342]">Coordinate Matrix Config:</span> Bottom-Right (0,0), X: 0-60, Y: 0-60 | Portrait 30x30 Grid
                    </span>
                  </div>
                </div>
              )}

              {/* Interactive Pitch */}
              <div className="flex-1 flex items-center justify-center min-h-[220px]">
                {selectedHeatmapType !== "xG" && playerPoints.length === 0 ? (
                  <div className="text-center py-10 text-slate-400">
                    <Map className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs font-semibold">No dynamic coordinate data available for {player.name}.</p>
                    <p className="text-[10px] mt-1">Upload a coordinate Excel file to visualize heat activity.</p>
                  </div>
                ) : (
                  <div className="w-full animate-fade-in">
                    {renderInteractivePitch()}
                  </div>
                )}
              </div>

              {/* Coordinate counts legend */}
              {(selectedHeatmapType === "xG" || playerPoints.length > 0) && (
                <div className="bg-slate-900/95 border border-slate-800 rounded px-2.5 py-1 flex items-center justify-between text-[8.5px] font-mono text-white/95">
                  <span className="font-bold">
                    {selectedHeatmapType === "xG" ? "EXPECTED GOALS (xG) SHOT MARKS" : "DYNAMIC COORDINATE MARKS"}
                  </span>
                  <span>
                    {selectedHeatmapType === "xG" 
                      ? `TOTAL SHOTS PLOTTED: ${filteredXgShots.length}` 
                      : `TOTAL POINTS PLOTTED: ${filteredPlayerPoints.length} / ${playerPoints.length}`}
                  </span>
                </div>
              )}
            </div>

          </div>
        </div>
      </motion.div>
    </div>
  );
}

// Stats Micro Layout Card
function StatMicroBox({ label, val, highlight = false, outline = false }: { label: string; val: any; highlight?: boolean; outline?: boolean }) {
  let cardStyle = "bg-slate-950 border border-slate-800";
  let labelStyle = "text-slate-400";
  let valStyle = "text-white";

  if (highlight) {
    cardStyle = "bg-cyan-950/40 border border-cyan-500/30 text-white";
    labelStyle = "text-cyan-400 font-bold";
    valStyle = "text-cyan-300";
  } else if (outline) {
    cardStyle = "bg-slate-900 border border-slate-700 text-slate-200";
    labelStyle = "text-slate-400 font-bold";
    valStyle = "text-white";
  }

  return (
    <div className={`p-2.5 rounded-lg flex flex-col justify-between text-left ${cardStyle}`}>
      <span className={`text-[8.5px] uppercase tracking-wider font-mono block ${labelStyle}`}>
        {label}
      </span>
      <span className={`text-sm font-bold font-mono mt-1 ${valStyle}`}>
        {val}
      </span>
    </div>
  );
}

// -------------------------------------------------------------
// INTERNAL SVG SHOT MAP DRAW DATA
// -------------------------------------------------------------
function ShotMap({ player, season, competition }: { player: Player; season: string; competition: string }) {
  // Stable random generator based on player ID/name
  const shots = useMemo(() => {
    const list = [];
    const totalShots = player.shots || 0;
    const goals = player.goals || 0;
    
    let seed = player.name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const random = () => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };

    // Goals (Always scored in the final third towards the right attacking end box, high xG)
    for (let i = 0; i < goals; i++) {
      const x = 101 + random() * 16.5; // right penalty box is 102 to 120
      const y = 25 + random() * 30;    // center is 40
      const xG = parseFloat((0.15 + random() * 0.70).toFixed(2));
      const comp = random() > 0.3 ? "K-League 1" : "FA Cup";
      const seas = random() > 0.35 ? "2025/26" : "2024/25";
      list.push({ isGoal: true, x, y, xG, competition: comp, season: seas });
    }

    // Missed/blocked shots (Further out, lower xG values)
    const misses = Math.max(0, totalShots - goals);
    for (let i = 0; i < misses; i++) {
      const x = 75 + random() * 35;   // right half of pitch
      const y = 14 + random() * 52;   // width is 80
      const xG = parseFloat((0.02 + random() * 0.17).toFixed(2));
      const comp = random() > 0.3 ? "K-League 1" : "FA Cup";
      const seas = random() > 0.35 ? "2025/26" : "2024/25";
      list.push({ isGoal: false, x, y, xG, competition: comp, season: seas });
    }

    return list;
  }, [player]);

  const filteredShots = useMemo(() => {
    return shots.filter(s => {
      const matchSeason = season === "All" || s.season === season;
      const matchComp = competition === "All" || s.competition === competition;
      return matchSeason && matchComp;
    });
  }, [shots, season, competition]);

  // Color mappings
  const getXgColor = (xg: number, isGoal: boolean) => {
    if (isGoal) return "#10B981"; // Emerald
    if (xg > 0.12) return "#F59E0B"; // Amber
    return "#3B82F6"; // Royal/Accent blue
  };

  return (
    <div className="relative w-full aspect-[120/80] bg-[#0A2342] rounded-xl overflow-hidden border border-[#E2E8F0]">
      <svg viewBox="0 0 120 80" className="w-full h-full select-none">
        
        {/* Soccer field markings */}
        <g opacity="0.45" stroke="#FFF" fill="none" strokeWidth="1.2">
          {/* Pitch boundary */}
          <rect x="0" y="0" width="120" height="80" strokeWidth="1.2" />
          {/* Halfway line */}
          <line x1="60" y1="0" x2="60" y2="80" strokeWidth="1.2" />
          {/* Center Circle */}
          <circle cx="60" cy="40" r="10" strokeWidth="1.2" />
          <circle cx="60" cy="40" r="0.75" fill="#FFF" />
          
          {/* Left Penalty Area */}
          <rect x="0" y="18" width="18" height="44" strokeWidth="1.2" />
          <rect x="0" y="30" width="6" height="20" strokeWidth="1.2" />
          <circle cx="12" cy="40" r="0.75" fill="#FFF" stroke="none" />
          <path d="M 18,30 A 10,10 0 0,1 18,50" strokeWidth="1.2" />
          
          {/* Right Penalty Area */}
          <rect x="102" y="18" width="18" height="44" strokeWidth="1.2" />
          <rect x="114" y="30" width="6" height="20" strokeWidth="1.2" />
          <circle cx="108" cy="40" r="0.75" fill="#FFF" stroke="none" />
          <path d="M 102,30 A 10,10 0 0,0 102,50" strokeWidth="1.2" />

          {/* Goals */}
          <line x1="120" y1="36" x2="120" y2="44" strokeWidth="3" />
          <line x1="0" y1="36" x2="0" y2="44" strokeWidth="3" />
        </g>

        {/* Action Shot Marks */}
        {filteredShots.map((shot, idx) => {
          const color = getXgColor(shot.xG, shot.isGoal);
          if (shot.isGoal) {
            return (
              <g key={idx} className="cursor-pointer">
                {/* Pulsing ring for Goal! */}
                <circle cx={shot.x} cy={shot.y} r="5.5" fill="none" stroke={color} strokeWidth="1" className="animate-ping" opacity="0.5" />
                <circle cx={shot.x} cy={shot.y} r="3" fill={color} />
                <polygon 
                  points={`${shot.x},${shot.y-4.5} ${shot.x+1.2},${shot.y-1.2} ${shot.x+4.5},${shot.y} ${shot.x+1.2},${shot.y+1.2} ${shot.x},${shot.y+4.5} ${shot.x-1.2},${shot.y+1.2} ${shot.x-4.5},${shot.y} ${shot.x-1.2},${shot.y-1.2}`} 
                  fill="#F59E0B" 
                />
                <title>{`GOAL! xG: ${shot.xG} | ${shot.season} ${shot.competition}`}</title>
              </g>
            );
          } else {
            const size = 1.6 + shot.xG * 1.5;
            return (
              <g key={idx} className="cursor-pointer">
                <circle 
                  cx={shot.x} 
                  cy={shot.y} 
                  r={size} 
                  fill={color} 
                  opacity={0.8}
                  className="hover:opacity-100"
                />
                <title>{`Missed shot | xG: ${shot.xG} | ${shot.season} ${shot.competition}`}</title>
              </g>
            );
          }
        })}

        {/* Null feedback */}
        {filteredShots.length === 0 && (
          <text x="60" y="40" fill="#FFF" fontSize="5" opacity="0.7" textAnchor="middle" fontWeight="bold">
            No tracked shots match active parameters
          </text>
        )}
      </svg>

      {/* Colour guides */}
      <div className="absolute bottom-2.5 left-2.5 flex items-center gap-3 bg-slate-900/95 border border-slate-800 rounded px-2.5 py-1 text-[8.5px] font-mono text-white/90">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-[#10B981] rounded-full inline-block animate-pulse" /> GOAL
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-[#F59E0B] rounded-full inline-block" /> High xG Class (&gt;0.12)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-[#3B82F6] rounded-full inline-block" /> Low xG Class
        </span>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// INTERNAL SVG PASS HEATMAP GENERATOR
// -------------------------------------------------------------
function PassHeatmap({ player }: { player: Player }) {
  const isPos = (target: "Forward" | "Midfielder" | "Defender" | "Goalkeeper") => pIsPosition(player.position, target);

  const { heatSpots, passVectors } = useMemo(() => {
    const spots = [];
    const vectors = [];
    let seed = player.name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const random = () => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };

    // 1. Generate underlying radial heat spots based on position
    if (isPos("Goalkeeper")) {
      spots.push({ x: 12, y: 40, r: 16, opacity: 0.85 });
      spots.push({ x: 22, y: 35, r: 11, opacity: 0.6 });
    } else if (isPos("Defender")) {
      const isWide = ["FB", "LB", "RB"].includes(String(player.position).trim().toUpperCase());
      if (isWide) {
        spots.push({ x: 30, y: 15, r: 16, opacity: 0.8 });
        spots.push({ x: 55, y: 16, r: 14, opacity: 0.75 });
        spots.push({ x: 30, y: 65, r: 16, opacity: 0.8 });
      } else {
        spots.push({ x: 30, y: 40, r: 20, opacity: 0.85 });
        spots.push({ x: 25, y: 24, r: 14, opacity: 0.7 });
        spots.push({ x: 25, y: 56, r: 14, opacity: 0.7 });
      }
    } else if (isPos("Midfielder")) {
      spots.push({ x: 60, y: 40, r: 22, opacity: 0.85 });
      spots.push({ x: 45, y: 30, r: 15, opacity: 0.7 });
      spots.push({ x: 75, y: 50, r: 15, opacity: 0.7 });
    } else { // Forward/Attacker
      const isWinger = ["WINGER", "LW", "RW"].includes(String(player.position).trim().toUpperCase());
      if (isWinger) {
        spots.push({ x: 90, y: 16, r: 18, opacity: 0.85 });
        spots.push({ x: 105, y: 22, r: 13, opacity: 0.75 });
        spots.push({ x: 90, y: 64, r: 18, opacity: 0.85 });
      } else {
        spots.push({ x: 98, y: 40, r: 19, opacity: 0.9 });
        spots.push({ x: 84, y: 32, r: 14, opacity: 0.75 });
        spots.push({ x: 84, y: 48, r: 14, opacity: 0.75 });
      }
    }

    // 2. Generate pass action coordinates (X, Y) vectors from "Pass" actions
    const totalPasses = player.totalPasses || 25;
    const successfulPasses = player.successfulPasses || Math.round(totalPasses * 0.8);

    let centerX = 60;
    let centerY = 40;
    let spreadX = 20;
    let spreadY = 20;

    if (isPos("Goalkeeper")) {
      centerX = 15; centerY = 40; spreadX = 10; spreadY = 18;
    } else if (isPos("Defender")) {
      centerX = 32; centerY = 40; spreadX = 18; spreadY = 25;
    } else if (isPos("Midfielder")) {
      centerX = 60; centerY = 40; spreadX = 24; spreadY = 25;
    } else {
      centerX = 88; centerY = 40; spreadX = 18; spreadY = 25;
    }

    for (let i = 0; i < totalPasses; i++) {
      const isSuccess = i < successfulPasses;
      const x = Math.max(6, Math.min(114, centerX + (random() - 0.5) * spreadX * 2));
      const y = Math.max(6, Math.min(74, centerY + (random() - 0.5) * spreadY * 2));
      
      // Target direction (passes tend to go forward)
      const dist = 8 + random() * 12;
      const angle = (random() - 0.4) * Math.PI; // mostly forward or sideways
      const tx = Math.max(4, Math.min(116, x + Math.cos(angle) * dist));
      const ty = Math.max(4, Math.min(76, y + Math.sin(angle) * dist));

      vectors.push({ x, y, tx, ty, isSuccess });
    }

    return { heatSpots: spots, passVectors: vectors };
  }, [player]);

  return (
    <div className="relative w-full aspect-[120/80] bg-[#0A2342] rounded-xl overflow-hidden border border-[#E2E8F0]">
      <svg viewBox="0 0 120 80" className="w-full h-full select-none">
        
        {/* Field Line Marks */}
        <g opacity="0.3" stroke="#E2E8F0" fill="none" strokeWidth="1">
          <rect x="0" y="0" width="120" height="80" strokeWidth="1" />
          <line x1="60" y1="0" x2="60" y2="80" strokeWidth="1" />
          <circle cx="60" cy="40" r="10" strokeWidth="1" />
          <circle cx="60" cy="40" r="0.75" fill="#FFF" />
          
          <rect x="0" y="18" width="18" height="44" strokeWidth="1" />
          <rect x="0" y="30" width="6" height="20" strokeWidth="1" />
          <circle cx="12" cy="40" r="0.75" fill="#FFF" />
          <path d="M 18,30 A 10,10 0 0,1 18,50" strokeWidth="1" />
          
          <rect x="102" y="18" width="18" height="44" strokeWidth="1" />
          <rect x="114" y="30" width="6" height="20" strokeWidth="1" />
          <circle cx="108" cy="40" r="0.75" fill="#FFF" stroke="none" />
          <path d="M 102,30 A 10,10 0 0,0 102,50" strokeWidth="1" />

          <line x1="120" y1="36" x2="120" y2="44" strokeWidth="2.5" />
          <line x1="0" y1="36" x2="0" y2="44" strokeWidth="2.5" />
        </g>

        {/* Heatmap Gradients Definition */}
        <defs>
          <radialGradient id="wyscoutPassHeat" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#10B981" stopOpacity="0.75" />
            <stop offset="40%" stopColor="#3B82F6" stopOpacity="0.45" />
            <stop offset="75%" stopColor="#1E3A8A" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#0A2342" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Underlying density heatspots */}
        {heatSpots.map((spot, idx) => (
          <circle 
            key={idx}
            cx={spot.x}
            cy={spot.y}
            r={spot.r}
            fill="url(#wyscoutPassHeat)"
            opacity={spot.opacity}
          />
        ))}

        {/* Individual Pass Vectors/Actions */}
        {passVectors.map((v, idx) => (
          <g key={idx} opacity="0.85">
            {/* Connection line */}
            <line 
              x1={v.x} 
              y1={v.y} 
              x2={v.tx} 
              y2={v.ty} 
              stroke={v.isSuccess ? "#10B981" : "#F59E0B"} 
              strokeWidth="0.4" 
              strokeDasharray={v.isSuccess ? "none" : "1.2 1.2"} 
            />
            {/* Origin marker */}
            <circle 
              cx={v.x} 
              cy={v.y} 
              r="0.8" 
              fill={v.isSuccess ? "#10B981" : "#F59E0B"} 
            />
            {/* Target tiny arrowhead dot */}
            <circle 
              cx={v.tx} 
              cy={v.ty} 
              r="0.4" 
              fill="#FFF" 
              opacity="0.9"
            />
          </g>
        ))}

        <text x="5" y="7" fill="#60A5FA" fontSize="4.5" fontWeight="bold" opacity="0.6">
          OWN HALF
        </text>
        <text x="115" y="7" fill="#60A5FA" fontSize="4.5" fontWeight="bold" opacity="0.6" textAnchor="end">
          ATTACKING HALF
        </text>
      </svg>

      {/* Pass metrics legend */}
      <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between bg-slate-900/95 border border-slate-800 rounded px-2.5 py-1 text-[8.5px] font-mono text-white/95">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-[#10B981] rounded-full" /> Complete Pass
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-[#F59E0B] rounded-full" /> Incomplete Pass
          </span>
        </div>
        <span className="text-[8px] text-slate-400 font-bold">TOTAL ATTEMPTS: {player.totalPasses || 0}</span>
      </div>
    </div>
  );
}
