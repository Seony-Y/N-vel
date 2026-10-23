import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { creditRequests, user } from "@/db/schema";
import { changeCredits } from "@/lib/credits";

/*
 * 크레딧 요청 (유료 충전이 없는 동안). 사용자가 요청하면 관리자가 관리자 화면에서 지급하거나 넘긴다.
 * 처리 안 된 요청은 한 사람에 하나만 (DB 의 unique index 로 보장)
 */

export type CreditRequest = typeof creditRequests.$inferSelect;

/** 내 가장 최근 요청 */
export async function latestRequest(userId: string) {
  const [row] = await db.select().from(creditRequests).where(eq(creditRequests.userId, userId)).orderBy(desc(creditRequests.id)).limit(1);
  return row ?? null;
}

/** 요청 보내기. 이미 처리 안 된 요청이 있으면 null */
export async function createRequest(userId: string, message: string) {
  try {
    const [row] = await db.insert(creditRequests).values({ userId, message }).returning();
    return row;
  } catch (err) {
    if (String((err as { cause?: { code?: string } }).cause?.code ?? err).includes("23505")) return null; // 23505 = 처리 안 된 요청이 이미 있음
    throw err;
  }
}

/** 관리자: 처리 안 된 요청 (오래된 것부터) */
export async function pendingRequests() {
  return db
    .select({ id: creditRequests.id, message: creditRequests.message, createdAt: creditRequests.createdAt, userId: user.id, name: user.name, email: user.email, balance: user.credits })
    .from(creditRequests)
    .innerJoin(user, eq(user.id, creditRequests.userId))
    .where(eq(creditRequests.status, "pending"))
    .orderBy(asc(creditRequests.createdAt));
}

/**
 * 관리자: 요청 처리. 먼저 상태를 바꿔 요청을 '차지'한 뒤 지급한다 (두 번 눌러도 한 번만 지급되도록).
 * 처리할 요청이 없으면(이미 처리됨) null
 */
export async function resolveRequest(p: { id: number; adminId: string; action: "grant" | "dismiss"; amount?: number }) {
  const granted = p.action === "grant";
  const [row] = await db
    .update(creditRequests)
    .set({ status: granted ? "granted" : "dismissed", amount: granted ? p.amount : null, adminId: p.adminId, resolvedAt: new Date() })
    .where(and(eq(creditRequests.id, p.id), eq(creditRequests.status, "pending")))
    .returning();
  if (!row) return null;
  if (granted && p.amount) await changeCredits({ userId: row.userId, amount: p.amount, reason: "admin", adminId: p.adminId, note: `크레딧 요청 지급 (#${row.id})` });
  return row;
}
