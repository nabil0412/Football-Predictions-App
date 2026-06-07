import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { matchId, teamAScore, teamBScore, chaosEvents } = await req.json();

  const { error } = await supabaseAdmin
    .from("matches")
    .update({ team_a_score: teamAScore, team_b_score: teamBScore, status: "finished" })
    .eq("id", matchId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Best-effort: store chaos events if the column exists
  if (chaosEvents !== undefined) {
    await supabaseAdmin
      .from("matches")
      .update({ chaos_events_occurred: chaosEvents } as never)
      .eq("id", matchId);
  }
  return NextResponse.json({ success: true });
}
