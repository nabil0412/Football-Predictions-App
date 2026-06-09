import { supabaseAdmin } from "@/lib/db";
import { getOrCreateDbUser } from "@/lib/auth";
import { CaptainPicker } from "@/components/CaptainPicker";

export const dynamic = "force-dynamic";

async function getScheduleState() {
  const [{ data: firstMatch }, { count: unfinished }, { count: total }] = await Promise.all([
    supabaseAdmin.from("matches").select("kickoff_time").eq("stage", "group").order("kickoff_time", { ascending: true }).limit(1).single(),
    supabaseAdmin.from("matches").select("*", { count: "exact", head: true }).eq("stage", "group").neq("status", "finished"),
    supabaseAdmin.from("matches").select("*", { count: "exact", head: true }).eq("stage", "group"),
  ]);

  const tournamentStarted = firstMatch ? Date.now() >= new Date(firstMatch.kickoff_time).getTime() : false;
  const groupStageEnded = (total ?? 0) > 0 && (unfinished ?? 0) === 0;
  const firstKickoff = firstMatch ? new Date(firstMatch.kickoff_time) : null;

  return { tournamentStarted, groupStageEnded, firstKickoff };
}

export default async function CaptainPage() {
  const [dbUser, { data: allTeams }, { tournamentStarted, groupStageEnded, firstKickoff }] = await Promise.all([
    getOrCreateDbUser(),
    supabaseAdmin.from("teams").select("id, name, flag_url, iso_code, group").order("group").order("name"),
    getScheduleState(),
  ]);

  const hasCaptain = !!(dbUser?.captain_team_id);
  // Locked = can't make any change:
  // - Group stage ended (everyone locked)
  // - Tournament started AND already have a captain (can't change)
  const locked = groupStageEnded || (tournamentStarted && hasCaptain);

  const deadline = firstKickoff?.toLocaleString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  });

  const statusMessage = groupStageEnded
    ? "Captain selection is closed — group stage has ended"
    : tournamentStarted && hasCaptain
      ? "Tournament started — your captain is locked in"
      : tournamentStarted
        ? "Tournament is underway — pick your captain now (you won't be able to change it)"
        : deadline
          ? `Locks when the tournament starts · ${deadline}`
          : "Locks when the tournament starts";

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px" }}>
      <div style={{ marginBottom: 24, paddingTop: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: "var(--wc-text-1)", letterSpacing: "-0.02em", margin: 0 }}>
          Captain Pick
        </h1>
        <p style={{ fontSize: 13, color: "var(--wc-text-2)", marginTop: 4 }}>
          Choose one team to follow through the tournament
        </p>
      </div>

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
        <div style={{ width: "100%", fontSize: 11, color: tournamentStarted ? "var(--wc-text-2)" : "var(--wc-text-3)", marginTop: 4, fontWeight: tournamentStarted ? 600 : 400 }}>
          {statusMessage}
        </div>
      </div>

      <CaptainPicker
        teams={allTeams ?? []}
        currentCaptainId={dbUser?.captain_team_id ?? null}
        locked={locked}
        tournamentStarted={tournamentStarted}
      />
    </div>
  );
}
