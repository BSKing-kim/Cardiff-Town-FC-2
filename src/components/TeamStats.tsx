import React, { useState, useEffect, useMemo } from "react";
import { UserProfile, MatchData } from "../types";
import { DataService } from "../lib/dataService";
import { 
  BarChart3, LineChart as LineChartIcon, RefreshCw, Layers, TrendingUp, Calendar, Shield, Table
} from "lucide-react";
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid
} from "recharts";

interface TeamStatsProps {
  matches?: MatchData[];
  currentUser?: UserProfile | null;
  selectedTeamName?: string;
  isOpponentView?: boolean;
  onBack?: () => void;
  leagueName?: string;
}

export default function TeamStats({ 
  currentUser, 
  selectedTeamName, 
  onBack,
  leagueName 
}: TeamStatsProps) {
  const [teamStatsData, setTeamStatsData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadTeamStats = async (force = false) => {
    if (force) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const data = await DataService.getTeamStats(force);
      setTeamStatsData(data || []);
    } catch (err) {
      console.error("Error loading team_stats:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadTeamStats();
  }, []);

  // Sort matches chronologically for trend analysis (oldest to newest for line charts)
  const sortedMatches = useMemo(() => {
    return [...teamStatsData].sort((a, b) => {
      const dateA = a.date || "";
      const dateB = b.date || "";
      return dateA.localeCompare(dateB);
    });
  }, [teamStatsData]);

  // Last 10 matches for trend charts
  const last10Matches = useMemo(() => {
    return sortedMatches.slice(-10);
  }, [sortedMatches]);

  // Metric calculation helpers
  const calcAcc = (num: number, den: number) => den > 0 ? Math.round((num / den) * 100) : 0;

  // Prepare trend data for 9 percentage metrics
  const trendChartData = useMemo(() => {
    return last10Matches.map((m, idx) => {
      const opponentName = m.opponent || `Match ${idx + 1}`;
      const matchLabel = `M${idx + 1} (${opponentName.substring(0, 8)})`;

      return {
        label: matchLabel,
        opponent: opponentName,
        date: m.date,
        shotAcc: calcAcc(Number(m.shots_on_target || 0), Number(m.shots || 0)),
        passAcc: calcAcc(Number(m.successful_passes || 0), Number(m.passes || 0)),
        duelWonAcc: calcAcc(Number(m.duels_won || 0), Number(m.duels || 0)),
        tackleWonAcc: calcAcc(Number(m.tackles_won || 0), Number(m.tackles || 0)),
        longPassAcc: calcAcc(Number(m.successful_long_passes || 0), Number(m.long_passes || 0)),
        keyPassAcc: calcAcc(Number(m.successful_key_passes || 0), Number(m.key_passes || 0)),
        throughBallAcc: calcAcc(Number(m.successful_through_balls || 0), Number(m.through_balls || 0)),
        crossAcc: calcAcc(Number(m.successful_crosses || 0), Number(m.crosses || 0)),
        dribbleAcc: calcAcc(Number(m.successful_dribbles || 0), Number(m.dribbles || 0))
      };
    });
  }, [last10Matches]);

  // Total count & per-game average summary table data
  const summaryMetrics = useMemo(() => {
    const totalMatches = teamStatsData.length;
    const N = totalMatches > 0 ? totalMatches : 1;

    const sum = (key: string) => teamStatsData.reduce((acc, m) => acc + (Number(m[key]) || 0), 0);

    const metricsList = [
      { key: "possession", label: "Possession (%)", total: totalMatches > 0 ? (sum("possession") / N).toFixed(1) + "%" : "0%", avg: totalMatches > 0 ? (sum("possession") / N).toFixed(1) + "%" : "0%" },
      { key: "goals", label: "Goals", total: sum("goals"), avg: (sum("goals") / N).toFixed(2) },
      { key: "shots", label: "Shot", total: sum("shots"), avg: (sum("shots") / N).toFixed(2) },
      { key: "shots_on_target", label: "SOT", total: sum("shots_on_target"), avg: (sum("shots_on_target") / N).toFixed(2) },
      { key: "passes", label: "Passes", total: sum("passes"), avg: (sum("passes") / N).toFixed(1) },
      { key: "backwards_passes", label: "Backwards", total: sum("backwards_passes"), avg: (sum("backwards_passes") / N).toFixed(1) },
      { key: "forwards_passes", label: "Forwards", total: sum("forwards_passes"), avg: (sum("forwards_passes") / N).toFixed(1) },
      { key: "long_passes", label: "Long Passes", total: sum("long_passes"), avg: (sum("long_passes") / N).toFixed(1) },
      { key: "key_passes", label: "Key Passes", total: sum("key_passes"), avg: (sum("key_passes") / N).toFixed(1) },
      { key: "through_balls", label: "Through Balls", total: sum("through_balls"), avg: (sum("through_balls") / N).toFixed(1) },
      { key: "crosses", label: "Crosses", total: sum("crosses"), avg: (sum("crosses") / N).toFixed(1) },
      { key: "dribbles", label: "Dribbles", total: sum("dribbles"), avg: (sum("dribbles") / N).toFixed(1) },
      { key: "duels", label: "Duels", total: sum("duels"), avg: (sum("duels") / N).toFixed(1) },
      { key: "duels_won", label: "Duel Wons", total: sum("duels_won"), avg: (sum("duels_won") / N).toFixed(1) },
      { key: "aerial_duels", label: "Aerial Duels", total: sum("aerial_duels"), avg: (sum("aerial_duels") / N).toFixed(1) },
      { key: "aerial_duels_won", label: "Aerial Duel Wons", total: sum("aerial_duels_won"), avg: (sum("aerial_duels_won") / N).toFixed(1) },
      { key: "ground_duels", label: "Ground Duels", total: sum("ground_duels"), avg: (sum("ground_duels") / N).toFixed(1) },
      { key: "ground_duels_won", label: "Ground Duel Wons", total: sum("ground_duels_won"), avg: (sum("ground_duels_won") / N).toFixed(1) },
      { key: "ball_recoveries", label: "Ball Recovery", total: sum("ball_recoveries"), avg: (sum("ball_recoveries") / N).toFixed(1) },
      { key: "tackles", label: "Tackles", total: sum("tackles"), avg: (sum("tackles") / N).toFixed(1) },
      { key: "tackles_won", label: "Tackle Wons", total: sum("tackles_won"), avg: (sum("tackles_won") / N).toFixed(1) },
      { key: "interceptions", label: "Interceptions", total: sum("interceptions"), avg: (sum("interceptions") / N).toFixed(1) },
      { key: "clearances", label: "Clearance", total: sum("clearances"), avg: (sum("clearances") / N).toFixed(1) },
      { key: "blocks", label: "Blocked", total: sum("blocks"), avg: (sum("blocks") / N).toFixed(1) },
      { key: "own_goals", label: "Own Goals", total: sum("own_goals"), avg: (sum("own_goals") / N).toFixed(2) },
      { key: "turnovers", label: "Turnovers", total: sum("turnovers"), avg: (sum("turnovers") / N).toFixed(1) },
      { key: "miscontrols", label: "Miscontrol", total: sum("miscontrols"), avg: (sum("miscontrols") / N).toFixed(1) },
      { key: "unsuccessful_dribbles", label: "Uns Dribble", total: sum("unsuccessful_dribbles"), avg: (sum("unsuccessful_dribbles") / N).toFixed(1) },
      { key: "possession_lost", label: "Possession Lost", total: sum("possession_lost"), avg: (sum("possession_lost") / N).toFixed(1) },
      { key: "offsides", label: "Offside", total: sum("offsides"), avg: (sum("offsides") / N).toFixed(1) },
      { key: "fouls", label: "Fouls", total: sum("fouls"), avg: (sum("fouls") / N).toFixed(1) },
      { key: "yellow_cards", label: "Yellow Card", total: sum("yellow_cards"), avg: (sum("yellow_cards") / N).toFixed(2) },
      { key: "red_cards", label: "Red Card", total: sum("red_cards"), avg: (sum("red_cards") / N).toFixed(2) }
    ];

    return { totalMatches, metricsList };
  }, [teamStatsData]);

  const trendChartsConfig = [
    { key: "shotAcc", title: "Shot Accuracy (%)", color: "#3b82f6" },
    { key: "passAcc", title: "Pass Accuracy (%)", color: "#10b981" },
    { key: "duelWonAcc", title: "Duel Won %", color: "#f59e0b" },
    { key: "tackleWonAcc", title: "Tackle Won %", color: "#8b5cf6" },
    { key: "longPassAcc", title: "Long Pass Suc %", color: "#ec4899" },
    { key: "keyPassAcc", title: "Key Pass Suc %", color: "#06b6d4" },
    { key: "throughBallAcc", title: "Through Ball Suc %", color: "#f97316" },
    { key: "crossAcc", title: "Cross Suc %", color: "#14b8a6" },
    { key: "dribbleAcc", title: "Dribble Suc %", color: "#a855f7" }
  ];

  return (
    <div className="space-y-8" id="team-stats-root-viewport">
      {/* Top Header */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="bg-amber-500/15 border border-amber-500/30 p-2.5 rounded-lg text-amber-400">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-display font-black text-xl text-white uppercase tracking-wider">
                Team Dashboard
              </h1>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadTeamStats(true)}
            disabled={isRefreshing}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-400 text-xs font-bold py-2 px-3.5 rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>Sync Data</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-12 text-center text-slate-400">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-amber-400 mb-3" />
          <p className="text-sm font-semibold">Loading team statistics from public.team_stats...</p>
        </div>
      ) : teamStatsData.length === 0 ? (
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-12 text-center text-slate-400 space-y-3">
          <BarChart3 className="h-12 w-12 mx-auto text-slate-600 mb-2" />
          <h3 className="text-lg font-bold text-white">No Team Stats Data Available</h3>
          <p className="text-xs max-w-md mx-auto text-slate-400">
            Upload match data using the <span className="text-amber-400 font-semibold">Team Stats Bulk Import</span> card in the Admin Center or Excel Templates tab to populate this dashboard.
          </p>
        </div>
      ) : (
        <>
          {/* SECTION 1: LAST 10 MATCHES TREND (LINE CHARTS) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LineChartIcon className="h-5 w-5 text-amber-400" />
                <h2 className="font-display font-black text-lg text-white uppercase tracking-wider">
                  Trend Analysis
                </h2>
              </div>
              <span className="text-xs font-semibold text-slate-400 bg-slate-800/80 border border-slate-700/60 px-3 py-1 rounded-full">
                Tracking : {trendChartData.length}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {trendChartsConfig.map(chart => {
                const latestVal = trendChartData.length > 0 ? trendChartData[trendChartData.length - 1][chart.key as keyof typeof trendChartData[0]] : 0;
                const avgVal = Math.round(trendChartData.reduce((acc, curr) => acc + (Number(curr[chart.key as keyof typeof trendChartData[0]]) || 0), 0) / (trendChartData.length || 1));

                return (
                  <div 
                    key={chart.key} 
                    className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 shadow-xl space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                        {chart.title}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          Avg: {avgVal}%
                        </span>
                        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Latest: {latestVal}%
                        </span>
                      </div>
                    </div>

                    <div className="h-44 w-full pt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trendChartData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 10 }} />
                          <YAxis stroke="#64748b" tick={{ fontSize: 10 }} domain={[0, 100]} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: "#090d16", borderColor: "#334155", borderRadius: "8px", fontSize: "12px" }}
                            formatter={(value: any) => [`${value}%`, chart.title]}
                          />
                          <Line 
                            type="monotone" 
                            dataKey={chart.key} 
                            stroke={chart.color} 
                            strokeWidth={2.5} 
                            dot={{ fill: chart.color, r: 4 }} 
                            activeDot={{ r: 6 }} 
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: TEAM SUMMARY METRICS TABLE */}
          <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Table className="h-5 w-5 text-amber-400" />
                <h2 className="font-display font-black text-lg text-white uppercase tracking-wider">
                  Summary
                </h2>
              </div>
              <span className="text-xs font-semibold text-slate-400 bg-slate-800/80 border border-slate-700/60 px-3 py-1 rounded-full">
                Analysed : {summaryMetrics.totalMatches}
              </span>
            </div>

            <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900/90 text-slate-400 font-mono text-[11px] uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-bold">Metric Label</th>
                      <th className="py-3 px-4 text-center font-bold text-amber-400">Total Count</th>
                      <th className="py-3 px-4 text-center font-bold text-emerald-400">Per Game Average</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {summaryMetrics.metricsList.map((m, idx) => (
                      <tr key={m.key} className={idx % 2 === 0 ? "bg-slate-900/30 hover:bg-slate-800/40" : "bg-transparent hover:bg-slate-800/40"}>
                        <td className="py-2.5 px-4 font-semibold text-white">{m.label}</td>
                        <td className="py-2.5 px-4 text-center font-mono font-bold text-amber-300">{m.total}</td>
                        <td className="py-2.5 px-4 text-center font-mono font-bold text-emerald-300">{m.avg}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
