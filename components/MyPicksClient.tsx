"use client";

import { useState } from "react";
import Link from "next/link";
import { Trophy, Crosshair, Zap, Dices, CircleDot, Star, Pencil, ChevronDown } from "lucide-react";

interface Prediction { id: number; match_id: number; predicted_result: string; predicted_team_a_goals: number; predicted_team_b_goals: number; wildcard_type: string | null; points_earned: number | null }
interface Match { id: number; kickoff_time: string; status: string; stage: string; team_a_id: number; team_b_id: number; team_a_score: number | null; team_b_score: number | null }
interface Team { id: number; name: string; iso_code: string | null; flag_url?: string | null }

function FlagImg({ isoCode, flagUrl, name, size = 18 }: { isoCode?: string | null; flagUrl?: string | null; name: string; size?: number }) {
  const [err, setErr] = useState(false);
  const src = isoCode && !err ? `https://flagcdn.com/w40/${isoCode}.png` : (flagUrl ?? null);
  if (!src) return <div style={{ width: size * 1.4, height: size, borderRadius: 3, background: "var(--wc-surface-alt)" }} />;
  return <img src={src} alt={name} onError={() => setErr(true)} style={{ width: size * 1.4, height: size, borderRadius: 3, objectFit: "cover", display: "inline-block", verticalAlign: "middle" }} />;
}

function isEditable(kickoffTime: string) {
  const t = kickoffTime.includes('+') || kickoffTime.endsWith('Z') ? kickoffTime : kickoffTime + 'Z';
  return new Date(t).getTime() - Date.now() > 60 * 60 * 1000;
}

function resultLabel(r: string, a: string, b: string) {
  return r === "team_a_win" ? `${a} win` : r === "team_b_win" ? `${b} win` : "Draw";
}

const STAGE_LABELS: Record<string, string> = {
  group:"Group Stage", round_of_32:"R32", round_of_16:"R16", quarter_final:"QF", semi_final:"SF", final:"Final",
};

function WildcardIcon({ type }: { type: string }) {
  if (type === "confidence_pick") return <Crosshair size={12} />;
  if (type === "underdog_pick")   return <Zap size={12} />;
  if (type === "chaos_card")      return <Dices size={12} />;
  return null;
}

const WILDCARD_LABELS: Record<string, string> = {
  confidence_pick: "Confidence pick bonus",
  underdog_pick: "Underdog pick bonus",
  chaos_card: "Chaos card bonus",
};

