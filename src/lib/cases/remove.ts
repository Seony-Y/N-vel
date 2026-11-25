import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { cases, playSessions } from "@/db/schema";

/**
 * 내 사건 지우기 (caseId 를 빼면 전부). db.batch 로 한 트랜잭션에서 실행할 쿼리를 돌려준다.
 * 다른 사람이 플레이한 사건은 주인 없는 비공개 사건으로 남긴다. 행을 지우면 그 사람들의 플레이 기록까지 함께 지워지기 때문이다.
 * 남긴 사건은 목록에 나오지 않고 새로 플레이할 수 없으며, 이미 끝낸 사람의 결과 화면에서만 쓰인다
 */
export function removeCaseQueries(ownerId: string, caseId?: string) {
  const mine = and(eq(cases.ownerId, ownerId), caseId ? eq(cases.id, caseId) : undefined);
  const playedByOthers = sql`exists (select 1 from ${playSessions} where ${playSessions.caseId} = ${cases.id} and ${playSessions.userId} <> ${ownerId})`;
  return [db.update(cases).set({ ownerId: null, isPublic: false }).where(and(mine, playedByOthers)), db.delete(cases).where(mine)] as const;
}
