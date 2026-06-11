"use client";

import { useState, useMemo } from "react";
import { Trophy } from "lucide-react";
import { MatchCard } from "@/components/MatchCard";

export interface MatchWithTeams {
  id: number;
  kickoff_time: string;
  status: string;
  stage: string;
  matchday: number | null;
  team_a_score: number | null;
  team_b_score: number | null;
  team_a_id: number;
  team_b_id: number;
  teamA: { id: number; name: string; flag_url: string | null; iso_code?: string | null; short?: string | null };
  teamB: { id: number; name: string; flag_url: string | null; iso_code?: string | null; short?: string | null };
}

interface Section { key: string; label: string; sub: string; matches: MatchWithTeams[]; isActive: boolean; isDone: boolean }

const KO_ORDER  = ["round_of_32","round_of_16","quarter_final","semi_final","final"];
const KO_LABELS: Record<string,string> = { round_of_32:"Round of 32", round_of_16:"Round of 16", quarter_final:"Quarter-finals", semi_final:"Semi-finals", final:"Final" };

function fmt(d: string) { return new Date(d+"T12:00:00Z").toLocaleDateString("en-GB",{day:"numeric",month:"short"}); }

function build(matches: MatchWithTeams[]): Section[] {
  const out: Section[] = [];
  for (const day of [1,2,3]) {
    const ms = matches.filter(m => m.stage==="group" && m.matchday===day);
    if (!ms.length) continue;
    const dates = [...new Set(ms.map(m=>m.kickoff_time.slice(0,10)))].sort();
    const sub = dates.length===1 ? fmt(dates[0]) : `${fmt(dates[0])} – ${fmt(dates[dates.length-1])}`;
    out.push({ key:`md_${day}`, label:`Matchday ${day}`, sub, matches:ms, isActive:ms.some(m=>m.status!=="finished"), isDone:ms.every(m=>m.status==="finished") });
  }
  for (const s of KO_ORDER) {
    const ms = matches.filter(m=>m.stage===s);
    if (!ms.length) continue;
    out.push({ key:s, label:KO_LABELS[s]??s, sub:"", matches:ms, isActive:ms.some(m=>m.status!=="finished"), isDone:ms.every(m=>m.status==="finished") });
  }
  return out;
}

type PredMap = Record<number, { homeGoals: number; awayGoals: number; wildcard?: string | null; points?: number | null }>;

export function MatchList({ matches, predictions = {} }: { matches: MatchWithTeams[]; predictions?: PredMap }) {
  const sections = useMemo(()=>build(matches),[matches]);
  const [collapsed, setCollapsed] = useState<Record<string,boolean>>({});
  const toggle = (k: string) => setCollapsed(p=>({...p,[k]:!p[k]}));

  const today = new Date().toISOString().slice(0,10);
  const liveOrToday = matches.filter(m => {
    if (m.status === "live" || m.status === "locked") return true;
    if (m.status !== "scheduled") return false;
    const utc = m.kickoff_time.includes('+') || m.kickoff_time.endsWith('Z') ? m.kickoff_time : m.kickoff_time + 'Z';
    return new Date(utc).toISOString().slice(0,10) === today;
  });
  const hasLive = matches.some(m=>m.status==="live");
  const activeIdx = sections.findIndex(s=>s.isActive);

  if (!matches.length) return (
    <div style={{ textAlign:"center", padding:"80px 16px", color:"var(--wc-text-3)" }}>
      <div style={{ marginBottom:16, display:"flex", justifyContent:"center" }}><Trophy size={48} color="var(--wc-text-3)" strokeWidth={1.25} /></div>
      <p style={{ fontSize:15 }}>No upcoming matches.</p>
    </div>
  );

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Today / Live strip */}
      {liveOrToday.length > 0 && (
        <div style={{ border:"1px solid rgba(34,197,94,0.25)", borderRadius:14, background:"rgba(34,197,94,0.04)", padding:"14px 16px", marginBottom:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
            {hasLive && <span className="pulse-dot" style={{ width:7, height:7, borderRadius:"50%", background:"var(--wc-green)", flexShrink:0 }} />}
            <span style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"var(--wc-green)" }}>
              {hasLive ? "Live Now" : "Today"}
            </span>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {liveOrToday.map(m=><MatchCard key={m.id} match={m} myPick={predictions[m.id] ?? null}/>)}
          </div>
        </div>
      )}

      {/* Sections */}
      {sections.map((s, si) => {
        const active = si===activeIdx;
        const isCollapsed = collapsed[s.key];
        const byDate = new Map<string,MatchWithTeams[]>();
        s.matches.forEach(m=>{ const k=m.kickoff_time.slice(0,10); if(!byDate.has(k)) byDate.set(k,[]); byDate.get(k)!.push(m); });
        const dates = [...byDate.keys()].sort();

        return (
          <div key={s.key}>
            <button onClick={()=>toggle(s.key)} className="section-divider" style={{ width:"100%", background:"none", border:"none", padding:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:12, margin:"44px 0 20px" }}>
                <div style={{ flex:1, height:1, background:"var(--wc-border)" }} />
                <div style={{ display:"flex", alignItems:"center", gap:7, flexShrink:0 }}>
                  {active && <span className="pulse-dot" style={{ width:6, height:6, borderRadius:"50%", background:"var(--wc-green)" }} />}
                  <span className="section-label" style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:s.isDone?"var(--wc-text-3)":active?"var(--wc-green)":"var(--wc-text-2)", transition:"color 0.15s" }}>
                    {s.label}
                  </span>
                  {s.sub && <span style={{ fontSize:11, color:"var(--wc-text-3)" }}>· {s.sub}</span>}
                </div>
                <div style={{ flex:1, height:1, background:"var(--wc-border)" }} />
              </div>
            </button>

            {isCollapsed ? (
              <div style={{ textAlign:"center", padding:"6px 0 4px", fontSize:12, color:"var(--wc-text-3)" }}>
                {s.matches.length} matches — click to expand
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                {dates.map(date=>(
                  <div key={date}>
                    {dates.length>1 && (
                      <div style={{ fontSize:11, color:"var(--wc-text-3)", margin:"14px 0 8px", fontWeight:600, letterSpacing:"0.05em", textTransform:"uppercase" }}>
                        {new Date(date+"T12:00:00").toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"})}
                      </div>
                    )}
                    <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
                      {byDate.get(date)!.map(m=><MatchCard key={m.id} match={m} myPick={predictions[m.id] ?? null}/>)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