function ScoreBreakdown({ prediction, match, teamA, teamB }: { prediction: Prediction; match: Match; teamA: Team; teamB: Team }) {
  const correctResult = (
    (match.team_a_score! > match.team_b_score! && prediction.predicted_result === "team_a_win") ||
    (match.team_b_score! > match.team_a_score! && prediction.predicted_result === "team_b_win") ||
    (match.team_a_score === match.team_b_score && prediction.predicted_result === "draw")
  );
  const correctA = prediction.predicted_team_a_goals === Math.min(match.team_a_score!, 4);
  const correctB = prediction.predicted_team_b_goals === Math.min(match.team_b_score!, 4);
  const perfect = correctResult && correctA && correctB;

  const basePoints = (correctResult ? 3 : 0) + (correctA ? 1 : 0) + (correctB ? 1 : 0) + (perfect ? 1 : 0);
  const wildcardEffect = prediction.wildcard_type && prediction.points_earned !== null
    ? prediction.points_earned - basePoints
    : null;

  const rows = [
    { label: "Correct result", pts: 3, correct: correctResult },
    { label: `${teamA.name} goals`, pts: 1, correct: correctA },
    { label: `${teamB.name} goals`, pts: 1, correct: correctB },
    { label: "Perfect prediction", pts: 1, correct: perfect },
  ];

  return (
    <div style={{ background: "var(--wc-surface-alt)", borderTop: "1px solid var(--wc-border)", padding: "14px 16px", animation: "slideUp 0.2s ease" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--wc-text-2)", marginBottom: 10 }}>
        {teamA.name} {match.team_a_score}–{match.team_b_score} {teamB.name}
        <span style={{ color: "var(--wc-text-3)", fontWeight: 400, marginLeft: 6 }}>
          (Your pick: {prediction.predicted_team_a_goals}–{prediction.predicted_team_b_goals})
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map((row, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: row.correct ? "var(--wc-green)" : "var(--wc-border)" }} />
              <span style={{ fontSize: 13, color: row.correct ? "var(--wc-text-1)" : "var(--wc-text-3)" }}>{row.label}</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: row.correct ? "var(--wc-green)" : "var(--wc-text-3)", fontVariantNumeric: "tabular-nums" }}>
              {row.correct ? `+${row.pts}` : "—"}
            </span>
          </div>
        ))}
        {prediction.wildcard_type && wildcardEffect !== null && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2, paddingTop: 6, borderTop: "1px dashed var(--wc-border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ display: "flex", color: wildcardEffect >= 0 ? "var(--wc-gold, #f5a623)" : "var(--wc-red)" }}>
                <WildcardIcon type={prediction.wildcard_type} />
              </span>
              <span style={{ fontSize: 13, color: "var(--wc-text-2)" }}>{WILDCARD_LABELS[prediction.wildcard_type] ?? "Wildcard bonus"}</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: wildcardEffect >= 0 ? "var(--wc-gold, #f5a623)" : "var(--wc-red)" }}>
              {wildcardEffect > 0 ? `+${wildcardEffect}` : wildcardEffect}
            </span>
          </div>
        )}
      </div>
      <div style={{ height: 1, background: "var(--wc-border)", margin: "10px 0" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--wc-text-1)" }}>Total</span>
        <span style={{ fontSize: 16, fontWeight: 900, fontVariantNumeric: "tabular-nums", color: (prediction.points_earned ?? 0) > 0 ? "var(--wc-green)" : "var(--wc-red)" }}>
          {(prediction.points_earned ?? 0) > 0 ? "+" : ""}{prediction.points_earned} pts
        </span>
      </div>
    </div>
  );
}

function PredictionRow({ p, match, teamA, teamB, showBreakdown, onToggle }: { p: Prediction; match: Match; teamA: Team; teamB: Team; showBreakdown: boolean; onToggle: () => void }) {
  const isFinished = match.status === "finished";
  const isLive = match.status === "live";
  const canEdit = match.status === "scheduled" && isEditable(match.kickoff_time);
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  const isPerfect = isFinished && match.team_a_score !== null && match.team_b_score !== null && (
    ((match.team_a_score > match.team_b_score && p.predicted_result === "team_a_win") ||
     (match.team_b_score > match.team_a_score && p.predicted_result === "team_b_win") ||
     (match.team_a_score === match.team_b_score && p.predicted_result === "draw")) &&
    p.predicted_team_a_goals === Math.min(match.team_a_score, 4) &&
    p.predicted_team_b_goals === Math.min(match.team_b_score, 4)
  );

  return (
    <div style={{ background: "var(--wc-surface)", border: "1px solid var(--wc-border)", borderRadius: 16, overflow: "hidden" }}>
      <div onClick={() => isFinished && onToggle()} style={{ padding: "14px 16px", cursor: isFinished ? "pointer" : "default", display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <FlagImg isoCode={teamA.iso_code} flagUrl={teamA.flag_url} name={teamA.name} size={18} />
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--wc-text-1)" }}>{teamA.name}</span>
            <span style={{ fontSize: 12, color: "var(--wc-text-3)" }}>vs</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--wc-text-1)" }}>{teamB.name}</span>
            <FlagImg isoCode={teamB.iso_code} flagUrl={teamB.flag_url} name={teamB.name} size={18} />
          </div>
          <div style={{ fontSize: 12, color: "var(--wc-text-2)" }}>
            Your pick: <span style={{ fontWeight: 700, color: "var(--wc-text-1)" }}>{p.predicted_team_a_goals}–{p.predicted_team_b_goals}</span>
            {" · "}{resultLabel(p.predicted_result, teamA.name, teamB.name)}
            {p.wildcard_type && <span style={{ marginLeft: 6, verticalAlign: "middle", display: "inline-flex" }}><WildcardIcon type={p.wildcard_type} /></span>}
          </div>
          <div style={{ fontSize: 11, color: "var(--wc-text-3)", marginTop: 2 }}>
            {STAGE_LABELS[match.stage] ?? match.stage} · {fmtDate(match.kickoff_time)}
            {isLive && <span style={{ color: "var(--wc-red)", fontWeight: 700, marginLeft: 6 }}>● LIVE</span>}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          {isFinished && p.points_earned !== null && (
            <span style={{ fontSize: 16, fontWeight: 900, fontVariantNumeric: "tabular-nums", color: p.points_earned > 0 ? "var(--wc-green)" : "var(--wc-red)" }}>
              {p.points_earned > 0 ? "+" : ""}{p.points_earned}
              <span style={{ fontSize: 10, fontWeight: 600, color: "var(--wc-text-3)", marginLeft: 2 }}>pts</span>
            </span>
          )}
          {isPerfect && <span title="Perfect prediction"><Star size={14} color="var(--wc-gold, #f5a623)" fill="var(--wc-gold, #f5a623)" /></span>}
          {canEdit && (
            <Link href={`/predictions/${match.id}`} style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--wc-surface-alt)", border: "1px solid var(--wc-border)", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 700, color: "var(--wc-text-2)", textDecoration: "none" }}>
              <Pencil size={11} /> Edit
            </Link>
          )}
          {isFinished && <ChevronDown size={16} color="var(--wc-text-3)" style={{ transform: showBreakdown ? "rotate(180deg)" : "none", transition: "transform 0.2s", display: "block" }} />}
        </div>
      </div>
      {isFinished && showBreakdown && <ScoreBreakdown prediction={p} match={match} teamA={teamA} teamB={teamB} />}
    </div>
  );
}

