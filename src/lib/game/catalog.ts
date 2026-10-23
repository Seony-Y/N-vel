import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { caseFavorites, cases, playSessions } from "@/db/schema";

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
  // 가이드·대본은 공식 사건에서만 쓴다
  hasGuide: sql<boolean>`${cases.isOfficial} and jsonb_array_length(${cases.guide}) > 0`,
  isFree: sql<boolean>`${cases.isOfficial} and jsonb_array_length(${cases.script}) > 0`, // 대본 사건: AI 를 쓰지 않아 무료
};

export type CaseListItem = Awaited<ReturnType<typeof listPublicCases>>[number];

export const CASE_SORTS = { recommended: "추천", latest: "최신순", easy: "쉬운 순", hard: "어려운 순" } as const;
export type CaseSort = keyof typeof CASE_SORTS;

/** 공개 사건 목록. 추천: 공식 사건 먼저 → 최신 */
export async function listPublicCases(sort: CaseSort = "recommended") {
  const order = {
    recommended: [desc(cases.isOfficial), desc(cases.updatedAt)],
    latest: [desc(cases.createdAt)],
    easy: [asc(cases.difficulty), desc(cases.createdAt)],
    hard: [desc(cases.difficulty), desc(cases.createdAt)],
  }[sort];
  return db.select(listCols).from(cases).where(eq(cases.isPublic, true)).orderBy(...order).limit(60);
}

/** 프롤로그: 가이드가 있는 공개 공식 사건 */
export async function findPrologue() {
  const [row] = await db
    .select(listCols)
    .from(cases)
    .where(and(eq(cases.isPublic, true), eq(cases.isOfficial, true), sql`jsonb_array_length(${cases.guide}) > 0`))
    .orderBy(asc(cases.createdAt))
    .limit(1);
  return row ?? null;
}

/** 내가 즐겨찾기한 사건 id */
export async function myFavoriteIds(userId: string | null): Promise<Set<string>> {
  if (!userId) return new Set();
  const rows = await db.select({ caseId: caseFavorites.caseId }).from(caseFavorites).where(eq(caseFavorites.userId, userId));
  return new Set(rows.map((r) => r.caseId));
}

/** 내가 즐겨찾기한 사건 (최근에 즐겨찾기한 순). 지금 볼 수 있는 것만: 공개됐거나 내가 만든 것 */
export async function myFavoriteCases(userId: string) {
  return db
    .select(listCols)
    .from(caseFavorites)
    .innerJoin(cases, eq(cases.id, caseFavorites.caseId))
    .where(and(eq(caseFavorites.userId, userId), sql`(${cases.isPublic} or ${cases.ownerId} = ${userId})`))
    .orderBy(desc(caseFavorites.createdAt));
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
  submitted: boolean; // 한 번이라도 추리를 제출해 끝냈는지 (포기 제외)
  attempts: number;
}

export function emptyProgress(caseId: string): CaseProgress {
  return { caseId, ongoingId: null, lastFinished: null, solved: false, submitted: false, attempts: 0 };
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
    const p = map.get(r.caseId) ?? emptyProgress(r.caseId);
    p.attempts++;
    if (r.status === "playing") p.ongoingId ??= r.id;
    else p.lastFinished ??= { id: r.id, ending: r.ending, score: r.score, matchRate: r.matchRate, finishedAt: r.finishedAt };
    if (r.ending === "correct") p.solved = true;
    if (r.ending && r.ending !== "gaveup") p.submitted = true;
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
