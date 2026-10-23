import type { FullCase } from "@/lib/game/load";

/**
 * 사건의 정답지 (진상 전체). 만든 사람과 관리자에게만 보여준다.
 * found 를 넘기면 플레이어가 찾은 단서에 표시한다 (관리자 플레이 기록 화면용).
 */
export function AnswerSheet({ full, found }: { full: FullCase; found?: Set<string> }) {
  const c = full.case;
  const culprit = full.suspects.find((s) => s.id === c.culpritId);
  const locName = (id: string | null) => full.locations.find((l) => l.id === id)?.name;
  const susName = (id: string | null) => full.suspects.find((s) => s.id === id)?.name;
  const clueName = (id: string | null) => full.clues.find((x) => x.id === id)?.name ?? "-";

  return (
    <div className="space-y-6">
      <Box title="🔪 범인과 진상">
        <p className="mb-3 text-lg font-semibold">범인: {culprit?.name ?? "지정 안 됨"}</p>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{c.truth}</p>
      </Box>

      {c.quiz.length > 0 && (
        <Box title="❓ 객관식 정답">
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            {c.quiz.map((q, i) => (
              <li key={i}>
                <div className="font-medium">{q.question}</div>
                <div className="text-zinc-500">
                  {q.options.map((o, oi) => (
                    <span key={oi} className={`mr-3 ${oi === q.answer ? "font-semibold text-emerald-600" : ""}`}>
                      {oi === q.answer ? "✓ " : ""}
                      {o}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </Box>
      )}

      <Box title={`🔍 단서 (${full.clues.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-zinc-500">
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                {found && <th className="py-2 pr-2">발견</th>}
                <th className="hidden py-2 pr-2 sm:table-cell">코드</th>
                <th className="py-2 pr-2">이름</th>
                <th className="py-2 pr-2">위치</th>
                <th className="py-2 pr-2">얻는 조건</th>
                <th className="hidden py-2 sm:table-cell">비고</th>
              </tr>
            </thead>
            <tbody>
              {full.clues.map((x) => (
                <tr key={x.id} className="border-b border-zinc-100 align-top dark:border-zinc-800/60">
                  {found && <td className="py-2 pr-2">{found.has(x.id) ? "✅" : "⬜"}</td>}
                  <td className="hidden py-2 pr-2 font-mono text-xs text-zinc-400 sm:table-cell">{x.code}</td>
                  <td className="py-2 pr-2 font-medium">
                    {x.isKey && "⭐ "}
                    {x.name}
                    {x.passcode && <div className="mt-0.5 font-mono text-xs font-normal text-amber-700 sm:hidden dark:text-amber-300">🔒 {x.passcode}</div>}
                  </td>
                  <td className="py-2 pr-2 text-zinc-500">{x.locationId ? locName(x.locationId) : `${susName(x.holderId)}의 증언`}</td>
                  <td className="py-2 pr-2 text-zinc-500">
                    {x.discoverHint}
                    {x.requires.length > 0 && <div className="text-xs">선행: {x.requires.map(clueName).join(", ")}</div>}
                  </td>
                  <td className="hidden py-2 text-xs sm:table-cell">{x.passcode && <span className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-amber-800 dark:bg-amber-950 dark:text-amber-200">🔒 {x.passcode}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Box>

      <Box title="🗣 용의자 비밀과 무너지는 지점">
        <div className="space-y-4">
          {full.suspects.map((s) => (
            <div key={s.id} className="rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-800">
              <div className="font-semibold">
                {s.name}
                {s.id === c.culpritId && <span className="ml-2 rounded bg-red-600 px-1.5 py-0.5 text-[11px] text-white">범인</span>}
              </div>
              <dl className="mt-2 space-y-1.5 text-zinc-600 dark:text-zinc-300">
                <Row k="주장하는 알리바이" v={s.alibi} />
                <Row k="실제 행적" v={s.actual} />
                <Row k="숨기는 것" v={s.secrets} />
              </dl>
              {full.breakpoints.filter((b) => b.suspectId === s.id).length > 0 && (
                <ul className="mt-2 space-y-1 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                  {full.breakpoints
                    .filter((b) => b.suspectId === s.id)
                    .map((b) => (
                      <li key={b.id}>
                        <b>「{clueName(b.clueId)}」 제시 →</b> {b.admission}
                        {b.revealsClueId && <span className="text-emerald-600"> (증언: {clueName(b.revealsClueId)})</span>}
                      </li>
                    ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </Box>
    </div>
  );
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  if (!v) return null;
  return (
    <div>
      <dt className="inline font-medium text-zinc-800 dark:text-zinc-200">{k}: </dt>
      <dd className="inline">{v}</dd>
    </div>
  );
}
