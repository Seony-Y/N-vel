"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
}: {
  caseId: string;
  ongoingId: string | null;
  lastFinishedId: string | null;
  loggedIn: boolean;
  models?: ModelOption[]; // 넘기면 모델 선택 상자를 보여준다 (사건 페이지)
  defaultModel?: string;
  size?: "sm" | "lg";
  retryOnly?: boolean; // 결과 화면: 다시 도전 버튼만
  balance?: number; // 넘기면 잔액과 이 모델로 가능한 행동 수를 보여준다
}) {
  const router = useRouter();
  const [model, setModel] = useState(defaultModel);
  const [pending, setPending] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(restart: boolean) {
    if (!loggedIn) {
      router.push(`/login?next=${encodeURIComponent(`/cases/${caseId}`)}`);
      return;
    }
    setPending(true);
    setError(null);
    const res = await fetch("/api/play", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseId, model, restart }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "시작하지 못했습니다");
      setPending(false);
      return;
    }
    router.push(`/play/${body.sessionId}`);
  }

  const big = size === "lg";
  const primary = `whitespace-nowrap rounded-xl bg-red-600 font-semibold text-white hover:bg-red-700 disabled:opacity-60 ${big ? "flex-1 py-3" : "flex-1 px-3 py-2 text-sm"}`;
  const secondary = `whitespace-nowrap rounded-xl border border-zinc-300 font-medium hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800 ${big ? "px-4 py-3 text-sm" : "px-3 py-2 text-sm"}`;

  return (
    <div className="space-y-3">
      {confirmRestart ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
          <span className="flex-1">진행 중인 수사는 포기한 것으로 기록돼요. 처음부터 다시 할까요?</span>
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
              <button onClick={() => router.push(`/play/${ongoingId}`)} className={primary}>
                🔎 이어서 수사하기
              </button>
              <button onClick={() => setConfirmRestart(true)} disabled={pending} className={secondary}>
                처음부터
              </button>
            </>
          ) : lastFinishedId ? (
            <>
              <button onClick={() => router.push(`/play/${lastFinishedId}/result`)} className={secondary}>
                결과 보기
              </button>
              <button onClick={() => start(true)} disabled={pending} className={primary}>
                {pending ? "준비 중..." : "🔁 다시 도전"}
              </button>
            </>
          ) : (
            <button onClick={() => start(false)} disabled={pending} className={primary}>
              {pending ? "준비 중..." : loggedIn ? "수사 시작" : "로그인하고 수사 시작"}
            </button>
          )}
        </div>
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
