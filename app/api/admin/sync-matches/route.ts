import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
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
      return null;
  }
}

export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET) {
    const user = await currentUser();
    const isAdmin = user?.emailAddresses.some(e => e.emailAddress === ADMIN_EMAIL);
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 1. Fetch from external APIs in parallel
  let apiMatches: Awaited<ReturnType<typeof fetchWorldCupMatches>>;
  let apiTeams: Awaited<ReturnType<typeof fetchWorldCupTeams>>;
  try {
    [apiMatches, apiTeams] = await Promise.all([
      fetchWorldCupMatches(),
      fetchWorldCupTeams(),
    ]);
  } catch (e) {
    return NextResponse.json({ error: `football-data.org fetch failed: ${(e as Error).message}` }, { status: 502 });
  }

  // 2. Batch upsert all teams in one call
  const { error: teamErr } = await supabaseAdmin.from("teams").upsert(
    apiTeams.map(t => ({ name: t.name, flag_url: t.crest, external_id: t.id })),
    { onConflict: "external_id" }
  );
  if (teamErr) return NextResponse.json({ error: `Team upsert failed: ${teamErr.message}` }, { status: 500 });

  // 3. Load all teams + existing matches from DB in parallel (2 queries total)
  const externalTeamIds = apiTeams.map(t => t.id);
  const externalMatchIds = apiMatches.map(m => m.id);

  const [{ data: dbTeams }, { data: dbMatches }] = await Promise.all([
    supabaseAdmin.from("teams").select("id, external_id").in("external_id", externalTeamIds),
    supabaseAdmin.from("matches").select("id, external_id, status, stage, team_a_score, team_b_score").in("external_id", externalMatchIds),
  ]);

  const teamByExtId = Object.fromEntries((dbTeams ?? []).map(t => [t.external_id, t.id]));
  const existingByExtId = Object.fromEntries((dbMatches ?? []).map(m => [m.external_id, m]));

  // 4. Build match upsert payload
  const matchRows: object[] = [];
  const justFinished: Array<{ extId: number; dbId: number; homeScore: number; awayScore: number; stage: string; teamAId: number; teamBId: number; utcDate: string; homeTeam: string; awayTeam: string; wentToET: boolean }> = [];
  const skippedDetails: Array<{ id: number; home: string; away: string; reason: string; apiStatus: string }> = [];
  let skipped = 0;

  for (const m of apiMatches) {
    const status = mapStatus(m.status);
    if (status === null) {
      skippedDetails.push({ id: m.id, home: m.homeTeam.name, away: m.awayTeam.name, reason: "unmapped_status", apiStatus: m.status });
      skipped++; continue;
    }

    const teamAId = teamByExtId[m.homeTeam.id];
    const teamBId = teamByExtId[m.awayTeam.id];
    if (!teamAId || !teamBId) {
      skippedDetails.push({ id: m.id, home: m.homeTeam.name, away: m.awayTeam.name, reason: "team_not_found", apiStatus: m.status });
      skipped++; continue;
    }

    const homeScore = status === "finished" ? (m.score.fullTime.home ?? null) : null;
    const awayScore = status === "finished" ? (m.score.fullTime.away ?? null) : null;
    const wentToET = status === "finished" && m.score.extraTime?.home != null;
    const penaltyHome = m.score.penalties?.home ?? null;
    const penaltyAway = m.score.penalties?.away ?? null;
    const penaltyWinner = penaltyHome != null && penaltyAway != null
      ? (penaltyHome > penaltyAway ? "team_a" : "team_b")
      : null;
    const stage = mapApiStageToDb(m.stage);

    const existing = existingByExtId[m.id];
    // Never downgrade a finished match — API sometimes briefly mis-reports status
    const finalStatus = existing?.status === "finished" ? "finished" : status;
    // Never overwrite a manually-set KO stage with group — API sometimes mis-reports
    const KO_STAGES_SET = new Set(["round_of_32", "round_of_16", "quarter_final", "semi_final", "final"]);
    const finalStage = existing?.stage && KO_STAGES_SET.has(existing.stage) ? existing.stage : stage;

    matchRows.push({
      external_id: m.id,
      team_a_id: teamAId,
      team_b_id: teamBId,
      kickoff_time: m.utcDate,
      stage: finalStage,
      status: finalStatus,
      team_a_score: finalStatus === "finished" ? (homeScore ?? existing?.team_a_score ?? null) : homeScore,
      team_b_score: finalStatus === "finished" ? (awayScore ?? existing?.team_b_score ?? null) : awayScore,
      matchday: m.matchday ?? null,
      ...(finalStatus === "finished" ? { went_to_extra_time: wentToET, penalty_winner: penaltyWinner } : {}),
    });

    const justBecameFinished = status === "finished" && existing?.status !== "finished";
    const finishedButMissingScore = status === "finished" && existing?.status === "finished" && existing?.team_a_score == null;
    if ((justBecameFinished || finishedButMissingScore) && existing?.id && homeScore != null && awayScore != null) {
      justFinished.push({ extId: m.id, dbId: existing.id, homeScore, awayScore, stage, teamAId, teamBId, utcDate: m.utcDate, homeTeam: m.homeTeam.name, awayTeam: m.awayTeam.name, wentToET });
    }
  }

  // 5. Batch upsert all matches in one call
  const { error: matchErr } = await supabaseAdmin.from("matches").upsert(matchRows, { onConflict: "external_id" });
  if (matchErr) return NextResponse.json({ error: `Match upsert failed: ${matchErr.message}` }, { status: 500 });

  const synced = matchRows.length;

  // 6. Score newly-finished matches — best-effort, don't fail the sync
  let scored = 0;
  const scoringErrors: string[] = [];
  for (const f of justFinished) {
    try {
      const chaosEvents = await fetchChaosEventsForMatch(f.utcDate, f.homeTeam, f.awayTeam);
      if (chaosEvents.length > 0) {
        await supabaseAdmin.from("matches").update({ chaos_events_occurred: chaosEvents } as never).eq("id", f.dbId);
      }
      scored += await scoreMatch(f.dbId, f.homeScore, f.awayScore, f.stage, f.teamAId, f.teamBId, chaosEvents, f.wentToET);
    } catch (e) {
      scoringErrors.push(`match ${f.dbId}: ${(e as Error).message}`);
    }
  }

  if (scored > 0) await redis.del(CACHE_KEYS.globalLeaderboard).catch(() => {});

  return NextResponse.json({ synced, scored, skipped, skippedDetails, ...(scoringErrors.length ? { scoringErrors } : {}) });
}

async function scoreMatch(
  matchId: number,
  teamAScore: number,
  teamBScore: number,
  stage: string,
  teamAId: number,
  teamBId: number,
  chaosEventsOccurred: string[],
  wentToExtraTime = false,
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
        predictedGoesToET: prediction.predicted_goes_to_et ?? undefined,
      },
      { teamAScore, teamBScore },
      { underdogOutcome, chaosEventsOccurred: chaosEventsOccurred as ChaosCardType[], wentToExtraTime }
    );

    await supabaseAdmin.from("predictions").update({ points_earned: score.total }).eq("id", prediction.id);

    if (prediction.wildcard_type) {
      await supabaseAdmin
        .from("wildcard_usage")
        .update({ points_effect: score.wildcardEffect })
        .eq("user_id", prediction.user_id)
        .eq("match_id", matchId);
    }

    const { data: agg } = await supabaseAdmin
      .from("predictions")
      .select("points_earned")
      .eq("user_id", prediction.user_id)
      .not("points_earned", "is", null);
    const newTotal = (agg ?? []).reduce((s: number, p: { points_earned: number }) => s + p.points_earned, 0);
    await supabaseAdmin.from("users").update({ total_score: newTotal }).eq("id", prediction.user_id);
  }

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
