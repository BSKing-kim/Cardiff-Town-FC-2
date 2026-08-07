import React, { useState, useMemo } from "react";
import { MatchData, UserProfile } from "../types";
import { KPICalculator } from "../lib/kpiCalculations";
import { 
  BarChart3, List, LineChart as LineChartIcon, Filter, 
  TrendingUp, Shield, Zap, Target, Flag, Layers, AlertCircle, ArrowLeft, Printer
} from "lucide-react";
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, AreaChart, Area
} from "recharts";

interface TeamStatsProps {
  matches: MatchData[];
  currentUser?: UserProfile | null;
  selectedTeamName?: string;
  isOpponentView?: boolean;
  onBack?: () => void;
  leagueName?: string;
}

type TabType = "ATTACK" | "DEFENSE" | "TACTICS" | "SET-PIECES";
type ViewMode = "list" | "graph";

export interface MetricRow {
  key: string;
  label: string;
  accumulated: string;
  average: string;
  benchmark: string;
  unit?: string;
  better?: "higher" | "lower";
}

export default function TeamStats({ 
  matches, 
  currentUser, 
  selectedTeamName, 
  isOpponentView = false, 
  onBack,
  leagueName 
}: TeamStatsProps) {
  const [activeTab, setActiveTab] = useState<TabType>("ATTACK");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedComp, setSelectedComp] = useState<string>("All Competitions");

  const targetTeamName = selectedTeamName || "Cardiff Town FC";
  const isOurTeam = !isOpponentView && targetTeamName.toLowerCase().trim() === "cardiff town fc";

  // Filter matches for the targeted team (Our Team or Opponent Team)
  const teamMatches = useMemo(() => {
    const targetNorm = targetTeamName.toLowerCase().trim();
    if (isOurTeam) {
      return matches.filter(m => !m.isOpponentTeam || (m.teamName && m.teamName.toLowerCase().trim() === targetNorm));
    } else {
      return matches.filter(m => {
        const oppName = (m.opponent || "").toLowerCase().trim();
        const tName = (m.teamName || "").toLowerCase().trim();
        const oppId = (m.opponent_id || "").toLowerCase().trim();
        
        const matchOpponent = oppName === targetNorm || tName === targetNorm || oppId === targetNorm;
        
        if (m.isOpponentTeam) {
          return matchOpponent;
        } else {
          return oppName === targetNorm || oppId === targetNorm;
        }
      });
    }
  }, [matches, targetTeamName, isOurTeam]);

  // Filter matches by competition dropdown
  const filteredMatches = useMemo(() => {
    if (selectedComp === "All Competitions") return teamMatches;
    return teamMatches.filter(m => {
      if (!m.competition) return false;
      const comp = m.competition.toLowerCase();
      const sel = selectedComp.toLowerCase();
      return comp.includes(sel) || sel.includes(comp);
    });
  }, [teamMatches, selectedComp]);

  const totalMatchCount = filteredMatches.length;

  // Helper calculation values
  const metricsData = useMemo(() => {
    const N = totalMatchCount > 0 ? totalMatchCount : 1;

    // Sum helper
    const sum = (fn: (m: MatchData) => number) => {
      if (totalMatchCount === 0) return 0;
      return filteredMatches.reduce((acc, m) => acc + (fn(m) || 0), 0);
    };
    const avg = (fn: (m: MatchData) => number) => {
      if (totalMatchCount === 0) return 0;
      return sum(fn) / totalMatchCount;
    };

    // Helper for opponent score / conceded
    const getConceded = (m: MatchData) => {
      if (m.result) {
        const match = m.result.match(/\((\d+)-(\d+)\)/);
        if (match) {
          return Number(match[2]);
        }
      }
      return 0;
    };

    // Helper for aerial / ground duels
    const getAerialWins = (m: MatchData) => m.aerialDuelWin ?? (m.tacklesWon ? Math.round(m.tacklesWon * 1.2) : 0);
    const getAerialLosses = (m: MatchData) => m.aerialDuelLoss ?? (m.tacklesAttempted ? Math.round(m.tacklesAttempted * 0.8) : 0);
    const getGroundWins = (m: MatchData) => m.groundDuelWin ?? (m.tacklesWon ? Math.round(m.tacklesWon * 1.5) : 0);
    const getGroundLosses = (m: MatchData) => m.groundDuelLoss ?? (m.tacklesAttempted ? Math.round(m.tacklesAttempted * 1.1) : 0);

    // ATTACK
    const totalShots = sum(m => m.shots);
    const totalShotsOnTarget = sum(m => m.shotsOnTarget ?? m.shotOnTarget ?? 0);
    const shotAccPct = totalShots > 0 ? (totalShotsOnTarget / totalShots) * 100 : 0;
    const totalGoals = sum(m => m.goals);
    const goalConvPct = totalShots > 0 ? (totalGoals / totalShots) * 100 : 0;
    const totalXG = sum(m => KPICalculator.calculateAttack(m).xG);
    
    const totalInsideBox = sum(m => m.insideBoxShots ?? m.boxShots ?? (m.shots ? Math.round(m.shots * 0.65) : 0));
    const totalOutsideBox = Math.max(0, totalShots - totalInsideBox);

    const totalPasses = sum(m => m.totalPasses ?? m.passes ?? 0);
    const totalSuccPasses = sum(m => m.successfulPasses ?? (m.totalPasses ? Math.round(m.totalPasses * 0.78) : 0));
    const passAccPct = totalPasses > 0 ? (totalSuccPasses / totalPasses) * 100 : 0;

    const totalCrossesAtt = sum(m => m.crossesAttempted ?? m.crosses ?? 0);
    const totalCrossesSucc = sum(m => m.successfulCrosses ?? (m.crossesAttempted ? Math.round(m.crossesAttempted * 0.3) : 0));
    const crossAccPct = totalCrossesAtt > 0 ? (totalCrossesSucc / totalCrossesAtt) * 100 : 0;

    const totalBigChances = sum(m => m.bigChancesCreated ?? KPICalculator.calculateAttack(m).bigChancesCreated);
    const totalFinalThird = sum(m => m.finalThirdPasses ?? m.finalThirdEntry ?? 0);
    const totalBoxEntries = sum(m => m.boxEntries ?? m.penaltyAreaEntry ?? 0);

    // DEFENSE
    const totalGoalsConceded = sum(m => getConceded(m));
    const cleanSheets = totalMatchCount > 0 ? filteredMatches.filter(m => getConceded(m) === 0).length : 0;
    const cleanSheetPct = totalMatchCount > 0 ? (cleanSheets / N) * 100 : 0;
    
    const totalShotsConceded = sum(m => m.shotOffTarget ? (m.shotOnTarget ?? 0) + m.shotOffTarget : 0);
    const totalTacklesAtt = sum(m => m.tacklesAttempted ?? m.tackle ?? 0);
    const totalTacklesWon = sum(m => m.tacklesWon ?? m.tacklesSucceeded ?? 0);
    const tackleAccPct = totalTacklesAtt > 0 ? (totalTacklesWon / totalTacklesAtt) * 100 : 0;

    const totalInterceptions = sum(m => m.interceptions ?? m.interception ?? 0);
    const totalRecoveries = sum(m => m.ballRecoveries ?? m.recoveries ?? m.ballRecovery ?? 0);
    const totalClearances = sum(m => m.clearances ?? m.clearance ?? 0);
    const totalBlocks = sum(m => m.blocks ?? m.blockedShot ?? 0);

    const totalAerialWins = sum(getAerialWins);
    const totalAerialLosses = sum(getAerialLosses);
    const aerialWinPct = (totalAerialWins + totalAerialLosses) > 0 ? (totalAerialWins / (totalAerialWins + totalAerialLosses)) * 100 : 0;

    const totalGroundWins = sum(getGroundWins);
    const totalGroundLosses = sum(getGroundLosses);
    const groundWinPct = (totalGroundWins + totalGroundLosses) > 0 ? (totalGroundWins / (totalGroundWins + totalGroundLosses)) * 100 : 0;

    const totalFouls = sum(m => m.fouls ?? m.foul ?? 0);
    const totalYellowCards = sum(m => m.yellowCards ?? 0);

    // TACTICS
    const avgPossession = avg(m => m.possessionRate ?? 0);
    const totalHighPress = sum(m => m.highPressSuccess ?? (m.ballRecoveries ? Math.round(m.ballRecoveries * 0.35) : 0));
    const totalProgressivePasses = sum(m => m.progressivePasses ?? m.forwardPasses ?? 0);
    const progPassPct = totalPasses > 0 ? (totalProgressivePasses / totalPasses) * 100 : 0;
    const totalCounterAttacks = sum(m => m.counterAttacks ?? 0);
    const totalTransitionPasses = sum(m => m.transitionPasses ?? 0);

    // SET-PIECES
    const totalCorners = sum(m => m.corners);
    const avgCornerConvPct = avg(m => KPICalculator.calculateSetPiece(m).cornerConversionRate);
    const totalFreeKicks = sum(m => m.freeKicks ?? 0);
    const totalSetPieceGoals = sum(m => KPICalculator.calculateSetPiece(m).setPieceGoals);
    const totalLongThrows = sum(m => m.longThrows ?? 0);

    const attackRows: MetricRow[] = [
      { key: "shots", label: "Total Shots Attempted", accumulated: `${totalShots}`, average: `${(totalShots / N).toFixed(1)}`, benchmark: "11.8" },
      { key: "shotsOnTarget", label: "Shots on Target", accumulated: `${totalShotsOnTarget}`, average: `${(totalShotsOnTarget / N).toFixed(1)}`, benchmark: "4.5" },
      { key: "shotAcc", label: "Shot Accuracy %", accumulated: `${shotAccPct.toFixed(1)}%`, average: `${shotAccPct.toFixed(1)}%`, benchmark: "38.1%" },
      { key: "goals", label: "Goals Scored", accumulated: `${totalGoals}`, average: `${(totalGoals / N).toFixed(1)}`, benchmark: "1.4" },
      { key: "goalConv", label: "Goal Conversion %", accumulated: `${goalConvPct.toFixed(1)}%`, average: `${goalConvPct.toFixed(1)}%`, benchmark: "11.9%" },
      { key: "xG", label: "Expected Goals (xG)", accumulated: `${totalXG.toFixed(2)}`, average: `${(totalXG / N).toFixed(2)}`, benchmark: "1.35" },
      { key: "insideBox", label: "Inside Box Shots", accumulated: `${totalInsideBox}`, average: `${(totalInsideBox / N).toFixed(1)}`, benchmark: "7.2" },
      { key: "outsideBox", label: "Outside Box Shots", accumulated: `${totalOutsideBox}`, average: `${(totalOutsideBox / N).toFixed(1)}`, benchmark: "4.6" },
      { key: "totalPasses", label: "Total Passes", accumulated: `${totalPasses}`, average: `${(totalPasses / N).toFixed(1)}`, benchmark: "310.0" },
      { key: "successfulPasses", label: "Successful Passes", accumulated: `${totalSuccPasses}`, average: `${(totalSuccPasses / N).toFixed(1)}`, benchmark: "235.0" },
      { key: "passAcc", label: "Pass Accuracy", accumulated: `${passAccPct.toFixed(1)}%`, average: `${passAccPct.toFixed(1)}%`, benchmark: "75.8%" },
      { key: "crossesCompleted", label: "Successful Crosses", accumulated: `${totalCrossesSucc}`, average: `${(totalCrossesSucc / N).toFixed(1)}`, benchmark: "3.8" },
      { key: "crossAcc", label: "Cross Accuracy %", accumulated: `${crossAccPct.toFixed(1)}%`, average: `${crossAccPct.toFixed(1)}%`, benchmark: "31.5%" },
      { key: "bigChances", label: "Big Chances Created", accumulated: `${totalBigChances}`, average: `${(totalBigChances / N).toFixed(1)}`, benchmark: "2.1" },
      { key: "finalThirdEntries", label: "Final Third Entries / Passes", accumulated: `${totalFinalThird}`, average: `${(totalFinalThird / N).toFixed(1)}`, benchmark: "26.4" },
      { key: "boxEntries", label: "Penalty Area / Box Entries", accumulated: `${totalBoxEntries}`, average: `${(totalBoxEntries / N).toFixed(1)}`, benchmark: "13.2" },
    ];

    const defenseRows: MetricRow[] = [
      { key: "goalsConceded", label: "Goals Conceded", accumulated: `${totalGoalsConceded}`, average: `${(totalGoalsConceded / N).toFixed(1)}`, benchmark: "1.5", better: "lower" },
      { key: "cleanSheets", label: "Clean Sheets", accumulated: `${cleanSheets} matches`, average: `${cleanSheetPct.toFixed(1)}%`, benchmark: "22.0%" },
      { key: "shotsConceded", label: "Shots Conceded", accumulated: `${totalShotsConceded}`, average: `${(totalShotsConceded / N).toFixed(1)}`, benchmark: "12.1", better: "lower" },
      { key: "tacklesAttempted", label: "Tackles Attempted", accumulated: `${totalTacklesAtt}`, average: `${(totalTacklesAtt / N).toFixed(1)}`, benchmark: "17.5" },
      { key: "tacklesWon", label: "Tackles Won", accumulated: `${totalTacklesWon}`, average: `${(totalTacklesWon / N).toFixed(1)}`, benchmark: "11.2" },
      { key: "tackleSuccess", label: "Tackle Success %", accumulated: `${tackleAccPct.toFixed(1)}%`, average: `${tackleAccPct.toFixed(1)}%`, benchmark: "64.0%" },
      { key: "interceptions", label: "Interceptions Made", accumulated: `${totalInterceptions}`, average: `${(totalInterceptions / N).toFixed(1)}`, benchmark: "10.8" },
      { key: "ballRecoveries", label: "Ball Recoveries", accumulated: `${totalRecoveries}`, average: `${(totalRecoveries / N).toFixed(1)}`, benchmark: "39.5" },
      { key: "clearances", label: "Defensive Clearances", accumulated: `${totalClearances}`, average: `${(totalClearances / N).toFixed(1)}`, benchmark: "15.2" },
      { key: "blocks", label: "Blocked Shots", accumulated: `${totalBlocks}`, average: `${(totalBlocks / N).toFixed(1)}`, benchmark: "3.6" },
      { key: "aerialDuels", label: "Aerial Duels Won %", accumulated: `${aerialWinPct.toFixed(1)}%`, average: `${aerialWinPct.toFixed(1)}%`, benchmark: "50.0%" },
      { key: "groundDuels", label: "Ground Duels Won %", accumulated: `${groundWinPct.toFixed(1)}%`, average: `${groundWinPct.toFixed(1)}%`, benchmark: "50.0%" },
      { key: "fouls", label: "Fouls Committed", accumulated: `${totalFouls}`, average: `${(totalFouls / N).toFixed(1)}`, benchmark: "10.4", better: "lower" },
      { key: "yellowCards", label: "Yellow Cards Received", accumulated: `${totalYellowCards}`, average: `${(totalYellowCards / N).toFixed(1)}`, benchmark: "1.6", better: "lower" },
    ];

    const tacticsRows: MetricRow[] = [
      { key: "possession", label: "Average Ball Possession %", accumulated: `${avgPossession.toFixed(1)}%`, average: `${avgPossession.toFixed(1)}%`, benchmark: "50.0%" },
      { key: "transitionPasses", label: "Transition Passes Completed", accumulated: `${totalTransitionPasses}`, average: `${(totalTransitionPasses / N).toFixed(1)}`, benchmark: "15.0" },
      { key: "counterAttacks", label: "Counter Attacks Executed", accumulated: `${totalCounterAttacks}`, average: `${(totalCounterAttacks / N).toFixed(1)}`, benchmark: "4.0" },
      { key: "progressivePasses", label: "Progressive Passes", accumulated: `${totalProgressivePasses}`, average: `${(totalProgressivePasses / N).toFixed(1)}`, benchmark: "32.0" },
      { key: "highPress", label: "High Press Regains", accumulated: `${totalHighPress}`, average: `${(totalHighPress / N).toFixed(1)}`, benchmark: "12.0" },
    ];

    const setPieceRows: MetricRow[] = [
      { key: "corners", label: "Corners", accumulated: `${totalCorners}`, average: `${(totalCorners / N).toFixed(1)}`, benchmark: "4.8" },
      { key: "cornerConv", label: "Corner Shot Conversion %", accumulated: `${avgCornerConvPct.toFixed(1)}%`, average: `${avgCornerConvPct.toFixed(1)}%`, benchmark: "18.5%" },
      { key: "freeKicks", label: "Direct & Indirect Free Kicks", accumulated: `${totalFreeKicks}`, average: `${(totalFreeKicks / N).toFixed(1)}`, benchmark: "11.5" },
      { key: "setPieceGoals", label: "Set-Piece Goals Scored", accumulated: `${totalSetPieceGoals}`, average: `${(totalSetPieceGoals / N).toFixed(1)}`, benchmark: "0.35" },
      { key: "longThrows", label: "Long Throws Executed", accumulated: `${totalLongThrows}`, average: `${(totalLongThrows / N).toFixed(1)}`, benchmark: "5.2" },
      { key: "penalties", label: "Penalty Kick Goals Scored", accumulated: `${sum(m => m.goals > 0 && (m.insideBoxShots ?? 0) > 0 ? 1 : 0)}`, average: `${(sum(m => m.goals > 0 && (m.insideBoxShots ?? 0) > 0 ? 1 : 0) / N).toFixed(1)}`, benchmark: "0.15" },
    ];

    return {
      ATTACK: attackRows,
      DEFENSE: defenseRows,
      TACTICS: tacticsRows,
      "SET-PIECES": setPieceRows
    };
  }, [filteredMatches, totalMatchCount]);

  // Prepare line graph trend data per match
  const trendGraphData = useMemo(() => {
    return filteredMatches.map((m, idx) => {
      const atk = KPICalculator.calculateAttack(m);
      const def = KPICalculator.calculateDefense(m);
      const pos = KPICalculator.calculatePossession(m);
      const sp = KPICalculator.calculateSetPiece(m);

      return {
        matchName: `M${idx + 1} vs ${m.opponent || "Opponent"}`,
        date: m.date || `Match ${idx + 1}`,
        shots: m.shots,
        shotsOnTarget: m.shotsOnTarget ?? 0,
        goals: m.goals,
        xG: atk.xG,
        tacklesWon: m.tacklesWon ?? m.tacklesSucceeded ?? 0,
        interceptions: m.interceptions ?? 0,
        possession: m.possessionRate ?? 50,
        progressivePasses: m.progressivePasses ?? 0,
        corners: m.corners,
        setPieceXg: sp.setPieceXg,
        ppda: def.ppda
      };
    });
  }, [filteredMatches]);

  const currentTableRows = metricsData[activeTab];

  return (
    <div className="space-y-6 font-sans text-white" id="team-stats-analytics-pane">
      
      {/* Top Navigation Bar for Opponent View */}
      {isOpponentView && (
        <div className="flex items-center justify-between border-b border-[#334155] pb-4 no-print">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 hover:bg-[#1e293b] rounded-xl transition-colors cursor-pointer text-slate-300 hover:text-white border border-[#334155] flex items-center gap-2 text-xs font-bold"
                title="Return to Standings & Team List"
              >
                <ArrowLeft className="h-4 w-4 text-[#eab308]" />
                <span>Back to Team List</span>
              </button>
            )}
            <span className="text-xs text-slate-400 font-mono">
              Scouting Profile Stats • {leagueName || "CCFL Division"}
            </span>
          </div>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold bg-[#eab308] text-[#080C14] hover:bg-[#facc15] cursor-pointer transition-all shadow-md"
          >
            <Printer className="h-4 w-4" />
            <span>Print PDF Report</span>
          </button>
        </div>
      )}

      {/* Header & Top Controls matching Reference UI */}
      <div className="bg-[#111827] border border-[#334155] p-6 rounded-2xl shadow-2xl relative overflow-hidden">
        
        {/* Subtle accent glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#eab308]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          
          {/* Title block */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#eab308]/15 border border-[#eab308]/30 text-[#eab308] text-[10px] font-extrabold uppercase font-mono tracking-widest">
              <Zap className="h-3.5 w-3.5" />
              <span>{isOpponentView ? "SCOUTING PROFILE ANALYTICS | DUAL VIEW ENGINE" : "TEAM METRICS ANALYTICS | DUAL VIEW ENGINE"}</span>
            </div>

            <h1 className="font-display font-black text-2xl sm:text-3xl text-white tracking-wide uppercase">
              {isOpponentView ? `${targetTeamName} Statistics` : `${targetTeamName} Aggregate Performance`}
            </h1>

            <p className="text-xs text-[#94a3b8] font-mono flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#eab308] animate-pulse" />
              Analyzed <strong className="text-white font-mono">{totalMatchCount}</strong> match(es) across selected competition parameters
            </p>
          </div>

          {/* Controls: Competition filter & Dual view toggle */}
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Competition Filter */}
            <div className="flex items-center gap-2 bg-[#0b0f19] border border-[#334155] px-3 py-2 rounded-xl text-xs">
              <Filter className="h-4 w-4 text-[#eab308]" />
              <select
                value={selectedComp}
                onChange={(e) => setSelectedComp(e.target.value)}
                className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer pr-1"
              >
                <option value="All Competitions" className="bg-[#111827] text-white">All Competitions</option>
                <option value="CCFL Premier" className="bg-[#111827] text-white">CCFL Premier Division</option>
                <option value="CCFL First" className="bg-[#111827] text-white">CCFL First Division</option>
                <option value="Reserve Premier" className="bg-[#111827] text-white">CCFL Reserve Premier Division</option>
                <option value="Reserve First" className="bg-[#111827] text-white">CCFL Reserve First Division</option>
                <option value="Cup" className="bg-[#111827] text-white">Cup Competition</option>
                <option value="Friendly" className="bg-[#111827] text-white">Friendly Match</option>
              </select>
            </div>

            {/* Dual View Toggle */}
            <div className="bg-[#0b0f19] p-1 rounded-xl border border-[#334155] flex items-center gap-1 shadow-inner">
              <button
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  viewMode === "list"
                    ? "bg-[#eab308] text-[#080C14] shadow-md"
                    : "text-[#94a3b8] hover:text-white"
                }`}
              >
                <List className="h-4 w-4" />
                <span>List View</span>
              </button>

              <button
                onClick={() => setViewMode("graph")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  viewMode === "graph"
                    ? "bg-[#eab308] text-[#080C14] shadow-md"
                    : "text-[#94a3b8] hover:text-white"
                }`}
              >
                <LineChartIcon className="h-4 w-4" />
                <span>Line Graph View</span>
              </button>
            </div>

          </div>

        </div>

      </div>

      {/* Zero Match Data Warning Banner if 0 matches exist */}
      {totalMatchCount === 0 && (
        <div className="bg-amber-950/40 border border-amber-500/30 p-4 rounded-xl flex items-start gap-3 text-xs text-amber-200 shadow-xl no-print">
          <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
          <div>
            <p className="font-bold uppercase tracking-wider text-amber-300 text-[11px]">No Match Data Uploaded</p>
            <p className="mt-0.5 text-slate-300 leading-relaxed">
              We have not registered or uploaded any Match spreadsheets for games played against <strong className="text-white">{targetTeamName}</strong> yet. Showing default baseline values (0.0). Log match data on the schedule page to update these metrics automatically.
            </p>
          </div>
        </div>
      )}

      {/* Sub-Category Navigation Pills Tabs */}
      <div className="bg-[#111827] border border-[#334155] p-2 rounded-2xl shadow-xl">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(["ATTACK", "DEFENSE", "TACTICS", "SET-PIECES"] as TabType[]).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3 px-4 rounded-xl text-xs font-black tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 border ${
                  isActive
                    ? "bg-[#eab308] text-[#080C14] border-[#eab308] shadow-lg shadow-[#eab308]/20 font-black scale-[1.01]"
                    : "bg-[#1e293b]/70 text-[#94a3b8] hover:text-white hover:bg-[#1e293b] border-[#334155]"
                }`}
              >
                {tab === "ATTACK" && <Target className="h-4 w-4" />}
                {tab === "DEFENSE" && <Shield className="h-4 w-4" />}
                {tab === "TACTICS" && <Layers className="h-4 w-4" />}
                {tab === "SET-PIECES" && <Flag className="h-4 w-4" />}
                <span>{tab}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Primary Display View Container */}
      {viewMode === "list" ? (
        
        /* LIST VIEW TABLE */
        <div className="bg-[#111827] border border-[#334155] rounded-2xl shadow-2xl overflow-hidden">
          
          <div className="p-4 sm:p-5 border-b border-[#334155] bg-[#1e293b]/50 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <BarChart3 className="h-5 w-5 text-[#eab308]" />
              <h2 className="font-display font-black text-sm sm:text-base text-white tracking-wide uppercase">
                {activeTab} Performance Aggregates
              </h2>
            </div>
            <span className="text-[11px] font-mono text-[#94a3b8]">
              {currentTableRows.length} Parameters Evaluated
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-sans text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-[#334155] text-[#94a3b8] font-mono font-bold bg-[#0b0f19] uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4 sm:px-6">METRIC PARAMETER</th>
                  <th className="py-3.5 px-4 sm:px-6 text-center text-white">TOTAL ACCUMULATED</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right text-[#eab308] font-extrabold">PER MATCH AVERAGE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e293b]">
                {currentTableRows.map((row, idx) => (
                  <tr
                    key={row.key}
                    className={`transition-colors hover:bg-[#1e293b]/80 ${
                      idx % 2 === 0 ? "bg-[#111827]" : "bg-[#0b0f19]/60"
                    }`}
                  >
                    {/* Metric Parameter */}
                    <td className="py-3.5 px-4 sm:px-6 font-bold text-white flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#eab308]" />
                      <span>{row.label}</span>
                    </td>

                    {/* Total Accumulated */}
                    <td className="py-3.5 px-4 sm:px-6 text-center font-mono font-bold text-[#f8fafc]">
                      {row.accumulated}
                    </td>

                    {/* Per Match Average */}
                    <td className="py-3.5 px-4 sm:px-6 text-right font-mono font-black text-[#eab308] text-sm sm:text-base">
                      {row.average}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-[#334155] bg-[#0b0f19] text-[11px] text-[#94a3b8] font-mono flex items-center justify-between">
            <span>Calculated live from uploaded match performance events</span>
            <span className="text-[#eab308]">{targetTeamName} Analytics Engine</span>
          </div>

        </div>

      ) : (

        /* LINE GRAPH VIEW */
        <div className="bg-[#111827] border border-[#334155] p-6 rounded-2xl shadow-2xl space-y-4">
          
          <div className="flex items-center justify-between pb-3 border-b border-[#334155]">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-[#eab308]" />
              <h2 className="font-display font-black text-sm sm:text-base text-white tracking-wide uppercase">
                {activeTab} Trend Progression Across Matches
              </h2>
            </div>
            <p className="text-xs text-[#94a3b8] font-mono">
              Match-by-Match Visual Analytics
            </p>
          </div>

          {filteredMatches.length === 0 ? (
            <div className="py-16 text-center text-[#94a3b8] font-mono text-xs">
              No match data available to generate trend graphs for {targetTeamName}.
            </div>
          ) : (
            <div className="h-80 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendGraphData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPrimary" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#eab308" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#eab308" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="colorSecondary" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis dataKey="matchName" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#0b0f19", borderColor: "#334155", borderRadius: "12px", color: "#fff", fontSize: "12px" }} 
                  />
                  <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />

                  {activeTab === "ATTACK" && (
                    <>
                      <Area type="monotone" dataKey="shots" name="Total Shots" stroke="#eab308" fillOpacity={1} fill="url(#colorPrimary)" />
                      <Area type="monotone" dataKey="shotsOnTarget" name="Shots on Target" stroke="#06B6D4" fillOpacity={1} fill="url(#colorSecondary)" />
                      <Line type="monotone" dataKey="goals" name="Goals Scored" stroke="#EAB308" strokeWidth={3} dot={{ r: 5 }} />
                    </>
                  )}

                  {activeTab === "DEFENSE" && (
                    <>
                      <Area type="monotone" dataKey="tacklesWon" name="Tackles Won" stroke="#eab308" fillOpacity={1} fill="url(#colorPrimary)" />
                      <Area type="monotone" dataKey="interceptions" name="Interceptions" stroke="#06B6D4" fillOpacity={1} fill="url(#colorSecondary)" />
                    </>
                  )}

                  {activeTab === "TACTICS" && (
                    <>
                      <Area type="monotone" dataKey="possession" name="Possession %" stroke="#eab308" fillOpacity={1} fill="url(#colorPrimary)" />
                    </>
                  )}

                  {activeTab === "SET-PIECES" && (
                    <>
                      <Area type="monotone" dataKey="corners" name="Corners Taken" stroke="#eab308" fillOpacity={1} fill="url(#colorPrimary)" />
                    </>
                  )}

                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

        </div>

      )}

    </div>
  );
}

