import { supabaseAdmin } from "@/lib/db";
import { getDbUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import { Trophy, Clipboard } from "lucide-react";

function initials(name: string) {
  return name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
}

export default async function LeaguePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const leagueId = parseInt(id);
  if (isNaN(leagueId)) notFound();

  const [{ data: league }, dbUser] = await Promise.all([
    supabaseAdmin.from("leagues").select().eq("id", leagueId).single(),
    getDbUser(),
  ]);
  if (!league) notFound();

  const { data: members } = await supabaseAdmin
    .from("league_members")
    .select("users(id, name, total_score)")
    .eq("league_id", leagueId);

  type UserRow = { id: number; name: string; total_score: number };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ranked = (members as any[] ?? [])
    .map((m: { users: UserRow | UserRow[] | null }) => (Array.isArray(m.users) ? m.users[0] : m.users) as UserRow | null)
    .filter(Boolean)
    .sort((a, b) => (b?.total_score ?? 0) - (a?.total_score ?? 0)) as UserRow[];

  const max = ranked[0]?.total_score || 1;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px 32px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "24px 0 20px" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: "var(--wc-text-1)", letterSpacing: "-0.02em", margin: 0 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}><Trophy size={18} strokeWidth={1.75} />{league.name}</span>
          </h1>
          <p style={{ fontSize: 13, color: "var(--wc-text-3)", marginTop: 4 }}>{ranked.length} members</p>
        </div>
        <button
          onClick={undefined}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--wc-surface-alt)", border: "1px solid var(--wc-border)", borderRadius: 10, padding: "8px 12px", cursor: "pointer", color: "var(--wc-text-2)", fontSize: 12, fontWeight: 700 }}
        >
          <Clipboard size={13} /> {league.invite_code}
        </button>
      </div>

      {/* Members table */}
      <div style={{ background: "var(--wc-surface)", border: "1px solid var(--wc-border)", borderRadius: 16, overflow: "hidden" }}>
        {ranked.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 16px", color: "var(--wc-text-3)" }}>No members yet.</div>
        ) : (
          ranked.map((member, i) => {
            const isMe = dbUser && member.id === dbUser.id;
            const diff = member.total_score - ranked[0].total_score;
            return (
              <div key={member.id} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
                borderBottom: i < ranked.length - 1 ? `1px solid var(--wc-border)` : "none",
                background: isMe ? "rgba(34,197,94,0.04)" : "transparent",
              }}>
                <span style={{ width: 24, textAlign: "center", fontSize: 13, fontWeight: 700, color: "var(--wc-text-3)", fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: isMe ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)",
                  border: `1.5px solid ${isMe ? "rgba(34,197,94,0.3)" : "var(--wc-border)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700, color: isMe ? "var(--wc-green)" : "var(--wc-text-2)",
                  flexShrink: 0,
                }}>
                  {initials(member.name)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: isMe ? 700 : 500, color: isMe ? "var(--wc-green)" : "var(--wc-text-1)" }}>
                    {member.name}
                    {isMe && <span style={{ fontSize: 10, color: "var(--wc-text-3)", marginLeft: 5 }}>YOU</span>}
                  </div>
                  <div style={{ height: 3, marginTop: 4, borderRadius: 99, background: "var(--wc-border)", width: 80, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 99, width: `${(member.total_score / max) * 100}%`, background: isMe ? "var(--wc-green)" : "var(--wc-text-3)" }} />
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: isMe ? "var(--wc-green)" : "var(--wc-text-1)", fontVariantNumeric: "tabular-nums" }}>
                    {member.total_score} <span style={{ fontSize: 10, fontWeight: 600, color: "var(--wc-text-3)" }}>pts</span>
                  </div>
                  <div style={{ fontSize: 11, color: i === 0 ? "var(--wc-green)" : "var(--wc-text-3)", fontWeight: 600 }}>
                    {i === 0 ? "Leader" : diff === 0 ? "–" : diff}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
