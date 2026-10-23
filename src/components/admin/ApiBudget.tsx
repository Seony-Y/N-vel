"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatUsd } from "@/lib/ai/models";

type Topup = { id: number; amountMicros: number; note: string; chargedAt: Date };

/** 관리자: Anthropic 충전 기록과 남은 예상 금액 */
export function ApiBudget({
  topups,
  chargedMicros,
  usedMicros,
  remainingMicros,
  from,
  burnPerDay,
}: {
  topups: Topup[];
  chargedMicros: number;
  usedMicros: number;
  remainingMicros: number;
  from: Date | null;
  burnPerDay: number;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(init: RequestInit, url = "/api/admin/topups") {
    setPending(true);
    setError(null);
    const res = await fetch(url, init).catch(() => null);
    setPending(false);
    if (!res?.ok) {
      setError((await res?.json().catch(() => ({})))?.error ?? "실패했습니다");
      return false;
    }
    router.refresh();
    return true;
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (await call({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amountUsd: Number(amount), note }) })) {
      setAmount("");
      setNote("");
    }
  }

  const ratio = chargedMicros ? remainingMicros / chargedMicros : 0;
  const low = topups.length > 0 && ratio < 0.1;
  const daysLeft = burnPerDay > 0 && remainingMicros > 0 ? Math.floor(remainingMicros / burnPerDay) : null;
  const field = "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";

  return (
    <div className="space-y-4 p-4">
      {topups.length ? (
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
          <div>
            <p className="text-xs text-zinc-500">남은 예상 금액</p>
            <p className={`text-3xl font-semibold tabular-nums ${low ? "text-red-600 dark:text-red-400" : "text-zinc-900 dark:text-zinc-100"}`}>
              {low && "⚠ "}
              {formatUsd(remainingMicros)}
            </p>
          </div>
          <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-sm">
            <dt className="text-zinc-500">충전 합계</dt>
            <dd className="text-right tabular-nums">{formatUsd(chargedMicros)}</dd>
            <dt className="text-zinc-500">사용 (첫 기록 이후)</dt>
            <dd className="text-right tabular-nums">{formatUsd(usedMicros)}</dd>
            <dt className="text-zinc-500">최근 하루 평균</dt>
            <dd className="text-right tabular-nums">
              {formatUsd(burnPerDay)}
              {daysLeft !== null && <span className="ml-1 text-xs text-zinc-500">(약 {daysLeft.toLocaleString()}일 남음)</span>}
            </dd>
          </dl>
          {/* 남은 비율 막대 */}
          <div className="min-w-48 flex-1">
            <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div className={`h-full ${low ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${Math.max(0, Math.min(100, ratio * 100))}%` }} />
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              {Math.max(0, Math.round(ratio * 100))}% 남음 · {from?.toLocaleDateString("ko-KR")}부터 계산
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">아직 충전 기록이 없어요. 처음에는 Anthropic 콘솔(Billing)에 보이는 지금 잔액을 기록하면, 그때부터 쓴 금액을 빼서 남은 금액을 계산해요.</p>
      )}

      <form onSubmit={add} className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-zinc-500">$</span>
        <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="충전 금액 (달러)" required className={`${field} w-40`} />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="메모 (예: 콘솔 잔액 기준 시작, 10월 충전)" maxLength={200} className={`${field} min-w-48 flex-1`} />
        <button type="submit" disabled={pending || !amount} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900">
          {pending ? "처리 중..." : "충전 기록"}
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {topups.length > 0 && (
        <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
          {topups.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-1.5">
              <span className="w-24 shrink-0 text-zinc-500">{new Date(t.chargedAt).toLocaleDateString("ko-KR")}</span>
              <span className="w-24 shrink-0 text-right tabular-nums">{formatUsd(t.amountMicros)}</span>
              <span className="min-w-0 flex-1 truncate text-zinc-500">{t.note}</span>
              <button
                type="button"
                disabled={pending}
                onClick={() => call({ method: "DELETE" }, `/api/admin/topups?id=${t.id}`)}
                className="shrink-0 rounded-md px-2 py-0.5 text-xs text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                aria-label="충전 기록 지우기"
              >
                지우기
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
