// 관리자 지정/해제: npm run admin -- <이메일> [--remove]
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

async function main() {
  const [email, flag] = process.argv.slice(2);
  if (!email) {
    console.log("사용법: npm run admin -- <이메일> [--remove]");
    process.exitCode = 1;
    return;
  }
  const { db } = await import("@/db");
  const { user } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");

  const role = flag === "--remove" ? "user" : "admin";
  const rows = await db.update(user).set({ role }).where(eq(user.email, email)).returning({ email: user.email });
  if (!rows.length) {
    console.log(`❌ ${email} 사용자가 없습니다. 먼저 회원가입하세요`);
    process.exitCode = 1;
  } else {
    console.log(`✅ ${email} → ${role === "admin" ? "관리자" : "일반 사용자"}`);
  }
}
main();
