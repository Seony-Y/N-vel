import type Anthropic from "@anthropic-ai/sdk";
import type { Clue, PlayMessage, PlaySession, Suspect } from "@/types/db";
import type { FullCase } from "./load";

/*
 * 나레이터(조사)와 용의자(심문) 프롬프트.
 *
 * 정보 분리가 핵심이다.
 * - 나레이터: 장소와 장소 단서는 알지만, 범인·진상·용의자의 비밀은 모른다.
 * - 용의자: 자기 자신의 정보와 자기가 줄 수 있는 증언만 안다. 다른 용의자의 비밀은 모른다.
 *   범인이 아닌 용의자의 프롬프트에는 진상이 아예 없으므로 실수로도 말할 수 없다.
 *
 * 캐싱 순서 (src/lib/ai 와 같은 원칙)
 *   system[0]  규칙 + 사건 공개 정보 + 역할별 고정 정보   ← 캐시 지점 1
 *   messages   이 스레드의 대화 (뒤에만 추가됨)            ← 캐시 지점 2 (마지막 사용자 메시지)
 *   [system]   현재 장소, 찾을 수 있는 단서 등 매 턴 바뀌는 정보
 */

export const CLUE_TAG_RE = /<clue>\s*([A-Z][A-Z0-9]{0,7})\s*<\/clue>/g;
const GO_TAG_RE = /<go>\s*([A-Z][A-Z0-9]{0,7})\s*<\/go>/g;
const TALK_TAG_RE = /<talk>\s*([A-Z][A-Z0-9]{0,7})\s*<\/talk>/g;
/** 화면에 보이면 안 되는 태그들 (단서 요청, 장소 이동, 심문 전환) */
const ANY_TAG_RE = /<(clue|go|talk)>\s*[A-Z][A-Z0-9]{0,7}\s*<\/\1>/g;
const TAG_OPENERS = ["<clue>", "<go>", "<talk>"];

const NARRATOR_RULES = `당신은 추리 게임의 나레이터입니다. 플레이어(탐정)가 사건 현장을 조사하는 장면을 묘사합니다.

## 규칙
- 플레이어의 행동 결과를 2~5문장으로 생생하지만 간결하게 묘사하세요. 2인칭("당신은")으로 씁니다.
- 아래 "장소 정보"와 "단서 목록"에 있는 것만 존재합니다. 새로운 증거, 인물, 비밀 통로 등을 지어내지 마세요.
- 플레이어의 행동이 어떤 단서의 "찾는 법"에 해당하면, 그 단서의 내용(무엇이 보이는지, 적힌 글귀나 눈에 띄는 점)을 구체적으로 묘사한 뒤 응답 맨 끝에 <clue>코드</clue> 를 붙이세요. 여러 개면 각각 붙입니다.
- "이번 턴에 찾을 수 있는 단서"에 없는 단서는 묘사하지도, 태그를 붙이지도 마세요. 막연한 행동에는 주변 분위기만 묘사하고 더 구체적으로 살펴볼 곳을 은근히 암시하세요.
- 플레이어는 현재 장소에 묶이지 않습니다. 다른 장소로 가거나 다른 장소의 물건을 구체적으로 지목하면, 그곳으로 이동해 살펴보는 장면으로 묘사하고 응답 맨 끝에 <go>장소코드</go> 를 붙이세요. 그 장소의 단서도 "찾는 법"에 맞으면 줄 수 있습니다.
- 잠긴 물건(금고 등)은 잠겨 있다는 것만 묘사하고, 화면의 잠금 해제 칸에 비밀번호를 입력하라고 안내하세요. 비밀번호를 알려주지 마세요.
- 당신은 범인이 누구인지 모릅니다. 추리하거나 누군가를 범인으로 암시하지 마세요.
- 플레이어가 용의자에게 말을 걸거나 심문하려 하면, 그 인물을 마주하는 장면만 한 문장으로 묘사하고 응답 맨 끝에 <talk>용의자코드</talk> 를 붙이세요. 용의자의 대사는 지어내지 마세요 (심문 화면으로 넘어갑니다).
- 실제로 따라 할 수 있는 범죄 방법이나 잔혹한 묘사는 하지 마세요.`;

