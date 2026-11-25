import type { PlaySession } from "@/types/db";
import type { FullCase } from "./load";
import { breakpointFor } from "./rules";

/**
 * 대본 한 번의 결과. 선택지는 지금 장소(조사) 또는 그 용의자(심문)의 것이어야 하고, 필요한 단서를 찾았어야 한다.
 * 증거 제시는 무너지는 지점도 평소처럼 처리하고, 대본에 반응이 없으면 기본 문구를 보여 준다. 고를 수 없는 선택지면 null
 */
export function scriptTurn(full: FullCase, session: PlaySession, p: { thread: string; message: string; presentClueId?: string }) {
  const found = new Set(session.foundClueIds);
  const where = p.thread === "narrator" ? session.currentLocationId : p.thread;
  const clue = p.presentClueId ? (full.clues.find((c) => c.id === p.presentClueId) ?? null) : null;
  const line = full.case.script.find((s) => s.where === where && (clue ? s.present === clue.id : !s.present && s.say === p.message) && s.requires.every((r) => found.has(r)));
  if (!clue && !line) return null;

  const bp = clue ? breakpointFor(full, session, p.thread, clue.id) : null;
  const revealIds = [...(line?.reveals ?? []), ...(bp?.revealsClueId ? [bp.revealsClueId] : [])];
  const revealed = full.clues.filter((c) => revealIds.includes(c.id) && !found.has(c.id));
  return {
    reply: line?.reply ?? "(그 증거에는 별다른 반응이 없다. 다른 증거를 보여 주거나 다른 사람에게 가져가 보자.)",
    userText: clue ? `[증거 제시: ${clue.name}] ${clue.description}${p.message ? `\n${p.message}` : ""}` : p.message,
    revealed,
    events: revealed.map((c) => `🔍 단서 발견: ${c.name}`),
    brokenId: bp?.id ?? null,
  };
}
