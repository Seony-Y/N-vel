import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { CaseActions } from "@/components/CaseActions";
import { SiteHeader } from "@/components/SiteHeader";
import { Loading } from "@/components/Loading";
import { requireUserId } from "@/lib/auth";
import { loadCase, loadSession } from "@/lib/game/load";
import { DEFAULT_GIVE_UP_ENDING, ENDINGS } from "@/lib/game/endings";
import { type Grade, SOLVED_SCORE, savedGrade } from "@/lib/game/rules";

export const metadata: Metadata = { title: "수사 결과 | N-vel" };

export default function ResultPage({ params }: PageProps<"/play/[id]/result">) {
  return (
    <>
      <SiteHeader />
      <Suspense fallback={<Loading text="결과를 정리하는 중..." />}>
        <Result params={params} />
      </Suspense>
    </>
  );
}

const COLOR = {
  correct: "from-emerald-700 to-emerald-950",
  partial: "from-amber-600 to-amber-950",
  wrong: "from-zinc-700 to-zinc-950",
  gaveup: "from-zinc-700 to-zinc-950",
} as const;

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

const VERDICT = { hit: { icon: "⭕", label: "맞음" }, partial: { icon: "🔺", label: "부분" }, miss: { icon: "❌", label: "빠짐" } } as const;

/** 서술형 추리: 내가 쓴 글, 채점 포인트별 판정, 총평 */
function NarrativeResult({ n }: { n: Grade["narrative"] }) {
  if (!n) return null;
  return (
    <div className="mt-2 space-y-3 text-sm">
      {n.text ? (
        <details>
          <summary className="cursor-pointer text-zinc-500">내가 쓴 추리 보기</summary>
          <p className="mt-1.5 whitespace-pre-wrap rounded-lg bg-white/60 px-3 py-2 leading-relaxed dark:bg-zinc-900/60">{n.text}</p>
        </details>
      ) : (
        <p className="text-zinc-500">추리 서술을 쓰지 않았어요.</p>
      )}
      {n.grade && n.text && (
        <>
          <ul className="space-y-1.5">
            {n.grade.points.map((p, i) => (
              <li key={i}>
                <div>
                  {VERDICT[p.verdict].icon} {p.point}
                  <span className="ml-1 text-xs text-zinc-500">
                    {VERDICT[p.verdict].label}
                    {p.weight > 1 && ` · 비중 ×${p.weight}`}
                  </span>
                </div>
                {p.comment && <p className="ml-6 text-xs text-zinc-500">{p.comment}</p>}
              </li>
            ))}
          </ul>
          {n.grade.feedback && <p className="rounded-lg bg-white/60 px-3 py-2 text-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">💬 {n.grade.feedback}</p>}
        </>
      )}
    </div>
  );
}

