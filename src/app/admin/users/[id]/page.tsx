import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EventsPanel } from "@/components/admin/EventsPanel";
import { GrantCredits } from "@/components/admin/GrantCredits";
import { CreditLedger } from "@/components/CreditLedger";
import { dt, Panel, pct, StatTile, Table, Td } from "@/components/admin/ui";
import { SiteHeader } from "@/components/SiteHeader";
import { CHAT_MODELS, formatUsd } from "@/lib/ai/models";
import { recentEvents, userSessions } from "@/lib/admin/stats";
import { requireAdmin } from "@/lib/auth";
import { ledger } from "@/lib/credits";
import { endingText } from "@/lib/game/endings";

export const metadata: Metadata = { title: "사용자 기록 | N-vel 관리자" };

export default function AdminUserPage({ params }: PageProps<"/admin/users/[id]">) {
  return (
    <>
      <SiteHeader />
      <Suspense fallback={<p className="p-8 text-sm text-zinc-400">불러오는 중...</p>}>
        <UserDetail params={params} />
      </Suspense>
    </>
  );
}

const modelLabel = (id: string | null) => CHAT_MODELS.find((m) => m.id === id)?.label ?? id ?? "-";

async function UserDetail({ params }: { params: PageProps<"/admin/users/[id]">["params"] }) {
  await requireAdmin("/admin");
  const { id } = await params;
  const [{ profile, sessions, reviews }, events, creditRows] = await Promise.all([userSessions(id), recentEvents(50, id), ledger(id, 50)]);
  if (!profile) notFound();

  const finished = sessions.filter((s) => s.status === "finished" && s.ending !== "gaveup");
  const gaveUp = sessions.filter((s) => s.ending === "gaveup").length;
  const solved = finished.filter((s) => s.ending === "correct").length;
  const credits = sessions.reduce((n, s) => n + s.credits, 0);
  const micros = sessions.reduce((n, s) => n + s.micros, 0) + reviews.micros;
  const errors = sessions.reduce((n, s) => n + s.errors, 0);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <Link href="/admin" className="text-sm text-zinc-500 hover:text-red-600">
          ← 관리자
        </Link>
        <h1 className="mt-1 text-2xl font-bold">
          {profile.name} {profile.role === "admin" && <span className="text-base">🛡</span>}
        </h1>
        <p className="text-sm text-zinc-500">
          {profile.email} · 가입 {profile.createdAt.toLocaleDateString("ko-KR")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <StatTile label="크레딧 잔액" value={`💎 ${profile.credits.toLocaleString()}`} />
        <StatTile label="플레이" value={String(sessions.length)} sub={`제출 ${finished.length} · 포기 ${gaveUp}`} />
        <StatTile label="해결률" value={pct(solved, finished.length)} sub={`해결 ${solved}`} />
        <StatTile label="차감 크레딧 (전체)" value={credits.toLocaleString()} />
        <StatTile label="API 원가 (전체)" value={formatUsd(micros)} sub={reviews.n ? `AI 검수 ${reviews.n}회 ${formatUsd(reviews.micros)} 포함` : undefined} />
        <StatTile label="오류" value={String(errors)} alert={errors > 0} sub={errors ? "아래 이벤트 확인" : "없음"} />
        <StatTile label="평균 일치율" value={finished.length ? `${Math.round(finished.reduce((n, s) => n + (s.matchRate ?? 0), 0) / finished.length)}%` : "-"} />
      </div>

      <Panel title="플레이 기록">
        <Table head={["시작", "사건", "모델", "상태", "점수", "일치율", "행동", "힌트", "크레딧", "원가", "AI 호출", "오류/이슈"]} empty={!sessions.length}>
          {sessions.map((s) => (
            <tr key={s.id}>
              <Td className="text-zinc-500">{dt(s.createdAt)}</Td>
              <Td>
                <Link href={`/admin/sessions/${s.id}`} className="font-medium hover:text-red-600">
                  {s.caseTitle}
                </Link>
              </Td>
              <Td>{modelLabel(s.model)}</Td>
              <Td>{s.status === "playing" ? "▶ 진행 중" : endingText(s.ending)}</Td>
              <Td num>{s.score ?? "-"}</Td>
              <Td num>{s.matchRate != null ? `${s.matchRate}%` : "-"}</Td>
              <Td num>{s.actions}</Td>
              <Td num>{s.hints}</Td>
              <Td num>{s.credits}</Td>
              <Td num>{formatUsd(s.micros)}</Td>
              <Td num>{s.calls}</Td>
              <Td num className={s.errors ? "font-medium text-red-600 dark:text-red-400" : ""}>
                {s.errors ? `⛔ ${s.errors}` : 0} / {s.issues}
              </Td>
            </tr>
          ))}
        </Table>
      </Panel>

      <Panel title="크레딧 지급·회수">
        <GrantCredits userId={id} />
      </Panel>

      <Panel title="크레딧 내역 (최근 50건)">
        <CreditLedger rows={creditRows} sessionHref={(sid) => `/admin/sessions/${sid}`} />
      </Panel>

      <EventsPanel events={events} />
    </main>
  );
}
