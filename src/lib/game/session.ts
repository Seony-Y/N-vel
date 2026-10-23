import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { playMessages, playSessions } from "@/db/schema";
import { getUserId } from "@/lib/auth";
import { canPlay, loadCaseCached, loadSessionWithCase, type FullCase } from "./load";
import type { PlaySession } from "@/types/db";

/** 플레이 API 공통: 로그인 + 내 세션 + 사건을 불러온다. 실패하면 Response 를 돌려준다 */
export async function openSession(
  sessionId: string,
  opts: { requirePlaying?: boolean } = {},
): Promise<{ userId: string; session: PlaySession; full: FullCase } | Response> {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const row = await loadSessionWithCase(sessionId, userId).catch(() => null);
  if (!row) return Response.json({ error: "플레이 기록이 없습니다" }, { status: 404 });
  const { session } = row;
  if (opts.requirePlaying && session.status !== "playing") {
    return Response.json({ error: "이미 끝난 사건입니다" }, { status: 409 });
  }
  // 공개 여부는 캐시가 아니라 방금 읽은 값으로 판단한다
  if (!canPlay(row, userId)) return Response.json({ error: "더 이상 플레이할 수 없는 사건입니다" }, { status: 403 });

  const full = await loadCaseCached(session.caseId, row.updatedAt);
  if (!full) return Response.json({ error: "더 이상 플레이할 수 없는 사건입니다" }, { status: 403 });

  return { userId, session, full };
}

/** 찾은 단서·무너진 지점을 배열에 중복 없이 추가 (동시 요청에도 안전하게 DB 에서 합친다) */
export async function addProgress(sessionId: string, add: { clueIds?: string[]; brokenIds?: string[]; actions?: number; credits?: number; locationId?: string }) {
  const clueIds = add.clueIds ?? [];
  const brokenIds = add.brokenIds ?? [];
  // 순서(찾은 순서)를 지키면서 중복 제거
  // 배열은 Postgres 배열 문자열('{a,b}')로 넘긴다 (JS 배열을 그대로 넘기면 값 하나로 풀려버림)
  const merge = (col: typeof playSessions.foundClueIds | typeof playSessions.brokenIds, ids: string[]) =>
    sql`array(select x from unnest(${col} || ${`{${ids.join(",")}}`}::uuid[]) with ordinality as t(x, n) group by x order by min(n))`;
  const [row] = await db
    .update(playSessions)
    .set({
      foundClueIds: clueIds.length ? merge(playSessions.foundClueIds, clueIds) : undefined,
      brokenIds: brokenIds.length ? merge(playSessions.brokenIds, brokenIds) : undefined,
      actionsUsed: add.actions ? sql`${playSessions.actionsUsed} + ${add.actions}` : undefined,
      creditsUsed: add.credits ? sql`${playSessions.creditsUsed} + ${add.credits}` : undefined,
      currentLocationId: add.locationId,
      updatedAt: new Date(),
    })
    .where(eq(playSessions.id, sessionId))
    .returning();
  return row;
}

export async function addMessages(sessionId: string, thread: string, items: { role: "user" | "assistant" | "event"; content: string }[]) {
  if (!items.length) return;
  // 같은 요청 안에서 순서가 뒤바뀌지 않도록 1ms 씩 차이를 둔다
  const base = Date.now();
  await db.insert(playMessages).values(items.map((m, i) => ({ sessionId, thread, ...m, createdAt: new Date(base + i) })));
}
