import { MatchData } from "../types";

export interface AttackKPI {
  xG: number;
  shotConversionRate: number; // %
  boxEntries: number;
  finalThirdEntries: number; // derived
  bigChancesCreated: number;
  xgPerPossession: number;
}

export interface DefenseKPI {
  opponentXgConceded: number;
  boxShotsConceded: number;
  defensiveDuelWinRate: number; // %
  ppda: number;
}

export interface TransitionKPI {
  recoveryToShotTime: number; // seconds
  counterAttackXg: number;
  highRegainFrequency: number;
  turnoversLeadingToShots: number;
}

export interface PossessionKPI {
  progressivePasses: number;
  progressiveCarries: number;
  possessionValue: number; // 0 - 100 indicator
  finalThirdPossessionRate: number; // %
}

export interface SetPieceKPI {
  setPieceXg: number;
  setPieceGoals: number;
  cornerConversionRate: number; // %
}

export class KPICalculator {
  // Attack KPIs
  static calculateAttack(m: MatchData): AttackKPI {
    if (m.shots === 0 && m.totalPasses === 0 && m.goals === 0) {
      return { xG: 0, shotConversionRate: 0, boxEntries: 0, finalThirdEntries: 0, bigChancesCreated: 0, xgPerPossession: 0 };
    }

    const preset = typeof window !== "undefined" ? localStorage.getItem("active_kpi_preset") || "Standard K-League" : "Standard K-League";
    const insideBoxShots = m.insideBoxShots !== undefined ? m.insideBoxShots : (m.boxShots !== undefined ? m.boxShots : 0);
    
    // Apply preset multipliers
    let xgMult = 1.0;
    let convMult = 1.0;
    if (preset === "xG Dominance") {
      xgMult = 1.25;
      convMult = 1.15;
    } else if (preset === "High-Pressing Tactical") {
      xgMult = 0.95;
    }

    const xG = ((insideBoxShots * 0.16) + ((m.shots - insideBoxShots) * 0.04)) * xgMult;
    const shotConversionRate = m.shots > 0 ? (m.goals / m.shots) * 100 * convMult : 0;
    const boxEntries = m.boxEntries;
    const finalThirdEntries = m.finalThirdPasses; // Based directly on PI
    const bigChancesCreated = m.bigChancesCreated !== undefined ? m.bigChancesCreated : Math.floor(insideBoxShots * 0.3);
    const possessions = m.possessions ?? 50;
    const xgPerPossession = possessions > 0 ? xG / possessions : 0;

    return {
      xG: parseFloat(xG.toFixed(2)),
      shotConversionRate: parseFloat(Math.min(100, shotConversionRate).toFixed(1)),
      boxEntries,
      finalThirdEntries,
      bigChancesCreated,
      xgPerPossession: parseFloat(xgPerPossession.toFixed(3))
    };
  }

  // Defense KPIs
  static calculateDefense(m: MatchData): DefenseKPI {
    if (m.tacklesAttempted === 0 && m.interceptions === 0 && m.fouls === 0) {
      return { opponentXgConceded: 0, boxShotsConceded: 0, defensiveDuelWinRate: 0, ppda: 0 };
    }

    const preset = typeof window !== "undefined" ? localStorage.getItem("active_kpi_preset") || "Standard K-League" : "Standard K-League";
    
    let defenseMult = 1.0;
    let ppdaScale = 1.0;
    if (preset === "High-Pressing Tactical") {
      defenseMult = 0.85; // Pressing reduces opponent xG conceded!
      ppdaScale = 0.75; // PPDA is lower (better pressing intensity!)
    } else if (preset === "xG Dominance") {
      defenseMult = 1.1;
    }

    const opponentXgConceded = ((m.fouls * 0.06) + (12 - m.interceptions * 0.12) + (m.yellowCards * 0.15)) * defenseMult;
    const boxShotsConceded = Math.max(3, Math.round(14 - (m.interceptions * 0.4) - (m.blocks * 0.6)));
    const tacklesWon = m.tacklesWon !== undefined ? m.tacklesWon : (m.tacklesSucceeded !== undefined ? m.tacklesSucceeded : 0);
    const defensiveDuelWinRate = m.tacklesAttempted > 0 ? (tacklesWon / m.tacklesAttempted) * 100 : 0;
    const ppda = (m.interceptions + (m.tacklesAttempted * 0.9)) > 0 ? (380 / (m.interceptions + (m.tacklesAttempted * 0.9))) * ppdaScale : 0;

    return {
      opponentXgConceded: parseFloat(Math.max(0.2, opponentXgConceded).toFixed(2)),
      boxShotsConceded,
      defensiveDuelWinRate: parseFloat(defensiveDuelWinRate.toFixed(1)),
      ppda: parseFloat(ppda.toFixed(2))
    };
  }

