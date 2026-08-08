import React from "react";
import { ExcelUtils } from "../lib/excelUtils";
import { Download, FileSpreadsheet, Info, Calendar, Users, User, BarChart3 } from "lucide-react";
import { UserProfile, UserRole } from "../types";
import BulkTeamImport from "./BulkTeamImport";
import PlayerStatsBulkImport from "./PlayerStatsBulkImport";
import TeamStatsBulkImport from "./TeamStatsBulkImport";

interface ExcelTemplatesProps {
  currentUser: UserProfile | null;
  onRefreshData?: () => void;
}

export default function ExcelTemplates({ currentUser, onRefreshData }: ExcelTemplatesProps) {
  const isAuthorized = currentUser && (
    currentUser.role === UserRole.HeadCoach ||
    currentUser.role === UserRole.Manager ||
    currentUser.role === UserRole.Analyst ||
    currentUser.isAdmin
  );

  const templates = [
    {
      id: "team-stats-template",
      title: "Team Stats Template",
      description: "Dedicated batch upload template for our team's match statistics into public.team_stats. Clean header structure without bottom instruction text. Headers: match_id, date, opponent, home_away, our_score, opponent_score, possession, goals, shots, shots_on_target, passes, successful_passes, backwards_passes, forwards_passes, long_passes, successful_long_passes, key_passes, successful_key_passes, through_balls, successful_through_balls, crosses, successful_crosses, dribbles, successful_dribbles, duels, duels_won, aerial_duels, aerial_duels_won, ground_duels, ground_duels_won, ball_recoveries, tackles, tackles_won, interceptions, clearances, blocks, own_goals, turnovers, miscontrols, unsuccessful_dribbles, possession_lost, offsides, fouls, yellow_cards, red_cards.",
      filename: "Team_Stats_Template.xlsx",
      icon: BarChart3,
      action: () => ExcelUtils.downloadTeamStatsTemplate(),
    },
    {
      id: "player-performance-template",
      title: "Player Performance Template",
      description: "Single-match player performance stats template containing raw count metrics only. NO percentage (%) columns. Headers: username, match_id, goals, shots, shots_on_target, passes, successful_passes, backwards_passes, forwards_passes, long_passes, successful_long_passes, key_passes, successful_key_passes, through_balls, successful_through_balls, crosses, successful_crosses, dribbles, successful_dribbles, duels, duels_won, aerial_duels, aerial_duels_won, ground_duels, ground_duels_won, ball_recoveries, tackles, tackles_won, interceptions, clearances, blocks, own_goals, turnovers, miscontrols, unsuccessful_dribbles, possession_lost, offsides, fouls, yellow_cards, red_cards.",
      filename: "Player_Performance_Template.xlsx",
      icon: User,
      action: () => ExcelUtils.downloadPlayerPerformanceTemplate(),
    },
    {
      id: "match-fixtures-template",
      title: "Match Fixtures Template",
      description: "Single-row batch upload template for detailed match stats. Each match is 1 row containing both Our Team metrics and Opponent metrics (opp_ prefix). Headers: match_id, date, opponent, home_away, our_score, opponent_score, status, possession, opp_possession, goals, shots, shots_on_target, passes, successful_passes, backwards_passes, forwards_passes, long_passes, successful_long_passes, key_passes, successful_key_passes, through_balls, successful_through_balls, crosses, successful_crosses, dribbles, successful_dribbles, duels, duels_won, aerial_duels, aerial_duels_won, ground_duels, ground_duels_won, ball_recoveries, tackles, tackles_won, interceptions, clearances, blocks, own_goals, turnovers, miscontrols, unsuccessful_dribbles, possession_lost, offsides, fouls, yellow_cards, red_cards, opp_goals, opp_shots, opp_shots_on_target, opp_passes, opp_successful_passes, opp_backwards_passes, opp_forwards_passes, opp_long_passes, opp_successful_long_passes, opp_key_passes, opp_successful_key_passes, opp_through_balls, opp_successful_through_balls, opp_crosses, opp_successful_crosses, opp_dribbles, opp_successful_dribbles, opp_duels, opp_duels_won, opp_aerial_duels, opp_aerial_duels_won, opp_ground_duels, opp_ground_duels_won, opp_ball_recoveries, opp_tackles, opp_tackles_won, opp_interceptions, opp_clearances, opp_blocks, opp_own_goals, opp_turnovers, opp_miscontrols, opp_unsuccessful_dribbles, opp_possession_lost, opp_offsides, opp_fouls, opp_yellow_cards, opp_red_cards. NO percentage (%) columns.",
      filename: "Match_Fixtures_Template.xlsx",
      icon: Calendar,
      action: () => ExcelUtils.downloadMatchFixturesTemplate(),
    },
    {
      id: "team-roster-template",
      title: "Team Roster Template",
      description: "Batch registration template for club members, players, and coaching staff. Headers: full_name, username, role, position, shirt_number, squad_status.",
      filename: "Team_Roster_Template.xlsx",
      icon: Users,
      action: () => ExcelUtils.downloadTeamRosterTemplate(),
    }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 sm:p-6 shadow-xl space-y-6 text-white" id="excel-templates-viewport">
        {/* Header */}
        <div className="border-b border-slate-800 pb-4">
          <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-cyan-400" />
            3 Dedicated Excel Spreadsheet Templates
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Download pre-formatted Excel templates for Player Performance Stats, Match Fixture Schedules, and Team Rosters.
          </p>
        </div>

        {/* Information Banner */}
        <div className="bg-cyan-950/30 border border-cyan-800/40 rounded-xl p-4 flex items-start gap-3 text-slate-300">
          <Info className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold text-white">Spreadsheet Guidelines & Best Practices</p>
            <p className="text-slate-300 leading-relaxed">
              Please do not alter header names. In accordance with strict analytics rules, percentage (%) metrics are strictly calculated automatically by the system upon import.
            </p>
            {!isAuthorized && (
              <p className="text-rose-400 font-bold mt-2">
                * Note: Only staff roles (Head Coach, Manager, Analyst, or Administrators) are permitted to upload completed data files.
              </p>
            )}
          </div>
        </div>

        {/* Templates Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {templates.map((tmpl) => {
            const IconComponent = tmpl.icon;
            return (
              <div 
                key={tmpl.id}
                className="border-2 border-dashed border-slate-700/80 hover:border-cyan-500/60 rounded-xl p-4 flex items-center justify-between transition-all bg-slate-800/40 hover:bg-slate-800/70 shadow-md group gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="bg-cyan-500/15 border border-cyan-500/30 p-2.5 rounded-lg text-cyan-400 group-hover:scale-105 transition-transform shrink-0">
                    <IconComponent className="h-4 w-4" />
                  </div>
                  <h3 className="font-display font-bold text-sm text-white truncate" title={tmpl.title}>{tmpl.title}</h3>
                </div>

                <button
                  onClick={tmpl.action}
                  className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold py-1.5 px-3 rounded-lg transition duration-150 shadow-sm cursor-pointer shrink-0"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 1. Dedicated Team Stats Bulk Import (uses Team_Stats_Template.xlsx) */}
      <TeamStatsBulkImport currentUser={currentUser} onImportSuccess={onRefreshData} />

      {/* 2. Player Stats Bulk Import (uses Player_Performance_Template.xlsx) */}
      <PlayerStatsBulkImport currentUser={currentUser} onImportSuccess={onRefreshData} />

      {/* 3. Team & Roster Bulk Import (uses Team_Roster_Template.xlsx) */}
      <BulkTeamImport currentUser={currentUser} onTeamsUpdated={onRefreshData} />
    </div>
  );
}
