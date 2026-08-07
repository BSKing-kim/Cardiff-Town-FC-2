import React, { useState, useEffect } from "react";
import { 
  Check, Square, CheckSquare, Sliders, RefreshCw, 
  Target, Shield, Layers, Sparkles, Activity, Users, AlertTriangle, Plus
} from "lucide-react";
import { ExcelUtils } from "../lib/excelUtils";
import { CustomTeam, UserProfile, UserRole } from "../types";
import { DataService } from "../lib/dataService";

// Full list of Physical Performance Indicators (PI)
const ALL_PIs = [
  { id: "shots", label: "Total Shots", category: "Attack", desc: "Total number of shots taken during match play" },
  { id: "shotsOnTarget", label: "Shots on Target", category: "Attack", desc: "Shots direct into the frame of the goal" },
  { id: "insideBoxShots", label: "Inside Box Shots", category: "Attack", desc: "Controlled shots taken within the penalty area" },
  { id: "goals", label: "Goals Scored", category: "Attack", desc: "Total goals converting from offensive setups" },
  { id: "keyPasses", label: "Key Passes", category: "Attack", desc: "Key passes resulting in immediate teammate shot setups" },
  { id: "throughBalls", label: "Through Balls", category: "Attack", desc: "Splitting line pass links calculated" },
  { id: "tackles", label: "Tackles", category: "Defense", desc: "Total physical tackles attempted on ball-carriers" },
  { id: "interceptions", label: "Interceptions", category: "Defense", desc: "Intercepted passing lanes and cut off passes" },
  { id: "clearances", label: "Clearances", category: "Defense", desc: "Ball booted out of danger zones under pressure" },
  { id: "blocks", label: "Blocks", category: "Defense", desc: "Body blocks on shots or critical penetrative lines" },
  { id: "fouls", label: "Was Fouled", category: "Defense", desc: "Infractions suffered by team players" },
  { id: "yellowCards", label: "Yellow Cards", category: "Defense", desc: "Accumulated warning cards given during defense" },
  { id: "ballRecoveries", label: "Ball Recoveries", category: "Transition", desc: "Secured loose balls or snapped lost possessions" },
  { id: "turnovers", label: "Turnovers", category: "Transition", desc: "Possessions lost in play due to active errors" },
  { id: "transitionPasses", label: "Transition Phase Passes", category: "Transition", desc: "Passes initiated in the immediate transition zone" },
  { id: "possessionRate", label: "Team Possession Rate", category: "Possession", desc: "Overall percentage of ball possession duration" },
  { id: "passes", label: "Total Completed Passes", category: "Possession", desc: "Total passes processed on the pitch" },
  { id: "passSuccessRate", label: "Pass Accuracy %", category: "Possession", desc: "Ratios of precise ball rotations" },
  { id: "longPasses", label: "Long Passes", category: "Possession", desc: "Air balls or long balls stretching 35m+ yards" },
  { id: "forwardPasses", label: "Forward Oriented Passes", category: "Possession", desc: "Total forward directional pass links" },
  { id: "corners", label: "Corners", category: "Set Pieces", desc: "Total corner kicks won from standard block lines" },
  { id: "freeKicks", label: "Fouls", category: "Set Pieces", desc: "Dangerous set piece kicks won from fouls" }
];

