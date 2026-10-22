import type Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import { eventLogs, usageLogs } from "@/db/schema";
import { costMicros } from "./models";

type Usage = Anthropic.Beta.BetaUsage | Anthropic.Usage;

/** 응답 1회의 실제 토큰 사용량과 원가를 기록한다. 관리자 화면과 내부 가격 기준의 근거 */
export async function logUsage(params: {
  userId: string;
  sessionId: string | null;
  kind: "narrator" | "suspect" | "review";
  model: string;
  usage: Usage;
}) {
  const { usage } = params;
  try {
    await db.insert(usageLogs).values({
      userId: params.userId,
      sessionId: params.sessionId,
      kind: params.kind,
      model: params.model,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cacheReadTokens: usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
      costMicros: costMicros(params.model, usage),
    });
  } catch (err) {
    console.error("[usage] 기록 실패", err);
  }
}

/** 오류·거절·규칙 위반 요청을 기록한다. 기록 실패가 본 기능을 막지 않도록 예외를 삼킨다 */
export async function logEvent(e: {
  type: "error" | "refusal" | "rejected_clue" | "truncated";
  where: string;
  message: string;
  userId?: string | null;
  sessionId?: string | null;
  caseId?: string | null;
  detail?: Record<string, unknown>;
}) {
  try {
    await db.insert(eventLogs).values({
      type: e.type,
      where: e.where,
      message: e.message.slice(0, 2000),
      userId: e.userId ?? null,
      sessionId: e.sessionId ?? null,
      caseId: e.caseId ?? null,
      detail: e.detail ?? null,
    });
  } catch (err) {
    console.error("[event] 기록 실패", err);
  }
}
