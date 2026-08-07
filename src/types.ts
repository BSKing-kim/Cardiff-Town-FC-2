export enum UserRole {
  HeadCoach = "Head Coach",
  Manager = "Manager",
  Analyst = "Analysts",
  Player = "Player"
}

export interface ProfileUpdateRequest {
  id: string;
  user_id: string;
  player_name: string;
  requested_changes: {
    preferred_foot?: string;
    preferredFoot?: string;
    position?: string;
    secondary_position?: string;
    secondaryPosition?: string;
    nationality?: string;
    squad_number?: string | number;
    squadNumber?: string | number;
    back_number?: string | number;
    backNumber?: string | number;
    height?: string | number;
    weight?: string | number;
    [key: string]: any;
  };
  status: "pending" | "approved" | "rejected";
  created_at?: string;
}

export interface UserProfile {
  id: string; // matches auth id or username
  username: string;
  role: UserRole;
  isAdmin: boolean;
  createdAt: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  approved?: boolean;
  playerId?: string;
  player_id?: string;
  user_id?: string;
  position?: string;
  secondaryPosition?: string;
  secondary_position?: string;
  nationality?: string;
  squad_number?: string | number;
  squadNumber?: string | number;
  back_number?: string | number;
  backNumber?: string | number;
  preferredFoot?: string;
  preferred_foot?: string;
  height?: string | number;
  weight?: string | number;
  isOnboarded?: boolean;
  is_onboarded?: boolean;
  onboarding_completed?: boolean;
}

// Represent team stats for a single match (or aggregated)
export interface MatchData {
  id: string; // Unique combination, e.g. "M01"
  fixtureId?: string; // Links to match fixture if uploaded from fixture
  date: string; // YYYY-MM-DD
  competition?: string;
  opponent: string;
  venue?: string; // e.g., "Home", "Away"
  result?: string; // e.g., "W (2-1)", "D (1-1)"
  isOpponentTeam: boolean; // true if it is the opponent's metrics, false if it's our team
  teamName?: string; // Team name associated with these metrics (e.g., "Cardiff Town FC" or opponent's name)
  opponent_id?: string; // ID of opponent team
  opponentXgConceded?: number; // Conceded xG against opponent
  
  // Attack PI
  shots: number;
  shotsOnTarget: number;
  insideBoxShots?: number;
  crossesAttempted?: number;
  successfulCrosses?: number;
  totalPasses?: number;
  successfulPasses?: number;
  progressivePasses?: number;
  finalThirdPasses?: number;
  boxEntries?: number;
  goals: number;

  // Defence PI
  tacklesAttempted?: number;
  tacklesWon?: number;
  interceptions?: number;
  clearances?: number;
  blocks?: number;
  fouls?: number;
  yellowCards?: number;

  // Transition PI
  ballRecoveries?: number;
  counterAttacks?: number;
  turnovers?: number;
  transitionPasses?: number;

  // Possession PI
  possessionRate?: number; // 0 - 100
  longPasses?: number;

  // Set Piece PI
  corners: number;
  freeKicks?: number;
  longThrows?: number;

  // Hudl Sportscode Code Window PI fields
  backwardPasses?: number;
  forwardPasses?: number;
  sidewaysPasses?: number;
  crosses?: number;
  throughBalls?: number;
  keyPasses?: number;
  dribbleSuccess?: number;
  dribbleFail?: number;
  shotOnTarget?: number;
  shotOffTarget?: number;
  shotBlocked?: number;
  finalThirdEntry?: number;
  penaltyAreaEntry?: number;
  aerialDuelWin?: number;
  aerialDuelLoss?: number;
  groundDuelWin?: number;
  groundDuelLoss?: number;
  tackle?: number;
  interception?: number;
  clearance?: number;
  blockedShot?: number;
  foul?: number;
  wasFouled?: number;
  dribbledPast?: number;
  ballRecovery?: number;
  highPressSuccess?: number;
  pressingBypassed?: number;
  miscontrol?: number;
  dispossessed?: number;
  failedPass?: number;
  unsuccessfulDribble?: number;
  offside?: number;
  possessionLost?: number;
  longKick?: number;
  shotPass?: number;
  goalKick?: number;
  gkCatch?: number;
  parriedSafe?: number;
  parriedDanger?: number;
  sweeperAction?: number;
  gk1v1Save?: number;
  highClaim?: number;
  gkPunch?: number;
  gkFlapped?: number;
  cornerD?: number;
  freeKickD?: number;
  cornerA?: number;
  freeKickA?: number;

