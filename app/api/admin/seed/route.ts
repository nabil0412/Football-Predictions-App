import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/db";
import { calculateScore, CAPTAIN_STAGE_BONUS, type ChaosCardType } from "@/lib/scoring";
import { redis, CACHE_KEYS } from "@/lib/redis";

const ADMIN_EMAIL = "abdelrahman.nabil04@gmail.com";

const MOCK_TEAMS = [
  { external_id: -1, name: "Brazil",    flag_url: "https://crests.football-data.org/764.svg" },
  { external_id: -2, name: "Argentina", flag_url: "https://crests.football-data.org/762.svg" },
  { external_id: -3, name: "France",    flag_url: "https://crests.football-data.org/773.svg" },
  { external_id: -4, name: "Germany",   flag_url: "https://crests.football-data.org/759.svg" },
  { external_id: -5, name: "England",   flag_url: "https://crests.football-data.org/770.svg" },
  { external_id: -6, name: "Spain",     flag_url: "https://crests.football-data.org/760.svg" },
  { external_id: -7, name: "Morocco",   flag_url: "https://crests.football-data.org/1009.svg" },
  { external_id: -8, name: "Japan",     flag_url: "https://crests.football-data.org/827.svg" },
];

function hoursFromNow(h: number) {
  return new Date(Date.now() + h * 60 * 60 * 1000).toISOString();
}

export async function POST(req: NextRequest) {
  if (process.env.ENABLE_SEED !== "true") {
    return NextResponse.json({ error: "Seed not enabled" }, { status: 403 });
  }

  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET) {
    const user = await currentUser();
    const isAdmin = user?.emailAddresses.some(e => e.emailAddress === ADMIN_EMAIL);
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Wipe existing mock data (negative external_ids)
  const { data: mockMatches } = await supabaseAdmin.from("matches").select("id").lt("external_id", 0);
  const mockMatchIds = (mockMatches ?? []).map(m => m.id);
  if (mockMatchIds.length > 0) {
    await supabaseAdmin.from("predictions").delete().in("match_id", mockMatchIds);
    await supabaseAdmin.from("matches").delete().in("id", mockMatchIds);
  }
  await supabaseAdmin.from("teams").delete().lt("external_id", 0);

  // Insert teams
  const { data: insertedTeams, error: teamErr } = await supabaseAdmin
    .from("teams")
    .insert(MOCK_TEAMS)
    .select("id, external_id, name");
  if (teamErr) return NextResponse.json({ error: teamErr.message }, { status: 500 });

  const byExtId = Object.fromEntries((insertedTeams ?? []).map(t => [t.external_id, t]));
  const brazil    = byExtId[-1];
  const argentina = byExtId[-2];
  const france    = byExtId[-3];
  const germany   = byExtId[-4];
  const england   = byExtId[-5];
  const spain     = byExtId[-6];
  const morocco   = byExtId[-7];
  const japan     = byExtId[-8];

  // Insert matches
  const { data: insertedMatches, error: matchErr } = await supabaseAdmin.from("matches").insert([
    // Finished matches — chaos events set, scoring can be triggered
    {
      external_id: -101, team_a_id: brazil.id, team_b_id: argentina.id,
      kickoff_time: hoursFromNow(-48), stage: "group", status: "finished",
      team_a_score: 2, team_b_score: 1, matchday: 1,
      chaos_events_occurred: ["common"],
    },
    {
      external_id: -102, team_a_id: france.id, team_b_id: germany.id,
      kickoff_time: hoursFromNow(-24), stage: "group", status: "finished",
      team_a_score: 0, team_b_score: 0, matchday: 1,
      chaos_events_occurred: ["medium"],
    },
    // Live match
    {
      external_id: -103, team_a_id: england.id, team_b_id: spain.id,
      kickoff_time: hoursFromNow(-1), stage: "group", status: "live",
      team_a_score: 1, team_b_score: 0, matchday: 1,
    },
    // Scheduled — with underdog set
    {
      external_id: -104, team_a_id: morocco.id, team_b_id: japan.id,
      kickoff_time: hoursFromNow(2), stage: "group", status: "scheduled",
      matchday: 1, underdog_team_id: japan.id,
    },
    {
      external_id: -105, team_a_id: brazil.id, team_b_id: france.id,
      kickoff_time: hoursFromNow(26), stage: "group", status: "scheduled",
      matchday: 2, underdog_team_id: france.id,
    },
    {
      external_id: -106, team_a_id: argentina.id, team_b_id: england.id,
      kickoff_time: hoursFromNow(50), stage: "group", status: "scheduled",
      matchday: 2,
    },
    // Knockout rounds
    {
      external_id: -107, team_a_id: germany.id, team_b_id: morocco.id,
      kickoff_time: hoursFromNow(120), stage: "round_of_16", status: "scheduled",
    },
    {
      external_id: -108, team_a_id: spain.id, team_b_id: japan.id,
      kickoff_time: hoursFromNow(240), stage: "quarter_final", status: "scheduled",
    },
    {
      external_id: -109, team_a_id: brazil.id, team_b_id: france.id,
      kickoff_time: hoursFromNow(336), stage: "semi_final", status: "scheduled",
    },
    {
      external_id: -110, team_a_id: argentina.id, team_b_id: england.id,
      kickoff_time: hoursFromNow(432), stage: "final", status: "scheduled",
    },
  ]).select("id, external_id, status, stage, team_a_id, team_b_id, team_a_score, team_b_score");

  if (matchErr) return NextResponse.json({ error: matchErr.message }, { status: 500 });

  // Score existing predictions for the two finished matches
  let scored = 0;
  for (const m of insertedMatches ?? []) {
    if (m.status === "finished" && m.team_a_score != null && m.team_b_score != null) {
      const chaosEvents = m.external_id === -101 ? ["common"] : m.external_id === -102 ? ["medium"] : [];
      scored += await scoreMatch(m.id, m.team_a_score, m.team_b_score, m.stage, m.team_a_id, m.team_b_id, chaosEvents);
    }
  }

  if (scored > 0) await redis.del(CACHE_KEYS.globalLeaderboard).catch(() => {});

  return NextResponse.json({ teams: MOCK_TEAMS.length, matches: (insertedMatches ?? []).length, scored });
}

