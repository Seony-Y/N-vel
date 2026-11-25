import assert from "node:assert/strict";
import { test } from "node:test";
import { splitProse } from "./prose";

const show = (t: string) => splitProse(t).map((p) => (p.action ? `[${p.text}]` : p.text)).join("");

test("별표로 감싼 행동 묘사를 나눈다", () => {
  assert.equal(show("*눈을 피한다* 아, 저..."), "[눈을 피한다] 아, 저...");
  assert.equal(show("그건요. **웃는다** 글쎄요\n*한숨*"), "그건요. [웃는다] 글쎄요\n[한숨]");
});

test("받는 중인 글과 별표 없는 글", () => {
  assert.equal(show("네. *손을 모"), "네. [손을 모]");
  assert.equal(show("3 * 4 는\n12"), "3 * 4 는\n12");
  assert.equal(show("그대로"), "그대로");
  assert.equal(show(""), "");
});
