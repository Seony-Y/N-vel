CREATE TABLE "ai_quota" (
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"day" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ai_quota_user_id_kind_day_pk" PRIMARY KEY("user_id","kind","day")
);
--> statement-breakpoint
CREATE TABLE "bonus_claims" (
	"email_hash" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_quota" ADD CONSTRAINT "ai_quota_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;