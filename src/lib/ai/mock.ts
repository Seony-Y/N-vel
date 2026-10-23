import type { FullCase } from "@/lib/game/load";
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

export function mockGameReply(params: { userText: string; modelLabel: string; who: string; candidates: Clue[]; admission?: string | null; full?: FullCase | null }) {
  const { userText, full } = params;
  const lines = [`테스트 응답입니다. (${params.who} / 모델: ${params.modelLabel})`];
  // 나레이터: 용의자 이름을 부르면 심문으로, 장소 이름이 있으면 그곳으로 이동
  const talk = full?.suspects.find((s) => userText.includes(s.name));
  if (talk) return `${lines[0]}\n${talk.name}을(를) 마주합니다.<talk>${talk.code}</talk>`;
  const go = full?.locations.find((l) => userText.includes(l.name));

  const hit = params.candidates.filter((c) => matches(userText, c)).slice(0, 2);
  if (params.admission) lines.push(`*증거를 보고 표정이 굳는다* (인정: ${params.admission})`);
  if (go) lines.push(`${go.name}(으)로 향합니다.`);
  lines.push(hit.length ? hit.map((c) => `「${c.name}」을(를) 발견했습니다. ${c.description}`).join("\n") : "특별한 것은 보이지 않습니다.");
  return lines.join("\n") + (go ? `<go>${go.code}</go>` : "") + hit.map((c) => `<clue>${c.code}</clue>`).join("");
}

/** 실제 스트리밍처럼 보이도록 조금씩 내보낸다 */
export async function* streamText(text: string): AsyncGenerator<string> {
  for (let i = 0; i < text.length; i += 6) {
    await new Promise((r) => setTimeout(r, 10));
    yield text.slice(i, i + 6);
  }
}
