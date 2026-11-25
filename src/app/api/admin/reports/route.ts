import { z } from "zod";
import { getUserId, isAdmin } from "@/lib/auth";
import { resolveReport } from "@/lib/feedback";

const Body = z.object({ id: z.number().int().positive() });

/** POST /api/admin/reports  { id }  신고를 처리한 것으로 표시 */
export async function POST(request: Request) {
  const adminId = await getUserId();
  if (!adminId || !(await isAdmin(adminId))) return Response.json({ error: "권한이 없습니다" }, { status: 404 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "잘못된 요청" }, { status: 400 });
  if (!(await resolveReport(parsed.data.id, adminId))) return Response.json({ error: "이미 처리된 신고예요" }, { status: 409 });
  return new Response(null, { status: 204 });
}
