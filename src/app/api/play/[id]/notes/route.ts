import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { playSessions } from "@/db/schema";
import { openSession } from "@/lib/game/session";

const Body = z.object({ notes: z.string().max(10000) });

/** POST /api/play/:id/notes  수첩 메모 저장 */
export async function POST(request: Request, ctx: RouteContext<"/api/play/[id]/notes">) {
  const { id } = await ctx.params;
  const opened = await openSession(id);
  if (opened instanceof Response) return opened;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "메모는 1만 자 이하여야 합니다" }, { status: 400 });

  await db.update(playSessions).set({ notes: parsed.data.notes }).where(eq(playSessions.id, id));
  return new Response(null, { status: 204 });
}
