// Shared TypeScript types derived from the DB schema

export type MatchStatus = "scheduled" | "locked" | "live" | "finished";
export type MatchStage = "group" | "round_of_32" | "round_of_16" | "quarter_final" | "semi_final" | "final";
export type WildcardType = "confidence_pick" | "underdog_pick" | "chaos_card";
export type ChaosCardType = "common" | "medium" | "rare";
export type PredictedResult = "team_a_win" | "draw" | "team_b_win";

export interface Team {
  id: number;
  name: string;
  flag_url: string | null;
  group: string | null;
  eliminated: boolean;
  stage_reached: MatchStage | null;
  external_id: number | null;
}

export interface Match {
  id: number;
  team_a_id: number;
  team_b_id: number;
  kickoff_time: string;
  team_a_score: number | null;
  team_b_score: number | null;
  status: MatchStatus;
  stage: MatchStage;
  external_id: number | null;
}

export interface AppUser {
  id: number;
  email: string;
  name: string;
  supabase_id: string | null;
  captain_team_id: number | null;
  total_score: number;
  created_at: string;
}

export interface Prediction {
  id: number;
  user_id: number;
  match_id: number;
  predicted_result: PredictedResult;
  predicted_team_a_goals: number;
  predicted_team_b_goals: number;
  wildcard_type: WildcardType | null;
  chaos_card_type: ChaosCardType | null;
  points_earned: number | null;
  created_at: string;
  updated_at: string;
}

export interface League {
  id: number;
  name: string;
  invite_code: string;
  owner_id: number;
  created_at: string;
}

export interface LeagueMember {
  id: number;
  league_id: number;
  user_id: number;
  joined_at: string;
}

export interface WildcardUsage {
  id: number;
  user_id: number;
  match_id: number;
  usage_date: string;
  wildcard_type: WildcardType;
  points_effect: number | null;
  created_at: string;
}
