import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { apiTopups } from "@/db/schema";
import { getUserId, isAdmin } from "@/lib/auth";

const Body = z.object({
  amountUsd: z.number().positive("0보다 큰 금액을 입력하세요").max(100_000),
  note: z.string().trim().max(200).default(""),
});

/** POST /api/admin/topups  { amountUsd, note }  Anthropic 계정 충전 기록 추가 (지금 시각으로) */
export async function POST(request: Request) {
  const adminId = await getUserId();
  if (!(await isAdmin(adminId))) return Response.json({ error: "권한이 없습니다" }, { status: 404 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "잘못된 요청" }, { status: 400 });

  await db.insert(apiTopups).values({ amountMicros: Math.round(parsed.data.amountUsd * 1e6), note: parsed.data.note, adminId });
  return new Response(null, { status: 204 });
}

/** DELETE /api/admin/topups?id=3  잘못 넣은 충전 기록 지우기 */
export async function DELETE(request: Request) {
  const adminId = await getUserId();
  if (!(await isAdmin(adminId))) return Response.json({ error: "권한이 없습니다" }, { status: 404 });

  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "잘못된 요청" }, { status: 400 });
  await db.delete(apiTopups).where(eq(apiTopups.id, id));
  return new Response(null, { status: 204 });
}
