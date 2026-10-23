"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Latest = { status: "pending" | "granted" | "dismissed"; amount: number | null; createdAt: Date; resolvedAt: Date | null } | null;

const day = (d: Date) => new Date(d).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });

/** 크레딧 요청 (유료 충전이 없는 동안 관리자가 지급). 처리 안 된 요청이 있으면 기다리라고 보여 준다 */
export function CreditRequestBox({ latest }: { latest: Latest }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    const res = await fetch("/api/credits/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) }).catch(() => null);
    setPending(false);
    if (!res?.ok) return setError((await res?.json().catch(() => ({})))?.error ?? "요청을 보내지 못했어요. 잠시 후 다시 시도해 주세요");
    setMessage("");
    router.refresh();
  }

  if (latest?.status === "pending") {
    return (
      <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
        ⏳ {day(latest.createdAt)}에 크레딧을 요청했어요. 관리자가 확인하면 지급되고, 이 페이지의 사용 내역에 표시돼요.
      </p>
    );
  }

  return (
    <form onSubmit={send} className="space-y-2">
      {latest?.status === "granted" && (
        <p className="text-xs text-emerald-600">
          지난 요청({day(latest.createdAt)})에 💎 {latest.amount?.toLocaleString()} 크레딧이 지급됐어요.
        </p>
      )}
      {latest?.status === "dismissed" && <p className="text-xs text-zinc-500">지난 요청({day(latest.createdAt)})은 지급되지 않았어요. 필요하면 다시 요청해 주세요.</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={300}
          placeholder="한마디 (선택) 예) 폭우 속의 저택을 끝까지 해 보고 싶어요"
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <button type="submit" className="shrink-0 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
          {pending ? "보내는 중..." : "💎 크레딧 요청하기"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
