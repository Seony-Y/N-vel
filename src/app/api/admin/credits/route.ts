import { z } from "zod";
import { getUserId, isAdmin } from "@/lib/auth";
import { changeCredits } from "@/lib/credits";

const Body = z.object({
  userId: z.string().min(1),
  amount: z.number().int().min(-100_000).max(100_000).refine((n) => n !== 0, "0 이 아닌 값을 입력하세요"),
  note: z.string().trim().min(1, "사유를 입력하세요").max(200),
});

/** POST /api/admin/credits  { userId, amount, note }  관리자가 크레딧을 지급(+)하거나 회수(-)한다 */
export async function POST(request: Request) {
  const adminId = await getUserId();
  if (!(await isAdmin(adminId))) return Response.json({ error: "권한이 없습니다" }, { status: 404 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "잘못된 요청" }, { status: 400 });
  const { userId, amount, note } = parsed.data;

  // 회수할 때 잔액보다 많이 빼지는 않는다
  const balance = await changeCredits({ userId, amount, reason: "admin", adminId, note });
  if (balance === null) return Response.json({ error: "사용자가 없거나 잔액보다 많이 회수할 수 없어요" }, { status: 400 });
  return Response.json({ balance });
}
