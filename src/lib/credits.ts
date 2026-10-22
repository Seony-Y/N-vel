import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { creditLedger, user } from "@/db/schema";

/*
 * 크레딧 잔액. 잔액(user.credits)은 반드시 여기서만 바꾼다.
 * 잔액 변경과 내역 기록을 한 SQL 문으로 처리해서, 동시에 요청이 와도
 * 잔액이 음수가 되거나 내역과 어긋나지 않는다.
 */

export { SIGNUP_BONUS } from "./credits-config";

type Reason = (typeof creditLedger.reason.enumValues)[number];

/**
 * 잔액에 amount 를 더한다 (음수면 차감). 차감인데 잔액이 모자라면 아무것도 바꾸지 않고 null.
 * 성공하면 바뀐 뒤의 잔액.
 */
export async function changeCredits(p: { userId: string; amount: number; reason: Reason; sessionId?: string | null; adminId?: string | null; note?: string; allowNegative?: boolean }): Promise<number | null> {
  const guard = p.amount < 0 && !p.allowNegative ? sql`and ${user.credits} >= ${-p.amount}` : sql``;
  const result = await db.execute<{ balance_after: number }>(sql`
    with u as (
      update ${user} set credits = ${user.credits} + ${p.amount}
      where ${user.id} = ${p.userId} ${guard}
      returning ${user.id} as id, ${user.credits} as credits
    )
    insert into ${creditLedger} (user_id, amount, balance_after, reason, session_id, admin_id, note)
    select u.id, ${p.amount}, u.credits, ${p.reason}, ${p.sessionId ?? null}, ${p.adminId ?? null}, ${p.note ?? ""} from u
    returning balance_after
  `);
  const row = result.rows[0];
  return row ? Number(row.balance_after) : null;
}

export async function getBalance(userId: string | null): Promise<number> {
  if (!userId) return 0;
  const [row] = await db.select({ credits: user.credits }).from(user).where(eq(user.id, userId));
  return row?.credits ?? 0;
}

export async function ledger(userId: string, limit = 50) {
  return db.select().from(creditLedger).where(eq(creditLedger.userId, userId)).orderBy(desc(creditLedger.id)).limit(limit);
}

export const REASON_LABEL: Record<Reason, string> = {
  signup_bonus: "🎁 가입 보너스",
  action: "🔎 수사 행동",
  refund: "↩ 환불 (오류)",
  admin: "🛡 관리자 조정",
};
