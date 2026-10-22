import { Suspense } from "react";
import { CaseCard } from "@/components/CaseCard";
import { SiteHeader } from "@/components/SiteHeader";
import { getUserId } from "@/lib/auth";
import { listPublicCases, myProgress } from "@/lib/game/catalog";

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

        <h2 className="mt-12 text-lg font-semibold">사건 파일</h2>
        <Suspense fallback={<p className="mt-4 text-sm text-zinc-400">불러오는 중...</p>}>
          <CaseList />
        </Suspense>
      </main>
    </div>
  );
}

async function CaseList() {
  const userId = await getUserId();
  const [list, progress] = await Promise.all([listPublicCases(), myProgress(userId)]);
  if (!list.length) return <p className="mt-4 text-sm text-zinc-400">아직 공개된 사건이 없어요.</p>;
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((c) => (
        <CaseCard key={c.id} c={c} progress={progress.get(c.id)} loggedIn={!!userId} />
      ))}
    </div>
  );
}

async function ByeNotice({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  if (!(await searchParams).bye) return null;
  return <p className="mb-6 rounded-xl bg-zinc-100 px-4 py-3 text-center text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">탈퇴가 완료됐어요. 그동안 이용해 주셔서 감사합니다.</p>;
}
