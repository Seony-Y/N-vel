import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db";
import { user } from "@/db/schema";
import { DELETE_CONFIRM } from "@/lib/account-rules";
import { auth } from "@/lib/auth";

/** 탈퇴는 최근에 로그인한 세션에서만 (자리를 비운 사이 남이 누르는 것을 막기 위해) */
const FRESH_MINUTES = 15;

const Body = z.object({ confirm: z.string() });

/**
 * POST /api/account/delete  { confirm: "탈퇴합니다" }
 * 계정과 관련 데이터(로그인 정보, 크레딧, 플레이 기록, 만든 사건, 사용 기록)를 모두 지운다. 되돌릴 수 없다.
 */
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.confirm !== DELETE_CONFIRM) {
    return Response.json({ error: `확인 문구 "${DELETE_CONFIRM}" 를 정확히 입력해 주세요` }, { status: 400 });
  }

  const ageMinutes = (Date.now() - new Date(session.session.createdAt).getTime()) / 60_000;
  if (ageMinutes > FRESH_MINUTES) {
    return Response.json({ error: "보안을 위해 다시 로그인한 뒤 탈퇴해 주세요", code: "REAUTH" }, { status: 403 });
  }

  // 사용자 행을 지우면 연결된 데이터가 함께 지워진다 (외래 키 on delete cascade)
  await db.delete(user).where(eq(user.id, session.user.id));
  return Response.json({ ok: true });
}
