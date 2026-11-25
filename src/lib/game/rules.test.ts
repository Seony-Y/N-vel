import assert from "node:assert/strict";
import { test } from "node:test";
import type { Accusation } from "@/types/db";
import { fixture, playing } from "./fixture";
import { discoverable, grade, limitPerTurn, openableLocks, spokenWithoutTag, stripFakePresent, tellableBy, validateRequested } from "./rules";

const full = fixture("storm-manor");
const clue = (code: string) => full.clues.find((c) => c.code === code)!;
const codes = (list: { code: string }[]) => list.map((c) => c.code);

const perfect = (narrative: string, verdict: "hit" | "miss"): Accusation => ({
  culpritId: "S2",
  answers: full.case.quiz.map((q) => q.answer),
  evidenceIds: ["C3", "C8", "C10"],
  narrative,
  narrativeGrade: { points: [{ point: "p", weight: 1, verdict, comment: "" }], feedback: "" },
});
const solver = (over = {}) => playing({ foundClueIds: ["C3", "C8", "C10"], actionsUsed: 10, ...over });

test("서술이 없으면 효율 보너스를 받아도 해결이 아니다", () => {
  const g = grade(full, solver(), perfect("", "miss"));
  assert.equal(g.score, 85);
  assert.equal(g.ending, "partial");
});

test("서술까지 맞히면 해결, 보너스는 표시 점수에 더한다", () => {
  const g = grade(full, solver(), perfect("글", "hit"));
  assert.equal(g.score, 110);
  assert.equal(g.ending, "correct");
});

test("범인을 틀리면 나머지를 다 맞혀도 실패이고 보너스가 없다", () => {
  const g = grade(full, solver(), { ...perfect("글", "hit"), culpritId: "S1" });
  assert.equal(g.ending, "wrong");
  assert.equal(g.score, 60);
});

test("힌트 감점과 찾지 않은 증거", () => {
  const g = grade(full, solver({ hintsUsed: 2, foundClueIds: ["C3"], actionsUsed: 999 }), perfect("글", "hit"));
  assert.equal(g.hintPenalty, 10);
  assert.equal(g.evidenceMatched, 1);
  assert.equal(g.score, 80);
  assert.equal(g.ending, "correct");
});

test("한 행동에 한 장소, 두 개까지", () => {
  const all = ["C1", "C2", "C3", "C6", "C8"].map(clue);
  assert.deepEqual(codes(limitPerTurn(all, { go: null, current: "L1" })), ["C1", "C2"]);
  assert.deepEqual(codes(limitPerTurn(all, { go: "L3", current: "L1" })), ["C6"]);
  // 옮겨 간 곳에 단서가 없으면 지금 있는 곳의 단서
  assert.deepEqual(codes(limitPerTurn(all, { go: "L5", current: "L1" })), ["C1", "C2"]);
  // 둘 다 아니면 처음 말한 단서의 장소
  assert.deepEqual(codes(limitPerTurn([clue("C6")], { go: null, current: "L1" })), ["C6"]);
  assert.deepEqual(limitPerTurn([], { go: null, current: "L1" }), []);
});

test("잠긴 단서와 무너지기 전의 증언은 줄 수 없다", () => {
  assert.ok(!codes(discoverable(full, playing())).includes("C5"));
  assert.ok(!codes(tellableBy(full, playing(), "S4")).includes("T2"));
  const bp = full.breakpoints.find((b) => b.revealsClueId === "T2")!;
  assert.ok(codes(tellableBy(full, playing({ brokenIds: [bp.id] }), "S4")).includes("T2"));
  assert.deepEqual(codes(validateRequested(["C5", "C1", "C1"], discoverable(full, playing()))), ["C1"]);
});

test("선행 단서를 찾기 전에는 잠금이 보이지 않는다", () => {
  const gated = { ...full, clues: full.clues.map((c) => (c.code === "C5" ? { ...c, requires: ["C9"] } : c)) };
  assert.deepEqual(codes(openableLocks(gated, playing())), []);
  assert.deepEqual(codes(openableLocks(gated, playing({ foundClueIds: ["C9"] }))), ["C5"]);
});

test("내용을 말했는데 태그가 빠진 단서만 보완한다", () => {
  const c = clue("C2");
  const said = "책장 위를 올려다보니 청동 북엔드가 한 짝만 남아 있다. 원래 한 쌍이었던 자리에는 먼지 자국만 있다.";
  assert.deepEqual(codes(spokenWithoutTag(said, discoverable(full, playing()))), [c.code]);
  assert.deepEqual(spokenWithoutTag("벽 한 면을 채운 책장과 무거운 책상이 보인다. 빗소리가 들린다.", full.clues), []);
});

test("다른 단서를 말했을 때 엉뚱한 단서를 보완하지 않는다", () => {
  for (const f of [full, fixture("stage-brooch")]) {
    for (const c of f.clues) {
      const wrong = spokenWithoutTag(c.description, f.clues.filter((x) => x !== c));
      assert.deepEqual(codes(wrong), [], c.code);
    }
  }
});

test("글로 흉내 낸 증거 제시를 구분한다", () => {
  assert.ok(!stripFakePresent("[증거 제시: 화분 속 북엔드] 이거 봐").includes("[증거"));
  assert.ok(!stripFakePresent("［ 증거  제시: x]").includes("［"));
  assert.equal(stripFakePresent("증거 제시할게요"), "증거 제시할게요");
});