  // Transition KPIs
  static calculateTransition(m: MatchData): TransitionKPI {
    if (m.transitionPasses === 0 && m.counterAttacks === 0 && m.ballRecoveries === 0 && m.turnovers === 0) {
      return { recoveryToShotTime: 0, counterAttackXg: 0, highRegainFrequency: 0, turnoversLeadingToShots: 0 };
    }

    const recoveryToShotTime = Math.max(4.2, 16.5 - (m.transitionPasses * 0.25) - (m.counterAttacks * 0.6));
    const counterAttackXg = m.counterAttacks * 0.15;
    const ballRecoveries = m.ballRecoveries !== undefined ? m.ballRecoveries : (m.recoveries !== undefined ? m.recoveries : 0);
    const highRegainFrequency = Math.round(ballRecoveries * 0.35);
    const turnoversLeadingToShots = Math.round(m.turnovers * 0.18);

    return {
      recoveryToShotTime: parseFloat(recoveryToShotTime.toFixed(1)),
      counterAttackXg: parseFloat(counterAttackXg.toFixed(2)),
      highRegainFrequency,
      turnoversLeadingToShots,
    };
  }

  // Possession KPIs
  static calculatePossession(m: MatchData): PossessionKPI {
    if (m.totalPasses === 0 && m.possessionRate === 0) {
      return { progressivePasses: 0, progressiveCarries: 0, possessionValue: 0, finalThirdPossessionRate: 0 };
    }

    const progressivePasses = m.progressivePasses ?? 0;
    const totalPasses = m.totalPasses !== undefined ? m.totalPasses : (m.passes !== undefined ? m.passes : 350);
    const progressiveCarries = Math.round(totalPasses * 0.06);
    const possessionValue = m.possessionRate * 0.92;
    const finalThirdPossessionRate = (m.possessionRate * 0.45) + 8;

    return {
      progressivePasses,
      progressiveCarries,
      possessionValue: parseFloat(possessionValue.toFixed(1)),
      finalThirdPossessionRate: parseFloat(finalThirdPossessionRate.toFixed(1))
    };
  }

  // Set Piece KPIs
  static calculateSetPiece(m: MatchData): SetPieceKPI {
    if (m.corners === 0 && m.freeKicks === 0 && m.longThrows === 0) {
      return { setPieceXg: 0, setPieceGoals: 0, cornerConversionRate: 0 };
    }

    const setPieceXg = (m.corners * 0.08) + (m.freeKicks * 0.12) + (m.longThrows * 0.05);
    const setPieceGoals = Math.round(setPieceXg * 0.75);
    const cornerConversionRate = m.corners > 0 ? (setPieceGoals / m.corners) * 100 : 0;

    return {
      setPieceXg: parseFloat(setPieceXg.toFixed(2)),
      setPieceGoals,
      cornerConversionRate: parseFloat(cornerConversionRate.toFixed(1))
    };
  }

  // Helper: Aggregate standard averages to display on cards
  static getAverage(matches: MatchData[]): MatchData {
    if (matches.length === 0) {
      return {
        id: "avg", date: "", competition: "Korea K-League", opponent: "Averages", venue: "Home", result: "D (1-1)", isOpponentTeam: false,
        shots: 0, shotsOnTarget: 0, insideBoxShots: 0, crossesAttempted: 0, successfulCrosses: 0,
        totalPasses: 0, successfulPasses: 0, progressivePasses: 0, finalThirdPasses: 0, boxEntries: 0, goals: 0,
        tacklesAttempted: 0, tacklesWon: 0, interceptions: 0, clearances: 0, blocks: 0,
        fouls: 0, yellowCards: 0, ballRecoveries: 0, counterAttacks: 0, turnovers: 0,
        transitionPasses: 0, possessionRate: 0, longPasses: 0, corners: 0,
        freeKicks: 0, longThrows: 0, bigChancesCreated: 0
      };
    }

    const avg: Partial<MatchData> = {
      id: "avg",
      date: "",
      competition: matches[0].competition || "Korea K-League",
      opponent: "Averages",
      venue: "Home",
      result: "D (1-1)",
      isOpponentTeam: matches[0].isOpponentTeam,
    };

    const keys: (keyof MatchData)[] = [
      "shots", "shotsOnTarget", "insideBoxShots", "crossesAttempted", "successfulCrosses",
      "totalPasses", "successfulPasses", "progressivePasses", "finalThirdPasses", "boxEntries", "goals",
      "tacklesAttempted", "tacklesWon", "interceptions", "clearances", "blocks",
      "fouls", "yellowCards", "ballRecoveries", "counterAttacks", "turnovers",
      "transitionPasses", "possessionRate", "longPasses", "corners",
      "freeKicks", "longThrows"
    ];

    for (const key of keys) {
      const sum = matches.reduce((acc, m) => acc + (Number(m[key]) || 0), 0);
      (avg as any)[key] = parseFloat((sum / matches.length).toFixed(1));
    }

    // Set legacy schema properties for safety and backward rendering
    avg.boxShots = avg.insideBoxShots;
    avg.passes = avg.totalPasses;
    avg.tacklesSucceeded = avg.tacklesWon;
    avg.recoveries = avg.ballRecoveries;
    avg.passSuccessRate = avg.totalPasses !== undefined && avg.totalPasses > 0 ? parseFloat(((avg.successfulPasses || 0) / avg.totalPasses * 100).toFixed(1)) : 0;
    avg.crossSuccessRate = avg.crossesAttempted !== undefined && avg.crossesAttempted > 0 ? parseFloat(((avg.successfulCrosses || 0) / avg.crossesAttempted * 100).toFixed(1)) : 0;
    avg.forwardPasses = avg.progressivePasses;

    return avg as MatchData;
  }
}
