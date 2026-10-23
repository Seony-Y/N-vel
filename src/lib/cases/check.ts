import { MAX_HINTS } from "@/lib/game/rules";
import type { CaseFile } from "./format";

/*
 * AI 없이 할 수 있는 사건 점검. 저장을 막지는 않고 제작자에게 알려 주기만 한다.
 * (형식 오류는 format.ts 의 CaseFile 검사가 저장을 막는다)
 */

export interface CheckIssue {
  severity: "error" | "warning" | "tip";
  message: string;
}

export function checkCase(c: CaseFile): CheckIssue[] {
  const out: CheckIssue[] = [];
  const warn = (message: string) => out.push({ severity: "warning", message });
  const tip = (message: string) => out.push({ severity: "tip", message });
  const name = (code: string) => c.clues.find((x) => x.code === code)?.name ?? code;

  // 선행 단서가 서로를 요구하면 영원히 못 찾는다
  // 단서 수가 적으므로(최대 60) 단서마다 선행 단서를 따라가 자기 자신으로 돌아오는지 본다
  const requires = new Map(c.clues.map((x) => [x.code, x.requires]));
  const reachesSelf = (start: string) => {
    const seen = new Set<string>();
    const stack = [...(requires.get(start) ?? [])];
    while (stack.length) {
      const code = stack.pop()!;
      if (code === start) return true;
      if (seen.has(code)) continue;
      seen.add(code);
      stack.push(...(requires.get(code) ?? []));
    }
    return false;
  };
  for (const x of c.clues) if (reachesSelf(x.code)) out.push({ severity: "error", message: `「${x.name}」의 선행 단서가 서로를 요구하고 있어 영원히 찾을 수 없어요` });

  // 증언 단서인데 "제시받아야" 라고 써 두고 무너지는 지점이 없음
  const revealed = new Set(c.suspects.flatMap((s) => s.breakpoints.map((b) => b.reveals).filter(Boolean)));
  for (const x of c.clues) {
    if (x.holder && /제시/.test(x.discoverHint) && !revealed.has(x.code)) {
      warn(`「${x.name}」은 증거를 제시받아야 말한다고 되어 있지만, 이 증언을 주는 '무너지는 지점'이 없어요`);
    }
  }

  // 비밀번호를 알아낼 방법이 사건 안에 있는지
  const corpus = [
    ...c.clues.filter((x) => !x.lock).map((x) => x.description),
    ...c.suspects.flatMap((s) => [s.knowledge, s.profile]),
    ...c.locations.flatMap((l) => [l.description, l.detail]),
    ...c.hints,
  ].join("\n");
  for (const x of c.clues) {
    if (x.lock && !corpus.includes(x.lock.passcode)) {
      warn(`「${x.name}」의 비밀번호(${x.lock.passcode})가 다른 단서·증언 어디에도 그대로 나오지 않아요. 플레이어가 알아낼 수 있는지 확인하세요`);
    }
  }

  const culprit = c.suspects.find((s) => s.code === c.culprit);
  if (culprit && !culprit.breakpoints.length) tip(`범인(${culprit.name})에게 '무너지는 지점'이 없어요. 증거를 들이밀었을 때의 반응을 넣으면 심문이 훨씬 재미있어져요`);
  for (const s of c.suspects) {
    if (!s.alibi || !s.actual) warn(`${s.name}: 주장하는 알리바이와 실제 행적을 모두 채워야 AI 가 일관되게 연기해요`);
  }

  const keys = c.clues.filter((x) => x.isKey);
  if (keys.length < 3) tip(`결정적 증거가 ${keys.length}개예요. 채점은 최대 3개까지 고르게 하므로 3개 이상이면 좋아요`);
  for (const k of keys) {
    for (const r of k.requires) if (!c.clues.find((x) => x.code === r)) warn(`「${k.name}」의 선행 단서 ${name(r)}가 없어요`);
  }
  for (const l of c.locations) if (!c.clues.some((x) => x.location === l.code)) tip(`장소 「${l.name}」에 단서가 하나도 없어요`);
  if (!c.rubric.length) tip("추리 서술 채점 포인트가 없어요. 기본 기준으로 채점되지만, 이 사건에서 꼭 짚어야 할 내용(범행 방법, 거짓 알리바이와 근거, 숨긴 곳, 동기)을 넣으면 채점이 정확해져요");
  if (!c.quiz.length) tip("객관식 질문(흉기, 동기 등)이 없어요. 범인만 맞히는 게임이 돼요");
  if (!c.hints.length) tip(`힌트가 없어요. 막힌 플레이어를 위해 넣어 두면 좋아요. 최대 ${MAX_HINTS}개, 뒤로 갈수록 결정적으로 (방향 → 볼 곳 → 모순 → 거의 정답)`);
  else if (c.hints.length < MAX_HINTS) tip(`힌트가 ${c.hints.length}개예요. ${MAX_HINTS}개까지 넣을 수 있어요. 뒤로 갈수록 결정적인 힌트를 주면 막힌 플레이어가 조금씩 풀 수 있어요`);
  if (!c.endingCorrect) tip("정답 엔딩 문구가 비어 있어요");

  return out;
}
