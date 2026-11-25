"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { REPORT_REASONS, type ReportReason } from "@/lib/feedback-config";
import { HideCase } from "./HideCase";
import { dt } from "./ui";

type Row = { id: number; reason: ReportReason; message: string; createdAt: Date; caseId: string; title: string; hiddenAt: Date | null; email: string; userId: string };

/** 관리자: 처리 안 된 신고. 사건을 숨기거나, 확인했으면 처리 완료 */
export function Reports({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);

  async function resolve(id: number) {
    if (busy) return;
    setBusy(id);
    await fetch("/api/admin/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => null);
    setBusy(null);
    router.refresh();
  }

  if (!rows.length) return <p className="px-4 py-6 text-center text-sm text-zinc-400">처리할 신고가 없어요</p>;
  return (
    <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {rows.map((r) => (
        <li key={r.id} className="flex flex-col gap-2 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <Link href={`/cases/${r.caseId}`} className="font-medium hover:text-red-600">
              {r.title}
            </Link>
            <span className="ml-2 text-sm text-red-600">{REPORT_REASONS[r.reason]}</span>
            <p className="text-xs text-zinc-500">
              {dt(new Date(r.createdAt))} · {r.email}
            </p>
            {r.message && <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">&ldquo;{r.message}&rdquo;</p>}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <HideCase caseId={r.caseId} hidden={!!r.hiddenAt} />
            <button type="button" disabled={busy === r.id} onClick={() => resolve(r.id)} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
              처리 완료
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
