export type GoalBucket = 0 | 1 | 2 | 3 | 4;
export type MatchResult = "team_a_win" | "draw" | "team_b_win";
export type WildcardType = "confidence_pick" | "underdog_pick" | "comeback_pick" | "chaos_card";
export type ChaosCardType = "common" | "medium" | "rare";

export interface PredictionInput {
  predictedResult: MatchResult;
  predictedTeamAGoals: GoalBucket;
  predictedTeamBGoals: GoalBucket;
  wildcardType?: WildcardType;
  chaosCardType?: ChaosCardType;
  predictedGoesToET?: boolean;
  predictedPenaltyWinner?: "team_a" | "team_b";
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
  etBonus: number;
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
): Omit<ScoreBreakdown, "wildcardEffect" | "total" | "etBonus"> {
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
  confidence_pick: 1,
  underdog_pick: 3,
  comeback_pick: 1,
  chaos_card: 3,
};

export function calculateScore(
  prediction: PredictionInput,
  actual: MatchResult_,
  options: {
    chaosEventsOccurred?: ChaosCardType[];
    underdogOutcome?: MatchResult;
    comebackOutcome?: MatchResult;
    wentToExtraTime?: boolean;
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
  } else if (prediction.wildcardType === "comeback_pick") {
    if (options.comebackOutcome) {
      const penWinner = prediction.predictedPenaltyWinner;
      const predictedWinner = prediction.predictedResult !== "draw"
        ? prediction.predictedResult
        : penWinner === "team_a" ? "team_a_win" : penWinner === "team_b" ? "team_b_win" : null;
      wildcardEffect = predictedWinner === options.comebackOutcome ? 5 : -2;
    } else {
      wildcardEffect = -2;
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

  const etBonus = prediction.predictedGoesToET && options.wentToExtraTime ? 1 : 0;

  return {
    ...base,
    wildcardEffect,
    etBonus,
    total: baseTotal + wildcardEffect + etBonus,
  };
}

export const CAPTAIN_STAGE_BONUS: Record<string, number> = {
  round_of_32: 1,
  round_of_16: 2,
  quarter_final: 2,
  semi_final: 2,
  final: 3,
  wins_world_cup: 5,
};
