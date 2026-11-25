import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { logEvent } from "@/lib/ai/usage";
import { getUserId } from "@/lib/auth";
import { draftCase, DraftError } from "@/lib/cases/draft";
import { changeCredits } from "@/lib/credits";
import { DRAFT_CREDITS, FREE_DRAFTS_PER_DAY, MAX_DRAFTS_PER_DAY, overDailyCost, takeQuota } from "@/lib/quota";

const Body = z.object({ idea: z.string().trim().min(5).max(500), size: z.enum(["short", "normal"]).default("short"), pay: z.boolean().default(false) });

/** 호스팅의 함수 최대 실행 시간 (초). 초안을 한 번 고치게 하면 2~4분 걸릴 수 있다 */
export const maxDuration = 300;

/** POST /api/cases/draft  { idea, size, pay } → { file }  AI 사건 초안 (저장하지 않는다). 하루 무료 횟수를 넘기면 pay 를 확인받고 크레딧을 차감한다 */
export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "로그인이 필요합니다" }, { status: 401 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "아이디어를 5자에서 500자 사이로 적어 주세요" }, { status: 400 });
  const { idea, size, pay } = parsed.data;
  if (await overDailyCost(userId)) return Response.json({ error: "하루에 쓸 수 있는 AI 사용량을 넘었어요. 나중에 다시 시도해 주세요" }, { status: 429 });

  const quota = await takeQuota(userId, "draft", pay ? MAX_DRAFTS_PER_DAY : FREE_DRAFTS_PER_DAY);
  if (!quota) {
    if (pay) return Response.json({ error: `AI 초안은 하루에 ${MAX_DRAFTS_PER_DAY}번까지 만들 수 있어요` }, { status: 429 });
    return Response.json({ error: `오늘 무료 초안 ${FREE_DRAFTS_PER_DAY}번을 썼어요`, code: "PAY_REQUIRED", credits: DRAFT_CREDITS }, { status: 402 });
  }

  let charged = false;
  let called = false;
  try {
    if (quota.count > FREE_DRAFTS_PER_DAY) {
      if ((await changeCredits({ userId, amount: -DRAFT_CREDITS, reason: "draft" })) === null) {
        await quota.release();
        return Response.json({ error: `크레딧이 부족해요. 초안 1번에 ${DRAFT_CREDITS}크레딧이 필요해요`, code: "NO_CREDITS" }, { status: 402 });
      }
      charged = true;
    }
    called = true;
    return Response.json({ file: await draftCase(idea, size, userId) });
  } catch (err) {
    console.error("[cases/draft] 실패", err);
    if (charged) await changeCredits({ userId, amount: DRAFT_CREDITS, reason: "refund", note: "AI 초안 오류" }).catch((e) => console.error("[cases/draft] 환불 실패", e));
    if (!called || err instanceof Anthropic.APIError) await quota.release().catch(() => null); // AI 요청 자체가 실패했으면 횟수를 돌려준다
    await logEvent({ type: "error", where: "cases/draft", message: err instanceof Error ? err.message : String(err), userId });
    return Response.json({ error: err instanceof DraftError ? err.message : "초안을 만들지 못했어요. 잠시 후 다시 시도해 주세요" }, { status: 502 });
  }
}
