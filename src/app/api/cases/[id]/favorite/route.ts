import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { caseFavorites } from "@/db/schema";
import { getUserId } from "@/lib/auth";
import { canPlay, loadCase } from "@/lib/game/load";

/** PUT /api/cases/:id/favorite  즐겨찾기 추가 (이미 있으면 그대로) */
export async function PUT(_request: Request, ctx: RouteContext<"/api/cases/[id]/favorite">) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "로그인이 필요합니다" }, { status: 401 });
  const { id } = await ctx.params;
  const full = await loadCase(id).catch(() => null);
  if (!full || !canPlay(full.case, userId)) return Response.json({ error: "사건을 찾을 수 없습니다" }, { status: 404 });

  await db.insert(caseFavorites).values({ userId, caseId: id }).onConflictDoNothing();
  return new Response(null, { status: 204 });
}

/** DELETE /api/cases/:id/favorite  즐겨찾기 해제 */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/cases/[id]/favorite">) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "로그인이 필요합니다" }, { status: 401 });
  const { id } = await ctx.params;

  await db.delete(caseFavorites).where(and(eq(caseFavorites.userId, userId), eq(caseFavorites.caseId, id)));
  return new Response(null, { status: 204 });
}
