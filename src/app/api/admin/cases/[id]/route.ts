import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { cases } from "@/db/schema";
import { getUserId, isAdmin } from "@/lib/auth";

const Body = z.object({ hidden: z.boolean(), reason: z.string().trim().max(300).default("") });

/**
 * POST /api/admin/cases/:id  { hidden, reason }  관리자: 사건 숨기기 / 다시 보이기.
 * 공개 여부(isPublic)와 따로 둔다. 숨긴 사건은 목록·플레이에서 빠지고, 만든 사람만 볼 수 있다
 */
export async function POST(request: Request, ctx: RouteContext<"/api/admin/cases/[id]">) {
  const adminId = await getUserId();
  if (!adminId || !(await isAdmin(adminId))) return Response.json({ error: "권한이 없습니다" }, { status: 404 });
  const { id } = await ctx.params;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "이유는 300자까지 쓸 수 있어요" }, { status: 400 });
  const { hidden, reason } = parsed.data;

  // updatedAt 은 건드리지 않는다 (사건 내용이 바뀐 게 아니라 목록 순서·사건 캐시가 그대로여야 한다)
  const [row] = await db
    .update(cases)
    .set(hidden ? { hiddenAt: new Date(), hiddenReason: reason } : { hiddenAt: null, hiddenReason: "" })
    .where(eq(cases.id, id))
    .returning({ id: cases.id })
    .catch(() => []);
  if (!row) return Response.json({ error: "사건을 찾을 수 없습니다" }, { status: 404 });
  return new Response(null, { status: 204 });
}
