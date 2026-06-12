"use client";

import { useState } from "react";
import { ChevronDown, Crosshair, Zap, Dices } from "lucide-react";

interface Team { id: number; name: string; flag_url: string | null; iso_code?: string | null }
interface Match {
  id: number; kickoff_time: string; status: string; stage: string; matchday: number | null;
  team_a_score: number | null; team_b_score: number | null;
  teamA: Team; teamB: Team;
}
interface Prediction {
  userId: number | null; name: string; predicted_result: string;
  predicted_team_a_goals: number; predicted_team_b_goals: number;
  wildcard_type: string | null; points_earned: number | null;
}

function initials(name: string) {
  return name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
}

function Flag({ iso, flagUrl, name, size = 36 }: { iso?: string | null; flagUrl?: string | null; name: string; size?: number }) {
  const [err, setErr] = useState(false);
  const src = iso && !err ? `https://flagcdn.com/w80/${iso}.png` : (flagUrl ?? null);
  if (!src) return <div style={{ width: Math.round(size * 1.43), height: size, borderRadius: 4, background: "var(--wc-surface-alt)", border: "1px solid var(--wc-border)" }} />;
  return <img src={src} alt={name} onError={() => setErr(true)} style={{ width: Math.round(size * 1.43), height: size, borderRadius: 4, objectFit: "cover", boxShadow: "0 1px 4px rgba(0,0,0,0.4)", display: "block", flexShrink: 0 }} />;
}

function WildcardIcon({ type }: { type: string }) {
  if (type === "confidence_pick") return <Crosshair size={11} />;
  if (type === "underdog_pick") return <Zap size={11} />;
  if (type === "chaos_card") return <Dices size={11} />;
  return null;
}

const STAGE_LABELS: Record<string, string> = {
  group: "Group Stage", round_of_32: "R32", round_of_16: "R16",
  quarter_final: "QF", semi_final: "SF", final: "Final",
};

const RESULT_LABELS: Record<string, (a: string, b: string) => string> = {
  team_a_win: (a) => `${a} win`,
  team_b_win: (_, b) => `${b} win`,
  draw: () => "Draw",
};

export function ResultsMatchCard({ match, currentUserId }: { match: Match; currentUserId: number | null }) {
  const [open, setOpen] = useState(false);
  const [predictions, setPredictions] = useState<Prediction[] | null>(null);
  const [loading, setLoading] = useState(false);

  const isFinished = match.status === "finished";
  const isLive = match.status === "live";

  const utcKickoff = match.kickoff_time.includes('+') || match.kickoff_time.endsWith('Z')
    ? match.kickoff_time : match.kickoff_time + 'Z';
  const time = new Date(utcKickoff).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const dateLabel = new Date(utcKickoff).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }).toUpperCase();
  const stageLabel = match.stage === "group" && match.matchday
    ? `Group · MD${match.matchday}` : (STAGE_LABELS[match.stage] ?? match.stage);

  async function toggle() {
    setOpen(o => !o);
    if (!predictions && !loading) {
      setLoading(true);
      const res = await fetch(`/api/match-predictions/${match.id}`);
      if (res.ok) setPredictions(await res.json());
      setLoading(false);
    }
  }

  return (
    <div style={{ background: "var(--wc-surface)", border: "1px solid var(--wc-border)", borderRadius: 16, overflow: "hidden" }}>
      <div onClick={toggle} style={{ padding: "14px 16px", cursor: "pointer" }}>
        {/* Meta */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--wc-text-3)" }}>
            {stageLabel} · {dateLabel}
          </span>
          {isLive ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px", borderRadius: 99, fontSize: 10, fontWeight: 700, background: "var(--wc-red)", color: "#fff" }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#fff" }} />LIVE
            </span>
          ) : isFinished ? (
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--wc-text-3)", letterSpacing: "0.08em" }}>FT</span>
          ) : (
            <span style={{ fontSize: 10, fontWeight: 700, color: "#f59e0b", letterSpacing: "0.08em" }}>LOCKED</span>
          )}
        </div>

        {/* Teams + Score */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
            <Flag iso={match.teamA.iso_code} flagUrl={match.teamA.flag_url} name={match.teamA.name} size={32} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--wc-text-1)" }}>{match.teamA.name}</span>
          </div>

          <div style={{ textAlign: "center", minWidth: 72 }}>
            {(isFinished || isLive) && match.team_a_score !== null ? (
              <div style={{ fontSize: 26, fontWeight: 900, color: "var(--wc-text-1)", letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums" }}>
                {match.team_a_score} – {match.team_b_score}
              </div>
            ) : (
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--wc-text-3)" }}>{time}</div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <Flag iso={match.teamB.iso_code} flagUrl={match.teamB.flag_url} name={match.teamB.name} size={32} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--wc-text-1)", textAlign: "right" }}>{match.teamB.name}</span>
          </div>
        </div>

        {/* Expand chevron */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
          <ChevronDown size={16} color="var(--wc-text-3)" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
        </div>
      </div>

      {/* Predictions list */}
      {open && (
        <div style={{ borderTop: "1px solid var(--wc-border)", background: "var(--wc-surface-alt)" }}>
          {loading && (
            <div style={{ padding: "20px 16px", textAlign: "center", fontSize: 13, color: "var(--wc-text-3)" }}>Loading…</div>
          )}
          {predictions && predictions.length === 0 && (
            <div style={{ padding: "20px 16px", textAlign: "center", fontSize: 13, color: "var(--wc-text-3)" }}>No predictions for this match.</div>
          )}
          {predictions && predictions.length > 0 && (
            <div>
              {/* Header */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, padding: "8px 16px", borderBottom: "1px solid var(--wc-border)" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--wc-text-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Player</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--wc-text-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Pick</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--wc-text-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Pts</span>
              </div>
              {predictions.map((p, i) => {
                const isMe = p.userId === currentUserId;
                return (
                  <div key={i} style={{
                    display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8,
                    padding: "10px 16px", alignItems: "center",
                    background: isMe ? "rgba(34,197,94,0.06)" : "transparent",
                    borderBottom: i < predictions.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  }}>
                    {/* Avatar + name */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                        background: isMe ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)",
                        border: isMe ? "1.5px solid rgba(34,197,94,0.4)" : "1.5px solid var(--wc-border)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, fontWeight: 700, color: isMe ? "var(--wc-green)" : "var(--wc-text-2)",
                      }}>
                        {initials(p.name)}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: isMe ? 700 : 500, color: isMe ? "var(--wc-green)" : "var(--wc-text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.name}
                      </span>
                    </div>

                    {/* Pick */}
                    <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end" }}>
                      {p.wildcard_type && (
                        <span style={{ color: "var(--wc-text-3)" }}><WildcardIcon type={p.wildcard_type} /></span>
                      )}
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--wc-text-1)", fontVariantNumeric: "tabular-nums" }}>
                        {p.predicted_team_a_goals}–{p.predicted_team_b_goals}
                      </span>
                    </div>

                    {/* Points */}
                    <div style={{ minWidth: 36, textAlign: "right" }}>
                      {p.points_earned !== null ? (
                        <span style={{
                          fontSize: 13, fontWeight: 800, fontVariantNumeric: "tabular-nums",
                          color: p.points_earned > 0 ? "var(--wc-green)" : p.points_earned < 0 ? "var(--wc-red)" : "var(--wc-text-3)",
                        }}>
                          {p.points_earned > 0 ? "+" : ""}{p.points_earned}
                        </span>
                      ) : (
                        <span style={{ fontSize: 13, color: "var(--wc-text-3)" }}>—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
