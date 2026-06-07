export type GoalBucket = 0 | 1 | 2 | 3 | 4;
export type MatchResult = "team_a_win" | "draw" | "team_b_win";
export type WildcardType = "confidence_pick" | "underdog_pick" | "chaos_card";
export type ChaosCardType = "common" | "medium" | "rare";

export interface PredictionInput {
  predictedResult: MatchResult;
  predictedTeamAGoals: GoalBucket;
  predictedTeamBGoals: GoalBucket;
  wildcardType?: WildcardType;
  chaosCardType?: ChaosCardType;
}

export interface MatchResult_ {
  teamAScore: number;
  teamBScore: number;
}

export interface ScoreBreakdown {
  resultPoints: number;
  teamAGoalPoints: number;
  teamBGoalPoints: number;
  perfectBonus: number;
  wildcardEffect: number;
  total: number;
}

function toGoalBucket(goals: number): GoalBucket {
  return Math.min(goals, 4) as GoalBucket;
}

function getActualResult(teamAScore: number, teamBScore: number): MatchResult {
  if (teamAScore > teamBScore) return "team_a_win";
  if (teamBScore > teamAScore) return "team_b_win";
  return "draw";
}

export function calculateBaseScore(
  prediction: PredictionInput,
  actual: MatchResult_
): Omit<ScoreBreakdown, "wildcardEffect" | "total"> {
  const actualResult = getActualResult(actual.teamAScore, actual.teamBScore);
  const actualTeamABucket = toGoalBucket(actual.teamAScore);
  const actualTeamBBucket = toGoalBucket(actual.teamBScore);

  const resultPoints = prediction.predictedResult === actualResult ? 3 : 0;
  const teamAGoalPoints =
    prediction.predictedTeamAGoals === actualTeamABucket ? 1 : 0;
  const teamBGoalPoints =
    prediction.predictedTeamBGoals === actualTeamBBucket ? 1 : 0;
  const perfectBonus =
    resultPoints > 0 && teamAGoalPoints > 0 && teamBGoalPoints > 0 ? 1 : 0;

  return { resultPoints, teamAGoalPoints, teamBGoalPoints, perfectBonus };
}

const CHAOS_BONUS: Record<ChaosCardType, number> = {
  common: 4,
  medium: 7,
  rare: 12,
};

export const WILDCARD_LIMITS: Record<WildcardType, number> = {
  confidence_pick: 2,
  underdog_pick: 3,
  chaos_card: 3,
};

export function calculateScore(
  prediction: PredictionInput,
  actual: MatchResult_,
  options: {
    chaosEventsOccurred?: ChaosCardType[];
    underdogOutcome?: MatchResult;
  } = {}
): ScoreBreakdown {
  const base = calculateBaseScore(prediction, actual);
  const baseTotal =
    base.resultPoints +
    base.teamAGoalPoints +
    base.teamBGoalPoints +
    base.perfectBonus;

  let wildcardEffect = 0;

  if (prediction.wildcardType === "confidence_pick") {
    const actualResult = getActualResult(actual.teamAScore, actual.teamBScore);
    // doubles score if result correct, -3 penalty if wrong
    wildcardEffect = prediction.predictedResult === actualResult ? baseTotal : -3;
  } else if (prediction.wildcardType === "underdog_pick") {
    const actualResult = getActualResult(actual.teamAScore, actual.teamBScore);
    if (options.underdogOutcome) {
      if (
        prediction.predictedResult === options.underdogOutcome &&
        actualResult === options.underdogOutcome
      ) {
        wildcardEffect = 8;
      } else if (prediction.predictedResult === options.underdogOutcome) {
        wildcardEffect = -3;
      }
    }
  } else if (prediction.wildcardType === "chaos_card") {
    if (prediction.chaosCardType === "rare") {
      // Hat-trick: only counts for the team the user predicted to score 3+ goals
      const events = options.chaosEventsOccurred as string[] | undefined;
      const homeHattrick = events?.includes("rare_a");
      const awayHattrick = events?.includes("rare_b");
      const predictedHomeHattrick = prediction.predictedTeamAGoals >= 3;
      const predictedAwayHattrick = prediction.predictedTeamBGoals >= 3;
      if ((predictedHomeHattrick && homeHattrick) || (predictedAwayHattrick && awayHattrick)) {
        wildcardEffect = CHAOS_BONUS["rare"];
      }
    } else if (prediction.chaosCardType && options.chaosEventsOccurred?.includes(prediction.chaosCardType)) {
      wildcardEffect = CHAOS_BONUS[prediction.chaosCardType];
    }
  }

  return {
    ...base,
    wildcardEffect,
    total: baseTotal + wildcardEffect,
  };
}

export const CAPTAIN_STAGE_BONUS: Record<string, number> = {
  round_of_32: 2,
  round_of_16: 3,
  quarter_final: 6,
  semi_final: 10,
  final: 15,
  wins_world_cup: 25,
};
