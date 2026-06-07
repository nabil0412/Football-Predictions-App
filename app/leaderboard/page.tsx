import { supabaseAdmin } from "@/lib/db";
import { getDbUser } from "@/lib/auth";
import { AdBanner } from "@/components/AdBanner";

export const revalidate = 300;

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function Avatar({ name, size = 32, isMe = false }: { name: string; size?: number; isMe?: boolean }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: isMe ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)",
      border: isMe ? "1.5px solid rgba(34,197,94,0.3)" : "1.5px solid var(--wc-border)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.35, fontWeight: 700,
      color: isMe ? "var(--wc-green)" : "var(--wc-text-2)",
      flexShrink: 0,
    }}>
      {initials(name)}
    </div>
  );
}

export default async function LeaderboardPage() {
  const [{ data: entries }, dbUser] = await Promise.all([
    supabaseAdmin.from("users").select("id, name, total_score").order("total_score", { ascending: false }).limit(100),
    getDbUser(),
  ]);

  const rows = entries ?? [];
  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);
  const max = rows[0]?.total_score || 1;
  const myRank = dbUser ? rows.findIndex(r => r.id === dbUser.id) + 1 : null;

  const medals = ["🥇","🥈","🥉"];
  const podiumOrder = [1, 0, 2]; // silver · gold · bronze
  const podiumHeights = [140, 160, 120];

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px 32px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px 0 20px" }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: "var(--wc-text-1)", letterSpacing: "-0.02em", margin: 0 }}>Leaderboard</h1>
          <p style={{ fontSize: 13, color: "var(--wc-text-3)", marginTop: 4 }}>{rows.length} players</p>
        </div>
        {myRank && myRank > 0 && (
          <div style={{
            background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)",
            borderRadius: 99, padding: "6px 14px", fontSize: 13, fontWeight: 700, color: "var(--wc-green)",
          }}>
            Your rank: #{myRank}
          </div>
        )}
      </div>

      {/* Podium */}
      {top3.length === 3 && (
        <div style={{ background: "var(--wc-surface)", border: "1px solid var(--wc-border)", borderRadius: 20, padding: "24px 16px 0", marginBottom: 20, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 4 }}>
            {podiumOrder.map((idx, pi) => {
              const user = top3[idx];
              const h = podiumHeights[pi];
              const isGold = idx === 0;
              const isMe = dbUser && user.id === dbUser.id;
              return (
                <div key={user.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, marginBottom: 8 }}>
                    <span style={{ fontSize: 20 }}>{medals[idx]}</span>
                    <Avatar name={user.name} size={isGold ? 40 : 34} isMe={!!isMe} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--wc-text-1)", textAlign: "center" }}>
                      {user.name.split(" ")[0]}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 900, color: "var(--wc-text-1)", fontVariantNumeric: "tabular-nums" }}>
                      {user.total_score} <span style={{ fontSize: 10, fontWeight: 600 }}>pts</span>
                    </span>
                  </div>
                  <div style={{
                    width: "100%", height: h,
                    background: idx === 0 ? "rgba(251,191,36,0.15)" : idx === 1 ? "rgba(148,163,184,0.15)" : "rgba(180,120,60,0.15)",
                    borderTop: `2px solid ${idx === 0 ? "rgba(251,191,36,0.5)" : idx === 1 ? "rgba(148,163,184,0.4)" : "rgba(180,120,60,0.4)"}`,
                    borderRadius: "4px 4px 0 0",
                    animation: `scaleIn 0.4s ease both`,
                    animationDelay: `${pi * 0.1}s`,
                    transformOrigin: "bottom",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <span style={{ fontSize: 22, fontWeight: 900, color: idx === 0 ? "rgba(251,191,36,0.4)" : idx === 1 ? "rgba(148,163,184,0.35)" : "rgba(180,120,60,0.35)", fontVariantNumeric: "tabular-nums" }}>{idx + 1}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Rest of list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {(top3.length < 3 ? rows : rest).map((user, i) => {
          const rank = top3.length >= 3 ? i + 4 : i + 1;
          const isMe = dbUser && user.id === dbUser.id;
          return (
            <div key={user.id} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 16px", borderRadius: 12,
              background: isMe ? "rgba(34,197,94,0.05)" : "transparent",
              border: `1px solid ${isMe ? "rgba(34,197,94,0.2)" : "transparent"}`,
              animation: isMe ? "pulseMe 2s ease 0.5s both" : "none",
            }}>
              <span style={{ width: 28, textAlign: "center", fontSize: 13, fontWeight: 700, color: "var(--wc-text-3)", fontVariantNumeric: "tabular-nums" }}>
                {rank}
              </span>
              <Avatar name={user.name} size={34} isMe={!!isMe} />
              <span style={{ flex: 1, fontSize: 14, fontWeight: isMe ? 700 : 500, color: isMe ? "var(--wc-green)" : "var(--wc-text-1)" }}>
                {user.name}
                {isMe && <span style={{ fontSize: 10, color: "var(--wc-text-3)", fontWeight: 600, marginLeft: 6 }}>YOU</span>}
              </span>
              <div className="lb-bar" style={{ width: 80, height: 4, borderRadius: 99, background: "var(--wc-border)", overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 99, width: `${(user.total_score / max) * 100}%`, background: isMe ? "var(--wc-green)" : rank <= 10 ? "#f59e0b" : rank <= 25 ? "#3b82f6" : rank <= 50 ? "#a78bfa" : "var(--wc-text-3)", transition: "width 0.6s ease" }} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 800, color: isMe ? "var(--wc-green)" : "var(--wc-text-1)", fontVariantNumeric: "tabular-nums", minWidth: 48, textAlign: "right" }}>
                {user.total_score} <span style={{ fontSize: 10, fontWeight: 600, color: "var(--wc-text-3)" }}>pts</span>
              </span>
            </div>
          );
        })}
      </div>

      <AdBanner slot="9876543210" format="horizontal" className="mt-8" />
    </div>
  );
}
