CREATE TABLE "case_favorites" (
	"user_id" text NOT NULL,
	"case_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "case_favorites_user_id_case_id_pk" PRIMARY KEY("user_id","case_id")
);
--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "guide" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "script" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "case_favorites" ADD CONSTRAINT "case_favorites_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_favorites" ADD CONSTRAINT "case_favorites_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;