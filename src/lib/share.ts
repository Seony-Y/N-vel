/** 스포일러 없는 결과 공유 글. 범인·정답·증거 이름은 넣지 않는다 */
export function shareText(p: { title: string; endingLabel: string; score: number | null; marks: boolean[]; actions: number; hints: number; hard?: boolean; url: string }) {
  return [
    `🔍 N-vel 「${p.title}」${p.hard ? " 🔥어려움" : ""}`,
    `${p.endingLabel}${p.score === null ? "" : ` · ${p.score}점`}`,
    p.marks.map((ok) => (ok ? "🟩" : "🟥")).join(""),
    `행동 ${p.actions}회 · 힌트 ${p.hints}개`,
    p.url,
  ]
    .filter(Boolean)
    .join("\n");
}
