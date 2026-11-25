import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db";
import { creditLedger, user } from "@/db/schema";
import { DELETE_CONFIRM } from "@/lib/account-rules";
import { auth } from "@/lib/auth";
import { keepBonusClaimQueries } from "@/lib/bonus";
import { removeCaseQueries } from "@/lib/cases/remove";

/** 탈퇴는 최근에 로그인한 세션에서만 (자리를 비운 사이 남이 누르는 것을 막기 위해) */
const FRESH_MINUTES = 15;

const Body = z.object({ confirm: z.string() });

/**
 * POST /api/account/delete  { confirm: "탈퇴합니다" }
 * 계정과 관련 데이터(로그인 정보, 크레딧, 플레이 기록, 만든 사건, 사용 기록)를 지운다. 되돌릴 수 없다.
 * 다른 사람이 플레이한 사건은 주인 정보를 떼어 남기고(removeCaseQueries), 보너스를 받은 이메일은 HMAC 값만 남긴다
 */
export async function POST(request: Request) {
  // 쿠키에 담긴 세션이 아니라 DB 의 최신 세션으로 확인한다 (다른 곳에서 로그아웃했으면 막는다)
  const session = await auth.api.getSession({ headers: await headers(), query: { disableCookieCache: true } });
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
  const { id, email } = session.user;
  const [bonus] = await db
    .select({ id: creditLedger.id })
    .from(creditLedger)
    .where(and(eq(creditLedger.userId, id), eq(creditLedger.reason, "signup_bonus")))
    .limit(1);
  await db.batch([...removeCaseQueries(id), ...(bonus ? keepBonusClaimQueries(email) : []), db.delete(user).where(eq(user.id, id))]);
  return Response.json({ ok: true });
}
