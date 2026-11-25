import { createHmac } from "node:crypto";
import { and, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { bonusClaims, user } from "@/db/schema";
import { changeCredits, SIGNUP_BONUS } from "./credits";

/*
 * 가입 보너스. 탈퇴하고 다시 가입해 여러 번 받는 것을 막기 위해, 보너스를 받은 계정이 탈퇴하면
 * 이메일의 HMAC 값만 1년 동안 남긴다 (이메일 자체는 남기지 않는다. 개인정보처리방침 3조)
 */
const KEEP_MS = 365 * 86400_000;

const emailHash = (email: string) => createHmac("sha256", process.env.BETTER_AUTH_SECRET!).update(`bonus:${email.trim().toLowerCase()}`).digest("hex");

/** 가입 보너스 지급. 이미 받았거나(DB 의 유일 제약) 최근에 받고 탈퇴한 이메일이면 아무것도 하지 않는다 */
export async function grantSignupBonus(userId: string) {
  const [u] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId));
  if (!u) return;
  const [claimed] = await db
    .select({ at: bonusClaims.createdAt })
    .from(bonusClaims)
    .where(and(eq(bonusClaims.emailHash, emailHash(u.email)), gte(bonusClaims.createdAt, new Date(Date.now() - KEEP_MS))));
  if (claimed) return;
  try {
    await changeCredits({ userId, amount: SIGNUP_BONUS, reason: "signup_bonus" });
  } catch (err) {
    if (!String((err as { cause?: { code?: string } }).cause?.code ?? err).includes("23505")) throw err; // 23505 = 이미 지급됨
  }
}

/** 탈퇴할 때 함께 실행할 쿼리: 1년 지난 기록을 지우고, 이 이메일이 보너스를 받았다는 표시를 남긴다 */
export function keepBonusClaimQueries(email: string) {
  return [
    db.delete(bonusClaims).where(lt(bonusClaims.createdAt, new Date(Date.now() - KEEP_MS))),
    db.insert(bonusClaims).values({ emailHash: emailHash(email) }).onConflictDoNothing(),
  ] as const;
}
