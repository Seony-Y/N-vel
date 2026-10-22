import Link from "next/link";
import type { ledger } from "@/lib/credits";
import { REASON_LABEL } from "@/lib/credits";

/** 크레딧 내역 표 (내 크레딧 화면, 관리자 사용자 상세에서 함께 사용) */
export function CreditLedger({ rows, sessionHref }: { rows: Awaited<ReturnType<typeof ledger>>; sessionHref?: (id: string) => string }) {
  if (!rows.length) return <p className="px-4 py-6 text-center text-sm text-zinc-400">내역이 없어요</p>;
  return (
    <table className="w-full text-left text-sm">
      <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-950">
        <tr>
          <th className="px-4 py-2 font-medium">시각</th>
          <th className="px-4 py-2 font-medium">내용</th>
          <th className="px-4 py-2 text-right font-medium">변동</th>
          <th className="px-4 py-2 text-right font-medium">잔액</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {rows.map((r) => (
          <tr key={r.id}>
            <td className="whitespace-nowrap px-4 py-2 text-zinc-500">{r.createdAt.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
            <td className="px-4 py-2">
              {REASON_LABEL[r.reason]}
              {r.note && <span className="ml-2 text-xs text-zinc-500">{r.note}</span>}
              {r.sessionId && sessionHref && (
                <Link href={sessionHref(r.sessionId)} className="ml-2 text-xs text-red-600 hover:underline">
                  플레이 ›
                </Link>
              )}
            </td>
            <td className={`whitespace-nowrap px-4 py-2 text-right tabular-nums ${r.amount > 0 ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
              {r.amount > 0 ? `+${r.amount.toLocaleString()}` : r.amount.toLocaleString()}
            </td>
            <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">{r.balanceAfter.toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
