import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db";
import { fetchWorldCupMatches, fetchWorldCupTeams, mapApiStageToDb } from "@/lib/football-api";

export async function POST(req: NextRequest) {
  if (req.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const apiTeams = await fetchWorldCupTeams();
  for (const t of apiTeams) {
    await supabaseAdmin.from("teams").upsert(
      { name: t.name, flag_url: t.crest, external_id: t.id },
      { onConflict: "external_id" }
    );
  }

  const apiMatches = await fetchWorldCupMatches();
  for (const m of apiMatches) {
    const { data: teamA } = await supabaseAdmin.from("teams").select("id").eq("external_id", m.homeTeam.id).single();
    const { data: teamB } = await supabaseAdmin.from("teams").select("id").eq("external_id", m.awayTeam.id).single();
    if (!teamA || !teamB) continue;

    await supabaseAdmin.from("matches").upsert({
      external_id: m.id,
      team_a_id: teamA.id,
      team_b_id: teamB.id,
      kickoff_time: m.utcDate,
      stage: mapApiStageToDb(m.stage),
      team_a_score: m.score.fullTime.home,
      team_b_score: m.score.fullTime.away,
      status: m.status === "FINISHED" ? "finished" : "scheduled",
    }, { onConflict: "external_id" });
  }

  return NextResponse.json({ synced: apiMatches.length });
}
