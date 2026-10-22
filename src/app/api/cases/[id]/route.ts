import { eq } from "drizzle-orm";
import { db } from "@/db";
import { cases } from "@/db/schema";
import { getUserId } from "@/lib/auth";
import { ownedCase, parseSave } from "@/lib/cases/api";
import { writeCase } from "@/lib/cases/import";

/** PUT /api/cases/:id  { file, isPublic }  내 사건 수정. 같은 코드의 항목은 id 가 유지되어 진행 중인 플레이가 이어진다 */
export async function PUT(request: Request, ctx: RouteContext<"/api/cases/[id]">) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "로그인이 필요합니다" }, { status: 401 });
  const { id } = await ctx.params;
  if (!(await ownedCase(id, userId))) return Response.json({ error: "사건이 없거나 수정 권한이 없습니다" }, { status: 404 });

  const parsed = parseSave(await request.json().catch(() => null));
  if ("errors" in parsed) return Response.json({ error: parsed.errors[0], errors: parsed.errors }, { status: 400 });

  await writeCase(parsed.file, { caseId: id, isPublic: parsed.isPublic });
  return Response.json({ id });
}

/** DELETE /api/cases/:id  내 사건 삭제 (모든 플레이 기록도 함께 지워진다) */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/cases/[id]">) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "로그인이 필요합니다" }, { status: 401 });
  const { id } = await ctx.params;
  if (!(await ownedCase(id, userId))) return Response.json({ error: "사건이 없거나 삭제 권한이 없습니다" }, { status: 404 });

  await db.delete(cases).where(eq(cases.id, id));
  return new Response(null, { status: 204 });
}
