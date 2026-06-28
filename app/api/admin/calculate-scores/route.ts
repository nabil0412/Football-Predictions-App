import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/db";
import { redis, CACHE_KEYS } from "@/lib/redis";
import { calculateScore, CAPTAIN_STAGE_BONUS, type ChaosCardType } from "@/lib/scoring";

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
  let chaosEventsOccurred: ChaosCardType[] = [];
  let wentToExtraTime = false;
  const { data: ext } = await supabaseAdmin
    .from("matches")
    .select("underdog_team_id, chaos_events_occurred, went_to_extra_time")
    .eq("id", matchId)
    .single();
  if (ext) {
    underdogTeamId = (ext as never as { underdog_team_id: number | null }).underdog_team_id ?? null;
    chaosEventsOccurred = ((ext as never as { chaos_events_occurred: string[] | null }).chaos_events_occurred ?? []) as ChaosCardType[];
    wentToExtraTime = (ext as never as { went_to_extra_time: boolean | null }).went_to_extra_time ?? false;
  }

  const { data: matchPredictions } = await supabaseAdmin
    .from("predictions").select().eq("match_id", matchId).is("points_earned", null);

  if (!matchPredictions?.length) return NextResponse.json({ processed: 0 });

  // Determine underdog outcome from stored odds data
  let underdogOutcome: "team_a_win" | "draw" | "team_b_win" | undefined;
  if (underdogTeamId) {
    underdogOutcome = underdogTeamId === match.team_a_id ? "team_a_win" : "team_b_win";
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
      },
      { teamAScore: match.team_a_score, teamBScore: match.team_b_score },
      { underdogOutcome, chaosEventsOccurred, wentToExtraTime }
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

    const { data: agg } = await supabaseAdmin
      .from("predictions")
      .select("points_earned")
      .eq("user_id", prediction.user_id)
      .not("points_earned", "is", null);
    const newTotal = (agg ?? []).reduce((s: number, p: { points_earned: number }) => s + p.points_earned, 0);
    await supabaseAdmin.from("users").update({ total_score: newTotal }).eq("id", prediction.user_id);
  }

  // Captain stage bonuses — only for KO rounds with a clear winner
  const koStages = ["round_of_32", "round_of_16", "quarter_final", "semi_final", "final"];
  if (koStages.includes(match.stage) && match.team_a_score !== match.team_b_score) {
    const winningTeamId = match.team_a_score > match.team_b_score
      ? match.team_a_id
      : match.team_b_id;

    const stageBonus = CAPTAIN_STAGE_BONUS[match.stage] ?? 0;
    const winnerBonus = match.stage === "final" ? CAPTAIN_STAGE_BONUS["wins_world_cup"] ?? 0 : 0;
    const totalCaptainBonus = stageBonus + winnerBonus;

    if (totalCaptainBonus > 0) {
      const { data: captainUsers } = await supabaseAdmin
        .from("users")
        .select("id, total_score")
        .eq("captain_team_id", winningTeamId);

      for (const user of captainUsers ?? []) {
        await supabaseAdmin
          .from("users")
          .update({ total_score: user.total_score + totalCaptainBonus })
          .eq("id", user.id);
      }
    }
  }

  await redis.del(CACHE_KEYS.globalLeaderboard).catch(() => {});
  return NextResponse.json({ processed: matchPredictions.length });
}
