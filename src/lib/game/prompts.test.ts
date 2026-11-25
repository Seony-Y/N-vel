import assert from "node:assert/strict";
import { test } from "node:test";
import type { PlaySession } from "@/types/db";
import { fixture, playing } from "./fixture";
import { extractClueCodes, extractMoves, extractStatement, extractSuggestions, narratorPrompt, suspectPrompt, visibleText } from "./prompts";
import { discoverable, tellableBy } from "./rules";

const manor = fixture("storm-manor");
const brooch = fixture("stage-brooch");
const narrator = (full: typeof manor, s: PlaySession) => narratorPrompt(full, s, [], "둘러본다", discoverable(full, s));
const suspect = (full: typeof manor, id: string, s: PlaySession, presented = null as (typeof manor.clues)[number] | null) =>
  suspectPrompt(full, full.suspects.find((x) => x.id === id)!, s, [], "질문", { tellable: tellableBy(full, s, id), newlyBroken: null, presented });

test("나레이터는 잠긴 단서의 내용을 열기 전에 모른다", () => {
  const before = JSON.stringify(narrator(manor, playing()));
  assert.ok(!before.includes("70% 이상이 일치"));
  assert.ok(before.includes("책상 뒤 금고"));
  assert.ok(JSON.stringify(narrator(manor, playing({ foundClueIds: ["C5"] }))).includes("70% 이상이 일치"));
});

test("선행 단서가 있는 단서는 찾을 수 있게 된 뒤에만 내용을 준다", () => {
  const gated = { ...manor, clues: manor.clues.map((c) => (c.code === "C6" ? { ...c, requires: ["C2"] } : c)) };
  assert.ok(!JSON.stringify(narrator(gated, playing())).includes("핏자국이 말라붙어"));
  const open = narrator(gated, playing({ foundClueIds: ["C2"] }));
  assert.ok(JSON.stringify(open.messages).includes("핏자국이 말라붙어"));
});

test("진행 상황이 바뀌어도 고정 부분(캐시)은 그대로다", () => {
  assert.deepEqual(narrator(manor, playing()).system, narrator(manor, playing({ foundClueIds: ["C5", "C1"] })).system);
  assert.deepEqual(suspect(manor, "S4", playing()).system, suspect(manor, "S4", playing({ brokenIds: ["S4-0"], foundClueIds: ["T2"] })).system);
});

test("무너지기 전의 증언 문구는 용의자에게 없고, 무너진 뒤에 준다", () => {
  const t2 = manor.clues.find((c) => c.code === "T2")!.description;
  const bp = manor.breakpoints.find((b) => b.revealsClueId === "T2")!;
  assert.ok(!JSON.stringify(suspect(manor, "S4", playing())).includes(t2));
  assert.ok(JSON.stringify(suspect(manor, "S4", playing({ brokenIds: [bp.id] })).messages).includes(t2));
});

test("범인의 프롬프트에 비밀번호가 없다", () => {
  assert.ok(!JSON.stringify(suspect(brooch, "S2", playing())).includes("408"));
});

test("생일 증언은 그대로 말할 수 있다", () => {
  assert.ok(JSON.stringify(suspect(manor, "S1", playing())).includes("9월 17일"));
});

test("제시된 증거는 서버가 알려 준다", () => {
  assert.ok(JSON.stringify(suspect(manor, "S2", playing()).messages).includes("이번 턴에 제시된 증거: 없음"));
  const c6 = manor.clues.find((c) => c.code === "C6")!;
  assert.ok(JSON.stringify(suspect(manor, "S2", playing(), c6).messages).includes("「화분 속 북엔드」 (실물을 확인함)"));
});

test("화면에 태그가 보이지 않는다", () => {
  const raw = "문이 열린다.<go>L2</go><clue>C8</clue><next>가|나|다</next>";
  assert.equal(visibleText(raw, true), "문이 열린다.");
  assert.equal(visibleText("문이 열린다.<cl"), "문이 열린다.");
  assert.deepEqual(extractClueCodes(raw), ["C8"]);
  assert.equal(extractMoves(raw).go, "L2");
  assert.deepEqual(extractSuggestions(raw), ["가", "나", "다"]);
});

test("진술 태그는 화면에서 숨기고, 이미 적은 진술은 다시 적지 않는다", () => {
  const raw = "*웃는다* 음악실에 있었지요.<say>밤 10시부터 음악실에 있었다고 한다</say><next>가|나|다</next>";
  assert.equal(visibleText(raw, true), "*웃는다* 음악실에 있었지요.");
  assert.equal(visibleText("있었지요.<say>밤 10"), "있었지요.");
  assert.equal(extractStatement(raw, []), "밤 10시부터 음악실에 있었다고 한다");
  assert.equal(extractStatement(raw, ["밤 10시부터 음악실에 있었다고 한다."]), null);
  assert.equal(extractStatement("그런 적 없어요.", []), null);
});