  // Backward compatible / legacy / computed metrics
  boxShots?: number; // legacy fallback to insideBoxShots
  crossSuccessRate?: number; // legacy fallback Cross success %
  passSuccessRate?: number; // legacy fallback Pass success %
  passes?: number; // legacy fallback to totalPasses
  tacklesSucceeded?: number; // legacy fallback to tacklesWon
  recoveries?: number; // legacy fallback to ballRecoveries
  possessions?: number;
  bigChancesCreated?: number;
}

export type PlayerPosition = "GK" | "LB" | "CB" | "RB" | "DM" | "CM" | "AM" | "LW" | "RW" | "CF";

export interface Player {
  id: string;
  name: string;
  dob?: string; // Date of Birth YYYY-MM-DD
  joinDate?: string; // Team Join Date YYYY-MM-DD
  backNumber: number; // Shirt number
  position: PlayerPosition;
  secondaryPosition?: string;
  image?: string;
  nationality?: string;
  preferredFoot?: string;
  height?: string | number;
  weight?: string | number;
  division?: string;
  teamName?: string;
  teamId?: string;
  
  // Passing
  totalPasses: number;
  successfulPasses: number;
  progressivePasses?: number;
  successfulProgressivePasses?: number;
  finalThirdPasses?: number;
  keyPasses: number;
  throughBalls?: number;
  successfulThroughBalls?: number;

  // Shooting
  shots: number;
  shotsOnTarget: number;
  goals: number;
  xG?: number;

  // Creativity
  assists: number;
  chancesCreated?: number;
  xA?: number;

  // Possession
  touches: number;
  progressiveCarries?: number;
  progressiveDribbles?: number;

  // Duels
  aerialDuels?: number;
  aerialDuelsWon?: number;
  defensiveDuels?: number;
  defensiveDuelsWon?: number;

  // Defensive Actions
  tacklesAttempted?: number;
  tacklesWon?: number; // New standard name instead of tacklesSucceeded
  interceptions?: number;
  clearances?: number;
  ballRecoveries?: number;
  possessionRegains?: number;

  // Attacking Actions
  dribblesAttempted?: number;
  successfulDribbles?: number;
  crossesAttempted?: number;
  successfulCrosses?: number;
  boxEntries?: number;

  // Goalkeeper Actions
  saveAttempts?: number; // New standard name instead of savesAttempted
  saves?: number; // New standard name instead of savesSucceeded
  crossClaims?: number;
  sweeperActions?: number;

  // Match Information
  minutesPlayed: number;
  appearances?: number;

  // Extras
  cleanSheets?: number;

  // Fallbacks for older references
  tacklesSucceeded?: number;
  savesAttempted?: number;
  savesSucceeded?: number;
  forwardPasses?: number;
  successfulForwardPasses?: number;
  interceptionsAttempted?: number;
  successfulInterceptions?: number;
  progressiveRuns?: number;
  turnovers?: number;
  crosses?: number;
  dribbleAttempts?: number;
  successfulAerialDuels?: number;
  passesIntoFinalThird?: number;
  opponentsXgWhenOnPitch?: number;
  errorsLeadingToShot?: number;
  psXgAgainst?: number;
}

export interface MatchFixture {
  id?: string;
  date: string; // YYYY-MM-DD
  opponent: string;
  competition: "League" | "Cup" | "Friendly";
  status: "Upcoming" | "Played";
  venue: "Home" | "Away";
  division?: string;
  ourScore?: number;
  oppScore?: number;
  homeTeam?: string;
  awayTeam?: string;
  homeScore?: number;
  awayScore?: number;
}

export interface CustomTeam {
  id: string;
  name: string;
  league: string;
  homeVenue?: string;
  shortCode?: string;
  mp?: number;
  w?: number;
  d?: number;
  l?: number;
  gf?: number;
  ga?: number;
  
  // Optional team cumulative stats
  totalPasses?: number;
  successfulPasses?: number;
  goals?: number;
  shots?: number;
  shotsOnTarget?: number;
  clearances?: number;
  tacklesWon?: number;
  interceptions?: number;
  ballRecoveries?: number;
  corners?: number;
  possessionRate?: number;
}

export interface HeatmapPoint {
  id?: string;
  matchId: string;
  teamId: string;
  playerId: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  type?: string; // e.g. "Pass", "Shot", "Goal", "Cross", "Clearance", "Activity"
}

