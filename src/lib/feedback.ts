import { and, asc, avg, count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { caseRatings, caseReports, cases, user } from "@/db/schema";
import type { Length, Level } from "./feedback-config";

/** 내가 남긴 평가 */
export async function myRating(userId: string, caseId: string) {
  const [row] = await db
    .select({ stars: caseRatings.stars, level: caseRatings.level, length: caseRatings.length, comment: caseRatings.comment })
    .from(caseRatings)
    .where(and(eq(caseRatings.userId, userId), eq(caseRatings.caseId, caseId)));
  return row ?? null;
}

export async function saveRating(userId: string, caseId: string, v: { stars: number; level: Level | null; length: Length | null; comment: string }) {
  await db
    .insert(caseRatings)
    .values({ userId, caseId, ...v })
    .onConflictDoUpdate({ target: [caseRatings.caseId, caseRatings.userId], set: { ...v, updatedAt: new Date() } });
}

/** 사건의 평가 모음 (만든 사람·관리자용). 누가 썼는지는 보여 주지 않는다 */
export async function ratingSummary(caseId: string) {
  const rows = await db
    .select({ stars: caseRatings.stars, level: caseRatings.level, length: caseRatings.length, comment: caseRatings.comment, updatedAt: caseRatings.updatedAt })
    .from(caseRatings)
    .where(eq(caseRatings.caseId, caseId))
    .orderBy(desc(caseRatings.updatedAt))
    .limit(200);
  const tally = <K extends string>(pick: (r: (typeof rows)[number]) => K | null) =>
    rows.reduce<Partial<Record<K, number>>>((m, r) => {
      const k = pick(r);
      if (k) m[k] = (m[k] ?? 0) + 1;
      return m;
    }, {});
  return {
    count: rows.length,
    stars: rows.length ? rows.reduce((n, r) => n + r.stars, 0) / rows.length : null,
    level: tally((r) => r.level),
    length: tally((r) => r.length),
    comments: rows.filter((r) => r.comment).map(({ comment, stars, updatedAt }) => ({ comment, stars, updatedAt })),
  };
}

/** 관리자: 사건별 평가 요약 */
export async function ratingsByCase() {
  const n = (col: typeof caseRatings.level | typeof caseRatings.length, v: string) => sql<number>`count(*) filter (where ${col} = ${v})`;
  const rows = await db
    .select({
      id: cases.id,
      title: cases.title,
      count: count(),
      stars: avg(caseRatings.stars),
      hard: n(caseRatings.level, "hard"),
      easy: n(caseRatings.level, "easy"),
      long: n(caseRatings.length, "long"),
      short: n(caseRatings.length, "short"),
    })
    .from(caseRatings)
    .innerJoin(cases, eq(cases.id, caseRatings.caseId))
    .groupBy(cases.id)
    .orderBy(desc(count()));
  return rows.map((r) => ({ ...r, stars: Number(r.stars ?? 0), hard: Number(r.hard), easy: Number(r.easy), long: Number(r.long), short: Number(r.short) }));
}

/** 신고하기. 처리 안 된 내 신고가 이미 있으면 false */
export async function createReport(v: { caseId: string; userId: string; reason: (typeof caseReports.reason.enumValues)[number]; message: string }) {
  const [row] = await db.insert(caseReports).values(v).onConflictDoNothing().returning({ id: caseReports.id });
  return !!row;
}

/** 관리자: 처리 안 된 신고 (오래된 것부터) */
export async function pendingReports() {
  return db
    .select({ id: caseReports.id, reason: caseReports.reason, message: caseReports.message, createdAt: caseReports.createdAt, caseId: cases.id, title: cases.title, hiddenAt: cases.hiddenAt, email: user.email, userId: user.id })
    .from(caseReports)
    .innerJoin(cases, eq(cases.id, caseReports.caseId))
    .innerJoin(user, eq(user.id, caseReports.userId))
    .where(eq(caseReports.status, "pending"))
    .orderBy(asc(caseReports.createdAt))
    .limit(100);
}

export async function resolveReport(id: number, adminId: string) {
  const [row] = await db
    .update(caseReports)
    .set({ status: "resolved", adminId, resolvedAt: new Date() })
    .where(and(eq(caseReports.id, id), eq(caseReports.status, "pending")))
    .returning({ id: caseReports.id });
  return !!row;
}