async function Result({ params }: { params: PageProps<"/play/[id]/result">["params"] }) {
  const { id } = await params;
  const userId = await requireUserId(`/play/${id}/result`);
  const session = await loadSession(id, userId).catch(() => null);
  if (!session) notFound();
  if (session.status !== "finished") redirect(`/play/${id}`);

  // 진상 공개는 사건을 끝낸 본인에게만. 사건이 비공개로 바뀌었어도 결과는 볼 수 있다
  const full = await loadCase(session.caseId);
  if (!full) notFound();
  const c = full.case;
  // 포기한 수사는 제출한 추리가 없다
  const g = savedGrade(full, session);
  const ending = g?.ending ?? "gaveup";
  const endingText =
    ending === "correct" ? c.endingCorrect : ending === "partial" ? c.endingPartial : ending === "wrong" ? c.endingWrong : c.endingGiveUp || DEFAULT_GIVE_UP_ENDING;
  const culprit = full.suspects.find((s) => s.id === c.culpritId);
  const keyClues = full.clues.filter((x) => x.isKey);
  const found = new Set(session.foundClueIds);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6">
      <section className={`rounded-2xl bg-gradient-to-br ${COLOR[ending]} p-8 text-center text-white`}>
        <p className="text-sm opacity-80">{c.title}</p>
        <h1 className="mt-1 text-3xl font-bold">
          {ENDINGS[ending].icon} {ENDINGS[ending].title}
        </h1>
        {g ? (
          <>
            <div className="mt-5 flex justify-center gap-10">
              <div>
                <p className="text-5xl font-black">{g.score}</p>
                <p className="text-sm opacity-70">점수</p>
              </div>
              <div>
                <p className="text-5xl font-black">
                  {g.matchRate}
                  <span className="text-2xl">%</span>
                </p>
                <p className="text-sm opacity-70">추리 일치율</p>
              </div>
            </div>
            <p className="mt-4 text-xs opacity-70">
              해결 기준: 범인을 맞히고 {SOLVED_SCORE}점 이상 · 부분 해결: 범인만 맞힘 · 미제: 범인을 틀림
            </p>
          </>
        ) : (
          <p className="mt-3 text-sm opacity-80">추리를 제출하지 않고 수사를 그만두었습니다.</p>
        )}
      </section>

      {endingText && <p className="whitespace-pre-wrap rounded-2xl border border-zinc-200 bg-white p-6 leading-relaxed dark:border-zinc-800 dark:bg-zinc-900">{endingText}</p>}

      {/* 내 추리 vs 정답 */}
      {g && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 font-semibold">내 추리 vs 실제 정답</h2>
          <div className="space-y-3">
            {g.items.map((it, i) => (
              <div key={i} className={`rounded-xl border-l-4 p-3 ${it.ok ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30" : "border-red-500 bg-red-50 dark:bg-red-950/30"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="font-medium">
                    {it.ok ? "⭕" : "❌"} {it.label}
                  </div>
                  <span className="shrink-0 text-sm tabular-nums text-zinc-500">
                    {fmt(it.points)} / {fmt(it.max)}점
                  </span>
                </div>
                {it.kind === "narrative" ? (
                  <NarrativeResult n={g.narrative} />
                ) : it.kind === "evidence" ? (
                  <div className="mt-2 space-y-1 text-sm">
                    {g.evidence.length === 0 && <p className="text-zinc-500">제출한 증거 없음</p>}
                    {g.evidence.map((e, ei) => (
                      <p key={ei}>
                        {e.ok ? "⭕" : "❌"} {e.name} <span className="text-xs text-zinc-500">{e.ok ? "결정적 증거" : "결정적 증거 아님"}</span>
                      </p>
                    ))}
                    {g.missedKeys.length > 0 && (
                      <p className="pt-1 text-zinc-500">
                        놓친 결정적 증거: {g.missedKeys.map((k) => `${k.name}${k.found ? "" : " (못 찾음)"}`).join(", ")}
                      </p>
                    )}
                  </div>
                ) : (
                  <dl className="mt-2 grid grid-cols-[4rem_1fr] gap-y-0.5 text-sm">
                    <dt className="text-zinc-500">내 답</dt>
                    <dd className={it.ok ? "" : "line-through decoration-red-400"}>{it.mine}</dd>
                    <dt className="text-zinc-500">정답</dt>
                    <dd className="font-medium">{it.answer}</dd>
                  </dl>
                )}
              </div>
            ))}
            {g.hintPenalty > 0 && (
              <p className="flex justify-between px-1 text-sm text-zinc-500">
                <span>힌트 사용 {session.hintsUsed}회</span>
                <span>-{g.hintPenalty}점</span>
              </p>
            )}
            {g.stale && (
              <p className="rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-800/50">
                제출한 뒤 사건 내용이 다듬어져서, 항목별 내역은 지금 기준으로 보여 드려요. 점수와 결과는 제출할 때 그대로예요.
              </p>
            )}
          </div>
          <p className="mt-4 text-xs text-zinc-400">
            행동 {session.actionsUsed}회 · 단서 {session.foundClueIds.length} / {full.clues.length}개 발견 · 결정적 증거 {keyClues.filter((k) => found.has(k.id)).length} / {keyClues.length}개 발견
          </p>
        </section>
      )}

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-1 font-semibold">사건의 진상</h2>
        <p className="mb-4 text-sm text-zinc-500">범인: {culprit?.name}</p>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{c.truth}</p>

        <h3 className="mb-2 mt-6 text-sm font-semibold">결정적 증거</h3>
        <ul className="space-y-1.5 text-sm">
          {keyClues.map((k) => (
            <li key={k.id} className="flex items-start gap-2">
              <span>{found.has(k.id) ? "✅" : "⬜"}</span>
              <span>
                <b>{k.name}</b> — {k.description}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="space-y-2">
        {/* 다시 도전 (결과 보기는 지금 화면이므로 다시 도전만) */}
        <CaseActions caseId={c.id} ongoingId={null} lastFinishedId={null} loggedIn retryOnly />
        <div className="flex gap-2">
          <Link href={`/cases/${c.id}`} className="flex-1 rounded-xl border border-zinc-300 py-3 text-center text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
            사건 페이지로
          </Link>
          <Link href="/my/plays" className="flex-1 rounded-xl border border-zinc-300 py-3 text-center text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
            내 수사
          </Link>
          <Link href="/" className="flex-1 rounded-xl border border-zinc-300 py-3 text-center text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
            다른 사건
          </Link>
        </div>
      </div>
    </main>
  );
}
