import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { dt, EVENT_LABEL, Panel, StatTile, Table, Td } from "@/components/admin/ui";
import { AnswerSheet } from "@/components/AnswerSheet";
import { SiteHeader } from "@/components/SiteHeader";
import { Loading } from "@/components/Loading";
import { formatUsd } from "@/lib/ai/models";
import { sessionDetail } from "@/lib/admin/stats";
import { requireAdmin } from "@/lib/auth";
import { endingText } from "@/lib/game/endings";
import { loadCase } from "@/lib/game/load";
import { savedGrade } from "@/lib/game/rules";

export const metadata: Metadata = { title: "플레이 기록 | N-vel 관리자" };

export default function AdminSessionPage({ params }: PageProps<"/admin/sessions/[id]">) {
  return (
    <>
      <SiteHeader />
      <Suspense fallback={<Loading />}>
        <SessionDetail params={params} />
      </Suspense>
    </>
  );
}

async function SessionDetail({ params }: { params: PageProps<"/admin/sessions/[id]">["params"] }) {
  await requireAdmin("/admin");
  const { id } = await params;
  const d = await sessionDetail(id).catch(() => null);
  if (!d) notFound();
  const s = d.session;
  const full = await loadCase(s.caseId);
  if (!full) notFound();

  const g = savedGrade(full, s);
  const micros = d.usage.reduce((n, u) => n + u.costMicros, 0);
  const cacheRead = d.usage.reduce((n, u) => n + u.cacheReadTokens, 0);
  const inputAll = d.usage.reduce((n, u) => n + u.inputTokens + u.cacheReadTokens + u.cacheWriteTokens, 0);
  const threadName = (t: string) => (t === "narrator" ? "🔎 조사" : `🗣 ${full.suspects.find((x) => x.id === t)?.name ?? "용의자"}`);
  const threads = [...new Set(d.messages.map((m) => m.thread))];

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <Link href={`/admin/users/${s.userId}`} className="text-sm text-zinc-500 hover:text-red-600">
          ← {d.name} ({d.email})
        </Link>
        <h1 className="mt-1 text-2xl font-bold">{full.case.title}</h1>
        <p className="text-sm text-zinc-500">
          {dt(s.createdAt)} 시작 · 모델 {s.model} · {s.status === "playing" ? "▶ 진행 중" : endingText(s.ending)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="점수" value={s.score != null ? String(s.score) : "-"} sub={g ? `일치율 ${g.matchRate}%` : "미제출"} />
        <StatTile label="행동" value={String(s.actionsUsed)} sub={`힌트 ${s.hintsUsed}회`} />
        <StatTile label="단서 발견" value={`${s.foundClueIds.length} / ${full.clues.length}`} />
        <StatTile label="차감 크레딧" value={String(s.creditsUsed)} />
        <StatTile label="API 원가" value={formatUsd(micros)} sub={`호출 ${d.usage.length}회`} />
        <StatTile label="캐시 적중률" value={inputAll ? `${Math.round((100 * cacheRead) / inputAll)}%` : "-"} sub="입력 토큰 중 캐시 읽기" />
      </div>

      {g && (
        <Panel title="제출한 추리 vs 정답">
          <Table head={["항목", "결과", "제출", "정답", "점수"]}>
            {g.items.map((it, i) => (
              <tr key={i}>
                <Td>{it.label}</Td>
                <Td>{it.ok ? "⭕ 맞음" : "❌ 틀림"}</Td>
                <Td>{it.kind === "narrative" ? <p className="line-clamp-3 max-w-md whitespace-pre-wrap" title={it.mine}>{it.mine}</p> : it.mine}</Td>
                <Td>{it.answer}</Td>
                <Td num>
                  {Math.round(it.points)} / {Math.round(it.max)}
                </Td>
              </tr>
            ))}
          </Table>
        </Panel>
      )}

      {d.events.length > 0 && (
        <Panel title={`이벤트 (${d.events.length})`}>
          <Table head={["시각", "종류", "내용", "상세"]}>
            {d.events.map((e) => (
              <tr key={e.id} className="align-top">
                <Td className="text-zinc-500">{dt(e.createdAt)}</Td>
                <Td>
                  {EVENT_LABEL[e.type].icon} {EVENT_LABEL[e.type].label}
                </Td>
                <td className="px-4 py-2">{e.message}</td>
                <td className="max-w-sm px-4 py-2 font-mono text-xs text-zinc-500">{e.detail ? JSON.stringify(e.detail).slice(0, 300) : ""}</td>
              </tr>
            ))}
          </Table>
        </Panel>
      )}

      <Panel title="대화 기록">
        <div className="grid gap-4 p-4 lg:grid-cols-2">
          {threads.map((t) => (
            <div key={t} className="rounded-xl border border-zinc-200 dark:border-zinc-800">
              <h3 className="border-b border-zinc-200 px-3 py-2 text-sm font-semibold dark:border-zinc-800">{threadName(t)}</h3>
              <div className="max-h-96 space-y-2 overflow-y-auto p-3 text-sm">
                {d.messages
                  .filter((m) => m.thread === t)
                  .map((m) => (
                    <p key={m.id} className={`whitespace-pre-wrap rounded-lg px-3 py-2 ${m.role === "user" ? "ml-8 bg-red-50 dark:bg-red-950/30" : m.role === "event" ? "bg-amber-50 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200" : "mr-8 bg-zinc-100 dark:bg-zinc-800"}`}>
                      {m.content}
                    </p>
                  ))}
              </div>
            </div>
          ))}
          {!threads.length && <p className="text-sm text-zinc-400">대화가 없어요</p>}
        </div>
      </Panel>

      <Panel title="API 호출">
        <Table head={["시각", "종류", "모델", "입력", "캐시 쓰기", "캐시 읽기", "출력", "원가"]} empty={!d.usage.length}>
          {d.usage.map((u) => (
            <tr key={u.id}>
              <Td className="text-zinc-500">{dt(u.createdAt)}</Td>
              <Td>{u.kind === "narrator" ? "조사" : u.kind === "suspect" ? "심문" : u.kind === "grade" ? "서술 채점" : u.kind}</Td>
              <Td className="font-mono text-xs">{u.model}</Td>
              <Td num>{u.inputTokens.toLocaleString()}</Td>
              <Td num>{u.cacheWriteTokens.toLocaleString()}</Td>
              <Td num>{u.cacheReadTokens.toLocaleString()}</Td>
              <Td num>{u.outputTokens.toLocaleString()}</Td>
              <Td num>{formatUsd(u.costMicros)}</Td>
            </tr>
          ))}
        </Table>
      </Panel>

      <div>
        <h2 className="mb-3 text-lg font-semibold">정답지 (✅ = 이 플레이에서 찾은 단서)</h2>
        <AnswerSheet full={full} found={new Set(s.foundClueIds)} />
      </div>
    </main>
  );
}
