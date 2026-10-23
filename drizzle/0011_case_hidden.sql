ALTER TABLE "cases" ADD COLUMN "hidden_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "hidden_reason" text DEFAULT '' NOT NULL;