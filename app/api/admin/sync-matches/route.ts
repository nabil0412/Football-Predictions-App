import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db";
import { fetchAllFixtures, fetchChaosEventsForFixture, mapRound, mapStatus } from "@/lib/events-api";
import { calculateScore, CAPTAIN_STAGE_BONUS, type ChaosCardType } from "@/lib/scoring";
import { redis, CACHE_KEYS } from "@/lib/redis";

export async function POST(req: NextRequest) {
  if (req.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const fixtures = await fetchAllFixtures();
  let synced = 0;
  let scored = 0;

  for (const f of fixtures) {
    const status = mapStatus(f.fixture.status.short);
    if (status === null) continue; // postponed/cancelled — skip

    // Upsert teams
    const [{ data: teamA }, { data: teamB }] = await Promise.all([
      supabaseAdmin.from("teams")
        .upsert({ name: f.teams.home.name, flag_url: f.teams.home.logo, external_id: f.teams.home.id }, { onConflict: "external_id" })
        .select("id").single(),
      supabaseAdmin.from("teams")
        .upsert({ name: f.teams.away.name, flag_url: f.teams.away.logo, external_id: f.teams.away.id }, { onConflict: "external_id" })
        .select("id").single(),
    ]);
    if (!teamA || !teamB) continue;

    // Check existing match status
    const { data: existing } = await supabaseAdmin
      .from("matches")
      .select("id, status")
      .eq("external_id", f.fixture.id)
      .maybeSingle();

    const homeScore = status === "finished" ? (f.goals.home ?? null) : null;
    const awayScore = status === "finished" ? (f.goals.away ?? null) : null;
    const stage = mapRound(f.league.round);

    await supabaseAdmin.from("matches").upsert({
      external_id: f.fixture.id,
      team_a_id: teamA.id,
      team_b_id: teamB.id,
      kickoff_time: f.fixture.date,
      stage,
      status,
      team_a_score: homeScore,
      team_b_score: awayScore,
    }, { onConflict: "external_id" });

    synced++;

    // Auto-score when match first transitions to finished
    const justFinished = status === "finished" && existing?.status !== "finished";
    if (justFinished && existing?.id && homeScore != null && awayScore != null) {
      const chaosEvents = await fetchChaosEventsForFixture(f);
      if (chaosEvents.length > 0) {
        await supabaseAdmin
          .from("matches")
          .update({ chaos_events_occurred: chaosEvents } as never)
          .eq("id", existing.id);
      }
      scored += await scoreMatch(existing.id, homeScore, awayScore, stage, teamA.id, teamB.id, chaosEvents);
    }
  }

  if (scored > 0) await redis.del(CACHE_KEYS.globalLeaderboard).catch(() => {});

  return NextResponse.json({ synced, scored });
}

async function scoreMatch(
  matchId: number,
  teamAScore: number,
  teamBScore: number,
  stage: string,
  teamAId: number,
  teamBId: number,
  chaosEventsOccurred: string[],
): Promise<number> {
  const { data: predictions } = await supabaseAdmin
    .from("predictions")
    .select("*")
    .eq("match_id", matchId)
    .is("points_earned", null);

  if (!predictions?.length) return 0;

  const { data: ext } = await supabaseAdmin
    .from("matches")
    .select("underdog_team_id")
    .eq("id", matchId)
    .single();

  const underdogTeamId = (ext as never as { underdog_team_id: number | null } | null)?.underdog_team_id ?? null;
  const underdogOutcome = underdogTeamId
    ? (underdogTeamId === teamAId ? "team_a_win" : "team_b_win") as "team_a_win" | "team_b_win"
    : undefined;

  for (const prediction of predictions) {
    const score = calculateScore(
      {
        predictedResult: prediction.predicted_result,
        predictedTeamAGoals: prediction.predicted_team_a_goals,
        predictedTeamBGoals: prediction.predicted_team_b_goals,
        wildcardType: prediction.wildcard_type ?? undefined,
        chaosCardType: prediction.chaos_card_type ?? undefined,
      },
      { teamAScore, teamBScore },
      { underdogOutcome, chaosEventsOccurred: chaosEventsOccurred as ChaosCardType[] }
    );

    await supabaseAdmin.from("predictions").update({ points_earned: score.total }).eq("id", prediction.id);

    if (prediction.wildcard_type) {
      await supabaseAdmin
        .from("wildcard_usage")
        .update({ points_effect: score.wildcardEffect })
        .eq("user_id", prediction.user_id)
        .eq("match_id", matchId);
    }

    const { data: u } = await supabaseAdmin.from("users").select("total_score").eq("id", prediction.user_id).single();
    if (u) {
      await supabaseAdmin.from("users").update({ total_score: u.total_score + score.total }).eq("id", prediction.user_id);
    }
  }

  // Captain stage bonuses for KO rounds
  const koStages = ["round_of_32", "round_of_16", "quarter_final", "semi_final", "final"];
  if (koStages.includes(stage) && teamAScore !== teamBScore) {
    const winningTeamId = teamAScore > teamBScore ? teamAId : teamBId;
    const stageBonus = CAPTAIN_STAGE_BONUS[stage] ?? 0;
    const winnerBonus = stage === "final" ? CAPTAIN_STAGE_BONUS["wins_world_cup"] ?? 0 : 0;
    const totalCaptainBonus = stageBonus + winnerBonus;

    if (totalCaptainBonus > 0) {
      const { data: captainUsers } = await supabaseAdmin
        .from("users").select("id, total_score").eq("captain_team_id", winningTeamId);
      for (const user of captainUsers ?? []) {
        await supabaseAdmin.from("users").update({ total_score: user.total_score + totalCaptainBonus }).eq("id", user.id);
      }
    }
  }

  return predictions.length;
}
