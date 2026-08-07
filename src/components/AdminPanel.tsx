import React, { useState, useEffect } from "react";
import { UserProfile, UserRole, ProfileUpdateRequest } from "../types";
import { DataService } from "../lib/dataService";
import BulkTeamImport from "./BulkTeamImport";
import { 
  Users, Shield, Check, Trash2, ArrowUpDown, 
  UserCog, Award, UserCheck, ShieldAlert, Key, UserPlus, HelpCircle, Database, Loader2, CheckCircle2
} from "lucide-react";

interface AdminPanelProps {
  currentUser: UserProfile | null;
  users: (UserProfile & { passwordHash?: string })[];
  onRefreshUsers: () => void;
  onLogout?: () => void;
}

interface RoleApplication {
  id: string;
  userId: string;
  username: string;
  requestedRole: UserRole;
  status: string; // "pending" | "approved" | "rejected"
  createdAt: string;
  type?: "Join" | "RoleChange";
}

export default function AdminPanel({ currentUser, users, onRefreshUsers, onLogout }: AdminPanelProps) {
  const [errorSec, setErrorSec] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Database Management states
  const [viewingDatabaseList, setViewingDatabaseList] = useState(false);
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [isLoadingFixtures, setIsLoadingFixtures] = useState(false);
  const [playersList, setPlayersList] = useState<any[]>([]);
  const [profilesList, setProfilesList] = useState<any[]>([]);
  const [isSyncingLocal, setIsSyncingLocal] = useState(false);

  const handleSyncAllLocal = async () => {
    setIsSyncingLocal(true);
    setErrorSec("");
    setSuccessMsg("");
    try {
      const res = await DataService.syncAllLocalToSupabase();
      setSuccessMsg(`Local data synced to Supabase DB successfully! (${res.playersSynced} players, ${res.matchesSynced} matches, ${res.fixturesSynced} fixtures, ${res.usersSynced} users, ${res.teamsSynced} custom teams synced).`);
      await loadFixtures();
    } catch (e: any) {
      setErrorSec("Failed to sync local data to database: " + (e.message || e));
    } finally {
      setIsSyncingLocal(false);
    }
  };

  // Role application states
  const [applications, setApplications] = useState<RoleApplication[]>([]);
  const [myApplication, setMyApplication] = useState<RoleApplication | null>(null);
  const [resolvingAppId, setResolvingAppId] = useState<{ id: string; action: "approve" | "reject" } | null>(null);

  // Profile update request states
  const [profileRequests, setProfileRequests] = useState<ProfileUpdateRequest[]>([]);
  const [resolvingProfileReqId, setResolvingProfileReqId] = useState<{ id: string; action: "approve" | "reject" } | null>(null);

  // Password change states
  const [prevPassword, setPrevPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isShaking, setIsShaking] = useState(false);

  const isCurrentAdmin = currentUser?.isAdmin === true;

  // Existing Coach, Manager, Analyst can review and approve/reject applications
  const canReviewApplications = currentUser && (
    currentUser.role === UserRole.HeadCoach ||
    currentUser.role === UserRole.Manager ||
    currentUser.role === UserRole.Analyst ||
    currentUser.isAdmin
  );

  const handleDeleteAccount = async () => {
    if (!currentUser) return;
    setIsDeleting(true);
    try {
      setErrorSec("");
      setSuccessMsg("");
      await DataService.deleteAccount(currentUser.id);
      if (onLogout) {
        onLogout();
      } else {
        window.location.reload();
      }
    } catch (err: any) {
      setErrorSec("Failed to delete account: " + err.message);
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    loadApplications();
    loadFixtures();
    loadProfileRequests();
    DataService.syncLocalUsersToSupabase()
      .then(() => DataService.getProfiles())
      .then(p => setProfilesList(p))
      .catch(err => console.warn("Auto sync cached members warning:", err));
  }, [currentUser?.id]);

  const loadProfileRequests = async () => {
    try {
      const reqs = await DataService.getProfileUpdateRequests(true);
      setProfileRequests(reqs);
    } catch (err) {
      console.warn("Failed to load profile update requests:", err);
    }
  };

  const handleResolveProfileReq = async (requestId: string, approve: boolean, playerName: string) => {
    setResolvingProfileReqId({ id: requestId, action: approve ? "approve" : "reject" });
    try {
      setErrorSec("");
      setSuccessMsg("");
      if (approve) {
        await DataService.approveProfileUpdateRequest(requestId);
        setSuccessMsg(`Successfully approved profile attribute update for ${playerName}. Changes applied to profile.`);
      } else {
        await DataService.rejectProfileUpdateRequest(requestId);
        setSuccessMsg(`Rejected profile attribute update request for ${playerName}.`);
      }
      await loadProfileRequests();
      if (onRefreshUsers) onRefreshUsers();
    } catch (err: any) {
      setErrorSec(`Failed to ${approve ? "approve" : "reject"} request: ` + (err.message || err));
    } finally {
      setResolvingProfileReqId(null);
    }
  };

  const loadFixtures = async () => {
    setIsLoadingFixtures(true);
    try {
      const [list, players, profiles] = await Promise.all([
        DataService.getFixtures(),
        DataService.getPlayers(),
        DataService.getProfiles()
      ]);
      // Keep only those that have status === "Played"
      setFixtures(list.filter(f => f.status === "Played"));
      setPlayersList(players);
      setProfilesList(profiles);
    } catch (err) {
      console.warn("Failed to load data for database management:", err);
    } finally {
      setIsLoadingFixtures(false);
    }
  };

  const handleRevertUpload = async (fixtureId: string, opponent: string) => {
    if (!window.confirm(`Are you sure you want to delete the uploaded database files/stats for match vs "${opponent}"? This will revert the fixture to 'Upcoming' and wipe all statistics.`)) {
      return;
    }
    try {
      setErrorSec("");
      setSuccessMsg("");
      await DataService.revertFixtureUpload(fixtureId);
      setSuccessMsg(`Successfully deleted uploaded file data for match vs ${opponent}. The fixture has been reverted to Upcoming.`);
      await loadFixtures();
      if (onRefreshUsers) {
        onRefreshUsers();
      }
    } catch (err: any) {
      setErrorSec("Failed to delete uploaded match data: " + err.message);
    }
  };

  const loadApplications = async () => {
    try {
      const apps = await DataService.getApplications();
      setApplications(apps);
      
      if (currentUser) {
        const myApp = apps.find((a: RoleApplication) => a.userId === currentUser.id && a.status === "pending");
        setMyApplication(myApp || null);
      }
    } catch (err) {
      console.warn("Failed to load applications:", err);
    }
  };

  // Role weights to sort exactly as: Head Coach, Manager, Analysts, then Player
  const getRoleWeight = (role: UserRole) => {
    switch (role) {
      case UserRole.HeadCoach: return 1;
      case UserRole.Manager: return 2;
      case UserRole.Analyst: return 3;
      case UserRole.Player: return 4;
      default: return 5;
    }
  };

  // Sort user profiles: exactly by role preference weight, then by date created
  const sortedUsers = [...users].sort((a, b) => {
    const wA = getRoleWeight(a.role);
    const wB = getRoleWeight(b.role);
    if (wA !== wB) return wA - wB;
    return a.username.localeCompare(b.username);
  });

  // Promote/Demote roles
  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (!isCurrentAdmin) {
      setErrorSec("You do not have permission to change user roles. Only administrators can perform this action.");
      return;
    }

    try {
      setErrorSec("");
      setSuccessMsg("");
      await DataService.updateUserPermission(userId, { role: newRole });
      setSuccessMsg("The user's tactical role preference has been adjusted successfully.");
      onRefreshUsers();
    } catch (err) {
      setErrorSec("An error occurred while updating user permissions.");
    }
  };

  // Toggle admin access
  const handleAdminToggle = async (userId: string, currentAdminState: boolean) => {
    if (!isCurrentAdmin) {
      setErrorSec("You do not have permission to manage administrator approvals.");
      return;
    }

    // Disable self-demotion to prevent lock-out
    if (userId === currentUser?.id) {
      setErrorSec("You cannot demote your own administrator status.");
      return;
    }

    try {
      setErrorSec("");
      setSuccessMsg("");
      await DataService.updateUserPermission(userId, { isAdmin: !currentAdminState });
      setSuccessMsg(currentAdminState ? "Successfully revoked Excel upload & privileges from this user." : "Successfully granted Excel upload & privileges to this user.");
      onRefreshUsers();
    } catch (err) {
      setErrorSec("Permission synchronization failed.");
    }
  };

  // Delete user account
  const handleDeleteUser = async (userId: string, targetName: string) => {
    if (!isCurrentAdmin) {
      setErrorSec("You do not have permission to delete user accounts.");
      return;
    }

    if (userId === currentUser?.id) {
      setErrorSec("You cannot delete your own active account.");
      return;
    }
    
    // Prevent deleting predefined minwoo admin account
    if (targetName === "minwoo6647") {
      setErrorSec("The built-in system administrator (minwoo6647) account cannot be deleted.");
      return;
    }

    if (!window.confirm(`Are you sure you want to completely block and remove "${targetName}" from the portal?`)) {
      return;
    }

    try {
      setErrorSec("");
      setSuccessMsg("");
      await DataService.deleteUser(userId);
      setSuccessMsg(`Successfully deleted target user profile: ${targetName}`);
      onRefreshUsers();
    } catch (err: any) {
      setErrorSec("An error occurred while removing the user account: " + err.message);
    }
  };

  // Reset user password to default "cardifftownfc1!"
  const handleResetPassword = async (userId: string, targetName: string) => {
    if (!isCurrentAdmin) {
      setErrorSec("You do not have permission to reset user passwords.");
      return;
    }

    if (userId === currentUser?.id) {
      setErrorSec("You cannot reset your own password here. Please use the Settings tab instead.");
      return;
    }

    if (!window.confirm(`Are you sure you want to reset the password for "${targetName}"? It will be changed to the default "cardifftownfc1!"`)) {
      return;
    }

    try {
      setErrorSec("");
      setSuccessMsg("");
      await DataService.resetUserPassword(userId);
      setSuccessMsg(`Successfully reset password for "${targetName}" to "cardifftownfc1!"`);
      alert(`The password for "${targetName}" has been successfully reset to: cardifftownfc1!`);
      onRefreshUsers();
    } catch (err: any) {
      setErrorSec(err.message || "An error occurred while resetting the password.");
    }
  };

  // Apply for a role workflow
  const handleApplyRole = async (requestedRole: UserRole) => {
    if (!currentUser) return;
    try {
      setErrorSec("");
      setSuccessMsg("");
      await DataService.applyForRole(currentUser.id, currentUser.username, requestedRole);
      setSuccessMsg(`Your application for ${requestedRole} has been submitted for staff review.`);
      await loadApplications();
    } catch (err: any) {
      setErrorSec(err.message || "Failed to submit role application.");
    }
  };

  // Resolve applications (Approve / Reject)
  const handleResolveApp = async (appId: string, approve: boolean, userName?: string) => {
    try {
      setErrorSec("");
      setSuccessMsg("");
      setResolvingAppId({ id: appId, action: approve ? "approve" : "reject" });

      await DataService.resolveApplication(appId, approve);

      const targetName = userName || "User";
      const msg = approve 
        ? `${targetName} has been approved successfully!` 
        : `Application for ${targetName} has been rejected.`;

      setSuccessMsg(msg);
      await loadApplications();
      onRefreshUsers();

      try {
        const updatedProfiles = await DataService.getProfiles();
        setProfilesList(updatedProfiles);
      } catch (pe) {}
    } catch (err: any) {
      setErrorSec(err.message || "Failed to resolve application.");
    } finally {
      setResolvingAppId(null);
    }
  };

  // Password Change Handler with shake on incorrect current password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorSec("");
    setSuccessMsg("");

    if (!currentUser) return;

    if (!prevPassword || !newPassword || !confirmPassword) {
      setErrorSec("Please fill in all password fields.");
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 400);
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorSec("The confirmed password does not match the new password.");
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 400);
      return;
    }

    try {
      await DataService.changePassword(currentUser.id, prevPassword, newPassword);
      setSuccessMsg("Your password has been changed successfully.");
      setPrevPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setErrorSec(err.message || "An error occurred while updating the password.");
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 400);
    }
  };

  if (viewingDatabaseList) {
    return (
      <div className="space-y-6 animate-fadeIn" id="database-manager-root">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Database className="h-5.5 w-5.5 text-cyan-400" />
            Database & Uploaded Files Manager
          </h2>
          <button
            onClick={() => {
              setErrorSec("");
              setSuccessMsg("");
              setViewingDatabaseList(false);
            }}
            className="no-print px-3 py-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors cursor-pointer shadow-sm border border-slate-700"
          >
            ← Back to Profile
          </button>
        </div>

        {errorSec && (
          <div className="rounded-xl border border-rose-800/60 bg-rose-950/40 p-3.5 text-xs text-rose-300 flex items-center gap-2 font-sans font-semibold">
            <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />
            {errorSec}
          </div>
        )}

        {successMsg && (
          <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/40 p-3.5 text-xs text-emerald-300 flex items-center gap-2 font-sans font-semibold">
            <Check className="h-4 w-4 text-emerald-400 shrink-0" />
            {successMsg}
          </div>
        )}

        {/* Database List Card */}
        <div className="rounded-xl border border-slate-800 bg-[#0f172a] overflow-hidden shadow-xl">
          <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between font-sans text-xs">
            <div className="flex items-center gap-2 font-bold text-white">
              <Database className="h-4 w-4 text-amber-400" />
              <span>Uploaded Match Databases ({fixtures.length} matches)</span>
            </div>
            <span className="text-[9.5px] bg-amber-500/10 text-amber-400 font-bold border border-amber-500/30 px-2 py-0.5 rounded-full uppercase font-mono">
              Spreadsheets
            </span>
          </div>

          {isLoadingFixtures ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
            </div>
          ) : fixtures.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-sans">
              No match statistics databases have been uploaded yet. Please upload stats under the Matches schedule tab.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950 text-[9px] uppercase tracking-wider text-slate-400 font-mono font-bold">
                    <th className="py-2.5 px-4">Upload / Match Date</th>
                    <th className="py-2.5 px-4">Match matchup (who vs who)</th>
                    <th className="py-2.5 px-4 text-center">Score Result</th>
                    <th className="py-2.5 px-4 text-right">Delete Upload</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-xs font-sans text-slate-200">
                  {fixtures.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-white">{f.date}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 text-white font-semibold">
                          <span>Cardiff Town FC</span>
                          <span className="text-slate-400 font-normal text-[10px]">vs</span>
                          <span>{f.opponent}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center rounded-lg bg-slate-900 border border-amber-500/30 text-amber-300 px-2.5 py-1 font-mono font-bold text-xs">
                          {f.ourScore} : {f.oppScore}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleRevertUpload(f.id, f.opponent)}
                          className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg transition-colors cursor-pointer"
                          title="Delete match spreadsheet data & revert schedule to upcoming"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="profile-panel-root">
      
      {/* Unified Header matching other screens */}
      <div className="border-b border-slate-800 pb-3">
        <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <UserCog className="h-5.5 w-5.5 text-cyan-400" />
          Staff Profile & Directory
        </h2>
      </div>

      {errorSec && (
        <div className="rounded-xl border border-rose-800/60 bg-rose-950/40 p-3.5 text-xs text-rose-300 flex items-center gap-2 font-sans font-semibold">
          <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />
          {errorSec}
        </div>
      )}

      {successMsg && (
        <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/40 p-3.5 text-xs text-emerald-300 flex items-center gap-2 font-sans font-semibold">
          <Check className="h-4 w-4 text-emerald-400 shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Grid: Left Column for personal details and application buttons, Right Column for Change Password */}
      <div className="grid gap-6 md:grid-cols-2">
        
        {/* Left Card: Personal Profile Status */}
        <div className="rounded-xl border border-slate-800 bg-[#0f172a] p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5 mb-3.5">
              <UserCheck className="h-4.5 w-4.5 text-cyan-400" />
              <h3 className="font-display font-bold text-xs text-white uppercase tracking-wider">Your Credentials</h3>
            </div>

            <div className="space-y-3 text-xs text-slate-300 font-sans">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="font-medium text-slate-400">Full Name</span>
                <span className="font-bold text-white">
                  {currentUser?.firstName && currentUser?.lastName 
                    ? `${currentUser.firstName} ${currentUser.lastName}` 
                    : "Not Configured"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="font-medium text-slate-400">Username</span>
                <span className="font-mono font-bold text-cyan-300">{currentUser?.username}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="font-medium text-slate-400">Assigned Position</span>
                <span className="inline-flex items-center gap-1 rounded-md bg-cyan-950/60 text-cyan-400 font-bold border border-cyan-800/60 px-2 py-0.5 text-[10px] uppercase">
                  {currentUser?.role}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="font-medium text-slate-400">Database Status</span>
                <span className={`font-bold ${currentUser?.isAdmin ? "text-emerald-400" : "text-slate-400"}`}>
                  {currentUser?.isAdmin ? "Admin / Write Access" : "Player Access Only"}
                </span>
              </div>
            </div>
          </div>

          {/* Role Applications Buttons Panel */}
          <div className="mt-5 pt-4 border-t border-slate-800">
            <p className="text-[10px] font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-1">
              <UserPlus className="h-3.5 w-3.5 text-cyan-400" />
              Apply for Tactical Position Update
            </p>

            {myApplication ? (
              <div className="rounded-lg bg-amber-950/40 border border-amber-800/60 p-2.5 text-[11px] text-amber-200 font-sans">
                <p className="font-semibold">Application Pending Review</p>
                <p className="mt-0.5 text-amber-300">
                  You requested the position of <strong className="font-bold text-white">{myApplication.requestedRole}</strong> on {new Date(myApplication.createdAt).toLocaleDateString()}.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[10.5px] text-slate-400 font-sans">
                  Request elevated system credentials to contribute to match analysis or update squad listings.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleApplyRole(UserRole.HeadCoach)}
                    disabled={currentUser?.role === UserRole.HeadCoach}
                    className="px-2.5 py-1.5 text-[10px] font-bold rounded-lg bg-slate-800 hover:bg-cyan-600 border border-slate-700 text-slate-200 hover:text-white transition-colors cursor-pointer shadow-sm disabled:opacity-40 disabled:pointer-events-none"
                  >
                    Apply for Coach
                  </button>
                  <button
                    onClick={() => handleApplyRole(UserRole.Manager)}
                    disabled={currentUser?.role === UserRole.Manager}
                    className="px-2.5 py-1.5 text-[10px] font-bold rounded-lg bg-slate-800 hover:bg-cyan-600 border border-slate-700 text-slate-200 hover:text-white transition-colors cursor-pointer shadow-sm disabled:opacity-40 disabled:pointer-events-none"
                  >
                    Apply for Manager
                  </button>
                  <button
                    onClick={() => handleApplyRole(UserRole.Analyst)}
                    disabled={currentUser?.role === UserRole.Analyst}
                    className="px-2.5 py-1.5 text-[10px] font-bold rounded-lg bg-slate-800 hover:bg-cyan-600 border border-slate-700 text-slate-200 hover:text-white transition-colors cursor-pointer shadow-sm disabled:opacity-40 disabled:pointer-events-none"
                  >
                    Apply for Analyst
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Card: Change Password Form */}
        <div className="rounded-xl border border-slate-800 bg-[#0f172a] p-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3.5">
            <div className="flex items-center gap-2">
              <Key className="h-4.5 w-4.5 text-cyan-400" />
              <h3 className="font-display font-bold text-xs text-white uppercase tracking-wider">Change Portal Password</h3>
            </div>
            {currentUser?.username !== "minwoo6647" && currentUser?.role !== UserRole.Player && !showDeleteConfirm && (
              <button
                type="button"
                onClick={() => {
                  setErrorSec("");
                  setSuccessMsg("");
                  setShowDeleteConfirm(true);
                }}
                className="text-[10px] font-bold text-rose-400 hover:text-rose-300 hover:underline transition-colors cursor-pointer"
              >
                Delete Account
              </button>
            )}
          </div>

          {showDeleteConfirm ? (
            <div className="space-y-4 animate-fadeIn">
              <div className="rounded-lg border border-rose-800/60 bg-rose-950/40 p-3 text-xs text-rose-200 font-sans space-y-2">
                <p className="font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 text-rose-400" />
                  Warning: Irreversible Action
                </p>
                <p className="leading-relaxed">
                  You will <strong>no longer have access</strong> to this portal. Your profile and any active tactical credentials will be completely erased.
                </p>
                <p className="leading-relaxed">
                  To log back into this portal in the future, you must <strong>register a new account</strong> and obtain team staff approval again.
                </p>
              </div>

              <div className="text-xs text-white font-semibold font-sans">
                Are you absolutely sure you want to delete your account?
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleDeleteAccount}
                  className="flex-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold py-2 text-xs transition-colors cursor-pointer text-center shadow-sm disabled:opacity-50"
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 text-xs transition-colors cursor-pointer text-center border border-slate-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleChangePassword} className={`space-y-3.5 ${isShaking ? "animate-shake" : ""}`}>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Password</label>
                <input
                  type="password"
                  value={prevPassword}
                  onChange={(e) => setPrevPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
              
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
                <p className="text-[9px] text-slate-400 leading-normal font-sans">Must contain at least 1 uppercase and 1 special symbol.</p>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <button
                type="submit"
                className="w-full mt-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 px-3 py-1.8 text-xs font-bold text-white transition-colors cursor-pointer shadow-sm"
              >
                Update Password
              </button>
            </form>
          )}
        </div>

      </div>

       {/* Review Applications Panel - Visible ONLY if Coach, Manager, Analyst or Admin */}
      {canReviewApplications && (
        <div className="rounded-xl border border-slate-800 bg-[#0f172a] overflow-hidden shadow-xl">
          <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between font-sans text-xs">
            <div className="flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-cyan-400" />
              <span className="font-bold text-white">Application Panel</span>
            </div>
            <span className="text-[9.5px] bg-cyan-950/60 text-cyan-400 font-bold border border-cyan-800/60 px-2 py-0.5 rounded font-sans uppercase">
              Staff Only
            </span>
          </div>

          <div className="p-4">
            {applications.filter(a => a.status === "pending").length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2 text-center">No pending applications submitted currently.</p>
            ) : (
              <div className="divide-y divide-slate-800">
                {applications.filter(a => a.status === "pending").map((app) => {
                  const matchingUser = users.find(u => u.id === app.userId);
                  const fullName = matchingUser ? [matchingUser.firstName, matchingUser.lastName].filter(Boolean).join(" ") : "";
                  const displayType = app.type === "Join" ? "Membership Registration" : "Role Change / Promotion";
                  return (
                    <div key={app.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs font-sans">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white">{fullName || app.username}</span>
                          {fullName && <span className="text-[10px] text-slate-400">({app.username})</span>}
                          <span className={`inline-flex items-center rounded px-1.5 py-0.2 text-[9px] font-bold ${
                            app.type === "Join" 
                              ? "bg-blue-950/60 text-blue-400 border border-blue-800/60" 
                              : "bg-amber-950/60 text-amber-400 border border-amber-800/60"
                          }`}>
                            Type: {displayType}
                          </span>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-300 flex items-center gap-1">
                          <span>Requested Role:</span>
                          <span className="inline-flex items-center gap-1 rounded bg-cyan-950/60 border border-cyan-800/60 px-1.5 py-0.2 text-[9.5px] font-bold text-cyan-400">
                            {app.requestedRole}
                          </span>
                        </div>
                        <p className="text-[9px] text-slate-400 mt-0.5 font-mono">Submitted: {new Date(app.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          disabled={resolvingAppId?.id === app.id}
                          onClick={() => handleResolveApp(app.id, true, fullName || app.username)}
                          className="px-3 py-1.5 text-[10.5px] font-bold bg-emerald-950/60 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-800/60 rounded flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {resolvingAppId?.id === app.id && resolvingAppId.action === "approve" ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                              <span>Approving...</span>
                            </>
                          ) : (
                            <span>Approve</span>
                          )}
                        </button>
                        <button
                          disabled={resolvingAppId?.id === app.id}
                          onClick={() => handleResolveApp(app.id, false, fullName || app.username)}
                          className="px-3 py-1.5 text-[10.5px] font-bold bg-rose-950/60 text-rose-400 hover:bg-rose-600 hover:text-white border border-rose-800/60 rounded flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {resolvingAppId?.id === app.id && resolvingAppId.action === "reject" ? (
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
        </div>
      )}

      {/* Attribute Approval Requests Panel - Visible ONLY if Staff/Admin */}
      {canReviewApplications && (
        <div className="rounded-xl border border-slate-800 bg-[#0f172a] overflow-hidden shadow-xl mt-6">
          <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between font-sans text-xs">
            <div className="flex items-center gap-1.5">
              <UserCog className="h-4 w-4 text-amber-400" />
              <span className="font-bold text-white">Attribute Approval Requests</span>
            </div>
            <span className="text-[9.5px] bg-amber-950/60 text-amber-400 font-bold border border-amber-800/60 px-2 py-0.5 rounded font-sans uppercase">
              Pending Approval
            </span>
          </div>

          <div className="p-4">
            {profileRequests.filter(r => r.status === "pending").length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2 text-center">No pending profile attribute update requests currently.</p>
            ) : (
              <div className="divide-y divide-slate-800">
                {profileRequests.filter(r => r.status === "pending").map((req) => {
                  const changes = req.requested_changes || {};
                  const pos = changes.position || "N/A";
                  const nationality = changes.nationality || "N/A";
                  const foot = changes.preferred_foot || changes.preferredFoot || "N/A";
                  const backNum = changes.squad_number || changes.squadNumber || changes.back_number || changes.backNumber || changes.jersey_number || "N/A";

                  return (
                    <div key={req.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs font-sans">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white text-sm">{req.player_name || "Player"}</span>
                          <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded font-semibold">
                            Pending Change
                          </span>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                          <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                            <strong>Pos:</strong> {pos}
                          </span>
                          <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                            <strong>Nationality:</strong> {nationality}
                          </span>
                          <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                            <strong>Foot:</strong> {foot}
                          </span>
                          {backNum !== "N/A" && (
                            <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                              <strong>Squad #:</strong> {backNum.startsWith('#') ? backNum : `#${backNum}`}
                            </span>
                          )}
                        </div>

                        <p className="text-[9px] text-slate-400 font-mono">
                          Submitted: {new Date(req.created_at).toLocaleDateString()} {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          disabled={resolvingProfileReqId?.id === req.id}
                          onClick={() => handleResolveProfileReq(req.id, true, req.player_name)}
                          className="px-3 py-1.5 text-[10.5px] font-bold bg-emerald-950/60 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-800/60 rounded flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
                          className="px-3 py-1.5 text-[10.5px] font-bold bg-rose-950/60 text-rose-400 hover:bg-rose-600 hover:text-white border border-rose-800/60 rounded flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
        </div>
      )}

      {/* Master Admin Controls - Database Management Entry Button */}
      {currentUser?.username === "minwoo6647" && (
        <div className="rounded-xl border border-amber-500/30 bg-slate-900 p-5 shadow-xl text-white">
          <div className="flex items-center gap-2 border-b border-amber-500/30 pb-2.5 mb-3.5">
            <Database className="h-4.5 w-4.5 text-amber-400" />
            <h3 className="font-display font-bold text-xs text-amber-400 uppercase tracking-wider">Database & Uploads Control Hub</h3>
          </div>
          <div className="space-y-3">
            <p className="text-xs text-slate-300 leading-normal font-sans">
              Access the system database files manager to view your uploaded match statistics datasets, audit who vs who details, or selectively delete uploaded database files to revert matches to upcoming. You can also perform a master system reset.
            </p>
            <button
              type="button"
              onClick={() => {
                setErrorSec("");
                setSuccessMsg("");
                setViewingDatabaseList(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 transition-colors cursor-pointer shadow-md"
            >
              Open Database Uploads Manager →
            </button>
          </div>
        </div>
      )}

      {/* Database Sync & Migration Center */}
      {currentUser?.role !== UserRole.Player && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
          <div>
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <Database className="w-4 h-4 text-emerald-400" />
              <span>Database Sync & Migration Center</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Push all locally stored browser data (Players, Matches, Fixtures, Custom Teams, User Profiles) directly into Supabase Cloud Database.
            </p>
          </div>
          <button
            disabled={isSyncingLocal}
            onClick={handleSyncAllLocal}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer shrink-0 shadow-md"
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
      )}

      {/* Bulk Team Import Section */}
      {currentUser?.role !== UserRole.Player && (
        <BulkTeamImport 
          currentUser={currentUser} 
          onTeamsUpdated={() => {
            loadFixtures();
          }} 
        />
      )}

      {/* Our Team Squad Roster Inspection Table */}
      {currentUser?.role !== UserRole.Player && (
        <div className="rounded-xl border border-slate-800 bg-[#0f172a] overflow-hidden shadow-xl mb-6">
          <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between font-sans text-xs">
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-cyan-400" />
              <span className="font-bold text-white">
                Our Team Squad Roster ({profilesList.length > 0 ? profilesList.length : playersList.filter(p => !p.id.toUpperCase().startsWith("OPP")).length} Registered Database Profiles)
              </span>
            </div>
            <span className="text-[9.5px] bg-cyan-950/60 text-cyan-400 font-bold border border-cyan-800/60 px-2 py-0.5 rounded uppercase font-sans">
              Supabase Database Synced
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-sans text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950 text-[9px] uppercase tracking-wider text-slate-400 font-bold font-sans">
                  <th className="py-2.5 px-4">Player Name</th>
                  <th className="py-2.5 px-4 font-mono">Player ID</th>
                  <th className="py-2.5 px-4">Position</th>
                  <th className="py-2.5 px-4">Foot</th>
                  <th className="py-2.5 px-4">Nationality</th>
                  <th className="py-2.5 px-4">Division / Role</th>
                  <th className="py-2.5 px-4 text-right">Registered Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {profilesList.length === 0 && playersList.filter(p => !p.id.toUpperCase().startsWith("OPP")).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-400 italic">
                      No internal squad profiles found in database.
                    </td>
                  </tr>
                ) : profilesList.length > 0 ? (
                  profilesList.map((prof) => (
                    <tr key={prof.id} className="hover:bg-slate-800/50 transition-colors">
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
                        {prof.nationality || "Wales"}
                      </td>
                      <td className="py-3 px-4 text-amber-400 font-semibold">
                        {prof.role || "CCFL First"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-400">
                        {prof.created_at ? new Date(prof.created_at).toLocaleDateString("en-GB") : "2026-08-01"}
                      </td>
                    </tr>
                  ))
                ) : (
                  playersList
                    .filter(p => !p.id.toUpperCase().startsWith("OPP"))
                    .map((p) => (
                      <tr key={p.id} className="hover:bg-slate-800/50 transition-colors">
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
                          {p.nationality || "Wales"}
                        </td>
                        <td className="py-3 px-4 text-amber-400 font-semibold">
                          {p.division || "CCFL First"}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-400">
                          {p.joinDate || p.dob || "2026-08-01"}
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Directory of users card */}
      {currentUser?.role !== UserRole.Player && (
        <div className="rounded-xl border border-slate-800 bg-[#0f172a] overflow-hidden shadow-xl">
          <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between font-sans text-xs">
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-slate-400" />
              <span className="font-bold text-white">Club Staff Directory ({sortedUsers.length} users)</span>
            </div>
            <p className="text-[9.5px] text-slate-400 font-sans">Sorted by role hierarchy weight</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" id="users-grid-table">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950 text-[9px] uppercase tracking-wider text-slate-400 font-bold font-sans">
                  <th className="py-2.5 px-4">Staff Username</th>
                  <th className="py-2.5 px-4">Assigned Position</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-xs font-sans text-slate-300">
                {sortedUsers.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  return (
                    <tr key={u.id} className={`hover:bg-slate-800/50 transition-colors ${isSelf ? "bg-cyan-950/40 font-medium text-cyan-300" : ""}`}>
                      
                      {/* Username */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="h-6.5 w-6.5 rounded bg-slate-800 flex items-center justify-center text-slate-200 font-bold text-[10.5px] uppercase border border-slate-700">
                            {u.username.substring(0,2)}
                          </div>
                          <div className="space-y-0.5">
                            <p className="font-semibold text-white flex items-center gap-1.5 flex-wrap">
                              <span>{u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.username}</span>
                              {isSelf && <span className="text-[8.5px] bg-cyan-600 text-white px-1 py-0.5 rounded font-bold">You</span>}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Role Pref */}
                      <td className="py-3 px-4">
                        {isCurrentAdmin && !isSelf ? (
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                            className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[11px] text-white font-semibold focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
                          >
                            <option value={UserRole.HeadCoach}>Head Coach</option>
                            <option value={UserRole.Manager}>Manager</option>
                            <option value={UserRole.Analyst}>Analyst</option>
                            <option value={UserRole.Player}>Player (Read-Only)</option>
                          </select>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-slate-800 border border-slate-700 px-2 py-0.5 text-[9.5px] font-bold text-slate-300">
                            <Award className="h-3 w-3 text-slate-400" />
                            {u.role}
                          </span>
                        )}
                      </td>

                      {/* Single Account Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isCurrentAdmin && !isSelf && (
                            <button
                              type="button"
                              onClick={() => handleResetPassword(u.id, u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.username)}
                              className="text-[10px] font-bold text-cyan-400 hover:bg-cyan-600 hover:text-white border border-cyan-800/60 px-2 py-0.5 rounded transition-all cursor-pointer shadow-sm"
                              title="Reset user password to default 'cardifftownfc1!'"
                            >
                              Reset PW
                            </button>
                          )}
                          
                          {isCurrentAdmin && !isSelf && (
                            <button
                              type="button"
                              onClick={() => handleAdminToggle(u.id, u.isAdmin)}
                              className={`text-[10px] font-bold border rounded px-2 py-0.5 transition-all cursor-pointer ${
                                u.isAdmin 
                                  ? "text-amber-300 border-amber-800/60 bg-amber-950/60 hover:bg-amber-900/80" 
                                  : "text-slate-300 border-slate-700 hover:bg-cyan-600 hover:text-white hover:border-cyan-600"
                              }`}
                            >
                              {u.isAdmin ? "Revoke Admin" : "Grant Admin"}
                            </button>
                          )}

                          {isCurrentAdmin && !isSelf && u.username !== "minwoo6647" ? (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u.id, u.username)}
                              className="p-1 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 rounded transition-colors cursor-pointer border border-transparent hover:border-rose-800/60"
                              title="Remove Staff User"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            !isSelf && <span className="text-[10px] text-slate-500 font-sans">-</span>
                          )}
                          
                          {isSelf && (
                            <span className="text-[10px] text-slate-400 font-medium font-sans bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5">Active Session</span>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
