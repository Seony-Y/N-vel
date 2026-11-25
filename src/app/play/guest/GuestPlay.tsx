"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loading } from "@/components/Loading";
import { ShareResult } from "@/components/ShareResult";
import { SIGNUP_BONUS } from "@/lib/credits-config";
import type { PublicCase, PublicMessage, PublicState } from "@/lib/game/public";
import { ENDINGS } from "@/lib/game/endings";
import { type GuestDone, readGuestDone, readGuestPlay, writeGuestDone, writeGuestPlay } from "@/lib/guest-storage";
import { PlayScreen } from "../[id]/PlayScreen";

type Next = { id: string; title: string; estimatedMinutes: number } | null;
type Start = { state: PublicState; messages: PublicMessage[] };

const post = (action: string, body: unknown) => fetch(`/api/guest/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/** 비회원 프롤로그: 이 브라우저에 남은 진행 상황을 불러와 이어서 하고, 끝나면 결과와 가입 안내를 보여 준다 */
export function GuestPlay({ data, fresh, next }: { data: PublicCase; fresh: PublicState; next: Next }) {
  const [start, setStart] = useState<Start | null>(null);
  const [done, setDone] = useState<GuestDone | null>(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const finished = readGuestDone();
      if (finished?.caseId === data.id) return alive && setDone(finished);
      const first = data.locations[0];
      const begin: Start = { state: fresh, messages: first ? [{ id: "first", thread: "narrator", role: "event", content: `📍 ${first.name}\n${first.description}` }] : [] };
      const saved = readGuestPlay();
      const resumable = saved?.caseId === data.id;
      const res = await post(resumable ? "state" : "start", { save: resumable ? saved.save : {} }).catch(() => null);
      const body = res?.ok ? ((await res.json()) as { state: PublicState }) : null;
      if (alive) setStart(resumable && body ? { state: body.state, messages: saved.messages } : begin);
    })();
    return () => {
      alive = false;
    };
  }, [data, fresh, round]);

  function again() {
    writeGuestDone(null);
    writeGuestPlay(null);
    setDone(null);
    setStart(null);
    setRound((n) => n + 1);
  }

  if (done) return <GuestResultView title={data.title} done={done} next={next} onAgain={again} />;
  if (!start) return <Loading text="사건 파일을 펼치는 중..." />;
  return (
    <PlayScreen
      key={round}
      data={data}
      initialState={start.state}
      initialMessages={start.messages}
      initialCredits={0}
      models={[{ id: "none", label: "", description: "", credits: 0 }]}
      defaultModel="none"
      guest={{
        onProgress: (save, messages) => writeGuestPlay({ caseId: data.id, save, messages }),
        onDone: (save, accusation, result) => {
          const d: GuestDone = { caseId: data.id, save, messages: [], accusation, result };
          writeGuestPlay(null);
          writeGuestDone(d);
          setDone(d);
        },
      }}
    />
  );
}

function GuestResultView({ title, done, next, onAgain }: { title: string; done: GuestDone; next: Next; onAgain: () => void }) {
  const { result } = done;
  const signup = `/signup${next ? `?next=${encodeURIComponent(`/cases/${next.id}?start=1`)}` : ""}`;
  return (
    <main className="mx-auto w-full max-w-2xl space-y-5 px-4 py-6 sm:px-6">
      <section className={`rounded-2xl bg-gradient-to-br p-8 text-center text-white ${result.ending === "correct" ? "from-emerald-700 to-emerald-950" : result.ending === "partial" ? "from-amber-600 to-amber-950" : "from-zinc-700 to-zinc-950"}`}>
        <h1 className="text-3xl font-bold">
          {ENDINGS[result.ending].icon} {ENDINGS[result.ending].title}
        </h1>
        {result.ending !== "gaveup" && <p className="mt-3 text-5xl font-black">{result.score}점</p>}
      </section>

      <section className="rounded-2xl border-2 border-red-600 bg-white p-5 text-center dark:bg-zinc-900">
        <p className="font-bold">{next ? `다음 사건 「${next.title}」 · 약 ${next.estimatedMinutes}분` : "더 많은 사건이 기다리고 있어요"}</p>
        <p className="mt-1 text-sm text-zinc-500">
          여기부터는 하고 싶은 행동과 질문을 직접 써요. 가입하면 💎 {SIGNUP_BONUS} 크레딧을 드려요.
          {done.accusation && " 지금 결과도 내 기록으로 옮겨져요."}
        </p>
        <Link href={signup} className="mt-4 block rounded-xl bg-red-600 py-3 font-semibold text-white hover:bg-red-700">
          가입하고 다음 사건 풀기
        </Link>
      </section>

      {result.reveal.endingText && <p className="whitespace-pre-wrap rounded-2xl border border-zinc-200 bg-white p-6 leading-relaxed dark:border-zinc-800 dark:bg-zinc-900">{result.reveal.endingText}</p>}

      {result.items.length > 0 && (
        <ul className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-5 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          {result.items.map((it, i) => (
            <li key={i}>
              {it.ok ? "⭕" : "❌"} <b className="font-medium">{it.label}</b> — {it.mine}
              {!it.ok && it.answer && <span className="text-zinc-500"> (정답: {it.answer})</span>}
            </li>
          ))}
        </ul>
      )}

      <details className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm dark:border-zinc-800 dark:bg-zinc-900">
        <summary className="cursor-pointer font-semibold">사건의 진상 (범인: {result.reveal.culprit})</summary>
        <p className="mt-3 whitespace-pre-wrap leading-relaxed">{result.reveal.truth}</p>
      </details>

      <ShareResult
        path={`/cases/${done.caseId}`}
        title={title}
        endingLabel={`${ENDINGS[result.ending].icon} ${ENDINGS[result.ending].label}`}
        score={result.ending === "gaveup" ? null : result.score}
        marks={result.items.map((it) => it.ok)}
        actions={done.save.actionsUsed}
        hints={done.save.hintsUsed}
      />
      <div className="flex gap-2 text-sm">
        <button onClick={onAgain} className="flex-1 rounded-xl border border-zinc-300 py-3 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
          다시 하기
        </button>
        <Link href="/" className="flex-1 rounded-xl border border-zinc-300 py-3 text-center font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
          사건 목록
        </Link>
      </div>
    </main>
  );
}
