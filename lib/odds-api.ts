// The Odds API — https://the-odds-api.com
// Set ODDS_API_KEY in your .env.local
// Sport key for WC 2026: "soccer_fifa_world_cup" (confirm once tournament is listed)

const ODDS_API_KEY = process.env.ODDS_API_KEY;
const BASE = "https://api.the-odds-api.com/v4";
const SPORT = process.env.ODDS_SPORT_KEY ?? "soccer_fifa_world_cup";

interface OddsOutcome { name: string; price: number }
interface OddsEvent {
  id: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  bookmakers: Array<{
    key: string;
    markets: Array<{ key: string; outcomes: OddsOutcome[] }>;
  }>;
}

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z]/g, "");
}

function teamsMatch(a: string, b: string) {
  const na = norm(a), nb = norm(b);
  return na === nb || na.includes(nb.slice(0, 5)) || nb.includes(na.slice(0, 5));
}

export type UnderdogSide = "home" | "away" | null;

export async function fetchUnderdogSide(
  homeTeamName: string,
  awayTeamName: string
): Promise<UnderdogSide> {
  if (!ODDS_API_KEY) {
    console.warn("ODDS_API_KEY not set — cannot determine underdog");
    return null;
  }

  let events: OddsEvent[];
  try {
    const res = await fetch(
      `${BASE}/sports/${SPORT}/odds/?apiKey=${ODDS_API_KEY}&regions=uk&markets=h2h`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) {
      console.error("Odds API error:", res.status, await res.text());
      return null;
    }
    events = await res.json();
  } catch (e) {
    console.error("Odds API fetch failed:", e);
    return null;
  }

  const event = events.find(
    (e) => teamsMatch(e.home_team, homeTeamName) && teamsMatch(e.away_team, awayTeamName)
  );
  if (!event) return null;

  const bm = event.bookmakers[0];
  if (!bm) return null;
  const h2h = bm.markets.find((m) => m.key === "h2h");
  if (!h2h) return null;

  const homeOdds = h2h.outcomes.find((o) => teamsMatch(o.name, homeTeamName))?.price ?? 0;
  const awayOdds = h2h.outcomes.find((o) => teamsMatch(o.name, awayTeamName))?.price ?? 0;

  if (!homeOdds || !awayOdds) return null;
  return homeOdds > awayOdds ? "home" : "away";
}
