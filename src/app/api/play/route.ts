import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { playSessions } from "@/db/schema";
import { CHAT_MODELS, DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { getUserId } from "@/lib/auth";
import { canPlay, loadCase } from "@/lib/game/load";
import { addMessages } from "@/lib/game/session";

const Body = z.object({
  caseId: z.uuid(),
  model: z.enum(CHAT_MODELS.map((m) => m.id) as [string, ...string[]]).optional(),
  restart: z.boolean().default(false), // true 면 진행 중인 기록은 지우고 새로 시작
});

/** POST /api/play  사건 플레이 시작 → { sessionId }. 진행 중인 기록이 있으면 이어서, restart 면 새로 (다시 도전) */
export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "잘못된 요청" }, { status: 400 });
  const { caseId, model, restart } = parsed.data;

  const full = await loadCase(caseId);
  if (!full || !canPlay(full.case, userId)) return Response.json({ error: "사건을 찾을 수 없습니다" }, { status: 404 });

  const playing = and(eq(playSessions.userId, userId), eq(playSessions.caseId, caseId), eq(playSessions.status, "playing"));
  if (restart) {
    // 진행 중이던 수사는 지운다. '포기'로 남기면 포기한 적이 없는데 포기 기록·통계가 쌓인다.
    // (대화 기록은 함께 지워지고, 크레딧·사용량 기록은 남되 이 수사와의 연결만 끊긴다)
    await db.delete(playSessions).where(playing);
  } else {
    const [ongoing] = await db
      .select({ id: playSessions.id })
      .from(playSessions)
      .where(playing)
      .orderBy(desc(playSessions.updatedAt))
      .limit(1);
    if (ongoing) return Response.json({ sessionId: ongoing.id });
  }

  const first = full.locations[0];
  const [session] = await db
    .insert(playSessions)
    .values({ userId, caseId, model: model ?? DEFAULT_CHAT_MODEL, currentLocationId: first?.id ?? null })
    .returning({ id: playSessions.id });
  if (first) await addMessages(session.id, "narrator", [{ role: "event", content: `📍 ${first.name}\n${first.description}` }]);

  return Response.json({ sessionId: session.id }, { status: 201 });
}
