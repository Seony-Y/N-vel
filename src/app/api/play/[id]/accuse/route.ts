import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { playSessions, usageLogs } from "@/db/schema";
import { logEvent } from "@/lib/ai/usage";
import { gradeNarrative } from "@/lib/game/narrative";
import { grade, MAX_EVIDENCE, MAX_NARRATIVE } from "@/lib/game/rules";
import { openSession } from "@/lib/game/session";

const Body = z.object({
  culpritId: z.uuid(),
  answers: z.array(z.number().int().min(-1)).max(10),
  evidenceIds: z.array(z.uuid()).max(MAX_EVIDENCE),
  narrative: z.string().trim().max(MAX_NARRATIVE).default(""), // 서술형 추리 (알리바이, 사건의 전말, 범행 방법 등)
});

/** 서술 채점(AI)을 기다리므로 넉넉히 */
export const maxDuration = 60;

/** 한 수사에서 서술 채점(AI)을 부를 수 있는 횟수. 채점 실패 뒤 다시 제출하는 경우까지 */
const MAX_GRADE_CALLS = 3;

/** POST /api/play/:id/accuse  추리 제출 → 채점하고 사건을 끝낸다. 결과는 결과 페이지에서 본다 */
export async function POST(request: Request, ctx: RouteContext<"/api/play/[id]/accuse">) {
  const { id } = await ctx.params;
  const opened = await openSession(id, { requirePlaying: true });
  if (opened instanceof Response) return opened;
  const { full, session } = opened;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: `범인을 고르고, 증거는 ${MAX_EVIDENCE}개까지, 서술은 ${MAX_NARRATIVE}자까지 써 주세요` }, { status: 400 });
  const { narrative, ...a } = parsed.data;
  if (!full.suspects.some((s) => s.id === a.culpritId)) return Response.json({ error: "없는 용의자입니다" }, { status: 400 });
  if (a.answers.length !== full.case.quiz.length) return Response.json({ error: "모든 질문에 답하세요" }, { status: 400 });
  if (a.evidenceIds.some((e) => !session.foundClueIds.includes(e))) return Response.json({ error: "찾은 단서만 증거로 낼 수 있습니다" }, { status: 400 });

  // 서술 채점은 제출할 때 한 번만. 실패하면 사건을 끝내지 않고 다시 제출하게 한다
  // 중복 제출·재시도로 AI 호출이 쌓이지 않도록, 같은 수사에서 채점이 몇 번 넘게 불렸으면 막는다
  if (narrative) {
    const [{ n }] = await db.select({ n: count() }).from(usageLogs).where(and(eq(usageLogs.sessionId, id), eq(usageLogs.kind, "grade")));
    if (n >= MAX_GRADE_CALLS) return Response.json({ error: "채점 요청이 너무 많아요. 서술을 비우고 제출하거나 관리자에게 문의해 주세요" }, { status: 429 });
  }
  let narrativeGrade;
  try {
    narrativeGrade = await gradeNarrative(full, narrative, { userId: opened.userId, sessionId: id });
  } catch (err) {
    console.error("[play/accuse] 서술 채점 실패", err);
    await logEvent({ type: "error", where: "play/accuse", message: err instanceof Error ? err.message : String(err), userId: opened.userId, sessionId: id, caseId: full.case.id });
    return Response.json({ error: "추리 서술을 채점하지 못했어요. 잠시 후 다시 제출해 주세요 (아직 제출되지 않았어요)" }, { status: 502 });
  }
  const g = grade(full, session, { ...a, narrative, narrativeGrade });
  const accusation = { ...a, narrative, narrativeGrade, graded: g }; // 채점 결과까지 저장해 결과 화면이 나중에도 같게
  // status 조건으로 두 번 제출되는 것을 막는다
  const [done] = await db
    .update(playSessions)
    .set({ status: "finished", accusation, score: g.score, matchRate: g.matchRate, ending: g.ending, finishedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(playSessions.id, id), eq(playSessions.status, "playing")))
    .returning({ id: playSessions.id });
  if (!done) return Response.json({ error: "이미 제출했습니다" }, { status: 409 });

  return Response.json({ sessionId: id });
}
