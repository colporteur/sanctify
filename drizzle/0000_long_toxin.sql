CREATE TABLE "awards" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"key" text NOT NULL,
	"earned_date" date NOT NULL,
	"meta" jsonb
);
--> statement-breakpoint
CREATE TABLE "cleaning_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"date" date NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"na" boolean DEFAULT false NOT NULL,
	"logged_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cleaning_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"area" text NOT NULL,
	"task" text NOT NULL,
	"schedule" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "day_scores" (
	"date" date PRIMARY KEY NOT NULL,
	"life_score" double precision,
	"domain_scores" jsonb NOT NULL,
	"profile_version" integer NOT NULL,
	"provisional" boolean DEFAULT false NOT NULL,
	"computed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domains" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"icon" text DEFAULT '' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"provider" text PRIMARY KEY NOT NULL,
	"tokens" jsonb NOT NULL,
	"status" text DEFAULT 'disconnected' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" text PRIMARY KEY NOT NULL,
	"domain_id" text NOT NULL,
	"name" text NOT NULL,
	"shape" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"schedule" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"date" date NOT NULL,
	"value" double precision,
	"detail" jsonb,
	"na" boolean DEFAULT false NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"logged_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meals" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"slot" text,
	"photo_key" text,
	"ai_rating" integer,
	"ai_description" text,
	"user_rating" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"date" date NOT NULL,
	"value" double precision NOT NULL,
	"meta" jsonb
);
--> statement-breakpoint
CREATE TABLE "scoring_profiles" (
	"version" serial PRIMARY KEY NOT NULL,
	"effective_date" date NOT NULL,
	"domain_weights" jsonb NOT NULL,
	"item_weights" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY DEFAULT 'todd' NOT NULL,
	"mode" text DEFAULT 'calibration' NOT NULL,
	"timezone" text DEFAULT 'America/Chicago' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cleaning_logs" ADD CONSTRAINT "cleaning_logs_task_id_cleaning_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."cleaning_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logs" ADD CONSTRAINT "logs_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cleaning_logs_task_date" ON "cleaning_logs" USING btree ("task_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "logs_item_date" ON "logs" USING btree ("item_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "metrics_kind_date" ON "metrics" USING btree ("kind","date");