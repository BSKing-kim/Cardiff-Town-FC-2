import React, { useState } from "react";
import { DataService } from "../lib/dataService";
import { UserProfile, UserRole } from "../types";
import { Check, ShieldAlert, Sparkles, UserPlus, LogIn, HardDrive, Eye, EyeOff, KeyRound, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface AuthScreenProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export default function AuthScreen({ onLoginSuccess }: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.Player);
  const [errorSec, setErrorSec] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isShaking, setIsShaking] = useState(false);
  const [gdprAccepted, setGdprAccepted] = useState(false);

  // Forgot Username State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [searchFirstName, setSearchFirstName] = useState("");
  const [searchLastName, setSearchLastName] = useState("");
  const [searchResult, setSearchResult] = useState("");
  const [searchError, setSearchError] = useState("");

  // Forgot Password State
  const [showForgotPwModal, setShowForgotPwModal] = useState(false);
  const [forgotPwUsername, setForgotPwUsername] = useState("");
  const [retrievedPassword, setRetrievedPassword] = useState<string | null>(null);
  const [forgotPwError, setForgotPwError] = useState("");
  const [showPasswordPlain, setShowPasswordPlain] = useState(false);
  const [isSearchingPw, setIsSearchingPw] = useState(false);

  const [showPassword, setShowPassword] = useState(false);

  const handleFindPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotPwError("");
    setRetrievedPassword(null);
    setShowPasswordPlain(false);

    if (!forgotPwUsername.trim()) {
      setForgotPwError("Please enter your Username.");
      return;
    }

    setIsSearchingPw(true);
    try {
      const pw = await DataService.findPasswordByUsername(forgotPwUsername);
      if (pw) {
        setRetrievedPassword(pw);
      } else {
        setForgotPwError("No account found matching that username.");
      }
    } catch (err: any) {
      setForgotPwError("An error occurred while retrieving your password. Please try again.");
    } finally {
      setIsSearchingPw(false);
    }
  };

  const handleFindUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError("");
    setSearchResult("");

    if (!searchFirstName.trim() || !searchLastName.trim()) {
      setSearchError("Please enter both First Name and Last Name.");
      return;
    }

    try {
      const foundUsername = await DataService.findUsernameByFullName(searchFirstName, searchLastName);

      if (foundUsername) {
        setSearchResult(foundUsername);
      } else {
        setSearchError("No username was found matching that First Name and Last Name. Please verify the spelling or check with an administrator.");
      }
    } catch (err: any) {
      setSearchError("An error occurred while communicating with the database. Please try again.");
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorSec("");
    setSuccessMsg("");
    setToastMsg(null);

    if (!username.trim() || !password) {
      setErrorSec("Please enter both username and password.");
      setToastMsg({ type: "error", text: "Submission failed. Please try again." });
      return;
    }

    setIsSubmitting(true);

    try {
      if (isLogin) {
        const profile = await DataService.login(username, password);
        onLoginSuccess(profile);
      } else {
        // Validation for First Name and Last Name
        if (!firstName.trim() || !lastName.trim()) {
          setErrorSec("First Name and Last Name are mandatory fields.");
          setToastMsg({ type: "error", text: "Submission failed. Please try again." });
          setIsShaking(true);
          setTimeout(() => setIsShaking(false), 400);
          setIsSubmitting(false);
          return;
        }

        // GDPR Consent Validation
        if (!gdprAccepted) {
          setErrorSec("You must read and agree to the UK GDPR Privacy Consent statement to register.");
          setToastMsg({ type: "error", text: "Submission failed. Please try again." });
          setIsShaking(true);
          setTimeout(() => setIsShaking(false), 400);
          setIsSubmitting(false);
          return;
        }

        // Register standard user with role request
        await DataService.register(
          username, 
          password, 
          selectedRole, 
          firstName, 
          middleName, 
          lastName
        );
        
        setToastMsg({
          type: "success",
          text: "Approval request submitted! Please wait for admin approval."
        });
        setIsSubmitted(true);
      }
    } catch (err: any) {
      setErrorSec(err.message || "Submission failed. Please try again.");
      setToastMsg({ type: "error", text: "Submission failed. Please try again." });
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 400);
    } finally {
      setIsSubmitting(false);
    }
  };



  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b0f19] px-4 py-8" id="auth-screen-container">
      <div className="w-full max-w-sm space-y-5 rounded-2xl border border-[#334155] bg-[#1e293b] p-6 shadow-2xl animate-fadeIn text-white">
        
        {/* Header section with brand logo hero */}
        <div className="text-center space-y-3" id="auth-header">
          <div className="relative mx-auto flex h-28 w-28 items-center justify-center rounded-2xl bg-[#0b0f19] border-2 border-[#eab308]/70 shadow-[0_0_25px_rgba(234,179,8,0.25)] p-2 transition-transform hover:scale-105">
            <img
              src="/Cardiff-town-logo.jpg"
              onError={(e) => { (e.target as HTMLImageElement).src = "/logo.png"; }}
              alt="Cardiff Town FC Crest Logo"
              className="h-full w-full object-contain rounded-xl"
            />
          </div>
          <div className="space-y-1">
            <h2 className="font-display text-base sm:text-lg font-black tracking-wider text-white uppercase leading-snug">
              CARDIFF TOWN FC PERFORMANCE ANALYZER
            </h2>
            <p className="text-[10px] text-[#eab308] font-mono font-bold uppercase tracking-widest">
              Official Team Tactical Portal
            </p>
          </div>
        </div>

        {isSubmitted ? (
          <div className="text-center py-6 space-y-4 animate-fadeIn" id="auth-success-screen">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-sm">
              <Check className="h-6 w-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-white font-display">
                Application Submitted Successfully
              </h3>
              <p className="text-xs text-[#94a3b8] leading-normal font-sans">
                Your approval request has been successfully submitted. You will be able to log in once an administrator approves your access.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsSubmitted(false);
                setIsLogin(true);
                setUsername("");
                setPassword("");
                setFirstName("");
                setMiddleName("");
                setLastName("");
                setGdprAccepted(false);
                setErrorSec("");
                setSuccessMsg("");
              }}
              className="w-full inline-flex justify-center rounded-xl bg-[#eab308] hover:bg-[#f59e0b] px-3 py-2.5 text-xs font-black text-[#0b0f19] transition-colors cursor-pointer shadow-md"
            >
              OK
            </button>
          </div>
        ) : (
          <>
            {/* Toggle tabs */}
            <div className="flex border-b border-[#334155]">
              <button
                type="button"
                onClick={() => { setIsLogin(true); setErrorSec(""); }}
                className={`flex-1 pb-2.5 text-center text-xs font-bold border-b-2 cursor-pointer transition-all ${
                  isLogin ? "border-[#eab308] text-[#eab308]" : "border-transparent text-[#94a3b8] hover:text-white"
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <LogIn className="h-4 w-4" />
                  Log In
                </div>
              </button>
              <button
                type="button"
                className={`flex-1 pb-2.5 text-center text-xs font-bold border-b-2 cursor-pointer transition-all ${
                  !isLogin ? "border-[#eab308] text-[#eab308]" : "border-transparent text-[#94a3b8] hover:text-white"
                }`}
                onClick={() => { setIsLogin(false); setErrorSec(""); }}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <UserPlus className="h-4 w-4" />
                  Sign Up
                </div>
              </button>
            </div>

            {/* Form Body */}
            <form className={`space-y-4 ${isShaking ? "animate-shake" : ""}`} onSubmit={handleAuth} id="auth-form">
              {toastMsg && (
                <div className={`flex items-center justify-between rounded-xl p-3 text-xs font-bold border shadow-md transition-all ${
                  toastMsg.type === "success" 
                    ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/50" 
                    : "bg-rose-950/80 text-rose-300 border-rose-500/50"
                }`}>
                  <div className="flex items-center gap-2">
                    {toastMsg.type === "success" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                    )}
                    <span>{toastMsg.text}</span>
                  </div>
                  <button type="button" onClick={() => setToastMsg(null)} className="text-slate-400 hover:text-white ml-2 text-xs">✕</button>
                </div>
              )}

              {errorSec && !toastMsg && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                  <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                  <p>{errorSec}</p>
                </div>
              )}

              {successMsg && (
                <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                  <Check className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                  <p>{successMsg}</p>
                </div>
              )}

              <div className="space-y-3.5">
                {!isLogin && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="firstName" className="block text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">
                          First Name <span className="text-rose-400 font-extrabold">*</span>
                        </label>
                        <input
                          id="firstName"
                          name="firstName"
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="First Name"
                          className={`mt-1 block w-full rounded-xl border bg-[#0b0f19] px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#eab308] ${
                            !firstName.trim() && errorSec ? "border-rose-500 ring-1 ring-rose-500" : "border-[#334155]"
                          }`}
                        />
                      </div>

                      <div>
                        <label htmlFor="lastName" className="block text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">
                          Last Name <span className="text-rose-400 font-extrabold">*</span>
                        </label>
                        <input
                          id="lastName"
                          name="lastName"
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Last Name"
                          className={`mt-1 block w-full rounded-xl border bg-[#0b0f19] px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#eab308] ${
                            !lastName.trim() && errorSec ? "border-rose-500 ring-1 ring-rose-500" : "border-[#334155]"
                          }`}
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="middleName" className="block text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">
                        Middle Name <span className="text-slate-500 text-[8px] font-normal">(Optional)</span>
                      </label>
                      <input
                        id="middleName"
                        name="middleName"
                        type="text"
                        value={middleName}
                        onChange={(e) => setMiddleName(e.target.value)}
                        placeholder="Middle Name"
                        className="mt-1 block w-full rounded-xl border border-[#334155] bg-[#0b0f19] px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#eab308]"
                      />
                    </div>
                  </>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="username" className="block text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">
                      Username
                    </label>
                    {isLogin && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowForgotModal(true);
                          setSearchFirstName("");
                          setSearchLastName("");
                          setSearchResult("");
                          setSearchError("");
                        }}
                        className="text-[10px] text-[#eab308] hover:underline font-bold cursor-pointer transition-colors"
                      >
                        Forgot username?
                      </button>
                    )}
                  </div>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    className="mt-1 block w-full rounded-xl border border-[#334155] bg-[#0b0f19] px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#eab308]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="password" className="block text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">
                      Password
                    </label>
                    {isLogin && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowForgotPwModal(true);
                          setForgotPwUsername(username || "");
                          setRetrievedPassword(null);
                          setForgotPwError("");
                          setShowPasswordPlain(false);
                        }}
                        className="text-slate-400 hover:text-cyan-400 text-xs cursor-pointer transition-colors"
                      >
                        Forgot Password?
                      </button>
                    )}
                  </div>
                  <div className="relative mt-1">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="block w-full rounded-xl border border-[#334155] bg-[#0b0f19] px-3.5 py-2 pr-10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#eab308]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {!isLogin && (
                    <p className="mt-1 text-[9px] leading-normal text-slate-400">
                      * Rules: Must include at least 1 uppercase letter and 1 special symbol.
                    </p>
                  )}
                </div>

                {!isLogin && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">
                        Role Preference
                      </label>
                      <select
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                        className="mt-1 block w-full rounded-xl border border-[#334155] bg-[#0b0f19] px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#eab308]"
                      >
                        <option value={UserRole.Player}>Player (Read-Only)</option>
                        <option value={UserRole.Analyst}>Analyst</option>
                        <option value={UserRole.Manager}>Manager</option>
                        <option value={UserRole.HeadCoach}>Head Coach</option>
                      </select>
                      <p className="mt-1 text-[9px] leading-normal text-slate-400">
                        * New accounts require administrator approval before logging in.
                      </p>
                    </div>

                    {/* GDPR Consent Box */}
                    <div className="border-t border-[#334155] pt-3 mt-3">
                      <label className="flex items-start gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={gdprAccepted}
                          onChange={(e) => setGdprAccepted(e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-[#334155] bg-[#0b0f19] text-[#eab308] focus:ring-[#eab308] cursor-pointer"
                        />
                        <div className="text-[10px] text-slate-300 leading-normal font-sans">
                          <span className="font-bold text-white block mb-0.5">
                            UK GDPR & DPA 2018 Consent <span className="text-rose-400">*</span>
                          </span>
                          I consent to Cardiff Town FC collecting and processing my name, role and match statistics for team tactical and performance analysis.
                        </div>
                      </label>
                    </div>

                    <div className="text-[10px] text-rose-400 font-bold border-t border-[#334155] pt-2 text-center font-sans space-y-1">
                      <div>* First Name and Last Name are mandatory.</div>
                      <div>* UK GDPR & DPA 2018 Privacy Consent is mandatory for user registration.</div>
                    </div>
                  </>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 bg-[#eab308] hover:bg-[#f59e0b] disabled:bg-slate-700 disabled:cursor-not-allowed font-black rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer text-xs text-[#0b0f19] shadow"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-[#0b0f19]"/>
                      <span>{isLogin ? "Signing In..." : "Submitting Request..."}</span>
                    </>
                  ) : (
                    <span>{isLogin ? "Sign In" : "Request Approval"}</span>
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>

      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-[#334155] bg-[#1e293b] p-6 shadow-2xl space-y-4 text-white">
            <div className="flex items-center justify-between border-b border-[#334155] pb-3">
              <h3 className="font-display font-black text-sm text-[#eab308] flex items-center gap-2 uppercase tracking-wider">
                <Sparkles className="h-4 w-4 text-[#eab308]" />
                Forgot Username?
              </h3>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="text-slate-400 hover:text-white text-sm font-bold cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] text-slate-300 leading-normal font-sans">
              Enter your registered <strong className="text-white">First Name</strong> and <strong className="text-white">Last Name</strong> to retrieve your username.
            </p>

            <form onSubmit={handleFindUsername} className="space-y-3.5">
              {searchError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 font-sans font-medium">
                  {searchError}
                </div>
              )}

              {searchResult ? (
                <div className="rounded-xl bg-[#0b0f19] border border-[#eab308]/40 p-4 text-center space-y-2">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Username Found!</p>
                  <p className="text-base font-extrabold text-[#eab308] font-mono select-all bg-[#1e293b] border border-[#334155] py-2 rounded-xl">
                    {searchResult}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setUsername(searchResult);
                      setShowForgotModal(false);
                    }}
                    className="w-full text-center rounded-xl bg-[#eab308] hover:bg-[#f59e0b] text-[#0b0f19] text-xs font-black py-2.5 transition-colors cursor-pointer mt-1"
                  >
                    Set to Username field & Close
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">First Name</label>
                      <input
                        type="text"
                        required
                        value={searchFirstName}
                        onChange={(e) => setSearchFirstName(e.target.value)}
                        placeholder="John"
                        className="mt-1 block w-full rounded-xl border border-[#334155] bg-[#0b0f19] px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#eab308]"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">Last Name</label>
                      <input
                        type="text"
                        required
                        value={searchLastName}
                        onChange={(e) => setSearchLastName(e.target.value)}
                        placeholder="Doe"
                        className="mt-1 block w-full rounded-xl border border-[#334155] bg-[#0b0f19] px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#eab308]"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(false)}
                      className="flex-1 rounded-xl border border-[#334155] py-2 text-xs font-bold text-slate-300 hover:bg-[#0b0f19] transition-colors cursor-pointer text-center"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 rounded-xl bg-[#eab308] py-2 text-xs font-black text-[#0b0f19] shadow hover:bg-[#f59e0b] transition-colors cursor-pointer text-center"
                    >
                      Find Username
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {showForgotPwModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-[#334155] bg-[#1e293b] p-6 shadow-2xl space-y-4 text-white">
            <div className="flex items-center justify-between border-b border-[#334155] pb-3">
              <h3 className="font-display font-black text-sm text-[#eab308] flex items-center gap-2 uppercase tracking-wider">
                <KeyRound className="h-4 w-4 text-[#eab308]" />
                Password Recovery
              </h3>
              <button
                type="button"
                onClick={() => setShowForgotPwModal(false)}
                className="text-slate-400 hover:text-white text-sm font-bold cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] text-slate-300 leading-normal font-sans">
              Enter your registered <strong className="text-white">Username</strong> to retrieve your account password.
            </p>

            <form onSubmit={handleFindPassword} className="space-y-3.5">
              {forgotPwError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 font-sans font-medium">
                  {forgotPwError}
                </div>
              )}

              {retrievedPassword !== null ? (
                <div className="rounded-xl bg-[#0b0f19] border border-[#eab308]/40 p-4 space-y-3">
                  <div className="text-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Account Found!</p>
                    <p className="text-xs text-slate-300 font-sans mt-0.5">
                      Password for <span className="font-mono text-cyan-400 font-bold">{forgotPwUsername}</span>:
                    </p>
                  </div>

                  {/* Password Display Box with Dynamic Asterisk Masking & Eye Icon Toggle */}
                  <div className="relative flex items-center">
                    <div className="w-full font-mono text-sm tracking-widest text-emerald-400 bg-[#1e293b] border border-[#334155] rounded-xl py-2.5 px-3.5 pr-10 overflow-x-auto select-all">
                      {showPasswordPlain ? retrievedPassword : "*".repeat(retrievedPassword.length)}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPasswordPlain(!showPasswordPlain)}
                      className="absolute right-3 text-slate-400 hover:text-white transition-colors cursor-pointer p-1"
                      title={showPasswordPlain ? "Hide Password" : "Show Password"}
                    >
                      {showPasswordPlain ? (
                        <EyeOff className="h-4 w-4 text-amber-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-slate-400" />
                      )}
                    </button>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setPassword(retrievedPassword);
                        setUsername(forgotPwUsername);
                        setShowForgotPwModal(false);
                      }}
                      className="w-full text-center rounded-xl bg-[#eab308] hover:bg-[#f59e0b] text-[#0b0f19] text-xs font-black py-2.5 transition-colors cursor-pointer shadow-md"
                    >
                      Set into Login & Close
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Enter your Username
                    </label>
                    <input
                      type="text"
                      required
                      value={forgotPwUsername}
                      onChange={(e) => setForgotPwUsername(e.target.value)}
                      placeholder="Enter your Username"
                      className="block w-full rounded-xl border border-[#334155] bg-[#0b0f19] px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#eab308]"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowForgotPwModal(false)}
                      className="flex-1 rounded-xl border border-[#334155] py-2 text-xs font-bold text-slate-300 hover:bg-[#0b0f19] transition-colors cursor-pointer text-center"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSearchingPw}
                      className="flex-1 rounded-xl bg-[#eab308] py-2 text-xs font-black text-[#0b0f19] shadow hover:bg-[#f59e0b] transition-colors cursor-pointer text-center disabled:opacity-50"
                    >
                      {isSearchingPw ? "Searching..." : "Find Password"}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
