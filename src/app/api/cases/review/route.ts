import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getUserId } from "@/lib/auth";
import { checkCase } from "@/lib/cases/check";
import { CaseFile } from "@/lib/cases/format";
import { reviewCase } from "@/lib/cases/review";
import { logEvent } from "@/lib/ai/usage";
import { changeCredits } from "@/lib/credits";
import { FREE_REVIEWS_PER_DAY, MAX_REVIEWS_PER_DAY, REVIEW_CREDITS, takeQuota } from "@/lib/quota";

const Body = z.object({ file: z.unknown(), ai: z.boolean().default(true), pay: z.boolean().default(false) });

/** 호스팅의 함수 최대 실행 시간 (초). AI 검수는 40초 안팎 걸린다 */
export const maxDuration = 120;

/**
 * POST /api/cases/review  { file, ai, pay }
 * 형식 검사 → 자동 점검 → (ai 이면) AI 검수. 저장하지 않은 사건도 검수할 수 있다.
 * AI 검수는 하루 몇 번까지 무료. 무료를 다 쓰면 pay 를 확인받은 뒤 크레딧을 차감한다
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

  // 횟수는 AI 를 부르기 전에 차지한다. 무료를 다 썼는데 유료 확인(pay)이 없으면 먼저 물어본다
  const quota = await takeQuota(userId, "review", body.data.pay ? MAX_REVIEWS_PER_DAY : FREE_REVIEWS_PER_DAY);
  if (!quota) {
    if (body.data.pay) return Response.json({ error: `AI 검수는 하루에 ${MAX_REVIEWS_PER_DAY}번까지 할 수 있어요`, checks }, { status: 429 });
    return Response.json({ error: `오늘 무료 AI 검수 ${FREE_REVIEWS_PER_DAY}번을 모두 썼어요`, code: "PAY_REQUIRED", credits: REVIEW_CREDITS, checks }, { status: 402 });
  }

  let charged = false;
  let called = false;
  try {
    if (quota.count > FREE_REVIEWS_PER_DAY) {
      const balance = await changeCredits({ userId, amount: -REVIEW_CREDITS, reason: "review", note: parsed.data.title });
      if (balance === null) {
        await quota.release();
        return Response.json({ error: `크레딧이 부족해요. 무료 횟수를 넘긴 AI 검수는 1회에 ${REVIEW_CREDITS}크레딧이 필요해요`, code: "NO_CREDITS", checks }, { status: 402 });
      }
      charged = true;
    }
    called = true;
    const review = await reviewCase(parsed.data, userId);
    return Response.json({ checks, review });
  } catch (err) {
    console.error("[cases/review] 실패", err);
    if (charged) await changeCredits({ userId, amount: REVIEW_CREDITS, reason: "refund", note: "AI 검수 오류" }).catch((e) => console.error("[cases/review] 환불 실패", e));
    // AI 요청 자체가 실패한 경우만 횟수를 돌려준다 (응답이 잘린 경우는 이미 비용이 들었다)
    if (!called || err instanceof Anthropic.APIError) await quota.release().catch(() => null);
    await logEvent({ type: "error", where: "cases/review", message: err instanceof Error ? err.message : String(err), userId, detail: { title: parsed.data.title } });
    return Response.json({ error: "AI 검수에 실패했습니다. 잠시 후 다시 시도해 주세요", checks }, { status: 502 });
  }
}
