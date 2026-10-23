import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { playSessions } from "@/db/schema";
import { CHAT_MODELS } from "@/lib/ai/models";
import { publicState } from "@/lib/game/public";
import { openSession } from "@/lib/game/session";

const Body = z.object({ model: z.enum(CHAT_MODELS.map((m) => m.id) as [string, ...string[]]) });

/** POST /api/play/:id/model  수사 도중 AI 모델 바꾸기. 다음 행동부터 그 모델의 크레딧으로 계산한다 */
export async function POST(request: Request, ctx: RouteContext<"/api/play/[id]/model">) {
  const { id } = await ctx.params;
  const opened = await openSession(id, { requirePlaying: true });
  if (opened instanceof Response) return opened;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "없는 모델입니다" }, { status: 400 });

  const [session] = await db.update(playSessions).set({ model: parsed.data.model, updatedAt: new Date() }).where(eq(playSessions.id, id)).returning();
  return Response.json({ state: publicState(opened.full, session) });
}
