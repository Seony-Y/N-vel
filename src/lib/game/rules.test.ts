import assert from "node:assert/strict";
import { test } from "node:test";
import type { Accusation } from "@/types/db";
import { fixture, playing } from "./fixture";
import { breakpointFor, combination, discoverable, grade, limitPerTurn, openableLocks, spokenWithoutTag, stripFakePresent, tellableBy, validateRequested } from "./rules";

const full = fixture("storm-manor");
const clue = (code: string) => full.clues.find((c) => c.code === code)!;
const codes = (list: { code: string }[]) => list.map((c) => c.code);

const perfect = (narrative: string, verdict: "hit" | "miss"): Accusation => ({
  culpritId: "S2",
  answers: full.case.quiz.map((q) => q.answer),
  evidenceIds: ["D1", "D2", "D3"],
  narrative,
  narrativeGrade: { points: [{ point: "p", weight: 1, verdict, comment: "" }], feedback: "" },
});
const solver = (over = {}) => playing({ foundClueIds: ["D1", "D2", "D3"], actionsUsed: 10, ...over });

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
  const g = grade(full, solver({ hintsUsed: 2, foundClueIds: ["D1"], actionsUsed: 999 }), perfect("글", "hit"));
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

test("단서를 정확히 골라야 이어진다 (순서는 상관없다)", () => {
  assert.equal(combination(full, ["T3", "C8"])?.code, "D1");
  assert.equal(combination(full, ["C7", "C10"]), null);
  assert.equal(combination(full, ["T7", "C7", "C10"])?.code, "D2");
  assert.equal(combination(full, ["C8", "T3", "C1"]), null);
});

test("공식 사건의 모든 단서는 실제로 얻을 수 있다", () => {
  for (const slug of ["storm-manor", "stage-brooch"]) {
    const f = fixture(slug);
    const s = playing();
    const add = (id: string | null | undefined) => {
      if (id && !s.foundClueIds.includes(id)) s.foundClueIds.push(id);
    };
    for (let n = -1; n !== s.foundClueIds.length; ) {
      n = s.foundClueIds.length;
      discoverable(f, s).forEach((c) => add(c.id));
      openableLocks(f, s).forEach((c) => add(c.id));
      for (const sus of f.suspects) {
        tellableBy(f, s, sus.id).forEach((c) => add(c.id));
        for (const id of [...s.foundClueIds]) {
          const bp = breakpointFor(f, s, sus.id, id);
          if (!bp) continue;
          s.brokenIds.push(bp.id);
          add(bp.revealsClueId);
        }
      }
      f.clues.filter((c) => c.combine.length && c.combine.every((id) => s.foundClueIds.includes(id))).forEach((c) => add(c.id));
    }
    assert.deepEqual(f.clues.filter((c) => !s.foundClueIds.includes(c.id)).map((c) => c.code), [], slug);
  }
});

test("「폭우 속의 저택」의 결정적 증거는 이어야만 얻는다", () => {
  assert.ok(full.clues.filter((c) => c.isKey).every((c) => c.combine.length > 0));
});
