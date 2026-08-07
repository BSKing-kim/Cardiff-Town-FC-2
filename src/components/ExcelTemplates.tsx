import React from "react";
import { ExcelUtils } from "../lib/excelUtils";
import { Download, FileSpreadsheet, Info, Shield, User } from "lucide-react";
import { UserProfile, UserRole } from "../types";
import BulkTeamImport from "./BulkTeamImport";
import PlayerStatsBulkImport from "./PlayerStatsBulkImport";

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
      id: "player-stats-template",
      title: "Player Stats Template",
      description: "Individual player performance stats template containing raw count metrics only (no percentage columns). Headers: username, match_id, goals, shots, shots_on_target, passes, successful_passes, backwards_passes, forwards_passes, long_passes, successful_long_passes, key_passes, successful_key_passes, through_balls, successful_through_balls, crosses, successful_crosses, dribbles, successful_dribbles, duels, duels_won, aerial_duels, aerial_duels_won, ground_duels, ground_duels_won, tackles, tackles_won, ball_recoveries, interceptions, clearances, blocks, own_goals, turnovers, miscontrols, unsuccessful_dribbles, possession_lost, offsides, fouls, yellow_cards, red_cards.",
      filename: "Player_Stats_Template.xlsx",
      icon: User,
      action: () => ExcelUtils.downloadPlayerStatsTemplate(),
    },
    {
      id: "league-teams-template",
      title: "League Teams Template",
      description: "Registration template for all league clubs and opponents. Team IDs are automatically assigned upon upload. Headers: Team Name (Mandatory), Short Name (Optional), Division (Optional), Home Venue (Optional).",
      filename: "League_Teams_Template.xlsx",
      icon: Shield,
      action: () => ExcelUtils.downloadLeagueTeamsTemplate(),
    }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 sm:p-6 shadow-xl space-y-6 text-white" id="excel-templates-viewport">
        {/* Header */}
        <div className="border-b border-slate-800 pb-4">
          <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-cyan-400" />
            Excel Spreadsheet Templates
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Download pre-formatted Excel spreadsheet templates to batch upload individual player performance stats and team data.
          </p>
        </div>

        {/* Information Banner */}
        <div className="bg-cyan-950/30 border border-cyan-800/40 rounded-xl p-4 flex items-start gap-3 text-slate-300">
          <Info className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold text-white">Spreadsheet Guidelines & Best Practices</p>
            <p className="text-slate-300 leading-relaxed">
              Please make sure not to alter the header columns of the downloaded files. Percentage metrics are calculated automatically by the system upon upload.
            </p>
            {!isAuthorized && (
              <p className="text-rose-400 font-bold mt-2">
                * Note: Only staff roles (Head Coach, Manager, Analyst, or Administrators) are permitted to upload completed data files.
              </p>
            )}
          </div>
        </div>

        {/* Templates Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
          {templates.map((tmpl) => {
            const IconComponent = tmpl.icon;
            return (
              <div 
                key={tmpl.id}
                className="border-2 border-dashed border-slate-700/80 hover:border-cyan-500/60 rounded-xl p-4 flex flex-col justify-between transition-all bg-slate-800/40 hover:bg-slate-800/70 shadow-md group"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="bg-cyan-500/15 border border-cyan-500/30 p-2.5 rounded-lg text-cyan-400 group-hover:scale-105 transition-transform">
                      <IconComponent className="h-4 w-4" />
                    </div>
                    <h3 className="font-display font-bold text-sm text-white">{tmpl.title}</h3>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{tmpl.description}</p>
                </div>

                <div className="pt-4 border-t border-slate-700/60 mt-4 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-mono font-medium truncate max-w-[160px]" title={tmpl.filename}>
                    {tmpl.filename}
                  </span>
                  <button
                    onClick={tmpl.action}
                    className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold py-1.5 px-3 rounded-lg transition duration-150 shadow-sm cursor-pointer shrink-0"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 1. Player Stats Bulk Import (Admin Center Only) - Directly ABOVE Team Bulk Import */}
      <PlayerStatsBulkImport currentUser={currentUser} onImportSuccess={onRefreshData} />

      {/* 2. Team Bulk Import */}
      <BulkTeamImport currentUser={currentUser} onTeamsUpdated={onRefreshData} />
    </div>
  );
}
