CREATE TABLE "api_topups" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "api_topups_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"amount_micros" bigint NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"admin_id" text,
	"charged_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_topups" ADD CONSTRAINT "api_topups_admin_id_user_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_topups_charged_idx" ON "api_topups" USING btree ("charged_at");