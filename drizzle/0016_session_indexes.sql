CREATE INDEX "credit_ledger_session_idx" ON "credit_ledger" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "event_logs_session_idx" ON "event_logs" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "play_sessions_case_idx" ON "play_sessions" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "usage_logs_session_idx" ON "usage_logs" USING btree ("session_id");