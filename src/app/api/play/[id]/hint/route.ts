import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { playSessions } from "@/db/schema";
import { publicState } from "@/lib/game/public";
import { openSession } from "@/lib/game/session";

/** POST /api/play/:id/hint  다음 힌트 공개 (쓸 때마다 감점) */
export async function POST(_request: Request, ctx: RouteContext<"/api/play/[id]/hint">) {
  const { id } = await ctx.params;
  const opened = await openSession(id, { requirePlaying: true });
  if (opened instanceof Response) return opened;
  const { full } = opened;

  if (opened.session.hintsUsed >= full.case.hints.length) return Response.json({ error: "더 이상 힌트가 없습니다" }, { status: 400 });

  const [session] = await db
    .update(playSessions)
    .set({ hintsUsed: sql`least(${playSessions.hintsUsed} + 1, ${full.case.hints.length})`, updatedAt: new Date() })
    .where(eq(playSessions.id, id))
    .returning();
  return Response.json({ state: publicState(full, session) });
}