// Full list of Tactical Key Performance Indicators (KPI)
const ALL_KPIs = [
  { id: "boxEntries", label: "Box Entries", category: "Attack", desc: "Controlled entries into the opponent's penalty box" },
  { id: "finalThirdEntries", label: "Final 3rd Entries", category: "Attack", desc: "Controlled entries into the final third of the pitch" },
  { id: "bigChancesCreated", label: "Big Chances", category: "Attack", desc: "Clear-cut scoring opportunities created" },
  { id: "shotConversionRate", label: "Conversion Rate", category: "Attack", desc: "Percentage of shots resulting in goals" },
  { id: "shotAccuracy", label: "Shot Accuracy", category: "Attack", desc: "Percentage of total shots directed on target" },
  { id: "boxShotsConceded", label: "Box Shots Conceded", category: "Defense", desc: "Shots conceded within our own penalty area" },
  { id: "ppda", label: "PPDA Index", category: "Defense", desc: "Passes Allowed per Defensive Action in the opponent's half" },
  { id: "defensiveDuelWinRate", label: "Def. Duel Win Rate", category: "Defense", desc: "Percentage of defensive duels won" },
  { id: "recoveryRate", label: "Recovery rate", category: "Transition", desc: "Percentage of ball recoveries won in attacking half" },
  { id: "highRegainFrequency", label: "High Regains", category: "Transition", desc: "Possessions won back within 40m of the opponent's goal" },
  { id: "turnoversLeadingToShots", label: "Turnovers to Shots", category: "Transition", desc: "Opponent turnovers that lead to an immediate shot" },
  { id: "recoveryToShotTime", label: "Recovery Shot Delay (s)", category: "Transition", desc: "Average seconds from ball recovery to shot taken" },
  { id: "progressivePasses", label: "Prog. Passes", category: "Possession", desc: "Passes that move the ball significantly closer to the goal" },
  { id: "progressiveCarries", label: "Prog. Carries", category: "Possession", desc: "Carries that move the ball significantly closer to the goal" },
  { id: "possessionValue", label: "Possession Value", category: "Possession", desc: "Derived threat value of overall ball possession" },
  { id: "finalThirdPossessionRate", label: "Final 3rd Poss %", category: "Possession", desc: "Percentage of overall possession spent in final third" },
  { id: "foulWonAvg", label: "Fouls Average", category: "Set Pieces", desc: "Average fouls won per match play" },
  { id: "foulCommittedAvg", label: "Was Fouled Average", category: "Set Pieces", desc: "Average fouls committed / suffered per match play" },
  { id: "setPieceGoals", label: "Set Piece Goals", category: "Set Pieces", desc: "Goals scored directly or indirectly from set pieces" },
  { id: "cornerConversionRate", label: "Corner Conversion", category: "Set Pieces", desc: "Percentage of corner kicks leading to a shot or goal" }
];

// Default hardcoded team ID mapping to check duplicates
const DEFAULT_TEAM_IDS: string[] = [];

interface MetricsConfigProps {
  currentUser?: UserProfile;
  customTeams?: CustomTeam[];
  onTeamsUpdated?: () => void;
  defaultSubTab?: "pi" | "kpi" | "teams";
}

