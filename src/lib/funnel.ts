import { gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { funnelCounts } from "@/db/schema";

const kstDay = (at: number) => new Date(at + 9 * 3600_000).toISOString().slice(0, 10);

/** 단계 하나에 도달한 횟수를 센다. 집계 실패가 게임을 막지 않도록 예외를 삼킨다 */
export async function bump(step: string) {
  try {
    await db
      .insert(funnelCounts)
      .values({ day: kstDay(Date.now()), step, count: 1 })
      .onConflictDoUpdate({ target: [funnelCounts.day, funnelCounts.step], set: { count: sql`${funnelCounts.count} + 1` } });
  } catch (err) {
    console.error("[funnel] 집계 실패", err);
  }
}

/** 최근 며칠 동안의 단계별 횟수 */
export async function funnel(days: number): Promise<Map<string, number>> {
  const rows = await db
    .select({ step: funnelCounts.step, n: sql<number>`sum(${funnelCounts.count})` })
    .from(funnelCounts)
    .where(gte(funnelCounts.day, kstDay(Date.now() - days * 86400_000)))
    .groupBy(funnelCounts.step);
  return new Map(rows.map((r) => [r.step, Number(r.n)]));
}
