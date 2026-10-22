// 테스트 계정 만들기: npm run test-account
// 이메일·비밀번호로 로그인하는 테스트용 계정을 만들고 가입 보너스 크레딧을 넣는다.
// 계정 정보는 .env.local 의 TEST_ACCOUNT_EMAIL / TEST_ACCOUNT_PASSWORD 에 있다 (없으면 만들어서 적어 둔다).
// 이미 있는 계정이면 비밀번호만 .env.local 값으로 맞춘다.
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { appendFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

async function main() {
  const { db } = await import("@/db");
  const { account, user } = await import("@/db/schema");
  const { eq, and } = await import("drizzle-orm");
  const { hashPassword } = await import("better-auth/crypto");
  const { grantSignupBonus } = await import("@/lib/auth");
  const { getBalance } = await import("@/lib/credits");

  let email = process.env.TEST_ACCOUNT_EMAIL;
  let password = process.env.TEST_ACCOUNT_PASSWORD;
  if (!email || !password) {
    email = "tester@n-vel.test";
    password = randomBytes(12).toString("base64url");
    appendFileSync(".env.local", `\n# 테스트 계정 (npm run test-account 로 만듦). 이메일로 로그인\nTEST_ACCOUNT_EMAIL=${email}\nTEST_ACCOUNT_PASSWORD=${password}\n`);
  }

  const hash = await hashPassword(password);
  let [u] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
  if (!u) {
    const id = crypto.randomUUID();
    await db.insert(user).values({ id, name: "테스트 탐정", email, emailVerified: true });
    await db.insert(account).values({ id: crypto.randomUUID(), userId: id, providerId: "credential", accountId: id, password: hash });
    u = { id };
    console.log("✅ 테스트 계정을 만들었어요");
  } else {
    await db.update(account).set({ password: hash, updatedAt: new Date() }).where(and(eq(account.userId, u.id), eq(account.providerId, "credential")));
    console.log("ℹ️ 이미 있는 계정이라 비밀번호만 맞췄어요");
  }
  await grantSignupBonus(u.id); // 이미 받았으면 그대로
  console.log(`   이메일: ${email}`);
  console.log(`   비밀번호: .env.local 의 TEST_ACCOUNT_PASSWORD`);
  console.log(`   크레딧: 💎 ${await getBalance(u.id)}`);
}
main();
