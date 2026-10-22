import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { PASSWORD_MAX, PASSWORD_MIN } from "./auth-rules";
import { changeCredits, SIGNUP_BONUS } from "./credits";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
  }),
  emailAndPassword: { enabled: true, minPasswordLength: PASSWORD_MIN, maxPasswordLength: PASSWORD_MAX },
  // 소셜 로그인(구글, 카카오 등)은 나중에 socialProviders 에 추가
  databaseHooks: {
    user: {
      create: {
        // 가입하면 보너스 크레딧 지급 (내역에도 남는다)
        after: async (created) => {
          await changeCredits({ userId: created.id, amount: SIGNUP_BONUS, reason: "signup_bonus" });
        },
      },
    },
  },
  plugins: [nextCookies()],
});

/** 로그인이 필요한 페이지에서 사용. 로그인 안 했으면 로그인 화면으로 보냈다가 돌아오게 한다 */
export async function requireUserId(returnTo: string): Promise<string> {
  const userId = await getUserId();
  if (!userId) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return userId;
}

export async function isAdmin(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const [row] = await db.select({ role: schema.user.role }).from(schema.user).where(eq(schema.user.id, userId));
  return row?.role === "admin";
}

/** 관리자 전용 페이지에서 사용. 관리자가 아니면 404 (관리자 화면이 있다는 것도 숨긴다) */
export async function requireAdmin(returnTo: string): Promise<string> {
  const userId = await requireUserId(returnTo);
  if (!(await isAdmin(userId))) notFound();
  return userId;
}

/** 현재 로그인한 사용자 id. 로그인 안 했으면 null */
export async function getUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user.id ?? null;
}
