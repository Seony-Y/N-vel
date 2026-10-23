import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AnswerSheet } from "@/components/AnswerSheet";
import { SiteHeader } from "@/components/SiteHeader";
import { Loading } from "@/components/Loading";
import { isAdmin, requireUserId } from "@/lib/auth";
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
      <AnswerSheet full={full} />
    </main>
  );
}
