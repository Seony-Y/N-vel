import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Difficulty, RATING_LABEL } from "@/components/CaseCard";
import { CaseActions } from "@/components/CaseActions";
import { HideCase } from "@/components/admin/HideCase";
import { FavoriteButton } from "@/components/FavoriteButton";
import { SandboxedHtml } from "@/components/SandboxedHtml";
import { SiteHeader } from "@/components/SiteHeader";
import { Loading } from "@/components/Loading";
import { CHAT_MODELS, DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { getUserId, isAdmin } from "@/lib/auth";
import { getBalance } from "@/lib/credits";
import { myFavoriteIds, mySessionsFor } from "@/lib/game/catalog";
import { endingText } from "@/lib/game/endings";
import { canPlay, loadCase } from "@/lib/game/load";
import { publicCase } from "@/lib/game/public";
import { EFFICIENCY_HALF_RATIO, POINTS } from "@/lib/game/rules";

export default function CasePage({ params }: PageProps<"/cases/[id]">) {
  return (
    <>
      <SiteHeader />
      <Suspense fallback={<Loading />}>
        <CaseDetail params={params} />
      </Suspense>
    </>
  );
}

async function CaseDetail({ params }: { params: PageProps<"/cases/[id]">["params"] }) {
  const { id } = await params;
  const [userId, full] = await Promise.all([getUserId(), loadCase(id).catch(() => null)]);
  // 관리자는 숨긴 사건도 열어 볼 수 있다 (다시 보이게 하려고)
  if (!full || (!canPlay(full.case, userId) && !(await isAdmin(userId)))) notFound();

  const c = publicCase(full);
  const [sessions, balance, favorites] = await Promise.all([userId ? mySessionsFor(userId, id) : [], getBalance(userId), myFavoriteIds(userId)]);
  const ongoing = sessions.find((s) => s.status === "playing");
  const finished = sessions.filter((s) => s.status === "finished");
  const isOwner = !!userId && full.case.ownerId === userId;
  const admin = !isOwner && (await isAdmin(userId));

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      {full.case.hiddenAt && (isOwner || admin) && (
        <p className="mb-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
          🚫 관리자가 숨긴 사건이에요. 사건 목록에 보이지 않고 다른 사람은 플레이할 수 없어요.
          {full.case.hiddenReason && <span className="mt-0.5 block text-xs">이유: {full.case.hiddenReason}</span>}
          {isOwner && <span className="mt-0.5 block text-xs">내용을 고친 뒤 문의 메일로 알려 주시면 다시 확인해 드려요.</span>}
        </p>
      )}
      {(isOwner || admin) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-zinc-100 px-4 py-2.5 text-sm dark:bg-zinc-800">
          <span>{admin ? "🛡 관리자" : full.case.isPublic ? "🌐 공개 중인 내 사건" : "🔒 비공개 사건 (나만 볼 수 있어요)"}</span>
          <span className="flex items-center gap-3">
            {admin && <HideCase caseId={id} hidden={!!full.case.hiddenAt} size="md" />}
            <Link href={`/cases/${id}/answer`} className="font-medium text-red-600 hover:underline">
              정답지
            </Link>
            {isOwner && (
              <Link href={`/cases/${id}/edit`} className="font-medium text-red-600 hover:underline">
                수정하기
              </Link>
            )}
          </span>
        </div>
      )}
      <article className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {c.introHtml ? (
          <SandboxedHtml title={`${c.title} 소개`} code={c.introHtml} className="h-80 w-full border-0" />
        ) : (
          <div className="bg-gradient-to-br from-zinc-800 via-zinc-900 to-red-950 px-6 py-10 text-white">
            <div className="flex gap-1.5 text-[11px] font-semibold">
              {c.isOfficial && <span className="rounded bg-red-600 px-1.5 py-0.5">공식</span>}
              <span className="rounded bg-white/20 px-1.5 py-0.5">{RATING_LABEL[c.rating]}</span>
            </div>
            <h1 className="mt-3 text-3xl font-bold">{c.title}</h1>
            <p className="mt-2 text-zinc-300">{c.tagline}</p>
          </div>
        )}

        <div className="space-y-6 p-6">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500">
            <span>
              난이도 <Difficulty value={c.difficulty} />
            </span>
            <span>약 {c.estimatedMinutes}분</span>
            {c.targetActions && <span>🎯 목표 행동 {c.targetActions}회</span>}
            {c.warningTags.map((t) => (
              <span key={t}>#{t}</span>
            ))}
            <span className="ml-auto">
              <FavoriteButton caseId={id} initial={favorites.has(id)} loggedIn={!!userId} variant="text" />
            </span>
          </div>
          {c.targetActions && (
            <p className="-mt-3 rounded-lg bg-zinc-50 px-3 py-2 text-xs leading-relaxed text-zinc-500 dark:bg-zinc-800/50">
              🎯 <b className="font-medium">행동</b>은 장소를 조사하거나, 용의자에게 질문하거나, 증거를 제시할 때마다 1회로 세요 (비밀번호를 틀려도 1회). 장소 이동, 수첩, 힌트는 세지 않아요.
              횟수에 제한은 없고, 범인을 맞히면서 {c.targetActions}회 안에 풀면 효율 보너스 +{POINTS.efficiency}점, {Math.floor(c.targetActions * EFFICIENCY_HALF_RATIO)}회 안이면 +{POINTS.efficiency / 2}점을 받아요.
            </p>
          )}

          <section>
            <h2 className="mb-2 text-sm font-semibold text-zinc-500">사건 개요</h2>
            <p className="whitespace-pre-wrap leading-relaxed">{c.briefing}</p>
          </section>

          {c.victim && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-zinc-500">피해자</h2>
              <p className="leading-relaxed">{c.victim}</p>
            </section>
          )}

          <section>
            <h2 className="mb-2 text-sm font-semibold text-zinc-500">용의자</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {c.suspects.map((s) => (
                <li key={s.id} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                  <div className="font-medium">
                    {s.name}
                    {s.age && <span className="ml-1 text-sm font-normal text-zinc-400">{s.age}세</span>}
                  </div>
                  <div className="text-xs text-zinc-500">{s.role}</div>
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">{s.profile}</p>
                </li>
              ))}
            </ul>
          </section>

          {finished.some((s) => s.ending === "correct") && <p className="text-sm font-medium text-emerald-600">✅ 해결한 사건이에요. 다시 도전해서 더 높은 점수를 노려 보세요.</p>}
          {/* 대본 사건(프롤로그)은 AI 를 쓰지 않으므로 모델·크레딧 안내 대신 무료 표시 */}
          {full.case.isOfficial && full.case.script.length > 0 && <p className="text-sm font-medium text-emerald-600">🎁 무료 사건이에요. 정해진 선택지로 진행하고 크레딧을 쓰지 않아요.</p>}
          <CaseActions
            caseId={id}
            ongoingId={ongoing?.id ?? null}
            lastFinishedId={finished[0]?.id ?? null}
            loggedIn={!!userId}
            {...(!(full.case.isOfficial && full.case.script.length) && { models: CHAT_MODELS.map(({ id, label, credits }) => ({ id, label, credits })), balance })}
            defaultModel={DEFAULT_CHAT_MODEL}
          />

          {finished.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-zinc-500">내 기록 ({finished.length}회)</h2>
              <ul className="space-y-1 text-sm">
                {finished.map((s) => (
                  <li key={s.id}>
                    {/* 한 줄로: 좁은 화면에서는 '결과 보기' 글자를 빼고 › 만 */}
                    <Link href={`/play/${s.id}/result`} className="flex items-center justify-between gap-3 whitespace-nowrap rounded-lg px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                      <span className="text-zinc-500">{s.updatedAt.toLocaleDateString("ko-KR")}</span>
                      <span>
                        {endingText(s.ending)}
                        {s.ending !== "gaveup" && ` · ${s.score}점`}
                        <span className="ml-2 text-zinc-400">
                          <span className="hidden sm:inline">결과 보기 </span>›
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </article>
    </main>
  );
}
