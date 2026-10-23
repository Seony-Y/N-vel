import Link from "next/link";
import { Suspense } from "react";
import { CaseActions } from "@/components/CaseActions";
import { CaseCard } from "@/components/CaseCard";
import { SiteHeader } from "@/components/SiteHeader";
import { getUserId } from "@/lib/auth";
import { CASE_SORTS, type CaseListItem, type CaseSort, findPrologue, listPublicCases, myFavoriteIds, myProgress } from "@/lib/game/catalog";

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        <Suspense>
          <ByeNotice searchParams={searchParams} />
        </Suspense>
        <section className="text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">진실은 단서 속에 있다</h1>
          <p className="mt-3 text-zinc-500 dark:text-zinc-400">현장을 조사하고, 용의자를 심문하고, 범인을 지목하세요.</p>
        </section>

        <Suspense fallback={<p className="mt-12 text-sm text-zinc-400">불러오는 중...</p>}>
          <CaseList searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

async function CaseList({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const { sort: raw } = await searchParams;
  const sort: CaseSort = typeof raw === "string" && raw in CASE_SORTS ? (raw as CaseSort) : "recommended";
  const userId = await getUserId();
  const [list, progress, favorites, prologue] = await Promise.all([listPublicCases(sort), myProgress(userId), myFavoriteIds(userId), findPrologue()]);

  // 프롤로그를 끝내기 전(처음 가입했거나 아직 추리를 제출하지 않음)에는 목록과 따로 맨 위에 보여 준다
  const showPrologue = prologue && !progress.get(prologue.id)?.submitted;
  const rest = showPrologue ? list.filter((c) => c.id !== prologue.id) : list;

  return (
    <>
      {showPrologue && <PrologueBanner c={prologue} ongoingId={progress.get(prologue.id)?.ongoingId ?? null} loggedIn={!!userId} />}

      <div className="mt-12 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">사건 파일</h2>
        <nav className="flex rounded-lg bg-zinc-100 p-1 text-sm dark:bg-zinc-800" aria-label="정렬">
          {(Object.keys(CASE_SORTS) as CaseSort[]).map((k) => (
            <Link
              key={k}
              href={k === "recommended" ? "/" : `/?sort=${k}`}
              scroll={false}
              aria-current={sort === k ? "page" : undefined}
              className={`rounded-md px-3 py-1 ${sort === k ? "bg-white font-medium shadow-sm dark:bg-zinc-900" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"}`}
            >
              {CASE_SORTS[k]}
            </Link>
          ))}
        </nav>
      </div>

      {rest.length ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((c) => (
            <CaseCard key={c.id} c={c} progress={progress.get(c.id)} loggedIn={!!userId} favorite={favorites.has(c.id)} />
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-zinc-400">아직 공개된 사건이 없어요.</p>
      )}
    </>
  );
}

function PrologueBanner({ c, ongoingId, loggedIn }: { c: CaseListItem; ongoingId: string | null; loggedIn: boolean }) {
  return (
    <section className="mt-10 rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-5 sm:flex sm:items-center sm:gap-6 dark:bg-emerald-950/30">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">🧭 처음이라면 여기서부터{c.isFree && " · 🎁 무료"}</p>
        <Link href={`/cases/${c.id}`} className="mt-1 block text-xl font-bold hover:text-red-600">
          {c.title}
        </Link>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{c.tagline}</p>
      </div>
      <div className="mt-4 shrink-0 sm:mt-0 sm:w-64">
        <CaseActions caseId={c.id} ongoingId={ongoingId} lastFinishedId={null} loggedIn={loggedIn} />
      </div>
    </section>
  );
}

async function ByeNotice({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  if (!(await searchParams).bye) return null;
  return <p className="mb-6 rounded-xl bg-zinc-100 px-4 py-3 text-center text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">탈퇴가 완료됐어요. 그동안 이용해 주셔서 감사합니다.</p>;
}
