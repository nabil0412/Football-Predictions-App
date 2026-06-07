const BASE_URL = "https://api.football-data.org/v4";
const API_KEY = process.env.FOOTBALL_DATA_API_KEY!;

const headers = {
  "X-Auth-Token": API_KEY,
};

export interface ApiTeam {
  id: number;
  name: string;
  crest: string;
}

export interface ApiMatch {
  id: number;
  utcDate: string;
  status: string; // SCHEDULED, TIMED, IN_PLAY, PAUSED, FINISHED, SUSPENDED, POSTPONED, CANCELLED, AWARDED
  stage: string;
  homeTeam: ApiTeam;
  awayTeam: ApiTeam;
  score: {
    fullTime: { home: number | null; away: number | null };
  };
}

export async function fetchWorldCupMatches(): Promise<ApiMatch[]> {
  const res = await fetch(`${BASE_URL}/competitions/WC/matches`, { headers });
  if (!res.ok) throw new Error(`football-data.org error: ${res.status}`);
  const data = await res.json();
  return data.matches as ApiMatch[];
}

export async function fetchMatch(matchId: number): Promise<ApiMatch> {
  const res = await fetch(`${BASE_URL}/matches/${matchId}`, { headers });
  if (!res.ok) throw new Error(`football-data.org error: ${res.status}`);
  return res.json() as Promise<ApiMatch>;
}

export async function fetchWorldCupTeams(): Promise<ApiTeam[]> {
  const res = await fetch(`${BASE_URL}/competitions/WC/teams`, { headers });
  if (!res.ok) throw new Error(`football-data.org error: ${res.status}`);
  const data = await res.json();
  return data.teams as ApiTeam[];
}

export function mapApiStageToDb(apiStage: string): string {
  const map: Record<string, string> = {
    GROUP_STAGE: "group",
    ROUND_OF_32: "round_of_32",
    LAST_16: "round_of_16",
    QUARTER_FINALS: "quarter_final",
    SEMI_FINALS: "semi_final",
    FINAL: "final",
  };
  return map[apiStage] ?? "group";
}
