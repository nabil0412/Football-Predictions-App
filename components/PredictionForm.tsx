"use client";

import React, { useState, useEffect } from "react";
import { Crosshair, Zap, Dices } from "lucide-react";
import { WILDCARD_LIMITS } from "@/lib/scoring";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type WildcardType = "confidence_pick" | "underdog_pick" | "chaos_card";
type ChaosCardType = "common" | "medium" | "rare";
type Result = "team_a_win" | "draw" | "team_b_win";

interface Team { id: number; name: string; flagUrl: string | null; isoCode?: string | null }
interface MatchData {
  id: number; kickoffTime: Date | string; status: string; stage: string;
  teamAScore: number | null; teamBScore: number | null; teamA: Team; teamB: Team;
  underdogTeamId?: number | null;
}
interface ExistingPrediction {
  predicted_result: Result; predicted_team_a_goals: number; predicted_team_b_goals: number;
  wildcard_type?: WildcardType | null; chaos_card_type?: ChaosCardType | null;
  predicted_goes_to_et?: boolean | null; predicted_penalty_winner?: string | null;
}

// WILDCARDS built inside component so desc can reference underdogTeam name
const CHAOS_EVENTS = [
  { id: "common" as ChaosCardType, label: "Common", desc: "Red card in the game",   bonus: "+4",  requiresGoals: false },
  { id: "medium" as ChaosCardType, label: "Medium", desc: "VAR overturned goal",     bonus: "+7",  requiresGoals: false },
  { id: "rare"   as ChaosCardType, label: "Rare",   desc: "Hat-trick (3+ goals)",    bonus: "+12", requiresGoals: true  },
];
const GOALS = [0, 1, 2, 3, "4+"] as const;

function FlagImg({ isoCode, flagUrl, name, size = 36 }: { isoCode?: string | null; flagUrl?: string | null; name: string; size?: number }) {
  const [err, setErr] = useState(false);
  const src = isoCode && !err ? `https://flagcdn.com/w80/${isoCode}.png` : (flagUrl ?? null);
  if (!src) return <div style={{ width: size * 1.4, height: size, borderRadius: 4, background: "var(--wc-surface-alt)" }} />;
  return <img src={src} alt={name} onError={() => setErr(true)} style={{ width: size * 1.4, height: size, borderRadius: 4, objectFit: "cover", boxShadow: "0 1px 4px rgba(0,0,0,0.4)", display: "block" }} />;
}

function deriveResult(a: string, b: string): Result | null {
  if (a === "" || b === "") return null;
  const na = parseInt(a), nb = parseInt(b);
  if (na === 4 && nb === 4) return null;
  if (na > nb) return "team_a_win";
  if (nb > na) return "team_b_win";
  return "draw";
}

function toUTC(s: Date | string): Date {
  if (s instanceof Date) return s;
  return new Date(s.includes('+') || s.endsWith('Z') ? s : s + 'Z');
}

function isEditable(kickoffTime: Date | string) {
  return toUTC(kickoffTime).getTime() - Date.now() > 60 * 60 * 1000;
}

