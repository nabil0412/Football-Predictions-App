import { supabaseAdmin } from "@/lib/db";
import { getOrCreateDbUser } from "@/lib/auth";
import { LeagueManager } from "@/components/LeagueManager";

export default async function LeaguesPage() {
  const dbUser = await getOrCreateDbUser();
  if (!dbUser) return null;

  const { data: memberships } = await supabaseAdmin
    .from("league_members")
    .select("leagues(id, name, invite_code)")
    .eq("user_id", dbUser.id);

  type LeagueRow = { id: number; name: string; invite_code: string };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const myLeagues = (memberships as any[] ?? [])
    .map((m) => (Array.isArray(m.leagues) ? m.leagues[0] : m.leagues))
    .filter(Boolean) as LeagueRow[];

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 26, fontWeight: 900, color: "var(--wc-text-1)", letterSpacing: "-0.02em", margin: 0, paddingTop: 24, marginBottom: 20 }}>
        Leagues
      </h1>
      <LeagueManager myLeagues={myLeagues} />
    </div>
  );
}
