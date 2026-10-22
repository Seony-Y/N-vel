import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { playSessions } from "@/db/schema";
import { grade, MAX_EVIDENCE } from "@/lib/game/rules";
import { openSession } from "@/lib/game/session";

const Body = z.object({
  culpritId: z.uuid(),
  answers: z.array(z.number().int().min(-1)).max(10),
  evidenceIds: z.array(z.uuid()).max(MAX_EVIDENCE),
});

/** POST /api/play/:id/accuse  추리 제출 → 채점하고 사건을 끝낸다. 결과는 결과 페이지에서 본다 */
export async function POST(request: Request, ctx: RouteContext<"/api/play/[id]/accuse">) {
  const { id } = await ctx.params;
  const opened = await openSession(id, { requirePlaying: true });
  if (opened instanceof Response) return opened;
  const { full, session } = opened;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: `범인을 고르고, 증거는 ${MAX_EVIDENCE}개까지 고르세요` }, { status: 400 });
  const a = parsed.data;
  if (!full.suspects.some((s) => s.id === a.culpritId)) return Response.json({ error: "없는 용의자입니다" }, { status: 400 });
  if (a.answers.length !== full.case.quiz.length) return Response.json({ error: "모든 질문에 답하세요" }, { status: 400 });
  if (a.evidenceIds.some((e) => !session.foundClueIds.includes(e))) return Response.json({ error: "찾은 단서만 증거로 낼 수 있습니다" }, { status: 400 });

  const g = grade(full, session, a);
  // status 조건으로 두 번 제출되는 것을 막는다
  const [done] = await db
    .update(playSessions)
    .set({ status: "finished", accusation: a, score: g.score, matchRate: g.matchRate, ending: g.ending, finishedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(playSessions.id, id), eq(playSessions.status, "playing")))
    .returning({ id: playSessions.id });
  if (!done) return Response.json({ error: "이미 제출했습니다" }, { status: 409 });

  return Response.json({ sessionId: id });
}