function fmtDate(dt: Date | string) {
  return toUTC(dt).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export function PredictionForm({ match, existing, wildcardUsed = {}, underdogTeamId = null }: { match: MatchData; existing?: ExistingPrediction | null; wildcardUsed?: Record<string, number>; underdogTeamId?: number | null }) {
  const router = useRouter();
  const editable = isEditable(match.kickoffTime) && match.status === "scheduled";
  const [aGoals, setAGoals] = useState(existing ? String(existing.predicted_team_a_goals) : "");
  const [bGoals, setBGoals] = useState(existing ? String(existing.predicted_team_b_goals) : "");
  const [manualResult, setManualResult] = useState<Result | "">(existing?.predicted_result ?? "");
  const [wildcard, setWildcard] = useState<WildcardType | null>(existing?.wildcard_type ?? null);
  const [chaos, setChaos] = useState<ChaosCardType | null>(existing?.chaos_card_type ?? null);
  const [goesToET, setGoesToET] = useState<boolean>(existing?.predicted_goes_to_et ?? false);
  const [penaltyWinner, setPenaltyWinner] = useState<"team_a" | "team_b" | null>(
    (existing?.predicted_penalty_winner as "team_a" | "team_b" | null) ?? null
  );

  // Underdog: which result outcome means the underdog wins
  const underdogResult: Result | null = underdogTeamId
    ? underdogTeamId === match.teamA.id ? "team_a_win" : "team_b_win"
    : null;
  const underdogTeam = underdogTeamId
    ? underdogTeamId === match.teamA.id ? match.teamA : match.teamB
    : null;
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const KO_STAGES = ["round_of_32", "round_of_16", "quarter_final", "semi_final", "final"];
  const isKnockout = KO_STAGES.includes(match.stage);

  const derived = deriveResult(aGoals, bGoals);
  const result: Result | "" = derived ?? manualResult;
  const ambiguous = aGoals === "4" && bGoals === "4";
  const time = new Date(match.kickoffTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  useEffect(() => { if (derived !== null) setManualResult(derived); }, [derived]);

  // Auto-deselect underdog wildcard if result no longer matches underdog
  useEffect(() => {
    if (wildcard === "underdog_pick" && result && underdogResult && result !== underdogResult) {
      setWildcard(null);
    }
  }, [result, wildcard, underdogResult]);

  // Reset ET/penalty when result changes
  useEffect(() => {
    if (result === "draw") setGoesToET(false);
    else setPenaltyWinner(null);
  }, [result]);

  // Auto-deselect rare chaos if no team predicted to score 3+
  useEffect(() => {
    if (chaos === "rare" && parseInt(aGoals) < 3 && parseInt(bGoals) < 3) {
      setChaos(null);
      if (wildcard === "chaos_card") setWildcard(null);
    }
  }, [aGoals, bGoals, chaos, wildcard]);

  // Per-wildcard eligibility
  const underdogEligible = underdogResult !== null && result === underdogResult;
  const rareEligible = parseInt(aGoals) >= 3 || parseInt(bGoals) >= 3;

  const WILDCARDS: { id: WildcardType; icon: React.ReactNode; name: string; desc: string; badge: string; eligible?: boolean; eligibilityHint?: string }[] = [
    {
      id: "confidence_pick",
      icon: <Crosshair size={22} strokeWidth={1.75} />,
      name: "Double Down",
      desc: "Doubles your points if correct, −3 if wrong",
      badge: "×2 pts",
    },
    {
      id: "underdog_pick",
      icon: <Zap size={22} strokeWidth={1.75} />,
      name: "Underdog",
      desc: underdogTeam
        ? `+8 if ${underdogTeam.name} wins (underdog), −3 if not`
        : "No odds available for this match",
      badge: "+8 pts",
      eligible: underdogResult !== null,
      eligibilityHint: !underdogResult
        ? "No odds data"
        : result !== underdogResult
        ? `Pick ${underdogTeam?.name} to win first`
        : undefined,
    },
    {
      id: "chaos_card",
      icon: <Dices size={22} strokeWidth={1.75} />,
      name: "Chaos Card",
      desc: "Predict a chaos event — +4 / +7 / +12 if it happens",
      badge: "+4–12",
    },
  ];

  async function save() {
    if (aGoals === "" || bGoals === "") { toast.error("Pick goal counts for both teams."); return; }
    if (!result) { toast.error("Pick a result — both teams at 4+ is ambiguous."); return; }
    if (wildcard === "chaos_card" && !chaos) { toast.error("Choose a chaos event."); return; }
    if (isKnockout && result === "draw" && !penaltyWinner) { toast.error("Select who wins on penalties."); return; }
    setSubmitting(true);
    const res = await fetch("/api/predictions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId: match.id, predictedResult: result, predictedTeamAGoals: parseInt(aGoals), predictedTeamBGoals: parseInt(bGoals), wildcardType: wildcard ?? undefined, chaosCardType: wildcard === "chaos_card" ? chaos : undefined, predictedGoesToET: isKnockout && result !== "draw" ? goesToET : undefined, predictedPenaltyWinner: isKnockout && result === "draw" ? penaltyWinner : undefined }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) { toast.error(data.error ?? "Failed to save."); return; }
    setSaved(true);
    setTimeout(() => { router.push("/my-predictions"); router.refresh(); }, 600);
  }

  return (
    <div style={{ paddingBottom: 32 }}>
      <button onClick={() => router.back()} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "var(--wc-text-2)", fontSize: 13, fontWeight: 600, padding: 0, marginBottom: 20 }}>
        ← Back
      </button>

      {/* Match header */}
      <div style={{ background: "var(--wc-surface)", border: "1px solid var(--wc-border)", borderRadius: 16, padding: "20px 20px 16px", marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: "var(--wc-text-3)", marginBottom: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          {match.stage.replace(/_/g, " ")} · {fmtDate(match.kickoffTime)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
            <FlagImg isoCode={match.teamA.isoCode} flagUrl={match.teamA.flagUrl} name={match.teamA.name} size={36} />
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--wc-text-1)" }}>{match.teamA.name}</span>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--wc-text-1)" }}>{time}</div>
            {!editable && match.status === "scheduled" && <div style={{ fontSize: 11, color: "var(--wc-text-2)", marginTop: 6, fontWeight: 600 }}>Locked — predictions closed</div>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            <FlagImg isoCode={match.teamB.isoCode} flagUrl={match.teamB.flagUrl} name={match.teamB.name} size={36} />
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--wc-text-1)" }}>{match.teamB.name}</span>
          </div>
        </div>
      </div>

      {/* Score pickers */}
      <div style={{ background: "var(--wc-surface)", border: "1px solid var(--wc-border)", borderRadius: 16, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--wc-text-3)", marginBottom: 16 }}>Your Prediction</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[{ label: match.teamA.name, val: aGoals, set: setAGoals }, { label: match.teamB.name, val: bGoals, set: setBGoals }].map((row, ri) => (
            <div key={ri}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--wc-text-3)", marginBottom: 8 }}>{row.label} goals</div>
              <div style={{ display: "flex", gap: 8 }}>
                {GOALS.map(g => {
                  const gStr = String(typeof g === "number" ? g : 4);
                  const active = row.val === gStr;
                  return (
                    <button key={g} onClick={() => editable && row.set(gStr)} style={{ flex: 1, minHeight: 48, borderRadius: 10, background: active ? "var(--wc-green)" : "var(--wc-surface-alt)", border: `1.5px solid ${active ? "var(--wc-green)" : "var(--wc-border)"}`, color: active ? "#000" : "var(--wc-text-2)", fontSize: 16, fontWeight: 800, cursor: editable ? "pointer" : "not-allowed", transition: "all 0.12s", fontVariantNumeric: "tabular-nums", opacity: editable ? 1 : 0.5 }}>
                      {g}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {result && !ambiguous && (
          <div style={{ marginTop: 16, padding: "10px 16px", borderRadius: 10, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", textAlign: "center", fontSize: 13, fontWeight: 700, color: "var(--wc-green)" }}>
            Result: {result === "team_a_win" ? `${match.teamA.name} win` : result === "team_b_win" ? `${match.teamB.name} win` : "Draw"}
          </div>
        )}

        {ambiguous && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--wc-text-3)", marginBottom: 8 }}>Both 4+ — who wins?</div>
            <div style={{ display: "flex", gap: 8 }}>
              {(["team_a_win","draw","team_b_win"] as Result[]).map(r => (
                <button key={r} onClick={() => editable && setManualResult(r)} style={{ flex: 1, minHeight: 40, borderRadius: 10, background: manualResult === r ? "var(--wc-green)" : "var(--wc-surface-alt)", border: `1.5px solid ${manualResult === r ? "var(--wc-green)" : "var(--wc-border)"}`, color: manualResult === r ? "#000" : "var(--wc-text-2)", fontSize: 12, fontWeight: 700, cursor: editable ? "pointer" : "not-allowed" }}>
                  {r === "team_a_win" ? match.teamA.name : r === "team_b_win" ? match.teamB.name : "Draw"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* DEBUG - remove after testing */}
        <div style={{ fontSize: 10, color: "red" }}>stage: {match.stage} | ko: {String(isKnockout)}</div>

        {/* Knockout extra options */}
        {isKnockout && result && !ambiguous && (
          <div style={{ marginTop: 14, borderTop: "1px solid var(--wc-border)", paddingTop: 14 }}>
            {result !== "draw" ? (
              <button
                onClick={() => editable && setGoesToET(!goesToET)}
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: goesToET ? "rgba(34,197,94,0.07)" : "var(--wc-surface-alt)", border: `1.5px solid ${goesToET ? "var(--wc-green)" : "var(--wc-border)"}`, borderRadius: 10, padding: "10px 14px", cursor: editable ? "pointer" : "not-allowed", transition: "all 0.15s" }}
              >
                <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${goesToET ? "var(--wc-green)" : "var(--wc-border)"}`, background: goesToET ? "var(--wc-green)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                  {goesToET && <span style={{ color: "#000", fontSize: 12, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                </div>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: goesToET ? "var(--wc-text-1)" : "var(--wc-text-2)" }}>Goes to Extra Time</div>
                  <div style={{ fontSize: 11, color: "var(--wc-text-3)", marginTop: 1 }}>+1 pt if correct</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 99, background: "var(--wc-surface)", border: `1px solid ${goesToET ? "rgba(34,197,94,0.35)" : "var(--wc-border)"}`, color: goesToET ? "var(--wc-green)" : "var(--wc-text-3)" }}>+1</span>
              </button>
            ) : (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--wc-text-3)", marginBottom: 8 }}>Penalty winner <span style={{ color: "var(--wc-red)" }}>*</span></div>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["team_a", "team_b"] as const).map(side => {
                    const team = side === "team_a" ? match.teamA : match.teamB;
                    const active = penaltyWinner === side;
                    return (
                      <button key={side} onClick={() => editable && setPenaltyWinner(active ? null : side)} style={{ flex: 1, minHeight: 40, borderRadius: 10, background: active ? "rgba(34,197,94,0.08)" : "var(--wc-surface-alt)", border: `1.5px solid ${active ? "var(--wc-green)" : "var(--wc-border)"}`, color: active ? "var(--wc-green)" : "var(--wc-text-2)", fontSize: 13, fontWeight: 700, cursor: editable ? "pointer" : "not-allowed", transition: "all 0.15s" }}>
                        {team.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Wildcards */}
      <div style={{ background: "var(--wc-surface)", border: "1px solid var(--wc-border)", borderRadius: 16, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--wc-text-3)", marginBottom: 14 }}>Wildcard (optional)</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {WILDCARDS.map(wc => {
            const active = wildcard === wc.id;
            const limit = WILDCARD_LIMITS[wc.id];
            const used = wildcardUsed[wc.id] ?? 0;
            const exhausted = used >= limit;
            const remaining = limit - used;

            // Per-wildcard eligibility
            const ineligible = wc.id === "underdog_pick"
              ? !underdogEligible
              : false; // chaos_card and confidence_pick always eligible (rare validated separately)

            const blocked = !editable || exhausted || (ineligible && !active);
            const hint = exhausted
              ? "used up"
              : ineligible && wc.eligibilityHint
              ? wc.eligibilityHint
              : `${remaining}/${limit} left`;

            return (
              <button
                key={wc.id}
                onClick={() => !blocked && setWildcard(active ? null : wc.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12,
                  background: active ? "rgba(34,197,94,0.06)" : "var(--wc-surface-alt)",
                  border: `1.5px solid ${active ? "var(--wc-green)" : "var(--wc-border)"}`,
                  cursor: blocked ? "not-allowed" : "pointer",
                  textAlign: "left", transition: "all 0.15s",
                  opacity: blocked && !active ? 0.4 : 1,
                }}
              >
                <span style={{ color: active ? "var(--wc-green)" : "var(--wc-text-2)", flexShrink: 0 }}>{wc.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: active ? "var(--wc-text-1)" : "var(--wc-text-2)" }}>{wc.name}</div>
                  <div style={{ fontSize: 12, color: "var(--wc-text-3)", marginTop: 1 }}>{wc.desc}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 99, background: "var(--wc-surface)", border: `1px solid ${active ? "rgba(34,197,94,0.35)" : "var(--wc-border)"}`, color: active ? "var(--wc-green)" : "var(--wc-text-3)" }}>
                    {wc.badge}
                  </span>
                  <span style={{ fontSize: 10, color: exhausted || ineligible ? "var(--wc-red)" : "var(--wc-text-3)", fontWeight: 600 }}>
                    {hint}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {wildcard === "chaos_card" && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--wc-text-3)", marginBottom: 10 }}>Choose chaos event</div>
            <div style={{ display: "flex", gap: 8 }}>
              {CHAOS_EVENTS.map(ev => {
                const active = chaos === ev.id;
                const evBlocked = ev.requiresGoals && !rareEligible;
                return (
                  <button
                    key={ev.id}
                    onClick={() => !evBlocked && setChaos(active ? null : ev.id)}
                    style={{
                      flex: 1, padding: "10px 8px", borderRadius: 10, textAlign: "center",
                      background: active ? "rgba(34,197,94,0.07)" : "var(--wc-surface)",
                      border: `1.5px solid ${active ? "var(--wc-green)" : "var(--wc-border)"}`,
                      cursor: evBlocked ? "not-allowed" : "pointer",
                      transition: "all 0.15s",
                      boxShadow: active ? "0 0 0 3px rgba(34,197,94,0.12)" : "none",
                      opacity: evBlocked ? 0.35 : 1,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 700, color: active ? "var(--wc-green)" : "var(--wc-text-1)" }}>{ev.bonus}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: active ? "var(--wc-text-1)" : "var(--wc-text-2)", marginTop: 2 }}>{ev.label}</div>
                    <div style={{ fontSize: 10, color: "var(--wc-text-3)", marginTop: 2 }}>{ev.desc}</div>
                    {evBlocked && <div style={{ fontSize: 9, color: "var(--wc-red)", marginTop: 3, fontWeight: 700 }}>Need 3+ goals</div>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Save */}
      <button onClick={save} disabled={aGoals === "" || bGoals === "" || !editable || submitting} style={{ width: "100%", height: 52, borderRadius: 12, border: "none", cursor: (!editable || aGoals === "" || bGoals === "") ? "not-allowed" : "pointer", background: saved ? "rgba(34,197,94,0.15)" : (!editable || aGoals === "" || bGoals === "") ? "var(--wc-surface-alt)" : "var(--wc-green)", color: saved ? "var(--wc-green)" : (!editable || aGoals === "" || bGoals === "") ? "var(--wc-text-3)" : "#000", fontSize: 15, fontWeight: 800, letterSpacing: "-0.01em", transition: "all 0.2s" }}>
        {!editable ? "Predictions locked" : saved ? "✓ Saved!" : submitting ? "Saving…" : existing ? "Update Prediction" : "Save Prediction"}
      </button>
    </div>
  );
}
