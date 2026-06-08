import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db";
import { fetchWorldCupMatches, fetchWorldCupTeams, mapApiStageToDb } from "@/lib/football-api";
import { fetchChaosEvents } from "@/lib/events-api";
import { calculateScore, CAPTAIN_STAGE_BONUS, type ChaosCardType } from "@/lib/scoring";
import { redis, CACHE_KEYS } from "@/lib/redis";

export async function POST(req: NextRequest) {
  if (req.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Sync teams
  const apiTeams = await fetchWorldCupTeams();
  for (const t of apiTeams) {
    await supabaseAdmin.from("teams").upsert(
      { name: t.name, flag_url: t.crest, external_id: t.id },
      { onConflict: "external_id" }
    );
  }

  // Sync matches
  const apiMatches = await fetchWorldCupMatches();
  let synced = 0;
  let scored = 0;

  for (const m of apiMatches) {
    const { data: teamA } = await supabaseAdmin.from("teams").select("id").eq("external_id", m.homeTeam.id).single();
    const { data: teamB } = await supabaseAdmin.from("teams").select("id").eq("external_id", m.awayTeam.id).single();
    if (!teamA || !teamB) continue;

    const isFinished = m.status === "FINISHED";
    const newStatus = isFinished ? "finished" : "scheduled";
    const homeScore = m.score.fullTime.home;
    const awayScore = m.score.fullTime.away;

    // Get existing match to detect status change
    const { data: existing } = await supabaseAdmin
      .from("matches")
      .select("id, status")
      .eq("external_id", m.id)
      .maybeSingle();

    await supabaseAdmin.from("matches").upsert({
      external_id: m.id,
      team_a_id: teamA.id,
      team_b_id: teamB.id,
      kickoff_time: m.utcDate,
      stage: mapApiStageToDb(m.stage),
      team_a_score: homeScore,
      team_b_score: awayScore,
      status: newStatus,
    }, { onConflict: "external_id" });

    synced++;

    // Auto-score predictions when a match first becomes finished
    const justFinished = isFinished && existing?.status !== "finished";
    if (justFinished && existing?.id && homeScore != null && awayScore != null) {
      // Fetch and store chaos events from API-Football before scoring
      const chaosEvents = await fetchChaosEvents(m.utcDate, m.homeTeam.name, m.awayTeam.name);
      if (chaosEvents.length > 0) {
        await supabaseAdmin
          .from("matches")
          .update({ chaos_events_occurred: chaosEvents } as never)
          .eq("id", existing.id);
      }
      scored += await scoreMatch(existing.id, homeScore, awayScore, mapApiStageToDb(m.stage), teamA.id, teamB.id);
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
): Promise<number> {
  const { data: predictions } = await supabaseAdmin
    .from("predictions")
    .select("*")
    .eq("match_id", matchId)
    .is("points_earned", null);

  if (!predictions?.length) return 0;

  // Read extended columns (underdog/chaos) if migration has run
  let underdogTeamId: number | null = null;
  let chaosEventsOccurred: ChaosCardType[] = [];
  const { data: ext } = await supabaseAdmin
    .from("matches")
    .select("underdog_team_id, chaos_events_occurred")
    .eq("id", matchId)
    .single();
  if (ext) {
    underdogTeamId = (ext as never as { underdog_team_id: number | null }).underdog_team_id ?? null;
    chaosEventsOccurred = ((ext as never as { chaos_events_occurred: string[] | null }).chaos_events_occurred ?? []) as ChaosCardType[];
  }

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
      { underdogOutcome, chaosEventsOccurred }
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
