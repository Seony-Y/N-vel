import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { apiTopups, cases, eventLogs, playMessages, playSessions, usageLogs, user } from "@/db/schema";

/*
 * 관리자 화면용 집계. 모두 DB 로그(play_sessions, usage_logs, event_logs) 기준.
 * 크레딧 = 사용자에게 차감한 값 (play_sessions.credits_used)
 * 원가   = 실제 API 비용 (usage_logs.cost_micros, 백만분의 1달러). AI 검수 비용도 포함
 * 성공   = 엔딩이 '해결'(correct) 인 플레이
 * 제출   = 추리를 낸 플레이 (해결·부분·미제). 포기(gaveup)는 따로 센다
 */

const since = (days: number) => new Date(Date.now() - days * 86400_000);
const int = (v: unknown) => Number(v ?? 0);

export async function overview(days: number) {
  const from = since(days);
  const [[s], [u], [cost], events, users] = await Promise.all([
    db
      .select({
        started: sql<number>`count(*)`,
        finished: sql<number>`count(*) filter (where ${playSessions.ending} in ('correct', 'partial', 'wrong'))`,
        solved: sql<number>`count(*) filter (where ${playSessions.ending} = 'correct')`,
        gaveUp: sql<number>`count(*) filter (where ${playSessions.ending} = 'gaveup')`,
        credits: sql<number>`coalesce(sum(${playSessions.creditsUsed}), 0)`,
        actions: sql<number>`coalesce(sum(${playSessions.actionsUsed}), 0)`,
      })
      .from(playSessions)
      .where(gte(playSessions.createdAt, from)),
    db.select({ n: sql<number>`count(*)` }).from(user),
    db
      .select({ micros: sql<number>`coalesce(sum(${usageLogs.costMicros}), 0)`, calls: sql<number>`count(*)` })
      .from(usageLogs)
      .where(gte(usageLogs.createdAt, from)),
    db
      .select({ type: eventLogs.type, n: sql<number>`count(*)` })
      .from(eventLogs)
      .where(gte(eventLogs.createdAt, from))
      .groupBy(eventLogs.type),
    db.select({ n: sql<number>`count(distinct ${playSessions.userId})` }).from(playSessions).where(gte(playSessions.createdAt, from)),
  ]);
  return {
    users: int(u.n),
    activeUsers: int(users[0]?.n),
    started: int(s.started),
    finished: int(s.finished),
    solved: int(s.solved),
    gaveUp: int(s.gaveUp),
    credits: int(s.credits),
    actions: int(s.actions),
    costMicros: int(cost.micros),
    apiCalls: int(cost.calls),
    events: Object.fromEntries(events.map((e) => [e.type, int(e.n)])) as Partial<Record<"error" | "refusal" | "rejected_clue" | "truncated", number>>,
  };
}

/** 사용자별 집계 (기간 내 활동) */
export async function perUser(days: number) {
  const from = since(days);
  const sessions = db
    .select({
      userId: playSessions.userId,
      started: sql<number>`count(*)`.as("started"),
      finished: sql<number>`count(*) filter (where ${playSessions.ending} in ('correct', 'partial', 'wrong'))`.as("finished"),
      solved: sql<number>`count(*) filter (where ${playSessions.ending} = 'correct')`.as("solved"),
      credits: sql<number>`coalesce(sum(${playSessions.creditsUsed}), 0)`.as("credits_spent"),
    })
    .from(playSessions)
    .where(gte(playSessions.createdAt, from))
    .groupBy(playSessions.userId)
    .as("s");
  const costs = db
    .select({ userId: usageLogs.userId, micros: sql<number>`coalesce(sum(${usageLogs.costMicros}), 0)`.as("micros") })
    .from(usageLogs)
    .where(gte(usageLogs.createdAt, from))
    .groupBy(usageLogs.userId)
    .as("c");
  const errs = db
    .select({
      userId: eventLogs.userId,
      errors: sql<number>`count(*) filter (where ${eventLogs.type} = 'error')`.as("errors"),
      issues: sql<number>`count(*) filter (where ${eventLogs.type} <> 'error')`.as("issues"),
    })
    .from(eventLogs)
    .where(gte(eventLogs.createdAt, from))
    .groupBy(eventLogs.userId)
    .as("e");

  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      balance: user.credits,
      createdAt: user.createdAt,
      started: sessions.started,
      finished: sessions.finished,
      solved: sessions.solved,
      credits: sessions.credits,
      micros: costs.micros,
      errors: errs.errors,
      issues: errs.issues,
    })
    .from(user)
    .leftJoin(sessions, eq(sessions.userId, user.id))
    .leftJoin(costs, eq(costs.userId, user.id))
    .leftJoin(errs, eq(errs.userId, user.id))
    .orderBy(desc(sql`coalesce(${costs.micros}, 0)`), desc(user.createdAt))
    .limit(200);

  return rows.map((r) => ({ ...r, started: int(r.started), finished: int(r.finished), solved: int(r.solved), credits: int(r.credits), micros: int(r.micros), errors: int(r.errors), issues: int(r.issues) }));
}

