import * as XLSX from "xlsx";
import { MatchData, Player, CustomTeam } from "../types";
import { supabase } from "./supabase";
import { DataService } from "./dataService";

export const parseAndUploadExcel = async (
  file: File,
  tableName: 'teams' | 'match_logs' | 'players'
): Promise<{ count: number; data: any[]; errors?: string[] }> => {
  if (!file) {
    throw new Error("No file provided for Excel parsing.");
  }

  // 1. Convert File to ArrayBuffer
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error("Excel file is empty or missing valid sheets.");
  }

  // Search for sheet named "Teams" or fallback to first sheet
  const firstSheetName = workbook.SheetNames.find(s => s.toLowerCase().trim() === "teams") || workbook.SheetNames[0];
  const firstSheet = workbook.Sheets[firstSheetName];
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

  if (!rawRows || rawRows.length === 0) {
    throw new Error("Excel file is empty or missing valid rows.");
  }

  // Flexible Header Extraction & Coercion Helpers
  const extractString = (row: Record<string, any>, aliases: string[]): string => {
    const normAliases = aliases.map(a => a.toLowerCase().replace(/[^a-z0-9]/g, ""));
    for (const [key, val] of Object.entries(row)) {
      const normKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (normAliases.includes(normKey)) {
        const strVal = String(val !== undefined && val !== null ? val : "").trim();
        if (strVal !== "") return strVal;
      }
    }
    return "";
  };

  const extractInt = (row: Record<string, any>, aliases: string[], defaultVal = 0): number => {
    const strVal = extractString(row, aliases);
    if (!strVal) return defaultVal;
    const cleaned = strVal.replace(/[^0-9.-]/g, "");
    const parsed = parseInt(cleaned, 10);
    return isNaN(parsed) ? defaultVal : parsed;
  };

  let sanitizedPayload: any[] = [];

  if (tableName === 'teams') {
    sanitizedPayload = rawRows.map(row => {
      const teamName = extractString(row, [
        'Team Name (Mandatory)', 'Team Name', 'team_name', 'Team', '팀명', '팀 이름', 'Club Name', 'Name'
      ]);
      const teamIdRaw = extractString(row, [
        'Team ID (Optional)', 'Team ID', 'team_id', 'ID', 'Team Code'
      ]);
      const shortName = extractString(row, [
        'Short Name (Optional)', 'Short Name', 'short_name', 'Short Name / Code', 'Code', 'Abbr', 'Abbreviation', 'team_code', 'short_code'
      ]);
      const division = extractString(row, [
        'Division (Optional)', 'Division', 'division', 'League', 'Tier', '리그', '디비전'
      ]);
      const homeVenue = extractString(row, [
        'Home Venue (Optional)', 'Home Venue', 'home_venue', 'Venue', 'Stadium', 'Ground', '장소'
      ]);

      const generatedUuid = crypto.randomUUID();
      let finalId = teamIdRaw;
      let finalShortName = shortName;

      if (!finalId) {
        finalId = generatedUuid;
      } else if (!finalShortName && finalId.length <= 8 && !finalId.includes('-')) {
        finalShortName = finalId;
        finalId = generatedUuid;
      }

      return {
        id: finalId,
        team_id: finalId,
        team_name: teamName,
        division: division || 'Premier Division',
        home_venue: homeVenue,
        short_name: finalShortName,
        created_at: new Date().toISOString()
      };
    }).filter(row => row.team_name !== '');

    if (sanitizedPayload.length === 0) {
      throw new Error("No valid team rows with non-empty 'Team Name' were found in file.");
    }

    // 3. Upsert to Supabase targeting team_name
    const { error } = await (supabase.from('teams') as any)
      .upsert(sanitizedPayload, { onConflict: 'team_name' });

    if (error) {
      console.error("Supabase Upsert Error:", error.message);
      const { error: fallbackError } = await (supabase.from('teams') as any).upsert(sanitizedPayload);
      if (fallbackError) {
        throw new Error(`Database import failed: ${fallbackError.message}`);
      }
    }

    // Mirror to DataService / teams
    await DataService.registerBulkTeams(sanitizedPayload);

    return { count: sanitizedPayload.length, data: sanitizedPayload };
  } else if (tableName === 'match_logs') {
    // 1. Fetch profiles for automatic player_id mapping
    const { data: profiles } = await (supabase.from('profiles') as any).select('player_id, full_name, username, id, user_id');
    const profileMap = new Map<string, string>();
    if (profiles && Array.isArray(profiles)) {
      profiles.forEach((p: any) => {
        const pid = p.player_id || p.id || p.user_id;
        if (!pid) return;
        if (p.full_name) profileMap.set(p.full_name.trim().toLowerCase(), pid);
        if (p.username) profileMap.set(p.username.trim().toLowerCase(), pid);
        if (p.id) profileMap.set(p.id.trim().toLowerCase(), pid);
        if (p.user_id) profileMap.set(p.user_id.trim().toLowerCase(), pid);
      });
    }

    sanitizedPayload = rawRows.map(row => {
      const matchId = extractString(row, ['Match ID', 'match_id', 'Match', '매치ID', 'Game ID', 'ID']) || 'M01';
      const playerName = extractString(row, ['Player Name', 'Full Name', 'player_name', '선수명', 'Name', 'Player']);
      const providedPlayerId = extractString(row, ['Player ID', 'player_id', 'Shirt Number', '등번호', 'ID']);
      const resolvedPlayerId = profileMap.get(playerName.trim().toLowerCase()) || (providedPlayerId && providedPlayerId !== matchId ? providedPlayerId : null) || `PLR-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      const position = extractString(row, ['Position', 'position', 'Primary Position', '포지션']) || 'CM';

      const goals = extractInt(row, ['Goals', 'goals', '득점', '골']);
      const shots = extractInt(row, ['Shots', 'shots', '슈팅', '슛']);
      const minutesPlayed = extractInt(row, ['Minutes Played', 'minutes_played', 'Mins', '출전시간']);
      const totalPasses = extractInt(row, ['Total Passes', 'total_passes', 'Passes', '총 패스', '패스']);
      const completedPasses = extractInt(row, ['Completed Passes', 'successful_passes', 'successfulPasses', '성공한 패스'], Math.round(totalPasses * 0.75));
      const tackles = extractInt(row, ['Tackles', 'tackles', '태클']);
      const interceptions = extractInt(row, ['Interceptions', 'interceptions', '가로채기']);

      const recId = `${matchId}_${resolvedPlayerId || playerName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;

      return {
        id: recId,
        match_id: matchId,
        player_id: resolvedPlayerId,
        player_name: playerName,
        position: position,
        minutes_played: minutesPlayed,
        goals: goals,
        shots: shots,
        total_passes: totalPasses,
        completed_passes: completedPasses,
        tackles: tackles,
        interceptions: interceptions,
        created_at: new Date().toISOString()
      };
    }).filter(row => row.player_name !== '' || row.match_id !== '');

    if (sanitizedPayload.length === 0) {
      throw new Error("No valid match log entries found in file.");
    }

    try {
      const { error } = await (supabase.from('match_logs') as any)
        .upsert(sanitizedPayload, { onConflict: 'id' });
      if (error) console.warn("Supabase match_logs upsert warning:", error.message);
    } catch (e) {
      console.warn("Supabase match_logs exception:", e);
    }

    // Mirror to DataService / player_match_records
    await DataService.savePlayerMatchRecords(sanitizedPayload.map(r => ({
      id: r.id,
      matchId: r.match_id,
      playerId: r.player_id,
      playerName: r.player_name,
      position: r.position,
      minutesPlayed: r.minutes_played,
      goals: r.goals,
      shots: r.shots,
      totalPasses: r.total_passes,
      completedPasses: r.completed_passes,
      tackles: r.tackles,
      interceptions: r.interceptions
    })));

    return { count: sanitizedPayload.length, data: sanitizedPayload };
  } else if (tableName === 'players') {
    sanitizedPayload = rawRows.map(row => {
      const playerName = extractString(row, ['Full Name', 'Player Name', 'player_name', '선수명', '이름', 'Name']);
      const playerId = extractString(row, ['Player ID', 'player_id', 'Shirt Number', '등번호', 'ID']);
      const position = extractString(row, ['Primary Position', 'Position', 'position', '포지션']) || 'CM';
      const preferredFoot = extractString(row, ['Preferred Foot', 'preferred_foot', '주발']) || 'Right';
      const nationality = extractString(row, ['Nationality', 'nationality', '국적']) || 'Wales';
      const division = extractString(row, ['Division', 'division', 'League', 'Role', '디비전']) || 'CCFL First';

      const pid = playerId || `CTFC-${playerName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;

      return {
        id: pid,
        name: playerName,
        position: position,
        preferred_foot: preferredFoot,
        nationality: nationality,
        division: division,
        created_at: new Date().toISOString()
      };
    }).filter(row => row.name !== '');

    if (sanitizedPayload.length === 0) {
      throw new Error("No valid player rows found in file.");
    }

    try {
      const { error } = await (supabase.from('players') as any)
        .upsert(sanitizedPayload);
      if (error) console.warn("Supabase players upsert warning:", error.message);
    } catch (e) {
      console.warn("Supabase players exception:", e);
    }

    // Mirror to DataService / players & profiles
    await DataService.savePlayers(sanitizedPayload.map(r => DataService.migratePlayer({
      id: r.id,
      name: r.name,
      position: r.position,
      preferredFoot: r.preferred_foot,
      nationality: r.nationality,
      division: r.division
    })));

    return { count: sanitizedPayload.length, data: sanitizedPayload };
  }

  return { count: 0, data: [] };
};

// Explicit standalone parser for Match Fixtures (Matches table) - NO check for Player Name or Player ID
export const parseMatchFixturesExcel = async (file: File): Promise<{ count: number; data: any[] }> => {
  if (!file) {
    throw new Error("No file provided for Match Fixtures Excel upload.");
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error("Excel file is empty or missing valid sheets.");
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (!rawRows || rawRows.length === 0) {
    throw new Error("Excel file is empty or missing valid rows.");
  }

  const extractString = (row: Record<string, any>, aliases: string[]): string => {
    const normAliases = aliases.map(a => a.toLowerCase().replace(/[^a-z0-9]/g, ""));
    for (const [key, val] of Object.entries(row)) {
      const normKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (normAliases.includes(normKey)) {
        const strVal = String(val !== undefined && val !== null ? val : "").trim();
        if (strVal !== "") return strVal;
      }
    }
    return "";
  };

  const extractInt = (row: Record<string, any>, aliases: string[], defaultVal = 0): number => {
    const strVal = extractString(row, aliases);
    if (!strVal) return defaultVal;
    const cleaned = strVal.replace(/[^0-9.-]/g, "");
    const parsed = parseInt(cleaned, 10);
    return isNaN(parsed) ? defaultVal : parsed;
  };

  const extractFloat = (row: Record<string, any>, aliases: string[], defaultVal = 50): number => {
    const strVal = extractString(row, aliases);
    if (!strVal) return defaultVal;
    const cleaned = strVal.replace(/[^0-9.-]/g, "");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? defaultVal : parsed;
  };

  const safeDivPct = (num: number, den: number): number => {
    if (!den || den === 0) return 0;
    return Number(((num / den) * 100).toFixed(1));
  };

  const cleanMatchPayloads = rawRows.map(row => {
    const matchId = extractString(row, ['match_id', 'Match ID', 'Game ID', 'ID']) || 'MATCH_01';
    const date = extractString(row, ['date', 'Date', 'Match Date']) || new Date().toISOString().split('T')[0];
    const opponent = extractString(row, ['opponent', 'Opponent', 'Opponent Team', 'VS']) || 'Opponent Team';
    const homeAway = extractString(row, ['home_away', 'Home/Away', 'Venue', 'homeAway']) || 'Home';
    const ourScore = extractInt(row, ['our_score', 'ourScore', 'Our Score', 'Goals For', 'goals']);
    const oppScore = extractInt(row, ['opponent_score', 'opponentScore', 'Opponent Score', 'Goals Against', 'opp_goals']);
    const status = extractString(row, ['status', 'Status']) || 'completed';
    const possession = extractFloat(row, ['possession', 'Possession', 'possession_rate', 'possessionRate'], 50);
    const oppPossession = extractFloat(row, ['opp_possession', 'oppPossession', 'Opponent Possession'], 100 - possession);

    return {
      id: matchId,
      date: date,
      opponent: opponent,
      home_away: homeAway,
      our_score: ourScore,
      opponent_score: oppScore,
      status: status,
      possession: possession,
      opp_possession: oppPossession,

      // OUR TEAM RAW COUNTS
      goals: extractInt(row, ['goals', 'Goals'], ourScore),
      shots: extractInt(row, ['shots', 'total_shots', 'totalShots', 'Shots']),
      shots_on_target: extractInt(row, ['shots_on_target', 'shotsOnTarget', 'Shots On Target', 'sot']),
      passes: extractInt(row, ['passes', 'total_passes', 'totalPasses', 'Passes']),
      successful_passes: extractInt(row, ['successful_passes', 'successfulPasses', 'completed_passes', 'completedPasses']),
      backwards_passes: extractInt(row, ['backwards_passes', 'backwardsPasses', 'backward_passes']),
      forwards_passes: extractInt(row, ['forwards_passes', 'forwardsPasses', 'forward_passes']),
      long_passes: extractInt(row, ['long_passes', 'longPasses']),
      successful_long_passes: extractInt(row, ['successful_long_passes', 'successfulLongPasses']),
      key_passes: extractInt(row, ['key_passes', 'keyPasses']),
      successful_key_passes: extractInt(row, ['successful_key_passes', 'successfulKeyPasses']),
      through_balls: extractInt(row, ['through_balls', 'throughBalls']),
      successful_through_balls: extractInt(row, ['successful_through_balls', 'successfulThroughBalls']),
      crosses: extractInt(row, ['crosses', 'Crosses']),
      successful_crosses: extractInt(row, ['successful_crosses', 'successfulCrosses']),
      dribbles: extractInt(row, ['dribbles', 'Dribbles']),
      successful_dribbles: extractInt(row, ['successful_dribbles', 'successfulDribbles']),
      duels: extractInt(row, ['duels', 'Duels']),
      duels_won: extractInt(row, ['duels_won', 'duelsWon', 'Duels Won']),
      aerial_duels: extractInt(row, ['aerial_duels', 'aerialDuels']),
      aerial_duels_won: extractInt(row, ['aerial_duels_won', 'aerialDuelsWon']),
      ground_duels: extractInt(row, ['ground_duels', 'groundDuels']),
      ground_duels_won: extractInt(row, ['ground_duels_won', 'groundDuelsWon']),
      ball_recoveries: extractInt(row, ['ball_recoveries', 'ballRecoveries', 'recoveries']),
      tackles: extractInt(row, ['tackles', 'Tackles']),
      tackles_won: extractInt(row, ['tackles_won', 'tacklesWon']),
      interceptions: extractInt(row, ['interceptions', 'Interceptions']),
      clearances: extractInt(row, ['clearances', 'Clearances']),
      blocks: extractInt(row, ['blocks', 'Blocks']),
      own_goals: extractInt(row, ['own_goals', 'ownGoals']),
      turnovers: extractInt(row, ['turnovers', 'Turnovers']),
      miscontrols: extractInt(row, ['miscontrols', 'Miscontrols']),
      unsuccessful_dribbles: extractInt(row, ['unsuccessful_dribbles', 'unsuccessfulDribbles']),
      possession_lost: extractInt(row, ['possession_lost', 'possessionLost']),
      offsides: extractInt(row, ['offsides', 'Offsides']),
      fouls: extractInt(row, ['fouls', 'Fouls']),
      yellow_cards: extractInt(row, ['yellow_cards', 'yellowCards']),
      red_cards: extractInt(row, ['red_cards', 'redCards']),

      // OPPONENT RAW COUNTS (opp_ prefix)
      opp_goals: extractInt(row, ['opp_goals', 'oppGoals', 'Opponent Goals'], oppScore),
      opp_shots: extractInt(row, ['opp_shots', 'oppShots', 'Opponent Shots']),
      opp_shots_on_target: extractInt(row, ['opp_shots_on_target', 'oppShotsOnTarget', 'opp_sot']),
      opp_passes: extractInt(row, ['opp_passes', 'oppPasses', 'Opponent Passes']),
      opp_successful_passes: extractInt(row, ['opp_successful_passes', 'oppSuccessfulPasses']),
      opp_backwards_passes: extractInt(row, ['opp_backwards_passes', 'oppBackwardsPasses']),
      opp_forwards_passes: extractInt(row, ['opp_forwards_passes', 'oppForwardsPasses']),
      opp_long_passes: extractInt(row, ['opp_long_passes', 'oppLongPasses']),
      opp_successful_long_passes: extractInt(row, ['opp_successful_long_passes', 'oppSuccessfulLongPasses']),
      opp_key_passes: extractInt(row, ['opp_key_passes', 'oppKeyPasses']),
      opp_successful_key_passes: extractInt(row, ['opp_successful_key_passes', 'oppSuccessfulKeyPasses']),
      opp_through_balls: extractInt(row, ['opp_through_balls', 'oppThroughBalls']),
      opp_successful_through_balls: extractInt(row, ['opp_successful_through_balls', 'oppSuccessfulThroughBalls']),
      opp_crosses: extractInt(row, ['opp_crosses', 'oppCrosses']),
      opp_successful_crosses: extractInt(row, ['opp_successful_crosses', 'oppSuccessfulCrosses']),
      opp_dribbles: extractInt(row, ['opp_dribbles', 'oppDribbles']),
      opp_successful_dribbles: extractInt(row, ['opp_successful_dribbles', 'oppSuccessfulDribbles']),
      opp_duels: extractInt(row, ['opp_duels', 'oppDuels']),
      opp_duels_won: extractInt(row, ['opp_duels_won', 'oppDuelsWon']),
      opp_aerial_duels: extractInt(row, ['opp_aerial_duels', 'oppAerialDuels']),
      opp_aerial_duels_won: extractInt(row, ['opp_aerial_duels_won', 'oppAerialDuelsWon']),
      opp_ground_duels: extractInt(row, ['opp_ground_duels', 'oppGroundDuels']),
      opp_ground_duels_won: extractInt(row, ['opp_ground_duels_won', 'oppGroundDuelsWon']),
      opp_ball_recoveries: extractInt(row, ['opp_ball_recoveries', 'oppBallRecoveries']),
      opp_tackles: extractInt(row, ['opp_tackles', 'oppTackles']),
      opp_tackles_won: extractInt(row, ['opp_tackles_won', 'oppTacklesWon']),
      opp_interceptions: extractInt(row, ['opp_interceptions', 'oppInterceptions']),
      opp_clearances: extractInt(row, ['opp_clearances', 'oppClearances']),
      opp_blocks: extractInt(row, ['opp_blocks', 'oppBlocks']),
      opp_own_goals: extractInt(row, ['opp_own_goals', 'oppOwnGoals']),
      opp_turnovers: extractInt(row, ['opp_turnovers', 'oppTurnovers']),
      opp_miscontrols: extractInt(row, ['opp_miscontrols', 'oppMiscontrols']),
      opp_unsuccessful_dribbles: extractInt(row, ['opp_unsuccessful_dribbles', 'oppUnsuccessfulDribbles']),
      opp_possession_lost: extractInt(row, ['opp_possession_lost', 'oppPossessionLost']),
      opp_offsides: extractInt(row, ['opp_offsides', 'oppOffsides']),
      opp_fouls: extractInt(row, ['opp_fouls', 'oppFouls']),
      opp_yellow_cards: extractInt(row, ['opp_yellow_cards', 'oppYellowCards']),
      opp_red_cards: extractInt(row, ['opp_red_cards', 'oppRedCards'])
    };
  }).filter(r => r.id !== '' || r.opponent !== '');

  // Group rows by match_id and merge Our Team / Opponent Team data
  const groupedByMatch: { [matchId: string]: any[] } = {};

  cleanMatchPayloads.forEach(row => {
    const matchId = String(row.id || (row as any).match_id).trim();
    if (!matchId) return;
    if (!groupedByMatch[matchId]) groupedByMatch[matchId] = [];
    groupedByMatch[matchId].push(row);
  });

  const uniqueMatches = Object.keys(groupedByMatch).map(matchId => {
    const matchRows = groupedByMatch[matchId];
    if (matchRows.length === 1) {
      return matchRows[0];
    }

    // Row where Opponent is NOT Cardiff Town FC = OUR TEAM STATS
    const ourRow = matchRows.find(r => String(r.opponent || "").trim().toLowerCase() !== 'cardiff town fc') || matchRows[0];
    
    // Row where Opponent IS Cardiff Town FC = OPPONENT STATS
    const oppRow = matchRows.find(r => String(r.opponent || "").trim().toLowerCase() === 'cardiff town fc') || matchRows[1] || {};

    return {
      ...ourRow,
      id: matchId,
      date: ourRow.date,
      opponent: ourRow.opponent, // Enemy team name
      home_away: ourRow.home_away || 'Home',
      our_score: Number(ourRow.goals || 0),
      opponent_score: Number(oppRow.goals || 0),
      status: 'completed',

      // OUR TEAM STATS
      possession: Number(ourRow.possession || 50),
      goals: Number(ourRow.goals || 0),
      shots: Number(ourRow.shots || 0),
      shots_on_target: Number(ourRow.shots_on_target || 0),
      passes: Number(ourRow.passes || 0),
      successful_passes: Number(ourRow.successful_passes || 0),
      backwards_passes: Number(ourRow.backwards_passes || 0),
      forwards_passes: Number(ourRow.forwards_passes || 0),
      long_passes: Number(ourRow.long_passes || 0),
      successful_long_passes: Number(ourRow.successful_long_passes || 0),
      key_passes: Number(ourRow.key_passes || 0),
      successful_key_passes: Number(ourRow.successful_key_passes || 0),
      through_balls: Number(ourRow.through_balls || 0),
      successful_through_balls: Number(ourRow.successful_through_balls || 0),
      crosses: Number(ourRow.crosses || 0),
      successful_crosses: Number(ourRow.successful_crosses || 0),
      dribbles: Number(ourRow.dribbles || 0),
      successful_dribbles: Number(ourRow.successful_dribbles || 0),
      duels: Number(ourRow.duels || 0),
      duels_won: Number(ourRow.duels_won || 0),
      aerial_duels: Number(ourRow.aerial_duels || 0),
      aerial_duels_won: Number(ourRow.aerial_duels_won || 0),
      ground_duels: Number(ourRow.ground_duels || 0),
      ground_duels_won: Number(ourRow.ground_duels_won || 0),
      ball_recoveries: Number(ourRow.ball_recoveries || 0),
      tackles: Number(ourRow.tackles || 0),
      tackles_won: Number(ourRow.tackles_won || 0),
      interceptions: Number(ourRow.interceptions || 0),
      clearances: Number(ourRow.clearances || 0),
      blocks: Number(ourRow.blocks || 0),
      own_goals: Number(ourRow.own_goals || 0),
      turnovers: Number(ourRow.turnovers || 0),
      miscontrols: Number(ourRow.miscontrols || 0),
      unsuccessful_dribbles: Number(ourRow.unsuccessful_dribbles || 0),
      possession_lost: Number(ourRow.possession_lost || 0),
      offsides: Number(ourRow.offsides || 0),
      fouls: Number(ourRow.fouls || 0),
      yellow_cards: Number(ourRow.yellow_cards || 0),
      red_cards: Number(ourRow.red_cards || 0),

      // OPPONENT TEAM STATS (opp_ prefix)
      opp_possession: Number(oppRow.possession || (100 - Number(ourRow.possession || 50))),
      opp_goals: Number(oppRow.goals || 0),
      opp_shots: Number(oppRow.shots || 0),
      opp_shots_on_target: Number(oppRow.shots_on_target || 0),
      opp_passes: Number(oppRow.passes || 0),
      opp_successful_passes: Number(oppRow.successful_passes || 0),
      opp_backwards_passes: Number(oppRow.backwards_passes || 0),
      opp_forwards_passes: Number(oppRow.forwards_passes || 0),
      opp_long_passes: Number(oppRow.long_passes || 0),
      opp_successful_long_passes: Number(oppRow.successful_long_passes || 0),
      opp_key_passes: Number(oppRow.key_passes || 0),
      opp_successful_key_passes: Number(oppRow.successful_key_passes || 0),
      opp_through_balls: Number(oppRow.through_balls || 0),
      opp_successful_through_balls: Number(oppRow.successful_through_balls || 0),
      opp_crosses: Number(oppRow.crosses || 0),
      opp_successful_crosses: Number(oppRow.successful_crosses || 0),
      opp_dribbles: Number(oppRow.dribbles || 0),
      opp_successful_dribbles: Number(oppRow.successful_dribbles || 0),
      opp_duels: Number(oppRow.duels || 0),
      opp_duels_won: Number(oppRow.duels_won || 0),
      opp_aerial_duels: Number(oppRow.aerial_duels || 0),
      opp_aerial_duels_won: Number(oppRow.aerial_duels_won || 0),
      opp_ground_duels: Number(oppRow.ground_duels || 0),
      opp_ground_duels_won: Number(oppRow.ground_duels_won || 0),
      opp_ball_recoveries: Number(oppRow.ball_recoveries || 0),
      opp_tackles: Number(oppRow.tackles || 0),
      opp_tackles_won: Number(oppRow.tackles_won || 0),
      opp_interceptions: Number(oppRow.interceptions || 0),
      opp_clearances: Number(oppRow.clearances || 0),
      opp_blocks: Number(oppRow.blocks || 0),
      opp_own_goals: Number(oppRow.own_goals || 0),
      opp_turnovers: Number(oppRow.turnovers || 0),
      opp_miscontrols: Number(oppRow.miscontrols || 0),
      opp_unsuccessful_dribbles: Number(oppRow.unsuccessful_dribbles || 0),
      opp_possession_lost: Number(oppRow.possession_lost || 0),
      opp_offsides: Number(oppRow.offsides || 0),
      opp_fouls: Number(oppRow.fouls || 0),
      opp_yellow_cards: Number(oppRow.yellow_cards || 0),
      opp_red_cards: Number(oppRow.red_cards || 0)
    };
  });

  if (uniqueMatches.length === 0) {
    throw new Error("No valid match fixture entries found in file.");
  }

  // Target public.matches strictly WITHOUT fallback to match_fixtures
  const { error: matchesErr } = await (supabase.from('matches') as any)
    .upsert(uniqueMatches, { onConflict: 'id' });

  if (matchesErr) {
    console.warn("Supabase public.matches upsert error:", matchesErr.message);
  }

  // Mirror to DataService local cache
  await DataService.saveMatches(uniqueMatches.map(m => DataService.migrateMatch({
    id: m.id,
    date: m.date,
    opponent: m.opponent,
    venue: m.home_away as any,
    ourScore: m.our_score,
    oppScore: m.opponent_score,
    result: `${m.our_score > m.opponent_score ? 'W' : m.our_score < m.opponent_score ? 'L' : 'D'} (${m.our_score}-${m.opponent_score})`,
    status: m.status as any,
    totalShots: m.shots,
    shotsOnTarget: m.shots_on_target,
    corners: 0,
    isOpponentTeam: false,
    ...m
  })));

  return { count: uniqueMatches.length, data: uniqueMatches };
};

// Explicit standalone parser for Individual Player Stats (player_stats table)
export const parsePlayerStatsExcel = async (file: File, matchIdOverride?: string): Promise<{ count: number; data: any[] }> => {
  if (!file) {
    throw new Error("No file provided for Player Stats Excel upload.");
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error("Excel file is empty or missing valid sheets.");
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (!rawRows || rawRows.length === 0) {
    throw new Error("Excel file is empty or missing valid rows.");
  }

  // Flexible header extraction helpers
  const extractString = (row: Record<string, any>, aliases: string[]): string => {
    const normAliases = aliases.map(a => a.toLowerCase().replace(/[^a-z0-9]/g, ""));
    for (const [key, val] of Object.entries(row)) {
      const normKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (normAliases.includes(normKey)) {
        const strVal = String(val !== undefined && val !== null ? val : "").trim();
        if (strVal !== "") return strVal;
      }
    }
    return "";
  };

  const extractInt = (row: Record<string, any>, aliases: string[], defaultVal = 0): number => {
    const strVal = extractString(row, aliases);
    if (!strVal) return defaultVal;
    const cleaned = strVal.replace(/[^0-9.-]/g, "");
    const parsed = parseInt(cleaned, 10);
    return isNaN(parsed) ? defaultVal : parsed;
  };

  // Build schema-exact payload for public.player_stats — ONLY columns confirmed to exist in the table
  const sanitizedRows = rawRows.map(row => {
    const playerName   = extractString(row, ['player_name', 'Player Name', 'Name', 'name', 'username', 'Username', '선수명']);
    // matchIdOverride from the match-selector takes precedence over the row's own match_id
    const rowMatchId   = extractString(row, ['match_id', 'Match ID', 'Game ID', 'Match', '매치ID']) || 'M01';
    const matchId      = (matchIdOverride && matchIdOverride.trim()) ? matchIdOverride.trim() : rowMatchId;

    if (!playerName && !matchId) return null;

    const pNum = Number(extractInt(row, ['player_number', 'Number', 'Jersey', 'Shirt', '등번호'])) || 0;

    // Sanitize every field as Number to prevent type errors or schema mismatches
    // Dual player_name / name mapping — Supabase accepts whichever column exists
    const nameVal = String(playerName).trim();
    const cleanPayload = {
      // PK: selectedMatchId_playerNumber (or playerName as fallback)
      id:             `${matchId}_${pNum || nameVal.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      match_id:       matchId,
      player_name:    nameVal,           // primary column name
      name:           nameVal,           // dual fallback for schema compatibility
      player_number:  Number(extractInt(row, ['player_number', 'Number', 'Jersey', 'Shirt', '등번호'])) || 0,
      position:       String(extractString(row, ['position', 'Position', 'Pos', '포지션'])).trim(),
      minutes_played: Number(extractInt(row, ['minutes_played', 'Minutes Played', 'Minutes', 'Mins', '출전시간'])) || 0,

      // Scoring
      goals:               Number(extractInt(row, ['goals', 'Goals', '득점'])) || 0,
      assists:             Number(extractInt(row, ['assists', 'Assists', '도움'])) || 0,

      // Shooting
      shots:               Number(extractInt(row, ['shots', 'Shots', '슈팅'])) || 0,
      shots_on_target:     Number(extractInt(row, ['shots_on_target', 'Shots On Target', 'SOT', 'sot'])) || 0,

      // Passing — both column variants sent for schema compatibility
      passes:              Number(extractInt(row, ['passes', 'total_passes', 'Passes', 'Total Passes', '패스'])) || 0,
      successful_passes:   Number(extractInt(row, ['successful_passes', 'Successful Passes', 'completed_passes', 'Completed Passes'])) || 0,
      completed_passes:    Number(extractInt(row, ['completed_passes', 'Completed Passes', 'successful_passes', 'Successful Passes'])) || 0,
      key_passes:          Number(extractInt(row, ['key_passes', 'Key Passes'])) || 0,
      long_passes:         Number(extractInt(row, ['long_passes', 'Long Passes'])) || 0,
      through_balls:       Number(extractInt(row, ['through_balls', 'Through Balls'])) || 0,
      crosses:             Number(extractInt(row, ['crosses', 'Crosses'])) || 0,

      // Dribbling & duels
      dribbles:            Number(extractInt(row, ['dribbles', 'Dribbles'])) || 0,
      successful_dribbles: Number(extractInt(row, ['successful_dribbles', 'Successful Dribbles'])) || 0,
      duels:               Number(extractInt(row, ['duels', 'Duels'])) || 0,
      duels_won:           Number(extractInt(row, ['duels_won', 'Duels Won'])) || 0,

      // Defence
      tackles:             Number(extractInt(row, ['tackles', 'Tackles'])) || 0,
      tackles_won:         Number(extractInt(row, ['tackles_won', 'Tackles Won'])) || 0,
      interceptions:       Number(extractInt(row, ['interceptions', 'Interceptions'])) || 0,
      clearances:          Number(extractInt(row, ['clearances', 'Clearances'])) || 0,
      blocks:              Number(extractInt(row, ['blocks', 'Blocks'])) || 0,
      ball_recoveries:     Number(extractInt(row, ['ball_recoveries', 'Ball Recoveries', 'recoveries'])) || 0,

      // Discipline
      turnovers:           Number(extractInt(row, ['turnovers', 'Turnovers'])) || 0,
      fouls:               Number(extractInt(row, ['fouls', 'Fouls'])) || 0,
      yellow_cards:        Number(extractInt(row, ['yellow_cards', 'Yellow Cards'])) || 0,
      red_cards:           Number(extractInt(row, ['red_cards', 'Red Cards'])) || 0,

      created_at: new Date().toISOString()
    };

    return cleanPayload;
  }).filter(Boolean) as any[];


  if (sanitizedRows.length === 0) {
    throw new Error("Excel file contains no valid rows.");
  }

  // Pre-upsert diagnostic log — shows exactly what's being sent to Supabase
  console.log(`Sending payload to player_stats (Count: ${sanitizedRows.length}):`, sanitizedRows);

  // Strict single-target upsert — public.player_stats ONLY, NO fallbacks
  // .select() is required to get back the persisted rows (without it Supabase returns null)
  const { data: upsertData, error: statsErr } = await (supabase.from('player_stats') as any)
    .upsert(sanitizedRows, { onConflict: 'id' })
    .select();

  if (statsErr) {
    console.error("Supabase Player Stats Upsert ERROR:", statsErr);
    throw new Error(
      `DB Save Failed: ${statsErr.message}` +
      (statsErr.details ? ` | Details: ${statsErr.details}` : '') +
      (statsErr.hint    ? ` | Hint: ${statsErr.hint}`    : '')
    );
  }

  if (!upsertData || upsertData.length === 0) {
    console.warn("Upsert returned empty data array — likely an RLS policy is blocking inserts.", { sanitizedRows });
    throw new Error(
      "Failed to insert rows into public.player_stats. " +
      "Upsert returned 0 rows — please check Row Level Security (RLS) policies and column permissions."
    );
  }

  console.log(`SUCCESSFULLY SAVED ${upsertData.length} ROWS TO DB:`, upsertData);

  // Mirror to DataService local cache (camelCase interface)
  await DataService.savePlayerMatchRecords(sanitizedRows.map(r => ({
    id:              r.id,
    matchId:         r.match_id,
    playerName:      r.player_name,
    goals:           r.goals,
    shots:           r.shots,
    shotsOnTarget:   r.shots_on_target,
    totalPasses:     r.passes,
    completedPasses: r.successful_passes,
    tackles:         r.tackles,
    interceptions:   r.interceptions,
    ...r
  })));

  return { count: upsertData.length, data: upsertData };
};

export const handlePlayerExcelUpload = async (file: File) => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

  if (!rawRows || rawRows.length === 0) {
    throw new Error("Excel file is empty.");
  }

  // 1. Sanitize payload array
  const sanitizedPlayers = rawRows.map(row => ({
    name: String(row['Player Name'] || row['Name'] || row['name'] || row['선수명'] || '').trim(),
    team_name: String(row['Team'] || row['team_name'] || row['팀명'] || '').trim(),
    position: String(row['Position'] || row['position'] || row['포지션'] || 'MF').trim(),
    jersey_number: parseInt(row['Number'] || row['jersey_number'] || row['등번호'] || '0', 10),
    preferred_foot: String(row['Preferred Foot'] || row['foot'] || 'Right').trim()
  })).filter(p => p.name.length > 0);

  if (sanitizedPlayers.length === 0) {
    throw new Error("No valid player rows found.");
  }

  // 2. Perform SINGLE BULK UPSERT to 'players' table
  const { data, error } = await (supabase.from('players') as any)
    .upsert(sanitizedPlayers);

  if (error) {
    console.error("Bulk Player Upsert Error:", error);
    throw error;
  }

  // 3. Also sync to 'profiles' table for roster compatibility
  const sanitizedProfiles = sanitizedPlayers.map(p => {
    const username = p.name.toLowerCase().replace(/\s+/g, '_');
    const playerId = `PLR-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    return {
      full_name: p.name,
      username: username,
      player_id: playerId,
      role: 'Player',
      position: p.position
    };
  });

  await (supabase.from('profiles') as any).upsert(sanitizedProfiles, { onConflict: 'username' });

  return sanitizedPlayers.length;
};

export const handleMatchLogUpload = async (file: File): Promise<number> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

  // Fetch all profiles for mapping
  const { data: profiles } = await (supabase.from('profiles') as any).select('player_id, full_name, username, id, user_id');
  
  const profileMap = new Map<string, string>();
  if (profiles && Array.isArray(profiles)) {
    profiles.forEach((p: any) => {
      const pid = p.player_id || p.id || p.user_id;
      if (!pid) return;
      if (p.full_name) profileMap.set(p.full_name.trim().toLowerCase(), pid);
      if (p.username) profileMap.set(p.username.trim().toLowerCase(), pid);
      if (p.id) profileMap.set(p.id.trim().toLowerCase(), pid);
    });
  }

  const matchLogsToInsert = rawRows.map(row => {
    const playerName = String(row['Player Name'] || row['Player'] || row['player_name'] || row['선수명'] || row['Name'] || '').trim();
    const matchId = String(row['Match ID'] || row['match_id'] || row['Game ID'] || 'M01').trim();
    const providedId = String(row['Player ID'] || row['player_id'] || '').trim();
    const resolvedPlayerId = profileMap.get(playerName.toLowerCase()) || (providedId && providedId !== matchId ? providedId : null) || `PLR-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    const goals = parseInt(row['Goals'] || row['goals'] || row['득점'] || '0', 10) || 0;
    const assists = parseInt(row['Assists'] || row['assists'] || row['도움'] || '0', 10) || 0;
    const passes = parseInt(row['Passes'] || row['total_passes'] || row['totalPasses'] || '0', 10) || 0;
    const tackles = parseInt(row['Tackles'] || row['tackles'] || '0', 10) || 0;
    const teamName = String(row['Team'] || row['team_name'] || row['Team Name'] || '').trim();

    const recId = `${matchId}_${resolvedPlayerId || playerName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    return {
      id: recId,
      match_id: matchId,
      player_name: playerName,
      player_id: resolvedPlayerId, // Automatically mapped ID
      goals: goals,
      assists: assists,
      passes: passes,
      total_passes: passes,
      tackles: tackles,
      team_name: teamName,
      created_at: new Date().toISOString()
    };
  }).filter(log => log.player_name.length > 0);

  // Single Bulk Upsert
  const { error } = await (supabase.from('match_logs') as any).upsert(matchLogsToInsert);
  if (error) throw error;

  await DataService.savePlayerMatchRecords(matchLogsToInsert.map((r: any) => ({
    id: r.id,
    matchId: r.match_id,
    playerId: r.player_id,
    playerName: r.player_name,
    goals: r.goals,
    assists: r.assists,
    totalPasses: r.passes || r.total_passes,
    tackles: r.tackles
  })));

  return matchLogsToInsert.length;
};

export const handleRosterUpload = async (file: File): Promise<number> => {
  return handlePlayerExcelUpload(file);
};

export const selfSimulateExcelUpload = async (): Promise<{ success: boolean; details: string }> => {
  try {
    const sampleTeams = [
      { "Team Name (Mandatory)": "Cardiff Town FC", "Short Name (Optional)": "CTFC", "Division (Optional)": "Premier Division", "Home Venue (Optional)": "Cardiff Sports Village" },
      { "Team Name (Mandatory)": "AFC Roath", "Short Name (Optional)": "AFCR", "Division (Optional)": "Division 1", "Home Venue (Optional)": "Roath Park" }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleTeams);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Teams");
    const outBuf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const testFile = new File([outBuf], "test_teams.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

    const res = await parseAndUploadExcel(testFile, "teams");
    if (res.count === 2 && res.data[0].team_name === "Cardiff Town FC") {
      return { success: true, details: "Self-test passed: Client binary XLSX parsed into 2 sanitized team rows with auto-assigned Team IDs, mapped to exact Supabase keys and upserted successfully." };
    } else {
      return { success: false, details: `Self-test failed: Unexpected result count ${res.count}` };
    }
  } catch (err: any) {
    return { success: false, details: `Self-test failed with exception: ${err?.message || String(err)}` };
  }
};

export interface ParsedTeamRegistrationRow {
  id: string;
  team_id: string;
  team_name: string;
  division: string;
  home_venue?: string;
  short_code?: string;
  created_at?: string;
}

export interface TeamRegistrationParseResult {
  validRecords: ParsedTeamRegistrationRow[];
  totalRows: number;
  errorRows: number;
  errorDetails: string[];
}

// Standard professional football analytics English terminology
export const MATCH_HEADERS_MAP = {
  "Match Date": "date",
  "Competition": "competition",
  "Team Name": "teamName", // Single sheet column to divide our team and opponent team!
  "Opponent": "opponent",
  "Venue": "venue",
  "Result": "result",
  
  // Passes PIs
  "Backward Passes": "backwardPasses",
  "Forward Passes": "forwardPasses",
  "Sideways Passes": "sidewaysPasses",
  "Crosses": "crosses",
  "Through Balls": "throughBalls",
  "Key Passes": "keyPasses",
  
  // Dribble PIs
  "1v1 Dribble Success": "dribbleSuccess",
  "1v1 Dribble Fail": "dribbleFail",
  
  // Shot PIs
  "Shots on Target": "shotOnTarget",
  "Shots off Target": "shotOffTarget",
  "Blocked Shots": "shotBlocked",
  "Goals": "goals",
  
  // Progression PIs
  "Final Third Entry": "finalThirdEntry",
  "Penalty Area Entry": "penaltyAreaEntry",
  
  // Duel PIs
  "Aerial Duel Win": "aerialDuelWin",
  "Aerial Duel Loss": "aerialDuelLoss",
  "Ground Duel Win": "groundDuelWin",
  "Ground Duel Loss": "groundDuelLoss",
  
  // Defensive PIs
  "Tackles": "tackle",
  "Interceptions": "interception",
  "Clearances": "clearance",
  "Blocked Shot Defending": "blockedShot",
  "Fouls Committed": "foul",
  "Fouls Suffered": "wasFouled",
  "Dribbled Past": "dribbledPast",
  
  // Recovery PIs
  "Ball Recovery": "ballRecovery",
  
  // Pressing PIs
  "High Press Success": "highPressSuccess",
  "Pressing Bypassed": "pressingBypassed",
  
  // Turnover PIs
  "Miscontrols": "miscontrol",
  "Dispossessions": "dispossessed",
  "Failed Passes": "failedPass",
  "Unsuccessful Dribbles": "unsuccessfulDribble",
  "Offsides": "offside",
  "Possession Lost": "possessionLost",
  
  // GK Distribution PIs
  "GK Long Kick": "longKick",
  "GK Short Pass": "shotPass",
  "GK Goal Kick": "goalKick",
  
  // GK Save PIs
  "GK Catch": "gkCatch",
  "GK Parried Safe": "parriedSafe",
  "GK Parried Danger": "parriedDanger",
  
  // GK Positioning PIs
  "GK Sweeper Action": "sweeperAction",
  "GK 1v1 Save": "gk1v1Save",
  
  // GK Claim PIs
  "GK High Claim": "highClaim",
  "GK Punch": "gkPunch",
  "GK Flapped": "gkFlapped",
  
  // Set Piece PIs
  "Corner Defending": "cornerD",
  "Free Kick Defending": "freeKickD",
  "Corner Attacking": "cornerA",
  "Free Kick Attacking": "freeKickA"
};

export const PLAYER_HEADERS_MAP = {
  // Player Identifiers
  "Full Name": "name",
  "Player Name": "name",
  "Player ID": "backNumber",
  "Primary Position": "position",
  "Position": "position",
  "Preferred Foot": "preferredFoot",
  "Nationality": "nationality",
  "Date of Birth": "dob",
  "Shirt Number": "backNumber",
  "Join Date": "joinDate",
  "Minutes Played": "minutesPlayed",

  // Shots Category
  "Goals": "goals",
  "Shots": "shots",
  "Shot Accuracy": "shotAccuracy",
  "Shots Inside Box": "insideBoxShots",
  "Shots Outside Box": "shotsOutsideBox",
  "Headed Shots": "headedShots",
  "Blocked Shots": "blockedShots",

  // Passes Category
  "Total Passes": "totalPasses",
  "Completed Passes": "successfulPasses",
  "Long Passes": "longPasses",
  "Completed Long Passes": "completedLongPasses",
  "Passes Opponent Half": "passesInOpponentsHalf",
  "Completed Opponent Half": "completedOpponentHalf",
  "Passes Final Third": "finalThirdPasses",
  "Completed Final Third": "completedFinalThirdPasses",
  "Forward Passes": "progressivePasses",
  "Through Balls": "throughBalls",
  "Crosses": "crossesAttempted",
  "Completed Crosses": "successfulCrosses",

  // Duels & Distribution
  "Possession (%)": "possession",
  "Possession": "possession",
  "Duels": "duels",
  "Duels Won": "duelsWon",
  "Aerial Duels": "aerialDuels",
  "Aerial Duels Won": "aerialDuelsWon",
  "Ground Duels": "groundDuels",
  "Ground Duels Won": "groundDuelsWon",
  "Final Third Entries": "finalThirdEntries",
  "Box Entries": "boxEntries",

  // Defense & Discipline
  "Tackles": "tacklesAttempted",
  "Tackles Won": "tacklesWon",
  "Clearances": "clearances",
  "Interceptions": "interceptions",
  "Blocks": "blocks",
  "Recovery Rate": "ballRecoveries",
  "Corners": "corners",
  "Fouls": "fouls",
  "Was Fouled": "wasFouled",
  "Yellow Cards": "yellowCards",
  "Red Cards": "redCard",

  // Legacy mappings for backward compatibility
  "Assists": "assists",
  "Chances Created": "chancesCreated",
  "Touches": "touches",
  "Progressive Carries": "progressiveCarries",
  "Progressive Dribbles": "progressiveDribbles",
  "Defensive Duels": "defensiveDuels",
  "Defensive Duels Won": "defensiveDuelsWon",
  "Dribbles Attempted": "dribblesAttempted",
  "Successful Dribbles": "successfulDribbles",
  "Save Attempts": "saveAttempts",
  "Saves": "saves",
  "Cross Claims": "crossClaims",
  "Sweeper Actions": "sweeperActions",
  "Clean Sheets": "cleanSheets"
};

// Map of standard English headers to their English/Korean aliases
export const HEADER_ALIASES: Record<string, string[]> = {
  "Full Name": ["full name", "fullname", "player name", "선수명", "선수 이름", "이름", "성명", "name", "player"],
  "Player Name": ["player name", "full name", "fullname", "선수명", "선수 이름", "이름", "성명", "name", "player"],
  "Player ID": ["player id", "playerid", "선수 id", "선수id", "id", "shirt number", "back number", "등번호", "no", "jersey number"],
  "Primary Position": ["primary position", "position", "포지션", "역할", "위치", "pos"],
  "Position": ["position", "primary position", "포지션", "역할", "위치", "pos"],
  "Preferred Foot": ["preferred foot", "주발", "주로 쓰는 발", "preferredfoot", "주로쓰는발"],
  "Nationality": ["nationality", "국적", "나라", "국가"],
  "Date of Birth": ["date of birth", "생년월일", "생일", "dob", "birth date", "birthdate"],
  "Shirt Number": ["shirt number", "등번호", "배번호", "back number", "jersey number", "번호", "no", "no."],
  "Join Date": ["join date", "가입일", "입단일", "등록일", "join", "joindate"],
  "Minutes Played": ["minutes played", "출전 시간", "출전시간", "분", "mins", "minutes"],

  "Match Date": ["match date", "경기일자", "경기 일자", "날짜", "date", "matchdate"],
  "Competition": ["competition", "대회", "리그", "구분", "comp"],
  "Team Name": ["team name", "팀명", "팀 이름", "팀", "team"],
  "Opponent": ["opponent", "상대", "상대팀", "상대 팀", "opp"],
  "Venue": ["venue", "장소", "홈어웨이", "홈/어웨이"],
  "Result": ["result", "결과", "경기결과", "경기 결과"],

  "Goals": ["goals", "득점", "골", "득점 수"],
  "Shots": ["shots", "슈팅", "슛"],
  "Shot Accuracy": ["shot accuracy", "shot accuracy total", "shots on target %", "유효 슈팅률", "유효슛 비율", "shots on target", "유효 슈팅"],
  "Shots Inside Box": ["shots inside box", "shots inside the box", "box shots", "박스 안 슈팅"],
  "Shots Outside Box": ["shots outside box", "shots outside the box", "long shots", "박스 밖 슈팅"],
  "Headed Shots": ["headed shots", "headers", "헤더 슈팅", "헤딩 슛"],
  "Blocked Shots": ["blocked shots", "차단된 슈팅"],

  "Total Passes": ["total passes", "passes", "총 패스", "패스", "패스 시도", "패스 수"],
  "Completed Passes": ["completed passes", "successful passes", "성공한 패스", "패스 성공"],
  "Long Passes": ["long passes", "롱 패스"],
  "Completed Long Passes": ["completed long passes", "successful long passes", "성공한 롱 패스"],
  "Passes Opponent Half": ["passes opponent half", "passes in opponents half", "상대 진영 패스"],
  "Completed Opponent Half": ["completed opponent half", "successful passes in opponents half", "상대 진영 패스 성공"],
  "Passes Final Third": ["passes final third", "passes in final third", "final third passes", "파이널 서드 패스"],
  "Completed Final Third": ["completed final third", "successful final third passes", "파이널 서드 패스 성공"],
  "Forward Passes": ["forward passes", "progressive passes", "전진 패스"],
  "Through Balls": ["through balls", "스루 패스", "침투 패스"],
  "Crosses": ["crosses", "crosses attempted", "크로스", "크로스 시도"],
  "Completed Crosses": ["completed crosses", "successful crosses", "크로스 성공"],

  "Possession (%)": ["possession (%)", "possession", "점유율"],
  "Duels": ["duels", "경합"],
  "Duels Won": ["duels won", "경합 성공"],
  "Aerial Duels": ["aerial duels", "공중 경합", "공중볼 경합"],
  "Aerial Duels Won": ["aerial duels won", "공중 경합 성공"],
  "Ground Duels": ["ground duels", "지상 경합"],
  "Ground Duels Won": ["ground duels won", "지상 경합 성공"],
  "Final Third Entries": ["final third entries", "파이널 서드 진입"],
  "Box Entries": ["box entries", "penalty area entries", "박스 진입", "페널티 에어리어 진입"],

  "Tackles": ["tackles", "tackles attempted", "태클 시도", "태클"],
  "Tackles Won": ["tackles won", "태클 성공"],
  "Clearances": ["clearances", "clearance", "걷어내기", "클리어링"],
  "Interceptions": ["interceptions", "가로채기", "인터셉트"],
  "Blocks": ["blocks", "차단"],
  "Recovery Rate": ["recovery rate", "recoveries", "ball recoveries", "볼 리커버리", "볼 회복", "리커버리"],
  "Corners": ["corners", "corner", "코너킥"],
  "Fouls": ["fouls", "foul committed", "파울", "파울 범함"],
  "Was Fouled": ["was fouled", "fouls won", "파울 당함", "피파울"],
  "Yellow Cards": ["yellow cards", "yellow card", "경고", "옐로카드"],
  "Red Cards": ["red cards", "red card", "퇴장", "레드카드"]
};

// Map of match player record identifiers to their aliases
export const MATCH_IDENTIFIER_ALIASES: Record<string, string[]> = {
  "Match ID": ["match id", "매치 id", "경기 id", "매치id", "경기id", "match", "game id"],
  "Team ID": ["team id", "팀 id", "팀id", "team"],
  "Player ID": ["player id", "playerid", "선수 id", "선수id", "id", "shirt number", "back number", "등번호"],
  "Player Name": ["player name", "full name", "fullname", "선수명", "선수 이름", "이름", "성명", "name", "player"],
  "Full Name": ["full name", "player name", "fullname", "선수명", "선수 이름", "이름", "성명", "name", "player"],
  "Shirt Number": ["shirt number", "등번호", "배번호", "back number", "jersey number", "번호", "no", "no."],
  "Position": ["position", "primary position", "포지션", "역할", "위치", "pos"],
  "Primary Position": ["primary position", "position", "포지션", "역할", "위치", "pos"]
};

export interface ExcelParseResult<T> {
  validRecords: T[];
  totalRows: number;
  errorRows: number;
  errorDetails: string[];
}

export class ExcelUtils {
  // Helper to dynamically scan all sheet names and find the best matching sheet
  static findOptimalSheet(workbook: any, headerKey: string, useMatchAliases: boolean = false): string {
    const aliases = useMatchAliases 
      ? (MATCH_IDENTIFIER_ALIASES[headerKey] || [headerKey])
      : (HEADER_ALIASES[headerKey] || [headerKey]);
    const normalizedAliases = aliases.map(a => a.toLowerCase().trim());

    if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
      return "";
    }

    // Try to find sheet where at least one header cell matches aliases
    for (const name of workbook.SheetNames) {
      const sheet = workbook.Sheets[name];
      if (!sheet || !sheet['!ref']) continue;
      try {
        const XLSXLib = (window as any).XLSX || XLSX;
        const range = XLSXLib.utils.decode_range(sheet['!ref']);
        const scanRows = Math.min(range.s.r + 10, range.e.r);
        for (let row = range.s.r; row <= scanRows; row++) {
          for (let col = range.s.c; col <= range.e.c; col++) {
            const cellAddress = XLSXLib.utils.encode_cell({ r: row, c: col });
            const cell = sheet[cellAddress];
            if (cell && cell.v !== undefined && cell.v !== null) {
              const val = String(cell.v).trim().toLowerCase();
              if (normalizedAliases.some(alias => alias === val)) {
                return name;
              }
            }
          }
        }
      } catch (err) {
        console.warn(`Error scanning sheet ${name} for optimal layout:`, err);
      }
    }
    return workbook.SheetNames[0];
  }

  // Helper to find the actual header row index in a sheet to support arbitrary title blocks and empty lines
  static findHeaderRowIndex(sheet: any, headerKey: string, useMatchAliases: boolean = false): number {
    if (!sheet || !sheet['!ref']) return 0;
    try {
      const XLSXLib = (window as any).XLSX || XLSX;
      const range = XLSXLib.utils.decode_range(sheet['!ref']);
      const aliases = useMatchAliases 
        ? (MATCH_IDENTIFIER_ALIASES[headerKey] || [headerKey])
        : (HEADER_ALIASES[headerKey] || [headerKey]);
      const normalizedAliases = aliases.map(a => a.toLowerCase().trim());

      let bestRow = range.s.r;
      let maxMatches = 0;

      const scanRows = Math.min(range.s.r + 15, range.e.r);
      for (let row = range.s.r; row <= scanRows; row++) {
        let matchesInRow = 0;
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          const cell = sheet[cellAddress];
          if (cell && cell.v !== undefined && cell.v !== null) {
            const val = String(cell.v).trim().toLowerCase();
            if (normalizedAliases.some(alias => alias === val)) {
              matchesInRow++;
            }
          }
        }
        if (matchesInRow > maxMatches) {
          maxMatches = matchesInRow;
          bestRow = row;
        }
      }
      return bestRow;
    } catch (err) {
      console.warn("Error finding header row index in sheet:", err);
      return 0;
    }
  }

  // Helper to find value by header key or aliases case-insensitively
  static findRowValue(row: Record<string, any>, headerKey: string): any {
    const aliases = HEADER_ALIASES[headerKey] || [headerKey];
    const rowKeys = Object.keys(row);
    for (const key of rowKeys) {
      const normalizedKey = key.trim().toLowerCase();
      if (aliases.some(alias => alias.toLowerCase() === normalizedKey)) {
        return row[key];
      }
    }
    return undefined;
  }

  // Helper to find match identifier value by key
  static findMatchIdentifierValue(row: Record<string, any>, headerKey: string): any {
    const aliases = MATCH_IDENTIFIER_ALIASES[headerKey] || [headerKey];
    const rowKeys = Object.keys(row);
    for (const key of rowKeys) {
      const normalizedKey = key.trim().toLowerCase();
      if (aliases.some(alias => alias.toLowerCase() === normalizedKey)) {
        return row[key];
      }
    }
    return undefined;
  }

  // 1. Download Player Performance Template (Player_Performance_Template.xlsx) - RAW count fields ONLY, NO percentage columns!
  static downloadPlayerPerformanceTemplate(matchId = 'M01'): void {
    const headers = [
      "match_id",
      "player_name",
      "player_number",
      "position",
      "minutes_played",
      "goals",
      "assists",
      "shots",
      "shots_on_target",
      "passes",
      "successful_passes",
      "key_passes",
      "long_passes",
      "through_balls",
      "crosses",
      "dribbles",
      "successful_dribbles",
      "duels",
      "duels_won",
      "tackles",
      "tackles_won",
      "interceptions",
      "clearances",
      "blocks",
      "ball_recoveries",
      "turnovers",
      "fouls",
      "yellow_cards",
      "red_cards"
    ];

    const sampleRows = [
      {
        "match_id": matchId,
        "player_name": "Liam Davies",
        "player_number": 9,
        "position": "CF",
        "minutes_played": 90,
        "goals": 1,
        "assists": 0,
        "shots": 4,
        "shots_on_target": 3,
        "passes": 28,
        "successful_passes": 22,
        "key_passes": 3,
        "long_passes": 4,
        "through_balls": 2,
        "crosses": 3,
        "dribbles": 4,
        "successful_dribbles": 3,
        "duels": 12,
        "duels_won": 7,
        "tackles": 3,
        "tackles_won": 2,
        "interceptions": 2,
        "clearances": 1,
        "blocks": 1,
        "ball_recoveries": 5,
        "turnovers": 2,
        "fouls": 1,
        "yellow_cards": 0,
        "red_cards": 0
      },
      {
        "match_id": matchId,
        "player_name": "Gethin Vaughan",
        "player_number": 6,
        "position": "CM",
        "minutes_played": 90,
        "goals": 0,
        "assists": 1,
        "shots": 2,
        "shots_on_target": 1,
        "passes": 52,
        "successful_passes": 46,
        "key_passes": 5,
        "long_passes": 6,
        "through_balls": 3,
        "crosses": 2,
        "dribbles": 3,
        "successful_dribbles": 2,
        "duels": 14,
        "duels_won": 9,
        "tackles": 5,
        "tackles_won": 4,
        "interceptions": 3,
        "clearances": 2,
        "blocks": 0,
        "ball_recoveries": 8,
        "turnovers": 1,
        "fouls": 2,
        "yellow_cards": 1,
        "red_cards": 0
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleRows, { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Player_Performance");
    XLSX.writeFile(workbook, `Player_Performance_${matchId}.xlsx`);
  }

  static downloadPlayerStatsTemplate(): void {
    ExcelUtils.downloadPlayerPerformanceTemplate();
  }

  // 2. Download Match Fixtures Template (Match_Fixtures_Template.xlsx) - RAW count fields ONLY, NO percentage columns! Single row per match!
  static downloadMatchFixturesTemplate(): void {
    const headers = [
      "match_id",
      "date",
      "opponent",
      "home_away",
      "our_score",
      "opponent_score",
      "status",
      "possession",
      "opp_possession",
      "goals",
      "shots",
      "shots_on_target",
      "passes",
      "successful_passes",
      "backwards_passes",
      "forwards_passes",
      "long_passes",
      "successful_long_passes",
      "key_passes",
      "successful_key_passes",
      "through_balls",
      "successful_through_balls",
      "crosses",
      "successful_crosses",
      "dribbles",
      "successful_dribbles",
      "duels",
      "duels_won",
      "aerial_duels",
      "aerial_duels_won",
      "ground_duels",
      "ground_duels_won",
      "ball_recoveries",
      "tackles",
      "tackles_won",
      "interceptions",
      "clearances",
      "blocks",
      "own_goals",
      "turnovers",
      "miscontrols",
      "unsuccessful_dribbles",
      "possession_lost",
      "offsides",
      "fouls",
      "yellow_cards",
      "red_cards",
      "opp_goals",
      "opp_shots",
      "opp_shots_on_target",
      "opp_passes",
      "opp_successful_passes",
      "opp_backwards_passes",
      "opp_forwards_passes",
      "opp_long_passes",
      "opp_successful_long_passes",
      "opp_key_passes",
      "opp_successful_key_passes",
      "opp_through_balls",
      "opp_successful_through_balls",
      "opp_crosses",
      "opp_successful_crosses",
      "opp_dribbles",
      "opp_successful_dribbles",
      "opp_duels",
      "opp_duels_won",
      "opp_aerial_duels",
      "opp_aerial_duels_won",
      "opp_ground_duels",
      "opp_ground_duels_won",
      "opp_ball_recoveries",
      "opp_tackles",
      "opp_tackles_won",
      "opp_interceptions",
      "opp_clearances",
      "opp_blocks",
      "opp_own_goals",
      "opp_turnovers",
      "opp_miscontrols",
      "opp_unsuccessful_dribbles",
      "opp_possession_lost",
      "opp_offsides",
      "opp_fouls",
      "opp_yellow_cards",
      "opp_red_cards"
    ];

    const sampleRows = [
      {
        "match_id": "M01",
        "date": "2026-08-15",
        "opponent": "AFC Roath",
        "home_away": "Home",
        "our_score": 2,
        "opponent_score": 1,
        "status": "Finished",
        "possession": 55.4,
        "opp_possession": 44.6,
        "goals": 2,
        "shots": 14,
        "shots_on_target": 7,
        "passes": 380,
        "successful_passes": 312,
        "backwards_passes": 95,
        "forwards_passes": 185,
        "long_passes": 45,
        "successful_long_passes": 32,
        "key_passes": 12,
        "successful_key_passes": 8,
        "through_balls": 6,
        "successful_through_balls": 4,
        "crosses": 15,
        "successful_crosses": 7,
        "dribbles": 18,
        "successful_dribbles": 12,
        "duels": 85,
        "duels_won": 48,
        "aerial_duels": 28,
        "aerial_duels_won": 15,
        "ground_duels": 57,
        "ground_duels_won": 33,
        "ball_recoveries": 42,
        "tackles": 22,
        "tackles_won": 16,
        "interceptions": 14,
        "clearances": 18,
        "blocks": 5,
        "own_goals": 0,
        "turnovers": 10,
        "miscontrols": 8,
        "unsuccessful_dribbles": 6,
        "possession_lost": 18,
        "offsides": 3,
        "fouls": 8,
        "yellow_cards": 1,
        "red_cards": 0,
        "opp_goals": 1,
        "opp_shots": 9,
        "opp_shots_on_target": 4,
        "opp_passes": 290,
        "opp_successful_passes": 220,
        "opp_backwards_passes": 70,
        "opp_forwards_passes": 140,
        "opp_long_passes": 50,
        "opp_successful_long_passes": 28,
        "opp_key_passes": 6,
        "opp_successful_key_passes": 3,
        "opp_through_balls": 4,
        "opp_successful_through_balls": 2,
        "opp_crosses": 10,
        "opp_successful_crosses": 4,
        "opp_dribbles": 12,
        "opp_successful_dribbles": 6,
        "opp_duels": 85,
        "opp_duels_won": 37,
        "opp_aerial_duels": 28,
        "opp_aerial_duels_won": 13,
        "opp_ground_duels": 57,
        "opp_ground_duels_won": 24,
        "opp_ball_recoveries": 38,
        "opp_tackles": 18,
        "opp_tackles_won": 11,
        "opp_interceptions": 10,
        "opp_clearances": 22,
        "opp_blocks": 3,
        "opp_own_goals": 0,
        "opp_turnovers": 14,
        "opp_miscontrols": 11,
        "opp_possession_lost": 22,
        "opp_offsides": 2,
        "opp_fouls": 11,
        "opp_yellow_cards": 2,
        "opp_red_cards": 0
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleRows, { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Match_Fixtures");
    XLSX.writeFile(workbook, "Match_Fixtures_Template.xlsx");
  }

  // 3. Download Team Roster Template (Team_Roster_Template.xlsx)
  static downloadTeamRosterTemplate(): void {
    const headers = [
      "full_name",
      "username",
      "role",
      "position",
      "shirt_number",
      "squad_status"
    ];

    const sampleRows = [
      {
        "full_name": "Liam Davies",
        "username": "liam_davies",
        "role": "Player",
        "position": "CF",
        "shirt_number": 9,
        "squad_status": "Active"
      },
      {
        "full_name": "Gethin Vaughan",
        "username": "gethin_vaughan",
        "role": "Player",
        "position": "CM",
        "shirt_number": 8,
        "squad_status": "Active"
      },
      {
        "full_name": "David Miller",
        "username": "david_miller",
        "role": "Head Coach",
        "position": "Staff",
        "shirt_number": "",
        "squad_status": "Active"
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleRows, { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Team_Roster");
    XLSX.writeFile(workbook, "Team_Roster_Template.xlsx");
  }

  // 4. Download Team Stats Template (Team_Stats_Template.xlsx) - RAW count fields ONLY, NO instructions text below!
  static downloadTeamStatsTemplate(): void {
    const headers = [
      "match_id",
      "date",
      "opponent",
      "home_away",
      "our_score",
      "opponent_score",
      "possession",
      "goals",
      "shots",
      "shots_on_target",
      "passes",
      "successful_passes",
      "backwards_passes",
      "forwards_passes",
      "long_passes",
      "successful_long_passes",
      "key_passes",
      "successful_key_passes",
      "through_balls",
      "successful_through_balls",
      "crosses",
      "successful_crosses",
      "dribbles",
      "successful_dribbles",
      "duels",
      "duels_won",
      "aerial_duels",
      "aerial_duels_won",
      "ground_duels",
      "ground_duels_won",
      "ball_recoveries",
      "tackles",
      "tackles_won",
      "interceptions",
      "clearances",
      "blocks",
      "own_goals",
      "turnovers",
      "miscontrols",
      "unsuccessful_dribbles",
      "possession_lost",
      "offsides",
      "fouls",
      "yellow_cards",
      "red_cards"
    ];

    const sampleRows = [
      {
        "match_id": "M01",
        "date": "2026-08-15",
        "opponent": "AFC Roath",
        "home_away": "Home",
        "our_score": 2,
        "opponent_score": 1,
        "possession": 55.4,
        "goals": 2,
        "shots": 14,
        "shots_on_target": 7,
        "passes": 380,
        "successful_passes": 312,
        "backwards_passes": 95,
        "forwards_passes": 185,
        "long_passes": 45,
        "successful_long_passes": 32,
        "key_passes": 12,
        "successful_key_passes": 8,
        "through_balls": 6,
        "successful_through_balls": 4,
        "crosses": 15,
        "successful_crosses": 7,
        "dribbles": 18,
        "successful_dribbles": 12,
        "duels": 85,
        "duels_won": 48,
        "aerial_duels": 28,
        "aerial_duels_won": 15,
        "ground_duels": 57,
        "ground_duels_won": 33,
        "ball_recoveries": 42,
        "tackles": 22,
        "tackles_won": 16,
        "interceptions": 14,
        "clearances": 18,
        "blocks": 5,
        "own_goals": 0,
        "turnovers": 10,
        "miscontrols": 8,
        "unsuccessful_dribbles": 6,
        "possession_lost": 18,
        "offsides": 3,
        "fouls": 8,
        "yellow_cards": 1,
        "red_cards": 0
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleRows, { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Team_Stats");
    XLSX.writeFile(workbook, "Team_Stats_Template.xlsx");
  }

  // Download match excel template (Match Performance Data Template)
  static downloadMatchPerformanceTemplate(): void {
    const headers = [
      "Match ID",
      "Player Name",
      "Player ID",
      "Position",
      "Minutes Played",
      "Goals",
      "Shots",
      "Shot Accuracy",
      "Shots Inside Box",
      "Shots Outside Box",
      "Headed Shots",
      "Blocked Shots",
      "Total Passes",
      "Completed Passes",
      "Long Passes",
      "Completed Long Passes",
      "Passes Opponent Half",
      "Completed Opponent Half",
      "Passes Final Third",
      "Completed Final Third",
      "Forward Passes",
      "Through Balls",
      "Crosses",
      "Completed Crosses",
      "Possession (%)",
      "Duels",
      "Duels Won",
      "Aerial Duels",
      "Aerial Duels Won",
      "Ground Duels",
      "Ground Duels Won",
      "Final Third Entries",
      "Box Entries",
      "Tackles",
      "Tackles Won",
      "Clearances",
      "Interceptions",
      "Blocks",
      "Recovery Rate",
      "Corners",
      "Fouls",
      "Was Fouled",
      "Yellow Cards",
      "Red Cards"
    ];

    const sampleRows: any[] = [
      {
        "Match ID": "M01",
        "Player Name": "Liam Davies",
        "Player ID": "CTFC-101",
        "Position": "CF",
        "Minutes Played": 90,
        "Goals": 1,
        "Shots": 4,
        "Shot Accuracy": "75%",
        "Shots Inside Box": 3,
        "Shots Outside Box": 1,
        "Headed Shots": 1,
        "Blocked Shots": 0,
        "Total Passes": 28,
        "Completed Passes": 22,
        "Long Passes": 2,
        "Completed Long Passes": 1,
        "Passes Opponent Half": 20,
        "Completed Opponent Half": 16,
        "Passes Final Third": 12,
        "Completed Final Third": 9,
        "Forward Passes": 8,
        "Through Balls": 2,
        "Crosses": 3,
        "Completed Crosses": 2,
        "Possession (%)": "54%",
        "Duels": 12,
        "Duels Won": 7,
        "Aerial Duels": 5,
        "Aerial Duels Won": 3,
        "Ground Duels": 7,
        "Ground Duels Won": 4,
        "Final Third Entries": 6,
        "Box Entries": 4,
        "Tackles": 3,
        "Tackles Won": 2,
        "Clearances": 1,
        "Interceptions": 2,
        "Blocks": 1,
        "Recovery Rate": 5,
        "Corners": 2,
        "Fouls": 1,
        "Was Fouled": 3,
        "Yellow Cards": 0,
        "Red Cards": 0
      },
      {
        "Match ID": "M01",
        "Player Name": "Gethin Vaughan",
        "Player ID": "CTFC-102",
        "Position": "CM",
        "Minutes Played": 85,
        "Goals": 0,
        "Shots": 2,
        "Shot Accuracy": "50%",
        "Shots Inside Box": 1,
        "Shots Outside Box": 1,
        "Headed Shots": 0,
        "Blocked Shots": 1,
        "Total Passes": 52,
        "Completed Passes": 46,
        "Long Passes": 6,
        "Completed Long Passes": 5,
        "Passes Opponent Half": 34,
        "Completed Opponent Half": 30,
        "Passes Final Third": 18,
        "Completed Final Third": 15,
        "Forward Passes": 16,
        "Through Balls": 4,
        "Crosses": 2,
        "Completed Crosses": 1,
        "Possession (%)": "58%",
        "Duels": 14,
        "Duels Won": 9,
        "Aerial Duels": 4,
        "Aerial Duels Won": 2,
        "Ground Duels": 10,
        "Ground Duels Won": 7,
        "Final Third Entries": 8,
        "Box Entries": 3,
        "Tackles": 5,
        "Tackles Won": 4,
        "Clearances": 2,
        "Interceptions": 3,
        "Blocks": 0,
        "Recovery Rate": 8,
        "Corners": 4,
        "Fouls": 2,
        "Was Fouled": 1,
        "Yellow Cards": 1,
        "Red Cards": 0
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleRows, { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Match Performance Data");
    
    XLSX.writeFile(workbook, "Match_Performance_Template.xlsx");
  }

  static downloadMatchTemplate(): void {
    ExcelUtils.downloadMatchPerformanceTemplate();
  }

  static downloadFixtureMatchTemplate(): void {
    ExcelUtils.downloadMatchPerformanceTemplate();
  }

  // Download player roster import excel template (4 Divisions Multi-Sheet: Our_Team_Roster_Template.xlsx)
  static downloadPlayerRosterTemplate(): void {
    const headers = [
      "Full Name",
      "Player ID",
      "Primary Position",
      "Preferred Foot",
      "Nationality"
    ];

    const premierRows = [
      { "Full Name": "Liam Davies", "Player ID": "CTFC-101", "Primary Position": "CF", "Preferred Foot": "Right", "Nationality": "Wales" },
      { "Full Name": "Gethin Vaughan", "Player ID": "CTFC-102", "Primary Position": "CM", "Preferred Foot": "Left", "Nationality": "Wales" },
      { "Full Name": "Rhys Morgan", "Player ID": "CTFC-103", "Primary Position": "CB", "Preferred Foot": "Right", "Nationality": "Wales" },
      { "Full Name": "Osian Griffiths", "Player ID": "CTFC-104", "Primary Position": "GK", "Preferred Foot": "Right", "Nationality": "Wales" }
    ];

    const firstRows = [
      { "Full Name": "Dylan Evans", "Player ID": "CTFC-201", "Primary Position": "LW", "Preferred Foot": "Left", "Nationality": "Wales" },
      { "Full Name": "Iwan Thomas", "Player ID": "CTFC-202", "Primary Position": "RW", "Preferred Foot": "Right", "Nationality": "Wales" },
      { "Full Name": "Cai Hughes", "Player ID": "CTFC-203", "Primary Position": "LB", "Preferred Foot": "Left", "Nationality": "Wales" },
      { "Full Name": "Harri Jones", "Player ID": "CTFC-204", "Primary Position": "RB", "Preferred Foot": "Right", "Nationality": "Wales" }
    ];

    const reservePremierRows = [
      { "Full Name": "Jac Roberts", "Player ID": "CTFC-301", "Primary Position": "CAM", "Preferred Foot": "Right", "Nationality": "Wales" },
      { "Full Name": "Macsen Lewis", "Player ID": "CTFC-302", "Primary Position": "CDM", "Preferred Foot": "Right", "Nationality": "Wales" },
      { "Full Name": "Tomos Williams", "Player ID": "CTFC-303", "Primary Position": "CB", "Preferred Foot": "Left", "Nationality": "Wales" }
    ];

    const reserveFirstRows = [
      { "Full Name": "Elis Bowen", "Player ID": "CTFC-401", "Primary Position": "ST", "Preferred Foot": "Right", "Nationality": "Wales" },
      { "Full Name": "Steffan Owen", "Player ID": "CTFC-402", "Primary Position": "CM", "Preferred Foot": "Right", "Nationality": "Wales" },
      { "Full Name": "Emyr Jenkins", "Player ID": "CTFC-403", "Primary Position": "GK", "Preferred Foot": "Right", "Nationality": "Wales" }
    ];

    const workbook = XLSX.utils.book_new();

    const premierWS = XLSX.utils.json_to_sheet(premierRows, { header: headers });
    const firstWS = XLSX.utils.json_to_sheet(firstRows, { header: headers });
    const resPremierWS = XLSX.utils.json_to_sheet(reservePremierRows, { header: headers });
    const resFirstWS = XLSX.utils.json_to_sheet(reserveFirstRows, { header: headers });

    XLSX.utils.book_append_sheet(workbook, premierWS, "CCFL Premier");
    XLSX.utils.book_append_sheet(workbook, firstWS, "CCFL First");
    XLSX.utils.book_append_sheet(workbook, resPremierWS, "Reserve Premier");
    XLSX.utils.book_append_sheet(workbook, resFirstWS, "Reserve First");
    
    XLSX.writeFile(workbook, "Our_Team_Roster_Template.xlsx");
  }

  static downloadPlayerTemplate(): void {
    ExcelUtils.downloadPlayerRosterTemplate();
  }

  // Parse Match Data spreadsheet dynamically determining team orientation
  static parseMatchExcel(file: File): Promise<ExcelParseResult<MatchData>> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = ExcelUtils.findOptimalSheet(workbook, "Match Date") || workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const headerRowIndex = ExcelUtils.findHeaderRowIndex(sheet, "Match Date");
          const json: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex });
          
          const validRecords: MatchData[] = [];
          const errorDetails: string[] = [];
          let errorRowsCount = 0;

          for (let index = 0; index < json.length; index++) {
            const row = json[index];
            const rowNum = index + 2;

            // Find Date, Team Name, Opponent (Mandatory)
            let dateVal = "";
            let teamNameVal = "";
            let opponentVal = "";
            let competitionVal = "League";
            let venueVal = "Home";
            let resultVal = "W (1-0)";

            // Look directly in row fields by standard English names
            for (const [header, key] of Object.entries(MATCH_HEADERS_MAP)) {
              if (row[header] !== undefined) {
                const sVal = String(row[header]).trim();
                if (key === "date") dateVal = sVal;
                if (key === "teamName") teamNameVal = sVal;
                if (key === "opponent") opponentVal = sVal;
                if (key === "competition") competitionVal = sVal;
                if (key === "venue") venueVal = sVal;
                if (key === "result") resultVal = sVal;
              }
            }

            // Fallback for older headers
            if (!teamNameVal && row["Team"] !== undefined) {
              teamNameVal = String(row["Team"]).trim();
            }

            if (!dateVal) {
              errorDetails.push(`Row ${rowNum}: Required field [Match Date] is missing.`);
              errorRowsCount++;
              continue;
            }

            // Decide team orientation
            let isOpp = true;
            const normalizedTeamName = teamNameVal.toLowerCase();
            if (!teamNameVal || normalizedTeamName.includes("cardiff town") || normalizedTeamName === "us" || normalizedTeamName === "our") {
              isOpp = false;
            }

            // Resolve opponent name
            let finalOpponent = opponentVal;
            if (isOpp) {
              // For opponent rows, the teamNameVal represents the analyzed opponent team, while our team is the actual opponent in that row!
              finalOpponent = teamNameVal || "Opponent";
            } else if (!finalOpponent) {
              finalOpponent = "Unknown Opponent";
            }

            // Create match object
            const record: MatchData = {
              id: "",
              date: dateVal,
              competition: competitionVal,
              opponent: finalOpponent,
              venue: venueVal,
              result: resultVal,
              isOpponentTeam: isOpp,
              
              // Standard PI counters
              shots: 0,
              shotsOnTarget: 0,
              goals: 0,
              corners: 0,
            };

            // Map standard and custom PI numeric fields
            for (const [header, key] of Object.entries(MATCH_HEADERS_MAP)) {
              if (row[header] !== undefined) {
                const numVal = Number(row[header]);
                if (!isNaN(numVal) && key !== "date" && key !== "opponent" && key !== "competition" && key !== "venue" && key !== "result" && key !== "teamName") {
                  (record as any)[key] = numVal;
                }
              }
            }

            // Re-derive general standard stats from specific Hudl Sportscode stats if they are present but parent is empty
            if (record.shotOnTarget !== undefined && !record.shotsOnTarget) {
              record.shotsOnTarget = record.shotOnTarget;
            }
            if (record.shotOnTarget !== undefined && record.shotOffTarget !== undefined && record.shotBlocked !== undefined) {
              record.shots = record.shotOnTarget + record.shotOffTarget + record.shotBlocked + record.goals;
            }
            if (record.backwardPasses !== undefined && record.forwardPasses !== undefined && record.sidewaysPasses !== undefined) {
              record.totalPasses = record.backwardPasses + record.forwardPasses + record.sidewaysPasses + (record.crosses || 0) + (record.throughBalls || 0);
            }
            if (record.failedPass !== undefined && record.totalPasses) {
              record.successfulPasses = Math.max(0, record.totalPasses - record.failedPass);
            }
            if (record.tackle !== undefined) {
              record.tacklesAttempted = record.tackle + (record.dribbledPast || 0);
              record.tacklesWon = record.tackle;
            }
            if (record.ballRecovery !== undefined) {
              record.ballRecoveries = record.ballRecovery;
            }
            if (record.penaltyAreaEntry !== undefined) {
              record.boxEntries = record.penaltyAreaEntry;
            }

            // Validation Checks
            const rowErrors: string[] = [];
            
            // Negative values check
            for (const [k, v] of Object.entries(record)) {
              if (typeof v === "number" && v < 0) {
                rowErrors.push(`${k} cannot be a negative value (${v})`);
              }
            }

            if (rowErrors.length > 0) {
              errorDetails.push(`[Row ${rowNum} - Team: ${teamNameVal || "Cardiff Town FC"}] ${rowErrors.join(" | ")}`);
              errorRowsCount++;
            } else {
              validRecords.push(record);
            }
          }

          resolve({
            validRecords,
            totalRows: json.length,
            errorRows: errorRowsCount,
            errorDetails
          });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  }

  // Parse Player Data spreadsheet with Multi-Sheet 4 Division support
  static parsePlayerExcel(file: File, options?: { teamName?: string; teamId?: string }): Promise<ExcelParseResult<Player>> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          
          const validRecords: Player[] = [];
          const errorDetails: string[] = [];
          let errorRowsCount = 0;
          let totalRowsCount = 0;

          // Parse all sheets (e.g. CCFL Premier, CCFL First, Reserve Premier, Reserve First)
          for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            if (!sheet || !sheet['!ref']) continue;

            let division = sheetName.trim();
            if (sheetName.toLowerCase().includes("premier") && sheetName.toLowerCase().includes("reserve")) {
              division = "Reserve Premier";
            } else if (sheetName.toLowerCase().includes("first") && sheetName.toLowerCase().includes("reserve")) {
              division = "Reserve First";
            } else if (sheetName.toLowerCase().includes("premier")) {
              division = "CCFL Premier";
            } else if (sheetName.toLowerCase().includes("first")) {
              division = "CCFL First";
            }

            const headerRowIndex = ExcelUtils.findHeaderRowIndex(sheet, "Player Name") ?? ExcelUtils.findHeaderRowIndex(sheet, "Full Name") ?? 0;
            const json: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex });
            totalRowsCount += json.length;

            for (let index = 0; index < json.length; index++) {
              const row = json[index];
              const rowNum = index + 2;

              let nameVal = "";
              let playerIdVal = "";
              let dobVal = "";
              let backNumberVal = 0;
              let posVal: any = "ST";
              let joinDateVal = "";
              let nationalityVal = "Wales";
              let preferredFootVal = "Right";

              // Map row fields by keys
              for (const [header, key] of Object.entries(PLAYER_HEADERS_MAP)) {
                const rowVal = ExcelUtils.findRowValue(row, header);
                if (rowVal !== undefined) {
                  if (key === "name") nameVal = String(rowVal).trim();
                  if (key === "dob") dobVal = String(rowVal).trim();
                  if (key === "backNumber") {
                    playerIdVal = String(rowVal).trim();
                    backNumberVal = parseInt(String(rowVal).replace(/\D/g, "")) || 0;
                  }
                  if (key === "position") posVal = String(rowVal).trim();
                  if (key === "joinDate") joinDateVal = String(rowVal).trim();
                  if (key === "nationality") nationalityVal = String(rowVal).trim();
                  if (key === "preferredFoot") preferredFootVal = String(rowVal).trim();
                }
              }

              if (!nameVal) {
                errorDetails.push(`Sheet [${sheetName}] Row ${rowNum}: Required column [Player Name / Full Name] is missing.`);
                errorRowsCount++;
                continue;
              }

              const pId = playerIdVal || `P-${Math.floor(100 + Math.random() * 900)}`;

              const player: Player = {
                id: pId,
                name: nameVal,
                dob: dobVal || "2000-01-01",
                joinDate: joinDateVal || "2026-08-01",
                backNumber: backNumberVal || (parseInt(pId.replace(/\D/g, "")) || 10),
                position: posVal,
                nationality: nationalityVal || "Wales",
                preferredFoot: preferredFootVal || "Right",
                division: division,
                teamName: options?.teamName || "Cardiff Town FC",
                teamId: options?.teamId || "ctfc",
                totalPasses: 0,
                successfulPasses: 0,
                progressivePasses: 0,
                successfulProgressivePasses: 0,
                finalThirdPasses: 0,
                keyPasses: 0,
                throughBalls: 0,
                successfulThroughBalls: 0,
                shots: 0,
                shotsOnTarget: 0,
                goals: 0,
                assists: 0,
                chancesCreated: 0,
                touches: 0,
                progressiveCarries: 0,
                progressiveDribbles: 0,
                aerialDuels: 0,
                aerialDuelsWon: 0,
                defensiveDuels: 0,
                defensiveDuelsWon: 0,
                tacklesAttempted: 0,
                tacklesWon: 0,
                interceptions: 0,
                clearances: 0,
                ballRecoveries: 0,
                possessionRegains: 0,
                dribblesAttempted: 0,
                successfulDribbles: 0,
                crossesAttempted: 0,
                successfulCrosses: 0,
                boxEntries: 0,
                saveAttempts: 0,
                saves: 0,
                crossClaims: 0,
                sweeperActions: 0,
                minutesPlayed: 0,
                cleanSheets: 0,
              };

              // Map numeric fields
              for (const [header, key] of Object.entries(PLAYER_HEADERS_MAP)) {
                const rowVal = ExcelUtils.findRowValue(row, header);
                if (rowVal !== undefined) {
                  const numVal = Number(rowVal);
                  if (!isNaN(numVal) && key !== "name" && key !== "dob" && key !== "backNumber" && key !== "position") {
                    (player as any)[key] = numVal;
                  }
                }
              }

              validRecords.push(player);
            }
          }

          resolve({
            validRecords,
            totalRows: totalRowsCount,
            errorRows: errorRowsCount,
            errorDetails
          });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  }

  // Parse Player Match-by-Match Data spreadsheet
  static async parsePlayerMatchExcel(file: File): Promise<ExcelParseResult<any>> {
    const { data: profiles } = await (supabase.from('profiles') as any).select('player_id, full_name, username, id, user_id');
    const profileMap = new Map<string, string>();
    if (profiles && Array.isArray(profiles)) {
      profiles.forEach((p: any) => {
        const pid = p.player_id || p.id || p.user_id;
        if (!pid) return;
        if (p.full_name) profileMap.set(p.full_name.trim().toLowerCase(), pid);
        if (p.username) profileMap.set(p.username.trim().toLowerCase(), pid);
      });
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = ExcelUtils.findOptimalSheet(workbook, "Player Name") || workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const headerRowIndex = ExcelUtils.findHeaderRowIndex(sheet, "Player Name");
          const json: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex });
          
          const validRecords: any[] = [];
          const errorDetails: string[] = [];
          let errorRowsCount = 0;

          for (let index = 0; index < json.length; index++) {
            const row = json[index];
            const rowNum = index + 2;

            let matchIdVal = "";
            let teamIdVal = "";
            let playerIdVal = "";
            let playerNameVal = "";
            let shirtNumberVal = 0;
            let positionVal = "ST";

            // Map custom identifiers
            const matchIdRowVal = ExcelUtils.findMatchIdentifierValue(row, "Match ID");
            const teamIdRowVal = ExcelUtils.findMatchIdentifierValue(row, "Team ID");
            const playerIdRowVal = ExcelUtils.findMatchIdentifierValue(row, "Player ID");
            const playerNameRowVal = ExcelUtils.findMatchIdentifierValue(row, "Player Name") || ExcelUtils.findMatchIdentifierValue(row, "Full Name");
            const shirtNumberRowVal = ExcelUtils.findMatchIdentifierValue(row, "Shirt Number");
            const positionRowVal = ExcelUtils.findMatchIdentifierValue(row, "Position") || ExcelUtils.findMatchIdentifierValue(row, "Primary Position");

            if (matchIdRowVal !== undefined) matchIdVal = String(matchIdRowVal).trim();
            if (teamIdRowVal !== undefined) teamIdVal = String(teamIdRowVal).trim();
            if (playerIdRowVal !== undefined) playerIdVal = String(playerIdRowVal).trim();
            if (playerNameRowVal !== undefined) playerNameVal = String(playerNameRowVal).trim();
            if (shirtNumberRowVal !== undefined) shirtNumberVal = Number(shirtNumberRowVal);
            if (positionRowVal !== undefined) positionVal = String(positionRowVal).trim();

            if (!matchIdVal) matchIdVal = "M01";
            if (!teamIdVal) teamIdVal = "ctfc";

            if (!playerNameVal && !playerIdVal) {
              errorDetails.push(`Row ${rowNum}: Required column [Player Name] or [Player ID] is missing.`);
              errorRowsCount++;
              continue;
            }

            const resolvedPlayerId = profileMap.get(playerNameVal.trim().toLowerCase()) || playerIdVal || (shirtNumberVal ? String(shirtNumberVal) : playerNameVal.toLowerCase().replace(/\s+/g, "_"));

            const record: any = {
              matchId: matchIdVal,
              teamId: teamIdVal,
              playerId: resolvedPlayerId,
              playerName: playerNameVal || playerIdVal || "Unknown",
              shirtNumber: shirtNumberVal,
              position: positionVal,
              goals: 0,
              assists: 0,
              shots: 0,
              shotsOnTarget: 0,
              totalPasses: 0,
              successfulPasses: 0,
              keyPasses: 0,
              throughBalls: 0,
              touches: 0,
              tacklesAttempted: 0,
              tacklesWon: 0,
              interceptions: 0,
              clearances: 0,
              ballRecoveries: 0,
              dribblesAttempted: 0,
              successfulDribbles: 0,
              crossesAttempted: 0,
              successfulCrosses: 0,
              minutesPlayed: 0
            };

            // Map standard and custom player numeric fields
            for (const [header, key] of Object.entries(PLAYER_HEADERS_MAP)) {
              const rowVal = ExcelUtils.findRowValue(row, header);
              if (rowVal !== undefined) {
                let cleanVal = rowVal;
                if (typeof cleanVal === "string") {
                  cleanVal = cleanVal.replace("%", "").trim();
                }
                const numVal = Number(cleanVal);
                if (!isNaN(numVal) && key !== "name" && key !== "dob" && key !== "backNumber" && key !== "position") {
                  record[key] = numVal;
                }
              }
            }

            const rowErrors: string[] = [];
            for (const [k, v] of Object.entries(record)) {
              if (typeof v === "number" && v < 0) {
                rowErrors.push(`${k} cannot be a negative value (${v})`);
              }
            }

            if (rowErrors.length > 0) {
              errorDetails.push(`[Row ${rowNum} - Team: ${teamIdVal}, Player: ${playerNameVal || playerIdVal}] ${rowErrors.join(" | ")}`);
              errorRowsCount++;
            } else {
              validRecords.push(record);
            }
          }

          resolve({
            validRecords,
            totalRows: json.length,
            errorRows: errorRowsCount,
            errorDetails
          });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  }

  // Download Heatmap Data Template spreadsheet
  static downloadHeatmapTemplate(): void {
    const headers = [
      "Match ID",
      "Team ID",
      "Player ID",
      "Start X",
      "Start Y",
      "End X",
      "End Y",
      "Type"
    ];

    const sampleRows: any[] = [
      {
        "Match ID": "M01",
        "Team ID": "ctfc",
        "Player ID": "ST01",
        "Start X": 20,
        "Start Y": 15,
        "End X": 35,
        "End Y": 20,
        "Type": "Pass"
      },
      {
        "Match ID": "M01",
        "Team ID": "ctfc",
        "Player ID": "CM01",
        "Start X": 30,
        "Start Y": 30,
        "End X": 30,
        "End Y": 30,
        "Type": "Activity"
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleRows, { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Heatmap Data");
    
    XLSX.writeFile(workbook, "heatmap_coordinates_template.xlsx");
  }

  // Parse Heatmap XY Coordinates spreadsheet
  static parseHeatmapExcel(file: File): Promise<ExcelParseResult<any>> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const json: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet);
          
          const validRecords: any[] = [];
          const errorDetails: string[] = [];
          let errorRowsCount = 0;

          for (let index = 0; index < json.length; index++) {
            const row = json[index];
            const rowNum = index + 2;

            let matchIdVal = "";
            let teamIdVal = "";
            let playerIdVal = "";
            let startXVal = 0;
            let startYVal = 0;
            let endXVal = 0;
            let endYVal = 0;
            let typeVal = "Activity";

            // Map keys
            for (const [key, val] of Object.entries(row)) {
              const lowerKey = key.toLowerCase().replace(/[\s_-]/g, "");
              if (lowerKey === "matchid") matchIdVal = String(val).trim();
              else if (lowerKey === "teamid") teamIdVal = String(val).trim();
              else if (lowerKey === "playerid") playerIdVal = String(val).trim();
              else if (lowerKey === "startx") startXVal = Number(val);
              else if (lowerKey === "starty") startYVal = Number(val);
              else if (lowerKey === "endx") endXVal = Number(val);
              else if (lowerKey === "endy") endYVal = Number(val);
              else if (lowerKey === "type") typeVal = String(val).trim();
            }

            if (!matchIdVal || !teamIdVal || !playerIdVal) {
              errorDetails.push(`Row ${rowNum}: Required column [Match ID], [Team ID], or [Player ID] is missing.`);
              errorRowsCount++;
              continue;
            }

            if (isNaN(startXVal) || isNaN(startYVal) || isNaN(endXVal) || isNaN(endYVal)) {
              errorDetails.push(`Row ${rowNum}: Coordinates must be numeric values.`);
              errorRowsCount++;
              continue;
            }

            // Normalise coordinates to 0-60 range if they are out of bounds
            const clamp60 = (val: number) => Math.max(0, Math.min(60, val));

            const record = {
              matchId: matchIdVal,
              teamId: teamIdVal,
              playerId: playerIdVal,
              startX: clamp60(startXVal),
              startY: clamp60(startYVal),
              endX: clamp60(endXVal),
              endY: clamp60(endYVal),
              type: typeVal || "Activity"
            };

            validRecords.push(record);
          }

          resolve({
            validRecords,
            totalRows: json.length,
            errorRows: errorRowsCount,
            errorDetails
          });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  }

  // Parse Teams Data spreadsheet
  static parseTeamsExcel(file: File): Promise<CustomTeam[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const parsedTeams: CustomTeam[] = [];

          for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            if (!sheet || !sheet['!ref']) continue;

            // Determine league based on sheet name
            let league = "CCFL Third Division";
            const lowerSheetName = sheetName.toLowerCase();
            if (lowerSheetName.includes("premier")) {
              league = "CCFL Premier Division";
            } else if (lowerSheetName.includes("first")) {
              league = "CCFL First Division";
            } else if (lowerSheetName.includes("second")) {
              league = "CCFL Second Division";
            } else if (lowerSheetName.includes("third")) {
              league = "CCFL Third Division";
            }

            const json: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet);
            
            // Loop through rows to find Team ID and Team Name
            for (const row of json) {
              let rawId = "";
              let rawName = "";
              let rowLeague = league;

              // Search for key match aliases
              for (const [key, val] of Object.entries(row)) {
                const lowerKey = key.toLowerCase().replace(/\s+/g, "");
                const strVal = String(val || "").trim();
                if (!strVal) continue;

                if (["teamid", "id", "팀id", "팀코드", "코드", "code"].includes(lowerKey)) {
                  rawId = strVal;
                } else if (["teamname", "name", "팀이름", "팀명", "이름"].includes(lowerKey)) {
                  rawName = strVal;
                } else if (["league", "division", "리그", "디비전", "구분"].includes(lowerKey)) {
                  if (strVal.toLowerCase().includes("premier")) rowLeague = "CCFL Premier Division";
                  else if (strVal.toLowerCase().includes("first")) rowLeague = "CCFL First Division";
                  else if (strVal.toLowerCase().includes("second")) rowLeague = "CCFL Second Division";
                  else if (strVal.toLowerCase().includes("third")) rowLeague = "CCFL Third Division";
                }
              }

              if (rawId && rawName) {
                parsedTeams.push({
                  id: rawId.toLowerCase().trim(),
                  name: rawName.trim(),
                  league: rowLeague,
                  mp: 0,
                  w: 0,
                  d: 0,
                  l: 0,
                  gf: 0,
                  ga: 0
                });
              }
            }
          }

          resolve(parsedTeams);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  }

  // Download League Teams Template (League_Teams_Template.xlsx)
  static downloadLeagueTeamsTemplate(): void {
    const headers = [
      "Team Name (Mandatory)",
      "Short Name (Optional)",
      "Division (Optional)",
      "Home Venue (Optional)"
    ];

    const sampleRows = [
      {
        "Team Name (Mandatory)": "Cardiff Town FC",
        "Short Name (Optional)": "CTFC",
        "Division (Optional)": "Premier Division",
        "Home Venue (Optional)": "Cardiff Sports Village"
      },
      {
        "Team Name (Mandatory)": "AFC Roath",
        "Short Name (Optional)": "AFCR",
        "Division (Optional)": "Division 1",
        "Home Venue (Optional)": "Roath Park"
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleRows, { header: headers });
    worksheet['!cols'] = [
      { wch: 30 },
      { wch: 22 },
      { wch: 22 },
      { wch: 30 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "League Teams");

    XLSX.writeFile(workbook, "League_Teams_Template.xlsx");
  }

  static downloadTeamsTemplate(): void {
    ExcelUtils.downloadLeagueTeamsTemplate();
  }

  // Download Team Registration Template specifically for registering teams
  static downloadTeamRegistrationTemplate(): void {
    ExcelUtils.downloadLeagueTeamsTemplate();
  }

  // Parse Team Registration spreadsheet and validate required fields (ONLY Team Name is mandatory)
  static parseTeamRegistrationExcel(file: File): Promise<TeamRegistrationParseResult> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const validRecords: ParsedTeamRegistrationRow[] = [];
          const errorDetails: string[] = [];
          let errorRowsCount = 0;
          let totalRowsCount = 0;

          // Search for sheet named "Teams" or fallback to first sheet
          const sheetName = workbook.SheetNames.find(s => s.toLowerCase().trim() === "teams") || workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];

          if (sheet && sheet['!ref']) {
            const json: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet);
            totalRowsCount = json.length;

            for (let i = 0; i < json.length; i++) {
              const row = json[i];
              const rowNum = i + 2;

              let teamIdVal = "";
              let teamNameVal = "";
              let divisionVal = "";
              let homeVenueVal = "";
              let shortCodeVal = "";

              for (const [key, val] of Object.entries(row)) {
                const lowerKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
                const strVal = String(val || "").trim();
                if (!strVal) continue;

                if (["teamidoptional", "teamid", "id", "teamcode", "code"].includes(lowerKey)) {
                  teamIdVal = strVal;
                } else if (["teamnamemandatory", "teamname", "name", "clubname"].includes(lowerKey)) {
                  teamNameVal = strVal;
                } else if (["divisionoptional", "division", "league", "tier"].includes(lowerKey)) {
                  divisionVal = strVal;
                } else if (["homevenueoptional", "homevenue", "venue", "stadium", "ground"].includes(lowerKey)) {
                  homeVenueVal = strVal;
                } else if (["shortnameoptional", "shortnamecode", "shortname", "code", "shortcode", "abbr"].includes(lowerKey)) {
                  shortCodeVal = strVal;
                }
              }

              // Extract row entries and validate that ONLY Team Name is present
              if (!teamNameVal) {
                errorDetails.push(`Row ${rowNum}: Required column [Team Name] is missing.`);
                errorRowsCount++;
                continue;
              }

              const generatedUuid = crypto.randomUUID();
              let resolvedId = teamIdVal;
              let resolvedShortCode = shortCodeVal;

              if (!resolvedId) {
                resolvedId = generatedUuid;
              } else if (!resolvedShortCode && resolvedId.length <= 8 && !resolvedId.includes('-')) {
                resolvedShortCode = resolvedId;
                resolvedId = generatedUuid;
              }

              validRecords.push({
                id: resolvedId,
                team_id: resolvedId,
                team_name: teamNameVal,
                division: divisionVal || "Premier Division",
                home_venue: homeVenueVal || undefined,
                short_code: resolvedShortCode || undefined,
                created_at: new Date().toISOString()
              });
            }
          }

          resolve({
            validRecords,
            totalRows: totalRowsCount,
            errorRows: errorRowsCount,
            errorDetails
          });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  }
}

const safeString = (val: any): string => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object' && val.result !== undefined) return String(val.result).trim();
  return String(val).trim();
};

const safeNumber = (val: any): number => {
  if (val === null || val === undefined) return 0;
  const num = Number(val);
  return isNaN(num) ? 0 : num;
};

export async function parseTeamStatsExcel(file: File): Promise<{ data: any[]; errors?: string[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as any[];

        const cleanRows = rawRows.map(row => {
          const matchId = safeString(row.match_id || row.id || `TEAM_STAT_${Date.now()}`);
          return {
            id: matchId,
            match_id: matchId,
            date: safeString(row.date) || new Date().toISOString().split('T')[0],
            opponent: safeString(row.opponent) || 'Opponent Team',
            home_away: safeString(row.home_away) || 'Home',
            our_score: safeNumber(row.our_score ?? row.goals),
            opponent_score: safeNumber(row.opponent_score ?? row.opp_goals),
            possession: safeNumber(row.possession),
            goals: safeNumber(row.goals),
            shots: safeNumber(row.shots),
            shots_on_target: safeNumber(row.shots_on_target),
            passes: safeNumber(row.passes),
            successful_passes: safeNumber(row.successful_passes),
            backwards_passes: safeNumber(row.backwards_passes),
            forwards_passes: safeNumber(row.forwards_passes),
            long_passes: safeNumber(row.long_passes),
            successful_long_passes: safeNumber(row.successful_long_passes),
            key_passes: safeNumber(row.key_passes),
            successful_key_passes: safeNumber(row.successful_key_passes),
            through_balls: safeNumber(row.through_balls),
            successful_through_balls: safeNumber(row.successful_through_balls),
            crosses: safeNumber(row.crosses),
            successful_crosses: safeNumber(row.successful_crosses),
            dribbles: safeNumber(row.dribbles),
            successful_dribbles: safeNumber(row.successful_dribbles),
            duels: safeNumber(row.duels),
            duels_won: safeNumber(row.duels_won),
            aerial_duels: safeNumber(row.aerial_duels),
            aerial_duels_won: safeNumber(row.aerial_duels_won),
            ground_duels: safeNumber(row.ground_duels),
            ground_duels_won: safeNumber(row.ground_duels_won),
            ball_recoveries: safeNumber(row.ball_recoveries),
            tackles: safeNumber(row.tackles),
            tackles_won: safeNumber(row.tackles_won),
            interceptions: safeNumber(row.interceptions),
            clearances: safeNumber(row.clearances),
            blocks: safeNumber(row.blocks),
            own_goals: safeNumber(row.own_goals),
            turnovers: safeNumber(row.turnovers),
            miscontrols: safeNumber(row.miscontrols),
            unsuccessful_dribbles: safeNumber(row.unsuccessful_dribbles),
            possession_lost: safeNumber(row.possession_lost),
            offsides: safeNumber(row.offsides),
            fouls: safeNumber(row.fouls),
            yellow_cards: safeNumber(row.yellow_cards),
            red_cards: safeNumber(row.red_cards)
          };
        }).filter(r => r.id !== "");

        resolve({ data: cleanRows });
      } catch (err: any) {
        reject(err);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}
