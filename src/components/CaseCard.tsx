import Link from "next/link";
import { CaseActions } from "@/components/CaseActions";
import type { CaseListItem, CaseProgress } from "@/lib/game/catalog";
import { ENDINGS } from "@/lib/game/endings";

export const RATING_LABEL: Record<string, string> = { all: "전체", "15": "15세", "19": "19세" };

export function Difficulty({ value }: { value: number }) {
  return (
    <span className="tracking-tighter text-amber-500" aria-label={`난이도 ${value}/5`}>
      {"★".repeat(value)}
      <span className="text-zinc-300 dark:text-zinc-700">{"★".repeat(5 - value)}</span>
    </span>
  );
}

/** 내 진행 상황 배지: 진행 중 / 해결 / 마지막 결과 */
export function ProgressBadge({ p }: { p: CaseProgress | undefined }) {
  if (!p) return null;
  const [text, cls] = p.ongoingId
    ? ["🔎 수사 중", "bg-blue-600 text-white"]
    : p.solved
      ? ["✅ 해결", "bg-emerald-600 text-white"]
      : p.lastFinished?.ending
        ? [`${ENDINGS[p.lastFinished.ending].icon} ${ENDINGS[p.lastFinished.ending].label}`, "bg-zinc-700 text-white"]
        : [null, ""];
  return text ? <span className={`rounded px-1.5 py-0.5 ${cls}`}>{text}</span> : null;
}

export function CaseCard({ c, progress, loggedIn }: { c: CaseListItem; progress?: CaseProgress; loggedIn: boolean }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white transition hover:border-red-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
      <Link href={`/cases/${c.id}`} className="group flex-1">
        <div className="relative h-36 bg-gradient-to-br from-zinc-800 via-zinc-900 to-red-950">
          {c.coverImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.coverImage} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover opacity-80" />
          )}
          <div className="absolute left-3 top-3 flex gap-1.5 text-[11px] font-semibold">
            {c.isOfficial && <span className="rounded bg-red-600 px-1.5 py-0.5 text-white">공식</span>}
            <span className="rounded bg-black/60 px-1.5 py-0.5 text-white">{RATING_LABEL[c.rating]}</span>
            <ProgressBadge p={progress} />
          </div>
          <div className="absolute bottom-3 left-3 right-3 text-lg font-bold text-white drop-shadow">{c.title}</div>
        </div>
        <div className="p-4 pb-3">
          <p className="line-clamp-2 text-sm text-zinc-600 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-200">{c.tagline}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
            <Difficulty value={c.difficulty} />
            <span>약 {c.estimatedMinutes}분</span>
            {c.warningTags.map((t) => (
              <span key={t} className="text-zinc-400">
                #{t}
              </span>
            ))}
          </div>
        </div>
      </Link>
      {/* 진행 상황에 맞는 버튼 (이어서 수사하기 / 결과 보기 + 다시 도전 / 수사 시작) */}
      <div className="px-4 pb-4">
        <CaseActions caseId={c.id} ongoingId={progress?.ongoingId ?? null} lastFinishedId={progress?.lastFinished?.id ?? null} loggedIn={loggedIn} size="sm" />
      </div>
    </div>
  );
}
