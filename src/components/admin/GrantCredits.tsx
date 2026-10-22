"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** 관리자: 사용자에게 크레딧 지급(+) / 회수(-) */
export function GrantCredits({ userId }: { userId: string }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setMsg(null);
    const res = await fetch("/api/admin/credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, amount: Number(amount), note }),
    });
    const body = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) return setMsg({ ok: false, text: body.error ?? "실패했습니다" });
    setMsg({ ok: true, text: `완료. 잔액 ${body.balance.toLocaleString()}` });
    setAmount("");
    setNote("");
    router.refresh();
  }

  const field = "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";
  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2 p-4">
      <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="+500 또는 -100" required className={`${field} w-36`} />
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="사유 (예: 베타 테스트 보상)" required maxLength={200} className={`${field} min-w-48 flex-1`} />
      <button type="submit" disabled={pending || !amount || !note} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900">
        {pending ? "처리 중..." : "적용"}
      </button>
      {msg && <span className={`text-sm ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</span>}
    </form>
  );
}
