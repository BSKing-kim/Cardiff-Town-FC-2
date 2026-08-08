import React, { useState, useEffect } from "react";
import { MatchData, CustomTeam, UserProfile, UserRole } from "../types";
import { KPICalculator } from "../lib/kpiCalculations";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend, Cell, LabelList } from "recharts";
import { 
  Target, Shield, RefreshCw, Layers, Sparkles, TrendingUp, Calendar, ArrowRight, HelpCircle,
  ChevronLeft, ChevronRight, Printer, Upload
} from "lucide-react";
import TeamLogo from "./TeamLogo";
import { ExcelUtils, parseAndUploadExcel } from "../lib/excelUtils";
import { DataService } from "../lib/dataService";
import LeagueStandings from "./LeagueStandings";
import { LEAGUES, calculateDivisionStandings } from "../lib/leagueData";

export { LEAGUES };

interface TeamDashboardProps {
  matches: MatchData[];
  customTeams?: CustomTeam[];
  onSelectOpponent?: (opponent: string) => void;
  defaultTab?: string;
  hideLeagueTableOnMobile?: boolean;
  showOnlyLeagueTableOnMobile?: boolean;
  currentUser?: UserProfile | null;
  onTeamsUpdated?: () => void;
}

type TabType = "General" | "Tactical Stats" | "Set Pieces";

const DonutChartCard = ({ label, percentage, color = "#eab308" }: { label: string; percentage: number; color?: string }) => {
  const val = Math.min(100, Math.max(0, Math.round(percentage || 0)));
  const strokeDasharray = `${val} ${100 - val}`;
  return (
    <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-4 flex flex-col items-center justify-between shadow-md text-center">
      <span className="text-xs font-black text-[#94a3b8] uppercase tracking-wider mb-2">{label}</span>
      <div className="relative w-24 h-24 flex items-center justify-center my-1">
        <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
          <path
            className="text-[#0b0f19] stroke-current"
            strokeWidth="3.8"
            fill="none"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
          <path
            stroke={color}
            strokeDasharray={strokeDasharray}
            strokeWidth="3.8"
            strokeLinecap="round"
            fill="none"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
        </svg>
        <span className="absolute text-xl font-black text-white">{val}%</span>
      </div>
    </div>
  );
};

