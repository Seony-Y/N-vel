import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { breakpoints, cases, clues, locations, playMessages, playSessions, suspects } from "@/db/schema";

/** 사건 전체 (진상 포함). 서버 안에서만 쓴다. 화면으로 보낼 때는 public.ts 를 거칠 것 */
export async function loadCase(caseId: string) {
  const [c] = await db.select().from(cases).where(eq(cases.id, caseId));
  if (!c) return null;
  const [locs, sus, cls] = await Promise.all([
    db.select().from(locations).where(eq(locations.caseId, caseId)).orderBy(asc(locations.sortOrder)),
    db.select().from(suspects).where(eq(suspects.caseId, caseId)).orderBy(asc(suspects.sortOrder)),
    db.select().from(clues).where(eq(clues.caseId, caseId)).orderBy(asc(clues.sortOrder)),
  ]);
  const bps = sus.length ? await db.select().from(breakpoints).where(inArray(breakpoints.suspectId, sus.map((s) => s.id))) : [];
  return { case: c, locations: locs, suspects: sus, clues: cls, breakpoints: bps };
}

export type FullCase = NonNullable<Awaited<ReturnType<typeof loadCase>>>;

/*
 * 플레이 중에는 행동마다 사건 전체(쿼리 4번)를 다시 읽지 않도록 서버 메모리에 잠깐 둔다.
 * 사건을 저장하면 cases.updated_at 이 바뀌므로, 그 값이 같을 때만 재사용한다 (수정 즉시 반영)
 */
const caseCache = new Map<string, { updatedAt: number; full: FullCase }>();
const CACHE_MAX = 50;

export async function loadCaseCached(caseId: string, updatedAt: Date) {
  const hit = caseCache.get(caseId);
  if (hit && hit.updatedAt === updatedAt.getTime()) return hit.full;
  const full = await loadCase(caseId);
  if (!full) return null;
  if (caseCache.size >= CACHE_MAX) caseCache.delete(caseCache.keys().next().value!);
  caseCache.set(caseId, { updatedAt: full.case.updatedAt.getTime(), full });
  return full;
}

/** 내 플레이 기록 + 사건의 공개 여부·수정 시각 (쿼리 1번) */
export async function loadSessionWithCase(sessionId: string, userId: string) {
  const [row] = await db
    .select({ session: playSessions, isPublic: cases.isPublic, hiddenAt: cases.hiddenAt, ownerId: cases.ownerId, updatedAt: cases.updatedAt })
    .from(playSessions)
    .innerJoin(cases, eq(cases.id, playSessions.caseId))
    .where(and(eq(playSessions.id, sessionId), eq(playSessions.userId, userId)));
  return row ?? null;
}

/** 내 플레이 기록만 불러온다 */
export async function loadSession(sessionId: string, userId: string) {
  const [s] = await db
    .select()
    .from(playSessions)
    .where(and(eq(playSessions.id, sessionId), eq(playSessions.userId, userId)));
  return s ?? null;
}

export async function loadThread(sessionId: string, thread: string) {
  return db
    .select()
    .from(playMessages)
    .where(and(eq(playMessages.sessionId, sessionId), eq(playMessages.thread, thread)))
    .orderBy(asc(playMessages.createdAt));
}

export async function loadAllMessages(sessionId: string) {
  return db.select().from(playMessages).where(eq(playMessages.sessionId, sessionId)).orderBy(asc(playMessages.createdAt));
}

/** 볼 수 있는 사건인지: 공개됐고 관리자가 숨기지 않았거나, 내가 만든 것 */
export function canPlay(c: { isPublic: boolean; hiddenAt: Date | null; ownerId: string | null }, userId: string | null) {
  return (c.isPublic && !c.hiddenAt) || (!!userId && c.ownerId === userId);
}
