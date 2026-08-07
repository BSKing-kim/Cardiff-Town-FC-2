import React, { useState, useEffect } from "react";
import { MatchData, CustomTeam, UserProfile, UserRole } from "../types";
import { KPICalculator } from "../lib/kpiCalculations";
import TeamStats from "./TeamStats";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, LineChart, Line
} from "recharts";
import { 
  Shield, Sparkles, ArrowRightLeft, Target, AlertCircle, Layers, 
  Printer, ArrowLeft, Trophy, Check, HelpCircle, RefreshCw, ChevronRight, UserCheck
} from "lucide-react";
import { LEAGUES } from "./TeamDashboard";
import { calculateDivisionStandings } from "../lib/leagueData";

interface OpponentAnalysisProps {
  matches: MatchData[];
  defaultOpponent?: string;
  customTeams?: CustomTeam[];
  currentUser?: UserProfile | null;
}

type SubViewType = "standings" | "detailedStats" | "comparison";
type TabType = "General" | "Tactical Stats" | "Set Pieces";

export default function OpponentAnalysis({ matches, defaultOpponent, customTeams = [], currentUser }: OpponentAnalysisProps) {
  // Navigation & Filtering state
  const [activeSubView, setActiveSubView] = useState<SubViewType>("standings");
  const [selectedOpponentName, setSelectedOpponentName] = useState<string>("league_average");
  const [activeTab, setActiveTab] = useState<TabType>("General");
  const [activeLeagueIdx, setActiveLeagueIdx] = useState<number>(3); // CCFL Third Division as default
  
  // Comparison checkboxes state
  const [selectedCompareTeams, setSelectedCompareTeams] = useState<string[]>([]);
  const [compareTeamA, setCompareTeamA] = useState<string>("Cardiff Town FC");
  const [compareTeamB, setCompareTeamB] = useState<string>("");
  const [radarCategory, setRadarCategory] = useState<TabType>("General");
  
  const [isMobile, setIsMobile] = useState(false);
  const [trendChartType, setTrendChartType] = useState<"line" | "bar">("line");

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Handle defaultOpponent passed from other tabs
  useEffect(() => {
    if (defaultOpponent && defaultOpponent !== "all" && defaultOpponent !== "league_average") {
      setSelectedOpponentName(defaultOpponent);
      setActiveSubView("detailedStats");
    }
  }, [defaultOpponent]);

  const oppMatches = matches.filter(m => m.isOpponentTeam).sort((a, b) => a.date.localeCompare(b.date));
  const ourMatches = matches.filter(m => !m.isOpponentTeam);

  // Authorization check
  const isAuthorized = currentUser && (
    currentUser.isAdmin || 
    currentUser.role === UserRole.HeadCoach || 
    currentUser.role === UserRole.Manager || 
    currentUser.role === UserRole.Analyst
  );

  // Calculate Standings dynamically
  const calculateStandings = () => {
    const activeLeagueName = LEAGUES[activeLeagueIdx];
    return calculateDivisionStandings(activeLeagueName, [], customTeams);
  };

  const standings = calculateStandings();

  // Helper to retrieve and aggregate metrics for any team
  const getTeamStats = (teamName: string) => {
    const targetName = (teamName || "").toLowerCase().trim();
    const isOurTeam = targetName === "cardiff town fc";

    let teamMatches: MatchData[] = [];
    if (isOurTeam) {
      teamMatches = ourMatches;
    } else {
      teamMatches = matches.filter(m => {
        const oppName = (m.opponent || "").toLowerCase().trim();
        const tName = (m.teamName || "").toLowerCase().trim();
        const oppId = (m.opponent_id || "").toLowerCase().trim();
        
        const matchOpponent = oppName === targetName || tName === targetName || oppId === targetName;
        
        if (m.isOpponentTeam) {
          return matchOpponent;
        } else {
          return oppName === targetName || oppId === targetName;
        }
      });
    }

    const avg = KPICalculator.getAverage(teamMatches);
    const att = KPICalculator.calculateAttack(avg);
    const def = KPICalculator.calculateDefense(avg);
    const tran = KPICalculator.calculateTransition(avg);
    const poss = KPICalculator.calculatePossession(avg);
    const set = KPICalculator.calculateSetPiece(avg);

    return { avg, att, def, tran, poss, set, matches: teamMatches };
  };

  // Helper to map and package metric rows for displays
  const getKpiVal = (teamStats: any, key: string): { avg: string, total: string } => {
    const { att, def, tran, poss, set, avg } = teamStats;
    let val: number = 0;
    let tot: number = 0;

    switch (key) {
      // Shots Group
      case "shotAccuracyTotal": val = att.shotAccuracyTotal; break;
      case "shotAccuracyExclBlocked": val = att.shotAccuracyExclBlocked; break;
      case "goalConversion": val = att.goalConversion; break;
      case "xG": val = att.xG; break;
      case "shotsOutsideBoxProp": val = att.shotsOutsideBoxProp; break;
      case "shotsInsideBoxProp": val = att.shotsInsideBoxProp; break;
      
      // Pass Group
      case "passAccuracy": val = att.passAccuracy; break;
      case "longPassesAccuracy": val = att.longPassesAccuracy; break;
      case "passesInOpponentHalfAccuracy": val = att.passesInOpponentHalfAccuracy; break;
      case "passesInFinalThirdAccuracy": val = att.passesInFinalThirdAccuracy; break;
      case "crossingAccuracy": val = att.crossingAccuracy; break;
      case "openPlayCrossingAccuracy": val = att.openPlayCrossingAccuracy; break;
      case "longPassesProp": val = att.longPassesProp; break;
      case "forwardPassesProp": val = att.forwardPassesProp; break;
      case "keyPassesProp": val = att.keyPassesProp; break;
      case "xA": val = att.xA; break;

      // Distribution Group
      case "finalThirdEntryToShot": val = att.finalThirdEntryToShot; break;
      case "penaltyAreaEntryToShot": val = att.penaltyAreaEntryToShot; break;
      case "duelsSuccessRate": val = att.duelsSuccessRate; break;
      case "aerialDuelsWon": val = att.aerialDuelsWon; break;
      case "groundDuelsWon": val = att.groundDuelsWon; break;

      // Defense Group
      case "tackleSuccessRate": val = def.tackleSuccessRate; break;
      case "recoveriesInAttackingHalf": val = def.recoveriesInAttackingHalf; break;
      case "opponentXgConceded": val = def.opponentXgConceded; break;
      case "defensiveDuelWinRate": val = def.defensiveDuelWinRate; break;

      // Tactical Group
      case "counterAttackShotProp": val = tran.counterAttackShotProp; break;
      case "counterAttackShotAccuracy": val = tran.counterAttackShotAccuracy; break;
      case "possessionValue": val = poss.possessionValue; break;

      // Set Piece Group
      case "setPieceXg": val = set.setPieceXg; break;
      case "setPieceXgAllowed": val = set.setPieceXgAllowed; break;
      case "freeKickGoalConversion": val = set.freeKickGoalConversion; break;
      case "foulCommittedAvg": val = set.foulCommittedAvg; break;
      case "directFreeKickSuccess": val = set.directFreeKickSuccess; break;
      case "freeKickCrossingAccuracy": val = set.freeKickCrossingAccuracy; break;
      case "cornerToShotRate": val = set.cornerToShotRate; break;
      case "cornerToShotAllowedRate": val = set.cornerToShotAllowedRate; break;
      case "cornerToConcededRate": val = set.cornerToConcededRate; break;
      case "cornerToClearanceRate": val = set.cornerToClearanceRate; break;
    }

    return { 
      avg: isNaN(val) ? "0.0" : val.toFixed(1),
      total: String(Math.round(tot))
    };
  };

  const getPiVal = (teamStats: any, key: string): { avg: string, total: string } => {
    const { avg, matches: teamMatches } = teamStats;
    let val: number = 0;
    let tot: number = 0;

    const count = teamMatches.length || 1;

    switch (key) {
      // Shots Group
      case "goals": val = avg.goals || 0; tot = (avg.goals || 0) * count; break;
      case "shots": val = avg.shots || 0; tot = (avg.shots || 0) * count; break;
      case "shotsOnTarget": val = avg.shotsOnTarget || 0; tot = (avg.shotsOnTarget || 0) * count; break;
      case "blockedShots": val = avg.shotBlocked || avg.blockedShots || 0; tot = (avg.shotBlocked || avg.blockedShots || 0) * count; break;
      case "headedShots": val = avg.headedShots || 0; tot = (avg.headedShots || 0) * count; break;
      case "shotsOutsideBox": val = avg.shotOffTarget || avg.shotsOutsideBox || 0; tot = (avg.shotOffTarget || avg.shotsOutsideBox || 0) * count; break;
      case "insideBoxShots": val = avg.insideBoxShots || 0; tot = (avg.insideBoxShots || 0) * count; break;

      // Passes Group
      case "passes": val = avg.totalPasses || avg.passes || 0; tot = (avg.totalPasses || avg.passes || 0) * count; break;
      case "keyPasses": val = avg.keyPasses || 0; tot = (avg.keyPasses || 0) * count; break;
      case "longPasses": val = avg.longPasses || 0; tot = (avg.longPasses || 0) * count; break;
      case "passesInOpponentHalf": val = avg.passesInOpponentHalf || 0; tot = (avg.passesInOpponentHalf || 0) * count; break;
      case "finalThirdPasses": val = avg.finalThirdPasses || 0; tot = (avg.finalThirdPasses || 0) * count; break;
      case "forwardPasses": val = avg.forwardPasses || 0; tot = (avg.forwardPasses || 0) * count; break;
      case "throughBalls": val = avg.throughBalls || 0; tot = (avg.throughBalls || 0) * count; break;
      case "crosses": val = avg.crosses || 0; tot = (avg.crosses || 0) * count; break;
      case "openPlayCrosses": val = avg.openPlayCrosses || 0; tot = (avg.openPlayCrosses || 0) * count; break;

      // Distribution Group
      case "possessionRate": val = avg.possessionRate || 0; tot = val; break;
      case "finalThirdEntries": val = avg.finalThirdEntry || avg.finalThirdEntries || 0; tot = (avg.finalThirdEntry || avg.finalThirdEntries || 0) * count; break;
      case "boxEntries": val = avg.boxEntries || 0; tot = (avg.boxEntries || 0) * count; break;
      case "duels": val = (avg.aerialDuels || 0) + (avg.defensiveDuels || 0); tot = val * count; break;
      case "aerialDuels": val = avg.aerialDuels || 0; tot = (avg.aerialDuels || 0) * count; break;
      case "groundDuels": val = avg.defensiveDuels || 0; tot = (avg.defensiveDuels || 0) * count; break;
      case "foulsWon": val = avg.wasFouled || avg.foulsWon || 0; tot = (avg.wasFouled || avg.foulsWon || 0) * count; break;
      case "offside": val = avg.offside || 0; tot = (avg.offside || 0) * count; break;
      case "corners": val = avg.corners || 0; tot = (avg.corners || 0) * count; break;

      // Defense Group
      case "tackles": val = avg.tacklesAttempted || avg.tackles || 0; tot = (avg.tacklesAttempted || avg.tackles || 0) * count; break;
      case "clearances": val = avg.clearances || 0; tot = (avg.clearances || 0) * count; break;
      case "interceptions": val = avg.interceptions || 0; tot = (avg.interceptions || 0) * count; break;
      case "blocks": val = avg.blocks || 0; tot = (avg.blocks || 0) * count; break;
      case "ballRecoveries": val = avg.ballRecoveries || avg.recoveries || 0; tot = (avg.ballRecoveries || avg.recoveries || 0) * count; break;
      case "attackingThirdRecovery": val = avg.attackingThirdRecovery || 0; tot = (avg.attackingThirdRecovery || 0) * count; break;
      case "defensiveThirdRecovery": val = avg.defensiveThirdRecovery || 0; tot = (avg.defensiveThirdRecovery || 0) * count; break;
      case "midfieldThirdRecovery": val = avg.midfieldThirdRecovery || 0; tot = (avg.midfieldThirdRecovery || 0) * count; break;
      case "fouls": val = avg.fouls || 0; tot = (avg.fouls || 0) * count; break;
      case "yellowCards": val = avg.yellowCards || 0; tot = (avg.yellowCards || 0) * count; break;
      case "redCard": val = avg.redCard || 0; tot = (avg.redCard || 0) * count; break;

      // Tactical transition PIs
      case "counterAttacks": val = avg.counterAttacks || 0; tot = (avg.counterAttacks || 0) * count; break;
      case "turnovers": val = avg.turnovers || 0; tot = (avg.turnovers || 0) * count; break;
      case "transitionPasses": val = avg.transitionPasses || 0; tot = (avg.transitionPasses || 0) * count; break;

      // Set Pieces PIs
      case "freeKicks": val = avg.freeKicks || 0; tot = (avg.freeKicks || 0) * count; break;
      case "longThrows": val = avg.longThrows || 0; tot = (avg.longThrows || 0) * count; break;
      case "directFreeKick": val = Math.round((avg.freeKicks || 0) * 0.3); tot = val * count; break;
      case "freeKickCrosses": val = Math.round((avg.freeKicks || 0) * 0.5); tot = val * count; break;
      case "cornerToShot": val = Math.round((avg.corners || 0) * 0.3); tot = val * count; break;
      case "cornerToShotAllowed": val = Math.round((avg.corners || 0) * 0.1); tot = val * count; break;
      case "cornerToConceded": val = 0; tot = 0; break;
      case "cornerToClearance": val = Math.round((avg.corners || 0) * 0.5); tot = val * count; break;
    }

    return {
      avg: isNaN(val) ? "0.0" : val.toFixed(1),
      total: String(Math.round(tot))
    };
  };

  // Manage Compare checkboxes
  const handleCheckboxChange = (teamName: string) => {
    if (selectedCompareTeams.includes(teamName)) {
      setSelectedCompareTeams(selectedCompareTeams.filter(t => t !== teamName));
    } else {
      if (selectedCompareTeams.length >= 2) {
        // limit to 2
        setSelectedCompareTeams([selectedCompareTeams[1], teamName]);
      } else {
        setSelectedCompareTeams([...selectedCompareTeams, teamName]);
      }
    }
  };

  const handleRunComparison = () => {
    if (selectedCompareTeams.length === 0) {
      alert("Please select at least one team to compare.");
      return;
    }
    if (selectedCompareTeams.length === 1) {
      // Compare with our team Cardiff Town FC by default
      setCompareTeamA("Cardiff Town FC");
      setCompareTeamB(selectedCompareTeams[0]);
    } else {
      setCompareTeamA(selectedCompareTeams[0]);
      setCompareTeamB(selectedCompareTeams[1]);
    }
    setActiveSubView("comparison");
  };

  const handleInstantCompareWithUs = (opponentTeam: string) => {
    setCompareTeamA("Cardiff Town FC");
    setCompareTeamB(opponentTeam);
    setActiveSubView("comparison");
  };

  const handleOpenDetailedStats = (teamName: string) => {
    setSelectedOpponentName(teamName);
    setActiveSubView("detailedStats");
  };

  // Pre-calculations for Detailed Stats of selected opponent
  const activeOpponentData = getTeamStats(selectedOpponentName);

  // Pre-calculations for Comparison view
  const statsA = getTeamStats(compareTeamA);
  const statsB = getTeamStats(compareTeamB || "league_average");

  // Get Radar Chart Data based on chosen category
  const getRadarData = () => {
    if (radarCategory === "General") {
      return [
        { subject: "Shot Accuracy", A: Number(getKpiVal(statsA, "shotAccuracyTotal").avg), B: Number(getKpiVal(statsB, "shotAccuracyTotal").avg), fullMark: 100 },
        { subject: "Goal Conv.", A: Number(getKpiVal(statsA, "goalConversion").avg), B: Number(getKpiVal(statsB, "goalConversion").avg), fullMark: 100 },
        { subject: "Shots / Match", A: Number(getPiVal(statsA, "shots").avg) * 5, B: Number(getPiVal(statsB, "shots").avg) * 5, fullMark: 100 },
        { subject: "Tackle Success", A: Number(getKpiVal(statsA, "tackleSuccessRate").avg), B: Number(getKpiVal(statsB, "tackleSuccessRate").avg), fullMark: 100 },
        { subject: "Duel Win %", A: Number(getKpiVal(statsA, "defensiveDuelWinRate").avg), B: Number(getKpiVal(statsB, "defensiveDuelWinRate").avg), fullMark: 100 },
        { subject: "Expected Goals (x15)", A: Number(getKpiVal(statsA, "xG").avg) * 15, B: Number(getKpiVal(statsB, "xG").avg) * 15, fullMark: 100 }
      ];
    } else if (radarCategory === "Tactical Stats") {
      return [
        { subject: "Possession %", A: Number(getPiVal(statsA, "possessionRate").avg), B: Number(getPiVal(statsB, "possessionRate").avg), fullMark: 100 },
        { subject: "Pass Acc %", A: Number(getKpiVal(statsA, "passAccuracy").avg), B: Number(getKpiVal(statsB, "passAccuracy").avg), fullMark: 100 },
        { subject: "Key Pass %", A: Number(getKpiVal(statsA, "keyPassesProp").avg) * 4, B: Number(getKpiVal(statsB, "keyPassesProp").avg) * 4, fullMark: 100 },
        { subject: "Recoveries (x2)", A: Number(getPiVal(statsA, "ballRecoveries").avg) * 2, B: Number(getPiVal(statsB, "ballRecoveries").avg) * 2, fullMark: 100 },
        { subject: "Turnovers (Inv)", A: 100 - (Number(getPiVal(statsA, "turnovers").avg) * 3), B: 100 - (Number(getPiVal(statsB, "turnovers").avg) * 3), fullMark: 100 },
        { subject: "Counter Shot %", A: Number(getKpiVal(statsA, "counterAttackShotProp").avg), B: Number(getKpiVal(statsB, "counterAttackShotProp").avg), fullMark: 100 }
      ];
    } else { // Set Pieces
      return [
        { subject: "Corners (x5)", A: Number(getPiVal(statsA, "corners").avg) * 5, B: Number(getPiVal(statsB, "corners").avg) * 5, fullMark: 100 },
        { subject: "Free Kicks (x5)", A: Number(getPiVal(statsA, "freeKicks").avg) * 5, B: Number(getPiVal(statsB, "freeKicks").avg) * 5, fullMark: 100 },
        { subject: "Set Piece xG (x20)", A: Number(getKpiVal(statsA, "setPieceXg").avg) * 20, B: Number(getKpiVal(statsB, "setPieceXg").avg) * 20, fullMark: 100 },
        { subject: "Corner to Shot %", A: Number(getKpiVal(statsA, "cornerToShotRate").avg), B: Number(getKpiVal(statsB, "cornerToShotRate").avg), fullMark: 100 },
        { subject: "Corner Clear %", A: Number(getKpiVal(statsA, "cornerToClearanceRate").avg), B: Number(getKpiVal(statsB, "cornerToClearanceRate").avg), fullMark: 100 },
        { subject: "Long Throws (x10)", A: Number(getPiVal(statsA, "longThrows").avg) * 10, B: Number(getPiVal(statsB, "longThrows").avg) * 10, fullMark: 100 }
      ];
    }
  };

  const radarData = getRadarData();

  // Printable components rendering
  const handlePrint = () => {
    window.print();
  };

  // Render 1: League standings & team checklist selection
  if (activeSubView === "standings") {
    return (
      <div className="space-y-6 animate-fadeIn" id="opponent-analysis-standings">
        {/* Header Block */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-4">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Trophy className="h-5.5 w-5.5 text-cyan-400" />
              Opponent Analysis & Team List
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-bold font-sans">Active Division:</span>
            <select
              value={activeLeagueIdx}
              onChange={(e) => setActiveLeagueIdx(Number(e.target.value))}
              className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 font-sans cursor-pointer"
            >
              {LEAGUES.map((l, idx) => (
                <option key={l} value={idx}>{l}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Dynamic Standing / Team List Table */}
        <div className="rounded-xl border border-slate-800 bg-[#0f172a] overflow-hidden shadow-xl">
          <div className="bg-slate-900 border-b border-slate-800 px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <Trophy className="h-4.5 w-4.5 text-amber-400" />
              <span className="font-display font-bold text-white text-xs uppercase tracking-wider">
                {LEAGUES[activeLeagueIdx]} Team List
              </span>
            </div>
            
            {/* Run comparison button triggered if checkboxes are marked */}
            <div className="flex items-center gap-2.5">
              {selectedCompareTeams.length > 0 && (
                <span className="text-[11px] font-bold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded font-mono border border-cyan-800">
                  {selectedCompareTeams.length} Selected
                </span>
              )}
              <button
                type="button"
                onClick={handleRunComparison}
                disabled={selectedCompareTeams.length === 0}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all shadow-md cursor-pointer ${
                  selectedCompareTeams.length > 0
                    ? "bg-cyan-600 hover:bg-cyan-500 text-white"
                    : "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
                }`}
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
                <span>Compare Selected ({selectedCompareTeams.length === 1 ? "vs Us" : "2 Teams"})</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950 text-[10px] uppercase tracking-wider text-slate-400 font-bold font-sans">
                  <th className="py-3 px-4 text-center w-12">Compare</th>
                  <th className="py-3 px-4 min-w-[200px]">Team Name</th>
                  <th className="py-3 px-4 text-right min-w-[180px]">Tactical Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-xs font-sans text-slate-300">
                {standings.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-slate-400 font-sans text-xs">
                      <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto p-4">
                        <Shield className="w-8 h-8 text-slate-600 mb-1" />
                        <span className="font-semibold text-slate-300">No teams registered for this division yet.</span>
                        <span className="text-slate-400 text-[11px]">Upload the League Teams template to build standings.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  standings.map((team, idx) => {
                  const isOurTeam = team.name === "Cardiff Town FC";
                  const isChecked = selectedCompareTeams.includes(team.name);
                  
                  // Count available uploaded match statistics
                  const matchCount = team.name === "Cardiff Town FC" 
                    ? ourMatches.length 
                    : matches.filter(m => m.opponent === team.name && m.isOpponentTeam).length;

                  return (
                    <tr 
                      key={team.name} 
                      className={`hover:bg-slate-800/50 transition-all ${
                        isOurTeam ? "bg-cyan-950/30 hover:bg-cyan-950/50 font-bold" : ""
                      }`}
                    >
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleCheckboxChange(team.name)}
                          className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-4 font-semibold text-white">
                        <div className="flex items-center gap-2">
                          <span className={isOurTeam ? "text-cyan-400 font-bold" : "text-slate-100"}>
                            {team.name}
                          </span>
                          {isOurTeam && (
                            <span className="text-[9px] bg-cyan-950 text-cyan-400 border border-cyan-800 px-1.5 py-0.2 rounded font-semibold font-mono uppercase tracking-wider">
                              Our Club
                            </span>
                          )}
                          {matchCount > 0 && (
                            <span className="text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.2 rounded font-semibold font-mono">
                              {matchCount} Stats
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenDetailedStats(team.name)}
                          className="px-2.5 py-1 text-[10.5px] font-bold rounded-lg text-cyan-400 hover:bg-cyan-950/60 border border-cyan-800 transition-all cursor-pointer"
                        >
                          View
                        </button>
                        {!isOurTeam && (
                          <button
                            type="button"
                            onClick={() => handleInstantCompareWithUs(team.name)}
                            className="px-2.5 py-1 text-[10.5px] font-bold rounded-lg text-slate-200 hover:bg-slate-800 border border-slate-700 transition-all cursor-pointer inline-flex items-center gap-1"
                          >
                            <ArrowRightLeft className="h-3 w-3 text-slate-400" />
                            <span>vs Us</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                }))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Informational Guidance Alert */}
        <div className="rounded-xl border border-cyan-900/60 bg-cyan-950/40 p-4 flex gap-3 text-xs leading-relaxed text-cyan-200">
          <HelpCircle className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5 animate-bounce" />
          <div className="font-sans">
            <p className="font-bold uppercase tracking-wider text-cyan-300 text-[10px]">Comparative Scouting Guide</p>
            <p className="mt-0.5 text-slate-300">
              Check any opponent team and click the <strong className="text-white">Compare Selected</strong> button to visualize matchups. If you check only one opponent, the system automatically runs the comparison against Cardiff Town FC. Select <strong className="text-white">View</strong> to see comprehensive performance summaries (identical to our Team Stats screen).
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Render 2: Detailed team stats dashboard (Identical to Team Stats / TeamDashboard)
  if (activeSubView === "detailedStats") {
    return (
      <TeamStats
        matches={matches}
        currentUser={currentUser}
        selectedTeamName={selectedOpponentName}
        isOpponentView={true}
        onBack={() => setActiveSubView("standings")}
        leagueName={LEAGUES[activeLeagueIdx]}
      />
    );
  }

  if (false as boolean && activeSubView === "detailedStats") {
    const oppAvg = activeOpponentData.avg;
    const oppMatchesList = activeOpponentData.matches;
    const isOurSelected = selectedOpponentName === "Cardiff Town FC";

    // Replicating getKpiStats and getPiStats from TeamDashboard for exact metrics display
    const getKpiStats = (key: string) => {
      return getKpiVal(activeOpponentData, key);
    };

    const getPiStats = (key: string) => {
      return getPiVal(activeOpponentData, key);
    };

    // Prepare trend datasets for graphs
    const chronologicalMetrics = oppMatchesList.map((m, idx) => {
      const singleStats = getTeamStats(selectedOpponentName);
      // Mock stats for individual match index representation
      const corners = m.corners || 0;
      return {
        name: `M${idx + 1}`,
        Shots: m.shots || 0,
        "Attack xG": m.goals || 0,
        "Conceded xG": isOurSelected ? (m.opponentXgConceded || 0) : 0,
        PPDA: 8.5,
        Recoveries: m.ballRecoveries || 0,
        "Transition Shot Delay": 4.5,
        Turnovers: m.turnovers || 0,
        "Set Piece xG": corners * 0.1,
        Corners: corners
      };
    });

    return (
      <div className="space-y-6 animate-fadeIn" id="opponent-detailed-stats-view">
        {/* Breadcrumb Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#E2E8F0] pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveSubView("standings")}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Return to standings"
            >
              <ArrowLeft className="h-5 w-5 text-[#0A2342]" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded uppercase font-bold text-slate-500 font-mono">
                  Scouting Profile
                </span>
                <span className="text-xs text-slate-400 font-bold">CCFL {LEAGUES[activeLeagueIdx]}</span>
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#0A2342] mt-0.5">
                {selectedOpponentName} Statistics
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* PDF Report Export */}
            <button
              onClick={handlePrint}
              disabled={isMobile}
              className={`inline-flex items-center gap-1.5 rounded px-3 py-1.8 text-xs font-bold border cursor-pointer transition-colors shadow-xs ${
                isMobile
                  ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-50"
                  : "bg-[#0A2342] border-[#CBD5E1] text-white hover:bg-[#112F55]"
              }`}
            >
              <Printer className="h-3.5 w-3.5 text-[#D4AF37]" />
              <span>PDF</span>
            </button>
          </div>
        </div>

        {/* Tab Controls mirroring TeamDashboard */}
        <div className="flex border-b border-[#E2E8F0] gap-1 overflow-x-auto whitespace-nowrap scrollbar-none no-print" id="detailed-tabs">
          {[
            { id: "General", icon: Target, label: "General" },
            { id: "Tactical Stats", icon: RefreshCw, label: "Tactical Stats" },
            { id: "Set Pieces", icon: Sparkles, label: "Set Pieces" }
          ].map(tab => {
            const Icon = tab.icon;
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
                <Icon className={`h-4 w-4 ${activeTab === tab.id ? "text-[#1D4ED8]" : "text-slate-400"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Detailed Metrics Content identical to TeamDashboard */}
        <div className="space-y-6">
          {oppMatchesList.length === 0 && !isOurSelected && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3 text-xs leading-relaxed text-amber-800 shadow-xs animate-fadeIn no-print" id="empty-scouting-data-banner">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
              <div className="font-sans">
                <p className="font-bold uppercase tracking-wider text-amber-900 text-[10px]">No Match Data Uploaded</p>
                <p className="mt-0.5">
                  We have not registered or uploaded any Match spreadsheets for games played against <strong>{selectedOpponentName}</strong> yet. Showing default baseline values (0.0). Log match data on the schedule page to update these metrics automatically.
                </p>
              </div>
            </div>
          )}
          {true && (
            <div className="space-y-6">
            
            {/* KPI & PI detail cards grouped by tab */}
            {activeTab === "General" ? (
              <div className="space-y-6 w-full" id="general-grouped">
                {/* Shots Card */}
                <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs">
                  <div className="border-b border-[#E2E8F0] pb-3 mb-4">
                    <h3 className="font-display font-extrabold text-[#0A2342] text-xs sm:text-sm flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#1D4ED8]" />
                      Shots & Conversion Metrics
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-[10px] font-bold text-[#1D4ED8] bg-blue-50 px-2 py-0.5 rounded-sm uppercase tracking-wider mb-2.5 inline-flex items-center gap-1">
                        KPI Ratings
                      </h4>
                      <div className="space-y-1.5 pl-1">
                        <MetricRow label="Shot accuracy Total (Inside/outside the box)" {...getKpiStats("shotAccuracyTotal")} unit="%" />
                        <MetricRow label="Shot accuracy excluding blocked shots" {...getKpiStats("shotAccuracyExclBlocked")} unit="%" />
                        <MetricRow label="Goal conversion" {...getKpiStats("goalConversion")} unit="%" />
                        <MetricRow label="Expected Goals (xG)" {...getKpiStats("xG")} />
                        <MetricRow label="Shots outside the box proportion" {...getKpiStats("shotsOutsideBoxProp")} unit="%" />
                        <MetricRow label="Shots inside the box proportion" {...getKpiStats("shotsInsideBoxProp")} unit="%" />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-bold text-[#0A2342] bg-slate-100 px-2 py-0.5 rounded-sm uppercase tracking-wider mb-2.5 inline-flex items-center gap-1">
                        Performance Indicators (PI)
                      </h4>
                      <div className="space-y-1.5 pl-1">
                        <MetricRow label="Goals" {...getPiStats("goals")} />
                        <MetricRow label="Shots" {...getPiStats("shots")} />
                        <MetricRow label="Shot on target" {...getPiStats("shotsOnTarget")} />
                        <MetricRow label="Blocked Shots" {...getPiStats("blockedShots")} />
                        <MetricRow label="Headed Shots" {...getPiStats("headedShots")} />
                        <MetricRow label="Shots outside the box" {...getPiStats("shotsOutsideBox")} />
                        <MetricRow label="Shots inside the box" {...getPiStats("insideBoxShots")} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Passes Card */}
                <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs">
                  <div className="border-b border-[#E2E8F0] pb-3 mb-4">
                    <h3 className="font-display font-extrabold text-[#0A2342] text-xs sm:text-sm flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#10B981]" />
                      Pass Accuracy & Distribution
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-[10px] font-bold text-[#1D4ED8] bg-blue-50 px-2 py-0.5 rounded-sm uppercase tracking-wider mb-2.5 inline-flex items-center gap-1">
                        KPI Ratings
                      </h4>
                      <div className="space-y-1.5 pl-1">
                        <MetricRow label="Pass accuracy" {...getKpiStats("passAccuracy")} unit="%" />
                        <MetricRow label="Long passes accuracy" {...getKpiStats("longPassesAccuracy")} unit="%" />
                        <MetricRow label="Passing accuracy in opponents half" {...getKpiStats("passesInOpponentHalfAccuracy")} unit="%" />
                        <MetricRow label="Passing accuracy in final third" {...getKpiStats("passesInFinalThirdAccuracy")} unit="%" />
                        <MetricRow label="Crossing accuracy" {...getKpiStats("crossingAccuracy")} unit="%" />
                        <MetricRow label="Open play crossing accuracy" {...getKpiStats("openPlayCrossingAccuracy")} unit="%" />
                        <MetricRow label="Long passes Proportion" {...getKpiStats("longPassesProp")} unit="%" />
                        <MetricRow label="Forward passes proportion" {...getKpiStats("forwardPassesProp")} unit="%" />
                        <MetricRow label="Key Passes proportion" {...getKpiStats("keyPassesProp")} unit="%" />
                        <MetricRow label="Expected Assists (xA)" {...getKpiStats("xA")} />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-bold text-[#0A2342] bg-slate-100 px-2 py-0.5 rounded-sm uppercase tracking-wider mb-2.5 inline-flex items-center gap-1">
                        Performance Indicators (PI)
                      </h4>
                      <div className="space-y-1.5 pl-1">
                        <MetricRow label="Total Completed Passes" {...getPiStats("passes")} />
                        <MetricRow label="Key Passes" {...getPiStats("keyPasses")} />
                        <MetricRow label="Long Passes" {...getPiStats("longPasses")} />
                        <MetricRow label="Passes in Opponents Half" {...getPiStats("passesInOpponentHalf")} />
                        <MetricRow label="Passes in Final Third" {...getPiStats("finalThirdPasses")} />
                        <MetricRow label="Forward Oriented Passes" {...getPiStats("forwardPasses")} />
                        <MetricRow label="Through Balls" {...getPiStats("throughBalls")} />
                        <MetricRow label="Crosses" {...getPiStats("crosses")} />
                        <MetricRow label="Open play crosses" {...getPiStats("openPlayCrosses")} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Distribution & Defending */}
                <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs">
                  <div className="border-b border-[#E2E8F0] pb-3 mb-4">
                    <h3 className="font-display font-extrabold text-[#0A2342] text-xs sm:text-sm flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#EF4444]" />
                      Distribution & Defending Block
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-[10px] font-bold text-[#1D4ED8] bg-blue-50 px-2 py-0.5 rounded-sm uppercase tracking-wider mb-2.5 inline-flex items-center gap-1">
                        KPI Ratings
                      </h4>
                      <div className="space-y-1.5 pl-1">
                        <MetricRow label="Tackle success rate" {...getKpiStats("tackleSuccessRate")} unit="%" />
                        <MetricRow label="Recoveries in attacking half" {...getKpiStats("recoveriesInAttackingHalf")} />
                        <MetricRow label="Defensive Duel Win Rate" {...getKpiStats("defensiveDuelWinRate")} unit="%" />
                        <MetricRow label="Final third entry to shot" {...getKpiStats("finalThirdEntryToShot")} unit="%" />
                        <MetricRow label="Penalty area entry to shot" {...getKpiStats("penaltyAreaEntryToShot")} unit="%" />
                        <MetricRow label="Duels success rate" {...getKpiStats("duelsSuccessRate")} unit="%" />
                        <MetricRow label="Aerial Duels won" {...getKpiStats("aerialDuelsWon")} unit="%" />
                        <MetricRow label="Ground Duels won" {...getKpiStats("groundDuelsWon")} unit="%" />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-bold text-[#0A2342] bg-slate-100 px-2 py-0.5 rounded-sm uppercase tracking-wider mb-2.5 inline-flex items-center gap-1">
                        Performance Indicators (PI)
                      </h4>
                      <div className="space-y-1.5 pl-1">
                        <MetricRow label="Tackles" {...getPiStats("tackles")} />
                        <MetricRow label="Clearances" {...getPiStats("clearances")} />
                        <MetricRow label="Interceptions" {...getPiStats("interceptions")} />
                        <MetricRow label="Blocks" {...getPiStats("blocks")} />
                        <MetricRow label="Recoveries" {...getPiStats("ballRecoveries")} />
                        <MetricRow label="Team Possession Rate" {...getPiStats("possessionRate")} unit="%" />
                        <MetricRow label="Final 3rd entries" {...getPiStats("finalThirdEntries")} />
                        <MetricRow label="Penalty area entries" {...getPiStats("boxEntries")} />
                        <MetricRow label="Yellow cards" {...getPiStats("yellowCards")} />
                        <MetricRow label="Red cards" {...getPiStats("redCard")} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : activeTab === "Tactical Stats" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs">
                  <div className="border-b border-[#E2E8F0] pb-3 mb-4">
                    <h3 className="font-display font-bold text-[#0A2342] flex items-center gap-2 text-xs sm:text-sm">
                      <span className="flex h-4 w-4 items-center justify-center rounded bg-[#1D4ED8] text-[9px] font-bold text-white">KPI</span>
                      Tactical KPIs
                    </h3>
                  </div>
                  <div className="space-y-1.5 Pl-1">
                    <MetricRow label="Goal conversion" {...getKpiStats("goalConversion")} unit="%" />
                    <MetricRow label="Shot accuracy" {...getKpiStats("shotAccuracyTotal")} unit="%" />
                    <MetricRow label="Counter attack Shot proportion" {...getKpiStats("counterAttackShotProp")} unit="%" />
                    <MetricRow label="Counter attack shot accuracy" {...getKpiStats("counterAttackShotAccuracy")} unit="%" />
                    <MetricRow label="Possession Value (PV)" {...getKpiStats("possessionValue")} />
                  </div>
                </div>

                <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs">
                  <div className="border-b border-[#E2E8F0] pb-3 mb-4">
                    <h3 className="font-display font-bold text-[#0A2342] flex items-center gap-2 text-xs sm:text-sm">
                      <span className="flex h-4 w-4 items-center justify-center rounded bg-slate-100 text-[9px] font-bold text-slate-700">PI</span>
                      Tactical PIs (Transition & Control)
                    </h3>
                  </div>
                  <div className="space-y-1.5 Pl-1">
                    <MetricRow label="Counter attacks" {...getPiStats("counterAttacks")} />
                    <MetricRow label="Turnovers" {...getPiStats("turnovers")} />
                    <MetricRow label="Transition passes" {...getPiStats("transitionPasses")} />
                    <MetricRow label="Team Possession Rate" {...getPiStats("possessionRate")} unit="%" />
                    <MetricRow label="Total Completed Passes" {...getPiStats("passes")} />
                    <MetricRow label="Passes in Opponents Half" {...getPiStats("passesInOpponentHalf")} />
                    <MetricRow label="Passes in Final Third" {...getPiStats("finalThirdPasses")} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs">
                  <div className="border-b border-[#E2E8F0] pb-3 mb-4">
                    <h3 className="font-display font-bold text-[#0A2342] flex items-center gap-2 text-xs sm:text-sm">
                      <span className="flex h-4 w-4 items-center justify-center rounded bg-[#1D4ED8] text-[9px] font-bold text-white">KPI</span>
                      Set Piece KPIs
                    </h3>
                  </div>
                  <div className="space-y-1.5 Pl-1">
                    <MetricRow label="Set Piece xG" {...getKpiStats("setPieceXg")} />
                    <MetricRow label="Set Piece xG Allowed" {...getKpiStats("setPieceXgAllowed")} />
                    <MetricRow label="Free kick Goal conversion" {...getKpiStats("freeKickGoalConversion")} unit="%" />
                    <MetricRow label="Fouls committed average" {...getKpiStats("foulCommittedAvg")} />
                    <MetricRow label="Direct Free Kick Success rate" {...getKpiStats("directFreeKickSuccess")} unit="%" />
                    <MetricRow label="Free kick Crossing accuracy" {...getKpiStats("freeKickCrossingAccuracy")} unit="%" />
                    <MetricRow label="Corner to Shot rate" {...getKpiStats("cornerToShotRate")} unit="%" />
                    <MetricRow label="Corner to Shot Allowed rate" {...getKpiStats("cornerToShotAllowedRate")} unit="%" />
                    <MetricRow label="Corner to clearance rate" {...getKpiStats("cornerToClearanceRate")} unit="%" />
                  </div>
                </div>

                <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs">
                  <div className="border-b border-[#E2E8F0] pb-3 mb-4">
                    <h3 className="font-display font-bold text-[#0A2342] flex items-center gap-2 text-xs sm:text-sm">
                      <span className="flex h-4 w-4 items-center justify-center rounded bg-slate-100 text-[9px] font-bold text-slate-700">PI</span>
                      Set Piece PIs
                    </h3>
                  </div>
                  <div className="space-y-1.5 Pl-1">
                    <MetricRow label="Corners" {...getPiStats("corners")} />
                    <MetricRow label="Free kicks" {...getPiStats("freeKicks")} />
                    <MetricRow label="Long Throws" {...getPiStats("longThrows")} />
                    <MetricRow label="Direct Free Kicks Attempted" {...getPiStats("directFreeKick")} />
                    <MetricRow label="Free Kick Crosses Attempted" {...getPiStats("freeKickCrosses")} />
                    <MetricRow label="Corners resulting in Shot" {...getPiStats("cornerToShot")} />
                    <MetricRow label="Opponent Corners resulting in Shot" {...getPiStats("cornerToShotAllowed")} />
                    <MetricRow label="Corners cleared" {...getPiStats("cornerToClearance")} />
                  </div>
                </div>
              </div>
            )}

            {/* Performance Trend Graph identical to TeamDashboard */}
            {chronologicalMetrics.length > 0 && (
              <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs no-print">
                <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3 mb-4">
                  <h3 className="font-display font-bold text-[#0A2342] text-xs sm:text-sm flex items-center gap-2">
                    <Layers className="h-4 w-4 text-[#1D4ED8]" />
                    Performance Chronological Trend ({selectedOpponentName})
                  </h3>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chronologicalMetrics}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#64748B" }} stroke="#CBD5E1" />
                      <YAxis yAxisId="left" tick={{ fontSize: 9, fill: "#64748B" }} stroke="#1D4ED8" />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: "#64748B" }} stroke="#10B981" />
                      <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderColor: "#E2E8F0", fontSize: 11 }} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Line yAxisId="left" type="monotone" dataKey="Shots" stroke="#1D4ED8" strokeWidth={2} name="Shots Attempted" activeDot={{ r: 5 }} />
                      <Line yAxisId="right" type="monotone" dataKey="Attack xG" stroke="#10B981" strokeWidth={2} name="Goals Scored" />
                      <Line yAxisId="left" type="monotone" dataKey="Recoveries" stroke="#EF4444" strokeWidth={1.5} name="Ball Recoveries" />
                      <Line yAxisId="right" type="monotone" dataKey="Corners" stroke="#F59E0B" strokeWidth={1.5} name="Corners Won" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
          )}
        </div>
      </div>
    );
  }

  // Render 3: Advanced comparison mode between 2 teams
  if (activeSubView === "comparison") {
    // Determine category specific radar and side-by-side data lists
    const isCategoryAtt = radarCategory === "General";
    const isCategoryTac = radarCategory === "Tactical Stats";
    const isCategorySet = radarCategory === "Set Pieces";

    const getCompKpiStats = (key: string) => {
      const valA = getKpiVal(statsA, key);
      const valB = getKpiVal(statsB, key);
      return { A: valA, B: valB };
    };

    const getCompPiStats = (key: string) => {
      const valA = getPiVal(statsA, key);
      const valB = getPiVal(statsB, key);
      return { A: valA, B: valB };
    };

    return (
      <div className="space-y-6 animate-fadeIn" id="opponent-comparison-view">
        {/* Navigation Breadcrumb */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#E2E8F0] pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveSubView("standings")}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Return to standings"
            >
              <ArrowLeft className="h-5 w-5 text-[#0A2342]" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-[#0A2342] text-white px-2 py-0.5 rounded font-mono font-bold tracking-wider uppercase">
                  ⚔️ Matchup comparison
                </span>
                <span className="text-xs text-slate-400 font-bold">CCFL Division Scouting</span>
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#0A2342] mt-0.5">
                {compareTeamA} <span className="text-slate-400 font-normal">vs</span> {compareTeamB}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg p-1 shadow-2xs no-print">
            {[
              { id: "General", label: "General" },
              { id: "Tactical Stats", label: "Tactical" },
              { id: "Set Pieces", label: "Set Piece" }
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setRadarCategory(cat.id as TabType)}
                className={`px-3 py-1 text-xs font-bold rounded transition-all cursor-pointer ${
                  radarCategory === cat.id
                    ? "bg-[#0A2342] text-white shadow-xs"
                    : "text-slate-600 hover:text-[#0A2342] hover:bg-slate-200/50"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Head-to-Head Radar Section */}
        <div className="grid gap-6 lg:grid-cols-3">
          
          {/* Radar Chart Card */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs lg:col-span-2 flex flex-col justify-between">
            <div>
              <h3 className="font-display font-extrabold text-[#0A2342] text-xs sm:text-sm flex items-center justify-between border-b border-[#E2E8F0] pb-3 mb-4">
                <span className="flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4 text-[#1D4ED8]" />
                  KPI Comparative Spider Radar
                </span>
                <span className="text-[10.5px] font-mono text-[#1D4ED8] uppercase tracking-wider font-bold">
                  {radarCategory} Category
                </span>
              </h3>
            </div>

            <div className="h-72 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                  <PolarGrid stroke="#E2E8F0" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: "#64748B", fontSize: 10, fontWeight: 600 }} />
                  <PolarRadiusAxis stroke="#CBD5E1" angle={30} domain={[0, 100]} tick={{ fill: "#64748B", fontSize: 8 }} />
                  <Radar name={compareTeamA} dataKey="A" stroke="#1D4ED8" fill="#1D4ED8" fillOpacity={0.35} strokeWidth={2} />
                  <Radar name={compareTeamB} dataKey="B" stroke="#EF4444" fill="#EF4444" fillOpacity={0.35} strokeWidth={2} />
                  <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderColor: "#E2E8F0", fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Key Differences Briefing Card */}
          <div className="rounded-xl border border-[#E2E8F0] bg-[#0A2342] p-5 shadow-xs text-white flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-1.5 border-b border-white/10 pb-2">
                <Sparkles className="h-4.5 w-4.5 text-emerald-400" />
                <h3 className="text-xs font-mono font-bold tracking-wider uppercase text-emerald-400">Head-to-Head Briefing</h3>
              </div>

              <div className="space-y-3.5 text-xs text-[#E2E8F0]">
                <div>
                  <p className="font-bold text-white text-[11px] uppercase tracking-wider mb-1 font-sans">{compareTeamA} Playstyle</p>
                  <p className="leading-relaxed text-[10.5px] text-slate-300">
                    Averages <strong className="text-white">{statsA.avg.goals?.toFixed(1) || "0.0"} goals</strong> and <strong className="text-white">{statsA.avg.shots?.toFixed(1) || "0.0"} shots</strong> per match. Possession rate is <strong className="text-white">{statsA.avg.possessionRate?.toFixed(1) || "50"}%</strong> with a defensive duel win rate of <strong className="text-white">{statsA.def.defensiveDuelWinRate?.toFixed(1) || "50"}%</strong>.
                  </p>
                </div>

                <div className="border-t border-white/10 pt-3">
                  <p className="font-bold text-white text-[11px] uppercase tracking-wider mb-1 font-sans">{compareTeamB} Playstyle</p>
                  <p className="leading-relaxed text-[10.5px] text-slate-300">
                    Averages <strong className="text-white">{statsB.avg.goals?.toFixed(1) || "0.0"} goals</strong> and <strong className="text-white">{statsB.avg.shots?.toFixed(1) || "0.0"} shots</strong> per match. Possession rate is <strong className="text-white">{statsB.avg.possessionRate?.toFixed(1) || "50"}%</strong> with a defensive duel win rate of <strong className="text-white">{statsB.def.defensiveDuelWinRate?.toFixed(1) || "50"}%</strong>.
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 pt-3 text-[10px] text-slate-400 flex items-start gap-1.5 mt-4">
              <AlertCircle className="h-4 w-4 text-slate-400 shrink-0" />
              <span>Use these spider overlays to adjust passing patterns, high press triggers, or corner positioning.</span>
            </div>
          </div>
        </div>

        {/* Side-by-Side Detailed Comparison Grid matching "모든 항목을 다 보여줘" */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden shadow-xs">
          <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] px-4 py-3 flex items-center justify-between">
            <h3 className="font-display font-extrabold text-[#0A2342] text-xs sm:text-sm flex items-center gap-1.5">
              <Shield className="h-4.5 w-4.5 text-[#1D4ED8]" />
              Detailed Side-by-Side Analysis Grid
            </h3>
          </div>

          <div className="divide-y divide-slate-150">
            {/* Header row */}
            <div className="grid grid-cols-4 bg-slate-50 text-[10px] uppercase font-extrabold text-slate-500 py-2.5 px-4 font-sans tracking-wider border-b border-slate-200">
              <div className="col-span-2">Performance Variable / Metric</div>
              <div className="text-center text-[#1D4ED8]">{compareTeamA} (A)</div>
              <div className="text-center text-red-600">{compareTeamB} (B)</div>
            </div>

            {/* General (Attack & Defense) Grid */}
            {isCategoryAtt && (
              <>
                <div className="bg-blue-50/25 px-4 py-1.5 text-[10px] font-extrabold text-[#1D4ED8] uppercase tracking-widest font-mono">KPI Measures</div>
                <CompMetricRow label="Expected Goals (xG)" {...getCompKpiStats("xG")} />
                <CompMetricRow label="Shot accuracy Total (Inside/outside the box)" {...getCompKpiStats("shotAccuracyTotal")} unit="%" />
                <CompMetricRow label="Shot accuracy excluding blocked shots" {...getCompKpiStats("shotAccuracyExclBlocked")} unit="%" />
                <CompMetricRow label="Goal conversion rate" {...getCompKpiStats("goalConversion")} unit="%" />
                <CompMetricRow label="Shots outside the box proportion" {...getCompKpiStats("shotsOutsideBoxProp")} unit="%" />
                <CompMetricRow label="Shots inside the box proportion" {...getCompKpiStats("shotsInsideBoxProp")} unit="%" />
                <CompMetricRow label="Tackle success rate" {...getCompKpiStats("tackleSuccessRate")} unit="%" />
                <CompMetricRow label="Defensive Duel Win rate" {...getCompKpiStats("defensiveDuelWinRate")} unit="%" />
                
                <div className="bg-slate-50 px-4 py-1.5 text-[10px] font-extrabold text-[#0A2342] uppercase tracking-widest font-mono">Performance Indicators (PI)</div>
                <CompMetricRow label="Goals Scored" {...getCompPiStats("goals")} />
                <CompMetricRow label="Shots Attempted" {...getCompPiStats("shots")} />
                <CompMetricRow label="Shots On Target" {...getCompPiStats("shotsOnTarget")} />
                <CompMetricRow label="Blocked Shots" {...getCompPiStats("blockedShots")} />
                <CompMetricRow label="Headed Shots" {...getCompPiStats("headedShots")} />
                <CompMetricRow label="Shots Inside the Box" {...getCompPiStats("insideBoxShots")} />
                <CompMetricRow label="Shots Outside the Box" {...getCompPiStats("shotsOutsideBox")} />
                <CompMetricRow label="Tackles Attempted" {...getCompPiStats("tackles")} />
                <CompMetricRow label="Clearances" {...getCompPiStats("clearances")} />
                <CompMetricRow label="Interceptions" {...getCompPiStats("interceptions")} />
                <CompMetricRow label="Blocked Opponent Shots" {...getCompPiStats("blocks")} />
                <CompMetricRow label="Ball Recoveries" {...getCompPiStats("ballRecoveries")} />
                <CompMetricRow label="Yellow Cards" {...getCompPiStats("yellowCards")} />
                <CompMetricRow label="Red Cards" {...getCompPiStats("redCard")} />
              </>
            )}

            {/* Tactical Stats Grid */}
            {isCategoryTac && (
              <>
                <div className="bg-blue-50/25 px-4 py-1.5 text-[10px] font-extrabold text-[#1D4ED8] uppercase tracking-widest font-mono">KPI Measures</div>
                <CompMetricRow label="Pass accuracy" {...getCompKpiStats("passAccuracy")} unit="%" />
                <CompMetricRow label="Long passes accuracy" {...getCompKpiStats("longPassesAccuracy")} unit="%" />
                <CompMetricRow label="Passing accuracy in opponents half" {...getCompKpiStats("passesInOpponentHalfAccuracy")} unit="%" />
                <CompMetricRow label="Passing accuracy in final third" {...getCompKpiStats("passesInFinalThirdAccuracy")} unit="%" />
                <CompMetricRow label="Crossing accuracy" {...getCompKpiStats("crossingAccuracy")} unit="%" />
                <CompMetricRow label="Open play crossing accuracy" {...getCompKpiStats("openPlayCrossingAccuracy")} unit="%" />
                <CompMetricRow label="Long passes Proportion" {...getCompKpiStats("longPassesProp")} unit="%" />
                <CompMetricRow label="Forward passes proportion" {...getCompKpiStats("forwardPassesProp")} unit="%" />
                <CompMetricRow label="Key Passes proportion" {...getCompKpiStats("keyPassesProp")} unit="%" />
                <CompMetricRow label="Counter attack Shot proportion" {...getCompKpiStats("counterAttackShotProp")} unit="%" />
                <CompMetricRow label="Counter attack shot accuracy" {...getCompKpiStats("counterAttackShotAccuracy")} unit="%" />
                <CompMetricRow label="Possession Value (PV)" {...getCompKpiStats("possessionValue")} />

                <div className="bg-slate-50 px-4 py-1.5 text-[10px] font-extrabold text-[#0A2342] uppercase tracking-widest font-mono">Performance Indicators (PI)</div>
                <CompMetricRow label="Team Possession Rate" {...getCompPiStats("possessionRate")} unit="%" />
                <CompMetricRow label="Total Completed Passes" {...getCompPiStats("passes")} />
                <CompMetricRow label="Key Passes Completed" {...getCompPiStats("keyPasses")} />
                <CompMetricRow label="Long Passes Completed" {...getCompPiStats("longPasses")} />
                <CompMetricRow label="Passes in Opponents Half" {...getCompPiStats("passesInOpponentHalf")} />
                <CompMetricRow label="Passes in Final Third" {...getCompPiStats("finalThirdPasses")} />
                <CompMetricRow label="Forward Oriented Passes" {...getCompPiStats("forwardPasses")} />
                <CompMetricRow label="Through Balls" {...getCompPiStats("throughBalls")} />
                <CompMetricRow label="Crosses Completed" {...getCompPiStats("crosses")} />
                <CompMetricRow label="Open Play Crosses" {...getCompPiStats("openPlayCrosses")} />
                <CompMetricRow label="Ball Recoveries" {...getCompPiStats("ballRecoveries")} />
                <CompMetricRow label="Counter Attacks Triggered" {...getCompPiStats("counterAttacks")} />
                <CompMetricRow label="Turnovers" {...getCompPiStats("turnovers")} />
                <CompMetricRow label="Transition Passes Completed" {...getCompPiStats("transitionPasses")} />
              </>
            )}

            {/* Set Pieces Grid */}
            {isCategorySet && (
              <>
                <div className="bg-blue-50/25 px-4 py-1.5 text-[10px] font-extrabold text-[#1D4ED8] uppercase tracking-widest font-mono">KPI Measures</div>
                <CompMetricRow label="Set Piece Expected Goals (xG)" {...getCompKpiStats("setPieceXg")} />
                <CompMetricRow label="Set Piece xG Allowed" {...getCompKpiStats("setPieceXgAllowed")} />
                <CompMetricRow label="Free kick Goal conversion" {...getCompKpiStats("freeKickGoalConversion")} unit="%" />
                <CompMetricRow label="Fouls committed average" {...getCompKpiStats("foulCommittedAvg")} />
                <CompMetricRow label="Direct Free Kick Success rate" {...getCompKpiStats("directFreeKickSuccess")} unit="%" />
                <CompMetricRow label="Free kick Crossing accuracy" {...getCompKpiStats("freeKickCrossingAccuracy")} unit="%" />
                <CompMetricRow label="Corner to Shot rate" {...getCompKpiStats("cornerToShotRate")} unit="%" />
                <CompMetricRow label="Corner to Shot Allowed rate" {...getCompKpiStats("cornerToShotAllowedRate")} unit="%" />
                <CompMetricRow label="Corner to clearance rate" {...getCompKpiStats("cornerToClearanceRate")} unit="%" />

                <div className="bg-slate-50 px-4 py-1.5 text-[10px] font-extrabold text-[#0A2342] uppercase tracking-widest font-mono">Performance Indicators (PI)</div>
                <CompMetricRow label="Corners Awarded" {...getCompPiStats("corners")} />
                <CompMetricRow label="Free kicks Awarded" {...getCompPiStats("freeKicks")} />
                <CompMetricRow label="Long Throws Made" {...getCompPiStats("longThrows")} />
                <CompMetricRow label="Direct Free Kicks Attempted" {...getCompPiStats("directFreeKick")} />
                <CompMetricRow label="Free Kick Crosses Attempted" {...getCompPiStats("freeKickCrosses")} />
                <CompMetricRow label="Corners resulting in Shot" {...getCompPiStats("cornerToShot")} />
                <CompMetricRow label="Opponent Corners resulting in Shot" {...getCompPiStats("cornerToShotAllowed")} />
                <CompMetricRow label="Corners cleared" {...getCompPiStats("cornerToClearance")} />
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// Helper: Custom Row showing single Metric value with its Average / Total
function MetricRow({ label, avg, total, unit = "" }: { label: string; avg: string; total: string; unit?: string }) {
  return (
    <div className="flex items-center border-b border-slate-800/80 py-1.5 last:border-0" id={`opp-metric-row-${label.replace(/\s+/g, '-')}`}>
      <div className="flex items-center flex-1 min-w-0 mr-2">
        <span className="text-xs font-semibold text-slate-300 truncate">{label}</span>
        <div className="flex-1 border-b border-dotted border-slate-700 mx-1.5 self-end mb-1" />
      </div>
      <div className="flex items-center gap-1.5 shrink-0 text-xs font-mono">
        <span className="text-[13px] font-bold text-cyan-400" title="Average">{avg}{unit}</span>
        <span className="text-slate-600 text-[10px]">/</span>
        <span className="text-xs font-medium text-slate-200" title="Total">{total}</span>
      </div>
    </div>
  );
}

// Helper: Custom grid row comparing Team A vs Team B values
interface CompMetricValue {
  avg: string;
  total: string;
}

function CompMetricRow({ label, A, B, unit = "" }: { label: string; A: CompMetricValue; B: CompMetricValue; unit?: string }) {
  const numA = Number(A.avg);
  const numB = Number(B.avg);

  // Styling highlight for the better performing team
  const isABetter = numA > numB;
  const isBBetter = numB > numA;

  return (
    <div className="grid grid-cols-4 text-xs font-sans text-slate-300 py-2 px-4 hover:bg-slate-800/40 transition-colors">
      <div className="col-span-2 font-medium text-slate-300">{label}</div>
      <div className="text-center font-mono flex items-center justify-center gap-1">
        <span className={isABetter ? "text-cyan-400 font-extrabold" : "text-slate-300 font-medium"}>
          {A.avg}{unit}
        </span>
        <span className="text-[10px] text-slate-500">({A.total})</span>
      </div>
      <div className="text-center font-mono flex items-center justify-center gap-1 border-l border-slate-800">
        <span className={isBBetter ? "text-rose-400 font-extrabold" : "text-slate-300 font-medium"}>
          {B.avg}{unit}
        </span>
        <span className="text-[10px] text-slate-500">({B.total})</span>
      </div>
    </div>
  );
}
