import { MatchFixture, CustomTeam } from "../types";

export const LEAGUES = [
  "CCFL Premier Division",
  "CCFL First Division",
  "CCFL Reserve Premier Division",
  "CCFL Reserve First Division"
] as const;

export type LeagueDivisionName = typeof LEAGUES[number];

export interface TeamStanding {
  name: string;
  mp: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
}

export function calculateDivisionStandings(
  divisionName: string,
  fixtures: MatchFixture[],
  customTeams: CustomTeam[] = []
): TeamStanding[] {
  const teamsMap: Record<string, { mp: number; w: number; d: number; l: number; gf: number; ga: number }> = {};

  const matchesDivision = (teamLeague?: string, currentDivision?: string): boolean => {
    if (!teamLeague || !currentDivision) return false;
    const norm1 = teamLeague.toLowerCase().replace(/division/g, "").trim();
    const norm2 = currentDivision.toLowerCase().replace(/division/g, "").trim();
    return norm1 === norm2 || norm1.includes(norm2) || norm2.includes(norm1);
  };

  // 1. Include registered teams configured for this division from database
  customTeams.forEach(t => {
    if (!t.league || matchesDivision(t.league, divisionName)) {
      if (!teamsMap[t.name]) {
        teamsMap[t.name] = { mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 };
      }
      if ((t.mp ?? 0) > 0 || (t.w ?? 0) > 0 || (t.d ?? 0) > 0 || (t.l ?? 0) > 0) {
        teamsMap[t.name].mp = Math.max(teamsMap[t.name].mp, t.mp ?? 0);
        teamsMap[t.name].w = Math.max(teamsMap[t.name].w, t.w ?? 0);
        teamsMap[t.name].d = Math.max(teamsMap[t.name].d, t.d ?? 0);
        teamsMap[t.name].l = Math.max(teamsMap[t.name].l, t.l ?? 0);
        teamsMap[t.name].gf = Math.max(teamsMap[t.name].gf, t.gf ?? 0);
        teamsMap[t.name].ga = Math.max(teamsMap[t.name].ga, t.ga ?? 0);
      }
    }
  });

  // 2. Process completed fixtures (Match Schedule Database)
  fixtures.forEach(f => {
    if (f.status !== "Played") return;
    if (f.competition && f.competition.toLowerCase() !== "league" && f.competition.toLowerCase() !== "all") return;

    const hScore = f.homeScore !== undefined ? f.homeScore : f.ourScore;
    const aScore = f.awayScore !== undefined ? f.awayScore : f.oppScore;
    if (hScore === undefined || aScore === undefined) return;

    const homeTeam = f.homeTeam || (f.venue === "Home" ? "Cardiff Town FC" : f.opponent);
    const awayTeam = f.awayTeam || (f.venue === "Away" ? "Cardiff Town FC" : f.opponent);

    // Check if this fixture belongs to divisionName
    const isDivisionMatch = 
      matchesDivision((f as any).league, divisionName) ||
      customTeams.some(t => (!t.league || matchesDivision(t.league, divisionName)) && (t.name === homeTeam || t.name === awayTeam));

    if (!isDivisionMatch) return;

    // Home Team Stats
    if (!teamsMap[homeTeam]) {
      teamsMap[homeTeam] = { mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 };
    }
    teamsMap[homeTeam].mp += 1;
    teamsMap[homeTeam].gf += hScore;
    teamsMap[homeTeam].ga += aScore;
    if (hScore > aScore) teamsMap[homeTeam].w += 1;
    else if (hScore === aScore) teamsMap[homeTeam].d += 1;
    else teamsMap[homeTeam].l += 1;

    // Away Team Stats
    if (!teamsMap[awayTeam]) {
      teamsMap[awayTeam] = { mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 };
    }
    teamsMap[awayTeam].mp += 1;
    teamsMap[awayTeam].gf += aScore;
    teamsMap[awayTeam].ga += hScore;
    if (aScore > hScore) teamsMap[awayTeam].w += 1;
    else if (aScore === hScore) teamsMap[awayTeam].d += 1;
    else teamsMap[awayTeam].l += 1;
  });

  // 4. Calculate GD and Points
  const standings: TeamStanding[] = Object.entries(teamsMap).map(([name, stats]) => {
    const gd = stats.gf - stats.ga;
    const pts = stats.w * 3 + stats.d;
    return {
      name,
      ...stats,
      gd,
      pts
    };
  });

  // 5. Sort: Pts -> GD -> GF -> Alphabetical Name
  return standings.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.name.localeCompare(b.name, "en");
  });
}
