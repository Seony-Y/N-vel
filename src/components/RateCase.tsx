"use client";

import { useState } from "react";
import { LENGTHS, LEVELS, type Length, type Level } from "@/lib/feedback-config";

type Value = { stars: number; level: Level | null; length: Length | null; comment: string };

/** 결과 화면: 사건 평가 (별점, 난이도·길이 느낌, 의견). 별점만 눌러도 저장된다 */
export function RateCase({ caseId, initial }: { caseId: string; initial: Value | null }) {
  const [v, setV] = useState<Value>(initial ?? { stars: 0, level: null, length: null, comment: "" });
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(initial ? "saved" : "idle");

  async function save(next: Value) {
    setV(next);
    if (!next.stars) return;
    setStatus("saving");
    const res = await fetch(`/api/cases/${caseId}/rating`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) }).catch(() => null);
    setStatus(res?.ok ? "saved" : "error");
  }

  const chips = <K extends string>(label: string, options: Record<K, string>, value: K | null, pick: (k: K | null) => void) => (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-12 text-xs text-zinc-500">{label}</span>
      {(Object.entries(options) as [K, string][]).map(([k, text]) => (
        <button key={k} type="button" aria-pressed={value === k} onClick={() => pick(value === k ? null : k)} className={`rounded-full border px-3 py-1 text-xs ${value === k ? "border-red-600 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300" : "border-zinc-300 dark:border-zinc-700"}`}>
          {text}
        </button>
      ))}
    </div>
  );

  return (
    <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">이 사건 어땠나요?</h2>
        <span role="status" className={`text-xs ${status === "error" ? "text-red-600" : "text-zinc-400"}`}>
          {status === "saving" ? "저장 중…" : status === "saved" ? "저장했어요" : status === "error" ? "저장하지 못했어요" : ""}
        </span>
      </div>
      <div className="flex gap-1" role="radiogroup" aria-label="별점">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={v.stars === n} aria-label={`별 ${n}개`} onClick={() => save({ ...v, stars: n })} className={`text-3xl leading-none ${n <= v.stars ? "text-amber-500" : "text-zinc-300 dark:text-zinc-700"}`}>
            ★
          </button>
        ))}
      </div>
      {v.stars > 0 && (
        <>
          {chips("난이도", LEVELS, v.level, (level) => save({ ...v, level }))}
          {chips("길이", LENGTHS, v.length, (length) => save({ ...v, length }))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save(v);
            }}
            className="flex gap-2"
          >
            <input value={v.comment} onChange={(e) => setV({ ...v, comment: e.target.value })} maxLength={300} placeholder="한 줄 의견 (선택, 만든 사람과 관리자만 봐요)" className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
            <button type="submit" className="shrink-0 rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
              저장
            </button>
          </form>
        </>
      )}
    </section>
  );
}
