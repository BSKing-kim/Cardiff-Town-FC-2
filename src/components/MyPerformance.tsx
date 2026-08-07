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
        const targetUserId = currentUser?.id || user?.id || (currentUser as any)?.user_id;

        let profilePlayerId: string | null = currentUser?.playerId || (currentUser as any)?.player_id || null;
        let profileName = `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || currentUser?.username;
        let dbProfile: any = null;

        const isStaffUser = currentUser?.role !== UserRole.Player || !!currentUser?.isAdmin;

        if (targetUserId || currentUser?.username) {
          // Fetch latest user profile row from Supabase
          let profileQuery = (supabase.from('profiles') as any).select('*');
          if (targetUserId) {
            profileQuery = profileQuery.or(`id.eq.${targetUserId},user_id.eq.${targetUserId}`);
          } else if (currentUser?.username) {
            profileQuery = profileQuery.eq('username', currentUser.username);
          }

          const { data: profile } = await profileQuery.maybeSingle();

          if (profile) {
            dbProfile = profile;
            setUserProfileData(profile);

            if (profile.player_id) {
              profilePlayerId = profile.player_id;
            }
            if (profile.full_name) {
              profileName = profile.full_name;
            }

            // Check onboarding modal visibility rule:
            // IF is_onboarded === true OR onboarding_completed === true OR (position and nationality exist): DO NOT show modal
            const isCompleted = profile.is_onboarded === true || 
                                profile.onboarding_completed === true || 
                                (!!profile.position && !!profile.nationality);

            if (!isStaffUser && !isCompleted) {
              if (isMounted) setNeedsOnboarding(true);
            } else {
              if (isMounted) setNeedsOnboarding(false);
            }
          } else {
            // New user registration without DB profile yet -> prompt onboarding for Players
            if (!isStaffUser && isMounted) setNeedsOnboarding(true);
          }
        } else {
          const isUserCompleted = (currentUser as any)?.is_onboarded === true ||
                                  (currentUser as any)?.onboarding_completed === true ||
                                  currentUser?.isOnboarded === true ||
                                  currentUser?.is_onboarded === true ||
                                  (!!currentUser?.position && !!currentUser?.nationality);

          if (!isStaffUser && !isUserCompleted) {
            if (isMounted) setNeedsOnboarding(true);
          } else {
            if (isMounted) setNeedsOnboarding(false);
          }
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
      const userId = currentUser?.id || user?.id || (currentUser as any)?.user_id;
      const targetUsername = currentUser?.username;
      const fullName = `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || currentUser?.username || "Player";

      const pId = assignedPlayerId || userProfileData?.player_id || `PLR-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      const updatePayload = {
        position: selectedPosition,
        preferred_foot: selectedFoot,
        nationality: selectedNationality,
        squad_number: selectedSquadNumber,
        is_onboarded: true,
        onboarding_completed: true,
        updated_at: new Date().toISOString()
      };

      // 1. Submit explicit, awaited update query to profiles table in Supabase (.eq('id', currentUser.id))
      let { error: updateErr } = await (supabase.from('profiles') as any)
        .update(updatePayload)
        .eq('id', userId);

      if (updateErr) {
        const { error: userErr } = await (supabase.from('profiles') as any)
          .update(updatePayload)
          .eq('user_id', userId);

        if (userErr && targetUsername) {
          const { error: nameErr } = await (supabase.from('profiles') as any)
            .update(updatePayload)
            .eq('username', targetUsername);

          if (nameErr) {
            const profilePayload: any = {
              id: userId,
              user_id: userId,
              ...updatePayload,
              player_id: pId,
              full_name: fullName,
              username: targetUsername
            };

            const { error: upsertErr } = await (supabase.from('profiles') as any)
              .upsert(profilePayload, { onConflict: 'user_id' });

            if (upsertErr) {
              console.error("Failed to save profile setup:", upsertErr);
              alert("Failed to save profile settings: " + (upsertErr.message || String(upsertErr)));
              return;
            }
          }
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
        ...updatePayload,
        player_id: pId
      }));

      if (currentUser) {
        currentUser.position = selectedPosition;
        currentUser.preferredFoot = selectedFoot;
        currentUser.preferred_foot = selectedFoot;
        currentUser.nationality = selectedNationality;
        (currentUser as any).squad_number = selectedSquadNumber;
        (currentUser as any).squadNumber = selectedSquadNumber;
        (currentUser as any).onboarding_completed = true;
        (currentUser as any).is_onboarded = true;
        currentUser.onboarding_completed = true;
        currentUser.isOnboarded = true;
        currentUser.is_onboarded = true;

        localStorage.setItem("team_perf_analyzer_current_user", JSON.stringify(currentUser));
      }

      setAssignedPlayerId(pId);
      setNeedsOnboarding(false);
    } catch (err: any) {
      console.error("Failed to save profile setup:", err);
      alert('Failed to save profile settings: ' + (err?.message || String(err)));
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
      const totalSot = myLogs.reduce((acc, l) => acc + (parseInt(l.shots_on_target || l.shotsOnTarget || '0', 10) || 0), 0);
      const totalPasses = myLogs.reduce((acc, l) => acc + (parseInt(l.passes || l.total_passes || '0', 10) || 0), 0);
      const compPasses = myLogs.reduce((acc, l) => acc + (parseInt(l.successful_passes || l.completed_passes || '0', 10) || 0), 0);
      const backwardsPasses = myLogs.reduce((acc, l) => acc + (parseInt(l.backwards_passes || '0', 10) || 0), 0);
      const forwardsPasses = myLogs.reduce((acc, l) => acc + (parseInt(l.forwards_passes || '0', 10) || 0), 0);
      const longPasses = myLogs.reduce((acc, l) => acc + (parseInt(l.long_passes || '0', 10) || 0), 0);
      const compLongPasses = myLogs.reduce((acc, l) => acc + (parseInt(l.successful_long_passes || '0', 10) || 0), 0);
      const keyPasses = myLogs.reduce((acc, l) => acc + (parseInt(l.key_passes || '0', 10) || 0), 0);
      const compKeyPasses = myLogs.reduce((acc, l) => acc + (parseInt(l.successful_key_passes || '0', 10) || 0), 0);
      const throughBalls = myLogs.reduce((acc, l) => acc + (parseInt(l.through_balls || '0', 10) || 0), 0);
      const compThroughBalls = myLogs.reduce((acc, l) => acc + (parseInt(l.successful_through_balls || '0', 10) || 0), 0);
      const crosses = myLogs.reduce((acc, l) => acc + (parseInt(l.crosses || '0', 10) || 0), 0);
      const compCrosses = myLogs.reduce((acc, l) => acc + (parseInt(l.successful_crosses || '0', 10) || 0), 0);
      const dribbles = myLogs.reduce((acc, l) => acc + (parseInt(l.dribbles || '0', 10) || 0), 0);
      const compDribbles = myLogs.reduce((acc, l) => acc + (parseInt(l.successful_dribbles || '0', 10) || 0), 0);
      const duels = myLogs.reduce((acc, l) => acc + (parseInt(l.duels || '0', 10) || 0), 0);
      const duelsWon = myLogs.reduce((acc, l) => acc + (parseInt(l.duels_won || '0', 10) || 0), 0);
      const aerialDuels = myLogs.reduce((acc, l) => acc + (parseInt(l.aerial_duels || '0', 10) || 0), 0);
      const aerialDuelsWon = myLogs.reduce((acc, l) => acc + (parseInt(l.aerial_duels_won || '0', 10) || 0), 0);
      const groundDuels = myLogs.reduce((acc, l) => acc + (parseInt(l.ground_duels || '0', 10) || 0), 0);
      const groundDuelsWon = myLogs.reduce((acc, l) => acc + (parseInt(l.ground_duels_won || '0', 10) || 0), 0);
      const tackles = myLogs.reduce((acc, l) => acc + (parseInt(l.tackles || '0', 10) || 0), 0);
      const tacklesWon = myLogs.reduce((acc, l) => acc + (parseInt(l.tackles_won || '0', 10) || 0), 0);
      const ballRecoveries = myLogs.reduce((acc, l) => acc + (parseInt(l.ball_recoveries || '0', 10) || 0), 0);
      const interceptions = myLogs.reduce((acc, l) => acc + (parseInt(l.interceptions || '0', 10) || 0), 0);
      const clearances = myLogs.reduce((acc, l) => acc + (parseInt(l.clearances || '0', 10) || 0), 0);
      const blocks = myLogs.reduce((acc, l) => acc + (parseInt(l.blocks || '0', 10) || 0), 0);
      const ownGoals = myLogs.reduce((acc, l) => acc + (parseInt(l.own_goals || '0', 10) || 0), 0);
      const turnovers = myLogs.reduce((acc, l) => acc + (parseInt(l.turnovers || '0', 10) || 0), 0);
      const miscontrols = myLogs.reduce((acc, l) => acc + (parseInt(l.miscontrols || '0', 10) || 0), 0);
      const unsuccessfulDribbles = myLogs.reduce((acc, l) => acc + (parseInt(l.unsuccessful_dribbles || '0', 10) || 0), 0);
      const possessionLost = myLogs.reduce((acc, l) => acc + (parseInt(l.possession_lost || '0', 10) || 0), 0);
      const offsides = myLogs.reduce((acc, l) => acc + (parseInt(l.offsides || '0', 10) || 0), 0);
      const fouls = myLogs.reduce((acc, l) => acc + (parseInt(l.fouls || '0', 10) || 0), 0);
      const yellowCards = myLogs.reduce((acc, l) => acc + (parseInt(l.yellow_cards || '0', 10) || 0), 0);
      const redCards = myLogs.reduce((acc, l) => acc + (parseInt(l.red_cards || '0', 10) || 0), 0);

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
        defensiveDuels: groundDuels || tackles + interceptions || rosterMatch?.defensiveDuels || 0,
        defensiveDuelsWon: groundDuelsWon || tackles || rosterMatch?.defensiveDuelsWon || 0,
        shots: totalShots || rosterMatch?.shots || 0,
        shotsOnTarget: totalSot || rosterMatch?.shotsOnTarget || 0,
        goals: totalGoals || rosterMatch?.goals || 0,
        assists: totalAssists || rosterMatch?.assists || 0,
        interceptions: interceptions || rosterMatch?.interceptions || 0,
        backwards_passes: backwardsPasses,
        forwards_passes: forwardsPasses,
        longPasses: longPasses,
        successfulLongPasses: compLongPasses,
        keyPasses: keyPasses,
        successfulKeyPasses: compKeyPasses,
        throughBalls: throughBalls,
        successfulThroughBalls: compThroughBalls,
        crosses: crosses,
        successfulCrosses: compCrosses,
        dribbles: dribbles,
        successfulDribbles: compDribbles,
        duels: duels,
        duelsWon: duelsWon,
        aerialDuels: aerialDuels,
        aerialDuelsWon: aerialDuelsWon,
        tackles: tackles,
        tacklesWon: tacklesWon,
        ballRecoveries: ballRecoveries,
        clearances: clearances,
        blocks: blocks,
        own_goals: ownGoals,
        turnovers: turnovers,
        miscontrols: miscontrols,
        unsuccessful_dribbles: unsuccessfulDribbles,
        possession_lost: possessionLost,
        offsides: offsides,
        fouls: fouls,
        yellow_cards: yellowCards,
        red_cards: redCards
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
