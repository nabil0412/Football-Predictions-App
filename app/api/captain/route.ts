import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db";
import { getOrCreateDbUser } from "@/lib/auth";

async function isTournamentStarted(): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("matches")
    .select("kickoff_time")
    .order("kickoff_time", { ascending: true })
    .limit(1)
    .single();
  if (!data) return false;
  return Date.now() >= new Date(data.kickoff_time).getTime();
}

export async function POST(req: NextRequest) {
  const dbUser = await getOrCreateDbUser();
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (dbUser.captain_team_id && await isTournamentStarted()) {
    return NextResponse.json({ error: "Tournament has started — captain can no longer be changed" }, { status: 400 });
  }

  const { teamId } = await req.json();
  const { data: team } = await supabaseAdmin.from("teams").select().eq("id", teamId).single();
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  await supabaseAdmin.from("users").update({ captain_team_id: teamId }).eq("id", dbUser.id);
  return NextResponse.json({ success: true, team });
}