/** 사건별 집계 */
export async function perCase(days: number) {
  const from = since(days);
  const costBySession = db
    .select({ sessionId: usageLogs.sessionId, micros: sql<number>`sum(${usageLogs.costMicros})`.as("micros") })
    .from(usageLogs)
    .groupBy(usageLogs.sessionId)
    .as("cs");
  const rows = await db
    .select({
      id: cases.id,
      title: cases.title,
      isOfficial: cases.isOfficial,
      started: sql<number>`count(${playSessions.id})`,
      finished: sql<number>`count(*) filter (where ${playSessions.ending} in ('correct', 'partial', 'wrong'))`,
      solved: sql<number>`count(*) filter (where ${playSessions.ending} = 'correct')`,
      gaveUp: sql<number>`count(*) filter (where ${playSessions.ending} = 'gaveup')`,
      avgScore: sql<number>`round(avg(${playSessions.score}) filter (where ${playSessions.ending} <> 'gaveup'))`,
      avgMatch: sql<number>`round(avg(${playSessions.matchRate}))`,
      avgActions: sql<number>`round(avg(${playSessions.actionsUsed}) filter (where ${playSessions.ending} in ('correct', 'partial', 'wrong')))`,
      credits: sql<number>`coalesce(sum(${playSessions.creditsUsed}), 0)`,
      micros: sql<number>`coalesce(sum(${costBySession.micros}), 0)`,
    })
    .from(cases)
    .innerJoin(playSessions, and(eq(playSessions.caseId, cases.id), gte(playSessions.createdAt, from)))
    .leftJoin(costBySession, eq(costBySession.sessionId, playSessions.id))
    .groupBy(cases.id)
    .orderBy(desc(sql`count(${playSessions.id})`));
  return rows.map((r) => ({ ...r, started: int(r.started), finished: int(r.finished), solved: int(r.solved), gaveUp: int(r.gaveUp), credits: int(r.credits), micros: int(r.micros) }));
}

/** 공개 사건 관리: 공개 중이거나 관리자가 숨긴 사건 (숨긴 것 먼저, 그다음 최근 수정 순) */
export async function moderationCases() {
  return db
    .select({ id: cases.id, title: cases.title, isOfficial: cases.isOfficial, isPublic: cases.isPublic, hiddenAt: cases.hiddenAt, hiddenReason: cases.hiddenReason, updatedAt: cases.updatedAt, owner: user.name, ownerId: cases.ownerId })
    .from(cases)
    .leftJoin(user, eq(user.id, cases.ownerId))
    .where(sql`${cases.isPublic} or ${cases.hiddenAt} is not null`)
    .orderBy(sql`${cases.hiddenAt} is null`, desc(cases.updatedAt))
    .limit(100);
}

export async function recentEvents(limit = 30, userId?: string) {
  return db
    .select({ id: eventLogs.id, type: eventLogs.type, where: eventLogs.where, message: eventLogs.message, sessionId: eventLogs.sessionId, userId: eventLogs.userId, email: user.email, caseTitle: cases.title, createdAt: eventLogs.createdAt })
    .from(eventLogs)
    .leftJoin(user, eq(user.id, eventLogs.userId))
    .leftJoin(cases, eq(cases.id, eventLogs.caseId))
    .where(userId ? eq(eventLogs.userId, userId) : undefined)
    .orderBy(desc(eventLogs.id))
    .limit(limit);
}

