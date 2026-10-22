CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "credit_ledger_signup_bonus_once" ON "credit_ledger" USING btree ("user_id") WHERE "credit_ledger"."reason" = 'signup_bonus';