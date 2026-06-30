import { supabaseAdmin } from "@/lib/db";
import { getDbUser } from "@/lib/auth";
import { ResultsMatchCard } from "@/components/ResultsMatchCard";
import { BarChart2 } from "lucide-react";

export const dynamic = "force-dynamic";

type RawMatch = {
  id: number; kickoff_time: string; status: string; stage: string; matchday: number | null;
  team_a_score: number | null; team_b_score: number | null; team_a_id: number; team_b_id: number;
  penalty_score_a: number | null; penalty_score_b: number | null;
};
type RawTeam = { id: number; name: string; flag_url: string | null; iso_code: string | null };

function toUTC(s: string) {
  const n = s.replace(' ', 'T');
  return new Date(n.includes('+') || n.endsWith('Z') ? n : n + 'Z').getTime();
}

export default async function ResultsPage() {
  const now = Date.now();

  const [{ data: finishedRaw }, { data: scheduledRaw }, { data: allTeams }, dbUser] = await Promise.all([
    supabaseAdmin
      .from("matches")
      .select("id, kickoff_time, status, stage, matchday, team_a_score, team_b_score, team_a_id, team_b_id, penalty_score_a, penalty_score_b")
      .eq("status", "finished")
      .not("team_a_score", "is", null)
      .order("kickoff_time", { ascending: false })
      .limit(30),
    supabaseAdmin
      .from("matches")
      .select("id, kickoff_time, status, stage, matchday, team_a_score, team_b_score, team_a_id, team_b_id, penalty_score_a, penalty_score_b")
      .in("status", ["live", "scheduled"])
      .order("kickoff_time"),
    supabaseAdmin.from("teams").select("id, name, flag_url, iso_code"),
    getDbUser(),
  ]);

  const ONE_HOUR = 60 * 60 * 1000;
  const activeRaw = (scheduledRaw ?? []).filter(m => m.status === "live" || toUTC(m.kickoff_time) - now <= ONE_HOUR);

  const teamMap = Object.fromEntries(((allTeams ?? []) as RawTeam[]).map(t => [t.id, t]));

  function enrich(m: RawMatch) {
    return {
      ...m,
      teamA: teamMap[m.team_a_id] ?? { id: m.team_a_id, name: "TBD", flag_url: null, iso_code: null },
      teamB: teamMap[m.team_b_id] ?? { id: m.team_b_id, name: "TBD", flag_url: null, iso_code: null },
    };
  }

  const finished = (finishedRaw as RawMatch[] ?? []).map(enrich);
  const active = (activeRaw as RawMatch[] ?? []).map(enrich);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px", paddingBottom: 80 }}>
      <div style={{ paddingTop: 24, marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: "var(--wc-text-1)", letterSpacing: "-0.02em", margin: 0 }}>
          Results
        </h1>
        <p style={{ fontSize: 13, color: "var(--wc-text-2)", marginTop: 4 }}>
          See how everyone predicted each match.
        </p>
      </div>

      {active.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--wc-green)", marginBottom: 12 }}>
            Live / Locked
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {active.map(m => (
              <ResultsMatchCard key={m.id} match={m} currentUserId={dbUser?.id ?? null} />
            ))}
          </div>
        </section>
      )}

      {finished.length > 0 ? (
        <section>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--wc-text-3)", marginBottom: 12 }}>
            Finished
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {finished.map(m => (
              <ResultsMatchCard key={m.id} match={m} currentUserId={dbUser?.id ?? null} />
            ))}
          </div>
        </section>
      ) : (
        <div style={{ textAlign: "center", padding: "60px 16px" }}>
          <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}>
            <BarChart2 size={40} color="var(--wc-text-3)" strokeWidth={1.5} />
          </div>
          <p style={{ color: "var(--wc-text-3)", fontSize: 14 }}>No finished matches yet.</p>
        </div>
      )}
    </div>
  );
}
