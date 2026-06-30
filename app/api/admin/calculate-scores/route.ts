import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/db";
import { redis, CACHE_KEYS } from "@/lib/redis";
import { calculateScore, CAPTAIN_STAGE_BONUS, type ChaosCardType } from "@/lib/scoring";
import { recalcUserTotal } from "@/lib/recalc-user-total";

const ADMIN_EMAIL = "abdelrahman.nabil04@gmail.com";

export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET) {
    const user = await currentUser();
    const isAdmin = user?.emailAddresses.some(e => e.emailAddress === ADMIN_EMAIL);
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { matchId } = await req.json();

  const { data: match } = await supabaseAdmin
    .from("matches")
    .select("id, status, stage, team_a_id, team_b_id, team_a_score, team_b_score")
    .eq("id", matchId)
    .single();

  if (!match || match.status !== "finished" || match.team_a_score == null) {
    return NextResponse.json({ error: "Match not finished or scores missing" }, { status: 400 });
  }

  // Best-effort: read new columns if migration has run
  let underdogTeamId: number | null = null;
  let comebackTeamId: number | null = null;
  let chaosEventsOccurred: ChaosCardType[] = [];
  let wentToExtraTime = false;
  let penaltyWinner: "team_a" | "team_b" | null = null;
  const { data: ext } = await supabaseAdmin
    .from("matches")
    .select("underdog_team_id, comeback_team_id, chaos_events_occurred, went_to_extra_time, penalty_winner")
    .eq("id", matchId)
    .single();
  if (ext) {
    underdogTeamId = (ext as never as { underdog_team_id: number | null }).underdog_team_id ?? null;
    comebackTeamId = (ext as never as { comeback_team_id: number | null }).comeback_team_id ?? null;
    chaosEventsOccurred = ((ext as never as { chaos_events_occurred: string[] | null }).chaos_events_occurred ?? []) as ChaosCardType[];
    wentToExtraTime = (ext as never as { went_to_extra_time: boolean | null }).went_to_extra_time ?? false;
    penaltyWinner = (ext as never as { penalty_winner: "team_a" | "team_b" | null }).penalty_winner ?? null;
  }

  const { data: matchPredictions } = await supabaseAdmin
    .from("predictions").select().eq("match_id", matchId).is("points_earned", null);

  if (!matchPredictions?.length) return NextResponse.json({ processed: 0 });

  let underdogOutcome: "team_a_win" | "draw" | "team_b_win" | undefined;
  if (underdogTeamId) {
    underdogOutcome = underdogTeamId === match.team_a_id ? "team_a_win" : "team_b_win";
  }
  let comebackOutcome: "team_a_win" | "team_b_win" | undefined;
  if (comebackTeamId) {
    comebackOutcome = comebackTeamId === match.team_a_id ? "team_a_win" : "team_b_win";
  }

  for (const prediction of matchPredictions) {
    const score = calculateScore(
      {
        predictedResult: prediction.predicted_result,
        predictedTeamAGoals: prediction.predicted_team_a_goals as 0|1|2|3|4,
        predictedTeamBGoals: prediction.predicted_team_b_goals as 0|1|2|3|4,
        wildcardType: prediction.wildcard_type ?? undefined,
        chaosCardType: prediction.chaos_card_type ?? undefined,
        predictedGoesToET: prediction.predicted_goes_to_et ?? undefined,
        predictedPenaltyWinner: prediction.predicted_penalty_winner ?? undefined,
        predictedHattrickTeam: prediction.predicted_hattrick_team ?? undefined,
      },
      { teamAScore: match.team_a_score, teamBScore: match.team_b_score },
      { underdogOutcome, comebackOutcome, chaosEventsOccurred, wentToExtraTime, penaltyWinner }
    );

    await supabaseAdmin
      .from("predictions")
      .update({ points_earned: score.total })
      .eq("id", prediction.id);

    if (prediction.wildcard_type) {
      await supabaseAdmin
        .from("wildcard_usage")
        .update({ points_effect: score.wildcardEffect })
        .eq("user_id", prediction.user_id)
        .eq("match_id", matchId);
    }

    await recalcUserTotal(prediction.user_id);
  }

  await redis.del(CACHE_KEYS.globalLeaderboard).catch(() => {});
  return NextResponse.json({ processed: matchPredictions.length });
}
