CREATE TYPE "public"."chaos_card_type" AS ENUM('common', 'medium', 'rare');--> statement-breakpoint
CREATE TYPE "public"."match_stage" AS ENUM('group', 'round_of_32', 'round_of_16', 'quarter_final', 'semi_final', 'final');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('scheduled', 'locked', 'live', 'finished');--> statement-breakpoint
CREATE TYPE "public"."predicted_result" AS ENUM('team_a_win', 'draw', 'team_b_win');--> statement-breakpoint
CREATE TYPE "public"."wildcard_type" AS ENUM('confidence_pick', 'underdog_pick', 'chaos_card');--> statement-breakpoint
CREATE TABLE "league_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"league_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leagues" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"invite_code" varchar(8) NOT NULL,
	"owner_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "leagues_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_a_id" integer NOT NULL,
	"team_b_id" integer NOT NULL,
	"kickoff_time" timestamp NOT NULL,
	"team_a_score" integer,
	"team_b_score" integer,
	"status" "match_status" DEFAULT 'scheduled' NOT NULL,
	"stage" "match_stage" DEFAULT 'group' NOT NULL,
	"external_id" integer,
	CONSTRAINT "matches_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "predictions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"match_id" integer NOT NULL,
	"predicted_result" "predicted_result" NOT NULL,
	"predicted_team_a_goals" integer NOT NULL,
	"predicted_team_b_goals" integer NOT NULL,
	"wildcard_type" "wildcard_type",
	"chaos_card_type" "chaos_card_type",
	"points_earned" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"flag_url" text,
	"group" varchar(1),
	"eliminated" boolean DEFAULT false NOT NULL,
	"stage_reached" "match_stage",
	"external_id" integer,
	CONSTRAINT "teams_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(100) NOT NULL,
	"supabase_id" varchar(36),
	"captain_team_id" integer,
	"total_score" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_supabase_id_unique" UNIQUE("supabase_id")
);
--> statement-breakpoint
CREATE TABLE "wildcard_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"match_id" integer NOT NULL,
	"usage_date" text NOT NULL,
	"wildcard_type" "wildcard_type" NOT NULL,
	"points_effect" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "league_members" ADD CONSTRAINT "league_members_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_members" ADD CONSTRAINT "league_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leagues" ADD CONSTRAINT "leagues_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_team_a_id_teams_id_fk" FOREIGN KEY ("team_a_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_team_b_id_teams_id_fk" FOREIGN KEY ("team_b_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_captain_team_id_teams_id_fk" FOREIGN KEY ("captain_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wildcard_usage" ADD CONSTRAINT "wildcard_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wildcard_usage" ADD CONSTRAINT "wildcard_usage_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "league_members_league_idx" ON "league_members" USING btree ("league_id");--> statement-breakpoint
CREATE INDEX "matches_kickoff_idx" ON "matches" USING btree ("kickoff_time");--> statement-breakpoint
CREATE INDEX "predictions_user_match_idx" ON "predictions" USING btree ("user_id","match_id");--> statement-breakpoint
CREATE INDEX "predictions_match_idx" ON "predictions" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "wildcard_usage_user_date_idx" ON "wildcard_usage" USING btree ("user_id","usage_date");