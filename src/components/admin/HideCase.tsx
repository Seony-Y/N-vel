"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** 관리자: 사건 숨기기(이유 입력) / 다시 보이기 */
export function HideCase({ caseId, hidden, size = "sm" }: { caseId: string; hidden: boolean; size?: "sm" | "md" }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(next: boolean) {
    if (pending) return;
    setPending(true);
    setError(null);
    const res = await fetch(`/api/admin/cases/${caseId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hidden: next, reason }) }).catch(() => null);
    setPending(false);
    if (!res?.ok) return setError((await res?.json().catch(() => ({})))?.error ?? "처리하지 못했어요");
    setAsking(false);
    setReason("");
    router.refresh();
  }

  const text = size === "sm" ? "text-xs" : "text-sm";
  if (hidden) {
    return (
      <button type="button" onClick={() => send(false)} className={`${text} whitespace-nowrap rounded-md px-2 py-1 font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30`}>
        {pending ? "처리 중..." : "👁 다시 보이기"}
      </button>
    );
  }
  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className={`${text} whitespace-nowrap rounded-md px-2 py-1 font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30`}>
        🚫 숨기기
      </button>
    );
  }
  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 ${text}`}>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={300}
        placeholder="숨기는 이유 (만든 사람에게 보여요)"
        autoFocus
        className="w-56 rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
      />
      <button type="button" onClick={() => send(true)} className="whitespace-nowrap rounded-md bg-red-600 px-2.5 py-1 font-medium text-white hover:bg-red-700">
        {pending ? "처리 중..." : "숨기기"}
      </button>
      <button type="button" onClick={() => setAsking(false)} className="whitespace-nowrap rounded-md px-2 py-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
        취소
      </button>
      {error && <span className="text-red-600">{error}</span>}
    </span>
  );
}
