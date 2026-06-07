import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";

interface BreakdownProps {
  teamAName: string;
  teamBName: string;
  predictedResult: string;
  predictedTeamAGoals: number;
  predictedTeamBGoals: number;
  actualTeamAScore: number;
  actualTeamBScore: number;
  wildcardType?: string | null;
  pointsEarned: number;
  breakdown: {
    resultPoints: number;
    teamAGoalPoints: number;
    teamBGoalPoints: number;
    perfectBonus: number;
    wildcardEffect: number;
  };
}

function resultLabel(result: string, teamAName: string, teamBName: string) {
  if (result === "team_a_win") return `${teamAName} win`;
  if (result === "team_b_win") return `${teamBName} win`;
  return "Draw";
}

function wildcardLabel(type: string) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ScoreBreakdown({
  teamAName,
  teamBName,
  predictedResult,
  predictedTeamAGoals,
  predictedTeamBGoals,
  actualTeamAScore,
  actualTeamBScore,
  wildcardType,
  pointsEarned,
  breakdown,
}: BreakdownProps) {
  const rows: { label: string; pts: number }[] = [
    { label: "Correct result", pts: breakdown.resultPoints },
    { label: `${teamAName} goals (predicted ${predictedTeamAGoals === 4 ? "4+" : predictedTeamAGoals}, actual ${actualTeamAScore})`, pts: breakdown.teamAGoalPoints },
    { label: `${teamBName} goals (predicted ${predictedTeamBGoals === 4 ? "4+" : predictedTeamBGoals}, actual ${actualTeamBScore})`, pts: breakdown.teamBGoalPoints },
    { label: "Perfect prediction bonus", pts: breakdown.perfectBonus },
  ];

  if (wildcardType) {
    rows.push({ label: `${wildcardLabel(wildcardType)} effect`, pts: breakdown.wildcardEffect });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Score breakdown</CardTitle>
        <p className="text-sm text-muted-foreground">
          Your prediction: {resultLabel(predictedResult, teamAName, teamBName)},{" "}
          {teamAName} {predictedTeamAGoals === 4 ? "4+" : predictedTeamAGoals} –{" "}
          {predictedTeamBGoals === 4 ? "4+" : predictedTeamBGoals} {teamBName}
        </p>
        <p className="text-sm text-muted-foreground">
          Result: {teamAName} {actualTeamAScore} – {actualTeamBScore} {teamBName}
        </p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.label}>
                <TableCell className="text-sm">{row.label}</TableCell>
                <TableCell
                  className={`text-right font-semibold ${
                    row.pts > 0
                      ? "text-green-600"
                      : row.pts < 0
                      ? "text-red-500"
                      : "text-muted-foreground"
                  }`}
                >
                  {row.pts > 0 ? `+${row.pts}` : row.pts}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Separator className="my-3" />
        <div className="flex justify-between font-bold text-base">
          <span>Total</span>
          <span className={pointsEarned >= 0 ? "text-green-600" : "text-red-500"}>
            {pointsEarned > 0 ? `+${pointsEarned}` : pointsEarned}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
