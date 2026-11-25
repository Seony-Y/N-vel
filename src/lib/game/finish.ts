import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { playSessions } from "@/db/schema";
import type { Accusation, PlaySession } from "@/types/db";
import type { EndingKey } from "./endings";
import type { FullCase } from "./load";
import { buildReveal } from "./reveal";

/**
 * 수사를 끝낸다 (추리 제출·포기). 이미 끝났으면 false (status 조건으로 두 번 끝나는 것을 막는다).
 * 이 사건을 전에 끝낸 적이 있으면 진상을 본 뒤의 도전이므로 재도전으로 표시한다
 */
export async function finishSession(full: FullCase, session: PlaySession, result: { ending: EndingKey; score: number; matchRate?: number; accusation?: Accusation }) {
  const now = new Date();
  const [done] = await db
    .update(playSessions)
    .set({
      ...result,
      status: "finished",
      reveal: buildReveal(full, result.ending),
      isRetry: sql`exists (select 1 from play_sessions p where p.user_id = ${session.userId} and p.case_id = ${session.caseId} and p.status = 'finished' and p.id <> ${session.id})`,
      finishedAt: now,
      updatedAt: now,
    })
    .where(and(eq(playSessions.id, session.id), eq(playSessions.status, "playing")))
    .returning({ id: playSessions.id });
  return !!done;
}
