import { and, count, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { usageLogs } from "@/db/schema";
import { getUserId } from "@/lib/auth";
import { checkCase } from "@/lib/cases/check";
import { CaseFile } from "@/lib/cases/format";
import { reviewCase } from "@/lib/cases/review";
import { logEvent } from "@/lib/ai/usage";

const Body = z.object({ file: z.unknown(), ai: z.boolean().default(true) });

/** AI 검수는 비용이 드는 기능이라 시간당 횟수를 제한한다 */
const REVIEWS_PER_HOUR = 10;

/**
 * POST /api/cases/review  { file, ai }
 * 형식 검사 → 자동 점검 → (ai 이면) AI 검수. 저장하지 않은 사건도 검수할 수 있다.
 */
export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "잘못된 요청" }, { status: 400 });
  const parsed = CaseFile.safeParse(body.data.file);
  if (!parsed.success) {
    const errors = parsed.error.issues.slice(0, 20).map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message));
    return Response.json({ error: "먼저 형식 오류를 고쳐 주세요", errors }, { status: 400 });
  }

  const checks = checkCase(parsed.data);
  if (!body.data.ai) return Response.json({ checks, review: null });

  const [{ n }] = await db
    .select({ n: count() })
    .from(usageLogs)
    .where(and(eq(usageLogs.userId, userId), eq(usageLogs.kind, "review"), gt(usageLogs.createdAt, new Date(Date.now() - 3600_000))));
  if (n >= REVIEWS_PER_HOUR) return Response.json({ error: `AI 검수는 한 시간에 ${REVIEWS_PER_HOUR}번까지 할 수 있어요`, checks }, { status: 429 });

  try {
    const review = await reviewCase(parsed.data, userId);
    return Response.json({ checks, review });
  } catch (err) {
    console.error("[cases/review] 실패", err);
    await logEvent({ type: "error", where: "cases/review", message: err instanceof Error ? err.message : String(err), userId, detail: { title: parsed.data.title } });
    return Response.json({ error: "AI 검수에 실패했습니다. 잠시 후 다시 시도해 주세요", checks }, { status: 502 });
  }
}
