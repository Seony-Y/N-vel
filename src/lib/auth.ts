import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { PASSWORD_MAX, PASSWORD_MIN } from "./auth-rules";
import { changeCredits, SIGNUP_BONUS } from "./credits";
import { isDisposableEmail, sendEmail, verificationEmail } from "./email";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification, rateLimit: schema.rateLimit },
  }),
  // 이메일 인증을 마쳐야 로그인할 수 있다 (가짜 이메일로 보너스를 받아가는 것을 막기 위해)
  emailAndPassword: { enabled: true, minPasswordLength: PASSWORD_MIN, maxPasswordLength: PASSWORD_MAX, requireEmailVerification: true },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true, // 인증 안 된 계정으로 로그인하면 메일을 다시 보낸다
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({ to: user.email, ...verificationEmail(user.name, url, SIGNUP_BONUS) });
    },
    // 가입 보너스는 인증을 마친 뒤에 지급한다 (한 사람에게 한 번만)
    afterEmailVerification: async (user) => {
      await grantSignupBonus(user.id);
    },
  },
  // 소셜 로그인(구글, 카카오 등)은 나중에 socialProviders 에 추가
  databaseHooks: {
    user: {
      create: {
        before: async (u) => {
          if (isDisposableEmail(u.email)) {
            throw new APIError("BAD_REQUEST", { message: "임시 메일 주소로는 가입할 수 없어요", code: "DISPOSABLE_EMAIL" });
          }
        },
      },
    },
  },
  // 요청 횟수 제한 (IP 기준). 서버가 여러 대여도 공유되도록 DB 에 저장
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-up/email": { window: 60 * 60, max: 5 }, // 한 IP 에서 시간당 5개 계정
      "/sign-in/email": { window: 60, max: 10 },
      "/send-verification-email": { window: 5 * 60, max: 3 },
    },
  },
  plugins: [nextCookies()],
});

/** 가입 보너스 지급. 이미 받았으면 (DB 의 유일 제약에 걸려) 아무것도 하지 않는다 */
async function grantSignupBonus(userId: string) {
  try {
    await changeCredits({ userId, amount: SIGNUP_BONUS, reason: "signup_bonus" });
  } catch (err) {
    if (!String((err as { cause?: { code?: string } }).cause?.code ?? err).includes("23505")) throw err; // 23505 = 이미 지급됨
  }
}

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