const SUSPECT_RULES = `당신은 추리 게임 속 용의자를 연기합니다. 탐정(플레이어)이 당신을 심문하고 있습니다.

## 규칙
- 아래 "당신의 정보"에 적힌 인물로서, 성격과 말투를 지키며 대답하세요. 1~4문장으로 짧게, 대화하듯 답하세요. 행동 묘사는 *별표* 로 감싸세요.
- 당신이 아는 것은 "당신의 정보"뿐입니다. 거기에 없는 사실은 모른다고 하거나 얼버무리세요. 새로운 증거나 사건을 지어내지 마세요.
- "숨기는 것"은 스스로 먼저 말하지 마세요. 거짓말 지침이 있으면 따르세요. 단, "이미 인정한 사실"에 있는 내용은 더 이상 부정하지 마세요.
- 탐정이 증거를 제시하면 그 증거에 반응하세요. "방금 제시된 증거로 무너진 지점"이 있으면 그 지침대로 인정하는 연기를 하세요.
- "지금 말해 줄 수 있는 증언"의 조건에 맞는 질문을 받으면, 그 내용을 당신의 말투로 전한 뒤 응답 맨 끝에 <clue>코드</clue> 를 붙이세요. 목록에 없는 증언은 태그를 붙이지 마세요.
- 게임 밖의 이야기(AI 인지, 정답이 뭔지 등)에는 캐릭터를 유지한 채 넘어가세요.`;

function caseHeader(full: FullCase) {
  const c = full.case;
  const parts = [`# 사건: ${c.title}`, `## 사건 개요\n${c.briefing}`];
  if (c.victim) parts.push(`## 피해자\n${c.victim}`);
  parts.push(`## 용의자 (공개 정보)\n${full.suspects.map((s) => `- ${s.code} ${s.name}${s.age ? ` (${s.age})` : ""}: ${s.role}`).join("\n")}`);
  return parts.join("\n\n");
}

function clueLine(c: Clue, full: FullCase) {
  const reqs = c.requires.map((id) => full.clues.find((x) => x.id === id)?.code).filter(Boolean);
  return `- ${c.code} 「${c.name}」 찾는 법: ${c.discoverHint || "해당 장소를 살펴보면"}${reqs.length ? ` (선행 단서: ${reqs.join(", ")})` : ""}${c.passcode ? " [잠김: 비밀번호로만 열림]" : ""}\n  내용: ${c.description}`;
}

/** 대화 기록을 API 메시지로. 마지막 사용자 메시지에 캐시 지점 2 */
function toMessages(history: PlayMessage[], userText: string): Anthropic.Beta.BetaMessageParam[] {
  const messages: Anthropic.Beta.BetaMessageParam[] = [];
  for (const m of history) if (m.role !== "event") messages.push({ role: m.role, content: m.content });
  messages.push({ role: "user", content: [{ type: "text", text: userText, cache_control: { type: "ephemeral" } }] });
  return messages;
}

export function narratorPrompt(full: FullCase, session: PlaySession, history: PlayMessage[], userText: string, discoverable: Clue[]) {
  const locationBlock = full.locations
    .map((l) => {
      const here = full.clues.filter((c) => c.locationId === l.id);
      return `### ${l.code} ${l.name}\n보이는 모습: ${l.description}\n상세: ${l.detail}\n단서:\n${here.map((c) => clueLine(c, full)).join("\n") || "- 없음"}`;
    })
    .join("\n\n");

  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: "text", text: `${NARRATOR_RULES}\n\n${caseHeader(full)}\n\n## 장소 정보\n${locationBlock}`, cache_control: { type: "ephemeral" } },
  ];

  const loc = full.locations.find((l) => l.id === session.currentLocationId);
  const locCode = new Map(full.locations.map((l) => [l.id, l.code]));
  const foundCodes = full.clues.filter((c) => session.foundClueIds.includes(c.id)).map((c) => c.code);
  const volatile = [
    `현재 장소: ${loc ? `${loc.code} ${loc.name}` : "정하지 않음 (플레이어가 말하는 곳으로 이동시키세요)"}`,
    `이미 찾은 단서: ${foundCodes.join(", ") || "없음"} (이미 찾은 단서는 다시 태그를 붙이지 마세요)`,
    `이번 턴에 찾을 수 있는 단서: ${discoverable.map((c) => `${c.code}(${locCode.get(c.locationId ?? "") ?? "?"})`).join(", ") || "없음"} (괄호는 단서가 있는 장소. 현재 장소가 아닌 단서는 플레이어가 그곳이나 그 물건을 지목했을 때만)`,
  ].join("\n");

  const messages = toMessages(history, userText);
  messages.push({ role: "system", content: volatile });
  return { system, messages };
}

