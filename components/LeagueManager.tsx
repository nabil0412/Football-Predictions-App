"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trophy } from "lucide-react";

interface League { id: number; name: string; invite_code: string }

export function LeagueManager({ myLeagues }: { myLeagues: League[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"mine"|"create"|"join">(myLeagues.length ? "mine" : "create");
  const [createName, setCreateName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [createdLeague, setCreatedLeague] = useState<League | null>(null);
  const [copied, setCopied] = useState(false);

  const tabStyle = (id: string): React.CSSProperties => ({
    flex: 1, height: 36, borderRadius: 8, border: "none", cursor: "pointer",
    background: tab === id ? "var(--wc-surface)" : "none",
    color: tab === id ? "var(--wc-text-1)" : "var(--wc-text-3)",
    fontSize: 13, fontWeight: 700, transition: "all 0.15s",
  });

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 14px", borderRadius: 10,
    background: "var(--wc-surface-alt)", border: "1px solid var(--wc-border)",
    color: "var(--wc-text-1)", fontSize: 14, outline: "none",
    fontFamily: "inherit", boxSizing: "border-box",
  };

  async function create() {
    if (!createName.trim()) return;
    setLoading(true);
    const res = await fetch("/api/leagues", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", name: createName.trim() }) });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { toast.error(data.error); return; }
    setCreatedLeague(data.league);
    router.refresh();
  }

  async function join() {
    if (!joinCode.trim()) return;
    setLoading(true);
    const res = await fetch("/api/leagues", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "join", inviteCode: joinCode.trim().toUpperCase() }) });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { toast.error(data.error); return; }
    toast.success(`Joined ${data.league.name}!`);
    setJoinCode("");
    setTab("mine");
    router.refresh();
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Code copied!");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ paddingBottom: 32 }}>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, background: "var(--wc-surface-alt)", borderRadius: 10, padding: 4, marginBottom: 20 }}>
        <button style={tabStyle("mine")} onClick={() => setTab("mine")}>My Leagues</button>
        <button style={tabStyle("create")} onClick={() => setTab("create")}>Create</button>
        <button style={tabStyle("join")} onClick={() => setTab("join")}>Join</button>
      </div>

      {tab === "mine" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {myLeagues.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 16px" }}>
              <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}><Trophy size={40} color="var(--wc-text-3)" strokeWidth={1.25} /></div>
              <p style={{ color: "var(--wc-text-2)", fontWeight: 600, fontSize: 15 }}>You&apos;re not in any leagues</p>
              <p style={{ color: "var(--wc-text-3)", fontSize: 13, marginTop: 4 }}>Create one or join with a code</p>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16 }}>
                <button onClick={() => setTab("create")} style={{ background: "var(--wc-green)", color: "#000", border: "none", borderRadius: 99, padding: "8px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Create</button>
                <button onClick={() => setTab("join")} style={{ background: "var(--wc-surface-alt)", color: "var(--wc-text-2)", border: "1px solid var(--wc-border)", borderRadius: 99, padding: "8px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Join</button>
              </div>
            </div>
          ) : myLeagues.map(league => (
            <button key={league.id} onClick={() => router.push(`/leagues/${league.id}`)} style={{
              display: "block", width: "100%", textAlign: "left",
              background: "var(--wc-surface)", border: "1px solid var(--wc-border)",
              borderRadius: 16, padding: 16, cursor: "pointer", transition: "border-color 0.15s",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--wc-text-1)", display: "flex", alignItems: "center", gap: 6 }}><Trophy size={14} strokeWidth={2} />{league.name}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "var(--wc-text-3)", fontFamily: "monospace", letterSpacing: "0.08em" }}>Code: {league.invite_code}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--wc-green)" }}>View →</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {tab === "create" && (
        <div style={{ background: "var(--wc-surface)", border: "1px solid var(--wc-border)", borderRadius: 16, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--wc-text-1)", marginBottom: 16 }}>Create a private league</div>
          {!createdLeague ? (
            <>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--wc-text-3)", display: "block", marginBottom: 6 }}>League name</label>
                <input value={createName} onChange={e => setCreateName(e.target.value)} onKeyDown={e => e.key === "Enter" && create()} placeholder="e.g. Office Predictions" style={inputStyle} />
              </div>
              <button onClick={create} disabled={loading || !createName.trim()} style={{ width: "100%", height: 48, borderRadius: 10, border: "none", background: createName.trim() ? "var(--wc-green)" : "var(--wc-surface-alt)", color: createName.trim() ? "#000" : "var(--wc-text-3)", fontSize: 14, fontWeight: 800, cursor: createName.trim() ? "pointer" : "not-allowed" }}>
                {loading ? "Creating…" : "Create League"}
              </button>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "var(--wc-text-1)", marginBottom: 4 }}>{createdLeague.name}</p>
              <p style={{ fontSize: 13, color: "var(--wc-text-2)", marginBottom: 16 }}>Share this code to invite friends</p>
              <button onClick={() => copyCode(createdLeague.invite_code)} style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "var(--wc-surface-alt)", border: "1px solid var(--wc-border)", borderRadius: 10, padding: "12px 20px", cursor: "pointer" }}>
                <span style={{ fontSize: 20, fontWeight: 900, letterSpacing: "0.15em", fontFamily: "monospace", color: "var(--wc-green)" }}>{createdLeague.invite_code}</span>
                <span style={{ fontSize: 12, color: copied ? "var(--wc-green)" : "var(--wc-text-3)", fontWeight: 600 }}>{copied ? "Copied!" : "Copy"}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {tab === "join" && (
        <div style={{ background: "var(--wc-surface)", border: "1px solid var(--wc-border)", borderRadius: 16, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--wc-text-1)", marginBottom: 16 }}>Join with invite code</div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--wc-text-3)", display: "block", marginBottom: 6 }}>Invite code</label>
            <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && join()} placeholder="e.g. OFFICE01" maxLength={8} style={{ ...inputStyle, fontSize: 16, fontWeight: 700, letterSpacing: "0.1em", fontFamily: "monospace" }} />
          </div>
          <button onClick={join} disabled={loading || joinCode.length < 6} style={{ width: "100%", height: 48, borderRadius: 10, border: "none", background: joinCode.length >= 6 ? "var(--wc-green)" : "var(--wc-surface-alt)", color: joinCode.length >= 6 ? "#000" : "var(--wc-text-3)", fontSize: 14, fontWeight: 800, cursor: joinCode.length >= 6 ? "pointer" : "not-allowed" }}>
            {loading ? "Joining…" : "Join League"}
          </button>
        </div>
      )}
    </div>
  );
}
