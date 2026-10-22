import { neon } from "@neondatabase/serverless";
import { connection } from "next/server";

/**
 * GET /api/health  배포 설정 점검. 값은 절대 보여주지 않고 "있음/없음"과 연결 결과만 알려준다.
 */
export async function GET(request: Request) {
  await connection(); // 요청마다 새로 검사 (빌드 때 미리 만들어 두지 않음)
  const has = (k: string) => !!process.env[k]?.trim();
  const host = new URL(request.url).origin;

  let database: string;
  if (!has("DATABASE_URL")) database = "❌ DATABASE_URL 없음";
  else {
    try {
      const sql = neon(process.env.DATABASE_URL!);
      const [{ n }] = await sql`select count(*)::int as n from cases`;
      database = `✅ 연결됨 (사건 ${n}개)`;
    } catch (err) {
      database = `❌ 연결 실패: ${(err as Error).message.slice(0, 120)}`;
    }
  }

  const authUrl = process.env.BETTER_AUTH_URL?.replace(/\/$/, "");
  return Response.json({
    database,
    BETTER_AUTH_SECRET: has("BETTER_AUTH_SECRET") ? "✅ 있음" : "❌ 없음",
    BETTER_AUTH_URL: !authUrl ? "❌ 없음" : authUrl === host ? "✅ 이 주소와 같음" : `⚠️ 이 주소(${host})와 다름: ${authUrl}`,
    ANTHROPIC_API_KEY: has("ANTHROPIC_API_KEY") ? "✅ 있음" : "❌ 없음",
    MOCK_AI: process.env.MOCK_AI === "true" ? "테스트 응답 모드" : "실제 AI",
    GOOGLE: has("GOOGLE_CLIENT_ID") && has("GOOGLE_CLIENT_SECRET") ? "✅ 있음" : "❌ 없음 (구글 로그인 준비 중으로 표시)",
    RESEND_API_KEY: has("RESEND_API_KEY") ? "✅ 있음" : "없음 (비밀번호 찾기 메일이 안 나감)",
  });
}
