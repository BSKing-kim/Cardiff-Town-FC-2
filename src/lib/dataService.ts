import { supabase } from "./supabase";
import { INITIAL_MATCHES, INITIAL_PLAYERS, INITIAL_FIXTURES } from "./seedData";
import { MatchData, Player, UserProfile, UserRole, PlayerPosition, MatchFixture, CustomTeam, HeatmapPoint, ProfileUpdateRequest } from "../types";

// LocalStorage Keys
const MATCHES_LS_KEY = "team_perf_analyzer_matches";
const PLAYERS_LS_KEY = "team_perf_analyzer_players";
const USERS_LS_KEY = "team_perf_analyzer_users";
const CURRENT_USER_LS_KEY = "team_perf_analyzer_current_user";
const FIXTURES_LS_KEY = "team_perf_analyzer_fixtures";

export interface RoleApplication {
  id: string;
  userId: string;
  username: string;
  rolePreference: UserRole;
  requestedRole: UserRole;
  requestType: "Join" | "RoleChange";
  type: "Join" | "RoleChange";
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

// Default Admin
const DEFAULT_ADMIN: UserProfile & { passwordHash: string } = {
  id: "admin_minwoo",
  username: "minwoo6647",
  role: UserRole.Analyst,
  isAdmin: true,
  createdAt: "2026-06-22T00:00:00Z",
  passwordHash: "Jerry6647!",
  firstName: "Minwoo",
  lastName: "Kim",
  approved: true
};

export class DataService {
  // In-Memory Data Cache
  private static memoryCache = new Map<string, { data: any; timestamp: number }>();
  private static CACHE_TTL_MS = 60000; // 60 seconds

  public static invalidateCache(keyPrefix?: string): void {
    if (!keyPrefix) {
      this.memoryCache.clear();
    } else {
      for (const key of this.memoryCache.keys()) {
        if (key.startsWith(keyPrefix)) {
          this.memoryCache.delete(key);
        }
      }
    }
  }

  private static getCached<T>(key: string): T | null {
    const entry = this.memoryCache.get(key);
    if (entry && Date.now() - entry.timestamp < this.CACHE_TTL_MS) {
      return entry.data as T;
    }
    return null;
  }

  private static setCached<T>(key: string, data: T): T {
    this.memoryCache.set(key, { data, timestamp: Date.now() });
    return data;
  }