/** 한 사용자의 플레이 기록 */
export async function userSessions(userId: string) {
  const costBySession = db
    .select({ sessionId: usageLogs.sessionId, micros: sql<number>`sum(${usageLogs.costMicros})`.as("micros"), calls: sql<number>`count(*)`.as("calls") })
    .from(usageLogs)
    .groupBy(usageLogs.sessionId)
    .as("cs");
  const evBySession = db
    .select({ sessionId: eventLogs.sessionId, errors: sql<number>`count(*) filter (where ${eventLogs.type} = 'error')`.as("errors"), issues: sql<number>`count(*) filter (where ${eventLogs.type} <> 'error')`.as("issues") })
    .from(eventLogs)
    .groupBy(eventLogs.sessionId)
    .as("es");
  const [profile] = await db.select().from(user).where(eq(user.id, userId));
  const sessions = await db
    .select({
      id: playSessions.id,
      caseTitle: cases.title,
      caseId: cases.id,
      model: playSessions.model,
      status: playSessions.status,
      ending: playSessions.ending,
      score: playSessions.score,
      matchRate: playSessions.matchRate,
      actions: playSessions.actionsUsed,
      hints: playSessions.hintsUsed,
      credits: playSessions.creditsUsed,
      micros: costBySession.micros,
      calls: costBySession.calls,
      errors: evBySession.errors,
      issues: evBySession.issues,
      createdAt: playSessions.createdAt,
      updatedAt: playSessions.updatedAt,
    })
    .from(playSessions)
    .innerJoin(cases, eq(cases.id, playSessions.caseId))
    .leftJoin(costBySession, eq(costBySession.sessionId, playSessions.id))
    .leftJoin(evBySession, eq(evBySession.sessionId, playSessions.id))
    .where(eq(playSessions.userId, userId))
    .orderBy(desc(playSessions.updatedAt))
    .limit(200);
  const [reviews] = await db
    .select({ micros: sql<number>`coalesce(sum(${usageLogs.costMicros}), 0)`, n: sql<number>`count(*)` })
    .from(usageLogs)
    .where(and(eq(usageLogs.userId, userId), eq(usageLogs.kind, "review")));
  return {
    profile: profile ?? null,
    sessions: sessions.map((s) => ({ ...s, micros: int(s.micros), calls: int(s.calls), errors: int(s.errors), issues: int(s.issues) })),
    reviews: { micros: int(reviews.micros), n: int(reviews.n) },
  };
}

/** 한 플레이의 전체 기록 (대화, 사용량, 이벤트) */
export async function sessionDetail(sessionId: string) {
  const [s] = await db
    .select({ session: playSessions, email: user.email, name: user.name })
    .from(playSessions)
    .innerJoin(user, eq(user.id, playSessions.userId))
    .where(eq(playSessions.id, sessionId));
  if (!s) return null;
  const [messages, usage, events] = await Promise.all([
    db.select().from(playMessages).where(eq(playMessages.sessionId, sessionId)).orderBy(asc(playMessages.createdAt)),
    db.select().from(usageLogs).where(eq(usageLogs.sessionId, sessionId)).orderBy(asc(usageLogs.id)),
    db.select().from(eventLogs).where(eq(eventLogs.sessionId, sessionId)).orderBy(asc(eventLogs.id)),
  ]);
  return { ...s, messages, usage, events };
}

/**
 * API 예산: 기록한 충전액 합계에서 첫 충전 기록 이후의 API 원가를 뺀 남은 예상 금액.
 * 원가는 토큰 수 × 가격표(models.ts)로 계산한 추정치라 실제 청구액과 조금 다를 수 있다
 */
export async function apiBudget() {
  const topups = await db.select().from(apiTopups).orderBy(desc(apiTopups.chargedAt));
  if (!topups.length) return { topups, chargedMicros: 0, usedMicros: 0, remainingMicros: 0, from: null as Date | null, burnPerDay: 0 };
  const from = topups.at(-1)!.chargedAt;
  const weekAgo = since(7);
  const [used] = await db
    .select({
      micros: sql<number>`coalesce(sum(${usageLogs.costMicros}), 0)`,
      week: sql<number>`coalesce(sum(${usageLogs.costMicros}) filter (where ${usageLogs.createdAt} >= ${weekAgo.toISOString()}), 0)`,
    })
    .from(usageLogs)
    .where(gte(usageLogs.createdAt, from));
  const chargedMicros = topups.reduce((n, t) => n + t.amountMicros, 0);
  const usedMicros = int(used.micros);
  // 최근 7일 하루 평균 사용액 (첫 기록이 7일보다 최근이면 그 기간으로 나눈다)
  const days = Math.max(1, Math.min(7, (Date.now() - from.getTime()) / 86400_000));
  return { topups, chargedMicros, usedMicros, remainingMicros: chargedMicros - usedMicros, from, burnPerDay: Math.round(int(used.week) / days) };
}
