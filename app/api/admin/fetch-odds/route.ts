import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/db";
import { fetchUnderdogSide } from "@/lib/odds-api";

const ADMIN_EMAIL = "abdelrahman.nabil04@gmail.com";

export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET) {
    const user = await currentUser();
    const isAdmin = user?.emailAddresses.some(e => e.emailAddress === ADMIN_EMAIL);
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: matches } = await supabaseAdmin
    .from("matches")
    .select("id, team_a_id, team_b_id, underdog_team_id")
    .eq("status", "scheduled");

  if (!matches?.length) return NextResponse.json({ updated: 0 });

  const teamIds = [...new Set(matches.flatMap((m) => [m.team_a_id, m.team_b_id]))];
  const { data: teams } = await supabaseAdmin
    .from("teams")
    .select("id, name")
    .in("id", teamIds);

  const teamMap = Object.fromEntries((teams ?? []).map((t) => [t.id, t.name]));

  let updated = 0;
  for (const match of matches) {
    const homeTeam = teamMap[match.team_a_id];
    const awayTeam = teamMap[match.team_b_id];
    if (!homeTeam || !awayTeam) continue;

    const side = await fetchUnderdogSide(homeTeam, awayTeam);
    if (side === null) continue;

    const underdogTeamId = side === "home" ? match.team_a_id : match.team_b_id;
    await supabaseAdmin
      .from("matches")
      .update({ underdog_team_id: underdogTeamId })
      .eq("id", match.id);
    updated++;
  }

  return NextResponse.json({ updated });
}
