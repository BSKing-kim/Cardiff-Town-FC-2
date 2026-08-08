import React, { useState, useMemo, useEffect } from "react";
import { Player, UserProfile, MatchData, UserRole, ProfileUpdateRequest } from "../types";
import { DataService } from "../lib/dataService";
import { supabase } from "../lib/supabase";
import { Shield, Clock, BarChart2, List, Lock, Footprints, Flag, Edit3, UserCheck, ChevronRight, Target, Award, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

interface IndividualPlayerDashboardProps {
  player?: Player | any | null;
  selectedPlayer?: Player | any | null;
  currentUser?: UserProfile | null;
  matches?: MatchData[];
  onClose?: () => void;
  isUnmatched?: boolean;
}

export default function IndividualPlayerDashboard({
  player,
  selectedPlayer,
  currentUser,
  matches = [],
  onClose,
  isUnmatched = false
}: IndividualPlayerDashboardProps) {
  const [viewMode, setViewMode] = useState<"chart" | "list">("chart");

  // Profile Edit Modal & Request states
  const [showEditModal, setShowEditModal] = useState(false);
  const [pendingReq, setPendingReq] = useState<ProfileUpdateRequest | null>(null);
  const [editSubmittedToast, setEditSubmittedToast] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editForm, setEditForm] = useState({
    position: "CM",
    nationality: "Wales",
    preferredFoot: "Right",
    squadNumber: ""
  });

  const fetchProfileAndPendingRequests = async () => {
    const userId = currentUser?.id || currentUser?.user_id || currentUser?.username;
    if (!userId) return;

    try {
      // 1. Fetch pending request directly from Supabase profile_update_requests table
      const { data, error } = await (supabase.from('profile_update_requests') as any)
        .select('*')
        .eq('status', 'pending');

      if (!error && Array.isArray(data)) {
        const myReq = data.find((r: any) => 
          r.user_id === userId || 
          r.user_id === currentUser?.id || 
          r.user_id === currentUser?.user_id || 
          r.user_id === currentUser?.username
        );

        if (myReq) {
          let changes = myReq.requested_changes;
          if (typeof changes === 'string') {
            try { changes = JSON.parse(changes); } catch {}
          }
          setPendingReq({
            id: String(myReq.id),
            user_id: myReq.user_id,
            player_name: myReq.player_name || 'Player',
            requested_changes: changes || {},
            status: 'pending',
            created_at: myReq.created_at || new Date().toISOString()
          });
          return;
        }
      }
    } catch (err) {
      console.warn("Failed to fetch pending requests directly from Supabase:", err);
    }

    // 2. Check if user profile has pending_changes
    if ((currentUser as any)?.pending_changes) {
      setPendingReq({
        id: `REQ-${Date.now()}`,
        user_id: userId,
        player_name: currentUser?.firstName ? `${currentUser.firstName} ${currentUser.lastName}` : (currentUser?.username || "Player"),
        requested_changes: (currentUser as any).pending_changes,
        status: 'pending',
        created_at: new Date().toISOString()
      });
      return;
    }

    // 3. Fallback to DataService helper
    try {
      const reqs = await DataService.getProfileUpdateRequests(true);
      const myReq = reqs.find(r => 
        (r.user_id === userId || r.user_id === currentUser?.id || r.user_id === currentUser?.user_id || r.user_id === currentUser?.username) && 
        r.status === "pending"
      );
      setPendingReq(myReq || null);
    } catch (e) {
      setPendingReq(null);
    }
  };

  useEffect(() => {
    fetchProfileAndPendingRequests();
  }, [currentUser]);

  const [fetchedPlayerStats, setFetchedPlayerStats] = useState<any[]>([]);

  useEffect(() => {
    const fetchStatsForPlayer = async () => {
      const targetPlayer = selectedPlayer || player;
      if (!targetPlayer) return;

      const targetPlayerId = targetPlayer.id && targetPlayer.id !== "unlinked-profile"
        ? targetPlayer.id
        : ((targetPlayer as any).player_id || (targetPlayer as any).user_id || (targetPlayer as any).playerId);

      const targetPlayerName = targetPlayer.name || (targetPlayer as any).full_name || (targetPlayer as any).username || '';
      const targetPlayerNum = Number((targetPlayer as any).squad_number || (targetPlayer as any).player_number || targetPlayer.backNumber || 0);

      console.log("Fetching stats for target player in IndividualPlayerDashboard:", { targetPlayerId, targetPlayerName, targetPlayerNum });

      let query = (supabase.from('player_stats') as any).select('*');

      if (targetPlayerId && targetPlayerId !== "unlinked-profile") {
        // Try matching player_id, user_id, username, or player_name/number
        query = query.or(
          `player_id.eq.${targetPlayerId},user_id.eq.${targetPlayerId},username.ilike.%${targetPlayerName}%,player_name.ilike.%${targetPlayerName}%`
        );
      } else if (targetPlayerName) {
        if (targetPlayerNum > 0) {
          query = query.or(
            `username.ilike.%${targetPlayerName}%,player_name.ilike.%${targetPlayerName}%,player_number.eq.${targetPlayerNum}`
          );
        } else {
          query = query.or(
            `username.ilike.%${targetPlayerName}%,player_name.ilike.%${targetPlayerName}%`
          );
        }
      } else {
        return;
      }

      try {
        const { data: playerMatchStats, error } = await query.order('created_at', { ascending: true });

        if (error) {
          console.error("Error fetching player stats:", error);
        } else if (playerMatchStats && playerMatchStats.length > 0) {
          console.log("Loaded stats for target player in IndividualPlayerDashboard:", playerMatchStats);
          setFetchedPlayerStats(playerMatchStats);
        } else {
          // Fallback search in match_logs
          let logsQuery = (supabase.from('match_logs') as any).select('*');
          if (targetPlayerId && targetPlayerId !== "unlinked-profile") {
            logsQuery = logsQuery.or(`player_id.eq.${targetPlayerId},player_name.ilike.%${targetPlayerName}%`);
          } else if (targetPlayerName) {
            logsQuery = logsQuery.ilike('player_name', `%${targetPlayerName}%`);
          }
          const { data: logs } = await logsQuery;
          if (logs) setFetchedPlayerStats(logs);
        }
      } catch (e) {
        console.warn("Exception fetching player stats:", e);
      }
    };

    fetchStatsForPlayer();
  }, [
    selectedPlayer?.id,
    (selectedPlayer as any)?.player_id,
    (selectedPlayer as any)?.user_id,
    (selectedPlayer as any)?.username,
    (selectedPlayer as any)?.full_name,
    selectedPlayer?.name,
    player?.id,
    (player as any)?.player_id,
    (player as any)?.user_id,
    (player as any)?.username,
    (player as any)?.full_name,
    player?.name
  ]);

  const aggregatedStats = useMemo(() => {
    if (!fetchedPlayerStats || fetchedPlayerStats.length === 0) return null;
    
    return fetchedPlayerStats.reduce((acc, row) => {
      acc.goals += Number(row.goals || 0);
      acc.assists += Number(row.assists || 0);
      acc.shots += Number(row.shots || 0);
      acc.shotsOnTarget += Number(row.shots_on_target || row.shotsOnTarget || 0);
      acc.totalPasses += Number(row.passes || row.total_passes || row.totalPasses || 0);
      acc.successfulPasses += Number(row.successful_passes || row.completed_passes || row.successfulPasses || 0);
      acc.keyPasses += Number(row.key_passes || row.keyPasses || 0);
      acc.longPasses += Number(row.long_passes || row.longPasses || 0);
      acc.throughBalls += Number(row.through_balls || row.throughBalls || 0);
      acc.crosses += Number(row.crosses || 0);
      acc.successfulCrosses += Number(row.successful_crosses || 0);
      acc.dribbles += Number(row.dribbles || 0);
      acc.successfulDribbles += Number(row.successful_dribbles || 0);
      acc.duels += Number(row.duels || 0);
      acc.duelsWon += Number(row.duels_won || 0);
      acc.defensiveDuels += Number(row.ground_duels || row.defensiveDuels || row.duels || 0);
      acc.defensiveDuelsWon += Number(row.ground_duels_won || row.defensiveDuelsWon || row.duels_won || 0);
      acc.aerialDuels += Number(row.aerial_duels || 0);
      acc.aerialDuelsWon += Number(row.aerial_duels_won || 0);
      acc.tackles += Number(row.tackles || 0);
      acc.tacklesWon += Number(row.tackles_won || 0);
      acc.interceptions += Number(row.interceptions || 0);
      acc.clearances += Number(row.clearances || 0);
      acc.blocks += Number(row.blocks || 0);
      acc.ballRecoveries += Number(row.ball_recoveries || 0);
      acc.turnovers += Number(row.turnovers || 0);
      acc.fouls += Number(row.fouls || 0);
      acc.yellowCards += Number(row.yellow_cards || 0);
      acc.redCards += Number(row.red_cards || 0);
      acc.minutesPlayed += Number(row.minutes_played || row.minutesPlayed || 90);
      acc.appearances += 1;
      return acc;
    }, {
      goals: 0, assists: 0, shots: 0, shotsOnTarget: 0, totalPasses: 0,
      successfulPasses: 0, keyPasses: 0, longPasses: 0, throughBalls: 0,
      crosses: 0, successfulCrosses: 0, dribbles: 0, successfulDribbles: 0,
      duels: 0, duelsWon: 0, defensiveDuels: 0, defensiveDuelsWon: 0,
      aerialDuels: 0, aerialDuelsWon: 0, tackles: 0, tacklesWon: 0,
      interceptions: 0, clearances: 0, blocks: 0, ballRecoveries: 0,
      turnovers: 0, fouls: 0, yellowCards: 0, redCards: 0, minutesPlayed: 0, appearances: 0
    });
  }, [fetchedPlayerStats]);

  // Fallback player object if unmatched or null
  const activePlayerObj: Player = useMemo(() => {
    const baseObj = (player && !isUnmatched) ? player : {
      id: "unlinked-profile",
      name: currentUser
        ? (currentUser.firstName && currentUser.lastName
            ? `${currentUser.firstName} ${currentUser.lastName}`
            : currentUser.username || "Registered User")
        : "Guest User",
      position: "Pending",
      backNumber: "-",
      preferredFoot: "-",
      nationality: "-",
      minutesPlayed: 0,
      appearances: 0,
      totalPasses: 0,
      successfulPasses: 0,
      keyPasses: 0,
      touches: 0,
      defensiveDuels: 0,
      defensiveDuelsWon: 0,
      shots: 0,
      shotsOnTarget: 0,
      goals: 0,
      assists: 0
    };

    if (aggregatedStats && fetchedPlayerStats.length > 0) {
      return {
        ...baseObj,
        ...aggregatedStats,
        goals: aggregatedStats.goals,
        assists: aggregatedStats.assists,
        shots: aggregatedStats.shots,
        shotsOnTarget: aggregatedStats.shotsOnTarget,
        totalPasses: aggregatedStats.totalPasses,
        successfulPasses: aggregatedStats.successfulPasses,
        minutesPlayed: aggregatedStats.minutesPlayed,
        appearances: aggregatedStats.appearances
      } as unknown as Player;
    }

    return baseObj as unknown as Player;
  }, [player, currentUser, isUnmatched, aggregatedStats, fetchedPlayerStats]);

  // Safe value extraction & percentage formula helpers
  const safeVal = (v: any) => {
    if (v === undefined || v === null) return 0;
    const parsed = parseInt(String(v), 10);
    return isNaN(parsed) ? 0 : parsed;
  };

  const safeDivPct = (num: number, den: number): number => {
    if (!den || den === 0) return 0;
    return Number(((num / den) * 100).toFixed(1));
  };

  const safeDivStr = (num: number, den: number): string => {
    if (!den || den === 0) return "0.0%";
    return ((num / den) * 100).toFixed(1) + "%";
  };

  // Extract all 34 raw metrics from activePlayerObj
  const goals = safeVal(activePlayerObj.goals);
  const shots = safeVal(activePlayerObj.shots);
  const shotsOnTarget = safeVal(activePlayerObj.shotsOnTarget || (activePlayerObj as any).shots_on_target);
  const passes = safeVal(activePlayerObj.totalPasses || (activePlayerObj as any).passes);
  const successfulPasses = safeVal(activePlayerObj.successfulPasses || (activePlayerObj as any).successful_passes);
  const backwardsPasses = safeVal((activePlayerObj as any).backwards_passes || (activePlayerObj as any).backwardPasses);
  const forwardsPasses = safeVal((activePlayerObj as any).forwards_passes || (activePlayerObj as any).forwardPasses);
  const longPasses = safeVal((activePlayerObj as any).longPasses || (activePlayerObj as any).long_passes);
  const successfulLongPasses = safeVal((activePlayerObj as any).successfulLongPasses || (activePlayerObj as any).successful_long_passes);
  const keyPasses = safeVal(activePlayerObj.keyPasses || (activePlayerObj as any).key_passes);
  const successfulKeyPasses = safeVal((activePlayerObj as any).successfulKeyPasses || (activePlayerObj as any).successful_key_passes);
  const throughBalls = safeVal(activePlayerObj.throughBalls || (activePlayerObj as any).through_balls);
  const successfulThroughBalls = safeVal((activePlayerObj as any).successfulThroughBalls || (activePlayerObj as any).successful_through_balls);
  const crosses = safeVal((activePlayerObj as any).crosses);
  const successfulCrosses = safeVal((activePlayerObj as any).successfulCrosses || (activePlayerObj as any).successful_crosses);
  const dribbles = safeVal((activePlayerObj as any).dribbles);
  const successfulDribbles = safeVal((activePlayerObj as any).successfulDribbles || (activePlayerObj as any).successful_dribbles);
  const duels = safeVal((activePlayerObj as any).duels);
  const duelsWon = safeVal((activePlayerObj as any).duelsWon || (activePlayerObj as any).duels_won);
  const aerialDuels = safeVal(activePlayerObj.aerialDuels || (activePlayerObj as any).aerial_duels);
  const aerialDuelsWon = safeVal(activePlayerObj.aerialDuelsWon || (activePlayerObj as any).aerial_duels_won);
  const groundDuels = safeVal(activePlayerObj.defensiveDuels || (activePlayerObj as any).ground_duels);
  const groundDuelsWon = safeVal(activePlayerObj.defensiveDuelsWon || (activePlayerObj as any).ground_duels_won);
  const ballRecoveries = safeVal(activePlayerObj.ballRecoveries || (activePlayerObj as any).ball_recoveries);
  const tackles = safeVal((activePlayerObj as any).tackles);
  const tacklesWon = safeVal((activePlayerObj as any).tacklesWon || (activePlayerObj as any).tackles_won);
  const interceptions = safeVal(activePlayerObj.interceptions);
  const clearances = safeVal(activePlayerObj.clearances);
  const blocks = safeVal((activePlayerObj as any).blocks);
  const ownGoals = safeVal((activePlayerObj as any).own_goals || (activePlayerObj as any).ownGoals);
  const turnovers = safeVal((activePlayerObj as any).turnovers);
  const miscontrols = safeVal((activePlayerObj as any).miscontrols || (activePlayerObj as any).miscontrol);
  const unsuccessfulDribbles = safeVal((activePlayerObj as any).unsuccessful_dribbles || (activePlayerObj as any).unsuccessfulDribble);
  const possessionLost = safeVal((activePlayerObj as any).possession_lost || (activePlayerObj as any).possessionLost);
  const offsides = safeVal((activePlayerObj as any).offsides || (activePlayerObj as any).offside);
  const fouls = safeVal((activePlayerObj as any).fouls);
  const yellowCards = safeVal((activePlayerObj as any).yellow_cards || (activePlayerObj as any).yellowCards);
  const redCards = safeVal((activePlayerObj as any).red_cards || (activePlayerObj as any).redCards);

  // Key KPI accuracy formulas
  const passAcc = safeDivPct(successfulPasses, passes);
  const groundDuelWin = safeDivPct(groundDuelsWon, groundDuels);
  const shotAccuracy = safeDivPct(shotsOnTarget, shots);
  const duelWonPct = safeDivPct(duelsWon, duels);
  const tackleWonPct = safeDivPct(tacklesWon, tackles);
  const goalConvPct = safeDivPct(goals, shots);

  const appearances = useMemo(() => {
    return activePlayerObj.appearances ?? (activePlayerObj.minutesPlayed ? Math.ceil(activePlayerObj.minutesPlayed / 90) : 0);
  }, [activePlayerObj.appearances, activePlayerObj.minutesPlayed]);

  // Generate Match-by-Match Trend Data for Performance Trend Chart
  const trendData = useMemo(() => {
    if (fetchedPlayerStats && fetchedPlayerStats.length > 0) {
      return fetchedPlayerStats.map((row, idx) => {
        const mShots = safeVal(row.shots);
        const mSot = safeVal(row.shots_on_target || row.shotsOnTarget);
        const mPasses = safeVal(row.passes || row.total_passes || row.totalPasses);
        const mCompPasses = safeVal(row.successful_passes || row.completed_passes || row.successfulPasses);
        const mDuels = safeVal(row.duels);
        const mDuelsWon = safeVal(row.duels_won || row.duelsWon);
        const mTackles = safeVal(row.tackles);
        const mTacklesWon = safeVal(row.tackles_won || row.tacklesWon);
        const mGoals = safeVal(row.goals);

        const mMatchId = row.match_id || row.matchId || `Match #${idx + 1}`;
        const matchInfo = (matches || []).find(m => String(m.id).trim() === String(mMatchId).trim());

        return {
          matchName: matchInfo?.opponent ? `vs ${matchInfo.opponent}` : mMatchId,
          date: matchInfo?.date || row.created_at?.slice(0, 10) || `2026-07-0${idx + 1}`,
          goalConv: safeDivPct(mGoals, mShots),
          passAcc: safeDivPct(mCompPasses, mPasses),
          shotAcc: safeDivPct(mSot, mShots),
          duelWon: safeDivPct(mDuelsWon, mDuels),
          tackleWon: safeDivPct(mTacklesWon, mTackles),
          result: matchInfo?.result || "Played"
        };
      });
    }

    const safeMatches = Array.isArray(matches) ? matches : [];
    const ourMatches = safeMatches.filter(m => m && !m.isOpponentTeam).sort((a, b) => (a.date || "").localeCompare(b.date || ""));

    if (ourMatches.length > 0) {
      return ourMatches.map((m) => {
        const mGoals = safeVal((m as any).goals);
        const mShots = safeVal((m as any).shots);
        const mSot = safeVal((m as any).shotsOnTarget || (m as any).shots_on_target);
        const mPasses = safeVal((m as any).totalPasses || (m as any).passes);
        const mCompPasses = safeVal((m as any).successfulPasses || (m as any).completed_passes);
        const mDuels = safeVal((m as any).duels);
        const mDuelsWon = safeVal((m as any).duelsWon || (m as any).duels_won);
        const mTackles = safeVal((m as any).tackles);
        const mTacklesWon = safeVal((m as any).tacklesWon || (m as any).tackles_won);

        return {
          matchName: m.opponent ? `vs ${m.opponent}` : "Match",
          date: m.date || "2026-07-01",
          goalConv: safeDivPct(mGoals, mShots) || goalConvPct,
          passAcc: safeDivPct(mCompPasses, mPasses) || passAcc,
          shotAcc: safeDivPct(mSot, mShots) || shotAccuracy,
          duelWon: safeDivPct(mDuelsWon, mDuels) || duelWonPct,
          tackleWon: safeDivPct(mTacklesWon, mTackles) || tackleWonPct,
          result: m.result || "D (0-0)"
        };
      });
    }

    return [
      { matchName: "Match #1", date: "2026-07-04", goalConv: goalConvPct, passAcc, shotAcc: shotAccuracy, duelWon: duelWonPct, tackleWon: tackleWonPct, result: "N/A" },
      { matchName: "Match #2", date: "2026-07-11", goalConv: goalConvPct, passAcc, shotAcc: shotAccuracy, duelWon: duelWonPct, tackleWon: tackleWonPct, result: "N/A" },
      { matchName: "Match #3", date: "2026-07-18", goalConv: goalConvPct, passAcc, shotAcc: shotAccuracy, duelWon: duelWonPct, tackleWon: tackleWonPct, result: "N/A" }
    ];
  }, [fetchedPlayerStats, matches, goalConvPct, passAcc, shotAccuracy, duelWonPct, tackleWonPct]);

  const [selectedMatchFilter, setSelectedMatchFilter] = useState<string>("all");

  // Detailed Metrics Section - Exact list in order requested (34 items)
  const selectedMetricsList = useMemo(() => {
    return [
      { label: "Passes", value: `${passes}` },
      { label: "Backwards", value: `${backwardsPasses}` },
      { label: "Forwards", value: `${forwardsPasses}` },
      { label: "Long Passes", value: `${longPasses}` },
      { label: "Key Passes", value: `${keyPasses}` },
      { label: "Through Balls", value: `${throughBalls}` },
      { label: "Crosses", value: `${crosses}` },
      { label: "Long Pass Suc %", value: safeDivStr(successfulLongPasses, longPasses) },
      { label: "Key Pass Suc %", value: safeDivStr(successfulKeyPasses, keyPasses) },
      { label: "Through Ball Suc %", value: safeDivStr(successfulThroughBalls, throughBalls) },
      { label: "Cross Suc %", value: safeDivStr(successfulCrosses, crosses) },
      { label: "Dribbles", value: `${dribbles}` },
      { label: "Dribble Suc %", value: safeDivStr(successfulDribbles, dribbles) },
      { label: "Duels", value: `${duels}` },
      { label: "Duel Wons", value: `${duelsWon}` },
      { label: "Aerial Duels", value: `${aerialDuels}` },
      { label: "Aerial Duel Wons", value: `${aerialDuelsWon}` },
      { label: "Ground Duels", value: `${groundDuels}` },
      { label: "Ground Duel Wons", value: `${groundDuelsWon}` },
      { label: "Ball Recovery", value: `${ballRecoveries}` },
      { label: "Tackles", value: `${tackles}` },
      { label: "Tackle Wons", value: `${tacklesWon}` },
      { label: "Interceptions", value: `${interceptions}` },
      { label: "Clearance", value: `${clearances}` },
      { label: "Blocked", value: `${blocks}` },
      { label: "Own Goals", value: `${ownGoals}` },
      { label: "Turnovers", value: `${turnovers}` },
      { label: "Miscontrol", value: `${miscontrols}` },
      { label: "Uns Dribble", value: `${unsuccessfulDribbles}` },
      { label: "Possession Lost", value: `${possessionLost}` },
      { label: "Offside", value: `${offsides}` },
      { label: "Fouls", value: `${fouls}` },
      { label: "Yellow Card", value: `${yellowCards}` },
      { label: "Red Card", value: `${redCards}` }
    ];
  }, [
    passes, backwardsPasses, forwardsPasses, longPasses, successfulLongPasses,
    keyPasses, successfulKeyPasses, throughBalls, successfulThroughBalls,
    crosses, successfulCrosses, dribbles, successfulDribbles, duels, duelsWon,
    aerialDuels, aerialDuelsWon, groundDuels, groundDuelsWon, ballRecoveries,
    tackles, tacklesWon, interceptions, clearances, blocks, ownGoals, turnovers,
    miscontrols, unsuccessfulDribbles, possessionLost, offsides, fouls, yellowCards, redCards
  ]);

  const preferredFoot = (currentUser as any)?.preferred_foot || (currentUser as any)?.preferredFoot || activePlayerObj.preferredFoot || "Right";
  const nationality = (currentUser as any)?.nationality || activePlayerObj.nationality || "Wales";
  const position = (currentUser as any)?.position || activePlayerObj.position || "CM";
  const backNumberVal = (currentUser as any)?.squad_number || (currentUser as any)?.squadNumber || (currentUser as any)?.back_number || (currentUser as any)?.backNumber || (currentUser as any)?.jersey_number || (activePlayerObj.backNumber ? String(activePlayerObj.backNumber) : "N/A");

  const handleOpenEditModal = () => {
    setEditForm({
      position: position || "CM",
      nationality: nationality || "Wales",
      preferredFoot: preferredFoot || "Right",
      squadNumber: backNumberVal !== "N/A" ? backNumberVal : ""
    });
    setShowEditModal(true);
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      console.log("Submitting attribute update request to Supabase...");
      const userId = currentUser?.id || currentUser?.user_id || currentUser?.username || "user-" + Date.now();
      const playerName = currentUser
        ? (currentUser.firstName && currentUser.lastName ? `${currentUser.firstName} ${currentUser.lastName}` : (currentUser.username || "Player"))
        : (activePlayerObj.name || "Player");

      const reqChanges = {
        position: editForm.position,
        preferred_foot: editForm.preferredFoot,
        preferredFoot: editForm.preferredFoot,
        nationality: editForm.nationality,
        squad_number: editForm.squadNumber,
        squadNumber: editForm.squadNumber,
        back_number: editForm.squadNumber,
        backNumber: editForm.squadNumber
      };

      // Direct insert into profile_update_requests table as specified in Directive 3
      const { data, error } = await (supabase.from('profile_update_requests') as any)
        .insert([
          {
            user_id: String(userId),
            player_name: String(playerName),
            requested_changes: reqChanges,
            status: 'pending'
          }
        ])
        .select();

      if (error) {
        console.error("Supabase Request Insert Error:", error);
      } else {
        console.log("Successfully inserted request into profile_update_requests:", data);
      }

      // Save to profiles pending_changes column as well
      try {
        await (supabase.from('profiles') as any)
          .update({
            pending_changes: reqChanges
          })
          .or(`id.eq.${userId},user_id.eq.${userId},username.eq.${userId}`);
      } catch (profErr) {
        console.warn("Failed updating pending_changes on profiles:", profErr);
      }

      // Sync via DataService helper
      const newReq = await DataService.submitProfileUpdateRequest({
        user_id: String(userId),
        player_name: String(playerName),
        requested_changes: reqChanges
      });

      setPendingReq(newReq);
      setShowEditModal(false);
      setEditSubmittedToast(true);
      alert("Your update request has been submitted for Admin approval!");
      fetchProfileAndPendingRequests();
      setTimeout(() => setEditSubmittedToast(false), 6000);
    } catch (err) {
      console.error("Unexpected submission error:", err);
      alert("An error occurred while submitting changes.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 font-['Calibri',sans-serif] bg-[#0b0f19] text-[#f8fafc] p-4 sm:p-6 rounded-2xl border border-[#334155] shadow-2xl" id="individual-player-dashboard-root">
      
      {/* Toast Notification */}
      {editSubmittedToast && (
        <div className="bg-amber-950/90 border-2 border-amber-500 text-amber-200 p-4 rounded-xl shadow-2xl flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-amber-400 animate-pulse shrink-0" />
            <span className="font-bold text-sm">Changes submitted for Admin Approval (Pending)</span>
          </div>
          <button onClick={() => setEditSubmittedToast(false)} className="text-amber-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Warning banner if unmatched/unlinked profile */}
      {isUnmatched && (
        <div className="bg-[#1e293b] border-2 border-[#eab308] text-white p-4 sm:p-5 rounded-2xl shadow-xl flex items-start gap-3.5 mb-2 animate-fadeIn">
          <div className="p-2.5 rounded-xl bg-[#eab308]/20 text-[#eab308] border border-[#eab308]/40 shrink-0 mt-0.5">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h4 className="font-extrabold text-sm uppercase text-[#eab308] tracking-wider flex items-center gap-2">
              <span>Roster Profile Unlinked</span>
            </h4>
            <p className="text-xs text-slate-100 leading-relaxed font-sans font-extrabold">
              ⚠️ No registered player profile linked. You are either not yet on the active team roster or your account approval is pending by an administrator.
            </p>
            <p className="text-[11px] text-[#94a3b8] font-mono">
              Showing zero-state preview metrics frame below. Please contact your Cardiff Town FC system administrator to link your player account.
            </p>
          </div>
        </div>
      )}

      {/* 1. Header Profile Header & Attributes */}
      <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-5 sm:p-6 shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        
        {/* Left Side: Avatar & Player Info */}
        <div className="flex items-center gap-4 sm:gap-5">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#0b0f19] border-2 border-[#eab308] flex items-center justify-center text-white font-black text-xl sm:text-2xl shadow-md overflow-hidden shrink-0">
            {activePlayerObj.image ? (
              <img 
                src={activePlayerObj.image} 
                alt={activePlayerObj.name} 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="text-[#eab308] font-black">
                {activePlayerObj.backNumber ? `#${activePlayerObj.backNumber}` : "CT"}
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-extrabold text-xl sm:text-2xl text-white tracking-wide">
                {activePlayerObj.name}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-[#eab308] text-[#0b0f19] text-[10px] sm:text-xs font-black uppercase tracking-wider shadow-xs">
                CARDIFF TOWN FC {isUnmatched ? "MEMBER" : "PLAYER"}
              </span>
            </div>

            <div className={`flex items-center gap-2 text-xs font-bold ${isUnmatched ? "text-amber-400" : "text-emerald-400"}`}>
              <Shield className={`h-4 w-4 shrink-0 ${isUnmatched ? "text-amber-400" : "text-emerald-400 fill-emerald-400/10"}`} />
              <span>{isUnmatched ? "Pending Admin Link / Unverified" : "Admin Approved & Locked"}</span>
            </div>
          </div>
        </div>

        {/* Right Box: Player Profile Attributes */}
        <div className="bg-[#0b0f19] border border-[#334155] rounded-xl p-4 sm:p-5 min-w-[320px] lg:max-w-lg w-full lg:w-auto">
          <div className="flex items-center justify-between border-b border-[#334155] pb-2 mb-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#94a3b8]">
              Player Profile Attributes
            </h4>
            <Lock className="h-3.5 w-3.5 text-[#eab308]" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-2">
            <div>
              <span className="text-[#94a3b8] text-[10px] uppercase font-bold tracking-wider block">Primary Position</span>
              <span className="font-extrabold text-white text-sm mt-0.5 block">{position}</span>
            </div>
            <div>
              <span className="text-[#94a3b8] text-[10px] uppercase font-bold tracking-wider block">Nationality</span>
              <span className="font-extrabold text-white text-sm mt-0.5 block">{nationality}</span>
            </div>
            <div>
              <span className="text-[#94a3b8] text-[10px] uppercase font-bold tracking-wider block">Preferred Foot</span>
              <span className="font-extrabold text-white text-sm mt-0.5 block">{preferredFoot}</span>
            </div>
            <div>
              <span className="text-[#94a3b8] text-[10px] uppercase font-bold tracking-wider block">Squad #</span>
              <span className="font-extrabold text-white text-sm mt-0.5 block">{backNumberVal !== "N/A" ? (backNumberVal.startsWith('#') ? backNumberVal : `#${backNumberVal}`) : "Unassigned"}</span>
            </div>
          </div>

          {/* Pending Admin Approval Badge */}
          {pendingReq ? (
            <div className="mt-3 p-2.5 rounded-xl bg-amber-950/80 border border-amber-500/50 text-amber-300 text-xs font-bold flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
              <span>Changes submitted for Admin Approval (Pending)</span>
            </div>
          ) : (
            <button 
              onClick={handleOpenEditModal}
              className="w-full mt-3 py-2 px-3 rounded-xl bg-[#1e293b] hover:bg-[#334155] text-xs font-bold text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5 border border-[#334155]"
            >
              <Edit3 className="h-3.5 w-3.5 text-[#eab308]" />
              <span>Request Edit</span>
            </button>
          )}
        </div>

      </div>

      {/* 2. Top KPI Summary Cards (7 Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-3.5 flex flex-col justify-between shadow-md">
          <span className="text-[10px] sm:text-[11px] font-extrabold text-[#94a3b8] uppercase tracking-wider block">Goals</span>
          <div className="text-2xl font-black text-[#eab308] mt-1">{goals}</div>
        </div>
        <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-3.5 flex flex-col justify-between shadow-md">
          <span className="text-[10px] sm:text-[11px] font-extrabold text-[#94a3b8] uppercase tracking-wider block">Shot</span>
          <div className="text-2xl font-black text-white mt-1">{shots}</div>
        </div>
        <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-3.5 flex flex-col justify-between shadow-md">
          <span className="text-[10px] sm:text-[11px] font-extrabold text-[#94a3b8] uppercase tracking-wider block">SOT</span>
          <div className="text-2xl font-black text-[#06b6d4] mt-1">{shotsOnTarget}</div>
        </div>
        <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-3.5 flex flex-col justify-between shadow-md">
          <span className="text-[10px] sm:text-[11px] font-extrabold text-[#94a3b8] uppercase tracking-wider block">Shot Accuracy</span>
          <div className="text-2xl font-black text-[#06b6d4] mt-1">{safeDivStr(shotsOnTarget, shots)}</div>
        </div>
        <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-3.5 flex flex-col justify-between shadow-md">
          <span className="text-[10px] sm:text-[11px] font-extrabold text-[#94a3b8] uppercase tracking-wider block">Pass Accuracy</span>
          <div className="text-2xl font-black text-[#eab308] mt-1">{safeDivStr(successfulPasses, passes)}</div>
        </div>
        <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-3.5 flex flex-col justify-between shadow-md">
          <span className="text-[10px] sm:text-[11px] font-extrabold text-[#94a3b8] uppercase tracking-wider block">Duel Won %</span>
          <div className="text-2xl font-black text-[#10b981] mt-1">{safeDivStr(duelsWon, duels)}</div>
        </div>
        <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-3.5 flex flex-col justify-between shadow-md">
          <span className="text-[10px] sm:text-[11px] font-extrabold text-[#94a3b8] uppercase tracking-wider block">Tackle Won %</span>
          <div className="text-2xl font-black text-[#3b82f6] mt-1">{safeDivStr(tacklesWon, tackles)}</div>
        </div>
      </div>

      {/* 3. Performance Trend Graph (Recent Matches) */}
      <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-5 sm:p-6 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-[#334155] pb-3">
          <div className="flex items-center gap-2.5">
            <BarChart2 className="h-5 w-5 text-[#eab308]" />
            <h3 className="font-extrabold text-lg text-white tracking-wide">
              Performance Trend Graph (Recent Matches)
            </h3>
          </div>
          <span className="text-[10px] bg-[#eab308]/15 text-[#eab308] border border-[#eab308]/30 px-2.5 py-1 rounded-full font-mono font-bold uppercase">
            Max 10 Recent Matches
          </span>
        </div>

        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData.slice(-10)} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.6} />
              <XAxis 
                dataKey="matchName" 
                stroke="#94a3b8" 
                tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: "bold" }} 
              />
              <YAxis 
                domain={[0, 100]} 
                stroke="#94a3b8" 
                tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: "bold" }} 
                unit="%"
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "#0b0f19", 
                  borderColor: "#334155", 
                  borderRadius: "12px", 
                  color: "#ffffff",
                  fontSize: "12px",
                  fontWeight: "bold"
                }} 
              />
              <Legend 
                wrapperStyle={{ paddingTop: "12px", fontSize: "11px", fontWeight: "bold" }}
              />
              <Line 
                type="monotone" 
                dataKey="goalConv" 
                name="Goal Conversion %" 
                stroke="#eab308" 
                strokeWidth={2.5} 
                dot={{ fill: "#eab308", r: 4 }} 
              />
              <Line 
                type="monotone" 
                dataKey="passAcc" 
                name="Pass Accuracy %" 
                stroke="#06b6d4" 
                strokeWidth={2.5} 
                dot={{ fill: "#06b6d4", r: 4 }} 
              />
              <Line 
                type="monotone" 
                dataKey="shotAcc" 
                name="Shot Accuracy %" 
                stroke="#3b82f6" 
                strokeWidth={2.5} 
                dot={{ fill: "#3b82f6", r: 4 }} 
              />
              <Line 
                type="monotone" 
                dataKey="duelWon" 
                name="Duel Won %" 
                stroke="#10b981" 
                strokeWidth={2.5} 
                dot={{ fill: "#10b981", r: 4 }} 
              />
              <Line 
                type="monotone" 
                dataKey="tackleWon" 
                name="Tackle Won %" 
                stroke="#a855f7" 
                strokeWidth={2.5} 
                dot={{ fill: "#a855f7", r: 4 }} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. Detailed Performance Metrics (Match Hub List Style) */}
      <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-5 sm:p-6 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#334155] pb-3 gap-3">
          <div className="flex items-center gap-2.5">
            <List className="h-5 w-5 text-[#10b981]" />
            <h3 className="font-extrabold text-lg text-white tracking-wide">
              Detailed Performance Metrics
            </h3>
          </div>
          
          <div className="flex items-center gap-2">
            <select
              value={selectedMatchFilter}
              onChange={(e) => setSelectedMatchFilter(e.target.value)}
              className="bg-[#0b0f19] border border-[#334155] text-[#94a3b8] text-xs font-mono font-bold rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#eab308] cursor-pointer"
            >
              <option value="all">All Matches (Aggregated)</option>
              {trendData.map((m, idx) => (
                <option key={idx} value={String(idx)}>
                  Match #{idx + 1}: vs {m.matchName} ({m.date})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Stat Grid Card System */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {selectedMetricsList.map((item, idx) => (
            <div 
              key={idx} 
              className="bg-[#0B0F19] border border-slate-800 p-4 rounded-xl flex flex-col justify-between shadow-md hover:border-slate-700 transition-colors min-h-[92px]"
            >
              <span className="text-slate-400 text-xs font-medium uppercase tracking-wider block">
                {item.label}
              </span>
              <div className="text-yellow-400 text-2xl font-bold font-mono mt-2">
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Profile Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1e293b] border border-[#334155] rounded-2xl max-w-md w-full p-6 shadow-2xl animate-scaleIn space-y-5">
            <div className="flex items-center justify-between border-b border-[#334155] pb-3">
              <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-[#eab308]" />
                Edit Profile Attributes
              </h3>
              <button 
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#334155]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                  Primary Position
                </label>
                <select
                  value={editForm.position}
                  onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
                  className="w-full bg-[#0b0f19] border border-[#334155] text-white rounded-xl p-2.5 text-sm font-medium focus:border-[#eab308] focus:outline-none cursor-pointer"
                >
                  {["GK", "CB", "LB", "RB", "DM", "CM", "AM", "LW", "RW", "ST", "CF"].map(pos => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                  Nationality
                </label>
                <input
                  type="text"
                  value={editForm.nationality}
                  onChange={(e) => setEditForm({ ...editForm, nationality: e.target.value })}
                  placeholder="e.g. South Korea, Wales, England"
                  className="w-full bg-[#0b0f19] border border-[#334155] text-white rounded-xl p-2.5 text-sm font-medium focus:border-[#eab308] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                  Preferred Foot
                </label>
                <select
                  value={editForm.preferredFoot}
                  onChange={(e) => setEditForm({ ...editForm, preferredFoot: e.target.value })}
                  className="w-full bg-[#0b0f19] border border-[#334155] text-white rounded-xl p-2.5 text-sm font-medium focus:border-[#eab308] focus:outline-none cursor-pointer"
                >
                  <option value="Right">Right</option>
                  <option value="Left">Left</option>
                  <option value="Both">Both</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                  Squad Number
                </label>
                <input
                  type="text"
                  value={editForm.squadNumber}
                  onChange={(e) => setEditForm({ ...editForm, squadNumber: e.target.value })}
                  placeholder="e.g. 7, 10, 23"
                  className="w-full bg-[#0b0f19] border border-[#334155] text-white rounded-xl p-2.5 text-sm font-medium focus:border-[#eab308] focus:outline-none"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#0b0f19] hover:bg-slate-800 text-slate-300 border border-[#334155]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#eab308] hover:bg-yellow-400 text-slate-950 flex items-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>{isSubmitting ? "Submitting..." : "Submit for Admin Approval"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

