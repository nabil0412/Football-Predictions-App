import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db";
import { getOrCreateDbUser } from "@/lib/auth";

async function getScheduleState(): Promise<{ tournamentStarted: boolean; groupStageEnded: boolean }> {
  const [{ data: firstMatch }, { count: unfinished }, { count: total }] = await Promise.all([
    supabaseAdmin.from("matches").select("kickoff_time").eq("stage", "group").order("kickoff_time", { ascending: true }).limit(1).single(),
    supabaseAdmin.from("matches").select("*", { count: "exact", head: true }).eq("stage", "group").neq("status", "finished"),
    supabaseAdmin.from("matches").select("*", { count: "exact", head: true }).eq("stage", "group"),
  ]);

  const tournamentStarted = firstMatch ? Date.now() >= new Date(firstMatch.kickoff_time).getTime() : false;
  const groupStageEnded = (total ?? 0) > 0 && (unfinished ?? 0) === 0;

  return { tournamentStarted, groupStageEnded };
}

export async function POST(req: NextRequest) {
  const dbUser = await getOrCreateDbUser();
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { tournamentStarted, groupStageEnded } = await getScheduleState();

  if (groupStageEnded) {
    return NextResponse.json({ error: "Captain selection is closed — group stage has ended" }, { status: 400 });
  }

  if (tournamentStarted && dbUser.captain_team_id) {
    return NextResponse.json({ error: "Tournament has started — you can no longer change your captain" }, { status: 400 });
  }

  const { teamId } = await req.json();
  const { data: team } = await supabaseAdmin.from("teams").select().eq("id", teamId).single();
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  await supabaseAdmin.from("users").update({ captain_team_id: teamId }).eq("id", dbUser.id);
  return NextResponse.json({ success: true, team });
}
