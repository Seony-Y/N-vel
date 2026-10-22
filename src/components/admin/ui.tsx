import Link from "next/link";

/** 관리자 화면 공통 부품. 수치는 본문 잉크 색으로, 상태는 아이콘 + 글자로 표시한다 */

export function StatTile({ label, value, sub, alert }: { label: string; value: string; sub?: string; alert?: boolean }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{value}</p>
      {sub && <p className={`mt-0.5 text-xs ${alert ? "font-medium text-red-600 dark:text-red-400" : "text-zinc-500"}`}>{alert && "⚠ "}{sub}</p>}
    </div>
  );
}

export function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="font-semibold">{title}</h2>
        {action}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

export function Table({ head, children, empty }: { head: string[]; children: React.ReactNode; empty?: boolean }) {
  return (
    <table className="w-full text-left text-sm">
      <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-950">
        <tr>
          {head.map((h) => (
            <th key={h} className="whitespace-nowrap px-4 py-2 font-medium">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {empty ? (
          <tr>
            <td colSpan={head.length} className="px-4 py-6 text-center text-zinc-400">
              기록이 없어요
            </td>
          </tr>
        ) : (
          children
        )}
      </tbody>
    </table>
  );
}

export const Td = ({ children, num, className = "" }: { children: React.ReactNode; num?: boolean; className?: string }) => (
  <td className={`whitespace-nowrap px-4 py-2 ${num ? "text-right tabular-nums" : ""} ${className}`}>{children}</td>
);

export const EVENT_LABEL = {
  error: { icon: "⛔", label: "오류" },
  refusal: { icon: "🚫", label: "AI 거절" },
  rejected_clue: { icon: "🔁", label: "규칙 밖 단서 요청" },
  truncated: { icon: "✂️", label: "응답 잘림" },
} as const;

export function PeriodTabs({ days, base }: { days: number; base: string }) {
  return (
    <div className="flex rounded-lg bg-zinc-100 p-1 text-sm dark:bg-zinc-800">
      {[1, 7, 30, 90].map((d) => (
        <Link key={d} href={`${base}?days=${d}`} className={`rounded-md px-3 py-1 ${days === d ? "bg-white shadow-sm dark:bg-zinc-900" : "text-zinc-500"}`}>
          {d === 1 ? "오늘" : `${d}일`}
        </Link>
      ))}
    </div>
  );
}

export const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "-");
export const dt = (d: Date) => d.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
