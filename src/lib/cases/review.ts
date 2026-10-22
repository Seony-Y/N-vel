import { anthropic } from "@/lib/ai/config";
import { MOCK_AI } from "@/lib/ai/mock";
import { logUsage } from "@/lib/ai/usage";
import type { CaseFile } from "./format";

/*
 * AI 검수: 사건이 공정하게 풀리는지 AI 가 읽어 보고 문제를 짚어 준다.
 * 한 사건에 한 번씩 누르는 기능이라 가장 꼼꼼한 모델을 쓴다.
 */

export const REVIEW_MODEL = "claude-opus-5-5";

export interface Review {
  verdict: "good" | "needs_work" | "broken";
  summary: string;
  issues: { severity: "error" | "warning" | "tip"; area: string; message: string }[];
}

const SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["good", "needs_work", "broken"] },
    summary: { type: "string", description: "전체 평가 2~3문장" },
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          severity: { type: "string", enum: ["error", "warning", "tip"] },
          area: { type: "string", description: "관련 항목 (예: 타임라인, 단서 C3, 용의자 S2)" },
          message: { type: "string", description: "무엇이 문제이고 어떻게 고치면 좋은지" },
        },
        required: ["severity", "area", "message"],
        additionalProperties: false,
      },
    },
  },
  required: ["verdict", "summary", "issues"],
  additionalProperties: false,
} as const;

const SYSTEM = `당신은 추리 게임 시나리오 검수자입니다. 제작자가 만든 사건 파일(JSON)을 읽고, 플레이어 입장에서 공정하고 재미있게 풀리는지 평가합니다.

이 게임에서는 AI 나레이터가 장소 단서를, AI 용의자가 증언 단서를 줍니다. 용의자는 자기 정보만 알고, 증거를 제시받으면 정해진 '무너지는 지점(breakpoints)'에서 사실을 인정합니다. 잠긴 단서는 비밀번호로만 열립니다. 플레이어는 마지막에 범인, 객관식 질문, 결정적 증거(isKey) 최대 3개를 제출합니다.

다음을 확인하세요.
1. 해결 가능성: 찾을 수 있는 단서만으로 범인·객관식 정답을 논리적으로 추론할 수 있는가? 꼭 필요한 단서에 도달하는 경로가 있는가?
2. 모순: 진상 타임라인과 용의자들의 실제 행적·단서 내용이 서로 맞는가? 시간, 장소, 물건이 어긋나지 않는가?
3. 난이도: 범인이 너무 뻔히 드러나는 단서는 없는가? 반대로 플레이어가 알 수 없는 정보에 기대고 있지는 않은가?
4. 연기 지침: 용의자의 비밀·거짓말 지침이 명확한가? 범인이 아닌 용의자의 정보에 진상이 새고 있지 않은가?
5. 객관식: 정답이 단서로 뒷받침되는가? 오답 보기가 그럴듯한가?

문제가 없는 부분은 굳이 쓰지 마세요. 문제마다 구체적으로 무엇을 어떻게 고치면 되는지 제안하세요. 한국어로 답하세요.`;

export async function reviewCase(file: CaseFile, userId: string): Promise<Review> {
  if (MOCK_AI) {
    return {
      verdict: "needs_work",
      summary: "테스트 응답입니다. 실제 AI 검수는 MOCK_AI=false 일 때 동작합니다. 위의 자동 점검 결과를 먼저 확인하세요.",
      issues: [{ severity: "tip", area: "테스트", message: "테스트 응답 모드에서는 AI 검수를 하지 않습니다." }],
    };
  }

  // 화면 꾸미기용 HTML 은 검수와 무관하고 토큰만 차지하므로 뺀다
  const slim = { ...file, introHtml: undefined, clues: file.clues.map((c) => ({ ...c, docHtml: c.docHtml ? "(문서 있음)" : undefined })) };

  const stream = anthropic.messages.stream({
    model: REVIEW_MODEL,
    max_tokens: 16000,
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: "user", content: `사건 파일:\n${JSON.stringify(slim, null, 2)}` }],
  });
  const msg = await stream.finalMessage();
  await logUsage({ userId, sessionId: null, kind: "review", model: msg.model, usage: msg.usage });

  if (msg.stop_reason === "refusal") {
    return { verdict: "needs_work", summary: "AI 가 이 사건의 검수를 거절했습니다. 표현이 지나치게 잔혹하지 않은지 확인해 주세요.", issues: [] };
  }
  const text = msg.content.find((b) => b.type === "text")?.text;
  if (msg.stop_reason !== "end_turn" || !text) throw new Error(`검수 응답이 끝나지 않았습니다 (${msg.stop_reason})`);
  return JSON.parse(text) as Review;
}
