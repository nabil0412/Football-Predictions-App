import { supabaseAdmin } from "@/lib/db";
import { getOrCreateDbUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import { PredictionForm } from "@/components/PredictionForm";

export const dynamic = "force-dynamic";

export default async function PredictionPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const id = parseInt(matchId);
  if (isNaN(id)) notFound();

  const [{ data: match }, dbUser] = await Promise.all([
    supabaseAdmin.from("matches").select().eq("id", id).single(),
    getOrCreateDbUser(),
  ]);
  if (!match) notFound();

  const [{ data: teamA }, { data: teamB }] = await Promise.all([
    supabaseAdmin.from("teams").select("id, name, flag_url, iso_code").eq("id", match.team_a_id).single(),
    supabaseAdmin.from("teams").select("id, name, flag_url, iso_code").eq("id", match.team_b_id).single(),
  ]);
  if (!teamA || !teamB) notFound();

  const { data: matchFull } = await supabaseAdmin
    .from("matches")
    .select("underdog_team_id, comeback_team_id")
    .eq("id", id)
    .single();

  const [{ data: existing }, { data: wcRows }] = await Promise.all([
    dbUser
      ? supabaseAdmin.from("predictions").select("*").eq("user_id", dbUser.id).eq("match_id", id).maybeSingle()
      : Promise.resolve({ data: null }),
    dbUser
      ? supabaseAdmin.from("wildcard_usage").select("wildcard_type").eq("user_id", dbUser.id).neq("match_id", id)
      : Promise.resolve({ data: [] }),
  ]);

  const wildcardUsed: Record<string, number> = {};
  for (const row of wcRows ?? []) {
    wildcardUsed[row.wildcard_type] = (wildcardUsed[row.wildcard_type] ?? 0) + 1;
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "8px 16px" }}>
      <PredictionForm
        match={{
          id: match.id, kickoffTime: match.kickoff_time,
          status: match.status, stage: match.stage,
          teamAScore: match.team_a_score, teamBScore: match.team_b_score,
          teamA: { id: teamA.id, name: teamA.name, flagUrl: teamA.flag_url, isoCode: teamA.iso_code },
          teamB: { id: teamB.id, name: teamB.name, flagUrl: teamB.flag_url, isoCode: teamB.iso_code },
        }}
        existing={existing ?? null}
        wildcardUsed={wildcardUsed}
        underdogTeamId={matchFull?.underdog_team_id ?? null}
        comebackTeamId={matchFull?.comeback_team_id ?? null}
      />
    </div>
  );
}
