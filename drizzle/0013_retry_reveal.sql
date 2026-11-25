ALTER TABLE "play_sessions" ADD COLUMN "is_retry" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "play_sessions" ADD COLUMN "reveal" jsonb;--> statement-breakpoint
-- 옛 기록: 같은 사건을 먼저 끝낸 적이 있으면 재도전
UPDATE "play_sessions" s SET "is_retry" = true WHERE s."status" = 'finished' AND EXISTS (SELECT 1 FROM "play_sessions" p WHERE p."user_id" = s."user_id" AND p."case_id" = s."case_id" AND p."status" = 'finished' AND p."finished_at" < s."finished_at");
