"use client";

import Link from "next/link";
import { useState } from "react";
import { Lock, Crosshair, Zap, Dices } from "lucide-react";
import type { MatchWithTeams } from "@/components/MatchList";

function Flag({ iso, flagUrl, name, size = 40 }: { iso?: string | null; flagUrl?: string | null; name: string; size?: number }) {
  const [err, setErr] = useState(false);
  const src = iso && !err ? `https://flagcdn.com/w${size <= 24 ? 40 : 80}/${iso}.png` : (flagUrl ?? null);
  if (!src) {
    return (
      <div style={{ width: Math.round(size * 1.43), height: size, borderRadius: 4, background: "var(--wc-surface-alt)", border: "1px solid var(--wc-border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--wc-text-3)", fontSize: size * 0.4, fontWeight: 700 }}>?</div>
    );
  }
  return (
    <img
      src={src}
      alt={name}
      onError={() => setErr(true)}
      style={{ width: Math.round(size * 1.43), height: size, borderRadius: 4, objectFit: "cover", boxShadow: "0 1px 6px rgba(0,0,0,0.5)", display: "block", flexShrink: 0 }}
    />
  );
}

function StatusBadge({ status, minute }: { status: string; minute?: number | null }) {
  if (status === "live") return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 99, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", background: "var(--wc-red)", color: "#fff" }}>
      <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", flexShrink: 0 }} />
      {minute ? `${minute}'` : "LIVE"}
    </span>
  );
  if (status === "finished") return (
    <span style={{ padding: "3px 9px", borderRadius: 99, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", background: "var(--wc-surface-alt)", color: "var(--wc-text-3)" }}>FT</span>
  );
  if (status === "locked") return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 99, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", background: "var(--wc-surface-alt)", border: "1px solid var(--wc-border)", color: "var(--wc-text-2)" }}>
      <Lock size={10} strokeWidth={2.5} />Locked
    </span>
  );
  return null;
}

export function MatchCard({ match, myPick }: {
  match: MatchWithTeams;
  myPick?: { homeGoals: number; awayGoals: number; wildcard?: string | null; points?: number | null } | null;
}) {
  const { status } = match;
  const isLive     = status === "live";
  const isDone     = status === "finished";
  const isLocked   = status === "locked";
  const isUpcoming = status === "scheduled";
  const isClickable = isUpcoming || isLocked;

  const utcKickoff = match.kickoff_time.includes('+') || match.kickoff_time.endsWith('Z') ? match.kickoff_time : match.kickoff_time + 'Z';
  const time = new Date(utcKickoff).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const dateLabel = new Date(utcKickoff)
    .toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
    .toUpperCase();

  const stageLabel = match.stage === "group" && match.matchday
    ? `Group · MD${match.matchday}`
    : match.stage.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  const wcIcon = myPick?.wildcard === "confidence_pick" ? <Crosshair size={12} /> : myPick?.wildcard === "underdog_pick" ? <Zap size={12} /> : myPick?.wildcard === "chaos_card" ? <Dices size={12} /> : null;

  const inner = (
    <div className={`match-card${isLive ? " live" : isDone ? " done" : isLocked ? " locked" : ""}`}>
      {/* Top meta */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px 0" }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--wc-text-3)" }}>
          {stageLabel}
        </span>
        <StatusBadge status={status} />
      </div>

      {/* Teams row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8, padding: "14px 20px" }}>
        {/* Home */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 7 }}>
          <Flag iso={match.teamA.iso_code} flagUrl={match.teamA.flag_url} name={match.teamA.name} size={40} />
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--wc-text-1)", lineHeight: 1 }}>
            {match.teamA.short || (match.teamA.iso_code ? match.teamA.iso_code.toUpperCase() : match.teamA.name)}
          </span>
        </div>

        {/* Centre */}
        <div style={{ textAlign: "center", minWidth: 90 }}>
          {(isLive || isDone) ? (
            <>
              <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", color: "var(--wc-text-1)", lineHeight: 1 }}>
                {match.team_a_score}
                <span style={{ color: "var(--wc-text-3)", fontWeight: 300, margin: "0 6px" }}>—</span>
                {match.team_b_score}
              </div>
              {isDone && <div style={{ fontSize: 10, color: "var(--wc-text-3)", marginTop: 5, letterSpacing: "0.08em", textTransform: "uppercase" }}>Full Time</div>}
            </>
          ) : (
            <>
              <div style={{ fontSize: 18, fontWeight: 800, color: "var(--wc-text-1)", letterSpacing: "-0.01em" }}>{time}</div>
              <div style={{ fontSize: 11, color: "var(--wc-text-3)", marginTop: 3 }}>{dateLabel}</div>
              {isLocked && <div style={{ fontSize: 10, color: "var(--wc-text-2)", marginTop: 4, letterSpacing: "0.06em", textTransform: "uppercase" }}>Locked</div>}
            </>
          )}
        </div>

        {/* Away */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 7 }}>
          <Flag iso={match.teamB.iso_code} flagUrl={match.teamB.flag_url} name={match.teamB.name} size={40} />
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--wc-text-1)", lineHeight: 1 }}>
            {match.teamB.short || (match.teamB.iso_code ? match.teamB.iso_code.toUpperCase() : match.teamB.name)}
          </span>
        </div>
      </div>

      {/* Pick display: chip for non-upcoming (shows points); edit row for upcoming */}
      {myPick && !isUpcoming && (
        <div style={{ margin: "0 20px 12px", padding: "8px 12px", borderRadius: 9, background: "var(--wc-surface-alt)", border: "1px solid var(--wc-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: "var(--wc-text-3)", display: "inline-flex", alignItems: "center", gap: 5 }}>
            Your pick: <span style={{ color: "var(--wc-text-2)", fontWeight: 700 }}>{myPick.homeGoals}–{myPick.awayGoals}</span>
            {wcIcon}
          </span>
          {myPick.points != null && (
            <span style={{ fontSize: 13, fontWeight: 700, color: myPick.points >= 0 ? "var(--wc-green)" : "var(--wc-red)" }}>
              {myPick.points > 0 ? "+" : ""}{myPick.points} pts
            </span>
          )}
        </div>
      )}

      {/* Predict CTA or edit row for upcoming */}
      {isUpcoming && !myPick && <div className="predict-cta">Predict this match →</div>}
      {isUpcoming && myPick && (
        <div style={{
          borderTop: "1px solid rgba(34,197,94,0.15)", background: "rgba(34,197,94,0.05)",
          padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 14, color: "var(--wc-text-3)", display: "inline-flex", alignItems: "center", gap: 5 }}>
            Your pick: <span style={{ color: "var(--wc-text-2)", fontWeight: 700 }}>{myPick.homeGoals}–{myPick.awayGoals}</span>
            {wcIcon}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--wc-green)" }}>Edit →</span>
        </div>
      )}
    </div>
  );

  if (isClickable) {
    return <Link href={`/predictions/${match.id}`} style={{ textDecoration: "none", display: "block" }}>{inner}</Link>;
  }
  return inner;
}
