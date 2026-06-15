import { supabaseAdmin } from "@/lib/db";
import { getOrCreateDbUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CircleDot } from "lucide-react";
import { MyPicksClient } from "@/components/MyPicksClient";

export const dynamic = "force-dynamic";

export default async function MyPredictionsPage() {
  const dbUser = await getOrCreateDbUser();
  if (!dbUser) redirect("/sign-in");

  const { data: predictions } = await supabaseAdmin
    .from("predictions")
    .select("id, match_id, predicted_result, predicted_team_a_goals, predicted_team_b_goals, wildcard_type, points_earned")
    .eq("user_id", dbUser.id)
    .order("created_at", { ascending: false });

  if (!predictions?.length) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px", textAlign: "center", paddingTop: 80 }}>
        <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}><CircleDot size={48} color="var(--wc-text-3)" strokeWidth={1.25} /></div>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: "var(--wc-text-1)", marginBottom: 8 }}>No picks yet</h1>
        <p style={{ color: "var(--wc-text-3)", fontSize: 13, marginBottom: 24 }}>Head to matches to make your first prediction.</p>
        <Link href="/" style={{ background: "var(--wc-green)", color: "#000", padding: "10px 24px", borderRadius: 99, fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
          Browse matches →
        </Link>
      </div>
    );
  }

  const matchIds = predictions.map(p => p.match_id);
  const { data: matches } = await supabaseAdmin
    .from("matches")
    .select("id, kickoff_time, status, stage, team_a_id, team_b_id, team_a_score, team_b_score")
    .in("id", matchIds);

  const teamIds = [...new Set((matches ?? []).flatMap(m => [m.team_a_id, m.team_b_id]))];
  const { data: teams } = await supabaseAdmin
    .from("teams")
    .select("id, name, iso_code, flag_url")
    .in("id", teamIds);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px" }}>
      <MyPicksClient
        predictions={predictions}
        matches={matches ?? []}
        teams={teams ?? []}
        serverTotal={dbUser.total_score}
      />
    </div>
  );
}
