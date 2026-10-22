import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CaseActions } from "@/components/CaseActions";
import { SiteHeader } from "@/components/SiteHeader";
import { requireUserId } from "@/lib/auth";
import { myPlayedCases } from "@/lib/game/catalog";
import { endingText } from "@/lib/game/endings";

export const metadata: Metadata = { title: "내 수사 | N-vel" };

export default function MyPlaysPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-bold">내 수사</h1>
        <Suspense fallback={<p className="mt-8 text-sm text-zinc-400">불러오는 중...</p>}>
          <MyPlays />
        </Suspense>
      </main>
    </>
  );
}

type Played = Awaited<ReturnType<typeof myPlayedCases>>[number];

async function MyPlays() {
  const userId = await requireUserId("/my/plays");
  const list = await myPlayedCases(userId);

  if (!list.length) {
    return (
      <div className="mt-16 text-center text-zinc-500">
        <p>아직 수사한 사건이 없어요.</p>
        <Link href="/" className="mt-3 inline-block font-medium text-red-600 hover:underline">
          사건 목록 보기
        </Link>
      </div>
    );
  }

  const ongoing = list.filter((c) => c.progress.ongoingId);
  const solved = list.filter((c) => !c.progress.ongoingId && c.progress.solved);
  const unsolved = list.filter((c) => !c.progress.ongoingId && !c.progress.solved);

  return (
    <div className="mt-6 space-y-8">
      <Group title="🔎 수사 중" hint="이어서 수사할 수 있어요" items={ongoing} />
      <Group title="✅ 해결한 사건" hint="결과와 정답을 다시 보거나, 다시 도전할 수 있어요" items={solved} />
      <Group title="📁 해결하지 못한 사건" hint="부분 해결·미제·포기한 사건. 다시 도전해 보세요" items={unsolved} />
    </div>
  );
}

function Group({ title, hint, items }: { title: string; hint: string; items: Played[] }) {
  if (!items.length) return null;
  return (
    <section>
      <h2 className="font-semibold">
        {title} <span className="text-sm font-normal text-zinc-400">{items.length}</span>
      </h2>
      <p className="mb-3 text-sm text-zinc-500">{hint}</p>
      <ul className="space-y-3">
        {items.map((c) => {
          const last = c.progress.lastFinished;
          return (
            <li key={c.id} className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:flex-row sm:items-center dark:border-zinc-800 dark:bg-zinc-900">
              <div className="min-w-0 flex-1">
                <Link href={`/cases/${c.id}`} className="font-semibold hover:text-red-600">
                  {c.title}
                </Link>
                <p className="mt-0.5 text-sm text-zinc-500">
                  {c.progress.ongoingId
                    ? "수사 진행 중"
                    : last
                      ? `최근 결과 ${endingText(last.ending)}${last.ending !== "gaveup" ? ` · ${last.score}점 · 일치율 ${last.matchRate ?? 0}%` : ""}`
                      : ""}
                  <span className="text-zinc-400"> · 도전 {c.progress.attempts}회</span>
                </p>
              </div>
              <div className="sm:w-72">
                <CaseActions caseId={c.id} ongoingId={c.progress.ongoingId} lastFinishedId={last?.id ?? null} loggedIn size="sm" />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
