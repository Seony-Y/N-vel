import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { cases } from "@/db/schema";
import type { PlaySession } from "@/types/db";
import { loadCaseCached, type FullCase } from "./load";

/*
 * 비회원 프롤로그. 진행 상황을 서버에 저장하지 않고, 브라우저가 들고 있다가 요청마다 보낸다.
 * 무료 대본 사건이라 조작해도 얻을 것이 없다. 정답과 못 찾은 단서는 회원과 똑같이 서버에만 있다
 */
export const GuestSave = z.object({
  locationId: z.string().max(60).nullable().default(null),
  foundClueIds: z.array(z.string().max(60)).max(60).default([]),
  actionsUsed: z.number().int().min(0).max(10_000).default(0),
  hintsUsed: z.number().int().min(0).max(20).default(0),
});
export type GuestSave = z.infer<typeof GuestSave>;

/** 비회원이 할 수 있는 사건: 공개된 공식 대본 사건 중 프롤로그 */
export async function loadGuestCase(): Promise<FullCase | null> {
  const [row] = await db
    .select({ id: cases.id, updatedAt: cases.updatedAt })
    .from(cases)
    .where(
      and(
        eq(cases.isPublic, true),
        isNull(cases.hiddenAt),
        eq(cases.isOfficial, true),
        sql`jsonb_array_length(${cases.guide}) > 0`,
        sql`jsonb_array_length(${cases.script}) > 0`,
      ),
    )
    .orderBy(asc(cases.createdAt))
    .limit(1);
  return row ? loadCaseCached(row.id, row.updatedAt) : null;
}

/** 브라우저가 보낸 진행 상황을 규칙 함수가 쓰는 모양으로. 사건에 없는 id 는 버린다 */
export function guestSession(full: FullCase, save: GuestSave): PlaySession {
  const clues = new Set(full.clues.map((c) => c.id));
  return {
    id: "guest",
    userId: "guest",
    caseId: full.case.id,
    model: null,
    mode: "easy",
    status: "playing",
    currentLocationId: full.locations.find((l) => l.id === save.locationId)?.id ?? full.locations[0]?.id ?? null,
    actionsUsed: save.actionsUsed,
    hintsUsed: save.hintsUsed,
    creditsUsed: 0,
    foundClueIds: [...new Set(save.foundClueIds)].filter((id) => clues.has(id)),
    brokenIds: [],
    notes: "",
    accusation: null,
    score: null,
    matchRate: null,
    ending: null,
    isRetry: false,
    reveal: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    finishedAt: null,
  };
}

export const GuestAccusation = z.object({
  culpritId: z.string().max(60),
  answers: z.array(z.number().int().min(-1)).max(10),
  evidenceIds: z.array(z.string().max(60)).max(3),
});

/** 제출한 추리가 이 사건에 맞는지. 문제가 있으면 안내 문구 */
export function accusationProblem(full: FullCase, session: PlaySession, a: z.infer<typeof GuestAccusation>): string | null {
  if (!full.suspects.some((s) => s.id === a.culpritId)) return "없는 용의자입니다";
  if (a.answers.length !== full.case.quiz.length) return "모든 질문에 답하세요";
  if (a.evidenceIds.some((e) => !session.foundClueIds.includes(e))) return "찾은 단서만 증거로 낼 수 있습니다";
  return null;
}
