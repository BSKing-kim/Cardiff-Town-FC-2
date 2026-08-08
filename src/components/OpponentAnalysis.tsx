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
        {/* Navigation Breadcrumb */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-800 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveSubView("standings")}
              className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors cursor-pointer text-cyan-400 hover:text-white"
              title="Return to standings"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-gray-800 border border-gray-700 px-2 py-0.5 rounded uppercase font-bold text-gray-300 font-mono">
                  Scouting Profile
                </span>
                <span className="text-xs text-gray-400 font-bold">CCFL {LEAGUES[activeLeagueIdx]}</span>
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white mt-0.5">
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
                  ? "bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed opacity-50"
                  : "bg-cyan-700 border-cyan-600 text-white hover:bg-cyan-600"
              }`}
            >
              <Printer className="h-3.5 w-3.5 text-amber-400" />
              <span>PDF</span>
            </button>
          </div>
        </div>

        {/* Tab Controls mirroring TeamDashboard */}
        <div className="flex border-b border-gray-800 gap-1 overflow-x-auto whitespace-nowrap scrollbar-none no-print" id="detailed-tabs">
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
                    ? "border-cyan-400 text-cyan-400 font-bold bg-cyan-950/40 rounded-t"
                    : "border-transparent text-gray-400 hover:text-white hover:border-gray-600"
                }`}
              >
                <Icon className={`h-4 w-4 ${activeTab === tab.id ? "text-cyan-400" : "text-gray-400"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Detailed Metrics Content identical to TeamDashboard */}
        <div className="space-y-6">
          {oppMatchesList.length === 0 && !isOurSelected && (
            <div className="rounded-xl border border-amber-900/60 bg-amber-950/30 p-4 flex gap-3 text-xs leading-relaxed text-amber-200 shadow-xs animate-fadeIn no-print" id="empty-scouting-data-banner">
              <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
              <div className="font-sans">
                <p className="font-bold uppercase tracking-wider text-amber-300 text-[10px]">No Match Data Uploaded</p>
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
                <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 shadow-xl">
                  <div className="border-b border-gray-800 pb-3 mb-4">
                    <h3 className="font-display font-extrabold text-white text-xs sm:text-sm flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-cyan-400" />
                      Shots & Conversion Metrics
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-[10px] font-bold text-cyan-400 bg-cyan-950/60 border border-cyan-800 px-2 py-0.5 rounded-sm uppercase tracking-wider mb-2.5 inline-flex items-center gap-1">
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
                      <h4 className="text-[10px] font-bold text-gray-300 bg-gray-800 border border-gray-700 px-2 py-0.5 rounded-sm uppercase tracking-wider mb-2.5 inline-flex items-center gap-1">
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
                <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 shadow-xl">
                  <div className="border-b border-gray-800 pb-3 mb-4">
                    <h3 className="font-display font-extrabold text-white text-xs sm:text-sm flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      Pass Accuracy & Distribution
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-[10px] font-bold text-cyan-400 bg-cyan-950/60 border border-cyan-800 px-2 py-0.5 rounded-sm uppercase tracking-wider mb-2.5 inline-flex items-center gap-1">
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
                      <h4 className="text-[10px] font-bold text-gray-300 bg-gray-800 border border-gray-700 px-2 py-0.5 rounded-sm uppercase tracking-wider mb-2.5 inline-flex items-center gap-1">
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
                <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 shadow-xl">
                  <div className="border-b border-gray-800 pb-3 mb-4">
                    <h3 className="font-display font-extrabold text-white text-xs sm:text-sm flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-rose-400" />
                      Distribution & Defending Block
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-[10px] font-bold text-cyan-400 bg-cyan-950/60 border border-cyan-800 px-2 py-0.5 rounded-sm uppercase tracking-wider mb-2.5 inline-flex items-center gap-1">
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
                      <h4 className="text-[10px] font-bold text-gray-300 bg-gray-800 border border-gray-700 px-2 py-0.5 rounded-sm uppercase tracking-wider mb-2.5 inline-flex items-center gap-1">
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
                <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 shadow-xl">
                  <div className="border-b border-gray-800 pb-3 mb-4">
                    <h3 className="font-display font-bold text-white flex items-center gap-2 text-xs sm:text-sm">
                      <span className="flex h-4 w-4 items-center justify-center rounded bg-cyan-600 text-[9px] font-bold text-white">KPI</span>
                      Tactical KPIs
                    </h3>
                  </div>
                  <div className="space-y-1.5 pl-1">
                    <MetricRow label="Goal conversion" {...getKpiStats("goalConversion")} unit="%" />
                    <MetricRow label="Shot accuracy" {...getKpiStats("shotAccuracyTotal")} unit="%" />
                    <MetricRow label="Counter attack Shot proportion" {...getKpiStats("counterAttackShotProp")} unit="%" />
                    <MetricRow label="Counter attack shot accuracy" {...getKpiStats("counterAttackShotAccuracy")} unit="%" />
                    <MetricRow label="Possession Value (PV)" {...getKpiStats("possessionValue")} />
                  </div>
                </div>

                <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 shadow-xl">
                  <div className="border-b border-gray-800 pb-3 mb-4">
                    <h3 className="font-display font-bold text-white flex items-center gap-2 text-xs sm:text-sm">
                      <span className="flex h-4 w-4 items-center justify-center rounded bg-gray-800 text-[9px] font-bold text-gray-300 border border-gray-700">PI</span>
                      Tactical PIs (Transition & Control)
                    </h3>
                  </div>
                  <div className="space-y-1.5 pl-1">
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
                <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 shadow-xl">
                  <div className="border-b border-gray-800 pb-3 mb-4">
                    <h3 className="font-display font-bold text-white flex items-center gap-2 text-xs sm:text-sm">
                      <span className="flex h-4 w-4 items-center justify-center rounded bg-cyan-600 text-[9px] font-bold text-white">KPI</span>
                      Set Piece KPIs
                    </h3>
                  </div>
                  <div className="space-y-1.5 pl-1">
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

                <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 shadow-xl">
                  <div className="border-b border-gray-800 pb-3 mb-4">
                    <h3 className="font-display font-bold text-white flex items-center gap-2 text-xs sm:text-sm">
                      <span className="flex h-4 w-4 items-center justify-center rounded bg-gray-800 text-[9px] font-bold text-gray-300 border border-gray-700">PI</span>
                      Set Piece PIs
                    </h3>
                  </div>
                  <div className="space-y-1.5 pl-1">
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
              <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 shadow-xl no-print">
                <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-4">
                  <h3 className="font-display font-bold text-white text-xs sm:text-sm flex items-center gap-2">
                    <Layers className="h-4 w-4 text-cyan-400" />
                    Performance Chronological Trend ({selectedOpponentName})
                  </h3>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chronologicalMetrics}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9CA3AF" }} stroke="#4B5563" />
                      <YAxis yAxisId="left" tick={{ fontSize: 9, fill: "#9CA3AF" }} stroke="#38BDF8" />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: "#9CA3AF" }} stroke="#34D399" />
                      <Tooltip contentStyle={{ backgroundColor: "#111827", borderColor: "#374151", color: "#F3F4F6", fontSize: 11 }} />
                      <Legend wrapperStyle={{ fontSize: 10, color: "#9CA3AF" }} />
                      <Line yAxisId="left" type="monotone" dataKey="Shots" stroke="#38BDF8" strokeWidth={2} name="Shots Attempted" activeDot={{ r: 5 }} />
                      <Line yAxisId="right" type="monotone" dataKey="Attack xG" stroke="#34D399" strokeWidth={2} name="Goals Scored" />
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
    const getTeamTotals = (teamMatches: MatchData[]) => {
      return teamMatches.reduce((acc, m: any) => {
        acc.goals += Number(m.goals ?? m.our_score ?? m.ourScore ?? 0);
        acc.shots += Number(m.shots || 0);
        acc.shots_on_target += Number(m.shots_on_target || m.shotsOnTarget || 0);
        acc.passes += Number(m.passes || m.total_passes || m.totalPasses || 0);
        acc.successful_passes += Number(m.successful_passes || m.completed_passes || m.successfulPasses || 0);
        acc.backwards_passes += Number(m.backwards_passes || m.backwardsPasses || 0);
        acc.forwards_passes += Number(m.forwards_passes || m.forwardsPasses || 0);
        acc.long_passes += Number(m.long_passes || m.longPasses || 0);
        acc.key_passes += Number(m.key_passes || m.keyPasses || 0);
        acc.through_balls += Number(m.through_balls || m.throughBalls || 0);
        acc.crosses += Number(m.crosses || 0);
        acc.successful_crosses += Number(m.successful_crosses || m.successfulCrosses || 0);
        acc.dribbles += Number(m.dribbles || 0);
        acc.successful_dribbles += Number(m.successful_dribbles || m.successfulDribbles || 0);
        acc.duels += Number(m.duels || 0);
        acc.duels_won += Number(m.duels_won || m.duelsWon || 0);
        acc.aerial_duels += Number(m.aerial_duels || m.aerialDuels || 0);
        acc.aerial_duels_won += Number(m.aerial_duels_won || m.aerialDuelsWon || 0);
        acc.ground_duels += Number(m.ground_duels || m.groundDuels || 0);
        acc.ground_duels_won += Number(m.ground_duels_won || m.groundDuelsWon || 0);
        acc.ball_recoveries += Number(m.ball_recoveries || m.ballRecoveries || 0);
        acc.tackles += Number(m.tackles || 0);
        acc.tackles_won += Number(m.tackles_won || m.tacklesWon || 0);
        acc.interceptions += Number(m.interceptions || 0);
        acc.clearances += Number(m.clearances || 0);
        acc.blocks += Number(m.blocks || 0);
        acc.own_goals += Number(m.own_goals || m.ownGoals || 0);
        acc.turnovers += Number(m.turnovers || 0);
        acc.miscontrols += Number(m.miscontrols || m.miscontrol || 0);
        acc.unsuccessful_dribbles += Number(m.unsuccessful_dribbles || m.unsuccessfulDribbles || 0);
        acc.possession_lost += Number(m.possession_lost || m.possessionLost || 0);
        acc.offsides += Number(m.offsides || m.offside || 0);
        acc.fouls += Number(m.fouls || 0);
        acc.yellow_cards += Number(m.yellow_cards || m.yellowCards || 0);
        acc.red_cards += Number(m.red_cards || m.redCards || 0);
        return acc;
      }, {
        goals: 0, shots: 0, shots_on_target: 0, passes: 0, successful_passes: 0,
        backwards_passes: 0, forwards_passes: 0, long_passes: 0, key_passes: 0,
        through_balls: 0, crosses: 0, successful_crosses: 0, dribbles: 0,
        successful_dribbles: 0, duels: 0, duels_won: 0, aerial_duels: 0,
        aerial_duels_won: 0, ground_duels: 0, ground_duels_won: 0, ball_recoveries: 0,
        tackles: 0, tackles_won: 0, interceptions: 0, clearances: 0, blocks: 0,
        own_goals: 0, turnovers: 0, miscontrols: 0, unsuccessful_dribbles: 0,
        possession_lost: 0, offsides: 0, fouls: 0, yellow_cards: 0, red_cards: 0
      });
    };

    const totalsA = getTeamTotals(statsA.matches);
    const totalsB = getTeamTotals(statsB.matches);
    const countA = statsA.matches.length || 1;
    const countB = statsB.matches.length || 1;

    const safePct = (num: number, den: number) => den > 0 ? Number(((num / den) * 100).toFixed(1)) : 0;
    const safeAvg = (sum: number, count: number) => (count > 0 ? sum / count : 0).toFixed(1);

    const dynamicRadarData = [
      { subject: "Shot Accuracy", A: safePct(totalsA.shots_on_target, totalsA.shots), B: safePct(totalsB.shots_on_target, totalsB.shots), fullMark: 100 },
      { subject: "Goal Conversion", A: safePct(totalsA.goals, totalsA.shots), B: safePct(totalsB.goals, totalsB.shots), fullMark: 100 },
      { subject: "Pass Accuracy", A: safePct(totalsA.successful_passes, totalsA.passes), B: safePct(totalsB.successful_passes, totalsB.passes), fullMark: 100 },
      { subject: "Duel Won %", A: safePct(totalsA.duels_won, totalsA.duels), B: safePct(totalsB.duels_won, totalsB.duels), fullMark: 100 },
      { subject: "Tackle Won %", A: safePct(totalsA.tackles_won, totalsA.tackles), B: safePct(totalsB.tackles_won, totalsB.tackles), fullMark: 100 },
      { subject: "Cross Suc %", A: safePct(totalsA.successful_crosses, totalsA.crosses), B: safePct(totalsB.successful_crosses, totalsB.crosses), fullMark: 100 },
    ];

    return (
      <div className="space-y-6 animate-fadeIn text-gray-200" id="opponent-comparison-view">
        {/* Navigation Breadcrumb */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-800 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveSubView("standings")}
              className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors cursor-pointer text-cyan-400 hover:text-white"
              title="Return to standings"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-cyan-950/80 border border-cyan-500/40 text-cyan-400 px-2 py-0.5 rounded font-mono font-bold tracking-wider uppercase">
                  ⚔️ Matchup Comparison
                </span>
                <span className="text-xs text-gray-400 font-bold">CCFL Division Scouting</span>
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white mt-0.5">
                {compareTeamA} <span className="text-gray-400 font-normal">vs</span> {compareTeamB}
              </h2>
            </div>
          </div>
        </div>

        {/* Head-to-Head Radar Section */}
        <div className="grid gap-6 lg:grid-cols-3">
          
          {/* Radar Chart Card */}
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 shadow-xl lg:col-span-2 flex flex-col justify-between">
            <div>
              <h3 className="font-display font-extrabold text-white text-xs sm:text-sm flex items-center justify-between border-b border-gray-800 pb-3 mb-4">
                <span className="flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4 text-cyan-400" />
                  KPI Comparative Spider Radar
                </span>
                <span className="text-[10.5px] font-mono text-cyan-400 uppercase tracking-wider font-bold">
                  6 Core Metrics %
                </span>
              </h3>
            </div>

            <div className="h-72 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={dynamicRadarData}>
                  <PolarGrid stroke="#4B5563" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: "#9CA3AF", fontSize: 10, fontWeight: 600 }} />
                  <PolarRadiusAxis stroke="#4B5563" angle={30} domain={[0, 100]} tick={{ fill: "#9CA3AF", fontSize: 8 }} />
                  <Radar name={compareTeamA} dataKey="A" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.35} strokeWidth={2} />
                  <Radar name={compareTeamB} dataKey="B" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.35} strokeWidth={2} />
                  <Tooltip contentStyle={{ backgroundColor: "#111827", borderColor: "#374151", color: "#f3f4f6", fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Key Differences Briefing Card */}
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 shadow-xl text-white flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-1.5 border-b border-gray-800 pb-2">
                <Sparkles className="h-4.5 w-4.5 text-emerald-400" />
                <h3 className="text-xs font-mono font-bold tracking-wider uppercase text-emerald-400">Head-to-Head Briefing</h3>
              </div>

              <div className="space-y-3.5 text-xs text-gray-300">
                <div>
                  <p className="font-bold text-white text-[11px] uppercase tracking-wider mb-1 font-sans">{compareTeamA} Playstyle</p>
                  <p className="leading-relaxed text-[10.5px] text-gray-400">
                    Averages <strong className="text-white">{safeAvg(totalsA.goals, countA)} goals</strong> and <strong className="text-white">{safeAvg(totalsA.shots, countA)} shots</strong> per match. Shot accuracy is <strong className="text-cyan-400">{safePct(totalsA.shots_on_target, totalsA.shots)}%</strong> with pass accuracy of <strong className="text-cyan-400">{safePct(totalsA.successful_passes, totalsA.passes)}%</strong>.
                  </p>
                </div>

                <div className="border-t border-gray-800 pt-3">
                  <p className="font-bold text-white text-[11px] uppercase tracking-wider mb-1 font-sans">{compareTeamB} Playstyle</p>
                  <p className="leading-relaxed text-[10.5px] text-gray-400">
                    Averages <strong className="text-white">{safeAvg(totalsB.goals, countB)} goals</strong> and <strong className="text-white">{safeAvg(totalsB.shots, countB)} shots</strong> per match. Shot accuracy is <strong className="text-rose-400">{safePct(totalsB.shots_on_target, totalsB.shots)}%</strong> with pass accuracy of <strong className="text-rose-400">{safePct(totalsB.successful_passes, totalsB.passes)}%</strong>.
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-800 pt-3 text-[10px] text-gray-400 flex items-start gap-1.5 mt-4">
              <AlertCircle className="h-4 w-4 text-gray-400 shrink-0" />
              <span>Use these spider overlays and match averages to adjust passing patterns, high press triggers, or defensive structure.</span>
            </div>
          </div>
        </div>

        {/* Side-by-Side Detailed Comparison Grid matching full metric view */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden shadow-xl">
          <div className="bg-gray-800/90 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
            <h3 className="font-display font-extrabold text-white text-xs sm:text-sm flex items-center gap-1.5 uppercase tracking-wider">
              <Shield className="h-4.5 w-4.5 text-cyan-400" />
              Detailed Side-by-Side Analysis Grid (Match Averages)
            </h3>
          </div>

          <div className="divide-y divide-gray-800 text-xs font-sans">
            {/* Header row */}
            <div className="grid grid-cols-3 bg-gray-800/60 text-[11px] uppercase font-mono font-bold text-gray-400 py-3 px-4 tracking-wider border-b border-gray-700 text-center">
              <div className="text-cyan-400 font-extrabold">{compareTeamA} (A)</div>
              <div className="text-white">Metric Name</div>
              <div className="text-rose-400 font-extrabold">{compareTeamB} (B)</div>
            </div>

            {/* ATTACK */}
            <div className="bg-slate-950/80 px-4 py-2 text-[11px] font-mono font-black text-amber-400 uppercase tracking-widest border-b border-gray-800">
              ATTACK
            </div>
            <MetricCompRow label="Goals" valA={safeAvg(totalsA.goals, countA)} valB={safeAvg(totalsB.goals, countB)} />
            <MetricCompRow label="Shot" valA={safeAvg(totalsA.shots, countA)} valB={safeAvg(totalsB.shots, countB)} />
            <MetricCompRow label="SOT" valA={safeAvg(totalsA.shots_on_target, countA)} valB={safeAvg(totalsB.shots_on_target, countB)} />

            {/* PASS */}
            <div className="bg-slate-950/80 px-4 py-2 text-[11px] font-mono font-black text-cyan-400 uppercase tracking-widest border-b border-gray-800">
              PASS
            </div>
            <MetricCompRow label="Passes" valA={safeAvg(totalsA.passes, countA)} valB={safeAvg(totalsB.passes, countB)} />
            <MetricCompRow label="Backwards" valA={safeAvg(totalsA.backwards_passes, countA)} valB={safeAvg(totalsB.backwards_passes, countB)} />
            <MetricCompRow label="Forwards" valA={safeAvg(totalsA.forwards_passes, countA)} valB={safeAvg(totalsB.forwards_passes, countB)} />
            <MetricCompRow label="Long Passes" valA={safeAvg(totalsA.long_passes, countA)} valB={safeAvg(totalsB.long_passes, countB)} />
            <MetricCompRow label="Key Passes" valA={safeAvg(totalsA.key_passes, countA)} valB={safeAvg(totalsB.key_passes, countB)} />
            <MetricCompRow label="Through Balls" valA={safeAvg(totalsA.through_balls, countA)} valB={safeAvg(totalsB.through_balls, countB)} />
            <MetricCompRow label="Crosses" valA={safeAvg(totalsA.crosses, countA)} valB={safeAvg(totalsB.crosses, countB)} />

            {/* DRIBBLE */}
            <div className="bg-slate-950/80 px-4 py-2 text-[11px] font-mono font-black text-emerald-400 uppercase tracking-widest border-b border-gray-800">
              DRIBBLE
            </div>
            <MetricCompRow label="Dribbles" valA={safeAvg(totalsA.dribbles, countA)} valB={safeAvg(totalsB.dribbles, countB)} />
            <MetricCompRow label="Dribble Suc" valA={safeAvg(totalsA.successful_dribbles, countA)} valB={safeAvg(totalsB.successful_dribbles, countB)} />

            {/* DUEL */}
            <div className="bg-slate-950/80 px-4 py-2 text-[11px] font-mono font-black text-indigo-400 uppercase tracking-widest border-b border-gray-800">
              DUEL
            </div>
            <MetricCompRow label="Duels" valA={safeAvg(totalsA.duels, countA)} valB={safeAvg(totalsB.duels, countB)} />
            <MetricCompRow label="Duels Won" valA={safeAvg(totalsA.duels_won, countA)} valB={safeAvg(totalsB.duels_won, countB)} />
            <MetricCompRow label="Aerial Duels" valA={safeAvg(totalsA.aerial_duels, countA)} valB={safeAvg(totalsB.aerial_duels, countB)} />
            <MetricCompRow label="Aerial Duels Won" valA={safeAvg(totalsA.aerial_duels_won, countA)} valB={safeAvg(totalsB.aerial_duels_won, countB)} />
            <MetricCompRow label="Ground Duels" valA={safeAvg(totalsA.ground_duels, countA)} valB={safeAvg(totalsB.ground_duels, countB)} />
            <MetricCompRow label="Ground Duel Won" valA={safeAvg(totalsA.ground_duels_won, countA)} valB={safeAvg(totalsB.ground_duels_won, countB)} />

            {/* DEFENSIVE */}
            <div className="bg-slate-950/80 px-4 py-2 text-[11px] font-mono font-black text-blue-400 uppercase tracking-widest border-b border-gray-800">
              DEFENSIVE
            </div>
            <MetricCompRow label="Ball Recovery" valA={safeAvg(totalsA.ball_recoveries, countA)} valB={safeAvg(totalsB.ball_recoveries, countB)} />
            <MetricCompRow label="Tackles" valA={safeAvg(totalsA.tackles, countA)} valB={safeAvg(totalsB.tackles, countB)} />
            <MetricCompRow label="Tackle Won" valA={safeAvg(totalsA.tackles_won, countA)} valB={safeAvg(totalsB.tackles_won, countB)} />
            <MetricCompRow label="Interceptions" valA={safeAvg(totalsA.interceptions, countA)} valB={safeAvg(totalsB.interceptions, countB)} />
            <MetricCompRow label="Clearance" valA={safeAvg(totalsA.clearances, countA)} valB={safeAvg(totalsB.clearances, countB)} />
            <MetricCompRow label="Blocks" valA={safeAvg(totalsA.blocks, countA)} valB={safeAvg(totalsB.blocks, countB)} />

            {/* TURNOVER */}
            <div className="bg-slate-950/80 px-4 py-2 text-[11px] font-mono font-black text-orange-400 uppercase tracking-widest border-b border-gray-800">
              TURNOVER
            </div>
            <MetricCompRow label="Own Goals" valA={safeAvg(totalsA.own_goals, countA)} valB={safeAvg(totalsB.own_goals, countB)} />
            <MetricCompRow label="Turnovers" valA={safeAvg(totalsA.turnovers, countA)} valB={safeAvg(totalsB.turnovers, countB)} />
            <MetricCompRow label="Miscontrol" valA={safeAvg(totalsA.miscontrols, countA)} valB={safeAvg(totalsB.miscontrols, countB)} />
            <MetricCompRow label="Uns Dribble" valA={safeAvg(totalsA.unsuccessful_dribbles, countA)} valB={safeAvg(totalsB.unsuccessful_dribbles, countB)} />
            <MetricCompRow label="Possession Lost" valA={safeAvg(totalsA.possession_lost, countA)} valB={safeAvg(totalsB.possession_lost, countB)} />
            <MetricCompRow label="Offside" valA={safeAvg(totalsA.offsides, countA)} valB={safeAvg(totalsB.offsides, countB)} />

            {/* FOUL */}
            <div className="bg-slate-950/80 px-4 py-2 text-[11px] font-mono font-black text-rose-400 uppercase tracking-widest border-b border-gray-800">
              FOUL
            </div>
            <MetricCompRow label="Fouls" valA={safeAvg(totalsA.fouls, countA)} valB={safeAvg(totalsB.fouls, countB)} />
            <MetricCompRow label="Yellow Card" valA={safeAvg(totalsA.yellow_cards, countA)} valB={safeAvg(totalsB.yellow_cards, countB)} />
            <MetricCompRow label="Red Card" valA={safeAvg(totalsA.red_cards, countA)} valB={safeAvg(totalsB.red_cards, countB)} />
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

// Helper: Custom grid row comparing Team A vs Team B match average values
function MetricCompRow({ label, valA, valB }: { label: string; valA: string; valB: string }) {
  const numA = Number(valA);
  const numB = Number(valB);

  const isABetter = numA > numB;
  const isBBetter = numB > numA;

  return (
    <div className="grid grid-cols-3 text-xs font-sans text-gray-200 py-2.5 px-4 hover:bg-gray-800/50 transition-colors border-b border-gray-800/40 last:border-0 text-center">
      <div className="font-mono text-sm font-bold flex items-center justify-center">
        <span className={isABetter ? "text-cyan-400 font-extrabold" : "text-gray-300 font-medium"}>
          {valA}
        </span>
      </div>
      <div className="font-bold text-gray-200 uppercase tracking-wider text-xs flex items-center justify-center">
        {label}
      </div>
      <div className="font-mono text-sm font-bold flex items-center justify-center">
        <span className={isBBetter ? "text-rose-400 font-extrabold" : "text-gray-300 font-medium"}>
          {valB}
        </span>
      </div>
    </div>
  );
}
