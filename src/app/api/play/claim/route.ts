import { and, eq } from "drizzle-orm";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { playSessions } from "@/db/schema";
import { getUserId } from "@/lib/auth";
import { bump } from "@/lib/funnel";
import { accusationProblem, GuestAccusation, GuestSave, guestSession, loadGuestCase } from "@/lib/game/guest";
import { buildReveal } from "@/lib/game/reveal";
import { grade } from "@/lib/game/rules";

const Body = z.object({ caseId: z.string(), save: GuestSave, accusation: GuestAccusation });

/**
 * POST /api/play/claim  { caseId, save, accusation }  비회원으로 끝낸 프롤로그를 로그인한 계정의 기록으로 옮긴다 (점수는 서버가 다시 매긴다).
 * 이 사건의 기록이 이미 있으면 아무것도 하지 않는다
 */
export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "로그인이 필요합니다" }, { status: 401 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "잘못된 요청" }, { status: 400 });
  const full = await loadGuestCase();
  if (!full || full.case.id !== parsed.data.caseId) return Response.json({ error: "옮길 수 없는 기록이에요" }, { status: 404 });

  const [existing] = await db
    .select({ id: playSessions.id })
    .from(playSessions)
    .where(and(eq(playSessions.userId, userId), eq(playSessions.caseId, full.case.id)))
    .limit(1);
  if (existing) return new Response(null, { status: 204 });

  const s = guestSession(full, parsed.data.save);
  const { accusation } = parsed.data;
  const problem = accusationProblem(full, s, accusation);
  if (problem) return Response.json({ error: problem }, { status: 400 });
  const a = { ...accusation, narrative: "" };
  const g = grade(full, s, a);
  const now = new Date();
  await db.insert(playSessions).values({
    userId,
    caseId: full.case.id,
    status: "finished",
    currentLocationId: s.currentLocationId,
    actionsUsed: s.actionsUsed,
    hintsUsed: s.hintsUsed,
    foundClueIds: s.foundClueIds,
    accusation: { ...a, graded: g },
    score: g.score,
    matchRate: g.matchRate,
    ending: g.ending,
    reveal: buildReveal(full, g.ending),
    finishedAt: now,
  });
  after(() => bump("claim"));
  return new Response(null, { status: 201 });
}
