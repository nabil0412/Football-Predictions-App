import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  varchar,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";

export const matchStatusEnum = pgEnum("match_status", [
  "scheduled",
  "locked",
  "live",
  "finished",
]);

export const matchStageEnum = pgEnum("match_stage", [
  "group",
  "round_of_32",
  "round_of_16",
  "quarter_final",
  "semi_final",
  "final",
]);

export const wildcardTypeEnum = pgEnum("wildcard_type", [
  "confidence_pick",
  "underdog_pick",
  "chaos_card",
]);

export const chaosCardTypeEnum = pgEnum("chaos_card_type", [
  "common",   // +1: both teams score, 4+ goals
  "medium",   // +2: penalty, red card, goal after 85'
  "rare",     // +3: own goal, penalty missed/saved, match to penalties
]);

export const predictedResultEnum = pgEnum("predicted_result", [
  "team_a_win",
  "draw",
  "team_b_win",
]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  supabaseId: varchar("supabase_id", { length: 36 }).unique(),
  captainTeamId: integer("captain_team_id").references(() => teams.id),
  totalScore: integer("total_score").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  flagUrl: text("flag_url"),
  group: varchar("group", { length: 1 }),
  eliminated: boolean("eliminated").notNull().default(false),
  stageReached: matchStageEnum("stage_reached"),
  externalId: integer("external_id").unique(),
});

export const matches = pgTable(
  "matches",
  {
    id: serial("id").primaryKey(),
    teamAId: integer("team_a_id")
      .notNull()
      .references(() => teams.id),
    teamBId: integer("team_b_id")
      .notNull()
      .references(() => teams.id),
    kickoffTime: timestamp("kickoff_time").notNull(),
    teamAScore: integer("team_a_score"),
    teamBScore: integer("team_b_score"),
    status: matchStatusEnum("status").notNull().default("scheduled"),
    stage: matchStageEnum("stage").notNull().default("group"),
    externalId: integer("external_id").unique(),
    // underdog determined by betting odds (team_a or team_b)
    underdogTeamId: integer("underdog_team_id").references(() => teams.id),
    // chaos events that actually occurred e.g. ["common","rare"]
    chaosEventsOccurred: text("chaos_events_occurred").array(),
  },
  (t) => [index("matches_kickoff_idx").on(t.kickoffTime)]
);

export const predictions = pgTable(
  "predictions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id),
    predictedResult: predictedResultEnum("predicted_result").notNull(),
    predictedTeamAGoals: integer("predicted_team_a_goals").notNull(),
    predictedTeamBGoals: integer("predicted_team_b_goals").notNull(),
    wildcardType: wildcardTypeEnum("wildcard_type"),
    chaosCardType: chaosCardTypeEnum("chaos_card_type"),
    pointsEarned: integer("points_earned"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("predictions_user_match_idx").on(t.userId, t.matchId),
    index("predictions_match_idx").on(t.matchId),
  ]
);

export const leagues = pgTable("leagues", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  inviteCode: varchar("invite_code", { length: 8 }).notNull().unique(),
  ownerId: integer("owner_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const leagueMembers = pgTable(
  "league_members",
  {
    id: serial("id").primaryKey(),
    leagueId: integer("league_id")
      .notNull()
      .references(() => leagues.id),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
  },
  (t) => [index("league_members_league_idx").on(t.leagueId)]
);

export const wildcardUsage = pgTable(
  "wildcard_usage",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id),
    usageDate: text("usage_date").notNull(), // YYYY-MM-DD, for daily limit check
    wildcardType: wildcardTypeEnum("wildcard_type").notNull(),
    pointsEffect: integer("points_effect"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("wildcard_usage_user_date_idx").on(t.userId, t.usageDate)]
);
