import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AnswerSheet } from "@/components/AnswerSheet";
import { SiteHeader } from "@/components/SiteHeader";
import { Loading } from "@/components/Loading";
import { isAdmin, requireUserId } from "@/lib/auth";
import { ratingSummary } from "@/lib/feedback";
import { LENGTHS, LEVELS } from "@/lib/feedback-config";
import { loadCase } from "@/lib/game/load";

export const metadata: Metadata = { title: "정답지 | N-vel" };

export default function AnswerPage({ params }: PageProps<"/cases/[id]/answer">) {
  return (
    <>
      <SiteHeader />
      <Suspense fallback={<Loading />}>
        <Answer params={params} />
      </Suspense>
    </>
  );
}

async function Answer({ params }: { params: PageProps<"/cases/[id]/answer">["params"] }) {
  const { id } = await params;
  const userId = await requireUserId(`/cases/${id}/answer`);
  const full = await loadCase(id).catch(() => null);
  // 만든 사람 또는 관리자만. 그 외에는 정답지가 있다는 것도 숨긴다
  if (!full) notFound();
  const owner = full.case.ownerId === userId;
  if (!owner && !(await isAdmin(userId))) notFound();

  const r = await ratingSummary(id);
  const tally = (labels: Record<string, string>, n: Record<string, number | undefined>) => Object.entries(labels).map(([k, label]) => `${label} ${n[k] ?? 0}`).join(" · ");

  return (
    <main className="mx-auto w-full max-w-4xl space-y-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm text-zinc-500">{owner ? "내 사건" : "관리자 열람"} · 정답지</p>
          <h1 className="text-2xl font-bold">{full.case.title}</h1>
        </div>
        <div className="flex gap-2 text-sm">
          <Link href={`/cases/${id}`} className="rounded-lg border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
            사건 페이지
          </Link>
          {owner && (
            <Link href={`/cases/${id}/edit`} className="rounded-lg bg-zinc-900 px-3 py-1.5 text-white dark:bg-white dark:text-zinc-900">
              수정
            </Link>
          )}
        </div>
      </div>
      <p className="rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">⚠️ 스포일러가 담긴 화면이에요. 플레이어에게 공유하지 마세요.</p>
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-semibold">⭐ 받은 평가</h2>
        {r.count === 0 ? (
          <p className="mt-2 text-zinc-500">아직 평가가 없어요.</p>
        ) : (
          <>
            <p className="mt-2">
              ★ {r.stars?.toFixed(1)} ({r.count}명)
            </p>
            <p className="mt-1 text-zinc-500">난이도: {tally(LEVELS, r.level)}</p>
            <p className="text-zinc-500">길이: {tally(LENGTHS, r.length)}</p>
            <ul className="mt-3 space-y-1.5">
              {r.comments.map((c, i) => (
                <li key={i} className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50">
                  ★ {c.stars} · {c.comment}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      <AnswerSheet full={full} />
    </main>
  );
}
