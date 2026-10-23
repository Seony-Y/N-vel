import { z } from "zod";
import { getUserId } from "@/lib/auth";
import { createRequest } from "@/lib/credit-requests";

const Body = z.object({ message: z.string().trim().max(300).default("") });

/** POST /api/credits/request  { message }  관리자에게 크레딧 요청 (처리 안 된 요청은 하나만) */
export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "메시지는 300자까지 쓸 수 있어요" }, { status: 400 });

  const row = await createRequest(userId, parsed.data.message);
  if (!row) return Response.json({ error: "이미 보낸 요청이 있어요. 관리자가 확인할 때까지 기다려 주세요" }, { status: 409 });
  return Response.json({ request: { status: row.status, createdAt: row.createdAt } }, { status: 201 });
}
