import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { playSessions } from "@/db/schema";
import { getUserId } from "@/lib/auth";

const Body = z.object({ notes: z.string().max(10000) });

/**
 * POST /api/play/:id/notes  수첩 메모 저장.
 * 사건 내용이 필요 없으므로 openSession(사건 전체 불러오기)을 거치지 않고, 내 기록일 때만 바로 저장한다 (DB 왕복 1번)
 */
export async function POST(request: Request, ctx: RouteContext<"/api/play/[id]/notes">) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "로그인이 필요합니다" }, { status: 401 });
  const { id } = await ctx.params;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "메모는 1만 자 이하여야 합니다" }, { status: 400 });

  const [row] = await db
    .update(playSessions)
    .set({ notes: parsed.data.notes })
    .where(and(eq(playSessions.id, id), eq(playSessions.userId, userId)))
    .returning({ id: playSessions.id })
    .catch(() => []); // id 가 uuid 형식이 아니면 오류 대신 없음으로
  if (!row) return Response.json({ error: "플레이 기록이 없습니다" }, { status: 404 });
  return new Response(null, { status: 204 });
}