async function scoreMatch(
  matchId: number, teamAScore: number, teamBScore: number,
  stage: string, teamAId: number, teamBId: number, chaosEventsOccurred: string[],
): Promise<number> {
  const { data: predictions } = await supabaseAdmin
    .from("predictions").select("*").eq("match_id", matchId).is("points_earned", null);
  if (!predictions?.length) return 0;

  const { data: ext } = await supabaseAdmin.from("matches").select("underdog_team_id").eq("id", matchId).single();
  const underdogTeamId = (ext as never as { underdog_team_id: number | null } | null)?.underdog_team_id ?? null;
  const underdogOutcome = underdogTeamId
    ? (underdogTeamId === teamAId ? "team_a_win" : "team_b_win") as "team_a_win" | "team_b_win"
    : undefined;

  for (const prediction of predictions) {
    const score = calculateScore(
      { predictedResult: prediction.predicted_result, predictedTeamAGoals: prediction.predicted_team_a_goals, predictedTeamBGoals: prediction.predicted_team_b_goals, wildcardType: prediction.wildcard_type ?? undefined, chaosCardType: prediction.chaos_card_type ?? undefined },
      { teamAScore, teamBScore },
      { underdogOutcome, chaosEventsOccurred: chaosEventsOccurred as ChaosCardType[] }
    );
    await supabaseAdmin.from("predictions").update({ points_earned: score.total }).eq("id", prediction.id);
    if (prediction.wildcard_type) {
      await supabaseAdmin.from("wildcard_usage").update({ points_effect: score.wildcardEffect }).eq("user_id", prediction.user_id).eq("match_id", matchId);
    }
    const { data: u } = await supabaseAdmin.from("users").select("total_score").eq("id", prediction.user_id).single();
    if (u) await supabaseAdmin.from("users").update({ total_score: u.total_score + score.total }).eq("id", prediction.user_id);
  }

  const koStages = ["round_of_32", "round_of_16", "quarter_final", "semi_final", "final"];
  if (koStages.includes(stage) && teamAScore !== teamBScore) {
    const winningTeamId = teamAScore > teamBScore ? teamAId : teamBId;
    const stageBonus = CAPTAIN_STAGE_BONUS[stage] ?? 0;
    const winnerBonus = stage === "final" ? CAPTAIN_STAGE_BONUS["wins_world_cup"] ?? 0 : 0;
    const total = stageBonus + winnerBonus;
    if (total > 0) {
      const { data: captainUsers } = await supabaseAdmin.from("users").select("id, total_score").eq("captain_team_id", winningTeamId);
      for (const u of captainUsers ?? []) {
        await supabaseAdmin.from("users").update({ total_score: u.total_score + total }).eq("id", u.id);
      }
    }
  }

  return predictions.length;
}