  private static sanitizeForSupabase(obj: any): any {
    if (obj === null || obj === undefined) return null;
    if (typeof obj !== "object") return obj;
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeForSupabase(item));
    }
    const clean: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        clean[key] = this.sanitizeForSupabase(value);
      }
    }
    return clean;
  }

  static getPositionPrefix(pos: string): string {
    const p = String(pos || "").trim().toUpperCase();
    if (["GK", "GOALKEEPER"].includes(p)) return "GK";
    if (["LB"].includes(p)) return "LB";
    if (["CB", "DEFENDER"].includes(p)) return "CB";
    if (["RB"].includes(p)) return "RB";
    if (["DM"].includes(p)) return "DM";
    if (["CM", "MIDFIELDER"].includes(p)) return "CM";
    if (["AM"].includes(p)) return "AM";
    if (["LW", "WINGER", "LM", "RM", "W"].includes(p)) return "LW";
    if (["RW"].includes(p)) return "RW";
    if (["CF", "ST", "STRIKER"].includes(p) || p.includes("FORW") || p.includes("STRI")) return "CF";
    if (["FB"].includes(p)) return "LB";
    return "CF";
  }

  static migrateMatch(m: any): MatchData {
    const insideBoxShots = Number(m.insideBoxShots ?? m.boxShots ?? 0);
    const totalPasses = Number(m.totalPasses ?? m.passes ?? 0);
    const progressivePasses = Number(m.progressivePasses ?? m.forwardPasses ?? 0);
    const tacklesWon = Number(m.tacklesWon ?? m.tacklesSucceeded ?? 0);
    const ballRecoveries = Number(m.ballRecoveries ?? m.recoveries ?? 0);
    const crossesAttempted = Number(m.crossesAttempted ?? m.crosses ?? 0);
    const successfulCrosses = Number(m.successfulCrosses ?? Math.round(crossesAttempted * (m.crossSuccessRate ?? 0) / 100));
    const successfulPasses = Number(m.successfulPasses ?? Math.round(totalPasses * (m.passSuccessRate ?? 0) / 100));

    return {
      id: m.id || "",
      fixtureId: m.fixtureId || undefined,
      date: m.date || "2026-06-22",
      competition: m.competition || "League",
      opponent: m.opponent || "Unknown Opponent",
      venue: m.venue || (m.isOpponentTeam ? "Away" : "Home"),
      result: m.result || "D (0-0)",
      isOpponentTeam: !!m.isOpponentTeam,
      
      shots: Number(m.shots) || 0,
      shotsOnTarget: Number(m.shotsOnTarget) || 0,
      insideBoxShots,
      crossesAttempted,
      successfulCrosses,
      totalPasses,
      successfulPasses,
      progressivePasses,
      finalThirdPasses: Number(m.finalThirdPasses ?? 0),
      boxEntries: Number(m.boxEntries ?? 0),
      goals: Number(m.goals ?? 0),
      
      tacklesAttempted: Number(m.tacklesAttempted ?? 0),
      tacklesWon,
      interceptions: Number(m.interceptions ?? 0),
      clearances: Number(m.clearances ?? 0),
      blocks: Number(m.blocks ?? 0),
      fouls: Number(m.fouls ?? 0),
      yellowCards: Number(m.yellowCards ?? 0),
      
      ballRecoveries,
      counterAttacks: Number(m.counterAttacks ?? 0),
      turnovers: Number(m.turnovers ?? 0),
      transitionPasses: Number(m.transitionPasses ?? 0),
      
      possessionRate: Number(m.possessionRate ?? 50),
      longPasses: Number(m.longPasses ?? 0),
      
      corners: Number(m.corners ?? 0),
      freeKicks: Number(m.freeKicks ?? 0),
      longThrows: Number(m.longThrows ?? 0),

      possessions: Number(m.possessions ?? 50),
      bigChancesCreated: Number(m.bigChancesCreated ?? 0),

      boxShots: insideBoxShots,
      passes: totalPasses,
      forwardPasses: progressivePasses,
      tacklesSucceeded: tacklesWon,
      recoveries: ballRecoveries,
      passSuccessRate: totalPasses > 0 ? parseFloat((successfulPasses / totalPasses * 100).toFixed(1)) : 0,
      crossSuccessRate: crossesAttempted > 0 ? parseFloat((successfulCrosses / crossesAttempted * 100).toFixed(1)) : 0
    };
  }

  static migratePlayer(p: any): Player {
    let pos: PlayerPosition = "CF";
    const rawPos = String(p.position || "").trim().toUpperCase();
    if (["GK", "GOALKEEPER"].includes(rawPos)) pos = "GK";
    else if (["LB"].includes(rawPos)) pos = "LB";
    else if (["CB"].includes(rawPos) || rawPos.includes("DEF")) pos = "CB";
    else if (["RB"].includes(rawPos)) pos = "RB";
    else if (["FB"].includes(rawPos)) pos = "LB";
    else if (["DM"].includes(rawPos)) pos = "DM";
    else if (["CM"].includes(rawPos) || rawPos.includes("MID")) pos = "CM";
    else if (["AM"].includes(rawPos)) pos = "AM";
    else if (["LW", "WINGER", "W", "LM", "RM"].includes(rawPos)) pos = "LW";
    else if (["RW"].includes(rawPos)) pos = "RW";
    else if (["CF", "ST", "SS"].includes(rawPos) || rawPos.includes("FORW") || rawPos.includes("STRI")) pos = "CF";
    else {
      const match = ["GK", "LB", "CB", "RB", "DM", "CM", "AM", "LW", "RW", "CF"].find(
        (val) => val.toUpperCase() === rawPos
      );
      if (match) pos = match as PlayerPosition;
    }

    let dob = p.dob || "";
    if (!dob) {
      const birthYear = 2026 - (p.age || 24);
      dob = `${birthYear}-01-01`;
    }

    return {
      id: p.id || "",
      name: p.name || "Unknown Player",
      dob,
      joinDate: p.joinDate || "2026-01-01",
      backNumber: p.backNumber || 10,
      position: pos,
      image: p.image || null,
      nationality: p.nationality || null,
      preferredFoot: p.preferredFoot || null,

      totalPasses: Number(p.totalPasses ?? 0),
      successfulPasses: Number(p.successfulPasses ?? 0),
      progressivePasses: Number(p.progressivePasses ?? 0),
      successfulProgressivePasses: Number(p.successfulProgressivePasses ?? 0),
      finalThirdPasses: Number(p.finalThirdPasses ?? 0),
      keyPasses: Number(p.keyPasses ?? 0),
      throughBalls: Number(p.throughBalls ?? 0),
      successfulThroughBalls: Number(p.successfulThroughBalls ?? 0),

      shots: Number(p.shots ?? 0),
      shotsOnTarget: Number(p.shotsOnTarget ?? 0),
      goals: Number(p.goals ?? 0),
      xG: Number(p.xG ?? p.xg ?? 0),

      assists: Number(p.assists ?? 0),
      chancesCreated: Number(p.chancesCreated ?? 0),
      xA: Number(p.xA ?? p.xa ?? 0),

      touches: Number(p.touches ?? 0),
      progressiveCarries: Number(p.progressiveCarries ?? 0),
      progressiveDribbles: Number(p.progressiveDribbles ?? 0),

      aerialDuels: Number(p.aerialDuels ?? 0),
      aerialDuelsWon: Number(p.aerialDuelsWon ?? 0),
      defensiveDuels: Number(p.defensiveDuels ?? 0),
      defensiveDuelsWon: Number(p.defensiveDuelsWon ?? 0),

      tacklesAttempted: Number(p.tacklesAttempted ?? 0),
      tacklesWon: Number(p.tacklesWon ?? 0),
      interceptions: Number(p.interceptions ?? 0),
      clearances: Number(p.clearances ?? 0),
      ballRecoveries: Number(p.ballRecoveries ?? 0),
      possessionRegains: Number(p.possessionRegains ?? 0),

      dribblesAttempted: Number(p.dribblesAttempted ?? 0),
      successfulDribbles: Number(p.successfulDribbles ?? 0),
      crossesAttempted: Number(p.crossesAttempted ?? 0),
      successfulCrosses: Number(p.successfulCrosses ?? 0),
      boxEntries: Number(p.boxEntries ?? 0),

      saveAttempts: Number(p.saveAttempts ?? 0),
      saves: Number(p.saves ?? 0),
      crossClaims: Number(p.crossClaims ?? 0),
      sweeperActions: Number(p.sweeperActions ?? 0),

      minutesPlayed: Number(p.minutesPlayed ?? 0),
      appearances: Number(p.appearances ?? 0),
      cleanSheets: Number(p.cleanSheets ?? 0),

      tacklesSucceeded: Number(p.tacklesWon ?? 0),
      savesAttempted: Number(p.saveAttempts ?? 0),
      savesSucceeded: Number(p.saves ?? 0),
      forwardPasses: Number(p.progressivePasses ?? 0),
      successfulForwardPasses: Number(p.successfulProgressivePasses ?? 0),
      interceptionsAttempted: Number(p.interceptions ?? 0),
      successfulInterceptions: Number(p.interceptions ?? 0),
      progressiveRuns: Number(p.progressiveDribbles ?? 0),
      crosses: Number(p.crossesAttempted ?? 0),
      dribbleAttempts: Number(p.dribblesAttempted ?? 0),
      successfulAerialDuels: Number(p.aerialDuelsWon ?? 0),
      passesIntoFinalThird: Number(p.finalThirdPasses ?? 0),
      opponentsXgWhenOnPitch: Number(p.opponentsXgWhenOnPitch ?? 0),
      errorsLeadingToShot: Number(p.errorsLeadingToShot ?? 0),
      psXgAgainst: Number(p.psXgAgainst ?? 0)
    };
  }

  static zeroPlayerStats(p: Player): Player {
    return {
      ...p,
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
      xG: 0,
      assists: 0,
      chancesCreated: 0,
      xA: 0,
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
      appearances: 0,
      cleanSheets: 0,
      tacklesSucceeded: 0,
      savesAttempted: 0,
      savesSucceeded: 0,
      forwardPasses: 0,
      successfulForwardPasses: 0,
      interceptionsAttempted: 0,
      successfulInterceptions: 0,
      progressiveRuns: 0,
      crosses: 0,
      dribbleAttempts: 0,
      successfulAerialDuels: 0,
      passesIntoFinalThird: 0,
      opponentsXgWhenOnPitch: 0,
      errorsLeadingToShot: 0,
      psXgAgainst: 0
    };
  }

  static resetPlayerStats(p: Player): Player {
    return this.zeroPlayerStats(p);
  }

  static reassignPlayerIds(players: Player[]): Player[] {
    const prefixes = ["GK", "LB", "CB", "RB", "DM", "CM", "AM", "LW", "RW", "CF"];
    const groups: { [prefix: string]: Player[] } = {};
    for (const prefix of prefixes) {
      groups[prefix] = [];
    }

    for (const player of players) {
      const prefix = this.getPositionPrefix(player.position);
      if (!groups[prefix]) {
        groups[prefix] = [];
      }
      groups[prefix].push(player);
    }

    const processedPlayers: Player[] = [];
    for (const prefix of prefixes) {
      const list = groups[prefix] || [];
      list.sort((a, b) => String(a.name).localeCompare(String(b.name), "ko"));
      
      list.forEach((player, index) => {
        const numStr = String(index + 1).padStart(2, "0");
        const newId = `${prefix}${numStr}`;
        processedPlayers.push({
          ...player,
          id: newId
        });
      });
    }

    return processedPlayers.sort((a, b) => {
      const aPrefix = prefixes.find(p => a.id.startsWith(p)) || "";
      const bPrefix = prefixes.find(p => b.id.startsWith(p)) || "";
      const aIndex = prefixes.indexOf(aPrefix);
      const bIndex = prefixes.indexOf(bPrefix);
      if (aIndex !== bIndex) {
        return aIndex - bIndex;
      }
      return a.id.localeCompare(b.id);
    });
  }

  static reassignMatchIds(matches: MatchData[]): MatchData[] {
    const sorted = [...matches].sort((a, b) => a.date.localeCompare(b.date));
    return sorted.map((match, index) => {
      const numStr = String(index + 1).padStart(2, "0");
      return {
        ...match,
        id: `M${numStr}`
      };
    });
  }

  // Matches
  static async getMatches(forceRefresh = false): Promise<MatchData[]> {
    if (!forceRefresh) {
      const cached = this.getCached<MatchData[]>("matches");
      if (cached) return cached;
    }
    try {
      const { data, error } = await supabase.from("matches").select("*");
      if (!error && Array.isArray(data)) {
        if (data.length > 0) {
          const migrated = data.map(m => this.migrateMatch(m));
          const reassigned = this.reassignMatchIds(migrated);
          localStorage.setItem(MATCHES_LS_KEY, JSON.stringify(reassigned));
          return this.setCached("matches", reassigned);
        } else {
          const cached = localStorage.getItem(MATCHES_LS_KEY);
          if (cached) {
            try {
              const parsed = JSON.parse(cached);
              if (Array.isArray(parsed) && parsed.length > 0) {
                const migrated = parsed.map((m: any) => this.migrateMatch(m));
                const reassigned = this.reassignMatchIds(migrated);
                this.saveMatches(reassigned).catch(() => {});
                return this.setCached("matches", reassigned);
              }
            } catch {}
          }
          localStorage.setItem(MATCHES_LS_KEY, JSON.stringify([]));
          return this.setCached("matches", []);
        }
      }
    } catch (e) {
      console.warn("Supabase error getting matches, falling back to LocalStorage:", e);
    }

    const cached = localStorage.getItem(MATCHES_LS_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const migrated = parsed.map((m: any) => this.migrateMatch(m));
          const reassigned = this.reassignMatchIds(migrated);
          // Auto sync local storage matches to Supabase cloud
          this.saveMatches(reassigned).catch(() => {});
          return this.setCached("matches", reassigned);
        }
      } catch {}
    }

    localStorage.setItem(MATCHES_LS_KEY, JSON.stringify([]));
    return this.setCached("matches", []);
  }

  static async saveMatches(matches: MatchData[]): Promise<void> {
    this.invalidateCache("matches");
    const migrated = matches.map(m => this.migrateMatch(m));
    const reassigned = this.reassignMatchIds(migrated);
    localStorage.setItem(MATCHES_LS_KEY, JSON.stringify(reassigned));

    try {
      if (reassigned.length > 0) {
        await supabase.from("matches").upsert(this.sanitizeForSupabase(reassigned));
      }
    } catch (e) {
      console.warn("Supabase save matches failed:", e);
    }
  }

  static async uploadMatches(newMatches: MatchData[]): Promise<{ added: number; ignored: number }> {
    const currentMatches = await this.getMatches();

    let addedCount = 0;
    let ignoredCount = 0;
    const mergedList = [...currentMatches];

    for (const rawMatch of newMatches) {
      const match = this.migrateMatch(rawMatch);
      const isDuplicate = currentMatches.some(m => 
        m.date === match.date && 
        m.opponent.trim().toLowerCase() === match.opponent.trim().toLowerCase() && 
        m.isOpponentTeam === match.isOpponentTeam
      );

      if (isDuplicate) {
        ignoredCount++;
      } else {
        mergedList.push(match);
        addedCount++;
      }
    }

    if (addedCount > 0) {
      const reassignedList = this.reassignMatchIds(mergedList);
      await this.saveMatches(reassignedList);
    }

    return { added: addedCount, ignored: ignoredCount };
  }

  static async processFixtureMatchUpload(fixtureId: string, playerMatchRecords: any[]): Promise<{ ourScore: number; oppScore: number; playersUpdated: number; deleted: number }> {
    const fixtures = await this.getFixtures();
    const fixture = fixtures.find(f => f.id === fixtureId);
    if (!fixture) {
      throw new Error("Target match fixture was not found in the schedule.");
    }

    const customTeams = await this.getCustomTeams();
    const TEAM_ID_MAPPING: Record<string, string> = {
      "ctfc": "Cardiff Town FC"
    };

    customTeams.forEach(t => {
      TEAM_ID_MAPPING[t.id.toLowerCase().trim()] = t.name;
    });

    const isOurTeam = (teamId: string, playerId: string) => {
      const lowerTeam = String(teamId || "").toLowerCase().trim();
      const lowerPlayer = String(playerId || "").toLowerCase().trim();
      if (lowerPlayer.startsWith("op")) {
        return false;
      }
      return lowerTeam === "ctfc" || lowerTeam === "cardiff town fc";
    };

    const oppRowRecord = playerMatchRecords.find(r => {
      const lower = String(r.teamId || "").toLowerCase().trim();
      return lower !== "ctfc" && lower !== "cardiff town fc";
    });
    if (oppRowRecord) {
      const lowerOppTeam = String(oppRowRecord.teamId || "").toLowerCase().trim();
      const mappedName = TEAM_ID_MAPPING[lowerOppTeam];
      if (mappedName) {
        fixture.opponent = mappedName;
      }
    }

    const getTeamNameForRecord = (teamId: string) => {
      const lower = String(teamId || "").toLowerCase().trim();
      if (lower === "ctfc" || lower === "cardiff town fc") return "Cardiff Town FC";
      return TEAM_ID_MAPPING[lower] || teamId;
    };

    let homeRows = playerMatchRecords.filter(r => {
      const name = getTeamNameForRecord(r.teamId);
      return name.toLowerCase() === (fixture.homeTeam || "Cardiff Town FC").toLowerCase();
    });
    let awayRows = playerMatchRecords.filter(r => {
      const name = getTeamNameForRecord(r.teamId);
      return name.toLowerCase() === (fixture.awayTeam || fixture.opponent).toLowerCase();
    });

    if (homeRows.length === 0 || awayRows.length === 0) {
      const uniqueTeamIds = Array.from(new Set(playerMatchRecords.map(r => String(r.teamId).toLowerCase().trim())));
      if (uniqueTeamIds.length >= 2) {
        const id1 = uniqueTeamIds[0];
        const id2 = uniqueTeamIds[1];
        const name1 = getTeamNameForRecord(id1);
        const name2 = getTeamNameForRecord(id2);

        const is1Home = name1.toLowerCase().includes((fixture.homeTeam || "Cardiff Town FC").toLowerCase()) || 
                        (fixture.homeTeam || "Cardiff Town FC").toLowerCase().includes(name1.toLowerCase());
        
        if (is1Home) {
          homeRows = playerMatchRecords.filter(r => String(r.teamId).toLowerCase().trim() === id1);
          awayRows = playerMatchRecords.filter(r => String(r.teamId).toLowerCase().trim() === id2);
        } else {
          homeRows = playerMatchRecords.filter(r => String(r.teamId).toLowerCase().trim() === id2);
          awayRows = playerMatchRecords.filter(r => String(r.teamId).toLowerCase().trim() === id1);
        }
      }
    }

    const homeScore = homeRows.reduce((sum, r) => sum + (Number(r.goals) || 0), 0);
    const awayScore = awayRows.reduce((sum, r) => sum + (Number(r.goals) || 0), 0);

    const ourRows = playerMatchRecords.filter(r => isOurTeam(r.teamId, r.playerId));

    fixture.status = "Played";
    fixture.homeTeam = fixture.homeTeam || "Cardiff Town FC";
    fixture.awayTeam = fixture.awayTeam || fixture.opponent;
    fixture.homeScore = homeScore;
    fixture.awayScore = awayScore;

    if (fixture.homeTeam === "Cardiff Town FC") {
      fixture.ourScore = homeScore;
      fixture.oppScore = awayScore;
    } else if (fixture.awayTeam === "Cardiff Town FC") {
      fixture.ourScore = awayScore;
      fixture.oppScore = homeScore;
    } else {
      fixture.ourScore = 0;
      fixture.oppScore = 0;
    }

    await this.saveFixtures(fixtures);

    const sumProp = (rows: any[], prop: string) => {
      return rows.reduce((sum, r) => sum + (Number(r[prop]) || 0), 0);
    };

    const homePasses = sumProp(homeRows, "totalPasses") || 0;
    const homeSuccPasses = sumProp(homeRows, "successfulPasses") || Math.round(homePasses * 0.75);
    const awayPasses = sumProp(awayRows, "totalPasses") || 0;
    const awaySuccPasses = sumProp(awayRows, "successfulPasses") || Math.round(awayPasses * 0.72);

    const homeTeamName = fixture.homeTeam;
    const awayTeamName = fixture.awayTeam;

    const isHomeOurTeam = homeTeamName === "Cardiff Town FC";

    const ourMatchData: MatchData = {
      id: `M_our_${fixture.id}`,
      fixtureId: fixture.id,
      date: fixture.date,
      competition: fixture.competition,
      opponent: awayTeamName,
      venue: isHomeOurTeam ? "Home" : "Away",
      result: homeScore > awayScore ? `W (${homeScore}-${awayScore})` : homeScore === awayScore ? `D (${homeScore}-${awayScore})` : `L (${homeScore}-${awayScore})`,
      isOpponentTeam: !isHomeOurTeam,
      teamName: homeTeamName,
      goals: homeScore,
      shots: sumProp(homeRows, "shots"),
      shotsOnTarget: sumProp(homeRows, "shotsOnTarget"),
      insideBoxShots: sumProp(homeRows, "insideBoxShots"),
      crossesAttempted: sumProp(homeRows, "crossesAttempted"),
      successfulCrosses: sumProp(homeRows, "successfulCrosses"),
      totalPasses: homePasses,
      successfulPasses: homeSuccPasses,
      progressivePasses: sumProp(homeRows, "progressivePasses"),
      finalThirdPasses: sumProp(homeRows, "finalThirdPasses"),
      boxEntries: sumProp(homeRows, "boxEntries"),
      tacklesAttempted: sumProp(homeRows, "tacklesAttempted"),
      tacklesWon: sumProp(homeRows, "tacklesWon"),
      interceptions: sumProp(homeRows, "interceptions"),
      clearances: sumProp(homeRows, "clearances"),
      ballRecoveries: sumProp(homeRows, "ballRecoveries"),
      counterAttacks: sumProp(homeRows, "counterAttacks"),
      turnovers: sumProp(homeRows, "turnovers"),
      possessionRate: 50,
      longPasses: sumProp(homeRows, "longPasses"),
      corners: sumProp(homeRows, "corners"),
      fouls: sumProp(homeRows, "fouls"),
      yellowCards: sumProp(homeRows, "yellowCards"),
      possessions: 50,
      bigChancesCreated: sumProp(homeRows, "bigChancesCreated")
    };

    const oppMatchData: MatchData = {
      id: `M_opp_${fixture.id}`,
      fixtureId: fixture.id,
      date: fixture.date,
      competition: fixture.competition,
      opponent: homeTeamName,
      venue: isHomeOurTeam ? "Away" : "Home",
      result: awayScore > homeScore ? `W (${awayScore}-${homeScore})` : awayScore === homeScore ? `D (${awayScore}-${homeScore})` : `L (${awayScore}-${homeScore})`,
      isOpponentTeam: true,
      teamName: awayTeamName,
      goals: awayScore,
      shots: sumProp(awayRows, "shots"),
      shotsOnTarget: sumProp(awayRows, "shotsOnTarget"),
      insideBoxShots: sumProp(awayRows, "insideBoxShots"),
      crossesAttempted: sumProp(awayRows, "crossesAttempted"),
      successfulCrosses: sumProp(awayRows, "successfulCrosses"),
      totalPasses: awayPasses,
      successfulPasses: awaySuccPasses,
      progressivePasses: sumProp(awayRows, "progressivePasses"),
      finalThirdPasses: sumProp(awayRows, "finalThirdPasses"),
      boxEntries: sumProp(awayRows, "boxEntries"),
      tacklesAttempted: sumProp(awayRows, "tacklesAttempted"),
      tacklesWon: sumProp(awayRows, "tacklesWon"),
      interceptions: sumProp(awayRows, "interceptions"),
      clearances: sumProp(awayRows, "clearances"),
      ballRecoveries: sumProp(awayRows, "ballRecoveries"),
      counterAttacks: sumProp(awayRows, "counterAttacks"),
      turnovers: sumProp(awayRows, "turnovers"),
      possessionRate: 50,
      longPasses: sumProp(awayRows, "longPasses"),
      corners: sumProp(awayRows, "corners"),
      fouls: sumProp(awayRows, "fouls"),
      yellowCards: sumProp(awayRows, "yellowCards"),
      possessions: 50,
      bigChancesCreated: sumProp(awayRows, "bigChancesCreated")
    };

    const currentMatches = await this.getMatches();
    const updatedMatches = currentMatches.filter(m => m.fixtureId !== fixtureId);
    updatedMatches.push(ourMatchData, oppMatchData);
    await this.saveMatches(updatedMatches);

    // FULL SYNC PURGE & UPSERT LOGIC FOR SUPABASE PLAYER MATCH RECORDS
    let deletedCount = 0;
    const uploadedPlayerIds = new Set(playerMatchRecords.map(r => String(r.playerId || r.player_id || r.id).toLowerCase().trim()));

    try {
      const { data: dbRecords } = await supabase.from("player_match_records").select("*").eq("match_id", fixtureId);
      const recordsList: any[] = dbRecords || [];
      if (recordsList.length > 0) {
        const staleRecords = recordsList.filter(r => !uploadedPlayerIds.has(String(r.player_id || r.playerId || r.id).toLowerCase().trim()));
        const stalePlayerIds = staleRecords.map(r => r.player_id || r.playerId || r.id).filter(Boolean);

        if (stalePlayerIds.length > 0) {
          await supabase.from("player_match_records").delete().eq("match_id", fixtureId).in("player_id", stalePlayerIds);
          deletedCount = stalePlayerIds.length;
        }
      }

      // Upsert active player match records into Supabase
      for (const rec of playerMatchRecords) {
        await supabase.from("player_match_records").upsert(this.sanitizeForSupabase({
          ...rec,
          match_id: fixtureId,
          matchId: fixtureId,
          date: fixture.date
        }));
      }
    } catch (e) {
      console.warn("Supabase full sync player match records warning:", e);
    }

    const existingRecords = await this.getPlayerMatchRecords();
    const filteredRecords = existingRecords.filter(r => r.matchId !== fixtureId);

    const updatedNewRecords = playerMatchRecords.map(r => ({
      ...r,
      matchId: fixtureId,
      date: fixture.date
    }));

    const allRecords = [...filteredRecords, ...updatedNewRecords];
    await this.savePlayerMatchRecords(allRecords);

    await this.syncCumulativeStats();

    return {
      ourScore: fixture.ourScore || 0,
      oppScore: fixture.oppScore || 0,
      playersUpdated: ourRows.length,
      deleted: deletedCount
    };
  }

  // Players
  static async getPlayers(forceRefresh = false): Promise<Player[]> {
    if (!forceRefresh) {
      const cached = this.getCached<Player[]>("players");
      if (cached) return cached;
    }
    try {
      const playerMap = new Map<string, Player>();

      // 1. Query profiles table (primary source of truth)
      const { data: profData, error: profError } = await (supabase.from("profiles") as any).select("*");
      if (!profError && Array.isArray(profData)) {
        profData.forEach((pr: any) => {
          // Exclude Staff accounts (Admin, Analyst, Coach, Manager) from player roster
          const roleStr = (pr.role || "").toString().trim().toLowerCase();
          const isStaff = roleStr === "admin" || roleStr === "analyst" || roleStr === "coach" || roleStr === "manager" || roleStr === "head coach" || roleStr === "tactical analyst" || pr.is_admin || (roleStr !== "player" && roleStr !== "");
          if (isStaff) {
            return;
          }
          const name = pr.full_name || pr.username || "";
          if (name) {
            const id = pr.player_id || pr.id || pr.username || `CTFC_${name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
            const joinDate = pr.created_at ? new Date(pr.created_at).toLocaleDateString("en-GB", {
              year: "numeric",
              month: "short",
              day: "numeric"
            }) : "-";
            playerMap.set(id, this.migratePlayer({
              id,
              name,
              position: pr.position || "CM",
              preferredFoot: pr.preferred_foot || "Right",
              nationality: pr.nationality || "Wales",
              division: pr.role || "CCFL First",
              joinDate,
              playerId: pr.player_id || id
            }));
          }
        });
      }

      // 2. Query players table for any additional player stats
      const { data: pData, error: pError } = await supabase.from("players").select("*");
      if (!pError && Array.isArray(pData)) {
        pData.forEach((p: any) => {
          const migrated = this.migratePlayer(p);
          if (migrated && migrated.name) {
            if (!playerMap.has(migrated.id)) {
              playerMap.set(migrated.id, migrated);
            } else {
              const existing = playerMap.get(migrated.id)!;
              playerMap.set(migrated.id, { ...migrated, ...existing });
            }
          }
        });
      }

      if (playerMap.size > 0) {
        const reassigned = this.reassignPlayerIds(Array.from(playerMap.values()));
        localStorage.setItem(PLAYERS_LS_KEY, JSON.stringify(reassigned));
        return this.setCached("players", reassigned);
      } else {
        localStorage.setItem(PLAYERS_LS_KEY, JSON.stringify([]));
        return this.setCached("players", []);
      }
    } catch (e) {
      console.warn("Supabase error getting players:", e);
    }

    localStorage.setItem(PLAYERS_LS_KEY, JSON.stringify([]));
    return this.setCached("players", []);
  }

  static async savePlayers(players: Player[]): Promise<void> {
    this.invalidateCache("players");
    const migrated = players.map(p => this.migratePlayer(p));
    const reassigned = this.reassignPlayerIds(migrated);
    localStorage.setItem(PLAYERS_LS_KEY, JSON.stringify(reassigned));

    try {
      if (reassigned.length > 0) {
        const sanitizedPlayers = reassigned.map(p => this.sanitizeForSupabase(p));
        const { error: pErr } = await (supabase.from("players") as any).upsert(sanitizedPlayers);
        if (pErr) console.warn("Supabase savePlayers players error:", pErr);

        const profilesPayload = reassigned.map(player => ({
          id: player.id,
          full_name: player.name,
          username: player.id || player.name.toLowerCase().replace(/[^a-z0-9]/g, "_"),
          position: player.position,
          preferred_foot: player.preferredFoot || "Right",
          nationality: player.nationality || "Wales",
          role: player.division || "CCFL First",
          status: "Active",
          created_at: new Date().toISOString()
        }));

        const { error: profErr } = await (supabase.from("profiles") as any).upsert(profilesPayload, { onConflict: "username" });
        if (profErr) {
          await (supabase.from("profiles") as any).upsert(profilesPayload);
        }
      }
    } catch (e) {
      console.warn("Supabase save players failed:", e);
    }
  }

  static async savePlayer(player: Player): Promise<void> {
    const players = await this.getPlayers();
    const idx = players.findIndex(p => p.id === player.id);
    if (idx >= 0) {
      players[idx] = player;
    } else {
      players.push(player);
    }
    await this.savePlayers(players);
  }

  static async deletePlayer(id: string): Promise<void> {
    const players = await this.getPlayers();
    const filtered = players.filter(p => p.id !== id);
    await this.savePlayers(filtered);

    try {
      await supabase.from("players").delete().eq("id", id);
    } catch (e) {
      console.warn("Supabase error deleting player:", e);
    }
  }

  static async uploadPlayers(newPlayers: Player[], options?: { teamName?: string; teamId?: string }): Promise<{ added: number; updated: number; deleted: number }> {
    const migratedNew = newPlayers.map(p => this.migratePlayer(p));
    const uploadedPlayerIds = new Set(migratedNew.map(p => (p.id || p.name.toLowerCase().replace(/[^a-z0-9]/g, "_")).toLowerCase().trim()));
    const uploadedPlayerNames = new Set(migratedNew.map(p => p.name.toLowerCase().trim()));
    const uploadedDivisions = new Set(migratedNew.map(p => p.division || "CCFL First"));

    let addedCount = 0;
    let updatedCount = 0;
    let deletedCount = 0;

    // 1. FULL SYNC PURGE & UPSERT LOGIC FOR SUPABASE
    try {
      const { data: dbPlayers } = await supabase.from("players").select("*");
      const playersList: any[] = dbPlayers || [];
      if (playersList.length > 0) {
        // Find stale players in the uploaded divisions missing from spreadsheet
        const stalePlayers = playersList.filter(p => {
          const pDiv = p.division || "CCFL First";
          if (uploadedDivisions.size > 0 && !uploadedDivisions.has(pDiv)) return false;
          const pIdStr = String(p.id || "").toLowerCase().trim();
          const pNameStr = String(p.name || "").toLowerCase().trim();
          return !uploadedPlayerIds.has(pIdStr) && !uploadedPlayerNames.has(pNameStr);
        });

        const staleIds = stalePlayers.map(p => p.id).filter(Boolean);
        if (staleIds.length > 0) {
          await supabase.from("players").delete().in("id", staleIds);
          try {
            await (supabase.from("profiles") as any).delete().in("id", staleIds);
          } catch {}
          deletedCount = staleIds.length;
        }
      }

      // 2. Perform SINGLE BULK UPSERT into `players` and `profiles` tables
      if (migratedNew.length > 0) {
        const sanitizedPlayers = migratedNew.map(player => this.sanitizeForSupabase(player));
        const { error: pErr } = await (supabase.from("players") as any).upsert(sanitizedPlayers);
        if (pErr) {
          console.error("Bulk Player Upsert Error:", pErr);
        }

        const profilesPayload = migratedNew.map(player => {
          const profileId = player.id || `p_${player.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
          return {
            id: profileId,
            full_name: player.name,
            username: player.id || player.name.toLowerCase().replace(/[^a-z0-9]/g, "_"),
            position: player.position,
            preferred_foot: player.preferredFoot || "Right",
            nationality: player.nationality || "Wales",
            role: player.division || "CCFL First",
            status: "Active",
            created_at: new Date().toISOString()
          };
        });

        const { error: profErr } = await (supabase.from("profiles") as any).upsert(profilesPayload, { onConflict: "username" });
        if (profErr) {
          await (supabase.from("profiles") as any).upsert(profilesPayload);
        }
      }

      // Upsert teams if payload present
      if (options?.teamName) {
        try {
          const tPayload = {
            id: options.teamId || options.teamName.toLowerCase().replace(/[^a-z0-9]/g, "_"),
            team_name: options.teamName,
            division: newPlayers[0]?.division || "CCFL First",
            created_at: new Date().toISOString()
          };
          const { error } = await (supabase.from("teams") as any).upsert(tPayload, { onConflict: "team_name" });
          if (error) {
            await (supabase.from("teams") as any).upsert(tPayload);
          }
        } catch (e) {
          console.warn("Supabase team upsert warning:", e);
        }
      }
    } catch (e) {
      console.warn("Supabase full sync roster warning:", e);
    }

    // 3. Local storage state sync (purge stale in uploaded divisions & upsert active)
    const currentPlayers = await this.getPlayers();
    const currentFiltered = currentPlayers.filter(p => {
      const pDiv = p.division || "CCFL First";
      if (!uploadedDivisions.has(pDiv)) return true; // keep players in un-uploaded divisions
      const pIdStr = String(p.id || "").toLowerCase().trim();
      const pNameStr = String(p.name || "").toLowerCase().trim();
      return uploadedPlayerIds.has(pIdStr) || uploadedPlayerNames.has(pNameStr);
    });

    for (const p of migratedNew) {
      const existingIdx = currentFiltered.findIndex(cp => 
        cp.name.trim().toLowerCase() === p.name.trim().toLowerCase() ||
        (cp.id && p.id && cp.id.toLowerCase() === p.id.toLowerCase())
      );

      if (existingIdx >= 0) {
        currentFiltered[existingIdx] = { ...currentFiltered[existingIdx], ...p };
        updatedCount++;
      } else {
        currentFiltered.push(p);
        addedCount++;
      }
    }

    const reassignedList = this.reassignPlayerIds(currentFiltered);
    await this.savePlayers(reassignedList);

    return { added: addedCount, updated: updatedCount, deleted: deletedCount };
  }

  // Bulk register teams into Supabase `teams` table with strict Full Sync (upsert + purge stale)
  static async registerBulkTeams(teams: any[]): Promise<{ added: number; updated: number; deleted: number; error?: string }> {
    let supabaseSuccess = false;
    let supabaseErrorMsg = "";
    let deletedCount = 0;

    const payload = teams.map(t => {
      const generatedUuid = crypto.randomUUID();
      let tId = t.id || t.team_id;
      let shortName = t.short_name || t.shortCode || "";

      if (!tId) {
        tId = generatedUuid;
      } else if (!shortName && tId.length <= 8 && !tId.includes('-')) {
        shortName = tId;
        tId = generatedUuid;
      }

      return {
        id: tId,
        team_name: t.team_name,
        division: t.division || t.league || "Premier Division",
        home_venue: t.home_venue || t.homeVenue || "",
        short_name: shortName,
        created_at: new Date().toISOString()
      };
    });

    const uploadedIds = new Set(payload.map(p => p.id.toLowerCase().trim()));
    const uploadedNames = new Set(payload.map(p => p.team_name.toLowerCase().trim()));

    try {
      // 1. Identify and purge stale teams missing from the uploaded spreadsheet
      const { data: dbTeams } = await (supabase.from("teams") as any).select("*");
      if (Array.isArray(dbTeams) && dbTeams.length > 0) {
        const staleTeams = dbTeams.filter(t => 
          !uploadedIds.has(String(t.id || "").toLowerCase().trim()) &&
          !uploadedNames.has(String(t.team_name || "").toLowerCase().trim())
        );
        const staleIds = staleTeams.map(t => t.id).filter(Boolean);

        if (staleIds.length > 0) {
          const { error: delError } = await (supabase.from("teams") as any).delete().in("id", staleIds);
          if (!delError) {
            deletedCount = staleIds.length;
          } else {
            console.warn("Supabase stale teams delete warning:", delError);
          }
        }
      }

      // 2. Upsert active/new teams from spreadsheet
      const { error } = await (supabase.from("teams") as any).upsert(payload, { onConflict: "team_name" });
      if (!error) {
        supabaseSuccess = true;
      } else {
        const { error: fallbackError } = await (supabase.from("teams") as any).upsert(payload);
        if (!fallbackError) {
          supabaseSuccess = true;
        } else {
          supabaseErrorMsg = error.message;
          console.warn("Supabase team registration upsert warning:", error);
        }
      }
    } catch (e: any) {
      supabaseErrorMsg = e?.message || String(e);
      console.warn("Supabase team registration exception:", e);
    }

    // 3. Local custom teams state sync (1:1 mirror)
    const currentCustomTeams = await this.getCustomTeams();
    let addedCount = 0;
    let updatedCount = 0;

    const newCustomTeamsList: CustomTeam[] = [];

    for (const t of teams) {
      const tId = t.id || t.team_id || (t.team_name || "").toLowerCase().replace(/[^a-z0-9]/g, "_");
      const existing = currentCustomTeams.find(ct => 
        ct.name.toLowerCase() === (t.team_name || "").toLowerCase() || ct.id === tId
      );

      const customObj: CustomTeam = {
        id: tId,
        name: t.team_name,
        league: t.division,
        homeVenue: t.home_venue || t.homeVenue,
        shortCode: t.short_code || t.shortCode,
        mp: existing?.mp || 0,
        w: existing?.w || 0,
        d: existing?.d || 0,
        l: existing?.l || 0,
        gf: existing?.gf || 0,
        ga: existing?.ga || 0
      };

      if (existing) {
        updatedCount++;
      } else {
        addedCount++;
      }
      newCustomTeamsList.push(customObj);
    }

    await this.saveCustomTeams(newCustomTeamsList);

    return { added: addedCount, updated: updatedCount, deleted: deletedCount, error: supabaseSuccess ? undefined : (supabaseErrorMsg || undefined) };
  }

  static async getProfiles(forceRefresh = false): Promise<any[]> {
    if (!forceRefresh) {
      const cached = this.getCached<any[]>("profiles");
      if (cached) return cached;
    }
    try {
      const { data, error } = await supabase.from("profiles").select("*");
      if (!error && Array.isArray(data)) {
        localStorage.setItem("team_perf_analyzer_profiles", JSON.stringify(data));
        return this.setCached("profiles", data);
      }
    } catch (e) {
      console.warn("Supabase error getting profiles:", e);
    }

    localStorage.setItem("team_perf_analyzer_profiles", JSON.stringify([]));
    return this.setCached("profiles", []);
  }

  static async syncAllLocalToSupabase(): Promise<{
    matchesSynced: number;
    playersSynced: number;
    fixturesSynced: number;
    usersSynced: number;
    teamsSynced: number;
    recordsSynced: number;
    heatmapsSynced: number;
  }> {
    let matchesSynced = 0;
    let playersSynced = 0;
    let fixturesSynced = 0;
    let usersSynced = 0;
    let teamsSynced = 0;
    let recordsSynced = 0;
    let heatmapsSynced = 0;

    // Clear memory cache so fresh data is pushed
    this.invalidateCache();

    // 1. Sync Matches
    try {
      const matchesLS = localStorage.getItem(MATCHES_LS_KEY);
      if (matchesLS) {
        const matches: MatchData[] = JSON.parse(matchesLS);
        if (matches.length > 0) {
          await supabase.from("matches").upsert(this.sanitizeForSupabase(matches));
          matchesSynced = matches.length;
        }
      }
    } catch (e) {
      console.warn("Sync matches error:", e);
    }

    // 2. Sync Players
    try {
      const playersLS = localStorage.getItem(PLAYERS_LS_KEY);
      if (playersLS) {
        const players: Player[] = JSON.parse(playersLS);
        if (players.length > 0) {
          await supabase.from("players").upsert(this.sanitizeForSupabase(players));
          playersSynced = players.length;
        }
      }
    } catch (e) {
      console.warn("Sync players error:", e);
    }

    // 3. Sync Fixtures
    try {
      const fixturesLS = localStorage.getItem(FIXTURES_LS_KEY);
      if (fixturesLS) {
        const fixtures: MatchFixture[] = JSON.parse(fixturesLS);
        if (fixtures.length > 0) {
          await supabase.from("fixtures").upsert(this.sanitizeForSupabase(fixtures));
          fixturesSynced = fixtures.length;
        }
      }
    } catch (e) {
      console.warn("Sync fixtures error:", e);
    }

    // 4. Sync Users & Profiles
    try {
      await this.syncLocalUsersToSupabase();
      const usersLS = localStorage.getItem(USERS_LS_KEY);
      if (usersLS) {
        const users = JSON.parse(usersLS);
        usersSynced = Array.isArray(users) ? users.length : 0;
      }
    } catch (e) {
      console.warn("Sync users error:", e);
    }

    // 5. Sync Teams
    try {
      const teamsLS = localStorage.getItem("team_perf_analyzer_custom_teams");
      if (teamsLS) {
        const teams: CustomTeam[] = JSON.parse(teamsLS);
        if (teams.length > 0) {
          const payload = teams.map(t => ({
            id: t.id || t.name.toLowerCase().replace(/[^a-z0-9]/g, "_"),
            team_name: t.name,
            division: t.league || "CCFL Premier",
            home_venue: t.homeVenue || "",
            short_name: t.shortCode || "",
            created_at: new Date().toISOString()
          }));
          const { error } = await (supabase.from("teams") as any).upsert(payload, { onConflict: "team_name" });
          if (error) {
            await (supabase.from("teams") as any).upsert(payload);
          }
          teamsSynced = teams.length;
        }
      }
    } catch (e) {
      console.warn("Sync teams error:", e);
    }

    // 6. Sync Player Match Records
    try {
      const recsLS = localStorage.getItem("team_perf_analyzer_player_match_records");
      if (recsLS) {
        const records: any[] = JSON.parse(recsLS);
        if (records.length > 0) {
          await supabase.from("player_match_records").upsert(this.sanitizeForSupabase(records));
          recordsSynced = records.length;
        }
      }
    } catch (e) {
      console.warn("Sync records error:", e);
    }

    // 7. Sync Heatmap Points
    try {
      const heatLS = localStorage.getItem("team_perf_analyzer_heatmaps");
      if (heatLS) {
        const points: HeatmapPoint[] = JSON.parse(heatLS);
        if (points.length > 0) {
          await (supabase.from("heatmaps") as any).upsert(this.sanitizeForSupabase(points));
          heatmapsSynced = points.length;
        }
      }
    } catch (e) {
      console.warn("Sync heatmaps error:", e);
    }

    // Force refresh cache
    this.invalidateCache();

    return {
      matchesSynced,
      playersSynced,
      fixturesSynced,
      usersSynced,
      teamsSynced,
      recordsSynced,
      heatmapsSynced
    };
  }

  static async syncWebsiteTeamsAndProfiles(): Promise<void> {
    try {
      // 1. Sync Roster Players to Supabase `profiles` table in a single batch
      const players = await this.getPlayers();
      if (players && players.length > 0) {
        const payload = players.map(p => ({
          id: p.id,
          user_id: p.id,
          player_id: p.id || `PLR-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
          full_name: p.name,
          username: p.id || p.name.toLowerCase().replace(/[^a-z0-9]/g, "_"),
          position: p.position,
          preferred_foot: p.preferredFoot || "Right",
          nationality: p.nationality || "Wales",
          role: p.division || "CCFL First",
          status: "Active",
          created_at: new Date().toISOString()
        }));
        await (supabase.from("profiles") as any).upsert(payload);
      }

      // 2. Sync Local Storage cached members to Supabase profiles table
      await this.syncLocalUsersToSupabase();
    } catch (e) {
      console.warn("Error running syncWebsiteTeamsAndProfiles:", e);
    }
  }

  static async syncLocalUsersToSupabase(): Promise<void> {
    // Ground truth is the Supabase `profiles` table.
    // Do NOT auto re-insert deleted or default test accounts into Supabase.
    return;
  }

  // Fixtures
  static async getFixtures(forceRefresh = false): Promise<MatchFixture[]> {
    if (!forceRefresh) {
      const cached = this.getCached<MatchFixture[]>("fixtures");
      if (cached) return cached;
    }
    try {
      const { data, error } = await supabase.from("fixtures").select("*");
      if (!error && Array.isArray(data)) {
        const mapped: MatchFixture[] = data.map((r: any) => {
          const fDate = r.date || r.match_date || "";
          const opp = r.opponent || r.opponent_name || (r.home_team === "Cardiff Town FC" ? r.away_team : r.home_team) || "Opponent";
          const venue = (r.venue || (r.home_team === "Cardiff Town FC" ? "Home" : "Away")) as "Home" | "Away";
          const homeTeam = r.homeTeam || r.home_team || (venue === "Home" ? "Cardiff Town FC" : opp);
          const awayTeam = r.awayTeam || r.away_team || (venue === "Away" ? "Cardiff Town FC" : opp);

          return {
            id: r.id,
            date: fDate,
            opponent: opp,
            competition: r.competition || "League",
            venue,
            division: r.division || r.league || undefined,
            status: (r.status as any) || "Upcoming",
            homeTeam,
            awayTeam,
            homeScore: r.home_score !== undefined ? r.home_score : r.homeScore,
            awayScore: r.away_score !== undefined ? r.away_score : r.awayScore,
            ourScore: r.ourScore !== undefined ? r.ourScore : r.our_score,
            oppScore: r.oppScore !== undefined ? r.oppScore : r.opp_score,
          };
        });

        localStorage.setItem(FIXTURES_LS_KEY, JSON.stringify(mapped));
        return this.setCached("fixtures", mapped);
      }
    } catch (e) {
      console.warn("Supabase error getting fixtures:", e);
    }

    localStorage.setItem(FIXTURES_LS_KEY, JSON.stringify([]));
    return this.setCached("fixtures", []);
  }

  static async saveFixtures(fixtures: MatchFixture[]): Promise<void> {
    this.invalidateCache("fixtures");
    localStorage.setItem(FIXTURES_LS_KEY, JSON.stringify(fixtures));

    if (fixtures.length === 0) return;

    const payload = fixtures.map(f => {
      const item: any = {
        date: f.date,
        match_date: f.date,
        opponent: f.opponent,
        opponent_name: f.opponent,
        venue: f.venue,
        kick_off_time: (f as any).kick_off_time || (f as any).kickOffTime || "15:00",
        competition: f.competition,
        division: f.division || undefined,
        status: f.status || "Upcoming",
        home_team: f.homeTeam || (f.venue === "Home" ? "Cardiff Town FC" : f.opponent),
        away_team: f.awayTeam || (f.venue === "Away" ? "Cardiff Town FC" : f.opponent),
        homeTeam: f.homeTeam || (f.venue === "Home" ? "Cardiff Town FC" : f.opponent),
        awayTeam: f.awayTeam || (f.venue === "Away" ? "Cardiff Town FC" : f.opponent),
        home_score: f.homeScore,
        away_score: f.awayScore,
        ourScore: f.ourScore,
        oppScore: f.oppScore,
      };

      if (f.id && !f.id.startsWith("fixture_")) {
        item.id = f.id;
      }

      return item;
    });

    const { error } = await (supabase.from("fixtures") as any).upsert(payload, { onConflict: "id" });
    if (error) {
      console.error("Supabase error saving fixtures:", error);
      throw new Error(`Failed to save fixture into database: ${error.message || JSON.stringify(error)}`);
    }
  }

  // Player Match Records
  static async getPlayerMatchRecords(forceRefresh = false): Promise<any[]> {
    if (!forceRefresh) {
      const cached = this.getCached<any[]>("playerMatchRecords");
      if (cached) return cached;
    }
    try {
      const recordMap = new Map<string, any>();

      // 1. Query player_match_records
      const { data, error } = await supabase.from("player_match_records").select("*");
      if (!error && Array.isArray(data)) {
        data.forEach((r: any) => {
          if (r.id || r.match_id || r.matchId) {
            const key = r.id || `${r.match_id || r.matchId}_${r.player_id || r.playerId || r.player_name || r.playerName}`;
            recordMap.set(key, r);
          }
        });
      }

      // 2. Query match_logs table
      const { data: mlData, error: mlError } = await (supabase.from("match_logs") as any).select("*");
      if (!mlError && Array.isArray(mlData)) {
        mlData.forEach((r: any) => {
          const key = r.id || `${r.match_id}_${r.player_id || r.player_name}`;
          if (!recordMap.has(key)) {
            recordMap.set(key, {
              id: key,
              matchId: r.match_id,
              playerId: r.player_id,
              playerName: r.player_name,
              position: r.position || "CM",
              minutesPlayed: r.minutes_played || 90,
              goals: r.goals || 0,
              shots: r.shots || 0,
              totalPasses: r.total_passes || 0,
              completedPasses: r.completed_passes || 0,
              tackles: r.tackles || 0,
              interceptions: r.interceptions || 0
            });
          }
        });
      }

      if (recordMap.size > 0) {
        const records = Array.from(recordMap.values());
        localStorage.setItem("team_perf_analyzer_player_match_records", JSON.stringify(records));
        return this.setCached("playerMatchRecords", records);
      }
    } catch (e) {
      console.warn("Supabase error getting player match records, falling back to LocalStorage:", e);
    }

    const cached = localStorage.getItem("team_perf_analyzer_player_match_records");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.savePlayerMatchRecords(parsed).catch(() => {});
          return this.setCached("playerMatchRecords", parsed);
        }
      } catch {}
    }
    return this.setCached("playerMatchRecords", []);
  }

  static async savePlayerMatchRecords(records: any[]): Promise<void> {
    this.invalidateCache("playerMatchRecords");
    localStorage.setItem("team_perf_analyzer_player_match_records", JSON.stringify(records));

    try {
      if (records.length > 0) {
        await supabase.from("player_match_records").upsert(this.sanitizeForSupabase(records));

        const matchLogsPayload = records.map(r => {
          const matchId = r.matchId || r.match_id || "M01";
          const playerName = r.playerName || r.player_name || "";
          const playerId = r.playerId || r.player_id || "";
          const recId = r.id || `${matchId}_${playerId || playerName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
          return {
            id: recId,
            match_id: matchId,
            player_id: playerId,
            player_name: playerName,
            position: r.position || "CM",
            minutes_played: r.minutesPlayed || r.minutes_played || 90,
            goals: r.goals || 0,
            shots: r.shots || 0,
            total_passes: r.totalPasses || r.total_passes || 0,
            completed_passes: r.completedPasses || r.completed_passes || 0,
            tackles: r.tackles || 0,
            interceptions: r.interceptions || 0,
            created_at: new Date().toISOString()
          };
        });

        const { error: mlErr } = await (supabase.from("match_logs") as any).upsert(matchLogsPayload, { onConflict: "id" });
        if (mlErr) {
          await (supabase.from("match_logs") as any).upsert(matchLogsPayload);
        }
      }
    } catch (e) {
      console.warn("Supabase save player match records failed:", e);
    }
  }

  // Users & Auth
  static isKeriLovellUser(u: any): boolean {
    if (!u) return false;
    const fName = String(u.firstName || "").trim().toLowerCase();
    const lName = String(u.lastName || "").trim().toLowerCase();
    const username = String(u.username || "").trim().toLowerCase();
    return (fName === "keri" && lName === "lovell") || username === "kerilovell" || username === "keri";
  }

  static async getUsers(forceRefresh = false): Promise<(UserProfile & { passwordHash?: string })[]> {
    const cachedUsersStr = localStorage.getItem(USERS_LS_KEY);
    let localUsersMap: Map<string, string> = new Map();
    if (cachedUsersStr) {
      try {
        const parsed = JSON.parse(cachedUsersStr);
        if (Array.isArray(parsed)) {
          parsed.forEach((u: any) => {
            if (u.username && (u.passwordHash || u.password)) {
              localUsersMap.set(u.username.toLowerCase(), u.passwordHash || u.password);
            }
          });
        }
      } catch {}
    }

    if (!forceRefresh) {
      const cached = this.getCached<(UserProfile & { passwordHash?: string })[]>("users");
      if (cached) return cached;
    }
    try {
      const { data: profData, error } = await supabase.from("profiles").select("*");
      let sbUsers: (UserProfile & { passwordHash?: string })[] = [];

      if (!error && Array.isArray(profData) && profData.length > 0) {
        for (const p of profData as any[]) {
          const pUsername = (p.username || "").toLowerCase();
          if (pUsername) {
            const nameParts = (p.full_name || pUsername).split(" ");
            const fName = nameParts[0] || "";
            const lName = nameParts.slice(1).join(" ") || "";
            const existingPw = localUsersMap.get(pUsername) || p.passwordHash || p.password;

            sbUsers.push({
              id: p.id || p.user_id || `usr_${pUsername}`,
              user_id: p.user_id || p.id,
              player_id: p.player_id,
              playerId: p.player_id,
              username: p.username || pUsername,
              role: (p.role as UserRole) || UserRole.Player,
              isAdmin: p.role === "Admin" || p.role === UserRole.HeadCoach,
              createdAt: p.created_at || new Date().toISOString(),
              firstName: fName,
              lastName: lName,
              position: p.position || "CM",
              preferredFoot: p.preferred_foot || "Right",
              preferred_foot: p.preferred_foot || "Right",
              isOnboarded: !!p.is_onboarded,
              is_onboarded: !!p.is_onboarded,
              passwordHash: existingPw,
              approved: p.status !== "Pending" && p.status !== "pending"
            });
          }
        }
      }

      if (sbUsers.length > 0) {
        sbUsers = sbUsers.filter(u => !this.isKeriLovellUser(u));

        if (!sbUsers.some(u => u.username === DEFAULT_ADMIN.username)) {
          sbUsers.push(DEFAULT_ADMIN);
          try {
            await (supabase.from("profiles") as any).upsert({
              full_name: `${DEFAULT_ADMIN.firstName} ${DEFAULT_ADMIN.lastName}`.trim(),
              username: DEFAULT_ADMIN.username,
              role: DEFAULT_ADMIN.role || "Admin",
              position: "CM",
              status: "Approved"
            }, { onConflict: "username" });
          } catch {}
        }
        localStorage.setItem(USERS_LS_KEY, JSON.stringify(sbUsers));
        return this.setCached("users", sbUsers);
      }
    } catch (e) {
      console.warn("Supabase error getting profiles, falling back to LocalStorage:", e);
    }

    const cached = localStorage.getItem(USERS_LS_KEY);
    if (cached) {
      try {
        let parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          parsed = parsed.filter((u: any) => !this.isKeriLovellUser(u));
          if (!parsed.some((u: any) => u.username === DEFAULT_ADMIN.username)) {
            parsed.push(DEFAULT_ADMIN);
          }
          return this.setCached("users", parsed);
        }
      } catch {}
    }

    const defaults = [DEFAULT_ADMIN];
    localStorage.setItem(USERS_LS_KEY, JSON.stringify(defaults));
    return this.setCached("users", defaults);
  }

  static async getUsersCloudOnly(): Promise<(UserProfile & { passwordHash?: string })[]> {
    const { data, error } = await supabase.from("profiles").select("*");
    if (error) throw error;
    return ((data || []) as any[]).map(p => {
      const pUsername = p.username || "";
      const nameParts = (p.full_name || pUsername).split(" ");
      return {
        id: p.id || p.user_id || `usr_${pUsername}`,
        username: pUsername,
        role: (p.role as UserRole) || UserRole.Player,
        isAdmin: p.role === "Admin" || p.role === UserRole.HeadCoach,
        createdAt: p.created_at || new Date().toISOString(),
        firstName: nameParts[0] || "",
        lastName: nameParts.slice(1).join(" ") || "",
        approved: p.status !== "Pending" && p.status !== "pending"
      };
    });
  }

  static getUsersLocalOnly(): (UserProfile & { passwordHash?: string })[] {
    const cached = localStorage.getItem(USERS_LS_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return [DEFAULT_ADMIN];
  }

  static async forceSyncUsersWithCloud(): Promise<(UserProfile & { passwordHash?: string })[]> {
    const sbUsers = await this.getUsersCloudOnly();
    if (!sbUsers.some(u => u.username === DEFAULT_ADMIN.username)) {
      sbUsers.push(DEFAULT_ADMIN);
      try {
        await (supabase.from("profiles") as any).upsert({
          full_name: `${DEFAULT_ADMIN.firstName} ${DEFAULT_ADMIN.lastName}`.trim(),
          username: DEFAULT_ADMIN.username,
          role: DEFAULT_ADMIN.role || "Admin",
          position: "CM",
          status: "Approved"
        }, { onConflict: "username" });
      } catch {}
    }
    localStorage.setItem(USERS_LS_KEY, JSON.stringify(sbUsers));
    return sbUsers;
  }

  static async saveUsers(users: (UserProfile & { passwordHash?: string })[]): Promise<void> {
    localStorage.setItem(USERS_LS_KEY, JSON.stringify(users));

    for (const u of users) {
      try {
        const fullName = (u as any).full_name || (u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : u.username);
        await (supabase.from("profiles") as any).upsert({
          full_name: fullName,
          username: u.username,
          role: u.role || "Player",
          position: (u as any).position || "CM",
          status: u.approved === false ? "Pending" : "Approved"
        }, { onConflict: "username" });
      } catch (e) {
        console.warn(`Supabase save profile failed for ${u.id}:`, e);
      }
    }
  }

  static async updateUserPermission(uid: string, fields: Partial<UserProfile>): Promise<void> {
    const list = await this.getUsers();
    const updated = list.map(u => u.id === uid ? { ...u, ...fields } : u);
    await this.saveUsers(updated);

    const currentUser = this.getCurrentUser();
    if (currentUser && currentUser.id === uid) {
      const updatedUser = { ...currentUser, ...fields };
      localStorage.setItem(CURRENT_USER_LS_KEY, JSON.stringify(updatedUser));
    }
  }

  static getCurrentUser(): UserProfile | null {
    const cached = localStorage.getItem(CURRENT_USER_LS_KEY);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {}
    }
    return null;
  }

  static logout(): void {
    localStorage.removeItem(CURRENT_USER_LS_KEY);
  }

  static async login(username: string, passwordPlain: string): Promise<UserProfile> {
    const cleanUsername = (username || "").trim().toLowerCase();
    if (!cleanUsername) {
      throw new Error("Please enter a username.");
    }

    // 1. Master Admin bypass
    if (cleanUsername === DEFAULT_ADMIN.username.toLowerCase() && passwordPlain === DEFAULT_ADMIN.passwordHash) {
      localStorage.setItem(CURRENT_USER_LS_KEY, JSON.stringify(DEFAULT_ADMIN));
      return DEFAULT_ADMIN;
    }

    // 2. Verify credentials with Supabase Auth
    const userEmail = cleanUsername.includes('@') ? cleanUsername : `${cleanUsername}@ctfc.club`;
    let authUser: any = null;

    try {
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: passwordPlain
      });

      if (!authErr && authData?.user) {
        authUser = authData.user;
      }
    } catch (e) {
      console.warn("Supabase Auth signInWithPassword exception:", e);
    }

    // 3. Query profiles table from Supabase for approval status and role
    let profileData: any = null;
    const authId = authUser?.id;

    try {
      if (authId) {
        const { data: pData } = await (supabase.from('profiles') as any)
          .select('id, user_id, player_id, full_name, username, role, status, position, preferred_foot, nationality, squad_number, is_onboarded, onboarding_completed')
          .eq('id', authId)
          .maybeSingle();

        if (pData) {
          profileData = pData;
        } else {
          const { data: pUserData } = await (supabase.from('profiles') as any)
            .select('id, user_id, player_id, full_name, username, role, status, position, preferred_foot, nationality, squad_number, is_onboarded, onboarding_completed')
            .eq('user_id', authId)
            .maybeSingle();

          if (pUserData) profileData = pUserData;
        }
      }

      if (!profileData) {
        const { data: pUnameData } = await (supabase.from('profiles') as any)
          .select('id, user_id, player_id, full_name, username, role, status, position, preferred_foot, nationality, squad_number, is_onboarded, onboarding_completed')
          .ilike('username', cleanUsername)
          .maybeSingle();

        if (pUnameData) profileData = pUnameData;
      }
    } catch (err) {
      console.warn("Supabase profile status query warning:", err);
    }

    // 4. Local User Fallback
    const users = await this.getUsers();
    const localUser = users.find(u => u.username.toLowerCase() === cleanUsername);

    if (!authUser && !localUser && !profileData) {
      throw new Error("This username does not exist.");
    }

    if (localUser && localUser.passwordHash && localUser.passwordHash !== passwordPlain && !authUser) {
      throw new Error("Incorrect password.");
    }

    // 5. Check Approval Status: If profile.status !== 'approved', block login and sign out immediately
    const statusVal = profileData?.status || localUser?.status || (localUser?.approved === false ? "pending" : "approved");
    const statusStr = String(statusVal).trim().toLowerCase();

    const isApproved = statusStr === "approved" || cleanUsername === DEFAULT_ADMIN.username.toLowerCase();

    if (!isApproved) {
      // Immediately log out from Supabase Auth
      try {
        await supabase.auth.signOut();
      } catch (soErr) {
        console.warn("Error signing out unapproved user:", soErr);
      }

      // Prevent navigation by clearing local session
      localStorage.removeItem(CURRENT_USER_LS_KEY);

      // Display alert notification
      throw new Error("Your account registration is currently pending Admin approval. Please try again later once an Admin has approved your account.");
    }

    // 6. User is approved -> construct profile object & complete login
    const resolvedUsername = profileData?.username || localUser?.username || cleanUsername;
    const nameParts = (profileData?.full_name || (localUser?.firstName ? `${localUser.firstName} ${localUser.lastName}` : resolvedUsername)).split(" ");
    const userRole = (profileData?.role || localUser?.role || UserRole.Player) as UserRole;

    const loggedInProfile: UserProfile = {
      id: authId || localUser?.id || profileData?.id || profileData?.user_id || `usr_${resolvedUsername}`,
      user_id: authId || localUser?.user_id || profileData?.user_id,
      player_id: profileData?.player_id || localUser?.player_id,
      username: resolvedUsername,
      role: userRole,
      isAdmin: userRole === UserRole.HeadCoach || userRole === UserRole.Manager || (localUser ? localUser.isAdmin : false) || resolvedUsername.toLowerCase() === DEFAULT_ADMIN.username.toLowerCase(),
      createdAt: localUser?.createdAt || new Date().toISOString(),
      firstName: localUser?.firstName || nameParts[0] || "",
      lastName: localUser?.lastName || nameParts.slice(1).join(" ") || "",
      position: profileData?.position || localUser?.position || "CM",
      preferredFoot: profileData?.preferred_foot || localUser?.preferredFoot || "Right",
      preferred_foot: profileData?.preferred_foot || localUser?.preferred_foot || "Right",
      nationality: profileData?.nationality || localUser?.nationality || "Wales",
      squad_number: profileData?.squad_number || (localUser as any)?.squad_number,
      isOnboarded: profileData?.onboarding_completed || profileData?.is_onboarded || localUser?.isOnboarded,
      is_onboarded: profileData?.onboarding_completed || profileData?.is_onboarded || localUser?.is_onboarded,
      onboarding_completed: profileData?.onboarding_completed || localUser?.onboarding_completed,
      approved: true
    };

    localStorage.setItem(CURRENT_USER_LS_KEY, JSON.stringify(loggedInProfile));
    return loggedInProfile;
  }

  static async findPasswordByUsername(username: string): Promise<string | null> {
    const trimmed = (username || "").trim();
    if (!trimmed) return null;

    if (trimmed.toLowerCase() === DEFAULT_ADMIN.username.toLowerCase()) {
      return DEFAULT_ADMIN.passwordHash;
    }

    const users = await this.getUsers();
    const found = users.find(u => u.username.toLowerCase() === trimmed.toLowerCase());

    if (found && (found.passwordHash || (found as any).password)) {
      return found.passwordHash || (found as any).password;
    }

    try {
      const { data } = await supabase.from("profiles").select("*").ilike("username", trimmed);
      if (data && data.length > 0) {
        const u = data[0] as any;
        if (u.passwordHash || u.password) {
          return u.passwordHash || u.password;
        }
      }
    } catch (e) {
      console.warn("Supabase lookup for password failed:", e);
    }

    return null;
  }

  static async register(
    username: string, 
    passwordPlain: string, 
    role: UserRole, 
    firstName: string, 
    middleName: string, 
    lastName: string
  ): Promise<UserProfile> {
    const cleanUsername = (username || "").trim().toLowerCase();
    const users = await this.getUsers();
    
    if (users.some(u => u.username.toLowerCase() === cleanUsername) || cleanUsername === DEFAULT_ADMIN.username.toLowerCase()) {
      throw new Error("This username is already taken.");
    }

    const hasUppercase = /[A-Z]/.test(passwordPlain);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(passwordPlain);

    if (!hasUppercase || !hasSpecialChar) {
      throw new Error("Password must contain at least one uppercase letter and one special character.");
    }

    const fullName = `${firstName} ${lastName}`.trim();
    const userEmail = cleanUsername.includes('@') ? cleanUsername : `${cleanUsername}@ctfc.club`;

    // 1. Register user via Supabase Auth
    let authUser: { id: string } | null = null;
    try {
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: userEmail,
        password: passwordPlain,
        options: {
          data: {
            username: cleanUsername,
            full_name: fullName,
            role: role || 'Player',
            position: 'CM'
          }
        }
      });
      if (authData?.user) {
        authUser = { id: authData.user.id };
      } else if (authErr) {
        console.warn("Supabase auth.signUp error:", authErr);
      }
    } catch (e) {
      console.warn("Supabase auth.signUp exception:", e);
    }

    const userId = authUser?.id || "user_" + Math.random().toString(36).substr(2, 9);
    const playerId = `PLR-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // 2. Immediately upsert profile into Supabase profiles table with status = 'pending' (Unified payload for all roles)
    try {
      const profilePayload = {
        id: userId,
        user_id: userId,
        player_id: playerId,
        full_name: fullName,
        username: cleanUsername,
        role: role || 'Player',
        position: null,
        preferred_foot: 'Right',
        nationality: null,
        squad_number: null,
        is_onboarded: false,
        onboarding_completed: false,
        status: 'pending',
        created_at: new Date().toISOString()
      };

      const { error: idErr } = await (supabase.from('profiles') as any).upsert([profilePayload], { onConflict: 'id' });
      if (idErr) {
        const { error: userErr } = await (supabase.from('profiles') as any).upsert([profilePayload], { onConflict: 'user_id' });
        if (userErr) {
          await (supabase.from('profiles') as any).upsert([profilePayload], { onConflict: 'username' });
        }
      }

      // 3. Create player entry in players table
      const playerRecord = {
        id: playerId,
        name: fullName,
        position: 'CM',
        preferred_foot: 'Right',
        nationality: 'Wales',
        division: 'CCFL First',
        team_name: 'Cardiff Town FC',
        created_at: new Date().toISOString()
      };
      await (supabase.from('players') as any).upsert(playerRecord, { onConflict: 'id' });
    } catch (err) {
      console.warn("Exception upserting profile/player in Supabase during registration:", err);
    }

    const newUser = {
      id: userId,
      user_id: userId,
      player_id: playerId,
      playerId: playerId,
      username: cleanUsername,
      role: role || 'Player',
      isAdmin: (role as string) === "Admin" || role === UserRole.HeadCoach || role === UserRole.Manager,
      createdAt: new Date().toISOString(),
      passwordHash: passwordPlain,
      firstName,
      middleName,
      lastName,
      approved: false,
      status: 'pending',
      onboarding_completed: false,
      is_onboarded: false,
      isOnboarded: false
    };

    users.push(newUser);
    localStorage.setItem(USERS_LS_KEY, JSON.stringify(users));

    try {
      const app = {
        id: "app_" + Math.random().toString(36).substr(2, 9),
        userId: userId,
        username: cleanUsername,
        requestedRole: role || 'Player',
        rolePreference: role || 'Player',
        status: "pending",
        createdAt: new Date().toISOString(),
        fullName: fullName
      };
      await (supabase.from("applications") as any).upsert(app, { onConflict: "id" });
    } catch (appErr) {
      console.warn("Exception creating role application record:", appErr);
    }

    return newUser;
  }

  static async changePassword(userId: string, prevPassword: string, newPassword: string): Promise<void> {
    if (userId === DEFAULT_ADMIN.id) {
      if (prevPassword !== DEFAULT_ADMIN.passwordHash) {
        throw new Error("Incorrect current password.");
      }
      DEFAULT_ADMIN.passwordHash = newPassword;
    }

    const users = await this.getUsers();
    const user = users.find(u => u.id === userId);
    
    const adminUserInList = users.find(u => u.username === "minwoo6647");
    if (userId === DEFAULT_ADMIN.id && adminUserInList) {
      adminUserInList.passwordHash = newPassword;
      await this.saveUsers(users);
      return;
    }

    if (!user) {
      throw new Error("User profile not found.");
    }

    if (user.passwordHash !== prevPassword) {
      throw new Error("Incorrect current password.");
    }

    const hasUppercase = /[A-Z]/.test(newPassword);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);

    if (!hasUppercase || !hasSpecialChar) {
      throw new Error("New password must contain at least one uppercase letter and one special character.");
    }

    user.passwordHash = newPassword;
    await this.saveUsers(users);
  }

  static async resetUserPassword(userId: string): Promise<void> {
    if (userId === DEFAULT_ADMIN.id) {
      throw new Error("Cannot reset the master administrator account password.");
    }

    const users = await this.getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) {
      throw new Error("User profile not found.");
    }

    user.passwordHash = "cardifftownfc1!";
    await this.saveUsers(users);
  }

  static async deleteAccount(userId: string): Promise<void> {
    if (userId === DEFAULT_ADMIN.id) {
      throw new Error("Cannot delete the master administrator account.");
    }

    const cachedUsers = localStorage.getItem(USERS_LS_KEY);
    if (cachedUsers) {
      try {
        const parsed = JSON.parse(cachedUsers);
        if (Array.isArray(parsed)) {
          const updated = parsed.filter(u => u.id !== userId);
          localStorage.setItem(USERS_LS_KEY, JSON.stringify(updated));
        }
      } catch {}
    }

    try {
      await supabase.from("profiles").delete().eq("username", userId);
      await supabase.from("profiles").delete().eq("id", userId);
      await supabase.from("applications").delete().eq("userId", userId);
    } catch (e) {
      console.warn("Supabase error deleting profile:", e);
    }

    localStorage.removeItem(CURRENT_USER_LS_KEY);
  }

  static async deleteUser(userId: string): Promise<void> {
    if (userId === DEFAULT_ADMIN.id) {
      throw new Error("Cannot delete the master administrator account.");
    }

    const cachedUsers = localStorage.getItem(USERS_LS_KEY);
    if (cachedUsers) {
      try {
        const parsed = JSON.parse(cachedUsers);
        if (Array.isArray(parsed)) {
          const updated = parsed.filter(u => u.id !== userId);
          localStorage.setItem(USERS_LS_KEY, JSON.stringify(updated));
        }
      } catch {}
    }

    try {
      await supabase.from("profiles").delete().eq("username", userId);
      await supabase.from("profiles").delete().eq("id", userId);
      await supabase.from("applications").delete().eq("userId", userId);
    } catch (e) {
      console.warn("Supabase error deleting profile:", e);
    }
  }

  // Applications / Roles
  static async applyForRole(
    userId: string, 
    username: string, 
    rolePreference: UserRole, 
    requestType: "Join" | "RoleChange" = "RoleChange"
  ): Promise<void> {
    const apps = await this.getRoleApplications();
    const existing = apps.find(a => a.userId === userId && a.status === "pending");

    if (existing) {
      existing.rolePreference = rolePreference;
      existing.requestedRole = rolePreference;
      existing.requestType = requestType;
      existing.type = requestType;
      existing.createdAt = new Date().toISOString();
    } else {
      apps.push({
        id: "app_" + Math.random().toString(36).substr(2, 9),
        userId,
        username,
        rolePreference,
        requestedRole: rolePreference,
        requestType,
        type: requestType,
        status: "pending",
        createdAt: new Date().toISOString()
      });
    }

    localStorage.setItem("team_perf_analyzer_applications", JSON.stringify(apps));

    try {
      for (const app of apps) {
        await supabase.from("applications").upsert(this.sanitizeForSupabase(app));
      }
    } catch (e) {
      console.warn("Supabase save application failed:", e);
    }
  }

  static async getRoleApplications(forceRefresh = false): Promise<RoleApplication[]> {
    if (!forceRefresh) {
      const cached = this.getCached<RoleApplication[]>("applications");
      if (cached) return cached;
    }
    try {
      const { data, error } = await supabase.from("applications").select("*");
      if (!error && Array.isArray(data) && data.length > 0) {
        localStorage.setItem("team_perf_analyzer_applications", JSON.stringify(data));
        return this.setCached("applications", data as RoleApplication[]);
      }
    } catch (e) {
      console.warn("Supabase error getting applications, falling back to LocalStorage:", e);
    }

    const cached = localStorage.getItem("team_perf_analyzer_applications");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        return this.setCached("applications", parsed);
      } catch {}
    }
    return this.setCached("applications", []);
  }

  static async getApplications(forceRefresh = false): Promise<RoleApplication[]> {
    return this.getRoleApplications(forceRefresh);
  }

  static async resolveApplication(appId: string, approveOrStatus: boolean | "approved" | "rejected"): Promise<void> {
    const isApprove = typeof approveOrStatus === "boolean" ? approveOrStatus : approveOrStatus === "approved";
    if (isApprove) {
      await this.approveRoleApplication(appId);
    } else {
      await this.rejectRoleApplication(appId);
    }
  }

  static async approveRoleApplication(applicationId: string): Promise<void> {
    const apps = await this.getRoleApplications();
    const app = apps.find(a => a.id === applicationId);

    if (!app) throw new Error("Application request not found.");

    app.status = "approved";
    await this.updateUserPermission(app.userId, { role: app.rolePreference, approved: true });

    // Update row in profiles table in Supabase: status = 'approved'
    try {
      await (supabase.from("profiles") as any)
        .update({ status: 'approved', role: app.rolePreference || app.requestedRole })
        .eq('id', app.userId);

      await (supabase.from("profiles") as any)
        .update({ status: 'approved', role: app.rolePreference || app.requestedRole })
        .eq('user_id', app.userId);

      if (app.username) {
        await (supabase.from("profiles") as any)
          .update({ status: 'approved', role: app.rolePreference || app.requestedRole })
          .eq('username', app.username);
      }
    } catch (e) {
      console.warn("Supabase update profile status approved failed:", e);
    }

    localStorage.setItem("team_perf_analyzer_applications", JSON.stringify(apps));
    try {
      await supabase.from("applications").upsert(this.sanitizeForSupabase(app));
    } catch (e) {
      console.warn("Supabase update application failed:", e);
    }
  }

  static async rejectRoleApplication(applicationId: string): Promise<void> {
    const apps = await this.getRoleApplications();
    const app = apps.find(a => a.id === applicationId);

    if (!app) throw new Error("Application request not found.");

    app.status = "rejected";
    await this.updateUserPermission(app.userId, { approved: false });

    // Update row in profiles table in Supabase: status = 'rejected'
    try {
      await (supabase.from("profiles") as any)
        .update({ status: 'rejected' })
        .eq('id', app.userId);

      await (supabase.from("profiles") as any)
        .update({ status: 'rejected' })
        .eq('user_id', app.userId);

      if (app.username) {
        await (supabase.from("profiles") as any)
          .update({ status: 'rejected' })
          .eq('username', app.username);
      }
    } catch (e) {
      console.warn("Supabase update profile status rejected failed:", e);
    }

    localStorage.setItem("team_perf_analyzer_applications", JSON.stringify(apps));
    try {
      await supabase.from("applications").upsert(this.sanitizeForSupabase(app));
    } catch (e) {
      console.warn("Supabase update application failed:", e);
    }
  }

  static async getPendingUsersFromSupabase(): Promise<any[]> {
    try {
      const { data: pendingProfiles, error } = await (supabase.from('profiles') as any)
        .select('*')
        .or('status.eq.pending,status.is.null,status.eq.Pending');

      const apps = await this.getRoleApplications(true);
      const pendingApps = apps.filter(a => a.status === 'pending' || a.status === 'Pending');

      const userMap = new Map<string, any>();

      if (!error && Array.isArray(pendingProfiles)) {
        pendingProfiles.forEach((p: any) => {
          if (p.username?.toLowerCase() === DEFAULT_ADMIN.username.toLowerCase()) return;
          const uId = p.id || p.user_id || p.username;
          if (uId) {
            userMap.set(uId, {
              id: p.id || p.user_id || `app_${p.username}`,
              userId: p.id || p.user_id,
              username: p.username,
              fullName: p.full_name,
              role: p.role || 'Player',
              requestedRole: p.role || 'Player',
              status: p.status || 'pending',
              createdAt: p.created_at || new Date().toISOString(),
              type: 'Join'
            });
          }
        });
      }

      pendingApps.forEach(a => {
        if (a.username?.toLowerCase() === DEFAULT_ADMIN.username.toLowerCase()) return;
        const key = a.userId || a.username || a.id;
        if (!userMap.has(key)) {
          userMap.set(key, {
            id: a.id,
            userId: a.userId,
            username: a.username,
            fullName: a.username,
            role: a.requestedRole || a.rolePreference || 'Player',
            requestedRole: a.requestedRole || a.rolePreference || 'Player',
            status: a.status || 'pending',
            createdAt: a.createdAt || new Date().toISOString(),
            type: a.type || 'Join'
          });
        }
      });

      return Array.from(userMap.values());
    } catch (err) {
      console.warn("Error fetching pending registration users:", err);
      return [];
    }
  }

  static async approvePendingUserAccount(targetUserId: string, targetUsername?: string, appId?: string): Promise<void> {
    try {
      if (targetUserId) {
        await (supabase.from('profiles') as any)
          .update({ status: 'approved' })
          .eq('id', targetUserId);

        await (supabase.from('profiles') as any)
          .update({ status: 'approved' })
          .eq('user_id', targetUserId);
      }

      if (targetUsername) {
        await (supabase.from('profiles') as any)
          .update({ status: 'approved' })
          .eq('username', targetUsername);
      }
    } catch (e) {
      console.warn("Supabase approve user status failed:", e);
    }

    if (appId) {
      try {
        await this.approveRoleApplication(appId);
      } catch {}
    } else {
      const apps = await this.getRoleApplications();
      const match = apps.find(a => a.userId === targetUserId || a.username === targetUsername);
      if (match) {
        try {
          await this.approveRoleApplication(match.id);
        } catch {}
      }
    }

    if (targetUserId) {
      await this.updateUserPermission(targetUserId, { approved: true });
    }
  }

  static async rejectPendingUserAccount(targetUserId: string, targetUsername?: string, appId?: string): Promise<void> {
    try {
      if (targetUserId) {
        await (supabase.from('profiles') as any)
          .update({ status: 'rejected' })
          .eq('id', targetUserId);

        await (supabase.from('profiles') as any)
          .update({ status: 'rejected' })
          .eq('user_id', targetUserId);
      }

      if (targetUsername) {
        await (supabase.from('profiles') as any)
          .update({ status: 'rejected' })
          .eq('username', targetUsername);
      }
    } catch (e) {
      console.warn("Supabase reject user status failed:", e);
    }

    if (appId) {
      try {
        await this.rejectRoleApplication(appId);
      } catch {}
    } else {
      const apps = await this.getRoleApplications();
      const match = apps.find(a => a.userId === targetUserId || a.username === targetUsername);
      if (match) {
        try {
          await this.rejectRoleApplication(match.id);
        } catch {}
      }
    }

    if (targetUserId) {
      await this.updateUserPermission(targetUserId, { approved: false });
    }
  }

  static async getProfileUpdateRequests(forceRefresh = true): Promise<ProfileUpdateRequest[]> {
    if (!forceRefresh) {
      const cached = this.getCached<ProfileUpdateRequest[]>("profile_requests");
      if (cached) return cached;
    }
    try {
      const { data, error } = await (supabase.from('profile_update_requests') as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        const formatted: ProfileUpdateRequest[] = data.map(d => {
          let changes = d.requested_changes;
          if (typeof changes === 'string') {
            try { changes = JSON.parse(changes); } catch {}
          }
          return {
            id: String(d.id),
            user_id: d.user_id,
            player_name: d.player_name || d.user_name || "Player",
            requested_changes: changes || {},
            status: d.status || 'pending',
            created_at: d.created_at || new Date().toISOString()
          };
        });
        localStorage.setItem("team_perf_analyzer_profile_requests", JSON.stringify(formatted));
        return this.setCached("profile_requests", formatted);
      }
    } catch (e) {
      console.warn("Supabase fetch profile_update_requests warning:", e);
    }

    const local = localStorage.getItem("team_perf_analyzer_profile_requests");
    if (local) {
      try {
        const parsed = JSON.parse(local);
        return this.setCached("profile_requests", parsed);
      } catch (e) {}
    }
    return [];
  }

  static async submitProfileUpdateRequest(req: { user_id: string; player_name: string; requested_changes: any }): Promise<ProfileUpdateRequest> {
    const newReq: ProfileUpdateRequest = {
      id: `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      user_id: req.user_id,
      player_name: req.player_name,
      requested_changes: req.requested_changes,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    // Save directly to Supabase profile_update_requests table
    try {
      const payload = {
        id: newReq.id,
        user_id: newReq.user_id,
        player_name: newReq.player_name,
        requested_changes: newReq.requested_changes,
        status: 'pending',
        created_at: newReq.created_at
      };

      const { error } = await (supabase.from('profile_update_requests') as any).insert(payload);
      if (error) {
        console.warn("Supabase insert error on profile_update_requests, retrying stringified JSON:", error);
        await (supabase.from('profile_update_requests') as any).upsert({
          ...payload,
          requested_changes: typeof newReq.requested_changes === 'object' ? JSON.stringify(newReq.requested_changes) : newReq.requested_changes
        });
      }

      // Also update pending_changes column in profiles table
      try {
        await (supabase.from('profiles') as any).update({
          pending_changes: newReq.requested_changes
        }).eq('user_id', req.user_id);
        await (supabase.from('profiles') as any).update({
          pending_changes: newReq.requested_changes
        }).eq('id', req.user_id);
        await (supabase.from('profiles') as any).update({
          pending_changes: newReq.requested_changes
        }).eq('username', req.user_id);
      } catch (e) {
        console.warn("Failed to update pending_changes on profiles:", e);
      }
    } catch (e) {
      console.warn("Supabase insert profile_update_requests failed:", e);
    }

    const requests = await this.getProfileUpdateRequests(true);
    const updated = [newReq, ...requests.filter(r => r.id !== newReq.id)];
    localStorage.setItem("team_perf_analyzer_profile_requests", JSON.stringify(updated));
    this.setCached("profile_requests", updated);

    return newReq;
  }

  static async approveProfileUpdateRequest(requestId: string): Promise<void> {
    const requests = await this.getProfileUpdateRequests(true);
    const req = requests.find(r => String(r.id) === String(requestId));
    if (!req) throw new Error("Request not found");

    const changes = req.requested_changes || {};
    const updatePayload: any = {
      pending_changes: null,
      updated_at: new Date().toISOString()
    };
    if (changes.position) updatePayload.position = changes.position;
    if (changes.preferred_foot || changes.preferredFoot) {
      const foot = changes.preferred_foot || changes.preferredFoot;
      updatePayload.preferred_foot = foot;
      updatePayload.preferredFoot = foot;
    }
    if (changes.nationality) {
      updatePayload.nationality = changes.nationality;
    }
    if (changes.secondary_position || changes.secondaryPosition) {
      const secPos = changes.secondary_position || changes.secondaryPosition;
      updatePayload.secondary_position = secPos;
      updatePayload.secondaryPosition = secPos;
    }
    if (changes.back_number || changes.backNumber || changes.jersey_number || changes.squad_number || changes.squadNumber) {
      const backNum = changes.squad_number || changes.squadNumber || changes.back_number || changes.backNumber || changes.jersey_number;
      updatePayload.back_number = backNum;
      updatePayload.backNumber = backNum;
      updatePayload.jersey_number = backNum;
      updatePayload.squad_number = backNum;
    }

    // 1. Update target user's row in profiles table with values inside requested_changes & clear pending_changes
    try {
      if (req.user_id) {
        await (supabase.from('profiles') as any).update(updatePayload).eq('user_id', req.user_id);
        await (supabase.from('profiles') as any).update(updatePayload).eq('id', req.user_id);
        await (supabase.from('profiles') as any).update(updatePayload).eq('username', req.user_id);
      }
    } catch (e) {
      console.warn("Supabase update profile error:", e);
    }

    // 2. Update request status in profile_update_requests to 'approved'
    try {
      await (supabase.from('profile_update_requests') as any).update({ status: 'approved' }).eq('id', requestId);
    } catch (e) {
      console.warn("Supabase update request status error:", e);
    }

    req.status = 'approved';
    localStorage.setItem("team_perf_analyzer_profile_requests", JSON.stringify(requests));
    this.setCached("profile_requests", requests);
  }

  static async rejectProfileUpdateRequest(requestId: string): Promise<void> {
    const requests = await this.getProfileUpdateRequests(true);
    const req = requests.find(r => String(r.id) === String(requestId));

    if (req && req.user_id) {
      try {
        await (supabase.from('profiles') as any).update({ pending_changes: null }).eq('user_id', req.user_id);
        await (supabase.from('profiles') as any).update({ pending_changes: null }).eq('id', req.user_id);
        await (supabase.from('profiles') as any).update({ pending_changes: null }).eq('username', req.user_id);
      } catch (e) {
        console.warn("Failed to clear pending_changes on profiles upon rejection:", e);
      }
    }

    // 1. Update request status in profile_update_requests to 'rejected'
    try {
      await (supabase.from('profile_update_requests') as any).update({ status: 'rejected' }).eq('id', requestId);
    } catch (e) {
      console.warn("Supabase reject request error:", e);
    }

    if (req) {
      req.status = 'rejected';
      localStorage.setItem("team_perf_analyzer_profile_requests", JSON.stringify(requests));
      this.setCached("profile_requests", requests);
    }
  }

  static async resequenceFixtures(reorderedFixtures: MatchFixture[]): Promise<void> {
    await this.saveFixtures(reorderedFixtures);
    await this.syncCumulativeStats();
  }

  static async addFixture(f: MatchFixture): Promise<void> {
    const payload: any = {
      date: f.date,
      match_date: f.date,
      kick_off_time: (f as any).kick_off_time || (f as any).kickOffTime || "15:00",
      home_team: f.homeTeam || (f.venue === "Home" ? "Cardiff Town FC" : f.opponent),
      away_team: f.awayTeam || (f.venue === "Away" ? "Cardiff Town FC" : f.opponent),
      opponent_name: f.opponent,
      opponent: f.opponent,
      venue: f.venue || "Home",
      competition: f.competition || "League Match",
      division: f.division || undefined,
      status: f.status || "Upcoming",
      home_score: f.homeScore,
      away_score: f.awayScore,
      ourScore: f.ourScore,
      oppScore: f.oppScore,
      team_score: Number(f.ourScore ?? f.homeScore ?? 0),
      opp_score: Number(f.oppScore ?? f.awayScore ?? 0)
    };

    if (f.id && !f.id.startsWith("fixture_")) {
      payload.id = f.id;
    }

    const { error } = await (supabase.from("fixtures") as any).insert([payload]).select();
    if (error) {
      console.error("Supabase error inserting fixture:", error);
      throw new Error(`Failed to save fixture into database: ${error.message || JSON.stringify(error)}`);
    }

    this.invalidateCache("fixtures");
    await this.getFixtures(true);
  }

  static async updateFixtureManualScore(fixtureId: string, homeScore: number, awayScore: number): Promise<void> {
    const fixtures = await this.getFixtures();
    const fixture = fixtures.find(f => f.id === fixtureId);
    if (!fixture) {
      throw new Error("Target match fixture was not found.");
    }

    fixture.status = "Played";
    fixture.homeScore = homeScore;
    fixture.awayScore = awayScore;

    if (fixture.homeTeam === "Cardiff Town FC") {
      fixture.ourScore = homeScore;
      fixture.oppScore = awayScore;
    } else if (fixture.awayTeam === "Cardiff Town FC") {
      fixture.ourScore = awayScore;
      fixture.oppScore = homeScore;
    } else {
      fixture.ourScore = 0;
      fixture.oppScore = 0;
    }

    await this.saveFixtures(fixtures);
  }

  static async revertFixtureUpload(fixtureId: string): Promise<void> {
    const fixtures = await this.getFixtures();
    const fixture = fixtures.find(f => f.id === fixtureId);
    if (!fixture) {
      throw new Error("Target match fixture was not found in the schedule.");
    }

    fixture.status = "Upcoming";
    fixture.ourScore = undefined;
    fixture.oppScore = undefined;
    fixture.homeScore = undefined;
    fixture.awayScore = undefined;
    await this.saveFixtures(fixtures);

    const matches = await this.getMatches();
    const filteredMatches = matches.filter(m => {
      if (m.fixtureId === fixtureId) return false;
      const dateMatches = m.date === fixture.date;
      const opponentMatches = 
        m.opponent.toLowerCase().trim() === fixture.opponent.toLowerCase().trim() ||
        (m.teamName && m.teamName.toLowerCase().trim() === fixture.opponent.toLowerCase().trim());
      if (dateMatches && opponentMatches) return false;
      return true;
    });
    await this.saveMatches(filteredMatches);

    const playerRecords = await this.getPlayerMatchRecords();
    const filteredPlayerRecords = playerRecords.filter(r => r.matchId !== fixtureId);
    await this.savePlayerMatchRecords(filteredPlayerRecords);

    await this.deleteHeatmapPointsForFixture(fixtureId);
    await this.syncCumulativeStats();
  }

  static async deleteHeatmapPointsForFixture(fixtureId: string): Promise<void> {
    try {
      await supabase.from("heatmaps").delete().eq("matchId", fixtureId);
    } catch (e) {
      console.warn("Error cleaning heatmaps for delete:", e);
    }
    const cached = localStorage.getItem("team_perf_analyzer_heatmap_points");
    if (cached) {
      try {
        const points = JSON.parse(cached);
        const filtered = points.filter((p: any) => p.matchId !== fixtureId);
        localStorage.setItem("team_perf_analyzer_heatmap_points", JSON.stringify(filtered));
      } catch {}
    }
  }

  static async deleteHeatmapPointsGroup(matchId: string, playerId: string): Promise<void> {
    try {
      await supabase.from("heatmaps").delete().eq("matchId", matchId).eq("playerId", playerId);
    } catch (e) {
      console.warn("Error cleaning heatmaps group:", e);
    }
    const cached = localStorage.getItem("team_perf_analyzer_heatmap_points");
    if (cached) {
      try {
        const points = JSON.parse(cached);
        const filtered = points.filter((p: any) => !(p.matchId === matchId && p.playerId === playerId));
        localStorage.setItem("team_perf_analyzer_heatmap_points", JSON.stringify(filtered));
      } catch {}
    }
    await this.syncCumulativeStats();
  }

  static async deleteFixture(fixtureId: string): Promise<void> {
    // Explicitly delete from Supabase fixtures table
    const { error } = await supabase.from("fixtures").delete().eq("id", fixtureId);
    if (error) {
      console.error("Supabase error deleting fixture:", error);
      throw new Error(`Failed to delete fixture from database: ${error.message}`);
    }

    const fixtures = await this.getFixtures();
    const fixture = fixtures.find(f => f.id === fixtureId);
    
    const filteredFixtures = fixtures.filter(f => f.id !== fixtureId);
    this.invalidateCache("fixtures");
    localStorage.setItem(FIXTURES_LS_KEY, JSON.stringify(filteredFixtures));

    const matches = await this.getMatches();
    const filteredMatches = matches.filter(m => {
      if (m.fixtureId === fixtureId) return false;
      if (fixture) {
        const dateMatches = m.date === fixture.date;
        const opponentMatches = 
          m.opponent.toLowerCase().trim() === fixture.opponent.toLowerCase().trim() ||
          (m.teamName && m.teamName.toLowerCase().trim() === fixture.opponent.toLowerCase().trim());
        if (dateMatches && opponentMatches) return false;
      }
      return true;
    });
    await this.saveMatches(filteredMatches);

    const playerRecords = await this.getPlayerMatchRecords();
    const filteredPlayerRecords = playerRecords.filter(r => r.matchId !== fixtureId);
    await this.savePlayerMatchRecords(filteredPlayerRecords);

    await this.deleteHeatmapPointsForFixture(fixtureId);
    await this.syncCumulativeStats();
  }

  static async getSettings(): Promise<{ piPreset: string; kpiPreset: string }> {
    try {
      const { data, error } = await supabase.from("settings").select("*").eq("id", "pikpi").single();
      if (!error && data) {
        return data as any;
      }
    } catch {}

    return {
      piPreset: localStorage.getItem("active_pi_preset") || "Standard",
      kpiPreset: localStorage.getItem("active_kpi_preset") || "Standard K-League"
    };
  }

  static async saveSettings(piPreset: string, kpiPreset: string): Promise<void> {
    localStorage.setItem("active_pi_preset", piPreset);
    localStorage.setItem("active_kpi_preset", kpiPreset);
    try {
      await (supabase.from("settings") as any).upsert({ id: "pikpi", piPreset, kpiPreset });
    } catch (e) {
      console.warn("Supabase save settings failed:", e);
    }
  }

  static async clearAllData(): Promise<void> {
    // Purge cloud databases if connected
    try {
      await supabase.from("matches").delete().neq("id", "clear_all");
      await supabase.from("players").delete().neq("id", "clear_all");
      await supabase.from("player_match_records").delete().neq("id", "clear_all");
      await supabase.from("heatmaps").delete().neq("id", "clear_all");
      await (supabase.from("teams") as any).delete().neq("id", "clear_all");
      await supabase.from("fixtures").delete().neq("id", "clear_all");
    } catch (e) {
      console.warn("Error clearing Supabase tables:", e);
    }

    // Reset LocalStorage
    localStorage.setItem(MATCHES_LS_KEY, JSON.stringify([]));
    localStorage.setItem(PLAYERS_LS_KEY, JSON.stringify([]));
    localStorage.setItem(FIXTURES_LS_KEY, JSON.stringify([]));
    localStorage.setItem("team_perf_analyzer_player_match_records", JSON.stringify([]));
    localStorage.setItem("team_perf_analyzer_heatmap_points", JSON.stringify([]));
    localStorage.setItem("team_perf_analyzer_custom_teams", JSON.stringify([]));
  }

  static async getCustomTeams(forceRefresh = false): Promise<CustomTeam[]> {
    if (!forceRefresh) {
      const cached = this.getCached<CustomTeam[]>("customTeams");
      if (cached) return cached;
    }
    try {
      const teamMap = new Map<string, CustomTeam>();

      // 1. Query custom_teams table
      const { data: ctData, error: ctError } = await (supabase.from("custom_teams") as any).select("*");
      if (!ctError && Array.isArray(ctData)) {
        ctData.forEach((t: any) => {
          const name = t.team_name || t.name || t.teamName || "";
          if (name) {
            const id = t.id || t.team_id || name.toLowerCase().replace(/[^a-z0-9]/g, "_");
            if (!teamMap.has(id)) {
              teamMap.set(id, {
                id,
                name,
                league: t.division || t.league || "CCFL Premier Division",
                homeVenue: t.home_venue || t.homeVenue || "",
                shortCode: t.short_name || t.shortCode || "",
                mp: Number(t.mp || 0),
                w: Number(t.w || 0),
                d: Number(t.d || 0),
                l: Number(t.l || 0),
                gf: Number(t.gf || 0),
                ga: Number(t.ga || 0)
              });
            }
          }
        });
      }

      // 2. Query teams table as fallback
      const { data: tData, error: tError } = await (supabase.from("teams") as any).select("*");
      if (!tError && Array.isArray(tData)) {
        tData.forEach((t: any) => {
          const name = t.team_name || t.name || t.teamName || "";
          if (name) {
            const id = t.id || t.team_id || name.toLowerCase().replace(/[^a-z0-9]/g, "_");
            if (!teamMap.has(id)) {
              teamMap.set(id, {
                id,
                name,
                league: t.division || t.league || "CCFL Premier Division",
                homeVenue: t.home_venue || t.homeVenue || "",
                shortCode: t.short_name || t.shortCode || "",
                mp: Number(t.mp || 0),
                w: Number(t.w || 0),
                d: Number(t.d || 0),
                l: Number(t.l || 0),
                gf: Number(t.gf || 0),
                ga: Number(t.ga || 0)
              });
            }
          }
        });
      }

      if (teamMap.size > 0) {
        const teamsList = Array.from(teamMap.values());
        localStorage.setItem("team_perf_analyzer_custom_teams", JSON.stringify(teamsList));
        return this.setCached("customTeams", teamsList);
      }
    } catch (e) {
      console.warn("Supabase error getting custom teams, falling back to LocalStorage:", e);
    }

    const cached = localStorage.getItem("team_perf_analyzer_custom_teams");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return this.setCached("customTeams", parsed);
        }
      } catch {}
    }
    return this.setCached("customTeams", []);
  }

  static async saveCustomTeam(team: CustomTeam): Promise<void> {
    this.invalidateCache("customTeams");
    try {
      const payload = {
        team_name: team.name,
        division: team.league || "CCFL Premier Division",
      };
      const { error } = await (supabase.from("custom_teams") as any).insert([payload]);
      if (error) {
        console.warn("Supabase custom_teams insert error, trying upsert:", error);
        await (supabase.from("custom_teams") as any).upsert([payload]);
      }
    } catch (e) {
      console.warn(`Supabase save custom team failed for ${team.id}:`, e);
    }

    const current = await this.getCustomTeams();
    const updated = current.filter(t => t.id !== team.id && t.name.toLowerCase() !== team.name.toLowerCase());
    updated.push(team);
    localStorage.setItem("team_perf_analyzer_custom_teams", JSON.stringify(updated));
    await this.syncCumulativeStats();
  }

  static async clearCustomTeams(): Promise<void> {
    this.invalidateCache("customTeams");
    try {
      await (supabase.from("custom_teams") as any).delete().neq("id", "clear_all");
      await (supabase.from("teams") as any).delete().neq("id", "clear_all");
    } catch (e) {
      console.warn("Supabase error clearing custom teams:", e);
    }
    localStorage.setItem("team_perf_analyzer_custom_teams", JSON.stringify([]));
  }

  static async saveCustomTeams(teams: CustomTeam[]): Promise<void> {
    this.invalidateCache("customTeams");
    for (const team of teams) {
      try {
        const payload = {
          team_name: team.name,
          division: team.league || "CCFL Premier Division",
        };
        const { error } = await (supabase.from("custom_teams") as any).insert([payload]);
        if (error) {
          await (supabase.from("custom_teams") as any).upsert([payload]);
        }
      } catch (e) {
        console.warn(`Supabase save custom team failed for ${team.id}:`, e);
      }
    }
    localStorage.setItem("team_perf_analyzer_custom_teams", JSON.stringify(teams));
    await this.syncCumulativeStats();
  }

  static async syncCumulativeStats(): Promise<void> {
    try {
      const basePlayers = await this.getPlayers();
      const records = await this.getPlayerMatchRecords();
      const fixtures = await this.getFixtures();

      const updatedPlayers: Player[] = [];
      for (const p of basePlayers) {
        const playerWithResetStats = this.resetPlayerStats(this.migratePlayer(p));
        const playerRecords = records.filter(r => {
          const fixture = fixtures.find(f => f.id === r.matchId);
          if (fixture && fixture.status !== "Played") return false;

          const rPlayerId = String(r.playerId || "").toLowerCase().trim();
          const rPlayerName = String(r.playerName || "").toLowerCase().trim();
          const rShirt = Number(r.shirtNumber);
          
          if (rPlayerId && p.id && rPlayerId === p.id.toLowerCase()) return true;
          if (rPlayerName && p.name && p.name.toLowerCase() === rPlayerName) return true;
          if (rShirt > 0 && p.backNumber > 0 && rShirt === p.backNumber) return true;
          return false;
        });

        for (const record of playerRecords) {
          playerWithResetStats.goals += Number(record.goals || 0);
          playerWithResetStats.assists += Number(record.assists || 0);
          playerWithResetStats.shots += Number(record.shots || 0);
          playerWithResetStats.shotsOnTarget += Number(record.shotsOnTarget || 0);
          playerWithResetStats.totalPasses += Number(record.totalPasses || 0);
          playerWithResetStats.successfulPasses += Number(record.successfulPasses || 0);
          playerWithResetStats.xG = Number((Number(playerWithResetStats.xG || 0) + Number(record.xG || record.xg || 0)).toFixed(2));
          playerWithResetStats.xA = Number((Number(playerWithResetStats.xA || 0) + Number(record.xA || record.xa || 0)).toFixed(2));
          playerWithResetStats.progressivePasses = (playerWithResetStats.progressivePasses || 0) + Number(record.progressivePasses || 0);
          playerWithResetStats.successfulProgressivePasses = (playerWithResetStats.successfulProgressivePasses || 0) + Number(record.successfulProgressivePasses || 0);
          playerWithResetStats.finalThirdPasses = (playerWithResetStats.finalThirdPasses || 0) + Number(record.finalThirdPasses || 0);
          playerWithResetStats.keyPasses += Number(record.keyPasses || 0);
          playerWithResetStats.throughBalls = (playerWithResetStats.throughBalls || 0) + Number(record.throughBalls || 0);
          playerWithResetStats.successfulThroughBalls = (playerWithResetStats.successfulThroughBalls || 0) + Number(record.successfulThroughBalls || 0);
          playerWithResetStats.touches += Number(record.touches || 0);
          playerWithResetStats.progressiveCarries = (playerWithResetStats.progressiveCarries || 0) + Number(record.progressiveCarries || 0);
          playerWithResetStats.progressiveDribbles = (playerWithResetStats.progressiveDribbles || 0) + Number(record.progressiveDribbles || 0);
          playerWithResetStats.aerialDuels = (playerWithResetStats.aerialDuels || 0) + Number(record.aerialDuels || 0);
          playerWithResetStats.aerialDuelsWon = (playerWithResetStats.aerialDuelsWon || 0) + Number(record.aerialDuelsWon || 0);
          playerWithResetStats.defensiveDuels = (playerWithResetStats.defensiveDuels || 0) + Number(record.defensiveDuels || 0);
          playerWithResetStats.defensiveDuelsWon = (playerWithResetStats.defensiveDuelsWon || 0) + Number(record.defensiveDuelsWon || 0);
          playerWithResetStats.tacklesAttempted = (playerWithResetStats.tacklesAttempted || 0) + Number(record.tacklesAttempted || 0);
          playerWithResetStats.tacklesWon = (playerWithResetStats.tacklesWon || 0) + Number(record.tacklesWon || 0);
          playerWithResetStats.interceptions = (playerWithResetStats.interceptions || 0) + Number(record.interceptions || 0);
          playerWithResetStats.clearances = (playerWithResetStats.clearances || 0) + Number(record.clearances || 0);
          playerWithResetStats.ballRecoveries = (playerWithResetStats.ballRecoveries || 0) + Number(record.ballRecoveries || 0);
          playerWithResetStats.possessionRegains = (playerWithResetStats.possessionRegains || 0) + Number(record.possessionRegains || 0);
          playerWithResetStats.dribblesAttempted = (playerWithResetStats.dribblesAttempted || 0) + Number(record.dribblesAttempted || 0);
          playerWithResetStats.successfulDribbles = (playerWithResetStats.successfulDribbles || 0) + Number(record.successfulDribbles || 0);
          playerWithResetStats.crossesAttempted = (playerWithResetStats.crossesAttempted || 0) + Number(record.crossesAttempted || 0);
          playerWithResetStats.successfulCrosses = (playerWithResetStats.successfulCrosses || 0) + Number(record.successfulCrosses || 0);
          playerWithResetStats.boxEntries = (playerWithResetStats.boxEntries || 0) + Number(record.boxEntries || 0);
          playerWithResetStats.saveAttempts = (playerWithResetStats.saveAttempts || 0) + Number(record.saveAttempts || 0);
          playerWithResetStats.saves = (playerWithResetStats.saves || 0) + Number(record.saves || 0);
          playerWithResetStats.crossClaims = (playerWithResetStats.crossClaims || 0) + Number(record.crossClaims || 0);
          playerWithResetStats.sweeperActions = (playerWithResetStats.sweeperActions || 0) + Number(record.sweeperActions || 0);
          playerWithResetStats.minutesPlayed += Number(record.minutesPlayed || 0);
          playerWithResetStats.appearances = (playerWithResetStats.appearances || 0) + 1;

          if (p.position === "GK") {
            const fx = fixtures.find(f => f.id === record.matchId);
            if (fx && fx.oppScore === 0) {
              playerWithResetStats.cleanSheets = (playerWithResetStats.cleanSheets || 0) + 1;
            }
          }
        }

        try {
          await supabase.from("players").upsert(this.sanitizeForSupabase(playerWithResetStats));
        } catch (err) {
          console.warn(`Failed to sync cumulative stats for player ${p.id}:`, err);
        }
        updatedPlayers.push(playerWithResetStats);
      }
      localStorage.setItem(PLAYERS_LS_KEY, JSON.stringify(updatedPlayers));

      const customTeams = await this.getCustomTeams();
      const matches = await this.getMatches();

      const updatedTeams: CustomTeam[] = [];
      for (const team of customTeams) {
        const teamStats = {
          mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0,
          totalPasses: 0, successfulPasses: 0, goals: 0,
          shots: 0, shotsOnTarget: 0, clearances: 0,
          tacklesWon: 0, interceptions: 0, ballRecoveries: 0,
          corners: 0, possessionRateSum: 0
        };

        const teamMatches = matches.filter(m => {
          if (!m.teamName) return false;
          const isMatch = m.teamName.toLowerCase().trim() === team.name.toLowerCase().trim();
          if (!isMatch) return false;
          const fixture = fixtures.find(f => f.id === m.fixtureId);
          return fixture ? fixture.status === "Played" : true;
        });

        for (const m of teamMatches) {
          teamStats.mp += 1;
          const currentGoals = Number(m.goals || 0);
          teamStats.gf += currentGoals;
          const oppMatch = matches.find(o => o.fixtureId === m.fixtureId && o.id !== m.id);
          const oppG = oppMatch ? Number(oppMatch.goals || 0) : 0;
          teamStats.ga += oppG;

          if (currentGoals > oppG) teamStats.w += 1;
          else if (currentGoals === oppG) teamStats.d += 1;
          else teamStats.l += 1;

          teamStats.totalPasses += Number(m.totalPasses || 0);
          teamStats.successfulPasses += Number(m.successfulPasses || 0);
          teamStats.goals += currentGoals;
          teamStats.shots += Number(m.shots || 0);
          teamStats.shotsOnTarget += Number(m.shotsOnTarget || 0);
          teamStats.clearances += Number(m.clearances || 0);
          teamStats.tacklesWon += Number(m.tacklesWon || 0);
          teamStats.interceptions += Number(m.interceptions || 0);
          teamStats.ballRecoveries += Number(m.ballRecoveries || 0);
          teamStats.corners += Number(m.corners || 0);
          teamStats.possessionRateSum += Number(m.possessionRate || 50);
        }

        const updatedTeam: CustomTeam = {
          ...team,
          mp: teamStats.mp,
          w: teamStats.w,
          d: teamStats.d,
          l: teamStats.l,
          gf: teamStats.gf,
          ga: teamStats.ga,
          totalPasses: teamStats.totalPasses,
          successfulPasses: teamStats.successfulPasses,
          goals: teamStats.goals,
          shots: teamStats.shots,
          shotsOnTarget: teamStats.shotsOnTarget,
          clearances: teamStats.clearances,
          tacklesWon: teamStats.tacklesWon,
          interceptions: teamStats.interceptions,
          ballRecoveries: teamStats.ballRecoveries,
          corners: teamStats.corners,
          possessionRate: teamStats.mp > 0 ? parseFloat((teamStats.possessionRateSum / teamStats.mp).toFixed(1)) : 0
        };

        try {
          const payload = {
            id: team.id || team.name.toLowerCase().replace(/[^a-z0-9]/g, "_"),
            team_name: team.name,
            division: team.league || "CCFL Premier",
            home_venue: team.homeVenue || "",
            short_name: team.shortCode || ""
          };
          const { error } = await (supabase.from("teams") as any).upsert(payload, { onConflict: "team_name" });
          if (error) {
            await (supabase.from("teams") as any).upsert(payload);
          }
        } catch (err) {
          console.warn(`Failed to sync cumulative stats for team ${team.id}:`, err);
        }
        updatedTeams.push(updatedTeam);
      }
      localStorage.setItem("team_perf_analyzer_custom_teams", JSON.stringify(updatedTeams));
    } catch (e) {
      console.warn("Error running syncCumulativeStats:", e);
    }
  }

  static async getHeatmapPoints(matchId?: string, forceRefresh = false): Promise<HeatmapPoint[]> {
    const key = "heatmap_" + (matchId || "all");
    if (!forceRefresh) {
      const cached = this.getCached<HeatmapPoint[]>(key);
      if (cached) return cached;
    }
    try {
      const { data, error } = await (supabase.from("heatmaps") as any).select("*");
      if (!error && Array.isArray(data) && data.length > 0) {
        localStorage.setItem("team_perf_analyzer_heatmap_points", JSON.stringify(data));
        const res = matchId ? data.filter((p: any) => p.matchId === matchId) : data;
        return this.setCached(key, res);
      }
    } catch (e) {
      console.warn("Supabase error getting heatmaps, falling back to LocalStorage:", e);
    }

    const cached = localStorage.getItem("team_perf_analyzer_heatmap_points");
    if (cached) {
      try {
        const points: HeatmapPoint[] = JSON.parse(cached);
        const res = matchId ? points.filter(p => p.matchId === matchId) : points;
        return this.setCached(key, res);
      } catch {}
    }
    return this.setCached(key, []);
  }

  static async saveHeatmapPoints(points: HeatmapPoint[]): Promise<void> {
    this.invalidateCache("heatmap");
    try {
      if (points.length > 0) {
        const payload = points.map(point => {
          const pointId = point.id || `${point.matchId}_${point.teamId}_${point.playerId}_${Math.random().toString(36).substr(2, 9)}`;
          return this.sanitizeForSupabase({ ...point, id: pointId });
        });
        await (supabase.from("heatmaps") as any).upsert(payload);
      }
    } catch (e) {
      console.warn("Supabase save heatmap points failed:", e);
    }

    const current = await this.getHeatmapPoints();
    const updated = [...current];
    for (const point of points) {
      const idx = point.id ? updated.findIndex(p => p.id === point.id) : -1;
      if (idx > -1) {
        updated[idx] = point;
      } else {
        updated.push(point);
      }
    }
    localStorage.setItem("team_perf_analyzer_heatmap_points", JSON.stringify(updated));
  }
}
