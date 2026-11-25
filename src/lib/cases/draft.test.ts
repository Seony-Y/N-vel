import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { unreachableClues } from "./check";
import { checkDraft, cleanDraftJson } from "./draft";
import { CaseFile } from "./format";

const load = (slug: string) => CaseFile.parse(JSON.parse(readFileSync(`content/cases/${slug}.json`, "utf8")));
/** 사건 파일 → AI 가 내는 모양 (선택 항목은 빈 값) */
const raw = (c: CaseFile) => ({
  ...c,
  suspects: c.suspects.map((s) => ({ ...s, breakpoints: s.breakpoints.map((b) => ({ ...b, reveals: b.reveals ?? "" })) })),
  clues: c.clues.map(({ lock, ...x }) => ({ ...x, location: x.location ?? "", holder: x.holder ?? "", lockLabel: lock?.label ?? "", passcode: lock?.passcode ?? "" })),
});

test("공식 사건에는 얻을 수 없는 단서가 없다", () => {
  for (const slug of ["corner-clock", "stage-brooch", "storm-manor"]) assert.deepEqual(unreachableClues(load(slug)), [], slug);
});

test("빈 선택 항목을 지우면 형식 검사를 통과한다", () => {
  const r = checkDraft(cleanDraftJson(raw(load("storm-manor")), "normal"));
  assert.ok("file" in r, JSON.stringify(r));
  assert.equal(r.file.clues.find((c) => c.code === "C5")?.lock?.passcode, "0917");
  assert.equal(r.file.estimatedMinutes, 20);
});

test("얻을 수 없는 단서가 있으면 돌려보낸다", () => {
  const c = raw(load("corner-clock"));
  c.clues.find((x) => x.code === "T3")!.requires = ["D1"]; // D1 은 T3 을 이어야 얻는다
  const r = checkDraft(cleanDraftJson(c, "short"));
  assert.ok("problems" in r && r.problems[0].includes("T3"));
});
