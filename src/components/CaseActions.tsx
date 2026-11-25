"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useState, useTransition } from "react";

export interface ModelOption {
  id: string;
  label: string;
  credits: number;
}

/**
 * 사건마다 내 진행 상황에 맞는 버튼.
 *   진행 중     → 이어서 수사하기 (+ 처음부터)
 *   끝난 기록   → 결과 보기 + 다시 도전
 *   처음        → 수사 시작
 * 사건 목록 카드, 사건 페이지, 내 수사 화면에서 함께 쓴다.
 */
export function CaseActions({
  caseId,
  ongoingId,
  lastFinishedId,
  loggedIn,
  models,
  defaultModel,
  size = "lg",
  retryOnly = false,
  balance,
  guestFree = false,
  autoStart = false,
}: {
  caseId: string;
  ongoingId: string | null;
  lastFinishedId: string | null;
  loggedIn: boolean;
  models?: ModelOption[]; // 넘기면 모델 선택 상자를 보여준다 (사건 페이지)
  defaultModel?: string;
  size?: "sm" | "lg";
  retryOnly?: boolean; // 결과 화면: 다시 도전 버튼만
  guestFree?: boolean; // 로그인 없이 할 수 있는 사건 (프롤로그)
  autoStart?: boolean; // 로그인하고 돌아왔을 때 바로 시작
  balance?: number; // 넘기면 잔액과 이 모델로 가능한 행동 수를 보여준다
}) {
  const router = useRouter();
  const [model, setModel] = useState(defaultModel);
  const [mode, setMode] = useState<"easy" | "hard">("easy");
  const [starting, setPending] = useState(false);
  const [moving, startMove] = useTransition(); // 화면이 넘어가는 동안
  const pending = starting || moving;
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = (href: string) => startMove(() => router.push(href));

  async function start(restart: boolean, replace = false) {
    if (!loggedIn) {
      go(guestFree ? "/play/guest" : `/login?next=${encodeURIComponent(`/cases/${caseId}?start=1`)}`);
      return;
    }
    setPending(true);
    setError(null);
    const res = await fetch("/api/play", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseId, model, mode, restart }),
    }).catch(() => null);
    const body = await res?.json().catch(() => ({}));
    if (!res?.ok) {
      setError(body?.error ?? "시작하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요");
      setPending(false);
      return;
    }
    // 로그인 뒤 바로 시작한 경우: 뒤로 가기로 다시 시작되지 않도록 이 주소를 바꿔 둔다
    if (replace) startMove(() => router.replace(`/play/${body.sessionId}`));
    else go(`/play/${body.sessionId}`);
    setPending(false);
  }

  const onAutoStart = useEffectEvent(() => {
    if (autoStart && loggedIn && !lastFinishedId) start(false, true);
  });
  useEffect(() => {
    const t = setTimeout(onAutoStart, 0);
    return () => clearTimeout(t);
  }, []);

  const big = size === "lg";
  const primary = `whitespace-nowrap rounded-xl bg-red-600 font-semibold text-white hover:bg-red-700 disabled:opacity-60 ${big ? "flex-1 py-3" : "flex-1 px-3 py-2 text-sm"}`;
  const secondary = `whitespace-nowrap rounded-xl border border-zinc-300 font-medium hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800 ${big ? "px-4 py-3 text-sm" : "px-3 py-2 text-sm"}`;

  return (
    <div className="space-y-3">
      {confirmRestart ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
          <span className="flex-1">지금까지의 수사 기록은 지워지고 처음부터 시작해요. 다시 할까요?</span>
          <button onClick={() => setConfirmRestart(false)} className="rounded-lg px-3 py-1.5 hover:bg-white/60 dark:hover:bg-zinc-800">
            취소
          </button>
          <button onClick={() => start(true)} disabled={pending} className="rounded-lg bg-red-600 px-3 py-1.5 font-semibold text-white disabled:opacity-60">
            처음부터
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          {retryOnly ? (
            <button onClick={() => start(true)} disabled={pending} className={primary}>
              {pending ? "준비 중..." : "🔁 다시 도전"}
            </button>
          ) : ongoingId ? (
            <>
              <button onClick={() => go(`/play/${ongoingId}`)} disabled={pending} className={primary}>
                {pending ? "여는 중..." : "🔎 이어서 수사하기"}
              </button>
              <button onClick={() => setConfirmRestart(true)} disabled={pending} className={secondary}>
                처음부터
              </button>
            </>
          ) : lastFinishedId ? (
            <>
              <button onClick={() => go(`/play/${lastFinishedId}/result`)} disabled={pending} className={secondary}>
                결과 보기
              </button>
              <button onClick={() => start(true)} disabled={pending} className={primary}>
                {pending ? "준비 중..." : "🔁 다시 도전"}
              </button>
            </>
          ) : (
            <button onClick={() => start(false)} disabled={pending} className={primary}>
              {pending ? "준비 중..." : loggedIn ? "수사 시작" : guestFree ? "로그인 없이 바로 시작" : "로그인하고 수사 시작"}
            </button>
          )}
        </div>
      )}

      {loggedIn && models && (!ongoingId || confirmRestart) && (
        <fieldset className="grid grid-cols-2 gap-2 text-sm">
          <legend className="sr-only">난이도</legend>
          {(
            [
              ["easy", "🙂 쉬움", "막히면 다음에 할 일을 무료로 알려 줘요"],
              ["hard", "🔥 어려움", "안내 없이 혼자 풀어요"],
            ] as const
          ).map(([id, label, hint]) => (
            <label key={id} className={`cursor-pointer rounded-xl border-2 px-3 py-2 ${mode === id ? "border-red-600 bg-red-50 dark:bg-red-950/30" : "border-zinc-200 dark:border-zinc-700"}`}>
              <input type="radio" name="mode" className="sr-only" checked={mode === id} onChange={() => setMode(id)} />
              <span className="font-medium">{label}</span>
              <span className="block text-xs text-zinc-500">{hint}</span>
            </label>
          ))}
        </fieldset>
      )}
      {loggedIn && models && (!ongoingId || confirmRestart) && (
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="text-zinc-500">AI 모델</span>
          <select value={model} onChange={(e) => setModel(e.target.value)} className="rounded-lg border border-zinc-300 bg-white py-1.5 pl-3 outline-none focus:outline-none dark:border-zinc-700 dark:bg-zinc-900">
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} (행동당 {m.credits}크레딧)
              </option>
            ))}
          </select>
        </label>
      )}
      {loggedIn && balance !== undefined && models && (
        <BalanceHint balance={balance} perAction={models.find((m) => m.id === model)?.credits ?? 1} />
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function BalanceHint({ balance, perAction }: { balance: number; perAction: number }) {
  const actions = Math.floor(balance / perAction);
  return (
    <p className={`text-right text-xs ${actions === 0 ? "font-medium text-red-600" : "text-zinc-500"}`}>
      💎 {balance.toLocaleString()} 크레딧 · 이 모델로 약 {actions.toLocaleString()}회 행동 가능
      {actions === 0 && (
        <>
          {" "}
          (크레딧이 부족해요. 더 저렴한 모델을 고르거나{" "}
          <Link href="/my/credits#request" className="underline underline-offset-2">
            크레딧을 요청
          </Link>
          해 주세요)
        </>
      )}
    </p>
  );
}
