import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/db";
import { fetchWorldCupMatches, fetchWorldCupTeams, mapApiStageToDb } from "@/lib/football-api";
import { fetchChaosEventsForMatch } from "@/lib/events-api";
import { calculateScore, CAPTAIN_STAGE_BONUS, type ChaosCardType } from "@/lib/scoring";
import { redis, CACHE_KEYS } from "@/lib/redis";

const ADMIN_EMAIL = "abdelrahman.nabil04@gmail.com";

function mapStatus(apiStatus: string): "scheduled" | "live" | "finished" | null {
  switch (apiStatus) {
    case "SCHEDULED":
    case "TIMED":
      return "scheduled";
    case "IN_PLAY":
    case "PAUSED":
      return "live";
    case "FINISHED":
    case "AWARDED":
      return "finished";
    default:
      return null; // SUSPENDED, POSTPONED, CANCELLED — skip
  }
}

export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET) {
    // Fall back to Clerk admin check
    const user = await currentUser();
    const isAdmin = user?.emailAddresses.some(e => e.emailAddress === ADMIN_EMAIL);
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [matches, teams] = await Promise.all([
    fetchWorldCupMatches(),
    fetchWorldCupTeams(),
  ]);

  const errors: string[] = [];

  // Upsert all teams first
  for (const team of teams) {
    const { error } = await supabaseAdmin.from("teams")
      .upsert({ name: team.name, flag_url: team.crest, external_id: team.id }, { onConflict: "external_id" });
    if (error) errors.push(`team ${team.name}: ${error.message}`);
  }

  let synced = 0;
  let skipped = 0;
  let scored = 0;

  for (const m of matches) {
    const status = mapStatus(m.status);
    if (status === null) { skipped++; continue; }

    const [{ data: teamA, error: errA }, { data: teamB, error: errB }] = await Promise.all([
      supabaseAdmin.from("teams").select("id").eq("external_id", m.homeTeam.id).maybeSingle(),
      supabaseAdmin.from("teams").select("id").eq("external_id", m.awayTeam.id).maybeSingle(),
    ]);
    if (!teamA || !teamB) {
      errors.push(`match ${m.id} (${m.homeTeam.name} vs ${m.awayTeam.name}): team not found — A:${errA?.message} B:${errB?.message}`);
      skipped++;
      continue;
    }

    const { data: existing } = await supabaseAdmin
      .from("matches")
      .select("id, status")
      .eq("external_id", m.id)
      .maybeSingle();

    const homeScore = status === "finished" ? (m.score.fullTime.home ?? null) : null;
    const awayScore = status === "finished" ? (m.score.fullTime.away ?? null) : null;
    const stage = mapApiStageToDb(m.stage);

    const { error: upsertErr } = await supabaseAdmin.from("matches").upsert({
      external_id: m.id,
      team_a_id: teamA.id,
      team_b_id: teamB.id,
      kickoff_time: m.utcDate,
      stage,
      status,
      team_a_score: homeScore,
      team_b_score: awayScore,
      matchday: m.matchday ?? null,
    }, { onConflict: "external_id" });

    if (upsertErr) {
      errors.push(`match ${m.id} stage=${stage} status=${status}: ${upsertErr.message}`);
      skipped++;
      continue;
    }

    synced++;

    const justFinished = status === "finished" && existing?.status !== "finished";
    if (justFinished && existing?.id && homeScore != null && awayScore != null) {
      const chaosEvents = await fetchChaosEventsForMatch(m.utcDate, m.homeTeam.name, m.awayTeam.name);
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

  return NextResponse.json({ synced, scored, skipped, errors: errors.slice(0, 10) });
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
