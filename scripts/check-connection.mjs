// 연결 확인: npm run check
// Neon DB 와 Claude API 키가 제대로 동작하는지 확인한다.
// Claude 는 Haiku 로 아주 짧은 요청을 1번 보낸다 (비용 $0.0001 미만).
import Anthropic from "@anthropic-ai/sdk";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

let ok = true;

try {
  if (!process.env.DATABASE_URL) throw new Error(".env.local 에 DATABASE_URL 이 비어 있습니다");
  const sql = neon(process.env.DATABASE_URL);
  const [{ version }] = await sql`select version()`;
  const tables = await sql`select count(*)::int as n from information_schema.tables where table_schema = 'public'`;
  console.log(`✅ Neon 연결 성공 (${version.split(" ").slice(0, 2).join(" ")}, 테이블 ${tables[0].n}개)`);
  if (tables[0].n === 0) console.log("   → 아직 테이블이 없습니다. npm run db:migrate 를 실행하세요");
} catch (err) {
  ok = false;
  console.log(`❌ Neon 연결 실패: ${err.message}`);
}

try {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error(".env.local 에 ANTHROPIC_API_KEY 가 비어 있습니다");
  const client = new Anthropic();
  const res = await client.messages.create({
    model: "claude-haiku-5-5",
    max_tokens: 1000,
    output_config: { effort: "low" },
    messages: [{ role: "user", content: "'연결 성공' 이라고만 답하세요." }],
  });
  const text = res.content.find((b) => b.type === "text")?.text ?? "";
  console.log(`✅ Claude API 연결 성공 (응답: ${text.trim()})`);
} catch (err) {
  ok = false;
  const hint =
    err instanceof Anthropic.AuthenticationError ? " → API 키가 잘못됐습니다" :
    err instanceof Anthropic.PermissionDeniedError ? " → 키 권한 문제입니다" :
    err instanceof Anthropic.BadRequestError && /credit/i.test(err.message) ? " → 크레딧이 부족합니다" : "";
  console.log(`❌ Claude API 연결 실패: ${err.message}${hint}`);
}

console.log(process.env.MOCK_AI === "true" ? "ℹ️  테스트 응답 모드 켜짐 (채팅은 API 를 호출하지 않음)" : "ℹ️  실제 AI 응답 모드");
process.exitCode = ok ? 0 : 1;
