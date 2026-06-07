import { supabaseAdmin } from "@/lib/db";
import { getOrCreateDbUser } from "@/lib/auth";
import { CaptainPicker } from "@/components/CaptainPicker";

export const dynamic = "force-dynamic";

async function getCaptainLockInfo() {
  const { data } = await supabaseAdmin
    .from("matches")
    .select("kickoff_time")
    .order("kickoff_time", { ascending: true })
    .limit(1)
    .single();

  if (!data) return { locked: false, lockTime: null };
  const lockTime = new Date(data.kickoff_time).getTime() - 60 * 60 * 1000;
  return {
    locked: Date.now() >= lockTime,
    lockTime: new Date(lockTime),
  };
}

export default async function CaptainPage() {
  const [dbUser, { data: allTeams }, { locked, lockTime }] = await Promise.all([
    getOrCreateDbUser(),
    supabaseAdmin.from("teams").select("id, name, flag_url, iso_code, group").order("group").order("name"),
    getCaptainLockInfo(),
  ]);

  const deadline = lockTime?.toLocaleString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px" }}>
      {/* Header */}
      <div style={{ marginBottom: 24, paddingTop: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: "var(--wc-text-1)", letterSpacing: "-0.02em", margin: 0 }}>
          Captain Pick
        </h1>
        <p style={{ fontSize: 13, color: "var(--wc-text-2)", marginTop: 4 }}>
          Choose one team to follow through the tournament
        </p>
      </div>

      {/* Scoring banner */}
      <div style={{
        background: "var(--wc-surface-alt)", border: "1px solid var(--wc-border)",
        borderRadius: 12, padding: "12px 16px", marginBottom: 24,
        display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center",
      }}>
        {([["R32", "+2"], ["R16", "+3"], ["QF", "+6"], ["SF", "+10"], ["Final", "+15"], ["Winner", "+25"]] as [string, string][]).map(([stage, pts]) => (
          <span key={stage} style={{ display: "flex", gap: 3, alignItems: "center", marginRight: 4 }}>
            <span style={{ fontSize: 11, color: "var(--wc-text-3)" }}>{stage}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--wc-green)" }}>{pts}</span>
            <span style={{ fontSize: 11, color: "var(--wc-border)" }}>·</span>
          </span>
        ))}
        <div style={{ width: "100%", fontSize: 11, color: "var(--wc-text-3)", marginTop: 4 }}>
          {locked
            ? "Captain picks are locked — tournament has started"
            : deadline
            ? `Locks at ${deadline} — 1 hour before kick-off`
            : "Locks 1 hour before the first match"}
        </div>
      </div>

      <CaptainPicker
        teams={allTeams ?? []}
        currentCaptainId={dbUser?.captain_team_id ?? null}
        locked={locked}
      />
    </div>
  );
}
