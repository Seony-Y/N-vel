import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { cases, playSessions } from "@/db/schema";

const listCols = {
  id: cases.id,
  title: cases.title,
  tagline: cases.tagline,
  rating: cases.rating,
  warningTags: cases.warningTags,
  difficulty: cases.difficulty,
  estimatedMinutes: cases.estimatedMinutes,
  coverImage: cases.coverImage,
  isOfficial: cases.isOfficial,
};

export type CaseListItem = Awaited<ReturnType<typeof listPublicCases>>[number];

/** 공개 사건 목록. 공식 사건이 먼저 */
export async function listPublicCases() {
  return db.select(listCols).from(cases).where(eq(cases.isPublic, true)).orderBy(desc(cases.isOfficial), desc(cases.updatedAt)).limit(60);
}

/** 내가 만든 사건 (공개·비공개 모두) */
export async function listMyCases(userId: string) {
  return db
    .select({ ...listCols, isPublic: cases.isPublic, updatedAt: cases.updatedAt })
    .from(cases)
    .where(eq(cases.ownerId, userId))
    .orderBy(desc(cases.updatedAt));
}

export type Ending = "correct" | "partial" | "wrong" | "gaveup";

/** 사건 하나에 대한 내 진행 상황 */
export interface CaseProgress {
  caseId: string;
  ongoingId: string | null; // 진행 중인 수사 (이어서 수사하기)
  lastFinished: { id: string; ending: Ending | null; score: number | null; matchRate: number | null; finishedAt: Date | null } | null; // 결과 보기
  solved: boolean; // 한 번이라도 해결했는지
  attempts: number;
}

/** 내가 플레이한 사건들의 진행 상황. caseId → 요약 */
export async function myProgress(userId: string | null): Promise<Map<string, CaseProgress>> {
  const map = new Map<string, CaseProgress>();
  if (!userId) return map;
  const rows = await db
    .select({ id: playSessions.id, caseId: playSessions.caseId, status: playSessions.status, ending: playSessions.ending, score: playSessions.score, matchRate: playSessions.matchRate, finishedAt: playSessions.finishedAt })
    .from(playSessions)
    .where(eq(playSessions.userId, userId))
    .orderBy(desc(playSessions.updatedAt)); // 최근 것부터
  for (const r of rows) {
    const p = map.get(r.caseId) ?? { caseId: r.caseId, ongoingId: null, lastFinished: null, solved: false, attempts: 0 };
    p.attempts++;
    if (r.status === "playing") p.ongoingId ??= r.id;
    else p.lastFinished ??= { id: r.id, ending: r.ending, score: r.score, matchRate: r.matchRate, finishedAt: r.finishedAt };
    if (r.ending === "correct") p.solved = true;
    map.set(r.caseId, p);
  }
  return map;
}

/** 내가 플레이한 사건 목록 (진행 상황 + 사건 정보) */
export async function myPlayedCases(userId: string) {
  const progress = await myProgress(userId);
  if (!progress.size) return [];
  const list = await db.select(listCols).from(cases).where(inArray(cases.id, [...progress.keys()]));
  // 진행 순서(최근 플레이 순)를 유지
  const order = [...progress.keys()];
  return list.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)).map((c) => ({ ...c, progress: progress.get(c.id)! }));
}

/** 이 사건에서 내 플레이 기록 (최근 순) */
export async function mySessionsFor(userId: string, caseId: string) {
  return db
    .select({ id: playSessions.id, status: playSessions.status, score: playSessions.score, ending: playSessions.ending, updatedAt: playSessions.updatedAt })
    .from(playSessions)
    .where(and(eq(playSessions.userId, userId), eq(playSessions.caseId, caseId)))
    .orderBy(desc(playSessions.updatedAt))
    .limit(10);
}
