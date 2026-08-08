import React, { useState, useEffect } from "react";
import { UserProfile, UserRole, ProfileUpdateRequest, CustomTeam } from "../types";
import { DataService } from "../lib/dataService";
import BulkTeamImport from "./BulkTeamImport";
import ExcelTemplates from "./ExcelTemplates";
import { 
  Users, Shield, Check, UserCog, ShieldAlert, Database, Loader2, Sliders
} from "lucide-react";

interface AdminPanelProps {
  currentUser: UserProfile | null;
  users: (UserProfile & { passwordHash?: string })[];
  onRefreshUsers: () => void;
  onLogout?: () => void;
  customTeams?: CustomTeam[];
  onTeamsUpdated?: () => void;
}

interface PendingUserRequest {
  id: string;
  userId: string;
  username: string;
  fullName?: string;
  requestedRole: UserRole;
  status: string;
  createdAt: string;
  type?: "Join" | "RoleChange";
}

export default function AdminPanel({ 
  currentUser, 
  users, 
  onRefreshUsers, 
  customTeams = [], 
  onTeamsUpdated 
}: AdminPanelProps) {
  const [errorSec, setErrorSec] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Section 2: Registration Approval Requests
  const [applications, setApplications] = useState<PendingUserRequest[]>([]);
  const [resolvingAppId, setResolvingAppId] = useState<{ id: string; action: "approve" | "reject" } | null>(null);

  // Section 3: Profile Info Update Requests
  const [profileRequests, setProfileRequests] = useState<ProfileUpdateRequest[]>([]);
  const [resolvingProfileReqId, setResolvingProfileReqId] = useState<{ id: string; action: "approve" | "reject" } | null>(null);

  // Section 4: Database Sync
  const [isSyncingLocal, setIsSyncingLocal] = useState(false);

  // Section 5: Registered Players / Profiles List
  const [playersList, setPlayersList] = useState<any[]>([]);
  const [profilesList, setProfilesList] = useState<any[]>([]);
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);

  // Section 6: Teams List
  const [fetchedTeams, setFetchedTeams] = useState<CustomTeam[]>([]);

  useEffect(() => {
    loadApplications();
    loadProfileRequests();
    loadRosterAndTeams();
  }, [currentUser?.id]);

  const loadApplications = async () => {
    try {
      const pendingList = await DataService.getPendingUsersFromSupabase();
      setApplications(pendingList);
    } catch (err) {
      console.warn("Failed to load pending registration requests:", err);
    }
  };

  const loadProfileRequests = async () => {
    try {
      const reqs = await DataService.getProfileUpdateRequests(true);
      setProfileRequests(reqs);
    } catch (err) {
      console.warn("Failed to load profile update requests:", err);
    }
  };

  const loadRosterAndTeams = async () => {
    setIsLoadingRoster(true);
    try {
      const [players, profiles, teams] = await Promise.all([
        DataService.getPlayers(),
        DataService.getProfiles(),
        DataService.getCustomTeams()
      ]);
      setPlayersList(players);
      setProfilesList(profiles);
      setFetchedTeams(teams);
    } catch (err) {
      console.warn("Failed to load roster data:", err);
    } finally {
      setIsLoadingRoster(false);
    }
  };

  const handleApprovePendingUser = async (targetUserId: string, username?: string, appId?: string) => {
    try {
      setErrorSec("");
      setSuccessMsg("");
      setResolvingAppId({ id: appId || targetUserId, action: "approve" });

      await DataService.approvePendingUserAccount(targetUserId, username, appId);

      setSuccessMsg("User account approved successfully.");
      await loadApplications();
      await loadRosterAndTeams();
      if (onRefreshUsers) onRefreshUsers();
    } catch (err: any) {
      setErrorSec(err.message || "Failed to approve user registration.");
    } finally {
      setResolvingAppId(null);
    }
  };

  const handleRejectPendingUser = async (targetUserId: string, username?: string, appId?: string) => {
    try {
      setErrorSec("");
      setSuccessMsg("");
      setResolvingAppId({ id: appId || targetUserId, action: "reject" });

      await DataService.rejectPendingUserAccount(targetUserId, username, appId);

      setSuccessMsg("User registration request rejected.");
      await loadApplications();
      if (onRefreshUsers) onRefreshUsers();
    } catch (err: any) {
      setErrorSec(err.message || "Failed to reject user registration.");
    } finally {
      setResolvingAppId(null);
    }
  };

  const handleResolveProfileReq = async (requestId: string, approve: boolean, playerName: string) => {
    setResolvingProfileReqId({ id: requestId, action: approve ? "approve" : "reject" });
    try {
      setErrorSec("");
      setSuccessMsg("");
      if (approve) {
        await DataService.approveProfileUpdateRequest(requestId);
        setSuccessMsg(`Successfully approved profile update for ${playerName}.`);
      } else {
        await DataService.rejectProfileUpdateRequest(requestId);
        setSuccessMsg(`Rejected profile update request for ${playerName}.`);
      }
      await loadProfileRequests();
      if (onRefreshUsers) onRefreshUsers();
    } catch (err: any) {
      setErrorSec(`Failed to ${approve ? "approve" : "reject"} request: ` + (err.message || err));
    } finally {
      setResolvingProfileReqId(null);
    }
  };

  const handleSyncAllLocal = async () => {
    setIsSyncingLocal(true);
    setErrorSec("");
    setSuccessMsg("");
    try {
      const res = await DataService.syncAllLocalToSupabase();
      setSuccessMsg(`Local data synced to Supabase DB successfully! (${res.playersSynced} players, ${res.matchesSynced} matches, ${res.usersSynced} users, ${res.teamsSynced} custom teams synced).`);
      await loadRosterAndTeams();
    } catch (e: any) {
      setErrorSec("Failed to sync local data to database: " + (e.message || e));
    } finally {
      setIsSyncingLocal(false);
    }
  };

  const displayTeams = customTeams.length > 0 ? customTeams : fetchedTeams;

  return (
    <div className="space-y-6 font-sans text-[#f8fafc]" id="admin-panel-root">
      
      {/* Header */}
      <div className="border-b border-[#334155] pb-3">
        <h2 className="font-display text-xl sm:text-2xl font-black tracking-wide text-white flex items-center gap-2.5">
          <Sliders className="h-6 w-6 text-cyan-400" />
          <span>Admin Center</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          System administration and management hub for Cardiff Town FC analytics portal.
        </p>
      </div>

      {errorSec && (
        <div className="rounded-xl border border-rose-800/60 bg-rose-950/40 p-3.5 text-xs text-rose-300 flex items-center gap-2 font-sans font-semibold">
          <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />
          <span>{errorSec}</span>
        </div>
      )}

      {successMsg && (
        <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/40 p-3.5 text-xs text-emerald-300 flex items-center gap-2 font-sans font-semibold">
          <Check className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 1. Excel Templates Download / Upload */}
      <section className="rounded-2xl border border-[#334155] bg-[#0f172a] p-5 shadow-xl space-y-4">
        <div className="flex items-center gap-2 border-b border-[#334155] pb-3">
          <span className="bg-cyan-500/20 text-cyan-400 font-mono font-black px-2 py-0.5 rounded-md text-xs">1</span>
          <h3 className="font-display font-black text-sm text-white uppercase tracking-wider">
            Excel Templates Download / Upload
          </h3>
        </div>
        <ExcelTemplates currentUser={currentUser} />
      </section>

      {/* 2. Registration Approval Requests */}
      <section className="rounded-2xl border border-[#334155] bg-[#0f172a] overflow-hidden shadow-xl">
        <div className="bg-[#1e293b] border-b border-[#334155] px-4 py-3 flex items-center justify-between font-sans text-xs">
          <div className="flex items-center gap-2">
            <span className="bg-cyan-500/20 text-cyan-400 font-mono font-black px-2 py-0.5 rounded-md text-xs">2</span>
            <Shield className="h-4 w-4 text-cyan-400" />
            <h3 className="font-display font-black text-sm text-white uppercase tracking-wider">
              Registration Approval Requests
            </h3>
          </div>
          <span className="text-[10px] bg-cyan-950/60 text-cyan-400 font-bold border border-cyan-800/60 px-2.5 py-0.5 rounded-md uppercase tracking-wider">
            Staff Review
          </span>
        </div>

        <div className="p-4">
          {applications.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-3 text-center">No pending registration or role approval requests currently.</p>
          ) : (
            <div className="divide-y divide-[#334155]">
              {applications.map((app) => {
                const displayName = app.fullName || app.username || "User";
                const displayType = app.type === "Join" ? "Membership Registration" : "Role Elevation";
                return (
                  <div key={app.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs font-sans">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-sm">{displayName}</span>
                        {app.username && app.username !== displayName && (
                          <span className="text-[11px] text-slate-400">({app.username})</span>
                        )}
                        <span className={`inline-flex items-center rounded px-2 py-0.5 text-[9.5px] font-bold ${
                          app.type === "Join" 
                            ? "bg-blue-950/60 text-blue-400 border border-blue-800/60" 
                            : "bg-amber-950/60 text-amber-400 border border-amber-800/60"
                        }`}>
                          {displayType}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-300 flex items-center gap-1.5">
                        <span>Requested Role:</span>
                        <span className="inline-flex items-center rounded bg-cyan-950/80 border border-cyan-800/80 px-2 py-0.5 text-[10px] font-black text-cyan-400 uppercase tracking-wider">
                          {app.requestedRole || "Player"}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 font-mono">Submitted: {new Date(app.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        disabled={resolvingAppId?.id === app.id || resolvingAppId?.id === app.userId}
                        onClick={() => handleApprovePendingUser(app.userId, app.username, app.id)}
                        className="px-3.5 py-1.5 text-xs font-bold bg-emerald-950/80 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-800/80 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {(resolvingAppId?.id === app.id || resolvingAppId?.id === app.userId) && resolvingAppId.action === "approve" ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                            <span>Approving...</span>
                          </>
                        ) : (
                          <span>Approve</span>
                        )}
                      </button>
                      <button
                        disabled={resolvingAppId?.id === app.id || resolvingAppId?.id === app.userId}
                        onClick={() => handleRejectPendingUser(app.userId, app.username, app.id)}
                        className="px-3.5 py-1.5 text-xs font-bold bg-rose-950/80 text-rose-400 hover:bg-rose-600 hover:text-white border border-rose-800/80 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {(resolvingAppId?.id === app.id || resolvingAppId?.id === app.userId) && resolvingAppId.action === "reject" ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                            <span>Rejecting...</span>
                          </>
                        ) : (
                          <span>Reject</span>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 3. Profile Info Update Requests */}
      <section className="rounded-2xl border border-[#334155] bg-[#0f172a] overflow-hidden shadow-xl">
        <div className="bg-[#1e293b] border-b border-[#334155] px-4 py-3 flex items-center justify-between font-sans text-xs">
          <div className="flex items-center gap-2">
            <span className="bg-cyan-500/20 text-cyan-400 font-mono font-black px-2 py-0.5 rounded-md text-xs">3</span>
            <UserCog className="h-4 w-4 text-amber-400" />
            <h3 className="font-display font-black text-sm text-white uppercase tracking-wider">
              Profile Info Update Requests
            </h3>
          </div>
          <span className="text-[10px] bg-amber-950/60 text-amber-400 font-bold border border-amber-800/60 px-2.5 py-0.5 rounded-md uppercase tracking-wider">
            Pending Approval
          </span>
        </div>

        <div className="p-4">
          {profileRequests.filter(r => r.status === "pending").length === 0 ? (
            <p className="text-xs text-slate-400 italic py-3 text-center">No pending profile info update requests currently.</p>
          ) : (
            <div className="divide-y divide-[#334155]">
              {profileRequests.filter(r => r.status === "pending").map((req) => {
                const changes = req.requested_changes || {};
                const pos = changes.position || "N/A";
                const nationality = changes.nationality || "N/A";
                const foot = changes.preferred_foot || changes.preferredFoot || "N/A";
                const backNum = changes.squad_number || changes.squadNumber || changes.back_number || changes.jersey_number || "N/A";

                return (
                  <div key={req.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs font-sans">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-sm">{req.player_name || "Player"}</span>
                        <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-md font-semibold">
                          Pending Attribute Change
                        </span>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                        <span className="bg-[#1e293b] px-2.5 py-1 rounded-lg border border-[#334155]">
                          <strong className="text-slate-400">Position:</strong> {pos}
                        </span>
                        <span className="bg-[#1e293b] px-2.5 py-1 rounded-lg border border-[#334155]">
                          <strong className="text-slate-400">Nationality:</strong> {nationality}
                        </span>
                        <span className="bg-[#1e293b] px-2.5 py-1 rounded-lg border border-[#334155]">
                          <strong className="text-slate-400">Foot:</strong> {foot}
                        </span>
                        {backNum !== "N/A" && (
                          <span className="bg-[#1e293b] px-2.5 py-1 rounded-lg border border-[#334155]">
                            <strong className="text-slate-400">Squad #:</strong> {typeof backNum === 'string' && backNum.startsWith('#') ? backNum : `#${backNum}`}
                          </span>
                        )}
                      </div>

                      <p className="text-[10px] text-slate-400 font-mono">
                        Submitted: {new Date(req.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        disabled={resolvingProfileReqId?.id === req.id}
                        onClick={() => handleResolveProfileReq(req.id, true, req.player_name)}
                        className="px-3.5 py-1.5 text-xs font-bold bg-emerald-950/80 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-800/80 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {resolvingProfileReqId?.id === req.id && resolvingProfileReqId.action === "approve" ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                            <span>Approving...</span>
                          </>
                        ) : (
                          <span>Approve</span>
                        )}
                      </button>
                      <button
                        disabled={resolvingProfileReqId?.id === req.id}
                        onClick={() => handleResolveProfileReq(req.id, false, req.player_name)}
                        className="px-3.5 py-1.5 text-xs font-bold bg-rose-950/80 text-rose-400 hover:bg-rose-600 hover:text-white border border-rose-800/80 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {resolvingProfileReqId?.id === req.id && resolvingProfileReqId.action === "reject" ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                            <span>Rejecting...</span>
                          </>
                        ) : (
                          <span>Reject</span>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 4. Database Sync */}
      <section className="rounded-2xl border border-[#334155] bg-[#0f172a] p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-[#334155] pb-3">
          <div className="flex items-center gap-2">
            <span className="bg-cyan-500/20 text-cyan-400 font-mono font-black px-2 py-0.5 rounded-md text-xs">4</span>
            <Database className="h-4 w-4 text-emerald-400" />
            <h3 className="font-display font-black text-sm text-white uppercase tracking-wider">
              Database Sync
            </h3>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-white mb-0.5">Supabase Cloud Synchronization</p>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Push all locally stored browser data (Players, Matches, Fixtures, Custom Teams, User Profiles) directly into Supabase Cloud Database.
            </p>
          </div>
          <button
            disabled={isSyncingLocal}
            onClick={handleSyncAllLocal}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer shrink-0 shadow-lg"
          >
            {isSyncingLocal ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Syncing Local to Database...</span>
              </>
            ) : (
              <>
                <Database className="w-4 h-4 text-emerald-200" />
                <span>Push Local Storage Data to Supabase DB</span>
              </>
            )}
          </button>
        </div>
      </section>

      {/* 5. Registered Players */}
      <section className="rounded-2xl border border-[#334155] bg-[#0f172a] overflow-hidden shadow-xl">
        <div className="bg-[#1e293b] border-b border-[#334155] px-4 py-3 flex items-center justify-between font-sans text-xs">
          <div className="flex items-center gap-2">
            <span className="bg-cyan-500/20 text-cyan-400 font-mono font-black px-2 py-0.5 rounded-md text-xs">5</span>
            <Users className="h-4 w-4 text-cyan-400" />
            <h3 className="font-display font-black text-sm text-white uppercase tracking-wider">
              Registered Players
            </h3>
          </div>
          <span className="text-[10px] bg-cyan-950/60 text-cyan-400 font-bold border border-cyan-800/60 px-2.5 py-0.5 rounded-md uppercase font-mono">
            {profilesList.length > 0 ? profilesList.length : playersList.filter(p => typeof p?.id === 'string' && !p.id.toUpperCase().startsWith("OPP")).length} Profiles
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-sans text-xs">
            <thead>
              <tr className="border-b border-[#334155] bg-[#0b0f19] text-[9.5px] uppercase tracking-wider text-slate-400 font-bold font-sans">
                <th className="py-3 px-4">Player Name</th>
                <th className="py-3 px-4 font-mono">Player ID</th>
                <th className="py-3 px-4">Position</th>
                <th className="py-3 px-4">Foot</th>
                <th className="py-3 px-4">Nationality</th>
                <th className="py-3 px-4">Role / Division</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#334155] text-slate-300">
              {isLoadingRoster ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center">
                    <Loader2 className="h-6 w-6 animate-spin text-cyan-400 mx-auto mb-2" />
                    <span className="text-xs text-slate-400 font-mono">Loading squad players...</span>
                  </td>
                </tr>
              ) : profilesList.length === 0 && playersList.filter(p => typeof p?.id === 'string' && !p.id.toUpperCase().startsWith("OPP")).length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400 italic">
                    No registered player profiles found in database.
                  </td>
                </tr>
              ) : profilesList.length > 0 ? (
                profilesList.map((prof) => (
                  <tr key={prof.id} className="hover:bg-[#1e293b]/60 transition-colors">
                    <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      <span>{prof.full_name || prof.username}</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-cyan-400 font-bold">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-700/80 text-cyan-300 text-xs font-mono font-bold">
                        {prof.player_id || prof.id || prof.username}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-bold">
                      {prof.position || "CM"}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {prof.preferred_foot || "Right"}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {prof.nationality || "-"}
                    </td>
                    <td className="py-3 px-4 text-amber-400 font-semibold">
                      {prof.role || "CCFL First"}
                    </td>
                  </tr>
                ))
              ) : (
                playersList
                  .filter(p => typeof p?.id === 'string' && !p.id.toUpperCase().startsWith("OPP"))
                  .map((p) => (
                    <tr key={p.id} className="hover:bg-[#1e293b]/60 transition-colors">
                      <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                        <span>{p.name}</span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-300">
                        {p.id}
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-bold">
                        #{p.backNumber} {p.position}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {p.preferredFoot || "Right"}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {p.nationality || "-"}
                      </td>
                      <td className="py-3 px-4 text-amber-400 font-semibold">
                        {p.division || "CCFL First"}
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 6. Registered Squads */}
      <section className="rounded-2xl border border-[#334155] bg-[#0f172a] overflow-hidden shadow-xl">
        <div className="bg-[#1e293b] border-b border-[#334155] px-4 py-3 flex items-center justify-between font-sans text-xs">
          <div className="flex items-center gap-2">
            <span className="bg-cyan-500/20 text-cyan-400 font-mono font-black px-2 py-0.5 rounded-md text-xs">6</span>
            <Shield className="h-4 w-4 text-amber-400" />
            <h3 className="font-display font-black text-sm text-white uppercase tracking-wider">
              Registered Squads
            </h3>
          </div>
          <span className="text-[10px] bg-amber-950/60 text-amber-400 font-bold border border-amber-800/60 px-2.5 py-0.5 rounded-md uppercase font-mono">
            {displayTeams.length} Registered Teams
          </span>
        </div>

        <div className="p-4">
          {displayTeams.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-3 text-center">No custom teams registered in the database yet. Use Team Upload below to register teams.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#334155]">
              <table className="w-full text-left border-collapse text-xs font-sans">
                <thead>
                  <tr className="border-b border-[#334155] bg-[#0b0f19] text-[9.5px] uppercase tracking-wider text-slate-400 font-bold font-sans">
                    <th className="py-2.5 px-4">Official Team Name</th>
                    <th className="py-2.5 px-4">Assigned Division</th>
                    <th className="py-2.5 px-4 font-mono">Team Code / ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#334155] text-slate-200 bg-[#0f172a]">
                  {displayTeams.map((team, idx) => (
                    <tr key={team.id || idx} className="hover:bg-[#1e293b]/60 transition-colors">
                      <td className="py-3 px-4 font-bold text-white">{team.name}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold ${
                          team.league === "Friendly Team" 
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" 
                            : "bg-[#1e293b] text-cyan-300 border border-cyan-800/50"
                        }`}>
                          {team.league || "CCFL Division"}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400 text-xs">{team.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* 7. Team Upload */}
      <section className="rounded-2xl border border-[#334155] bg-[#0f172a] p-5 shadow-xl space-y-4">
        <div className="flex items-center gap-2 border-b border-[#334155] pb-3">
          <span className="bg-cyan-500/20 text-cyan-400 font-mono font-black px-2 py-0.5 rounded-md text-xs">7</span>
          <h3 className="font-display font-black text-sm text-white uppercase tracking-wider">
            Team Upload
          </h3>
        </div>
        <BulkTeamImport 
          currentUser={currentUser} 
          onTeamsUpdated={() => {
            loadRosterAndTeams();
            if (onTeamsUpdated) onTeamsUpdated();
          }} 
        />
      </section>

    </div>
  );
}
