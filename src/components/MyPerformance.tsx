import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { UserProfile, Player, MatchData, UserRole } from "../types";
import IndividualPlayerDashboard from "./IndividualPlayerDashboard";
import { UserCheck, ShieldCheck, Footprints, Compass, Sparkles, CheckCircle2, Loader2 } from "lucide-react";

interface MyPerformanceProps {
  currentUser?: UserProfile | null;
  players?: Player[];
  matches?: MatchData[];
}

const POSITIONS = [
  { code: "GK", label: "Goalkeeper" },
  { code: "CB", label: "Center Back" },
  { code: "LB", label: "Left Back" },
  { code: "RB", label: "Right Back" },
  { code: "DM", label: "Defensive Midfielder" },
  { code: "CM", label: "Central Midfielder" },
  { code: "AM", label: "Attacking Midfielder" },
  { code: "LW", label: "Left Winger" },
  { code: "RW", label: "Right Winger" },
  { code: "ST", label: "Striker" },
];

const FEET = ["Right", "Left", "Both"];

export default function MyPerformance({ currentUser, players = [], matches = [] }: MyPerformanceProps) {
  const [myLogs, setMyLogs] = useState<any[]>([]);
  const [assignedPlayerId, setAssignedPlayerId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Onboarding states
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean>(false);
  const [selectedPosition, setSelectedPosition] = useState<string>("CM");
  const [selectedFoot, setSelectedFoot] = useState<string>("Right");
  const [selectedNationality, setSelectedNationality] = useState<string>("Wales");
  const [selectedSquadNumber, setSelectedSquadNumber] = useState<string>("");
  const [isSubmittingOnboarding, setIsSubmittingOnboarding] = useState<boolean>(false);
  const [userProfileData, setUserProfileData] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;

    const loadMyPerformance = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        let profilePlayerId: string | null = currentUser?.playerId || (currentUser as any)?.player_id || null;
        let profileName = `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || currentUser?.username;
        let dbProfile: any = null;

        const isStaffUser = currentUser?.role !== UserRole.Player || !!currentUser?.isAdmin;

        if (user) {
          // Fetch user profile to check onboarding status & player_id
          const { data: profile } = await (supabase.from('profiles') as any)
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

          if (profile) {
            dbProfile = profile;
            setUserProfileData(profile);
            
            if (profile.player_id) {
              profilePlayerId = profile.player_id;
            }
            if (profile.full_name) {
              profileName = profile.full_name;
            }

            // Check if user needs mandatory position/foot/nationality/squad_number onboarding (Players only)
            if (!isStaffUser && (!profile.is_onboarded || !profile.position || !profile.preferred_foot || !profile.nationality || !profile.squad_number)) {
              if (isMounted) setNeedsOnboarding(true);
            }
          } else {
            // Check fallback by username if user_id profile is not found
            const { data: unameProfile } = await (supabase.from('profiles') as any)
              .select('*')
              .eq('username', currentUser?.username)
              .maybeSingle();

            if (unameProfile) {
              dbProfile = unameProfile;
              setUserProfileData(unameProfile);
              if (!isStaffUser && (!unameProfile.is_onboarded || !unameProfile.position || !unameProfile.preferred_foot || !unameProfile.nationality || !unameProfile.squad_number)) {
                if (isMounted) setNeedsOnboarding(true);
              }
            } else {
              // New user registration without DB profile yet -> prompt onboarding for Players
              if (!isStaffUser && isMounted) setNeedsOnboarding(true);
            }
          }
        } else if (!isStaffUser && (!currentUser?.position || !currentUser?.preferred_foot || !currentUser?.nationality || !(currentUser as any)?.squad_number)) {
          if (isMounted) setNeedsOnboarding(true);
        }

        if (isMounted && profilePlayerId) {
          setAssignedPlayerId(profilePlayerId);
        }

        if (profilePlayerId) {
          // Direct indexed fetch from match_logs using player_id
          const { data: logs, error } = await (supabase.from('match_logs') as any)
            .select('*')
            .eq('player_id', profilePlayerId);

          if (isMounted) {
            if (!error && logs && logs.length > 0) {
              setMyLogs(logs);
            } else {
              // Fallback search by player_name if initial player_id returns empty
              const { data: nameLogs } = await (supabase.from('match_logs') as any)
                .select('*')
                .ilike('player_name', `%${profileName}%`);
              if (nameLogs) setMyLogs(nameLogs);
            }
          }
        } else if (profileName) {
          const { data: nameLogs } = await (supabase.from('match_logs') as any)
            .select('*')
            .ilike('player_name', `%${profileName}%`);
          if (isMounted && nameLogs) setMyLogs(nameLogs);
        }
      } catch (err) {
        console.warn("Error loading my performance:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadMyPerformance();
    return () => { isMounted = false; };
  }, [currentUser?.id, currentUser?.username]);

  const handleCompleteOnboarding = async () => {
    setIsSubmittingOnboarding(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || currentUser?.id || currentUser?.user_id;
      const targetUsername = currentUser?.username;
      const fullName = `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || currentUser?.username || "Player";

      const pId = assignedPlayerId || userProfileData?.player_id || `PLR-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      // Direct Supabase update to the profiles table as specified
      const { error: updateErr } = await (supabase.from('profiles') as any).update({
        position: selectedPosition,
        preferred_foot: selectedFoot,
        nationality: selectedNationality,
        squad_number: selectedSquadNumber,
        is_onboarded: true
      }).eq('id', userId);

      // Fallback if update didn't match an 'id' or row needed upsert
      if (updateErr) {
        const { error: userErr } = await (supabase.from('profiles') as any).update({
          position: selectedPosition,
          preferred_foot: selectedFoot,
          nationality: selectedNationality,
          squad_number: selectedSquadNumber,
          is_onboarded: true
        }).eq('user_id', userId);

        if (userErr) {
          const profilePayload: any = {
            id: userId,
            user_id: userId,
            position: selectedPosition,
            preferred_foot: selectedFoot,
            nationality: selectedNationality,
            squad_number: selectedSquadNumber,
            is_onboarded: true,
            player_id: pId,
            full_name: fullName,
            username: targetUsername,
            updated_at: new Date().toISOString()
          };

          await (supabase.from('profiles') as any)
            .upsert(profilePayload, { onConflict: 'user_id' });
        }
      }

      // 2. Also upsert into players table so player stats and roster are synced
      await (supabase.from('players') as any).upsert({
        id: pId,
        name: fullName,
        position: selectedPosition,
        preferred_foot: selectedFoot,
        nationality: selectedNationality,
        squad_number: selectedSquadNumber,
        division: "CCFL First",
        team_name: "Cardiff Town FC"
      }, { onConflict: 'id' });

      // 3. Update local state immediately
      setUserProfileData((prev: any) => ({
        ...prev,
        position: selectedPosition,
        preferred_foot: selectedFoot,
        nationality: selectedNationality,
        squad_number: selectedSquadNumber,
        is_onboarded: true,
        player_id: pId
      }));

      if (currentUser) {
        currentUser.position = selectedPosition;
        currentUser.preferredFoot = selectedFoot;
        currentUser.preferred_foot = selectedFoot;
        currentUser.nationality = selectedNationality;
        (currentUser as any).squad_number = selectedSquadNumber;
        (currentUser as any).squadNumber = selectedSquadNumber;
        currentUser.isOnboarded = true;
        currentUser.is_onboarded = true;
      }

      setAssignedPlayerId(pId);
      setNeedsOnboarding(false);
    } catch (err: any) {
      console.warn("Failed to update onboarding info:", err);
      alert('Failed to save settings: ' + (err?.message || String(err)));
    } finally {
      setIsSubmittingOnboarding(false);
    }
  };

  // Aggregate stats from logs or fallback to matched roster player
  const matchedPlayer: Player | null = useMemo(() => {
    const userFullName = `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || currentUser?.username || "My Performance";

    const rosterMatch = players.find(p => 
      p.id === assignedPlayerId || 
      p.name?.toLowerCase() === userFullName.toLowerCase() ||
      p.name?.toLowerCase().includes(userFullName.toLowerCase())
    );

    const activePos = userProfileData?.position || selectedPosition || rosterMatch?.position || "CM";
    const activeFoot = userProfileData?.preferred_foot || selectedFoot || rosterMatch?.preferredFoot || "Right";

    if (myLogs.length > 0) {
      const totalMins = myLogs.reduce((acc, l) => acc + (parseInt(l.minutes_played || l.minutes || '0', 10) || 0), 0);
      const totalGoals = myLogs.reduce((acc, l) => acc + (parseInt(l.goals || '0', 10) || 0), 0);
      const totalAssists = myLogs.reduce((acc, l) => acc + (parseInt(l.assists || '0', 10) || 0), 0);
      const totalShots = myLogs.reduce((acc, l) => acc + (parseInt(l.shots || '0', 10) || 0), 0);
      const totalPasses = myLogs.reduce((acc, l) => acc + (parseInt(l.total_passes || l.passes || '0', 10) || 0), 0);
      const compPasses = myLogs.reduce((acc, l) => acc + (parseInt(l.completed_passes || '0', 10) || 0), 0);
      const tackles = myLogs.reduce((acc, l) => acc + (parseInt(l.tackles || '0', 10) || 0), 0);
      const interceptions = myLogs.reduce((acc, l) => acc + (parseInt(l.interceptions || '0', 10) || 0), 0);

      return {
        id: assignedPlayerId || currentUser?.id || "my-player",
        name: rosterMatch?.name || userFullName,
        position: activePos,
        backNumber: rosterMatch?.backNumber || "-",
        preferredFoot: activeFoot,
        nationality: rosterMatch?.nationality || "Wales",
        minutesPlayed: totalMins || rosterMatch?.minutesPlayed || 90,
        appearances: myLogs.length,
        totalPasses: totalPasses || rosterMatch?.totalPasses || 0,
        successfulPasses: compPasses || rosterMatch?.successfulPasses || 0,
        defensiveDuels: tackles + interceptions || rosterMatch?.defensiveDuels || 0,
        defensiveDuelsWon: tackles || rosterMatch?.defensiveDuelsWon || 0,
        shots: totalShots || rosterMatch?.shots || 0,
        shotsOnTarget: Math.round(totalShots * 0.6) || rosterMatch?.shotsOnTarget || 0,
        goals: totalGoals || rosterMatch?.goals || 0,
        assists: totalAssists || rosterMatch?.assists || 0,
        interceptions: interceptions || rosterMatch?.interceptions || 0
      };
    }

    if (rosterMatch) {
      return {
        ...rosterMatch,
        position: activePos,
        preferredFoot: activeFoot
      };
    }

    return {
      id: assignedPlayerId || "my-player",
      name: userFullName,
      position: activePos,
      backNumber: "-",
      preferredFoot: activeFoot,
      nationality: "Wales",
      minutesPlayed: 0,
      appearances: 0,
      totalPasses: 0,
      successfulPasses: 0,
      defensiveDuels: 0,
      defensiveDuelsWon: 0,
      shots: 0,
      shotsOnTarget: 0,
      goals: 0,
      assists: 0
    };
  }, [myLogs, assignedPlayerId, currentUser, players, userProfileData, selectedPosition, selectedFoot]);

  if (loading) {
    return (
      <div className="p-8 text-center bg-[#0b0f19] rounded-2xl border border-[#334155] text-slate-300 animate-pulse flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
        <span>Loading performance statistics & player credentials...</span>
      </div>
    );
  }

  const isStaffUser = currentUser?.role !== UserRole.Player || !!currentUser?.isAdmin;

  // Mandatory Onboarding UI before accessing 'My Performance' (Players only)
  if (needsOnboarding && !isStaffUser) {
    return (
      <div className="max-w-xl mx-auto my-8 bg-[#0f172a] border border-cyan-500/40 rounded-2xl p-6 sm:p-8 shadow-2xl text-white space-y-6 animate-fadeIn">
        
        {/* Header */}
        <div className="text-center space-y-2 border-b border-slate-800 pb-5">
          <div className="mx-auto w-12 h-12 rounded-xl bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center text-cyan-400 shadow-md">
            <UserCheck className="w-6 h-6 text-cyan-400" />
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-black text-white tracking-wide">
            Player Onboarding & Profile Setup
          </h2>
          <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
            Welcome to <strong className="text-cyan-400">Cardiff Town FC</strong>! Before accessing your performance dashboard, please specify your tactical position and preferred foot.
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={(e) => { e.preventDefault(); handleCompleteOnboarding(); }} className="space-y-5">
          
          {/* 1. Primary Position Dropdown Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-cyan-400" />
              <span>Primary Position *</span>
            </label>
            <select
              value={selectedPosition}
              onChange={(e) => setSelectedPosition(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-3 text-sm font-medium focus:border-cyan-400 focus:outline-none"
              required
            >
              {POSITIONS.map(p => (
                <option key={p.code} value={p.code}>
                  {p.code} - {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Preferred Foot Dropdown Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
              <Footprints className="w-4 h-4 text-cyan-400" />
              <span>Preferred Foot *</span>
            </label>
            <select
              value={selectedFoot}
              onChange={(e) => setSelectedFoot(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-3 text-sm font-medium focus:border-cyan-400 focus:outline-none"
              required
            >
              {FEET.map(foot => (
                <option key={foot} value={foot}>{foot} Foot</option>
              ))}
            </select>
          </div>

          {/* 3. Nationality Free-text Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>Nationality *</span>
            </label>
            <input
              type="text"
              value={selectedNationality}
              onChange={(e) => setSelectedNationality(e.target.value)}
              placeholder="e.g. South Korea, Wales, England"
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-3 text-sm font-medium focus:border-cyan-400 focus:outline-none"
              required
            />
          </div>

          {/* 4. Squad Number Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span>Squad Number *</span>
            </label>
            <input
              type="text"
              value={selectedSquadNumber}
              onChange={(e) => setSelectedSquadNumber(e.target.value)}
              placeholder="e.g. 10, 7, 23"
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-3 text-sm font-medium focus:border-cyan-400 focus:outline-none"
              required
            />
          </div>

          {/* Submit Button */}
          <div className="pt-4 border-t border-slate-800">
            <button
              type="submit"
              disabled={isSubmittingOnboarding}
              className="w-full py-3.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-sm transition-all shadow-xl flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmittingOnboarding ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Saving Credentials...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-white" />
                  <span>Complete Setup & Launch Dashboard</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    );
  }

  return (
    <IndividualPlayerDashboard
      player={matchedPlayer}
      currentUser={currentUser}
      matches={matches}
      isUnmatched={!matchedPlayer}
    />
  );
}
