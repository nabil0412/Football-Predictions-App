import { supabaseAdmin } from "@/lib/db";
import { CAPTAIN_STAGE_BONUS } from "@/lib/scoring";

const KO_STAGES = ["round_of_32", "round_of_16", "quarter_final", "semi_final", "final"];

export async function recalcUserTotal(userId: number): Promise<number> {
  const [{ data: agg }, { data: user }] = await Promise.all([
    supabaseAdmin.from("predictions").select("points_earned").eq("user_id", userId).not("points_earned", "is", null),
    supabaseAdmin.from("users").select("captain_team_id").eq("id", userId).single(),
  ]);

  const predTotal = (agg ?? []).reduce((s: number, p: { points_earned: number }) => s + p.points_earned, 0);

  let captainTotal = 0;
  const captainTeamId = (user as { captain_team_id: number | null } | null)?.captain_team_id ?? null;
  if (captainTeamId) {
    const { data: koMatches } = await supabaseAdmin
      .from("matches")
      .select("stage, team_a_id, team_b_id, team_a_score, team_b_score, penalty_winner")
      .in("stage", KO_STAGES)
      .eq("status", "finished");

    for (const m of koMatches ?? []) {
      const involvesCaptain = m.team_a_id === captainTeamId || m.team_b_id === captainTeamId;
      if (!involvesCaptain || m.team_a_score == null) continue;

      let winnerId: number | null = null;
      if (m.team_a_score > m.team_b_score) winnerId = m.team_a_id;
      else if (m.team_b_score > m.team_a_score) winnerId = m.team_b_id;
      else if (m.penalty_winner === "team_a") winnerId = m.team_a_id;
      else if (m.penalty_winner === "team_b") winnerId = m.team_b_id;

      if (winnerId === captainTeamId) {
        captainTotal += CAPTAIN_STAGE_BONUS[m.stage] ?? 0;
        if (m.stage === "final") captainTotal += CAPTAIN_STAGE_BONUS["wins_world_cup"] ?? 0;
      }
    }
  }

  const newTotal = predTotal + captainTotal;
  await supabaseAdmin.from("users").update({ total_score: newTotal }).eq("id", userId);
  return newTotal;
}
