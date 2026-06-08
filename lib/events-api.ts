const BASE = "https://v3.football.api-sports.io";
const KEY = process.env.APIFOOTBALL_KEY!;
const WC_LEAGUE = 1;
const WC_SEASON = 2026;

export interface ApiFootballFixture {
  fixture: { id: number; date: string; status: { short: string } };
  league: { round: string };
  teams: {
    home: { id: number; name: string; logo: string };
    away: { id: number; name: string; logo: string };
  };
  goals: { home: number | null; away: number | null };
}

interface ApiEvent {
  team: { id: number };
  player: { id: number };
  type: string;
  detail: string;
}

const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);
const LIVE_STATUSES = new Set(["1H", "HT", "2H", "ET", "BT", "P", "LIVE"]);

export function mapRound(round: string): string {
  if (round.startsWith("Group")) return "group";
  if (round.includes("32")) return "round_of_32";
  if (round.includes("16")) return "round_of_16";
  if (round.includes("Quarter")) return "quarter_final";
  if (round.includes("Semi")) return "semi_final";
  if (round.includes("Final")) return "final";
  return "group";
}

export function mapStatus(short: string): "scheduled" | "finished" | "live" | null {
  if (FINISHED_STATUSES.has(short)) return "finished";
  if (LIVE_STATUSES.has(short)) return "live";
  if (["NS", "TBD"].includes(short)) return "scheduled";
  return null; // postponed/cancelled — skip
}

export async function fetchAllFixtures(): Promise<ApiFootballFixture[]> {
  const res = await fetch(`${BASE}/fixtures?league=${WC_LEAGUE}&season=${WC_SEASON}`, {
    headers: { "x-apisports-key": KEY },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`API-Football fixtures error: ${res.status}`);
  const data = await res.json();
  return data.response ?? [];
}

export async function fetchChaosEvents(fixtureId: number): Promise<string[]> {
  const res = await fetch(`${BASE}/fixtures/events?fixture=${fixtureId}`, {
    headers: { "x-apisports-key": KEY },
    next: { revalidate: 0 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const events: ApiEvent[] = data.response ?? [];

  const chaos: string[] = [];

  // common — red card or second yellow
  if (events.some(e => e.type === "Card" && (e.detail === "Red Card" || e.detail === "Yellow Red Card")))
    chaos.push("common");

  // medium — VAR cancelled goal
  if (events.some(e => e.type === "Var" && e.detail.toLowerCase().includes("goal cancelled")))
    chaos.push("medium");

  // rare_a / rare_b — hat-trick by a single player
  const goalCounts: Record<string, { team: number; count: number }> = {};
  for (const e of events) {
    if (e.type === "Goal" && e.detail !== "Own Goal") {
      const key = String(e.player.id);
      if (!goalCounts[key]) goalCounts[key] = { team: e.team.id, count: 0 };
      goalCounts[key].count++;
    }
  }
  // need home/away team IDs to distinguish rare_a vs rare_b — caller passes them separately
  // we return raw player→team data as a temporary map for the caller to resolve
  // (see scoreMatch in sync-matches)
  for (const [, { count }] of Object.entries(goalCounts)) {
    if (count >= 3) {
      // we can't distinguish home/away here without fixture context — handled in sync-matches
    }
  }

  return [...new Set(chaos)];
}

// Full version used in sync-matches (has fixture context)
export async function fetchChaosEventsForFixture(fixture: ApiFootballFixture): Promise<string[]> {
  const res = await fetch(`${BASE}/fixtures/events?fixture=${fixture.fixture.id}`, {
    headers: { "x-apisports-key": KEY },
    next: { revalidate: 0 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const events: ApiEvent[] = data.response ?? [];

  const chaos: string[] = [];

  if (events.some(e => e.type === "Card" && (e.detail === "Red Card" || e.detail === "Yellow Red Card")))
    chaos.push("common");

  if (events.some(e => e.type === "Var" && e.detail.toLowerCase().includes("goal cancelled")))
    chaos.push("medium");

  const homeId = fixture.teams.home.id;
  const awayId = fixture.teams.away.id;
  const goalCounts: Record<string, { team: number; count: number }> = {};
  for (const e of events) {
    if (e.type === "Goal" && e.detail !== "Own Goal") {
      const key = String(e.player.id);
      if (!goalCounts[key]) goalCounts[key] = { team: e.team.id, count: 0 };
      goalCounts[key].count++;
    }
  }
  for (const { team, count } of Object.values(goalCounts)) {
    if (count >= 3) {
      if (team === homeId) chaos.push("rare_a");
      if (team === awayId) chaos.push("rare_b");
    }
  }

  return [...new Set(chaos)];
}
