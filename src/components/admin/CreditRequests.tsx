"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { dt } from "./ui";

type Row = { id: number; message: string; createdAt: Date; userId: string; name: string; email: string; balance: number };

const QUICK = [300, 700];

/** 관리자: 처리 안 된 크레딧 요청. 바로 지급하거나 넘긴다 */
export function CreditRequests({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [custom, setCustom] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function resolve(id: number, body: { action: "grant"; amount: number } | { action: "dismiss" }) {
    if (busy) return;
    setBusy(id);
    setError(null);
    const res = await fetch("/api/admin/credit-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...body }) }).catch(() => null);
    setBusy(null);
    if (!res?.ok) setError((await res?.json().catch(() => ({})))?.error ?? "처리하지 못했어요");
    router.refresh();
  }

  if (!rows.length) return <p className="px-4 py-6 text-center text-sm text-zinc-400">대기 중인 요청이 없어요</p>;

  const btn = "rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50";
  return (
    <div>
      {error && <p className="border-b border-zinc-200 px-4 py-2 text-sm text-red-600 dark:border-zinc-800">{error}</p>}
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-col gap-2 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <Link href={`/admin/users/${r.userId}`} className="font-medium hover:text-red-600">
                  {r.name}
                </Link>
                <span className="text-xs text-zinc-500">{r.email}</span>
              </div>
              <p className="text-xs text-zinc-500">
                {dt(new Date(r.createdAt))} · 잔액 💎 {r.balance.toLocaleString()}
              </p>
              {r.message && <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">&ldquo;{r.message}&rdquo;</p>}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              {QUICK.map((n) => (
                <button key={n} type="button" disabled={busy === r.id} onClick={() => resolve(r.id, { action: "grant", amount: n })} className={`${btn} bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900`}>
                  +{n}
                </button>
              ))}
              <input
                type="number"
                min={1}
                value={custom[r.id] ?? ""}
                onChange={(e) => setCustom((c) => ({ ...c, [r.id]: e.target.value }))}
                placeholder="직접"
                className="w-20 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950"
              />
              <button
                type="button"
                disabled={busy === r.id || !(Number(custom[r.id]) > 0)}
                onClick={() => resolve(r.id, { action: "grant", amount: Math.floor(Number(custom[r.id])) })}
                className={`${btn} border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800`}
              >
                지급
              </button>
              <button type="button" disabled={busy === r.id} onClick={() => resolve(r.id, { action: "dismiss" })} className={`${btn} text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200`}>
                넘기기
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