export default function TeamDashboard({ matches, customTeams = [], onSelectOpponent, defaultTab, hideLeagueTableOnMobile, showOnlyLeagueTableOnMobile, currentUser, onTeamsUpdated }: TeamDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>("General");
  const [selectedMatchId, setSelectedMatchId] = useState<string>("latest");
  const [trendChartType, setTrendChartType] = useState<"line" | "bar">("line");
  const [compFilter, setCompFilter] = useState<string>("all"); // "all", "League", "Cup", "Friendly"
  const [venueFilter, setVenueFilter] = useState<"all" | "Home" | "Away">("all");
  const [activeLeagueIdx, setActiveLeagueIdx] = useState<number>(3); // Defaulting to Third Division (Cardiff Town's division)
  const [showExportWarning, setShowExportWarning] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [viewType, setViewType] = useState<"list" | "graph">("list");

  const [teamsUploadStatus, setTeamsUploadStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [isUploadingTeams, setIsUploadingTeams] = useState(false);

  const isStaff = currentUser && (currentUser.isAdmin || currentUser.role !== UserRole.Player);

  const handleTeamsExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm("Uploading a new teams list will delete all existing teams and replace them with the teams from this file. Match records will automatically be linked and cumulative stats re-aggregated for the new team list. Do you wish to continue?")) {
      e.target.value = "";
      return;
    }

    setIsUploadingTeams(true);
    setTeamsUploadStatus(null);

    try {
      const res = await parseAndUploadExcel(file, 'teams');

      setTeamsUploadStatus({
        success: true,
        message: `Successfully loaded & synced ${res.count} teams from Excel across divisions!`
      });

      if (onTeamsUpdated) {
        onTeamsUpdated();
      }

      setTimeout(() => {
        setTeamsUploadStatus(null);
      }, 5000);
    } catch (err: any) {
      console.error(err);
      setTeamsUploadStatus({
        success: false,
        message: err.message || "Failed to process the teams Excel file."
      });
    } finally {
      setIsUploadingTeams(false);
      e.target.value = "";
    }
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Sync active tab with mobile layout triggers
  useEffect(() => {
    if (defaultTab) {
      if (defaultTab === "Attack" || defaultTab === "Defense") {
        setActiveTab("General");
      } else if (defaultTab === "Transition" || defaultTab === "Possession") {
        setActiveTab("Tactical Stats");
      } else {
        setActiveTab(defaultTab as TabType);
      }
    }
  }, [defaultTab]);

  // Load configured active PI and KPI lists
  const checkedPIsStr = typeof window !== "undefined" ? localStorage.getItem("checked_pi_list") : null;
  const activePiIds = checkedPIsStr ? JSON.parse(checkedPIsStr) : null;

  const checkedKPIsStr = typeof window !== "undefined" ? localStorage.getItem("checked_kpi_list") : null;
  const activeKpiIds = checkedKPIsStr ? JSON.parse(checkedKPIsStr) : null;

  const isPiActive = (id: string) => {
    if (!activePiIds) return true;
    return activePiIds.includes(id);
  };

  const isKpiActive = (id: string) => {
    if (!activeKpiIds) return true;
    return activeKpiIds.includes(id);
  };

  // 1. Filter matches by competition type and venue
  const filteredMatches = matches.filter(m => {
    const matchesComp = compFilter === "all" || m.competition?.toLowerCase() === compFilter.toLowerCase();
    const matchesVenue = venueFilter === "all" || m.venue?.toLowerCase() === venueFilter.toLowerCase();
    return matchesComp && matchesVenue;
  });

  const ourMatches = filteredMatches.filter(m => !m.isOpponentTeam).sort((a,b) => a.date.localeCompare(b.date));
  const latestMatch = ourMatches.length > 0 ? ourMatches[ourMatches.length - 1] : null;

  // Active dataset
  const activeMatch = selectedMatchId === "all" 
    ? KPICalculator.getAverage(ourMatches) 
    : selectedMatchId === "latest" || !selectedMatchId
      ? (latestMatch || KPICalculator.getAverage(ourMatches))
      : (ourMatches.find(m => m.id === selectedMatchId) || latestMatch || KPICalculator.getAverage(ourMatches));

  // Calculated KPIs for the active display row
  const attackKPI = KPICalculator.calculateAttack(activeMatch);
  const defenseKPI = KPICalculator.calculateDefense(activeMatch);
  const transitionKPI = KPICalculator.calculateTransition(activeMatch);
  const possessionKPI = KPICalculator.calculatePossession(activeMatch);
  const setPieceKPI = KPICalculator.calculateSetPiece(activeMatch);

  // Standings calculation overlaying uploaded League match data starting from 0 baseline
  const calculateStandings = () => {
    const activeLeagueName = LEAGUES[activeLeagueIdx];
    return calculateDivisionStandings(activeLeagueName, [], customTeams);
  };

  const standings = calculateStandings();

  const renderLeagueTable = (isMobileLayout: boolean) => {
    return (
      <div className={`rounded-xl border border-[#E2E8F0] bg-white p-4 sm:p-5 shadow-xs ${isMobileLayout ? "block" : "hidden md:block"}`}>
        <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3.5 mb-4">
          <div className="max-w-[70%]">
            <h3 className="font-display font-bold text-[#0A2342] text-xs sm:text-sm md:text-base leading-tight">
              {LEAGUES[activeLeagueIdx]}
            </h3>
            <p className="text-[10px] text-slate-500 mt-0.5 font-sans">
              Division {activeLeagueIdx + 1} of 4 • CCFL
            </p>
          </div>
          
          {/* Arrow Navigation & Excel Upload */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isStaff && (
              <>
                <input
                  type="file"
                  id="teams-excel-upload"
                  accept=".xlsx, .xls"
                  className="hidden"
                  onChange={handleTeamsExcelUpload}
                  disabled={isUploadingTeams}
                />
                <button
                  onClick={() => document.getElementById("teams-excel-upload")?.click()}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] sm:text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer"
                  title="Upload Teams Excel (Premier, First, Second, Third Division sheets)"
                  disabled={isUploadingTeams}
                >
                  <Upload className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  <span className="hidden sm:inline">{isUploadingTeams ? "Uploading..." : "Upload Teams"}</span>
                </button>
              </>
            )}

            <button
              onClick={() => setActiveLeagueIdx((prev) => (prev === 0 ? LEAGUES.length - 1 : prev - 1))}
              className="p-1 rounded-md border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 transition cursor-pointer"
              title="Previous Division"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setActiveLeagueIdx((prev) => (prev === LEAGUES.length - 1 ? 0 : prev + 1))}
              className="p-1 rounded-md border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 transition cursor-pointer"
              title="Next Division"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {teamsUploadStatus && (
          <div className={`p-2.5 mb-4 rounded-lg border text-xs ${
            teamsUploadStatus.success 
              ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}>
            {teamsUploadStatus.message}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-sans">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500 font-bold bg-slate-50">
                <th className="py-2 px-1 text-center w-8">Pos</th>
                <th className="py-2 px-2">Club Name</th>
                <th className="py-2 px-1.5 text-center">MP</th>
                <th className="py-2 px-1.5 text-center">W</th>
                <th className="py-2 px-1.5 text-center">D</th>
                <th className="py-2 px-1.5 text-center">L</th>
                <th className="py-2 px-1.5 text-center">GD</th>
                <th className="py-2 px-2 text-center font-bold text-[#0A2342]">Pts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {standings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 text-xs">
                    <div className="flex flex-col items-center justify-center gap-1.5 p-2">
                      <Shield className="w-6 h-6 text-slate-400" />
                      <span className="font-bold text-slate-700">No teams registered for this division yet.</span>
                      <span className="text-slate-500 text-[11px]">Upload the League Teams template to build standings.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                standings.map((team, idx) => {
                const isUs = team.name === "Cardiff Town FC";
                return (
                  <tr 
                    key={team.name}
                    className={`hover:bg-amber-50/40 transition-colors ${
                      isUs ? "bg-[#0A2342]/5 font-semibold text-[#0A2342] border-l-4 border-[#D4AF37]" : "text-slate-700"
                    }`}
                  >
                    <td className="py-1.5 px-1 text-center text-slate-500 font-semibold">{idx + 1}</td>
                    <td className="py-1.5 px-2 max-w-[120px] sm:max-w-[180px] md:max-w-[200px]">
                      <div className="flex items-center gap-2 w-full min-w-0">
                        <TeamLogo teamName={team.name} size={18} className="shadow-2xs rounded-sm shrink-0" />
                        {isUs ? (
                          <span className="font-bold flex items-center gap-1.5 text-[#0A2342] truncate whitespace-nowrap min-w-0">
                            <span className="truncate">{team.name}</span>
                            <span className="text-[8px] bg-[#D4AF37] text-[#0A2342] px-1.5 py-0.5 rounded font-extrabold uppercase shadow-sm shrink-0">US</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => onSelectOpponent && onSelectOpponent(team.name)}
                            className="hover:text-[#0A2342] hover:underline font-medium flex items-center gap-1 transition-colors text-left cursor-pointer text-slate-700 truncate whitespace-nowrap min-w-0"
                          >
                            <span className="truncate">{team.name}</span>
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-1.5 px-1.5 text-center">{team.mp}</td>
                    <td className="py-1.5 px-1.5 text-center">{team.w}</td>
                    <td className="py-1.5 px-1.5 text-center">{team.d}</td>
                    <td className="py-1.5 px-1.5 text-center">{team.l}</td>
                    <td className={`py-1.5 px-1.5 text-center font-semibold ${team.gd > 0 ? "text-emerald-600" : team.gd < 0 ? "text-rose-600" : "text-slate-500"}`}>
                      {team.gd > 0 ? `+${team.gd}` : team.gd}
                    </td>
                    <td className="py-1.5 px-2 text-center font-bold text-slate-900">{team.pts}</td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (showOnlyLeagueTableOnMobile) {
    return (
      <LeagueStandings
        customTeams={customTeams}
        currentUser={currentUser}
        onSelectOpponent={onSelectOpponent}
        onTeamsUpdated={onTeamsUpdated}
        embeddedMode={false}
      />
    );
  }

  // Helper to compute average and total stats for KPIs
  const getKpiStats = (id: string) => {
    if (ourMatches.length === 0) return { avg: "0.0", total: "0.0" };
    const values = ourMatches.map(m => {
      const anyM = m as any;
      const att = KPICalculator.calculateAttack(m);
      const def = KPICalculator.calculateDefense(m);
      const tran = KPICalculator.calculateTransition(m);
      const set = KPICalculator.calculateSetPiece(m);

      const shots = anyM.shots || 1;
      const shotsOnTarget = anyM.shotsOnTarget ?? 0;
      const insideBoxShots = anyM.insideBoxShots ?? 0;
      const blockedShots = anyM.shotBlocked ?? anyM.blockedShot ?? 0;
      const goals = anyM.goals ?? 0;

      const totalPasses = anyM.totalPasses || anyM.passes || 1;
      const successfulPasses = anyM.successfulPasses ?? Math.round(totalPasses * 0.8);
      const longPasses = anyM.longPasses ?? 0;
      const successfulCrosses = anyM.successfulCrosses ?? 0;
      const crossesAttempted = anyM.crossesAttempted ?? anyM.crosses ?? 0;
      const corners = anyM.corners ?? 0;

      const finalThirdEntries = anyM.finalThirdPasses ?? anyM.finalThirdEntry ?? 15;
      const boxEntries = anyM.boxEntries ?? anyM.penaltyAreaEntry ?? 12;

      const aerialDuelWin = anyM.aerialDuelWin ?? 0;
      const aerialDuelLoss = anyM.aerialDuelLoss ?? 0;
      const groundDuelWin = anyM.groundDuelWin ?? 0;
      const groundDuelLoss = anyM.groundDuelLoss ?? 0;

      const tacklesAttempted = anyM.tacklesAttempted ?? 1;
      const tacklesWon = anyM.tacklesWon ?? anyM.tacklesSucceeded ?? 0;
      const recoveries = anyM.ballRecoveries ?? anyM.recoveries ?? 20;

      const counterAttacks = anyM.counterAttacks ?? 0;

      switch (id) {
        // Attack - Shots
        case "shotAccuracyTotal":
          return (shotsOnTarget / shots) * 100;
        case "shotAccuracyExclBlocked":
          return (shotsOnTarget / Math.max(1, shots - blockedShots)) * 100;
        case "goalConversion":
          return (goals / shots) * 100;
        case "xG":
          return att.xG;
        case "shotsOutsideBoxProp":
          return (Math.max(0, shots - insideBoxShots) / shots) * 100;
        case "shotsInsideBoxProp":
          return (insideBoxShots / shots) * 100;

        // Attack - Passes
        case "passAccuracy":
          return (successfulPasses / totalPasses) * 100;
        case "longPassesAccuracy":
          return ((Math.round(longPasses * 0.65)) / Math.max(1, longPasses)) * 100;
        case "passesInOpponentHalfAccuracy":
          return 72.5;
        case "passesInFinalThirdAccuracy":
          return 68.0;
        case "crossingAccuracy":
          return (successfulCrosses / Math.max(1, crossesAttempted)) * 100;
        case "openPlayCrossingAccuracy":
          return 31.2;
        case "longPassesProp":
          return (longPasses / totalPasses) * 100;
        case "forwardPassesProp":
          return ((anyM.forwardPasses ?? anyM.progressivePasses ?? 0) / totalPasses) * 100;
        case "keyPassesProp":
          return ((anyM.keyPasses ?? 0) / totalPasses) * 100;
        case "xA":
          return (anyM.keyPasses ?? 0) * 0.12 + successfulCrosses * 0.08;

        // Attack - Distribution
        case "finalThirdEntryToShot":
          return Math.min(100, (shots / Math.max(1, finalThirdEntries)) * 100);
        case "penaltyAreaEntryToShot":
          return Math.min(100, (shots / Math.max(1, boxEntries)) * 100);
        case "duelsSuccessRate":
          const totalDuels = aerialDuelWin + aerialDuelLoss + groundDuelWin + groundDuelLoss;
          return (((aerialDuelWin + groundDuelWin) / Math.max(1, totalDuels)) * 100);
        case "aerialDuelsWon":
          return (aerialDuelWin / Math.max(1, aerialDuelWin + aerialDuelLoss)) * 100;
        case "groundDuelsWon":
          return (groundDuelWin / Math.max(1, groundDuelWin + groundDuelLoss)) * 100;

        // Defense
        case "tackleSuccessRate":
          return (tacklesWon / tacklesAttempted) * 100;
        case "recoveriesInAttackingHalf":
          return Math.round(recoveries * 0.15);

        // Tactics
        case "counterAttackShotProp":
          return (Math.round(counterAttacks * 0.4) / shots) * 100;
        case "counterAttackShotAccuracy":
          return 52.5;

        // Set Pieces
        case "foulWonAvg":
          return anyM.wasFouled ?? 6;
        case "foulCommittedAvg":
          return anyM.fouls ?? 8;
        case "directFreeKickSuccess":
          return 9.5;
        case "freeKickCrossingAccuracy":
          return 34.8;
        case "cornerToShotRate":
          return (Math.round(corners * 0.3) / Math.max(1, corners)) * 100;
        case "cornerToShotAllowedRate":
          return (Math.round(corners * 0.1) / Math.max(1, corners)) * 100;
        case "cornerToConcededRate":
          return 1.2;
        case "cornerToClearanceRate":
          return (Math.round(corners * 0.5) / Math.max(1, corners)) * 100;

        default:
          return 0;
      }
    });

    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / ourMatches.length;

    const numericList = ["xG", "xA", "recoveriesInAttackingHalf", "foulWonAvg", "foulCommittedAvg"];
    const isNoTotal = !numericList.includes(id);

    return {
      avg: avg.toFixed(1),
      total: isNoTotal ? "-" : sum.toFixed(1)
    };
  };

  // Helper to compute average and total stats for PIs
  const getPiStats = (key: string) => {
    if (ourMatches.length === 0) return { avg: "0.0", total: "0.0" };
    const values = ourMatches.map(m => {
      const anyM = m as any;
      if (key === "blockedShots") return anyM.shotBlocked ?? anyM.blockedShot ?? 0;
      if (key === "headedShots") return anyM.headedShots ?? Math.round(anyM.shots * 0.15);
      if (key === "shotsOutsideBox") return Math.max(0, anyM.shots - (anyM.insideBoxShots || 0));
      if (key === "passesInOpponentHalf") return Math.round((anyM.passes || anyM.totalPasses || 0) * 0.45);
      if (key === "openPlayCrosses") return Math.max(0, (anyM.crosses || anyM.crossesAttempted || 0) - (anyM.corners || 0));
      if (key === "duels") return anyM.aerialDuelWin ? anyM.aerialDuelWin + (anyM.aerialDuelLoss || 0) + (anyM.groundDuelWin || 0) + (anyM.groundDuelLoss || 0) : 25;
      if (key === "aerialDuels") return anyM.aerialDuelWin ? anyM.aerialDuelWin + (anyM.aerialDuelLoss || 0) : 10;
      if (key === "groundDuels") return anyM.groundDuelWin ? anyM.groundDuelWin + (anyM.groundDuelLoss || 0) : 15;
      if (key === "foulsWon") return anyM.wasFouled ?? 6;
      if (key === "attackingThirdRecovery") return Math.round((anyM.ballRecoveries || anyM.recoveries || 20) * 0.15);
      if (key === "defensiveThirdRecovery") return Math.round((anyM.ballRecoveries || anyM.recoveries || 20) * 0.45);
      if (key === "midfieldThirdRecovery") return Math.round((anyM.ballRecoveries || anyM.recoveries || 20) * 0.40);
      if (key === "counterAttackToShot") return Math.round((anyM.counterAttacks || 0) * 0.4);
      if (key === "freeKickAward") return anyM.freeKicks ?? 5;
      if (key === "directFreeKick") return Math.round((anyM.freeKicks ?? 5) * 0.3);
      if (key === "freeKickCrosses") return Math.round((anyM.freeKicks ?? 5) * 0.5);
      if (key === "cornerToShot") return Math.round(anyM.corners * 0.3);
      if (key === "cornerToShotAllowed") return Math.round(anyM.corners * 0.1);
      if (key === "cornerToConceded") return 0;
      if (key === "cornerToClearance") return Math.round(anyM.corners * 0.5);
      if (key === "redCard") return 0;

      const val = anyM[key];
      return typeof val === "number" ? val : 0;
    });

    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / ourMatches.length;

    const isPercent = key === "possessionRate" || key === "passSuccessRate";

    return {
      avg: avg.toFixed(1),
      total: isPercent ? "-" : sum.toFixed(1)
    };
  };



  // Chronological trend data
  const chartData = ourMatches.map(m => {
    const att = KPICalculator.calculateAttack(m);
    const def = KPICalculator.calculateDefense(m);
    const tran = KPICalculator.calculateTransition(m);
    const set = KPICalculator.calculateSetPiece(m);

    return {
      name: `${m.date.substring(5)} (${m.opponent})`,
      date: m.date,
      opponent: m.opponent,
      // General
      "Shots": m.shots,
      "Attack xG": att.xG,
      "Shot Conversion Rate (%)": att.shotConversionRate,
      "Box Entries": att.boxEntries,
      "Conceded xG": def.opponentXgConceded,
      "PPDA": def.ppda,
      "Defensive Duel Win Rate (%)": def.defensiveDuelWinRate,
      // Tactical Stats
      "Recoveries": m.recoveries,
      "Transition Shot Delay": tran.recoveryToShotTime,
      "Turnovers": m.turnovers,
      // Set piece
      "Set Piece xG": set.setPieceXg,
      "Corners": m.corners,
    };
  });

  const getMatchMetrics = (m: MatchData) => {
    const anyM = m as any;
    const att = KPICalculator.calculateAttack(m);
    const def = KPICalculator.calculateDefense(m);
    const tran = KPICalculator.calculateTransition(m);
    const set = KPICalculator.calculateSetPiece(m);

    const shots = anyM.shots || 1;
    const shotsOnTarget = anyM.shotsOnTarget ?? 0;
    const insideBoxShots = anyM.insideBoxShots ?? 0;
    const blockedShots = anyM.shotBlocked ?? anyM.blockedShot ?? 0;
    const goals = anyM.goals ?? 0;

    const totalPasses = anyM.totalPasses || anyM.passes || 1;
    const successfulPasses = anyM.successfulPasses ?? Math.round(totalPasses * 0.8);
    const longPasses = anyM.longPasses ?? 0;
    const successfulCrosses = anyM.successfulCrosses ?? 0;
    const crossesAttempted = anyM.crossesAttempted ?? anyM.crosses ?? 0;
    const corners = anyM.corners ?? 0;

    const finalThirdEntries = anyM.finalThirdPasses ?? anyM.finalThirdEntry ?? 15;
    const boxEntries = anyM.boxEntries ?? anyM.penaltyAreaEntry ?? 12;

    const aerialDuelWin = anyM.aerialDuelWin ?? 0;
    const aerialDuelLoss = anyM.aerialDuelLoss ?? 0;
    const groundDuelWin = anyM.groundDuelWin ?? 0;
    const groundDuelLoss = anyM.groundDuelLoss ?? 0;

    const tacklesAttempted = anyM.tacklesAttempted ?? 1;
    const tacklesWon = anyM.tacklesWon ?? anyM.tacklesSucceeded ?? 0;
    const recoveries = anyM.ballRecoveries ?? anyM.recoveries ?? 20;

    const counterAttacks = anyM.counterAttacks ?? 0;

    return {
      name: `${m.date.substring(5)} (${m.opponent})`,
      date: m.date,
      opponent: m.opponent,

      // --- GENERAL KPIs ---
      shotAccuracyTotal: Number(((shotsOnTarget / shots) * 100).toFixed(1)),
      shotAccuracyExclBlocked: Number(((shotsOnTarget / Math.max(1, shots - blockedShots)) * 100).toFixed(1)),
      goalConversion: Number(((goals / shots) * 100).toFixed(1)),
      xG: Number(att.xG.toFixed(2)),
      shotsOutsideBoxProp: Number(((Math.max(0, shots - insideBoxShots) / shots) * 100).toFixed(1)),
      shotsInsideBoxProp: Number(((insideBoxShots / shots) * 100).toFixed(1)),
      passAccuracy: Number(((successfulPasses / totalPasses) * 100).toFixed(1)),
      longPassesAccuracy: Number((((Math.round(longPasses * 0.65)) / Math.max(1, longPasses)) * 100).toFixed(1)),
      passesInOpponentHalfAccuracy: 72.5,
      passesInFinalThirdAccuracy: 68.0,
      crossingAccuracy: Number(((successfulCrosses / Math.max(1, crossesAttempted)) * 100).toFixed(1)),
      openPlayCrossingAccuracy: 31.2,
      longPassesProp: Number(((longPasses / totalPasses) * 100).toFixed(1)),
      forwardPassesProp: Number((((anyM.forwardPasses ?? anyM.progressivePasses ?? 0) / totalPasses) * 100).toFixed(1)),
      keyPassesProp: Number((((anyM.keyPasses ?? 0) / totalPasses) * 100).toFixed(1)),
      xA: Number(((anyM.keyPasses ?? 0) * 0.12 + successfulCrosses * 0.08).toFixed(2)),
      finalThirdEntryToShot: Number((Math.min(100, (shots / Math.max(1, finalThirdEntries)) * 100)).toFixed(1)),
      penaltyAreaEntryToShot: Number((Math.min(100, (shots / Math.max(1, boxEntries)) * 100)).toFixed(1)),
      duelsSuccessRate: Number((((aerialDuelWin + groundDuelWin) / Math.max(1, aerialDuelWin + aerialDuelLoss + groundDuelWin + groundDuelLoss)) * 100).toFixed(1)),
      aerialDuelsWon: Number(((aerialDuelWin / Math.max(1, aerialDuelWin + aerialDuelLoss)) * 100).toFixed(1)),
      groundDuelsWon: Number(((groundDuelWin / Math.max(1, groundDuelWin + groundDuelLoss)) * 100).toFixed(1)),
      tackleSuccessRate: Number(((tacklesWon / tacklesAttempted) * 100).toFixed(1)),
      recoveriesInAttackingHalf: Math.round(recoveries * 0.15),
      concededXg: Number((def.opponentXgConceded || 0).toFixed(2)),

      // --- GENERAL PIs ---
      goals: goals,
      shots: shots,
      shotsOnTarget: shotsOnTarget,
      blockedShots: blockedShots,
      headedShots: anyM.headedShots ?? Math.round(shots * 0.15),
      shotsOutsideBox: Math.max(0, shots - insideBoxShots),
      insideBoxShots: insideBoxShots,
      passes: anyM.passes ?? 350,
      keyPasses: anyM.keyPasses ?? 5,
      longPasses: longPasses,
      passesInOpponentHalf: Math.round(totalPasses * 0.45),
      finalThirdPasses: anyM.finalThirdPasses ?? 15,
      forwardPasses: anyM.forwardPasses ?? anyM.progressivePasses ?? 0,
      throughBalls: anyM.throughBalls ?? 0,
      crosses: anyM.crosses ?? crossesAttempted,
      openPlayCrosses: Math.max(0, (anyM.crosses || crossesAttempted) - corners),
      possessionRate: anyM.possessionRate ?? 50,
      finalThirdEntries: finalThirdEntries,
      boxEntries: boxEntries,
      duels: aerialDuelWin + aerialDuelLoss + groundDuelWin + groundDuelLoss,
      aerialDuels: aerialDuelWin + aerialDuelLoss,
      groundDuels: groundDuelWin + groundDuelLoss,
      foulsWon: anyM.wasFouled ?? 6,
      offside: anyM.offside ?? 0,
      corners: corners,
      tackles: anyM.tackles ?? 10,
      clearances: anyM.clearances ?? 8,
      interceptions: anyM.interceptions ?? 6,
      blocks: anyM.blocks ?? 3,
      ballRecoveries: recoveries,
      attackingThirdRecovery: Math.round(recoveries * 0.15),
      defensiveThirdRecovery: Math.round(recoveries * 0.45),
      midfieldThirdRecovery: Math.round(recoveries * 0.40),
      fouls: anyM.fouls ?? 8,
      yellowCards: anyM.yellowCards ?? 0,
      redCard: 0,

      // --- TACTICAL KPIs ---
      shotAccuracy: Number(((shotsOnTarget / shots) * 100).toFixed(1)),
      counterAttackShotProp: Number((((Math.round(counterAttacks * 0.4) / shots) * 100)).toFixed(1)),
      counterAttackShotAccuracy: 52.5,

      // --- TACTICAL PIs ---
      counterAttacks: counterAttacks,
      counterAttackToShot: Math.round(counterAttacks * 0.4),
      turnovers: anyM.turnovers ?? 0,

      // --- SET PIECE KPIs ---
      foulWonAvg: anyM.wasFouled ?? 6,
      foulCommittedAvg: anyM.fouls ?? 8,
      directFreeKickSuccess: 9.5,
      freeKickCrossingAccuracy: 34.8,
      cornerToShotRate: Number(((Math.round(corners * 0.3) / Math.max(1, corners)) * 100).toFixed(1)),
      cornerToShotAllowedRate: Number(((Math.round(corners * 0.1) / Math.max(1, corners)) * 100).toFixed(1)),
      cornerToConcededRate: 1.2,
      cornerToClearanceRate: Number(((Math.round(corners * 0.5) / Math.max(1, corners)) * 100).toFixed(1)),

      // --- SET PIECE PIs ---
      freeKickAward: anyM.freeKicks ?? 5,
      directFreeKick: Math.round((anyM.freeKicks ?? 5) * 0.3),
      freeKickCrosses: Math.round((anyM.freeKicks ?? 5) * 0.5),
      cornerToShot: Math.round(corners * 0.3),
      cornerToShotAllowed: Math.round(corners * 0.1),
      cornerToConceded: 0,
      cornerToClearance: Math.round(corners * 0.5),
      longThrows: anyM.longThrows ?? 0,
    };
  };

  const chronologicalMetrics = ourMatches.map(getMatchMetrics);

  const isAuthorized = currentUser && (
    currentUser.isAdmin || 
    currentUser.role === UserRole.HeadCoach || 
    currentUser.role === UserRole.Manager || 
    currentUser.role === UserRole.Analyst
  );

  return (
    <div className="space-y-6" id="team-dashboard-root">
      
      {/* Prominent Match Selector Dropdown Banner */}
      <div className="bg-[#1e293b] border border-[#eab308]/60 text-white rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-[#eab308]/15 text-[#eab308] border border-[#eab308]/30 shrink-0">
            <Calendar className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-white tracking-wide uppercase flex items-center gap-2 flex-wrap">
              <span>Match Performance Analytics</span>
              <span className="text-[10px] bg-[#eab308] text-[#0b0f19] px-2 py-0.5 rounded-full font-black">
                {selectedMatchId === "latest" || (!selectedMatchId && latestMatch) ? "LATEST MATCH ANALYTICS" : selectedMatchId === "all" ? "SEASON CUMULATIVE" : "HISTORICAL MATCH"}
              </span>
            </h3>
            <p className="text-xs text-[#94a3b8] mt-1 font-sans">
              {activeMatch?.date ? `${activeMatch.date} vs ${activeMatch.opponent} ${activeMatch.result ? `(${activeMatch.result})` : ""}` : "Overall Cumulative Season Stats"}
            </p>
          </div>
        </div>

        {/* Match Selector Dropdown */}
        <div className="flex items-center gap-2 bg-[#0b0f19] border border-[#334155] rounded-xl px-3.5 py-2.5 w-full sm:w-auto shrink-0 shadow-inner">
          <label htmlFor="match-hub-select-dropdown" className="text-xs font-black text-[#eab308] whitespace-nowrap uppercase tracking-wider flex items-center gap-1.5">
            <Target className="h-4 w-4 text-[#eab308]" />
            <span>Select Match:</span>
          </label>
          <select
            id="match-hub-select-dropdown"
            value={selectedMatchId}
            onChange={(e) => setSelectedMatchId(e.target.value)}
            className="bg-transparent text-white font-extrabold text-xs sm:text-sm focus:outline-none cursor-pointer w-full sm:w-auto pr-2"
          >
            <option value="latest" className="bg-[#0b0f19] text-white font-bold">
              Latest Match Analytics {latestMatch ? `(${latestMatch.date} vs ${latestMatch.opponent})` : ""}
            </option>
            <option value="all" className="bg-[#0b0f19] text-white font-bold">
              Overall Season Average (All Matches)
            </option>
            {ourMatches.length > 0 && (
              <optgroup label="Historical Match Log" className="bg-[#0b0f19] text-[#94a3b8] font-bold">
                {[...ourMatches].reverse().map((m) => (
                  <option key={m.id} value={m.id} className="bg-[#0b0f19] text-white font-medium">
                    {m.date} vs {m.opponent} {m.result ? `(${m.result})` : ""} {m.competition ? `[${m.competition}]` : ""}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
      </div>

      {/* Top Filter & Configuration Panel */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#334155] pb-4">
        <div className="flex items-center justify-between w-full sm:w-auto">
          <h2 className="font-display text-xl sm:text-2xl font-black tracking-tight text-white">
            Team Dashboard
          </h2>
          
          {/* Mobile-only disabled Export Button right next to title */}
          <button
            onClick={() => {
              if (isMobile) {
                setShowExportWarning(true);
              }
            }}
            disabled={true}
            className="no-print flex md:hidden items-center gap-1 rounded bg-[#1e293b] border border-[#334155] px-2 py-1 text-[11px] font-bold text-[#94a3b8] cursor-not-allowed shadow-2xs opacity-50"
            title="PDF Export is not available on mobile."
          >
            <Printer className="h-3 w-3 text-[#94a3b8]" />
            <span>PDF</span>
          </button>
        </div>

        {/* Dropdowns on Right */}
        <div className="flex flex-wrap items-center gap-3 justify-between sm:justify-end w-full sm:w-auto" id="dashboard-filters">
          
          {/* Match Type Filters */}
          <div className="flex items-center gap-1 bg-[#1e293b] border border-[#334155] rounded-xl p-1 shadow-2xs no-print">
            {[
              { id: "all", label: "All Match" },
              { id: "League", label: "League" },
              { id: "Cup", label: "Cup" },
              { id: "Friendly", label: "Friendly" }
            ].map(comp => (
              <button
                key={comp.id}
                onClick={() => setCompFilter(comp.id)}
                className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all cursor-pointer ${
                  compFilter === comp.id
                    ? "bg-[#eab308] text-[#0b0f19] shadow-md"
                    : "text-[#94a3b8] hover:text-white hover:bg-[#334155]"
                }`}
              >
                {comp.label}
              </button>
            ))}
          </div>

          {/* Venue (Home / Away) Filter */}
          <div className="flex items-center gap-1 bg-[#1e293b] border border-[#334155] rounded-xl p-1 shadow-2xs no-print">
            {[
              { id: "all", label: "All Venue" },
              { id: "Home", label: "Home" },
              { id: "Away", label: "Away" }
            ].map(venue => (
              <button
                key={venue.id}
                onClick={() => setVenueFilter(venue.id as "all" | "Home" | "Away")}
                className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all cursor-pointer ${
                  venueFilter === venue.id
                    ? "bg-[#eab308] text-[#0b0f19] shadow-md"
                    : "text-[#94a3b8] hover:text-white hover:bg-[#334155]"
                }`}
              >
                {venue.label}
              </button>
            ))}
          </div>

          {/* View Type Toggle */}
          <div className="flex items-center bg-[#1e293b] border border-[#334155] rounded-xl p-1 shadow-2xs no-print">
            <button
              onClick={() => setViewType("list")}
              className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all cursor-pointer ${
                viewType === "list"
                  ? "bg-[#eab308] text-[#0b0f19] shadow-md"
                  : "text-[#94a3b8] hover:text-white hover:bg-[#334155]"
              }`}
            >
              List Format
            </button>
            <button
              onClick={() => setViewType("graph")}
              className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all cursor-pointer ${
                viewType === "graph"
                  ? "bg-[#eab308] text-[#0b0f19] shadow-md"
                  : "text-[#94a3b8] hover:text-white hover:bg-[#334155]"
              }`}
            >
              Line Graph
            </button>
          </div>

          {/* PDF Report Export Button - Desktop only */}
          <button
            onClick={() => {
              if (isMobile || !isAuthorized) return;
              window.print();
            }}
            disabled={isMobile || !isAuthorized}
            className={`no-print inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-extrabold transition-colors cursor-pointer shadow-xs ${
              isMobile || !isAuthorized
                ? "bg-[#1e293b] text-[#94a3b8] border-[#334155] cursor-not-allowed opacity-50"
                : "bg-[#1e293b] border-[#334155] text-white hover:bg-[#334155]"
            }`}
            title={
              isMobile
                ? "PDF Export is not available on mobile."
                : !isAuthorized
                ? "Only Head Coach, Manager, and Analyst can export PDF reports."
                : "Export dashboard as a printable PDF report"
            }
          >
            <Printer className="h-3.5 w-3.5 text-[#eab308]" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {viewType === "graph" ? (
        <div className="space-y-6 w-full mb-8 animate-fadeIn" id="graph-analysis-view">
          {/* Graph category selector (General, Tactical Stats, Set Pieces) */}
          <div className="flex items-center overflow-x-auto whitespace-nowrap gap-1 border-b border-[#E2E8F0] pb-1 scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] no-print" id="graph-categories">
            {[
              { id: "General", icon: Target, label: "General" },
              { id: "Tactical Stats", icon: RefreshCw, label: "Tactical Stats" },
              { id: "Set Pieces", icon: Sparkles, label: "Set Pieces" }
            ].map(tab => {
              const IconComponent = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer shrink-0 ${
                    activeTab === tab.id
                      ? "border-[#1D4ED8] text-[#1D4ED8] font-bold bg-[#1D4ED8]/5 rounded-t"
                      : "border-transparent text-slate-500 hover:text-[#0A2342] hover:border-slate-300"
                  }`}
                >
                  <IconComponent className={`h-4 w-4 ${activeTab === tab.id ? "text-[#1D4ED8]" : "text-slate-400"}`} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Double Graph Grid (KPIs on left, PIs on right) or divided areas for General */}
          {activeTab === "General" ? (
            <div className="space-y-10" id="general-graphs-container">
              {/* --- SECTION 1: SHOTS --- */}
              <div className="space-y-4">
                <div className="border-b border-[#E2E8F0] pb-2">
                  <h3 className="font-display font-extrabold text-[#0A2342] text-sm sm:text-base flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-[#1D4ED8]" />
                    Shots Trend Analysis
                  </h3>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Shots KPIs */}
                  <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs flex flex-col justify-between min-h-[380px]">
                    <div className="border-b border-[#E2E8F0] pb-3 mb-4">
                      <h4 className="font-display font-extrabold text-[#0A2342] text-xs sm:text-sm flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-[#1D4ED8]" />
                          Shots KPIs
                        </span>
                        <span className="text-[10px] bg-blue-50 text-[#1D4ED8] px-2 py-0.5 rounded font-mono font-bold uppercase">KPI Lines</span>
                      </h4>
                    </div>
                    <div className="h-64 w-full">
                      {ourMatches.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-xs text-slate-400 italic">No matching matches</div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chronologicalMetrics}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748B" }} stroke="#CBD5E1" />
                            <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#64748B" }} stroke="#1D4ED8" />
                            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#64748B" }} stroke="#10B981" />
                            <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderColor: "#E2E8F0", fontSize: 11, borderRadius: 6 }} />
                            <Legend wrapperStyle={{ fontSize: 10 }} />
                            <Line yAxisId="right" type="monotone" dataKey="xG" stroke="#10B981" strokeWidth={2.5} name="Expected Goals (xG)" activeDot={{ r: 5 }} />
                            <Line yAxisId="left" type="monotone" dataKey="goalConversion" stroke="#F59E0B" strokeWidth={2} name="Goal Conversion (%)" />
                            <Line yAxisId="left" type="monotone" dataKey="shotAccuracyTotal" stroke="#1D4ED8" strokeWidth={2} name="Shot Accuracy (%)" />
                            <Line yAxisId="left" type="monotone" dataKey="shotAccuracyExclBlocked" stroke="#3B82F6" strokeWidth={2} name="Accuracy Excl. Blocked (%)" />
                            <Line yAxisId="left" type="monotone" dataKey="shotsOutsideBoxProp" stroke="#8B5CF6" strokeWidth={1.5} name="Outside Box Prop (%)" />
                            <Line yAxisId="left" type="monotone" dataKey="shotsInsideBoxProp" stroke="#EC4899" strokeWidth={1.5} name="Inside Box Prop (%)" />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* Shots PIs */}
                  <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs flex flex-col justify-between min-h-[380px]">
                    <div className="border-b border-[#E2E8F0] pb-3 mb-4">
                      <h4 className="font-display font-extrabold text-[#0A2342] text-xs sm:text-sm flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-[#0A2342]" />
                          Shots PIs
                        </span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono font-bold uppercase">PI Lines</span>
                      </h4>
                    </div>
                    <div className="h-64 w-full">
                      {ourMatches.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-xs text-slate-400 italic">No matching matches</div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chronologicalMetrics}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748B" }} stroke="#CBD5E1" />
                            <YAxis tick={{ fontSize: 10, fill: "#64748B" }} stroke="#475569" />
                            <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderColor: "#E2E8F0", fontSize: 11, borderRadius: 6 }} />
                            <Legend wrapperStyle={{ fontSize: 10 }} />
                            <Line type="monotone" dataKey="goals" stroke="#10B981" strokeWidth={2.5} name="Goals" activeDot={{ r: 5 }} />
                            <Line type="monotone" dataKey="shots" stroke="#1D4ED8" strokeWidth={2} name="Shots" />
                            <Line type="monotone" dataKey="shotsOnTarget" stroke="#6366F1" strokeWidth={2} name="Shots on Target" />
                            <Line type="monotone" dataKey="blockedShots" stroke="#EF4444" strokeWidth={1.5} name="Blocked Shots" />
                            <Line type="monotone" dataKey="headedShots" stroke="#F59E0B" strokeWidth={1.5} name="Headed Shots" />
                            <Line type="monotone" dataKey="shotsOutsideBox" stroke="#8B5CF6" strokeWidth={1.5} name="Shots Outside Box" />
                            <Line type="monotone" dataKey="insideBoxShots" stroke="#14B8A6" strokeWidth={1.5} name="Shots Inside Box" />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* --- SECTION 2: PASSES --- */}
              <div className="space-y-4">
                <div className="border-b border-[#E2E8F0] pb-2">
                  <h3 className="font-display font-extrabold text-[#0A2342] text-sm sm:text-base flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-[#10B981]" />
                    Passes Trend Analysis
                  </h3>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Passes KPIs */}
                  <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs flex flex-col justify-between min-h-[380px]">
                    <div className="border-b border-[#E2E8F0] pb-3 mb-4">
                      <h4 className="font-display font-extrabold text-[#0A2342] text-xs sm:text-sm flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-[#10B981]" />
                          Passes KPIs
                        </span>
                        <span className="text-[10px] bg-blue-50 text-[#1D4ED8] px-2 py-0.5 rounded font-mono font-bold uppercase">KPI Lines</span>
                      </h4>
                    </div>
                    <div className="h-64 w-full">
                      {ourMatches.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-xs text-slate-400 italic">No matching matches</div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chronologicalMetrics}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748B" }} stroke="#CBD5E1" />
                            <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#64748B" }} stroke="#1D4ED8" />
                            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#64748B" }} stroke="#10B981" />
                            <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderColor: "#E2E8F0", fontSize: 11, borderRadius: 6 }} />
                            <Legend wrapperStyle={{ fontSize: 10 }} />
                            <Line yAxisId="left" type="monotone" dataKey="passAccuracy" stroke="#1D4ED8" strokeWidth={2.5} name="Pass Acc (%)" activeDot={{ r: 5 }} />
                            <Line yAxisId="left" type="monotone" dataKey="longPassesAccuracy" stroke="#10B981" strokeWidth={2} name="Long Pass Acc (%)" />
                            <Line yAxisId="left" type="monotone" dataKey="passesInOpponentHalfAccuracy" stroke="#F59E0B" strokeWidth={2} name="Opp. Half Acc (%)" />
                            <Line yAxisId="left" type="monotone" dataKey="passesInFinalThirdAccuracy" stroke="#3B82F6" strokeWidth={2} name="Final 3rd Acc (%)" />
                            <Line yAxisId="left" type="monotone" dataKey="crossingAccuracy" stroke="#6366F1" strokeWidth={2} name="Crossing Acc (%)" />
                            <Line yAxisId="left" type="monotone" dataKey="openPlayCrossingAccuracy" stroke="#8B5CF6" strokeWidth={1.5} name="Open Cross Acc (%)" />
                            <Line yAxisId="left" type="monotone" dataKey="longPassesProp" stroke="#EC4899" strokeWidth={1.5} name="Long Pass Prop (%)" />
                            <Line yAxisId="left" type="monotone" dataKey="forwardPassesProp" stroke="#14B8A6" strokeWidth={1.5} name="Forward Prop (%)" />
                            <Line yAxisId="left" type="monotone" dataKey="keyPassesProp" stroke="#D946EF" strokeWidth={1.5} name="Key Pass Prop (%)" />
                            <Line yAxisId="right" type="monotone" dataKey="xA" stroke="#06B6D4" strokeWidth={2} name="Expected Assists (xA)" />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* Passes PIs */}
                  <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs flex flex-col justify-between min-h-[380px]">
                    <div className="border-b border-[#E2E8F0] pb-3 mb-4">
                      <h4 className="font-display font-extrabold text-[#0A2342] text-xs sm:text-sm flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-[#0A2342]" />
                          Passes PIs
                        </span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono font-bold uppercase">PI Lines</span>
                      </h4>
                    </div>
                    <div className="h-64 w-full">
                      {ourMatches.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-xs text-slate-400 italic">No matching matches</div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chronologicalMetrics}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748B" }} stroke="#CBD5E1" />
                            <YAxis tick={{ fontSize: 10, fill: "#64748B" }} stroke="#475569" />
                            <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderColor: "#E2E8F0", fontSize: 11, borderRadius: 6 }} />
                            <Legend wrapperStyle={{ fontSize: 10 }} />
                            <Line type="monotone" dataKey="passes" stroke="#1D4ED8" strokeWidth={2.5} name="Total Passes" activeDot={{ r: 5 }} />
                            <Line type="monotone" dataKey="keyPasses" stroke="#F59E0B" strokeWidth={2} name="Key Passes" />
                            <Line type="monotone" dataKey="longPasses" stroke="#10B981" strokeWidth={2} name="Long Passes" />
                            <Line type="monotone" dataKey="passesInOpponentHalf" stroke="#3B82F6" strokeWidth={2} name="Opponent Half Passes" />
                            <Line type="monotone" dataKey="finalThirdPasses" stroke="#8B5CF6" strokeWidth={1.5} name="Final Third Passes" />
                            <Line type="monotone" dataKey="forwardPasses" stroke="#EC4899" strokeWidth={1.5} name="Forward Passes" />
                            <Line type="monotone" dataKey="throughBalls" stroke="#14B8A6" strokeWidth={1.5} name="Through Balls" />
                            <Line type="monotone" dataKey="crosses" stroke="#6366F1" strokeWidth={2} name="Crosses" />
                            <Line type="monotone" dataKey="openPlayCrosses" stroke="#06B6D4" strokeWidth={1.5} name="Open Play Crosses" />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* --- SECTION 3: DISTRIBUTION --- */}
              <div className="space-y-4">
                <div className="border-b border-[#E2E8F0] pb-2">
                  <h3 className="font-display font-extrabold text-[#0A2342] text-sm sm:text-base flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-[#F59E0B]" />
                    Distribution Trend Analysis
                  </h3>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Distribution KPIs */}
                  <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs flex flex-col justify-between min-h-[380px]">
                    <div className="border-b border-[#E2E8F0] pb-3 mb-4">
                      <h4 className="font-display font-extrabold text-[#0A2342] text-xs sm:text-sm flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-[#F59E0B]" />
                          Distribution KPIs
                        </span>
                        <span className="text-[10px] bg-blue-50 text-[#1D4ED8] px-2 py-0.5 rounded font-mono font-bold uppercase">KPI Lines</span>
                      </h4>
                    </div>
                    <div className="h-64 w-full">
                      {ourMatches.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-xs text-slate-400 italic">No matching matches</div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chronologicalMetrics}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748B" }} stroke="#CBD5E1" />
                            <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#64748B" }} stroke="#1D4ED8" />
                            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#64748B" }} stroke="#10B981" />
                            <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderColor: "#E2E8F0", fontSize: 11, borderRadius: 6 }} />
                            <Legend wrapperStyle={{ fontSize: 10 }} />
                            <Line yAxisId="left" type="monotone" dataKey="finalThirdEntryToShot" stroke="#1D4ED8" strokeWidth={2.5} name="Final 3rd to Shot (%)" activeDot={{ r: 5 }} />
                            <Line yAxisId="left" type="monotone" dataKey="penaltyAreaEntryToShot" stroke="#10B981" strokeWidth={2} name="Box to Shot (%)" />
                            <Line yAxisId="left" type="monotone" dataKey="duelsSuccessRate" stroke="#F59E0B" strokeWidth={2} name="Duels Success (%)" />
                            <Line yAxisId="left" type="monotone" dataKey="aerialDuelsWon" stroke="#3B82F6" strokeWidth={2} name="Aerial Duels Won (%)" />
                            <Line yAxisId="left" type="monotone" dataKey="groundDuelsWon" stroke="#8B5CF6" strokeWidth={2} name="Ground Duels Won (%)" />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* Distribution PIs */}
                  <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs flex flex-col justify-between min-h-[380px]">
                    <div className="border-b border-[#E2E8F0] pb-3 mb-4">
                      <h4 className="font-display font-extrabold text-[#0A2342] text-xs sm:text-sm flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-[#0A2342]" />
                          Distribution PIs
                        </span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono font-bold uppercase">PI Lines</span>
                      </h4>
                    </div>
                    <div className="h-64 w-full">
                      {ourMatches.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-xs text-slate-400 italic">No matching matches</div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chronologicalMetrics}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748B" }} stroke="#CBD5E1" />
                            <YAxis tick={{ fontSize: 10, fill: "#64748B" }} stroke="#475569" />
                            <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderColor: "#E2E8F0", fontSize: 11, borderRadius: 6 }} />
                            <Legend wrapperStyle={{ fontSize: 10 }} />
                            <Line type="monotone" dataKey="possessionRate" stroke="#1D4ED8" strokeWidth={2.5} name="Possession Rate (%)" activeDot={{ r: 5 }} />
                            <Line type="monotone" dataKey="finalThirdEntries" stroke="#10B981" strokeWidth={2} name="Final 3rd Entries" />
                            <Line type="monotone" dataKey="boxEntries" stroke="#F59E0B" strokeWidth={2} name="Penalty Area Entries" />
                            <Line type="monotone" dataKey="duels" stroke="#3B82F6" strokeWidth={2} name="Duels" />
                            <Line type="monotone" dataKey="aerialDuels" stroke="#8B5CF6" strokeWidth={1.5} name="Aerial Duels" />
                            <Line type="monotone" dataKey="groundDuels" stroke="#EC4899" strokeWidth={1.5} name="Ground Duels" />
                            <Line type="monotone" dataKey="foulsWon" stroke="#14B8A6" strokeWidth={1.5} name="Fouls Won" />
                            <Line type="monotone" dataKey="offside" stroke="#EF4444" strokeWidth={1.5} name="Offside" />
                            <Line type="monotone" dataKey="corners" stroke="#06B6D4" strokeWidth={1.5} name="Corners" />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* KPI Trends Card */}
              <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs flex flex-col justify-between min-h-[380px]">
                <div className="border-b border-[#E2E8F0] pb-3 mb-4">
                  <h3 className="font-display font-extrabold text-[#0A2342] text-sm sm:text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#1D4ED8]" />
                      {activeTab} KPIs Trend
                    </span>
                    <span className="text-[10px] bg-blue-50 text-[#1D4ED8] px-2 py-0.5 rounded font-mono font-bold uppercase">KPI Lines</span>
                  </h3>
                </div>
                <div className="h-64 w-full" id="kpi-graph-recharts">
                  {ourMatches.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-xs text-slate-400 italic">
                      No matching matches in this category
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chronologicalMetrics}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748B" }} stroke="#CBD5E1" />
                        <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#64748B" }} stroke="#1D4ED8" />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#64748B" }} stroke="#10B981" />
                        <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderColor: "#E2E8F0", fontSize: 11, borderRadius: 6 }} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />

                        {activeTab === "Tactical Stats" && (
                          <>
                            <Line yAxisId="left" type="monotone" dataKey="goalConversion" stroke="#F59E0B" strokeWidth={2.5} name="Goal Conversion (%)" activeDot={{ r: 5 }} />
                            <Line yAxisId="left" type="monotone" dataKey="shotAccuracy" stroke="#1D4ED8" strokeWidth={2} name="Shot Accuracy (%)" />
                            <Line yAxisId="left" type="monotone" dataKey="counterAttackShotProp" stroke="#8B5CF6" strokeWidth={2} name="Counter Attack Shot Prop (%)" />
                            <Line yAxisId="left" type="monotone" dataKey="counterAttackShotAccuracy" stroke="#EC4899" strokeWidth={2} name="Counter Attack Shot Accuracy (%)" />
                          </>
                        )}

                        {activeTab === "Set Pieces" && (
                          <>
                            <Line yAxisId="left" type="monotone" dataKey="directFreeKickSuccess" stroke="#10B981" strokeWidth={2.5} name="Direct FK Success (%)" activeDot={{ r: 5 }} />
                            <Line yAxisId="left" type="monotone" dataKey="freeKickCrossingAccuracy" stroke="#3B82F6" strokeWidth={2} name="FK Crossing Accuracy (%)" />
                            <Line yAxisId="left" type="monotone" dataKey="cornerToShotRate" stroke="#F59E0B" strokeWidth={2} name="Corner to Shot Rate (%)" />
                            <Line yAxisId="left" type="monotone" dataKey="cornerToShotAllowedRate" stroke="#EF4444" strokeWidth={2} name="Corner to Shot Allowed (%)" />
                            <Line yAxisId="left" type="monotone" dataKey="cornerToClearanceRate" stroke="#14B8A6" strokeWidth={2} name="Corner to Clearance (%)" />
                            <Line yAxisId="right" type="monotone" dataKey="foulWonAvg" stroke="#8B5CF6" strokeWidth={2} name="Foul Won Avg" />
                            <Line yAxisId="right" type="monotone" dataKey="foulCommittedAvg" stroke="#64748B" strokeWidth={2} name="Foul Committed Avg" />
                          </>
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* PI Trends Card */}
              <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs flex flex-col justify-between min-h-[380px]">
                <div className="border-b border-[#E2E8F0] pb-3 mb-4">
                  <h3 className="font-display font-extrabold text-[#0A2342] text-sm sm:text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#0A2342]" />
                      {activeTab} PIs Trend
                    </span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono font-bold uppercase">PI Lines</span>
                  </h3>
                </div>
                <div className="h-64 w-full" id="pi-graph-recharts">
                  {ourMatches.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-xs text-slate-400 italic">
                      No matching matches in this category
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chronologicalMetrics}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748B" }} stroke="#CBD5E1" />
                        <YAxis tick={{ fontSize: 10, fill: "#64748B" }} stroke="#475569" />
                        <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderColor: "#E2E8F0", fontSize: 11, borderRadius: 6 }} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />

                        {activeTab === "Tactical Stats" && (
                          <>
                            <Line type="monotone" dataKey="goals" stroke="#10B981" strokeWidth={2.5} name="Goals" activeDot={{ r: 5 }} />
                            <Line type="monotone" dataKey="shotsOnTarget" stroke="#1D4ED8" strokeWidth={2} name="Shots on Target" />
                            <Line type="monotone" dataKey="counterAttacks" stroke="#F59E0B" strokeWidth={2} name="Counter Attacks" />
                            <Line type="monotone" dataKey="counterAttackToShot" stroke="#EC4899" strokeWidth={2} name="Counter Attack to Shot" />
                            <Line type="monotone" dataKey="ballRecoveries" stroke="#8B5CF6" strokeWidth={2} name="Ball Recoveries" />
                            <Line type="monotone" dataKey="turnovers" stroke="#EF4444" strokeWidth={2} name="Turnovers" />
                          </>
                        )}

                        {activeTab === "Set Pieces" && (
                          <>
                            <Line type="monotone" dataKey="foulsWon" stroke="#8B5CF6" strokeWidth={2.5} name="Fouls Won" activeDot={{ r: 5 }} />
                            <Line type="monotone" dataKey="fouls" stroke="#64748B" strokeWidth={2} name="Fouls Committed" />
                            <Line type="monotone" dataKey="freeKickAward" stroke="#3B82F6" strokeWidth={2} name="Free-kick Award" />
                            <Line type="monotone" dataKey="directFreeKick" stroke="#10B981" strokeWidth={2} name="Direct Free-kicks" />
                            <Line type="monotone" dataKey="freeKickCrosses" stroke="#14B8A6" strokeWidth={1.5} name="Free-kick Crosses" />
                            <Line type="monotone" dataKey="corners" stroke="#F59E0B" strokeWidth={2} name="Corners Won" />
                            <Line type="monotone" dataKey="cornerToShot" stroke="#EC4899" strokeWidth={1.5} name="Corner to Shot" />
                            <Line type="monotone" dataKey="cornerToShotAllowed" stroke="#EF4444" strokeWidth={1.5} name="Corner to Shot Allowed" />
                            <Line type="monotone" dataKey="longThrows" stroke="#0A2342" strokeWidth={1.5} name="Long Throw-ins" />
                          </>
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
      ) : (
        <>
          {/* Primary Category Tabs */}
          <div className="flex flex-wrap gap-2 border-b border-[#334155] pb-2 no-print" id="category-tabs">
            {[
              { id: "General", icon: Target, label: "General" },
              { id: "Tactical Stats", icon: RefreshCw, label: "Tactical Stats" },
              { id: "Set Pieces", icon: Sparkles, label: "Set Pieces" }
            ].map((tab) => {
              const IconComponent = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-extrabold border-b-2 transition-all cursor-pointer rounded-t-lg ${
                    activeTab === tab.id 
                      ? "border-[#eab308] text-[#eab308] bg-[#eab308]/10" 
                      : "border-transparent text-[#94a3b8] hover:text-white hover:bg-[#1e293b]"
                  }`}
                >
                  <IconComponent className={`h-4 w-4 ${activeTab === tab.id ? "text-[#eab308]" : "text-[#94a3b8]"}`} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Match Hub Metrics Display */}
          <div className="space-y-6 w-full mb-8">
            
            {/* Donut Charts Grid for Percentage & Ratio KPI Metrics */}
            <div className="space-y-3">
              <h3 className="font-extrabold text-sm sm:text-base text-white tracking-wide uppercase flex items-center gap-2 border-b border-[#334155] pb-2">
                <Target className="h-4 w-4 text-[#eab308]" />
                {activeTab} - Key Performance Indicators (KPI)
              </h3>
              
              {activeTab === "General" && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                  <DonutChartCard label="Pass Accuracy" percentage={Number(getKpiStats("passAccuracy").avg)} color="#eab308" />
                  <DonutChartCard label="Shot Accuracy" percentage={Number(getKpiStats("shotAccuracyTotal").avg)} color="#06b6d4" />
                  <DonutChartCard label="Goal Conversion" percentage={Number(getKpiStats("goalConversion").avg)} color="#10b981" />
                  <DonutChartCard label="Duel Win Rate" percentage={Number(getKpiStats("duelsSuccessRate").avg)} color="#3b82f6" />
                  <DonutChartCard label="Tackle Success" percentage={Number(getKpiStats("tackleSuccessRate").avg)} color="#8b5cf6" />
                  <DonutChartCard label="Crossing Acc." percentage={Number(getKpiStats("crossingAccuracy").avg)} color="#f59e0b" />
                </div>
              )}

              {activeTab === "Tactical Stats" && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  <DonutChartCard label="Goal Conversion" percentage={Number(getKpiStats("goalConversion").avg)} color="#10b981" />
                  <DonutChartCard label="Shot Accuracy" percentage={Number(getKpiStats("shotAccuracy").avg)} color="#06b6d4" />
                  <DonutChartCard label="Counter Shot Prop." percentage={Number(getKpiStats("counterAttackShotProp").avg)} color="#eab308" />
                  <DonutChartCard label="Counter Shot Acc." percentage={Number(getKpiStats("counterAttackShotAccuracy").avg)} color="#3b82f6" />
                </div>
              )}

              {activeTab === "Set Pieces" && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                  <DonutChartCard label="Direct FK Success" percentage={Number(getKpiStats("directFreeKickSuccess").avg)} color="#10b981" />
                  <DonutChartCard label="FK Cross Acc." percentage={Number(getKpiStats("freeKickCrossingAccuracy").avg)} color="#3b82f6" />
                  <DonutChartCard label="Corner to Shot" percentage={Number(getKpiStats("cornerToShotRate").avg)} color="#f59e0b" />
                  <DonutChartCard label="Corner Shot Allowed" percentage={Number(getKpiStats("cornerToShotAllowedRate").avg)} color="#ef4444" />
                  <DonutChartCard label="Corner Clearance" percentage={Number(getKpiStats("cornerToClearanceRate").avg)} color="#06b6d4" />
                </div>
              )}
            </div>

            {/* Non-Scrollable List for Performance Indicators (PI) Metrics */}
            <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b border-[#334155] pb-3">
                <h3 className="font-extrabold text-base text-white tracking-wide flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-[#10b981]" />
                  {activeTab} - Performance Indicators (PI)
                </h3>
              </div>

              {/* Responsive Stat Card Grid System */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {activeTab === "General" && (
                  <>
                    <MetricCard label="Goals Scored" {...getPiStats("goals")} />
                    <MetricCard label="Total Shots" {...getPiStats("shots")} />
                    <MetricCard label="Shots on Target" {...getPiStats("shotsOnTarget")} />
                    <MetricCard label="Blocked Shots" {...getPiStats("blockedShots")} />
                    <MetricCard label="Total Passes Completed" {...getPiStats("passes")} />
                    <MetricCard label="Key Passes" {...getPiStats("keyPasses")} />
                    <MetricCard label="Long Passes" {...getPiStats("longPasses")} />
                    <MetricCard label="Passes in Opponent Half" {...getPiStats("passesInOpponentHalf")} />
                    <MetricCard label="Passes in Final Third" {...getPiStats("finalThirdPasses")} />
                    <MetricCard label="Crosses Attempted" {...getPiStats("crosses")} />
                    <MetricCard label="Final Third Entries" {...getPiStats("finalThirdEntries")} />
                    <MetricCard label="Box Entries" {...getPiStats("boxEntries")} />
                    <MetricCard label="Tackles Made" {...getPiStats("tackles")} />
                    <MetricCard label="Interceptions" {...getPiStats("interceptions")} />
                    <MetricCard label="Clearances" {...getPiStats("clearances")} />
                    <MetricCard label="Ball Recoveries" {...getPiStats("ballRecoveries")} />
                    <MetricCard label="Corners Awarded" {...getPiStats("corners")} />
                    <MetricCard label="Fouls Committed" {...getPiStats("fouls")} />
                    <MetricCard label="Yellow Cards" {...getPiStats("yellowCards")} />
                  </>
                )}

                {activeTab === "Tactical Stats" && (
                  <>
                    <MetricCard label="Goals" {...getPiStats("goals")} />
                    <MetricCard label="Shots on Target" {...getPiStats("shotsOnTarget")} />
                    <MetricCard label="Counter Attacks" {...getPiStats("counterAttacks")} />
                    <MetricCard label="Counter Attack to Shot" {...getPiStats("counterAttackToShot")} />
                    <MetricCard label="Ball Recoveries" {...getPiStats("ballRecoveries")} />
                    <MetricCard label="Attacking Third Recoveries" {...getPiStats("attackingThirdRecovery")} />
                    <MetricCard label="Defensive Third Recoveries" {...getPiStats("defensiveThirdRecovery")} />
                    <MetricCard label="Midfield Third Recoveries" {...getPiStats("midfieldThirdRecovery")} />
                    <MetricCard label="Turnovers" {...getPiStats("turnovers")} />
                  </>
                )}

                {activeTab === "Set Pieces" && (
                  <>
                    <MetricCard label="Fouls Won" {...getPiStats("foulsWon")} />
                    <MetricCard label="Fouls Committed" {...getPiStats("fouls")} />
                    <MetricCard label="Free-Kick Award" {...getPiStats("freeKickAward")} />
                    <MetricCard label="Direct Free-Kicks" {...getPiStats("directFreeKick")} />
                    <MetricCard label="Free-Kick Crosses" {...getPiStats("freeKickCrosses")} />
                    <MetricCard label="Corners Awarded" {...getPiStats("corners")} />
                    <MetricCard label="Corner to Shot" {...getPiStats("cornerToShot")} />
                    <MetricCard label="Corner to Shot Allowed" {...getPiStats("cornerToShotAllowed")} />
                    <MetricCard label="Corner to Clearance" {...getPiStats("cornerToClearance")} />
                    <MetricCard label="Long Throw-Ins" {...getPiStats("longThrows")} />
                  </>
                )}
              </div>
            </div>

          </div>
        </>
      )}

      {/* Sleek Modern Mobile Export Warning Modal */}
      {showExportWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-all animate-fade-in no-print">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 flex flex-col items-center text-center gap-4">
            <div className="h-12 w-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-500">
              <Printer className="h-6 w-6" />
            </div>
            <div>
              <h4 className="font-display font-bold text-slate-900 text-lg">Laptop Only Feature</h4>
              <p className="text-xs text-slate-500 font-sans mt-1.5 leading-relaxed">
                Exporting full PDF reports is a complex statistical operation optimized for Laptop or Desktop screen resolutions. Please sign in on a computer to use this feature.
              </p>
            </div>
            <button
              onClick={() => setShowExportWarning(false)}
              className="w-full rounded-lg bg-[#0A2342] hover:bg-[#112F55] py-2 px-4 text-xs font-bold text-white transition-all shadow-md cursor-pointer"
            >
              Understand & Confirm
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Chart Renderers helper
function renderChartByTab(tab: TabType, data: any[], type: "line" | "bar") {
  const commonAxisStyle = { fontSize: 10, fill: "#64748B" };
  const tooltipStyle = {
    backgroundColor: "#ffffff",
    borderColor: "#E2E8F0",
    color: "#0f172a",
    fontSize: 11,
    borderRadius: 6,
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)"
  };

  if (type === "bar") {
    switch (tab) {
      case "General":
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="name" tick={commonAxisStyle} stroke="#CBD5E1" />
            <YAxis yAxisId="left" tick={commonAxisStyle} stroke="#1D4ED8" />
            <YAxis yAxisId="right" orientation="right" tick={commonAxisStyle} stroke="#10B981" />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Bar yAxisId="left" dataKey="Shots" fill="#1D4ED8" name="Shots" radius={[4, 4, 0, 0]} />
            <Bar yAxisId="right" dataKey="Attack xG" fill="#10B981" name="Expected Goals (xG)" radius={[4, 4, 0, 0]} />
            <Bar yAxisId="right" dataKey="Conceded xG" fill="#EF4444" name="Conceded xG" radius={[4, 4, 0, 0]} />
            <Bar yAxisId="left" dataKey="PPDA" fill="#64748B" name="PPDA Index" radius={[4, 4, 0, 0]} />
          </BarChart>
        );
      case "Tactical Stats":
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="name" tick={commonAxisStyle} stroke="#CBD5E1" />
            <YAxis yAxisId="left" tick={commonAxisStyle} stroke="#1D4ED8" />
            <YAxis yAxisId="right" orientation="right" tick={commonAxisStyle} stroke="#D97706" />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Bar yAxisId="left" dataKey="Recoveries" fill="#1D4ED8" name="Ball Recoveries" radius={[4, 4, 0, 0]} />
            <Bar yAxisId="right" dataKey="Transition Shot Delay" fill="#D97706" name="Recovery Shot Delay (s)" radius={[4, 4, 0, 0]} />
            <Bar yAxisId="left" dataKey="Turnovers" fill="#94A3B8" name="Turnovers" radius={[4, 4, 0, 0]} />
          </BarChart>
        );
      case "Set Pieces":
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="name" tick={commonAxisStyle} stroke="#CBD5E1" />
            <YAxis yAxisId="left" tick={commonAxisStyle} stroke="#1D4ED8" />
            <YAxis yAxisId="right" orientation="right" tick={commonAxisStyle} stroke="#10B981" />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Bar yAxisId="left" dataKey="Set Piece xG" fill="#10B981" name="Set Piece xG" radius={[4, 4, 0, 0]} />
            <Bar yAxisId="right" dataKey="Corners" fill="#1D4ED8" name="Corners Won" radius={[4, 4, 0, 0]} />
          </BarChart>
        );
      default:
        return null;
    }
  }

  switch (tab) {
    case "General":
      return (
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
          <XAxis dataKey="name" tick={commonAxisStyle} stroke="#CBD5E1" />
          <YAxis yAxisId="left" tick={commonAxisStyle} stroke="#1D4ED8" />
          <YAxis yAxisId="right" orientation="right" tick={commonAxisStyle} stroke="#10B981" />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Line yAxisId="left" type="monotone" dataKey="Shots" stroke="#1D4ED8" strokeWidth={2} name="Shots" activeDot={{ r: 5 }} />
          <Line yAxisId="right" type="monotone" dataKey="Attack xG" stroke="#10B981" strokeWidth={2} name="Expected Goals (xG)" />
          <Line yAxisId="right" type="monotone" dataKey="Conceded xG" stroke="#EF4444" strokeWidth={1.5} name="Conceded xG" />
          <Line yAxisId="left" type="monotone" dataKey="PPDA" stroke="#64748B" strokeWidth={1.5} name="PPDA Index" />
        </LineChart>
      );
    case "Tactical Stats":
      return (
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
          <XAxis dataKey="name" tick={commonAxisStyle} stroke="#CBD5E1" />
          <YAxis yAxisId="left" tick={commonAxisStyle} stroke="#1D4ED8" />
          <YAxis yAxisId="right" orientation="right" tick={commonAxisStyle} stroke="#D97706" />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Line yAxisId="left" type="monotone" dataKey="Recoveries" stroke="#1D4ED8" strokeWidth={2} name="Ball Recoveries" />
          <Line yAxisId="right" type="monotone" dataKey="Transition Shot Delay" stroke="#D97706" strokeWidth={2} name="Recovery Shot Delay (s)" />
          <Line yAxisId="left" type="monotone" dataKey="Turnovers" stroke="#94A3B8" strokeWidth={1.5} name="Turnovers" />
        </LineChart>
      );
    case "Set Pieces":
      return (
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
          <XAxis dataKey="name" tick={commonAxisStyle} stroke="#CBD5E1" />
          <YAxis yAxisId="left" tick={commonAxisStyle} stroke="#10B981" />
          <YAxis yAxisId="right" orientation="right" tick={commonAxisStyle} stroke="#1D4ED8" />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Line yAxisId="left" type="monotone" dataKey="Set Piece xG" stroke="#10B981" strokeWidth={2} name="Set Piece xG" />
          <Line yAxisId="right" type="monotone" dataKey="Corners" stroke="#1D4ED8" strokeWidth={2} name="Corners Won" />
        </LineChart>
      );
    default:
      return null;
  }
}

// Performance Indicator single row
function PiRow({ label, value, desc, unit, highlight = false }: { label: string; value: number; desc: string; unit: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center border-b border-slate-100 pb-2 md:pb-2.5 last:border-0 last:pb-0 ${highlight ? "bg-blue-50/50 p-1.5 rounded border border-blue-100/40" : ""}`} id={`pi-row-${label.replace(/\s+/g, '-')}`}>
      <div className="flex items-center flex-1 min-w-0 mr-4">
        <span className="text-xs font-semibold text-slate-800 flex items-center gap-1 shrink-0">
          {highlight && <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse shrink-0" />}
          {label}
        </span>
        {/* Dot leader to bridge label and value */}
        <div className="flex-1 border-b border-dotted border-slate-200 mx-2 self-end mb-1" />
      </div>
      <div className="flex items-baseline gap-0.5 font-mono text-xs font-bold text-[#0A2342] shrink-0">
        <span className={highlight ? "text-blue-600 font-extrabold" : ""}>{value}</span>
        <span className="text-[9px] font-sans font-normal text-slate-400">{unit}</span>
      </div>
    </div>
  );
}

// Custom Stat Grid Card showing Average / Total
function MetricCard({ label, avg, total, unit = "" }: { label: string; avg: string; total: string; unit?: string }) {
  return (
    <div 
      className="bg-[#0B0F19] border border-slate-800 p-4 rounded-xl flex flex-col justify-between shadow-md hover:border-slate-700 transition-colors min-h-[92px]" 
      id={`metric-card-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <span className="text-slate-400 text-xs font-medium uppercase tracking-wider block">
        {label}
      </span>
      <div className="text-yellow-400 text-2xl font-bold font-mono mt-2 flex items-baseline gap-1.5 flex-wrap">
        <span>{avg}{unit}</span>
        {total && total !== "-" && (
          <span className="text-slate-500 text-xs font-normal font-sans font-mono">
            / {total}
          </span>
        )}
      </div>
    </div>
  );
}