export function suspectPrompt(
  full: FullCase,
  suspect: Suspect,
  session: PlaySession,
  history: PlayMessage[],
  userText: string,
  opts: { tellable: Clue[]; newlyBroken: string | null },
) {
  const isCulprit = full.case.culpritId === suspect.id;
  const held = full.clues.filter((c) => c.holderId === suspect.id);

  const sheet = [
    `## 당신의 정보`,
    `이름: ${suspect.name}${suspect.age ? ` (${suspect.age}세)` : ""}`,
    `관계: ${suspect.role}`,
    `성격: ${suspect.personality}`,
    `말투: ${suspect.speechStyle}`,
    `주장하는 알리바이: ${suspect.alibi}`,
    `실제 행적 (당신만 아는 진실): ${suspect.actual}`,
    `숨기는 것과 거짓말 지침: ${suspect.secrets}`,
    `알고 있는 것: ${suspect.knowledge}`,
    isCulprit
      ? `\n당신은 이 사건의 범인입니다. 들키지 않는 것이 목표입니다. 어떤 경우에도 살인을 자백하지 마세요.`
      : `\n당신은 범인이 아닙니다. 범인이 누구인지 모릅니다. 추측을 말할 수는 있지만 단정하지 마세요.`,
    `\n## 당신이 줄 수 있는 증언 (조건이 맞을 때만)`,
    held.map((c) => `- ${c.code}: ${c.description} / 조건: ${c.discoverHint}`).join("\n") || "- 없음",
  ].join("\n");

  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: "text", text: `${SUSPECT_RULES}\n\n${caseHeader(full)}\n\n${sheet}`, cache_control: { type: "ephemeral" } },
  ];

  const admissions = full.breakpoints.filter((b) => b.suspectId === suspect.id && session.brokenIds.includes(b.id)).map((b) => `- ${b.admission}`);
  const heldCodes = new Set(held.map((c) => c.code));
  const toldCodes = full.clues.filter((c) => heldCodes.has(c.code) && session.foundClueIds.includes(c.id)).map((c) => c.code);
  const volatile = [
    `이미 인정한 사실:\n${admissions.join("\n") || "- 없음"}`,
    opts.newlyBroken ? `방금 제시된 증거로 무너진 지점: ${opts.newlyBroken}` : "",
    `이미 말한 증언: ${toldCodes.join(", ") || "없음"}`,
    `지금 말해 줄 수 있는 증언: ${opts.tellable.map((c) => c.code).join(", ") || "없음"}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const messages = toMessages(history, userText);
  messages.push({ role: "system", content: volatile });
  return { system, messages };
}

/** 응답에서 <clue> 태그를 떼어낸다. 스트리밍 중에는 아직 닫히지 않은 태그 앞까지만 보여준다 */
export function visibleText(full: string, final = false): string {
  let text = full.replace(ANY_TAG_RE, "");
  // 아직 닫히지 않은 태그("<clue>C3", "<g" 등)는 완성될 때까지 숨긴다. 최종 텍스트에서는 남은 조각을 지운다
  const open = Math.min(...TAG_OPENERS.map((t) => text.indexOf(t)).filter((i) => i >= 0));
  if (open < Infinity) text = text.slice(0, open);
  else if (!final) {
    const tail = text.lastIndexOf("<");
    if (tail >= 0 && TAG_OPENERS.some((t) => t.startsWith(text.slice(tail)))) text = text.slice(0, tail);
  }
  return final ? text.trimEnd() : text;
}

export function extractClueCodes(full: string): string[] {
  return [...full.matchAll(CLUE_TAG_RE)].map((m) => m[1]);
}

/** 나레이터가 요청한 장소 이동·심문 전환 (여러 개면 마지막 것) */
export function extractMoves(full: string): { go: string | null; talk: string | null } {
  const last = (re: RegExp) => [...full.matchAll(re)].at(-1)?.[1] ?? null;
  return { go: last(GO_TAG_RE), talk: last(TALK_TAG_RE) };
}
