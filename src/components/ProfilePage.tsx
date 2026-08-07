import React, { useState, useEffect } from "react";
import { UserProfile, UserRole } from "../types";
import { DataService } from "../lib/dataService";
import { supabase } from "../lib/supabase";
import { UserCheck, Key, UserPlus, ShieldAlert, Check, Loader2, UserCog } from "lucide-react";

interface ProfilePageProps {
  currentUser: UserProfile | null;
  onUserUpdated?: () => void;
  onLogout?: () => void;
}

interface RoleApplication {
  id: string;
  userId: string;
  username: string;
  requestedRole: UserRole;
  status: string;
  createdAt: string;
}

export default function ProfilePage({ currentUser, onUserUpdated, onLogout }: ProfilePageProps) {
  const [errorSec, setErrorSec] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Role applications
  const [myApplication, setMyApplication] = useState<RoleApplication | null>(null);
  const [isSubmittingApp, setIsSubmittingApp] = useState(false);

  // Password change states
  const [prevPassword, setPrevPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPw, setIsChangingPw] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  // Delete account confirm state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadMyApplication();
  }, [currentUser?.id]);

  const loadMyApplication = async () => {
    if (!currentUser) return;
    try {
      const apps = await DataService.getApplications();
      const myApp = apps.find((a: RoleApplication) => a.userId === currentUser.id && a.status === "pending");
      setMyApplication(myApp || null);
    } catch (err) {
      console.warn("Failed to load applications:", err);
    }
  };

  const handleApplyRole = async (requestedRole: UserRole) => {
    if (!currentUser) return;
    setIsSubmittingApp(true);
    try {
      setErrorSec("");
      setSuccessMsg("");
      await DataService.applyForRole(currentUser.id, currentUser.username, requestedRole);
      setSuccessMsg(`Your application for ${requestedRole} has been submitted for staff review.`);
      await loadMyApplication();
    } catch (err: any) {
      setErrorSec(err.message || "Failed to submit role application.");
    } finally {
      setIsSubmittingApp(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorSec("");
    setSuccessMsg("");

    if (!currentUser) return;

    if (!prevPassword || !newPassword || !confirmPassword) {
      setErrorSec("Please fill in all password fields.");
      triggerShake();
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorSec("The confirmed password does not match the new password.");
      triggerShake();
      return;
    }

    // Password Complexity Validation: at least 1 uppercase letter and 1 special symbol
    const hasUppercase = /[A-Z]/.test(newPassword);
    const hasSpecialSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);

    if (!hasUppercase || !hasSpecialSymbol) {
      setErrorSec("New password must contain at least 1 uppercase letter and 1 special symbol.");
      triggerShake();
      return;
    }

    setIsChangingPw(true);
    try {
      // 1. Direct Supabase Auth Update
      const { error: sbError } = await supabase.auth.updateUser({ password: newPassword });
      if (sbError) {
        console.warn("Supabase Auth password update warning:", sbError.message);
      }

      // 2. DataService Local / DB Password Sync
      await DataService.changePassword(currentUser.id, prevPassword, newPassword);

      setSuccessMsg("Your password has been changed successfully.");
      setPrevPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setErrorSec(err.message || "An error occurred while updating the password.");
      triggerShake();
    } finally {
      setIsChangingPw(false);
    }
  };

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 400);
  };

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

  const fullName = currentUser?.firstName && currentUser?.lastName
    ? `${currentUser.firstName} ${currentUser.lastName}`
    : (currentUser?.username || "Not Configured");

  const roleDisplayName = currentUser?.role?.toUpperCase() || "PLAYER";

  return (
    <div className="space-y-6 font-sans bg-[#0b0f19] text-[#f8fafc] p-4 sm:p-6 rounded-2xl border border-[#334155] shadow-2xl" id="profile-page-viewport">
      
      {/* Header */}
      <div className="border-b border-[#334155] pb-3">
        <h2 className="font-display text-xl sm:text-2xl font-black tracking-wide text-white flex items-center gap-2.5">
          <UserCog className="h-6 w-6 text-cyan-400" />
          <span>User Profile & Account Credentials</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Manage your personal credentials, role access applications, and portal password.
        </p>
      </div>

      {errorSec && (
        <div className="rounded-xl border border-rose-800/60 bg-rose-950/40 p-3.5 text-xs text-rose-300 flex items-center gap-2 font-sans font-semibold animate-fadeIn">
          <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />
          <span>{errorSec}</span>
        </div>
      )}

      {successMsg && (
        <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/40 p-3.5 text-xs text-emerald-300 flex items-center gap-2 font-sans font-semibold animate-fadeIn">
          <Check className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Grid: 2 Side-by-Side Main Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        
        {/* Left Card: YOUR CREDENTIALS */}
        <div className="rounded-2xl border border-[#334155] bg-[#0f172a] p-5 sm:p-6 shadow-xl flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center gap-2 border-b border-[#334155] pb-3 mb-4">
              <UserCheck className="h-5 w-5 text-cyan-400" />
              <h3 className="font-display font-black text-sm text-white uppercase tracking-wider">YOUR CREDENTIALS</h3>
            </div>

            <div className="space-y-3.5 text-xs text-slate-300 font-sans">
              <div className="flex items-center justify-between py-2 border-b border-slate-800">
                <span className="font-medium text-slate-400">Full Name</span>
                <span className="font-bold text-white text-sm">{fullName}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-800">
                <span className="font-medium text-slate-400">Username</span>
                <span className="font-mono font-bold text-cyan-300 text-xs">{currentUser?.username}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-800">
                <span className="font-medium text-slate-400">Assigned Position</span>
                <span className="inline-flex items-center gap-1 rounded-md bg-cyan-950/80 text-cyan-400 font-black border border-cyan-800/80 px-2.5 py-1 text-[11px] uppercase tracking-wider">
                  {roleDisplayName}
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-800">
                <span className="font-medium text-slate-400">Database Status</span>
                <span className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-black uppercase tracking-wider border ${
                  currentUser?.isAdmin 
                    ? "bg-emerald-950/80 text-emerald-400 border-emerald-800/80" 
                    : "bg-slate-800 text-slate-300 border-slate-700"
                }`}>
                  {currentUser?.isAdmin ? "Admin / Write Access" : "Read Only"}
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Section: APPLY FOR TACTICAL POSITION UPDATE */}
          <div className="pt-4 border-t border-[#334155]">
            <p className="text-xs font-extrabold text-white uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <UserPlus className="h-4 w-4 text-cyan-400" />
              <span>APPLY FOR TACTICAL POSITION UPDATE</span>
            </p>
            <p className="text-[11px] text-slate-400 leading-relaxed font-sans mb-3">
              Request elevated system credentials to contribute to match analysis or update squad listings.
            </p>

            {myApplication ? (
              <div className="rounded-xl bg-amber-950/60 border border-amber-500/50 p-3 text-xs text-amber-200 font-sans shadow-inner">
                <p className="font-bold text-amber-300">Application Pending Review</p>
                <p className="mt-0.5 text-amber-200 text-[11px]">
                  You requested the position of <strong className="font-bold text-white">{myApplication.requestedRole}</strong> on {new Date(myApplication.createdAt).toLocaleDateString()}.
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => handleApplyRole(UserRole.HeadCoach)}
                  disabled={isSubmittingApp || currentUser?.role === UserRole.HeadCoach}
                  className="flex-1 py-2 px-3 text-xs font-bold rounded-xl bg-slate-900 hover:bg-cyan-600 border border-slate-700 text-slate-200 hover:text-white transition-all cursor-pointer shadow-md disabled:opacity-40 disabled:cursor-not-allowed text-center"
                >
                  [Apply for Coach]
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyRole(UserRole.Manager)}
                  disabled={isSubmittingApp || currentUser?.role === UserRole.Manager}
                  className="flex-1 py-2 px-3 text-xs font-bold rounded-xl bg-slate-900 hover:bg-cyan-600 border border-slate-700 text-slate-200 hover:text-white transition-all cursor-pointer shadow-md disabled:opacity-40 disabled:cursor-not-allowed text-center"
                >
                  [Apply for Manager]
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyRole(UserRole.Analyst)}
                  disabled={isSubmittingApp || currentUser?.role === UserRole.Analyst}
                  className="flex-1 py-2 px-3 text-xs font-bold rounded-xl bg-slate-900 hover:bg-cyan-600 border border-slate-700 text-slate-200 hover:text-white transition-all cursor-pointer shadow-md disabled:opacity-40 disabled:cursor-not-allowed text-center"
                >
                  [Apply for Analyst]
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Card: CHANGE PORTAL PASSWORD */}
        <div className="rounded-2xl border border-[#334155] bg-[#0f172a] p-5 sm:p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#334155] pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5 text-cyan-400" />
                <h3 className="font-display font-black text-sm text-white uppercase tracking-wider">CHANGE PORTAL PASSWORD</h3>
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
                <div className="rounded-xl border border-rose-800/60 bg-rose-950/40 p-3.5 text-xs text-rose-200 font-sans space-y-2">
                  <p className="font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4 text-rose-400" />
                    Warning: Irreversible Action
                  </p>
                  <p className="leading-relaxed">
                    You will no longer have access to this portal. Your profile and active tactical credentials will be completely erased.
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={handleDeleteAccount}
                    className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 text-xs transition-colors cursor-pointer text-center shadow-md disabled:opacity-50"
                  >
                    {isDeleting ? "Deleting..." : "Confirm Delete"}
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 text-xs transition-colors cursor-pointer text-center border border-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleChangePassword} className={`space-y-4 ${isShaking ? "animate-shake" : ""}`}>
                
                {/* CURRENT PASSWORD */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">CURRENT PASSWORD *</label>
                  <input
                    type="password"
                    value={prevPassword}
                    onChange={(e) => setPrevPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                    required
                  />
                </div>
                
                {/* NEW PASSWORD */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">NEW PASSWORD *</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                    required
                  />
                  <p className="text-[10px] text-cyan-300 font-mono leading-normal">
                    * Must contain at least 1 uppercase and 1 special symbol.
                  </p>
                </div>

                {/* CONFIRM NEW PASSWORD */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">CONFIRM NEW PASSWORD *</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                    required
                  />
                </div>

                {/* Cyan/Teal Full-Width Action Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isChangingPw}
                    className="w-full py-3 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-sm transition-all shadow-xl flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isChangingPw ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Updating Password...</span>
                      </>
                    ) : (
                      <span>[Update Password]</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
