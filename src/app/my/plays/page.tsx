import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CaseActions } from "@/components/CaseActions";
import { FavoriteButton } from "@/components/FavoriteButton";
import { SiteHeader } from "@/components/SiteHeader";
import { Loading } from "@/components/Loading";
import { requireUserId } from "@/lib/auth";
import { emptyProgress, myFavoriteCases, myPlayedCases } from "@/lib/game/catalog";
import { endingText } from "@/lib/game/endings";

export const metadata: Metadata = { title: "내 수사 | N-vel" };

export default function MyPlaysPage({ searchParams }: PageProps<"/my/plays">) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-bold">내 수사</h1>
        <Suspense fallback={<Loading />}>
          <MyPlays searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

type Played = Awaited<ReturnType<typeof myPlayedCases>>[number];

const TABS = { plays: "🔎 내 수사", favorites: "⭐ 즐겨찾기" } as const;
type Tab = keyof typeof TABS;

async function MyPlays({ searchParams }: { searchParams: PageProps<"/my/plays">["searchParams"] }) {
  const tab: Tab = (await searchParams).tab === "favorites" ? "favorites" : "plays";
  const userId = await requireUserId(tab === "favorites" ? "/my/plays?tab=favorites" : "/my/plays");
  const [list, favs] = await Promise.all([myPlayedCases(userId), myFavoriteCases(userId)]);
  const favIds = new Set(favs.map((c) => c.id));
  const counts: Record<Tab, number> = { plays: list.length, favorites: favs.length };

  // 같은 사건이 두 탭에 모두 나올 수 있다. 즐겨찾기 탭에는 아직 수사하지 않은 사건도 보여 준다
  let body: React.ReactNode;
  if (tab === "favorites") {
    const progressOf = new Map(list.map((c) => [c.id, c.progress]));
    const favorites = favs.map((c) => ({ ...c, progress: progressOf.get(c.id) ?? emptyProgress(c.id) }));
    body = favorites.length ? (
      <Group title="즐겨찾기한 사건" hint="최근에 즐겨찾기한 순서예요. 사건 카드의 ☆ 를 눌러 추가할 수 있어요" items={favorites} favIds={favIds} />
    ) : (
      <Empty text="아직 즐겨찾기한 사건이 없어요. 사건 카드의 ☆ 를 눌러 추가해 보세요." />
    );
  } else {
    const ongoing = list.filter((c) => c.progress.ongoingId);
    const solved = list.filter((c) => !c.progress.ongoingId && c.progress.solved);
    const unsolved = list.filter((c) => !c.progress.ongoingId && !c.progress.solved);
    body = list.length ? (
      <>
        <Group title="🔎 수사 중" hint="이어서 수사할 수 있어요" items={ongoing} favIds={favIds} />
        <Group title="✅ 해결한 사건" hint="결과와 정답을 다시 보거나, 다시 도전할 수 있어요" items={solved} favIds={favIds} />
        <Group title="📁 해결하지 못한 사건" hint="부분 해결·미제·포기한 사건. 다시 도전해 보세요" items={unsolved} favIds={favIds} />
      </>
    ) : (
      <Empty text="아직 수사한 사건이 없어요." />
    );
  }

  return (
    <>
      <nav className="mt-4 flex gap-1 border-b border-zinc-200 dark:border-zinc-800" aria-label="내 수사 보기">
        {(Object.keys(TABS) as Tab[]).map((t) => (
          <Link
            key={t}
            href={t === "plays" ? "/my/plays" : "/my/plays?tab=favorites"}
            aria-current={tab === t ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === t ? "border-red-600 font-semibold" : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"}`}
          >
            {TABS[t]} <span className="text-xs text-zinc-400">{counts[t]}</span>
          </Link>
        ))}
      </nav>
      <div className="mt-6 space-y-8">{body}</div>
    </>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="mt-10 text-center text-zinc-500">
      <p>{text}</p>
      <Link href="/" className="mt-3 inline-block font-medium text-red-600 hover:underline">
        사건 목록 보기
      </Link>
    </div>
  );
}

function Group({ title, hint, items, favIds }: { title: string; hint: string; items: Played[]; favIds: Set<string> }) {
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
                <div className="flex items-center gap-2">
                  <Link href={`/cases/${c.id}`} className="font-semibold hover:text-red-600">
                    {c.title}
                  </Link>
                  <FavoriteButton caseId={c.id} initial={favIds.has(c.id)} loggedIn variant="text" />
                </div>
                <p className="mt-0.5 text-sm text-zinc-500">
                  {c.progress.ongoingId
                    ? "수사 진행 중"
                    : last
                      ? `최근 결과 ${endingText(last.ending)}${last.ending !== "gaveup" ? ` · ${last.score}점 · 일치율 ${last.matchRate ?? 0}%` : ""}`
                      : "아직 수사하지 않았어요"}
                  {c.progress.attempts > 0 && <span className="text-zinc-400"> · 도전 {c.progress.attempts}회</span>}
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
