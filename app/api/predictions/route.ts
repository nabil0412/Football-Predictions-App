import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/db";
import { getOrCreateDbUser } from "@/lib/auth";
import { getWildcardLimit, WildcardType } from "@/lib/scoring";
import { format } from "date-fns";

export async function POST(req: NextRequest) {
  const dbUser = await getOrCreateDbUser();
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { matchId, predictedResult, predictedTeamAGoals, predictedTeamBGoals, wildcardType, chaosCardType, predictedGoesToET, predictedPenaltyWinner, predictedHattrickTeam } = await req.json();

  const { data: match } = await supabaseAdmin.from("matches").select("id, status, kickoff_time, stage").eq("id", matchId).single();
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  if (match.status !== "scheduled") return NextResponse.json({ error: "Predictions are locked" }, { status: 400 });

  const oneHourBefore = new Date(new Date(match.kickoff_time).getTime() - 60 * 60 * 1000);
  if (new Date() >= oneHourBefore) return NextResponse.json({ error: "Predictions lock 1 hour before kickoff" }, { status: 400 });

  const KO_STAGES = ["round_of_32", "round_of_16", "quarter_final", "semi_final", "final"];
  const isKnockout = KO_STAGES.includes(match.stage);
  if (isKnockout && predictedResult === "draw" && !predictedPenaltyWinner) {
    return NextResponse.json({ error: "Select who wins on penalties for knockout matches" }, { status: 400 });
  }

  if (wildcardType) {
    const limit = getWildcardLimit(wildcardType as WildcardType, match.stage);
    if (limit != null) {
      // Count usage only within the same stage/round
      const { data: stageMatches } = await supabaseAdmin
        .from("matches").select("id").eq("stage", match.stage).neq("id", matchId);
      const stageMatchIds = (stageMatches ?? []).map(m => m.id);
      const count = stageMatchIds.length > 0
        ? (await supabaseAdmin.from("wildcard_usage").select("id", { count: "exact", head: true }).eq("user_id", dbUser.id).eq("wildcard_type", wildcardType).in("match_id", stageMatchIds)).count ?? 0
        : 0;

      if (count >= limit) {
        return NextResponse.json({ error: `You've used your ${wildcardType.replace(/_/g, " ")} for this round` }, { status: 400 });
      }
    }

    // Underdog: can only use if predicted result matches odds-determined underdog
    if (wildcardType === "underdog_pick") {
      const { data: matchWithOdds } = await supabaseAdmin
        .from("matches").select("underdog_team_id, team_a_id, team_b_id").eq("id", matchId).single();
      if (!matchWithOdds?.underdog_team_id) {
        return NextResponse.json({ error: "No odds data available for this match" }, { status: 400 });
      }
      const expectedResult = matchWithOdds.underdog_team_id === matchWithOdds.team_a_id ? "team_a_win" : "team_b_win";
      if (predictedResult !== expectedResult) {
        return NextResponse.json({ error: "Underdog pick requires predicting the underdog team to win" }, { status: 400 });
      }
    }

    // Rare chaos card: can only use if predicting one team to score 3+ goals
    if (wildcardType === "chaos_card" && chaosCardType === "rare") {
      if (predictedTeamAGoals < 3 && predictedTeamBGoals < 3) {
        return NextResponse.json({ error: "Rare chaos (hat-trick) requires predicting 3+ goals for a team" }, { status: 400 });
      }
    }
  }

  const { error } = await supabaseAdmin.from("predictions").upsert({
    user_id: dbUser.id,
    match_id: matchId,
    predicted_result: predictedResult,
    predicted_team_a_goals: predictedTeamAGoals,
    predicted_team_b_goals: predictedTeamBGoals,
    wildcard_type: wildcardType ?? null,
    chaos_card_type: chaosCardType ?? null,
    predicted_goes_to_et: isKnockout && predictedResult !== "draw" ? (predictedGoesToET ?? false) : null,
    predicted_penalty_winner: isKnockout && predictedResult === "draw" ? (predictedPenaltyWinner ?? null) : null,
    predicted_hattrick_team: wildcardType === "chaos_card" && chaosCardType === "rare" && predictedTeamAGoals >= 3 && predictedTeamBGoals >= 3 ? (predictedHattrickTeam ?? null) : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,match_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Sync wildcard_usage: always delete existing entry for this match, then re-insert if needed
  await supabaseAdmin.from("wildcard_usage").delete().eq("user_id", dbUser.id).eq("match_id", matchId);
  if (wildcardType) {
    await supabaseAdmin.from("wildcard_usage").insert({
      user_id: dbUser.id, match_id: matchId,
      usage_date: format(new Date(), "yyyy-MM-dd"), wildcard_type: wildcardType,
    });
  }

  return NextResponse.json({ success: true });
}

export async function GET(req: NextRequest) {
  const dbUser = await getOrCreateDbUser();
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const matchId = req.nextUrl.searchParams.get("matchId");
  if (!matchId) return NextResponse.json({ error: "matchId required" }, { status: 400 });

  const { data: prediction } = await supabaseAdmin
    .from("predictions").select("*").eq("user_id", dbUser.id).eq("match_id", parseInt(matchId)).maybeSingle();

  return NextResponse.json({ prediction });
}
