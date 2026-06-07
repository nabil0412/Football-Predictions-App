import { supabaseAdmin } from "@/lib/db";
import { getDbUser } from "@/lib/auth";
import { MatchList } from "@/components/MatchList";

export const revalidate = 60;

export default async function HomePage() {
  const now = new Date().toISOString();

  const [{ data: upcoming }, { data: allTeams }, dbUser] = await Promise.all([
    supabaseAdmin
      .from("matches")
      .select("id, kickoff_time, status, stage, matchday, team_a_score, team_b_score, team_a_id, team_b_id")
      .gte("kickoff_time", now)
      .order("kickoff_time"),
    supabaseAdmin.from("teams").select("id, name, flag_url, iso_code"),
    getDbUser(),
  ]);

  type RawMatch = { id: number; kickoff_time: string; status: string; stage: string; matchday: number | null; team_a_score: number | null; team_b_score: number | null; team_a_id: number; team_b_id: number };
  type RawTeam  = { id: number; name: string; flag_url: string | null; iso_code: string | null };

  const teamMap = Object.fromEntries((allTeams as RawTeam[] ?? []).map(t => [t.id, t]));
  const enriched = (upcoming as RawMatch[] ?? []).map(m => ({
    ...m,
    teamA: teamMap[m.team_a_id] ?? { id: m.team_a_id, name: `Team ${m.team_a_id}`, flag_url: null, iso_code: null },
    teamB: teamMap[m.team_b_id] ?? { id: m.team_b_id, name: `Team ${m.team_b_id}`, flag_url: null, iso_code: null },
  }));

  // Fetch user's predictions to show on home page
  type PredRow = { match_id: number; predicted_team_a_goals: number; predicted_team_b_goals: number; wildcard_type: string | null; points_earned: number | null };
  let predictions: Record<number, { homeGoals: number; awayGoals: number; wildcard?: string | null; points?: number | null }> = {};
  if (dbUser) {
    const { data: preds } = await supabaseAdmin
      .from("predictions")
      .select("match_id, predicted_team_a_goals, predicted_team_b_goals, wildcard_type, points_earned")
      .eq("user_id", dbUser.id);
    predictions = Object.fromEntries(
      (preds as PredRow[] ?? []).map(p => [p.match_id, {
        homeGoals: p.predicted_team_a_goals,
        awayGoals: p.predicted_team_b_goals,
        wildcard: p.wildcard_type,
        points: p.points_earned,
      }])
    );
  }

  const daysLeft = Math.max(0, Math.ceil((new Date("2026-06-11T19:00:00Z").getTime() - Date.now()) / 86400000));
  const started  = Date.now() >= new Date("2026-06-11T19:00:00Z").getTime();

  return (
    <>
      {/* Hero — full width */}
      <div style={{
        background: "linear-gradient(160deg, #0a1f12 0%, #0b1629 50%, #080e1a 100%)",
        borderBottom: "1px solid var(--wc-border)",
        padding: "40px 24px 36px",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", inset: 0, opacity: 0.03,
          backgroundImage: "repeating-linear-gradient(0deg,#fff 0,#fff 1px,transparent 1px,transparent 40px),repeating-linear-gradient(90deg,#fff 0,#fff 1px,transparent 1px,transparent 40px)",
          pointerEvents: "none",
        }} />
        <div style={{ maxWidth: 720, margin: "0 auto", position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--wc-green)", marginBottom: 6 }}>
              Football 2026
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 900, color: "var(--wc-text-1)", lineHeight: 1.1, letterSpacing: "-0.02em", margin: 0 }}>
              Predictions
            </h1>
            <div style={{ height: 2, width: 32, background: "var(--wc-green)", margin: "10px 0" }} />
            <p style={{ fontSize: 13, color: "var(--wc-text-2)", margin: 0 }}>
              48 teams · 104 matches · Jun 11 – Jul 19
            </p>
            <div style={{ display: "flex", gap: 24, marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              {[["48", "Teams"], ["104", "Matches"], ["Jun 11", "Kickoff"]].map(([val, lbl]) => (
                <div key={lbl}>
                  <div style={{ fontSize: 17, fontWeight: 900, color: "var(--wc-text-1)", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{val}</div>
                  <div style={{ fontSize: 10, color: "var(--wc-text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginTop: 3 }}>{lbl}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            {!started ? (
              <>
                <div style={{ fontSize: 52, fontWeight: 900, color: "var(--wc-green)", lineHeight: 1, letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums" }}>
                  {daysLeft}
                </div>
                <div style={{ fontSize: 11, color: "var(--wc-text-2)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 4 }}>
                  days to go
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 11, color: "var(--wc-green)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Live</div>
                <div style={{ fontSize: 11, color: "var(--wc-text-3)", marginTop: 2 }}>Tournament in progress</div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Match list */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px" }}>
        <MatchList matches={enriched} predictions={predictions} />
      </div>
    </>
  );
}