export function MyPicksClient({ predictions, matches, teams }: { predictions: Prediction[]; matches: Match[]; teams: Team[] }) {
  const [tab, setTab] = useState<"upcoming"|"finished">("upcoming");
  const [openBreakdowns, setOpenBreakdowns] = useState<Record<number, boolean>>({});

  const matchMap = Object.fromEntries(matches.map(m => [m.id, m]));
  const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));

  const upcoming = predictions.filter(p => { const s = matchMap[p.match_id]?.status; return s !== "finished"; });
  const finished = predictions.filter(p => matchMap[p.match_id]?.status === "finished");
  const current = tab === "upcoming" ? upcoming : finished;

  const tabStyle = (id: string): React.CSSProperties => ({
    flex: 1, height: 36, borderRadius: 8, border: "none", cursor: "pointer",
    background: tab === id ? "var(--wc-surface)" : "none",
    color: tab === id ? "var(--wc-text-1)" : "var(--wc-text-3)",
    fontSize: 13, fontWeight: 700, transition: "all 0.15s",
  });

  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ display: "flex", gap: 4, background: "var(--wc-surface-alt)", borderRadius: 10, padding: 4, marginBottom: 20 }}>
        <button style={tabStyle("upcoming")} onClick={() => setTab("upcoming")}>Upcoming · {upcoming.length}</button>
        <button style={tabStyle("finished")} onClick={() => setTab("finished")}>Finished · {finished.length}</button>
      </div>

      {current.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 16px" }}>
          <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}><CircleDot size={40} color="var(--wc-text-3)" strokeWidth={1.5} /></div>
          <p style={{ color: "var(--wc-text-2)", fontWeight: 600, fontSize: 15 }}>
            {tab === "upcoming" ? "No upcoming picks" : "No finished matches yet"}
          </p>
          {tab === "upcoming" && (
            <Link href="/" style={{ color: "var(--wc-green)", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>Browse matches →</Link>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {current.map(p => {
            const m = matchMap[p.match_id];
            if (!m) return null;
            return (
              <PredictionRow
                key={p.id} p={p} match={m}
                teamA={teamMap[m.team_a_id] ?? { id: m.team_a_id, name: "?", iso_code: null }}
                teamB={teamMap[m.team_b_id] ?? { id: m.team_b_id, name: "?", iso_code: null }}
                showBreakdown={!!openBreakdowns[p.match_id]}
                onToggle={() => setOpenBreakdowns(prev => ({ ...prev, [p.match_id]: !prev[p.match_id] }))}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
