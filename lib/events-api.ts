const BASE = "https://soccer.highlightly.net";
const KEY = process.env.HIGHLIGHTLY_KEY!;
const RAPIDAPI_HOST = "soccer.highlightly.net";

interface HighlightlyMatch {
  id: string;
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string };
}

interface HighlightlyEvent {
  type: string;   // "GOAL", "RED_CARD", "YELLOW_RED_CARD", "VAR_GOAL_CANCELLED", etc.
  teamId: string;
  playerId: string;
}

function normalize(name: string) {
  return name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");
}

function teamMatch(a: string, b: string) {
  const na = normalize(a);
  const nb = normalize(b);
  return na === nb
    || na.startsWith(nb.slice(0, 5))
    || nb.startsWith(na.slice(0, 5))
    || na.includes(nb.slice(0, 6))
    || nb.includes(na.slice(0, 6));
}

async function findMatchId(date: string, homeTeam: string, awayTeam: string): Promise<HighlightlyMatch | null> {
  const res = await fetch(`${BASE}/matches?date=${date}&leagueId=1635`, {
    headers: { "x-rapidapi-key": KEY, "x-rapidapi-host": RAPIDAPI_HOST },
    next: { revalidate: 0 },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const matches: HighlightlyMatch[] = data.data ?? data ?? [];
  return matches.find(m =>
    teamMatch(m.homeTeam.name, homeTeam) && teamMatch(m.awayTeam.name, awayTeam)
  ) ?? null;
}

export async function fetchChaosEventsForMatch(
  kickoffTime: string,
  homeTeamName: string,
  awayTeamName: string,
): Promise<string[]> {
  if (!KEY) return [];

  const date = kickoffTime.slice(0, 10);
  const match = await findMatchId(date, homeTeamName, awayTeamName);
  if (!match) return [];

  const res = await fetch(`${BASE}/matches/${match.id}/events`, {
    headers: { "x-rapidapi-key": KEY, "x-rapidapi-host": RAPIDAPI_HOST },
    next: { revalidate: 0 },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) return [];
  const data = await res.json();
  const events: HighlightlyEvent[] = data.data ?? data ?? [];

  const chaos: string[] = [];

  // common — red card or second yellow
  if (events.some(e => e.type === "RED_CARD" || e.type === "YELLOW_RED_CARD"))
    chaos.push("common");

  // medium — VAR cancelled goal
  if (events.some(e => e.type === "VAR_GOAL_CANCELLED"))
    chaos.push("medium");

  // rare_a / rare_b — hat-trick (same player 3+ goals for their team)
  const goalCounts: Record<string, { teamId: string; count: number }> = {};
  for (const e of events) {
    if (e.type === "GOAL") {
      if (!goalCounts[e.playerId]) goalCounts[e.playerId] = { teamId: e.teamId, count: 0 };
      goalCounts[e.playerId].count++;
    }
  }
  for (const { teamId, count } of Object.values(goalCounts)) {
    if (count >= 3) {
      if (teamId === match.homeTeam.id) chaos.push("rare_a");
      if (teamId === match.awayTeam.id) chaos.push("rare_b");
    }
  }

  return [...new Set(chaos)];
}
