import { z } from "zod";
import { getUserId, isAdmin } from "@/lib/auth";
import { resolveRequest } from "@/lib/credit-requests";

const Body = z.discriminatedUnion("action", [
  z.object({ id: z.number().int().positive(), action: z.literal("grant"), amount: z.number().int().min(1).max(100_000) }),
  z.object({ id: z.number().int().positive(), action: z.literal("dismiss") }),
]);

/** POST /api/admin/credit-requests  { id, action: "grant", amount } | { id, action: "dismiss" }  크레딧 요청 처리 */
export async function POST(request: Request) {
  const adminId = await getUserId();
  if (!adminId || !(await isAdmin(adminId))) return Response.json({ error: "권한이 없습니다" }, { status: 404 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "지급할 크레딧을 1 이상으로 입력하세요" }, { status: 400 });

  const row = await resolveRequest({ ...parsed.data, adminId });
  if (!row) return Response.json({ error: "이미 처리된 요청이에요" }, { status: 409 });
  return new Response(null, { status: 204 });
}
