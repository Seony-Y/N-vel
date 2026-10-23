import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ApiBudget } from "@/components/admin/ApiBudget";
import { CreditRequests } from "@/components/admin/CreditRequests";
import { HideCase } from "@/components/admin/HideCase";
import { EventsPanel } from "@/components/admin/EventsPanel";
import { Panel, PeriodTabs, pct, StatTile, Table, Td } from "@/components/admin/ui";
import { SiteHeader } from "@/components/SiteHeader";
import { Loading } from "@/components/Loading";
import { formatUsd } from "@/lib/ai/models";
import { apiBudget, moderationCases, overview, perCase, perUser, recentEvents } from "@/lib/admin/stats";
import { requireAdmin } from "@/lib/auth";
import { pendingRequests } from "@/lib/credit-requests";

export const metadata: Metadata = { title: "관리자 | N-vel" };

export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <>
      <SiteHeader />
      <Suspense fallback={<Loading text="집계하는 중..." />}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  await requireAdmin("/admin");
  const days = Math.min(365, Math.max(1, Number((await searchParams).days) || 30));
  const [o, users, cs, events, budget, requests, published] = await Promise.all([overview(days), perUser(days), perCase(days), recentEvents(30), apiBudget(), pendingRequests(), moderationCases()]);
  const issues = (o.events.refusal ?? 0) + (o.events.rejected_clue ?? 0) + (o.events.truncated ?? 0);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">관리자</h1>
        <PeriodTabs days={days} base="/admin" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="가입자" value={o.users.toLocaleString()} sub={`기간 내 플레이 ${o.activeUsers}명`} />
        <StatTile label="플레이" value={o.started.toLocaleString()} sub={`제출 ${o.finished} · 포기 ${o.gaveUp}`} />
        <StatTile label="해결률" value={pct(o.solved, o.finished)} sub={`해결 ${o.solved} / 제출 ${o.finished}`} />
        <StatTile label="차감 크레딧" value={o.credits.toLocaleString()} sub={`행동 ${o.actions.toLocaleString()}회`} />
        <StatTile label="API 원가 (기간 내 사용)" value={formatUsd(o.costMicros)} sub={`호출 ${o.apiCalls.toLocaleString()}회`} />
        <StatTile label="오류" value={String(o.events.error ?? 0)} sub={`거절·규칙 위반·잘림 ${issues}`} alert={(o.events.error ?? 0) > 0} />
      </div>

      <Panel title={`크레딧 요청${requests.length ? ` (${requests.length})` : ""}`}>
        <CreditRequests rows={requests} />
      </Panel>

      <Panel title="API 예산" action={<span className="text-xs text-zinc-500">원가는 토큰 수 × 가격표로 계산한 추정치예요</span>}>
        <ApiBudget {...budget} />
      </Panel>

      <Panel title="사건별">
        <Table head={["사건", "플레이", "제출", "포기", "해결률", "평균 점수", "평균 일치율", "평균 행동", "크레딧", "원가", "플레이당 원가"]} empty={!cs.length}>
          {cs.map((c) => (
            <tr key={c.id}>
              <Td>
                <Link href={`/cases/${c.id}/answer`} className="font-medium hover:text-red-600">
                  {c.isOfficial && "🏷 "}
                  {c.title}
                </Link>
              </Td>
              <Td num>{c.started}</Td>
              <Td num>{c.finished}</Td>
              <Td num>{c.gaveUp}</Td>
              <Td num>{pct(c.solved, c.finished)}</Td>
              <Td num>{c.avgScore ?? "-"}</Td>
              <Td num>{c.avgMatch != null ? `${c.avgMatch}%` : "-"}</Td>
              <Td num>{c.avgActions ?? "-"}</Td>
              <Td num>{c.credits.toLocaleString()}</Td>
              <Td num>{formatUsd(c.micros)}</Td>
              <Td num>{c.started ? formatUsd(Math.round(c.micros / c.started)) : "-"}</Td>
            </tr>
          ))}
        </Table>
      </Panel>

      <Panel title={`공개 사건 관리 (${published.length})`}>
        <Table head={["사건", "만든 사람", "상태", "수정", "관리"]} empty={!published.length}>
          {published.map((c) => (
            <tr key={c.id} className={c.hiddenAt ? "bg-red-50/50 dark:bg-red-950/20" : ""}>
              <Td>
                <Link href={`/cases/${c.id}`} className="font-medium hover:text-red-600">
                  {c.isOfficial && "🏷 "}
                  {c.title}
                </Link>
                {c.hiddenAt && c.hiddenReason && <div className="mt-0.5 text-xs text-zinc-500">숨긴 이유: {c.hiddenReason}</div>}
              </Td>
              <Td className="text-zinc-500">{c.isOfficial ? "공식" : (c.owner ?? "-")}</Td>
              <Td>{c.hiddenAt ? "🚫 숨김" : "🌐 공개"}</Td>
              <Td className="text-zinc-500">{c.updatedAt.toLocaleDateString("ko-KR")}</Td>
              <Td>
                <HideCase caseId={c.id} hidden={!!c.hiddenAt} />
              </Td>
            </tr>
          ))}
        </Table>
      </Panel>

      <Panel title="사용자별">
        <Table head={["사용자", "가입", "잔액", "플레이", "제출", "해결", "차감 크레딧", "원가", "오류", "기타 이슈"]} empty={!users.length}>
          {users.map((u) => (
            <tr key={u.id}>
              <Td>
                {/* 이름 아래에 메일 (한 줄에 붙여 두면 어디까지가 이름인지 헷갈린다) */}
                <div className="flex items-center gap-1.5">
                  <Link href={`/admin/users/${u.id}`} className="font-medium hover:text-red-600">
                    {u.name}
                  </Link>
                  {u.role === "admin" && <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">🛡 관리자</span>}
                </div>
                <div className="mt-0.5 text-xs text-zinc-500">{u.email}</div>
              </Td>
              <Td className="text-zinc-500">{u.createdAt.toLocaleDateString("ko-KR")}</Td>
              <Td num>💎 {u.balance.toLocaleString()}</Td>
              <Td num>{u.started}</Td>
              <Td num>{u.finished}</Td>
              <Td num>
                {u.solved} <span className="text-xs text-zinc-400">({pct(u.solved, u.finished)})</span>
              </Td>
              <Td num>{u.credits.toLocaleString()}</Td>
              <Td num>{formatUsd(u.micros)}</Td>
              <Td num className={u.errors ? "font-medium text-red-600 dark:text-red-400" : ""}>
                {u.errors ? `⛔ ${u.errors}` : 0}
              </Td>
              <Td num>{u.issues}</Td>
            </tr>
          ))}
        </Table>
      </Panel>

      <EventsPanel events={events} />
    </main>
  );
}
