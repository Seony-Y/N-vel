import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { RATING_LABEL } from "@/components/CaseCard";
import { SiteHeader } from "@/components/SiteHeader";
import { Loading } from "@/components/Loading";
import { requireUserId } from "@/lib/auth";
import { listMyCases } from "@/lib/game/catalog";

export const metadata: Metadata = { title: "내 사건 | N-vel" };

export default function MyCasesPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">내가 만든 사건</h1>
          <Link href="/cases/new" className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
            + 사건 만들기
          </Link>
        </div>
        <Suspense fallback={<Loading />}>
          <MyCases />
        </Suspense>
      </main>
    </>
  );
}

async function MyCases() {
  const userId = await requireUserId("/my/cases");
  const list = await listMyCases(userId);
  if (!list.length) {
    return (
      <div className="mt-10 flex flex-col items-center rounded-2xl border border-dashed border-zinc-300 px-6 py-12 text-center dark:border-zinc-700">
        <p className="text-4xl" aria-hidden>
          🗂
        </p>
        <p className="mt-3 font-medium">아직 만든 사건이 없어요</p>
        <p className="mt-1 text-sm text-zinc-500">예시 사건을 불러와서 고치는 것부터 시작할 수 있어요.</p>
        <Link href="/cases/new" className="mt-5 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700">
          첫 사건 만들기
        </Link>
      </div>
    );
  }
  return (
    <ul className="mt-6 divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
      {list.map((c) => (
        <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">{c.title}</span>
              <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800">{RATING_LABEL[c.rating]}</span>
              {c.hiddenAt ? (
                <span className="shrink-0 text-[11px] text-red-600" title={c.hiddenReason || undefined}>
                  🚫 관리자가 숨김
                </span>
              ) : (
                <span className={`shrink-0 text-[11px] ${c.isPublic ? "text-emerald-600" : "text-zinc-400"}`}>{c.isPublic ? "🌐 공개" : "🔒 비공개"}</span>
              )}
            </div>
            <p className="text-xs text-zinc-400">
              수정 {c.updatedAt.toLocaleDateString("ko-KR")}
              {c.hiddenAt && c.hiddenReason && <span className="text-red-500"> · 숨긴 이유: {c.hiddenReason}</span>}
            </p>
          </div>
          <div className="flex shrink-0 gap-2 text-sm">
            <Link href={`/cases/${c.id}`} className="rounded-lg border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
              플레이
            </Link>
            <Link href={`/cases/${c.id}/edit`} className="rounded-lg bg-zinc-900 px-3 py-1.5 text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900">
              수정
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