export default function MetricsConfig({ currentUser, customTeams = [], onTeamsUpdated, defaultSubTab }: MetricsConfigProps) {
  const isPlayer = currentUser?.role === UserRole.Player;
  const [checkedPIs, setCheckedPIs] = useState<string[]>(() => {
    const saved = localStorage.getItem("checked_pi_list");
    return saved ? JSON.parse(saved) : ALL_PIs.map(p => p.id);
  });

  const [checkedKPIs, setCheckedKPIs] = useState<string[]>(() => {
    const saved = localStorage.getItem("checked_kpi_list");
    return saved ? JSON.parse(saved) : ALL_KPIs.map(k => k.id);
  });

  const [successMsg, setSuccessMsg] = useState("");
  const [activeTab, setActiveTab] = useState<"pi" | "kpi" | "team_mgmt">("pi");

  // Sync with mobile active tab
  useEffect(() => {
    if (defaultSubTab) {
      if (defaultSubTab === "pi") {
        setActiveTab("pi");
      } else if (defaultSubTab === "kpi") {
        setActiveTab("kpi");
      } else if (defaultSubTab === "teams") {
        setActiveTab("team_mgmt");
      }
    }
  }, [defaultSubTab]);

  // Custom team form fields
  const [teamName, setTeamName] = useState("");
  const [selectedLeague, setSelectedLeague] = useState("CCFL Premier Division");

  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;

    const cleanName = teamName.trim();
    // Slugify / generate fallback team_code under the hood
    const autoId = cleanName.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "") || `team_${Date.now()}`;

    const newTeam: CustomTeam = {
      id: autoId,
      name: cleanName,
      league: selectedLeague,
      mp: 0,
      w: 0,
      d: 0,
      l: 0,
      gf: 0,
      ga: 0
    };

    try {
      await DataService.saveCustomTeam(newTeam);
      setSuccessMsg(`Successfully registered team "${newTeam.name}" (${selectedLeague}) to the database!`);
      setTeamName("");
      setTimeout(() => setSuccessMsg(""), 4000);
      if (onTeamsUpdated) {
        onTeamsUpdated();
      }
    } catch (err: any) {
      alert(`Failed to register team: ${err?.message || String(err)}`);
    }
  };

  const saveConfig = (newPIs: string[], newKPIs: string[]) => {
    localStorage.setItem("checked_pi_list", JSON.stringify(newPIs));
    localStorage.setItem("checked_kpi_list", JSON.stringify(newKPIs));
    setSuccessMsg("Metrics Configuration saved successfully! Checklists updated.");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const handleTogglePI = (id: string) => {
    if (isPlayer) return;
    const updated = checkedPIs.includes(id)
      ? checkedPIs.filter(p => p !== id)
      : [...checkedPIs, id];
    setCheckedPIs(updated);
    saveConfig(updated, checkedKPIs);
  };

  const handleToggleKPI = (id: string) => {
    if (isPlayer) return;
    const updated = checkedKPIs.includes(id)
      ? checkedKPIs.filter(k => k !== id)
      : [...checkedKPIs, id];
    setCheckedKPIs(updated);
    saveConfig(checkedPIs, updated);
  };

  const selectAllPIs = () => {
    const allIds = ALL_PIs.map(p => p.id);
    setCheckedPIs(allIds);
    saveConfig(allIds, checkedKPIs);
  };

  const selectNonePIs = () => {
    setCheckedPIs([]);
    saveConfig([], checkedKPIs);
  };

  const selectAllKPIs = () => {
    const allIds = ALL_KPIs.map(k => k.id);
    setCheckedKPIs(allIds);
    saveConfig(checkedPIs, allIds);
  };

  const selectNoneKPIs = () => {
    setCheckedKPIs([]);
    saveConfig(checkedPIs, []);
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case "Attack": return "text-blue-600 bg-blue-50 border-blue-200";
      case "Defense": return "text-red-600 bg-red-50 border-red-200";
      case "Transition": return "text-amber-600 bg-amber-50 border-amber-200";
      case "Possession": return "text-emerald-600 bg-emerald-50 border-emerald-200";
      default: return "text-purple-600 bg-purple-50 border-purple-200";
    }
  };

  return (
    <div className="space-y-6" id="metrics-config-root">
      {/* Title Header */}
      <div className="border-b border-[#E2E8F0] pb-3">
        <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight text-[#0A2342] flex items-center gap-2">
          <Sliders className="h-5 w-5 text-[#1D4ED8]" />
          Team Management
        </h2>
      </div>

      {successMsg && (
        <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-[11px] text-emerald-800 flex items-center gap-2 font-sans font-semibold animate-fadeIn">
          <Check className="h-4 w-4 text-emerald-600" />
          {successMsg}
        </div>
      )}

      {/* Dynamic Settings Category Heading (Replaced interactive menu) */}
      <div className="border-b border-slate-200 pb-2 mb-2" id="metrics-config-tabs">
        <h3 className="font-display font-bold text-slate-800 text-sm sm:text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            {activeTab === "pi" && (
              <>
                <Activity className="h-4.5 w-4.5 text-[#1D4ED8]" />
                <span>Performance Indicators Checklist</span>
              </>
            )}
            {activeTab === "kpi" && (
              <>
                <Sparkles className="h-4.5 w-4.5 text-[#1D4ED8]" />
                <span>Tactical KPIs Checklist</span>
              </>
            )}
            {activeTab === "team_mgmt" && (
              <>
                <Users className="h-4.5 w-4.5 text-[#1D4ED8]" />
                <span>Team & League Management</span>
              </>
            )}
          </div>
          {isPlayer && (
            <span className="text-xs text-rose-600 font-bold font-sans">
              * Head Coach, Manager, Analyst only can edit.
            </span>
          )}
        </h3>
      </div>

      {activeTab === "team_mgmt" ? (
        <div className="bg-[#0f172a] rounded-xl border border-slate-800 p-5 sm:p-6 shadow-xl space-y-6 text-white">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <Users className="h-4.5 w-4.5 text-cyan-400" />
                Register Custom League Teams
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Add external teams and assign them to a league division or as a friendly team.
              </p>
            </div>
          </div>

          <form onSubmit={handleAddTeam} className="grid gap-4 sm:grid-cols-2 items-end bg-slate-900 p-4 rounded-xl border border-slate-800">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wide">
                Team Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Ely Rangers Reserves"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                required
                className="w-full text-xs text-white bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 placeholder:text-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wide">
                Assigned League Division <span className="text-rose-400">*</span>
              </label>
              <select
                value={selectedLeague}
                onChange={(e) => setSelectedLeague(e.target.value)}
                className="w-full text-xs text-white bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              >
                <option value="CCFL Premier Division">CCFL Premier Division</option>
                <option value="CCFL First Division">CCFL First Division</option>
                <option value="CCFL Reserve Premier Division">CCFL Reserve Premier Division</option>
                <option value="CCFL Reserve First Division">CCFL Reserve First Division</option>
                <option value="Friendly Team">Friendly Team</option>
              </select>
            </div>

            <div className="sm:col-span-2 flex justify-end mt-2">
              <button
                type="submit"
                disabled={!teamName.trim()}
                className={`flex items-center gap-1.5 font-bold text-xs py-2 px-4 rounded-lg shadow-sm transition ${
                  !teamName.trim()
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                    : "bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer"
                }`}
              >
                <Plus className="h-4 w-4" />
                <span>Register & Add Team</span>
              </button>
            </div>
          </form>

          {/* Registered Teams Table */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Currently Registered Custom Teams ({customTeams.length})
            </h4>
            {customTeams.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-slate-400 text-xs font-sans">
                No custom teams have been registered yet. Add a team above to populate this list and automatically map them in match fixtures.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-800 shadow-md">
                <table className="w-full text-left border-collapse text-xs font-sans">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-bold bg-slate-950">
                      <th className="py-2.5 px-3">Official Team Name</th>
                      <th className="py-2.5 px-3">Assigned Division</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200 bg-slate-900">
                    {customTeams.map((team, idx) => (
                      <tr key={team.id || idx} className="hover:bg-slate-800/60 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-white">{team.name}</td>
                        <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            team.league === "Friendly Team" 
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" 
                              : "bg-slate-800 text-slate-300 border border-slate-700"
                          }`}>
                            {team.league}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-[#0f172a] rounded-xl border border-slate-800 p-5 shadow-xl space-y-4 text-white">
          {/* Bulk Action Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 rounded-xl">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-white">
                {activeTab === "pi" ? "Active Physical Indicators Checklist" : "Active Tactical KPIs Checklist"}
              </p>
              <p className="text-[10px] text-slate-400 font-sans">
                {isPlayer 
                  ? "View-only mode for players. Contact an administrator to modify checklist metrics." 
                  : "Only checked indicators will be compiled and displayed in your dashboards."}
              </p>
            </div>
            {!isPlayer && (
              <div className="flex items-center gap-2">
                <button
                  onClick={activeTab === "pi" ? selectAllPIs : selectAllKPIs}
                  className="px-3 py-1.5 text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-200 hover:border-cyan-500 rounded-lg hover:text-cyan-400 transition-colors cursor-pointer shadow-sm"
                >
                  Check All
                </button>
                <button
                  onClick={activeTab === "pi" ? selectNonePIs : selectNoneKPIs}
                  className="px-3 py-1.5 text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-200 hover:border-rose-500 rounded-lg hover:text-rose-400 transition-colors cursor-pointer shadow-sm"
                >
                  Uncheck All
                </button>
              </div>
            )}
          </div>

          {/* Spacious Grid layout for Checklist */}
          {activeTab === "pi" ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" id="pi-checklist-grid">
              {ALL_PIs.map((pi) => {
                const isChecked = checkedPIs.includes(pi.id);
                return (
                  <div
                    key={pi.id}
                    onClick={() => handleTogglePI(pi.id)}
                    className={`border rounded-xl p-3 flex items-start gap-3 transition-all select-none ${
                      isPlayer ? "cursor-default opacity-85" : "cursor-pointer hover:bg-slate-800/80"
                    } ${
                      isChecked 
                        ? "border-cyan-500/50 bg-cyan-950/20 shadow-sm" 
                        : "border-slate-800 bg-slate-900/60 opacity-60"
                    }`}
                  >
                    <div className="flex items-start gap-2.5 w-full">
                      <div className="mt-0.5 shrink-0">
                        {isChecked ? (
                          <CheckSquare className="h-4.5 w-4.5 text-cyan-400" />
                        ) : (
                          <Square className="h-4.5 w-4.5 text-slate-600" />
                        )}
                      </div>
                      <div className="space-y-1 text-left">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white">{pi.label}</span>
                          <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded-full border ${getCategoryColor(pi.category)}`}>
                            {pi.category}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-sans leading-tight">{pi.desc}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" id="kpi-checklist-grid">
              {ALL_KPIs.map((kpi) => {
                const isChecked = checkedKPIs.includes(kpi.id);
                return (
                  <div
                    key={kpi.id}
                    onClick={() => handleToggleKPI(kpi.id)}
                    className={`border rounded-xl p-3 flex items-start gap-3 transition-all select-none ${
                      isPlayer ? "cursor-default opacity-85" : "cursor-pointer hover:bg-slate-800/80"
                    } ${
                      isChecked 
                        ? "border-cyan-500/50 bg-cyan-950/20 shadow-sm" 
                        : "border-slate-800 bg-slate-900/60 opacity-60"
                    }`}
                  >
                    <div className="flex items-start gap-2.5 w-full">
                      <div className="mt-0.5 shrink-0">
                        {isChecked ? (
                          <CheckSquare className="h-4.5 w-4.5 text-[#1D4ED8]" />
                        ) : (
                          <Square className="h-4.5 w-4.5 text-slate-300" />
                        )}
                      </div>
                      <div className="space-y-1 text-left">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-[#0A2342]">{kpi.label}</span>
                          <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded-full border ${getCategoryColor(kpi.category)}`}>
                            {kpi.category}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-sans leading-tight">{kpi.desc}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
