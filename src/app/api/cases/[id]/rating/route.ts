import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { cases, playSessions } from "@/db/schema";
import { getUserId } from "@/lib/auth";
import { saveRating } from "@/lib/feedback";

const Body = z.object({
  stars: z.number().int().min(1).max(5),
  level: z.enum(["easy", "ok", "hard"]).nullable().default(null),
  length: z.enum(["short", "ok", "long"]).nullable().default(null),
  comment: z.string().trim().max(300).default(""),
});

/** PUT /api/cases/:id/rating  { stars, level, length, comment }  끝낸 사건 평가 (다시 보내면 바뀐다). 만든 사람은 할 수 없다 */
export async function PUT(request: Request, ctx: RouteContext<"/api/cases/[id]/rating">) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "로그인이 필요합니다" }, { status: 401 });
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "별점을 고르고, 의견은 300자까지 써 주세요" }, { status: 400 });

  const [done] = await db
    .select({ ownerId: cases.ownerId })
    .from(playSessions)
    .innerJoin(cases, eq(cases.id, playSessions.caseId))
    .where(and(eq(playSessions.userId, userId), eq(playSessions.caseId, id), eq(playSessions.status, "finished")))
    .limit(1)
    .catch(() => []);
  if (!done || done.ownerId === userId) return Response.json({ error: "끝낸 사건만 평가할 수 있어요" }, { status: 403 });
  await saveRating(userId, id, parsed.data);
  return new Response(null, { status: 204 });
}
