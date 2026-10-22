import type { Clue } from "@/types/db";

/*
 * 테스트 응답 모드. .env.local 에 MOCK_AI=true 이면 Claude API 를 호출하지 않는다 (비용 0).
 * 게임 흐름을 시험할 수 있도록, 입력에 단서 이름의 단어가 들어 있으면 그 단서를 찾은 것으로 태그를 붙인다.
 * 실제 AI 로 바꾸려면 MOCK_AI=false 또는 줄을 지운다.
 */

export const MOCK_AI = process.env.MOCK_AI === "true";

function matches(input: string, clue: Clue) {
  const words = [...clue.name.split(/\s+/), ...clue.discoverHint.split(/[\s,()]+/)].filter((w) => w.length >= 2);
  return words.some((w) => input.includes(w.replace(/[을를이가은는의에서]$/, "")));
}

export function mockGameReply(params: { userText: string; modelLabel: string; who: string; candidates: Clue[]; admission?: string | null }) {
  const hit = params.candidates.filter((c) => matches(params.userText, c)).slice(0, 2);
  const lines = [`테스트 응답입니다. (${params.who} / 모델: ${params.modelLabel})`];
  if (params.admission) lines.push(`*증거를 보고 표정이 굳는다* (인정: ${params.admission})`);
  lines.push(hit.length ? `무언가를 발견했습니다: ${hit.map((c) => c.name).join(", ")}` : "특별한 것은 보이지 않습니다.");
  return lines.join("\n") + hit.map((c) => `<clue>${c.code}</clue>`).join("");
}

/** 실제 스트리밍처럼 보이도록 조금씩 내보낸다 */
export async function* streamText(text: string): AsyncGenerator<string> {
  for (let i = 0; i < text.length; i += 3) {
    await new Promise((r) => setTimeout(r, 10));
    yield text.slice(i, i + 3);
  }
}
