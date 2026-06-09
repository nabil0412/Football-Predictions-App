"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Team { id: number; name: string; flag_url: string | null; group: string | null; iso_code?: string | null }

function FlagImg({ isoCode, flagUrl, name, size = 32 }: { isoCode?: string | null; flagUrl?: string | null; name: string; size?: number }) {
  const [err, setErr] = useState(false);
  const src = isoCode && !err ? `https://flagcdn.com/w80/${isoCode}.png` : (flagUrl ?? null);
  if (!src) return <div style={{ width: size * 1.4, height: size, borderRadius: 4, background: "var(--wc-surface-alt)", border: "1px solid var(--wc-border)" }} />;
  return <img src={src} alt={name} onError={() => setErr(true)} style={{ width: size * 1.4, height: size, borderRadius: 4, objectFit: "cover", boxShadow: "0 1px 4px rgba(0,0,0,0.4)" }} />;
}

export function CaptainPicker({ teams, currentCaptainId, locked, tournamentStarted = false }: { teams: Team[]; currentCaptainId: number | null; locked: boolean; tournamentStarted?: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<number | null>(currentCaptainId);
  const [confirmed, setConfirmed] = useState(!!currentCaptainId && locked);
  const [saving, setSaving] = useState(false);

  const groups = [...new Set(teams.map(t => t.group).filter(Boolean))].sort() as string[];

  const noChange = !!currentCaptainId && selected === currentCaptainId && !locked;

  async function confirm() {
    if (!selected || noChange || confirmed) return;
    setSaving(true);
    const res = await fetch("/api/captain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teamId: selected }) });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { toast.error(data.error); return; }
    if (tournamentStarted) setConfirmed(true);
    toast.success(tournamentStarted ? `${data.team.name} locked in as your captain!` : `${data.team.name} set as your captain — you can change it until the tournament starts`);
    router.refresh();
  }

  const confirmLabel = confirmed
    ? `✓ ${teams.find(t => t.id === currentCaptainId)?.name ?? ""} locked in`
    : noChange
      ? `${teams.find(t => t.id === selected)?.name ?? "This team"} is your captain — pick another to change`
      : selected
        ? currentCaptainId && selected !== currentCaptainId
          ? `Update to ${teams.find(t => t.id === selected)?.name ?? ""}`
          : `Confirm ${teams.find(t => t.id === selected)?.name ?? ""} as Captain`
        : "Select a team above";

  return (
    <div style={{ paddingBottom: 80 }}>
      {(groups.length > 0 ? groups : ["all"]).map(group => {
        const groupTeams = group === "all" ? teams : teams.filter(t => t.group === group);
        return (
          <div key={group} style={{ marginBottom: 20 }}>
            {group !== "all" && (
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--wc-text-3)", marginBottom: 10 }}>
                Group {group}
              </div>
            )}
            <div className="captain-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {groupTeams.map(team => {
                const isSelected = selected === team.id;
                const isMyCaptain = confirmed && currentCaptainId === team.id;
                return (
                  <button
                    key={team.id}
                    onClick={() => !confirmed && !locked && setSelected(isSelected ? null : team.id)}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                      padding: "14px 8px", borderRadius: 12,
                      background: isSelected ? "rgba(34,197,94,0.08)" : "var(--wc-surface)",
                      border: `${isSelected ? 2 : 1}px solid ${isSelected ? "var(--wc-green)" : "var(--wc-border)"}`,
                      cursor: confirmed || locked ? "not-allowed" : "pointer",
                      transition: "all 0.15s", position: "relative",
                      opacity: confirmed && !isMyCaptain ? 0.4 : locked && !isMyCaptain ? 0.5 : 1,
                    }}
                  >
                    {isMyCaptain && (
                      <span style={{ position: "absolute", top: -8, left: "50%", transform: "translateX(-50%)", background: "var(--wc-green)", color: "#000", fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 99, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                        Captain
                      </span>
                    )}
                    {isSelected && !isMyCaptain && (
                      <span style={{ position: "absolute", top: 4, right: 4, width: 16, height: 16, borderRadius: "50%", background: "var(--wc-green)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#000", fontWeight: 900 }}>✓</span>
                    )}
                    <FlagImg isoCode={team.iso_code} flagUrl={team.flag_url} name={team.name} size={32} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: isSelected ? "var(--wc-text-1)" : "var(--wc-text-2)", textAlign: "center", lineHeight: 1.2 }}>
                      {team.name.split(" ").slice(-1)[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <div style={{ position: "sticky", bottom: 68, zIndex: 10, padding: "8px 0", background: "linear-gradient(to top, var(--wc-bg) 60%, transparent)" }}>
        <button onClick={confirm} disabled={!selected || noChange || confirmed || locked || saving} style={{
          display: "block", width: "100%",
          height: 52, borderRadius: 12, border: "none",
          cursor: !selected || noChange || confirmed || locked ? "not-allowed" : "pointer",
          background: confirmed ? "rgba(34,197,94,0.1)" : noChange || !selected || locked ? "var(--wc-surface-alt)" : "var(--wc-green)",
          color: confirmed ? "var(--wc-green)" : noChange || !selected || locked ? "var(--wc-text-3)" : "#000",
          fontSize: 15, fontWeight: 800, transition: "all 0.2s",
        }}>
          {locked && !confirmed ? "Captain selection is closed" : saving ? "Saving…" : confirmLabel}
        </button>
      </div>
    </div>
  );
}
