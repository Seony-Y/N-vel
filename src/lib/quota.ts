import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiQuota, usageLogs, user } from "@/db/schema";

/*
 * AI 비용 한도. 크레딧과 별개로, 한 계정이 하루에 쓸 수 있는 AI 비용을 막아 둔다.
 * 횟수는 AI 를 부르기 '전에' 차지한다 (기록이 남기 전에 동시에 여러 번 부르는 것을 막기 위해)
 */

/** AI 검수: 하루 무료 횟수, 그 뒤 1회 크레딧, 유료를 포함한 하루 최대 횟수 */
export const FREE_REVIEWS_PER_DAY = 3;
export const REVIEW_CREDITS = 200;
export const MAX_REVIEWS_PER_DAY = 10;
/** 서술 채점: 하루 최대 횟수 (크레딧을 받지 않으므로) */
export const MAX_GRADES_PER_DAY = 10;
/** 한 계정이 24시간 동안 쓸 수 있는 AI 원가 (백만분의 1달러). 관리자는 제외 */
const DAILY_COST_LIMIT_MICROS = 3_000_000;

type Kind = (typeof aiQuota.kind.enumValues)[number];

/** 한국 날짜 (YYYY-MM-DD). 자정에 횟수가 다시 채워진다 */
const today = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

/** 오늘 횟수를 하나 차지한다. 한도가 찼으면 null */
export async function takeQuota(userId: string, kind: Kind, limit: number): Promise<{ count: number; release: () => Promise<void> } | null> {
  const day = today();
  const [row] = await db
    .insert(aiQuota)
    .values({ userId, kind, day, count: 1 })
    .onConflictDoUpdate({ target: [aiQuota.userId, aiQuota.kind, aiQuota.day], set: { count: sql`${aiQuota.count} + 1` }, setWhere: sql`${aiQuota.count} < ${limit}` })
    .returning({ count: aiQuota.count });
  if (!row) return null;
  return {
    count: row.count,
    release: async () => {
      await db
        .update(aiQuota)
        .set({ count: sql`greatest(${aiQuota.count} - 1, 0)` })
        .where(and(eq(aiQuota.userId, userId), eq(aiQuota.kind, kind), eq(aiQuota.day, day)));
    },
  };
}

/** 24시간 AI 원가 한도를 넘었는지 (관리자는 항상 false) */
export async function overDailyCost(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ micros: sql<number>`coalesce(sum(${usageLogs.costMicros}), 0)` })
    .from(usageLogs)
    .innerJoin(user, eq(user.id, usageLogs.userId))
    .where(and(eq(usageLogs.userId, userId), gte(usageLogs.createdAt, new Date(Date.now() - 86400_000)), sql`${user.role} <> 'admin'`));
  return Number(row?.micros ?? 0) >= DAILY_COST_LIMIT_MICROS;
}
