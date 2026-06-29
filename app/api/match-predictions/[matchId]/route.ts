import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const id = parseInt(matchId);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid match ID" }, { status: 400 });

  const { data: match } = await supabaseAdmin
    .from("matches")
    .select("status, kickoff_time")
    .eq("id", id)
    .single();

  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

  const kt = match.kickoff_time.replace(' ', 'T');
  const utcKickoff = kt.includes('+') || kt.endsWith('Z') ? kt : kt + 'Z';
  const ONE_HOUR = 60 * 60 * 1000;
  const isLocked = match.status === "finished" || match.status === "live" ||
    (match.status === "scheduled" && new Date(utcKickoff).getTime() - Date.now() <= ONE_HOUR);

  if (!isLocked) return NextResponse.json({ error: "Predictions not yet revealed" }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from("predictions")
    .select("predicted_result, predicted_team_a_goals, predicted_team_b_goals, wildcard_type, predicted_penalty_winner, points_earned, users(id, name)")
    .eq("match_id", id)
    .order("points_earned", { ascending: false, nullsFirst: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const predictions = (data ?? []).map((p: any) => ({
    userId: p.users?.id ?? null,
    name: p.users?.name ?? "Unknown",
    predicted_result: p.predicted_result,
    predicted_team_a_goals: p.predicted_team_a_goals,
    predicted_team_b_goals: p.predicted_team_b_goals,
    wildcard_type: p.wildcard_type,
    predicted_penalty_winner: p.predicted_penalty_winner ?? null,
    points_earned: p.points_earned,
  }));

  return NextResponse.json(predictions);
}
