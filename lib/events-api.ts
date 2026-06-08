const BASE = "https://v3.football.api-sports.io";
const KEY = process.env.APIFOOTBALL_KEY!;

interface ApiFixture {
  fixture: { id: number };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
}

interface ApiEvent {
  team: { id: number; name: string };
  player: { id: number; name: string };
  type: string;   // "Goal" | "Card" | "Var" | "Subst"
  detail: string; // "Normal Goal" | "Red Card" | "Yellow Red Card" | "Goal cancelled" | ...
}

function normalize(name: string) {
  return name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");
}

function teamMatch(a: string, b: string) {
  const na = normalize(a);
  const nb = normalize(b);
  return na === nb || na.startsWith(nb.slice(0, 5)) || nb.startsWith(na.slice(0, 5)) || na.includes(nb.slice(0, 6)) || nb.includes(na.slice(0, 6));
}

async function findFixture(date: string, homeTeam: string, awayTeam: string): Promise<ApiFixture | null> {
  const res = await fetch(`${BASE}/fixtures?date=${date}&league=1&season=2026`, {
    headers: { "x-apisports-key": KEY },
    next: { revalidate: 0 },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const fixtures: ApiFixture[] = data.response ?? [];
  return fixtures.find(f =>
    teamMatch(f.teams.home.name, homeTeam) && teamMatch(f.teams.away.name, awayTeam)
  ) ?? null;
}

export async function fetchChaosEvents(
  kickoffTime: string,
  homeTeamName: string,
  awayTeamName: string,
): Promise<string[]> {
  const date = kickoffTime.slice(0, 10);
  const fixture = await findFixture(date, homeTeamName, awayTeamName);
  if (!fixture) return [];

  const res = await fetch(`${BASE}/fixtures/events?fixture=${fixture.fixture.id}`, {
    headers: { "x-apisports-key": KEY },
    next: { revalidate: 0 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const events: ApiEvent[] = data.response ?? [];

  const chaos: string[] = [];

  // common — red card (direct or second yellow)
  const hasRed = events.some(e => e.type === "Card" && (e.detail === "Red Card" || e.detail === "Yellow Red Card"));
  if (hasRed) chaos.push("common");

  // medium — VAR cancelled goal
  const hasVarCancel = events.some(e => e.type === "Var" && e.detail.toLowerCase().includes("goal cancelled"));
  if (hasVarCancel) chaos.push("medium");

  // rare_a — hat-trick by home team player
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

  return [...new Set(chaos)]; // deduplicate
}
