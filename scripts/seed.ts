// 공식 사건 넣기: npm run seed
// content/cases/*.json 을 검사한 뒤 공식·공개 사건으로 DB 에 넣는다. 같은 slug 는 덮어쓴다 (id 유지).
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = "content/cases";

async function main() {
  // .env.local 을 읽은 뒤에 DB 모듈을 불러와야 DATABASE_URL 이 잡힌다
  const { CaseFile } = await import("@/lib/cases/format");
  const { upsertBySlug } = await import("@/lib/cases/import");

  for (const name of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const parsed = CaseFile.safeParse(JSON.parse(readFileSync(join(dir, name), "utf8")));
    if (!parsed.success) {
      console.error(`❌ ${name}`);
      for (const issue of parsed.error.issues) console.error(`   - ${issue.path.join(".")}: ${issue.message}`);
      process.exitCode = 1;
      continue;
    }
    const id = await upsertBySlug(parsed.data, { isOfficial: true, isPublic: true });
    console.log(`✅ ${name} → ${parsed.data.title} (${id})`);
  }
}

main();
