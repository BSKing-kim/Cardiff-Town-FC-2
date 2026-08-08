import React, { useState, useEffect, useMemo } from "react";
import { MatchData, UserProfile } from "../types";
import { DataService } from "../lib/dataService";
import {
  TrendingUp, Calendar, ChevronDown, Layers, Trophy, RefreshCw
} from "lucide-react";
import TeamLogo from "./TeamLogo";

interface MatchHubProps {
  matches?: MatchData[];
  currentUser?: UserProfile | null;
  onSelectOpponent?: (opponent: string) => void;
}

const DonutChart = ({ percentage, color = "#1D4ED8" }: { percentage: number; color?: string }) => {
  const val = Math.min(100, Math.max(0, Math.round(percentage || 0)));
  const strokeDasharray = `${val} ${100 - val}`;
  return (
    <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
      <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
        <path
          className="text-slate-800 stroke-current"
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
      <span className="absolute text-xs sm:text-sm font-black font-mono text-white">{val}%</span>
    </div>
  );
};

export default function MatchHub({ matches: propMatches, currentUser, onSelectOpponent }: MatchHubProps) {
  const [matches, setMatches] = useState<MatchData[]>(propMatches || []);
  const [selectedMatchId, setSelectedMatchId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const loadMatchesFromDB = async () => {
    setIsLoading(true);
    try {
      const data = await DataService.getMatches(true);
      if (data && data.length > 0) {
        setMatches(data);
      }
    } catch (err) {
      console.error("Error loading matches for Match Hub:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!propMatches || propMatches.length === 0) {
      loadMatchesFromDB();
    } else {
      setMatches(propMatches);
    }
  }, [propMatches]);

  // Default selected match to first match
  useEffect(() => {
    if (matches.length > 0 && !selectedMatchId) {
      setSelectedMatchId(matches[0].id);
    }
  }, [matches, selectedMatchId]);

  const selectedMatch = useMemo(() => {
    if (!selectedMatchId && matches.length > 0) return matches[0];
    return matches.find(m => String(m.id).trim() === String(selectedMatchId).trim()) || matches[0];
  }, [matches, selectedMatchId]);

  // Extract Home / Away stats based on home_away field
  const matchAnalysis = useMemo(() => {
    if (!selectedMatch) return null;

    const m = selectedMatch as any;
    const isCardiffHome = (m.home_away || m.venue || 'Home').toLowerCase() === 'home';

    const homeTeam = isCardiffHome ? "Cardiff Town FC" : (m.opponent || "Opponent");
    const awayTeam = isCardiffHome ? (m.opponent || "Opponent") : "Cardiff Town FC";

    // Our team stats
    const ourStats = {
      possession: Number(m.possession || 50),
      goals: Number(m.our_score ?? m.goals ?? 0),
      shots: Number(m.shots || 0),
      shotsOnTarget: Number(m.shots_on_target || 0),
      passes: Number(m.passes || 0),
      successfulPasses: Number(m.successful_passes || 0),
      backwardsPasses: Number(m.backwards_passes || 0),
      forwardsPasses: Number(m.forwards_passes || 0),
      longPasses: Number(m.long_passes || 0),
      successfulLongPasses: Number(m.successful_long_passes || 0),
      keyPasses: Number(m.key_passes || 0),
      successfulKeyPasses: Number(m.successful_key_passes || 0),
      throughBalls: Number(m.through_balls || 0),
      successfulThroughBalls: Number(m.successful_through_balls || 0),
      crosses: Number(m.crosses || 0),
      successfulCrosses: Number(m.successful_crosses || 0),
      dribbles: Number(m.dribbles || 0),
      successfulDribbles: Number(m.successful_dribbles || 0),
      duels: Number(m.duels || 0),
      duelsWon: Number(m.duels_won || 0),
      aerialDuels: Number(m.aerial_duels || 0),
      aerialDuelsWon: Number(m.aerial_duels_won || 0),
      groundDuels: Number(m.ground_duels || 0),
      groundDuelsWon: Number(m.ground_duels_won || 0),
      ballRecoveries: Number(m.ball_recoveries || 0),
      tackles: Number(m.tackles || 0),
      tacklesWon: Number(m.tackles_won || 0),
      interceptions: Number(m.interceptions || 0),
      clearances: Number(m.clearances || 0),
      blocks: Number(m.blocks || 0),
      ownGoals: Number(m.own_goals || 0),
      turnovers: Number(m.turnovers || 0),
      miscontrols: Number(m.miscontrols || 0),
      unsuccessfulDribbles: Number(m.unsuccessful_dribbles || 0),
      possessionLost: Number(m.possession_lost || 0),
      offsides: Number(m.offsides || 0),
      fouls: Number(m.fouls || 0),
      yellowCards: Number(m.yellow_cards || 0),
      redCards: Number(m.red_cards || 0)
    };

    // Opponent stats (opp_ prefix)
    const oppStats = {
      possession: Number(m.opp_possession ?? (100 - ourStats.possession)),
      goals: Number(m.opponent_score ?? m.opp_goals ?? 0),
      shots: Number(m.opp_shots || 0),
      shotsOnTarget: Number(m.opp_shots_on_target || 0),
      passes: Number(m.opp_passes || 0),
      successfulPasses: Number(m.opp_successful_passes || 0),
      backwardsPasses: Number(m.opp_backwards_passes || 0),
      forwardsPasses: Number(m.opp_forwards_passes || 0),
      longPasses: Number(m.opp_long_passes || 0),
      successfulLongPasses: Number(m.opp_successful_long_passes || 0),
      keyPasses: Number(m.opp_key_passes || 0),
      successfulKeyPasses: Number(m.opp_successful_key_passes || 0),
      throughBalls: Number(m.opp_through_balls || 0),
      successfulThroughBalls: Number(m.opp_successful_through_balls || 0),
      crosses: Number(m.opp_crosses || 0),
      successfulCrosses: Number(m.opp_successful_crosses || 0),
      dribbles: Number(m.opp_dribbles || 0),
      successfulDribbles: Number(m.opp_successful_dribbles || 0),
      duels: Number(m.opp_duels || 0),
      duelsWon: Number(m.opp_duels_won || 0),
      aerialDuels: Number(m.opp_aerial_duels || 0),
      aerialDuelsWon: Number(m.opp_aerial_duels_won || 0),
      groundDuels: Number(m.opp_ground_duels || 0),
      groundDuelsWon: Number(m.opp_ground_duels_won || 0),
      ballRecoveries: Number(m.opp_ball_recoveries || 0),
      tackles: Number(m.opp_tackles || 0),
      tacklesWon: Number(m.opp_tackles_won || 0),
      interceptions: Number(m.opp_interceptions || 0),
      clearances: Number(m.opp_clearances || 0),
      blocks: Number(m.opp_blocks || 0),
      ownGoals: Number(m.opp_own_goals || 0),
      turnovers: Number(m.opp_turnovers || 0),
      miscontrols: Number(m.opp_miscontrols || 0),
      unsuccessfulDribbles: Number(m.opp_unsuccessful_dribbles || 0),
      possessionLost: Number(m.opp_possession_lost || 0),
      offsides: Number(m.opp_offsides || 0),
      fouls: Number(m.opp_fouls || 0),
      yellowCards: Number(m.opp_yellow_cards || 0),
      redCards: Number(m.opp_red_cards || 0)
    };

    const homeStats = isCardiffHome ? ourStats : oppStats;
    const awayStats = isCardiffHome ? oppStats : ourStats;

    const calcAcc = (num: number, den: number) => den > 0 ? Math.round((num / den) * 100) : 0;

    const percentageMetrics = [
      { key: "shotAcc", label: "Shot Accuracy", home: calcAcc(homeStats.shotsOnTarget, homeStats.shots), away: calcAcc(awayStats.shotsOnTarget, awayStats.shots) },
      { key: "goalConv", label: "Goal Conversion %", home: calcAcc(homeStats.goals, homeStats.shots), away: calcAcc(awayStats.goals, awayStats.shots) },
      { key: "passAcc", label: "Pass Accuracy", home: calcAcc(homeStats.successfulPasses, homeStats.passes), away: calcAcc(awayStats.successfulPasses, awayStats.passes) },
      { key: "duelWon", label: "Duel Won %", home: calcAcc(homeStats.duelsWon, homeStats.duels), away: calcAcc(awayStats.duelsWon, awayStats.duels) },
      { key: "tackleWon", label: "Tackle Won %", home: calcAcc(homeStats.tacklesWon, homeStats.tackles), away: calcAcc(awayStats.tacklesWon, awayStats.tackles) },
      { key: "longPassSuc", label: "Long Pass Suc %", home: calcAcc(homeStats.successfulLongPasses, homeStats.longPasses), away: calcAcc(awayStats.successfulLongPasses, awayStats.longPasses) },
      { key: "keyPassSuc", label: "Key Pass Suc %", home: calcAcc(homeStats.successfulKeyPasses, homeStats.keyPasses), away: calcAcc(awayStats.successfulKeyPasses, awayStats.keyPasses) },
      { key: "throughBallSuc", label: "Through Ball Suc %", home: calcAcc(homeStats.successfulThroughBalls, homeStats.throughBalls), away: calcAcc(awayStats.successfulThroughBalls, awayStats.throughBalls) },
      { key: "crossSuc", label: "Cross Suc %", home: calcAcc(homeStats.successfulCrosses, homeStats.crosses), away: calcAcc(awayStats.successfulCrosses, awayStats.crosses) }
    ];

    const numericComparisonList = [
      { label: "Possession (%)", home: `${homeStats.possession.toFixed(1)}%`, away: `${awayStats.possession.toFixed(1)}%` },
      { label: "Goals", home: homeStats.goals, away: awayStats.goals },
      { label: "Shot", home: homeStats.shots, away: awayStats.shots },
      { label: "SOT", home: homeStats.shotsOnTarget, away: awayStats.shotsOnTarget },
      { label: "Passes", home: homeStats.passes, away: awayStats.passes },
      { label: "Backwards", home: homeStats.backwardsPasses, away: awayStats.backwardsPasses },
      { label: "Forwards", home: homeStats.forwardsPasses, away: awayStats.forwardsPasses },
      { label: "Long Passes", home: homeStats.longPasses, away: awayStats.longPasses },
      { label: "Key Passes", home: homeStats.keyPasses, away: awayStats.keyPasses },
      { label: "Through Balls", home: homeStats.throughBalls, away: awayStats.throughBalls },
      { label: "Crosses", home: homeStats.crosses, away: awayStats.crosses },
      { label: "Dribbles", home: homeStats.dribbles, away: awayStats.dribbles },
      { label: "Duels", home: homeStats.duels, away: awayStats.duels },
      { label: "Duel Wons", home: homeStats.duelsWon, away: awayStats.duelsWon },
      { label: "Aerial Duels", home: homeStats.aerialDuels, away: awayStats.aerialDuels },
      { label: "Aerial Duel Wons", home: homeStats.aerialDuelsWon, away: awayStats.aerialDuelsWon },
      { label: "Ground Duels", home: homeStats.groundDuels, away: awayStats.groundDuels },
      { label: "Ground Duel Wons", home: homeStats.groundDuelsWon, away: awayStats.groundDuelsWon },
      { label: "Ball Recovery", home: homeStats.ballRecoveries, away: awayStats.ballRecoveries },
      { label: "Tackles", home: homeStats.tackles, away: awayStats.tackles },
      { label: "Tackle Wons", home: homeStats.tacklesWon, away: awayStats.tacklesWon },
      { label: "Interceptions", home: homeStats.interceptions, away: awayStats.interceptions },
      { label: "Clearance", home: homeStats.clearances, away: awayStats.clearances },
      { label: "Blocked", home: homeStats.blocks, away: awayStats.blocks },
      { label: "Own Goals", home: homeStats.ownGoals, away: awayStats.ownGoals },
      { label: "Turnovers", home: homeStats.turnovers, away: awayStats.turnovers },
      { label: "Miscontrol", home: homeStats.miscontrols, away: awayStats.miscontrols },
      { label: "Uns Dribble", home: homeStats.unsuccessfulDribbles, away: awayStats.unsuccessfulDribbles },
      { label: "Possession Lost", home: homeStats.possessionLost, away: awayStats.possessionLost },
      { label: "Offside", home: homeStats.offsides, away: awayStats.offsides },
      { label: "Fouls", home: homeStats.fouls, away: awayStats.fouls },
      { label: "Yellow Card", home: homeStats.yellowCards, away: awayStats.yellowCards },
      { label: "Red Card", home: homeStats.redCards, away: awayStats.redCards }
    ];

    return {
      homeTeam,
      awayTeam,
      homeScore: homeStats.goals,
      awayScore: awayStats.goals,
      date: m.date,
      percentageMetrics,
      numericComparisonList
    };
  }, [selectedMatch]);

  return (
    <div className="space-y-6" id="match-hub-root-viewport">
      {/* MATCH SELECTOR TOP BAR */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="bg-cyan-500/15 border border-cyan-500/30 p-2.5 rounded-lg text-cyan-400">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-display font-black text-xl text-white uppercase tracking-wider">
                Match Hub
              </h1>
            </div>
          </div>

          {/* Match Dropdown Selector */}
          <div className="relative min-w-[260px]">
            <select
              value={selectedMatchId}
              onChange={(e) => setSelectedMatchId(e.target.value)}
              className="w-full bg-slate-900 border border-cyan-500/40 text-cyan-300 font-bold text-xs rounded-xl px-4 py-2.5 appearance-none focus:outline-none focus:ring-2 focus:ring-cyan-500/50 cursor-pointer shadow-lg pr-10"
            >
              {matches.length === 0 ? (
                <option value="">No matches available</option>
              ) : (
                matches.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.date || 'Fixture'} - vs {m.opponent || 'Opponent'} ({m.home_away || 'Home'})
                  </option>
                ))
              )}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-400 pointer-events-none" />
          </div>
        </div>

        {/* Scoreboard Header */}
        {matchAnalysis && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row items-center justify-between gap-6 md:gap-4 shadow-inner">
            {/* Home Team */}
            <div className="flex flex-col items-center gap-2 w-full md:w-1/3 text-center">
              <TeamLogo teamName={matchAnalysis.homeTeam} size={48} className="bg-slate-800 p-1.5 rounded-xl border border-slate-700 shadow-md" />
              <span className="text-sm font-extrabold text-white truncate w-full" title={matchAnalysis.homeTeam}>
                {matchAnalysis.homeTeam}
              </span>
              <span className="text-[10px] font-bold text-cyan-400 tracking-widest uppercase bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                HOME
              </span>
            </div>

            {/* Score Box */}
            <div className="flex flex-col items-center justify-center gap-1.5">
              <span className="text-[11px] font-mono font-bold text-slate-400 tracking-widest">
                {matchAnalysis.date}
              </span>
              <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight bg-slate-950 border border-cyan-500/40 text-cyan-400 px-5 py-2 rounded-2xl shadow-xl">
                {matchAnalysis.homeScore} : {matchAnalysis.awayScore}
              </div>
            </div>

            {/* Away Team */}
            <div className="flex flex-col items-center gap-2 w-full md:w-1/3 text-center">
              <TeamLogo teamName={matchAnalysis.awayTeam} size={48} className="bg-slate-800 p-1.5 rounded-xl border border-slate-700 shadow-md" />
              <span className="text-sm font-extrabold text-white truncate w-full" title={matchAnalysis.awayTeam}>
                {matchAnalysis.awayTeam}
              </span>
              <span className="text-[10px] font-bold text-emerald-400 tracking-widest uppercase bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                AWAY
              </span>
            </div>
          </div>
        )}
      </div>

      {/* DUAL DONUT CHARTS SECTION */}
      {matchAnalysis && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-800 pb-2 gap-2">
            <h2 className="font-display font-black text-base text-white uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="h-4.5 w-4.5 text-cyan-400" />
              Dashboard (Home vs Away)
            </h2>
            <div className="flex items-center gap-4 text-xs font-mono font-bold">
              <span className="flex items-center gap-1.5 text-cyan-400">
                <span className="w-3 h-3 rounded-full bg-[#1D4ED8] inline-block" />
                Home
              </span>
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-3 h-3 rounded-full bg-[#10b981] inline-block" />
                Away
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {matchAnalysis.percentageMetrics.map(item => (
              <div
                key={item.key}
                className="bg-[#0f172a] border border-slate-800/90 rounded-xl p-4 flex items-center justify-between shadow-xl"
              >
                {/* Home Donut */}
                <div className="flex flex-col items-center gap-1">
                  <DonutChart percentage={item.home} color="#1D4ED8" />
                  <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">Home</span>
                </div>

                {/* Metric Label */}
                <div className="flex flex-col items-center text-center px-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider max-w-[110px]">
                    {item.label}
                  </span>
                  <span className="text-[10px] font-mono font-bold text-slate-400 mt-1">VS</span>
                </div>

                {/* Away Donut */}
                <div className="flex flex-col items-center gap-1">
                  <DonutChart percentage={item.away} color="#10b981" />
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Away</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BOTTOM DETAILED NUMERIC COMPARISON LIST */}
      {matchAnalysis && (
        <div className="space-y-4 pt-2">
          <div className="border-b border-slate-800 pb-2">
            <h2 className="font-display font-black text-base text-white uppercase tracking-wider flex items-center gap-2">
              <Layers className="h-4.5 w-4.5 text-cyan-400" />
              Detailed (Home vs Away)
            </h2>
          </div>

          <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="divide-y divide-slate-800/60 font-sans text-xs">
              <div className="bg-slate-900/90 p-3 grid grid-cols-3 text-center font-mono font-bold text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-800">
                <span className="text-cyan-400">Home</span>
                <span className="text-white">Metric Label</span>
                <span className="text-emerald-400">Away</span>
              </div>

              {matchAnalysis.numericComparisonList.map((row, idx) => (
                <div
                  key={row.label}
                  className={`p-3 grid grid-cols-3 text-center transition-colors ${idx % 2 === 0 ? "bg-slate-900/40 hover:bg-slate-800/50" : "bg-transparent hover:bg-slate-800/50"
                    }`}
                >
                  <span className="font-mono font-bold text-cyan-300 text-sm">{row.home}</span>
                  <span className="font-bold text-slate-200 uppercase tracking-wider text-xs flex items-center justify-center">{row.label}</span>
                  <span className="font-mono font-bold text-emerald-300 text-sm">{row.away}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
