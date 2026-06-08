"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter } from "next/navigation";

interface Team { id: number; name: string }
interface Match {
  id: number;
  kickoff_time: string;
  status: string;
  stage: string;
  team_a_score: number | null;
  team_b_score: number | null;
  team_a_id: number;
  team_b_id: number;
}

const CHAOS_OPTIONS = [
  { id: "common", label: "Red card" },
  { id: "medium", label: "VAR overturned goal" },
  { id: "rare_a", label: "Hat-trick (Home)" },
  { id: "rare_b", label: "Hat-trick (Away)" },
];

export function AdminPanel({ matches, teams }: { matches: Match[]; teams: Team[] }) {
  const router = useRouter();
  const [scoreMatchId, setScoreMatchId] = useState<string>("");
  const [teamAScore, setTeamAScore] = useState("");
  const [teamBScore, setTeamBScore] = useState("");
  const [chaosEvents, setChaosEvents] = useState<string[]>([]);
  const [calculating, setCalculating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [fetchingOdds, setFetchingOdds] = useState(false);

  const teamName = (id: number) => teams.find((t) => t.id === id)?.name ?? `Team ${id}`;

  async function syncMatches() {
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/sync-matches", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        const msg = `Synced ${data.synced}, skipped ${data.skipped ?? 0}`;
        const errs = data.errors?.length ? ` | Errors: ${data.errors[0]}` : "";
        toast.success(msg + errs, { duration: 8000 });
      } else {
        toast.error(data.error ?? "Sync failed");
      }
      router.refresh();
    } catch {
      toast.error("Network error — sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function enterScore() {
    if (!scoreMatchId || teamAScore === "" || teamBScore === "") return;
    const res = await fetch("/api/admin/enter-score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId: parseInt(scoreMatchId),
        teamAScore: parseInt(teamAScore),
        teamBScore: parseInt(teamBScore),
        chaosEvents,
      }),
    });
    const data = await res.json();
    res.ok ? toast.success("Score saved") : toast.error(data.error);
    router.refresh();
  }

  async function fetchOdds() {
    setFetchingOdds(true);
    const res = await fetch("/api/admin/fetch-odds", {
      method: "POST",
      headers: { "x-cron-secret": "" },
    });
    const data = await res.json();
    setFetchingOdds(false);
    res.ok ? toast.success(`Updated odds for ${data.updated} matches`) : toast.error(data.error ?? "Failed");
    router.refresh();
  }

  async function calculateScores(matchId: number) {
    setCalculating(true);
    const res = await fetch("/api/admin/calculate-scores", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cron-secret": "" },
      body: JSON.stringify({ matchId }),
    });
    const data = await res.json();
    setCalculating(false);
    res.ok
      ? toast.success(`Scored ${data.processed} predictions`)
      : toast.error(data.error);
  }

  return (
    <Tabs defaultValue="matches">
      <TabsList>
        <TabsTrigger value="matches">Matches</TabsTrigger>
        <TabsTrigger value="scores">Enter Scores</TabsTrigger>
        <TabsTrigger value="sync">Sync / Odds</TabsTrigger>
      </TabsList>

      <TabsContent value="matches" className="mt-4">
        <div className="space-y-3">
          {matches.map((m) => (
            <Card key={m.id}>
              <CardContent className="flex items-center justify-between py-3 px-5">
                <div className="text-sm">
                  <p className="font-medium">
                    {teamName(m.team_a_id)} vs {teamName(m.team_b_id)}
                  </p>
                  <p className="text-muted-foreground">
                    {new Date(m.kickoff_time).toLocaleString("en-GB")} ·{" "}
                    {m.stage.replace(/_/g, " ")}
                  </p>
                  {m.team_a_score != null && (
                    <p className="font-semibold">
                      {m.team_a_score} – {m.team_b_score}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{m.status}</Badge>
                  {m.status === "finished" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={calculating}
                      onClick={() => calculateScores(m.id)}
                    >
                      Score predictions
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="scores" className="mt-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Enter match result</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="mb-1 block">Match ID</Label>
              <Input value={scoreMatchId} onChange={(e) => setScoreMatchId(e.target.value)} placeholder="Match ID" type="number" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block">Home score</Label>
                <Input value={teamAScore} onChange={(e) => setTeamAScore(e.target.value)} type="number" min={0} />
              </div>
              <div>
                <Label className="mb-1 block">Away score</Label>
                <Input value={teamBScore} onChange={(e) => setTeamBScore(e.target.value)} type="number" min={0} />
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Chaos events that occurred</Label>
              <div className="flex gap-2 flex-wrap">
                {CHAOS_OPTIONS.map(opt => {
                  const active = chaosEvents.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setChaosEvents(prev => active ? prev.filter(x => x !== opt.id) : [...prev, opt.id])}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${active ? "bg-green-600 text-white border-green-600" : "bg-muted text-muted-foreground border-border"}`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <Button onClick={enterScore} className="w-full" disabled={!scoreMatchId || teamAScore === "" || teamBScore === ""}>
              Save result
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="sync" className="mt-4 space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Sync from football-data.org</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Fetches all fixtures, teams, and scores. Safe to run multiple times.
            </p>
            <Button onClick={syncMatches} disabled={syncing} className="w-full">
              {syncing ? "Syncing…" : "Sync matches"}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Fetch betting odds</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Fetches h2h odds from The Odds API and sets the underdog team for all scheduled matches. Requires <code className="text-xs">ODDS_API_KEY</code> env var.
            </p>
            <Button onClick={fetchOdds} disabled={fetchingOdds} variant="outline" className="w-full">
              {fetchingOdds ? "Fetching…" : "Fetch odds & set underdogs"}
            </Button>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
