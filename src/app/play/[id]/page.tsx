import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { Loading } from "@/components/Loading";
import { CHAT_MODELS, getChatModel } from "@/lib/ai/models";
import { requireUserId } from "@/lib/auth";
import { getBalance } from "@/lib/credits";
import { canPlay, loadAllMessages, loadCaseCached, loadSessionWithCase } from "@/lib/game/load";
import { publicCase, publicMessages, publicState } from "@/lib/game/public";
import { PlayScreen } from "./PlayScreen";

export const metadata: Metadata = { title: "수사 중 | N-vel" };

export default function PlayPage({ params }: PageProps<"/play/[id]">) {
  return (
    <>
      <SiteHeader />
      <Suspense fallback={<Loading text="사건 파일을 펼치는 중..." />}>
        <Play params={params} />
      </Suspense>
    </>
  );
}

async function Play({ params }: { params: PageProps<"/play/[id]">["params"] }) {
  const { id } = await params;
  const userId = await requireUserId(`/play/${id}`);
  // 기록과 사건의 공개 여부·수정 시각을 한 번에 읽고, 사건 전체는 수정 시각이 같으면 메모리 캐시를 쓴다.
  // 대화 기록·잔액은 사건을 기다리지 않고 함께 읽는다 (DB 왕복을 줄여 첫 화면을 빨리)
  const row = await loadSessionWithCase(id, userId).catch(() => null);
  if (!row) notFound();
  const { session } = row;
  if (session.status === "finished") redirect(`/play/${id}/result`);
  if (!canPlay(row, userId)) notFound();

  const [full, messages, credits] = await Promise.all([loadCaseCached(session.caseId, row.updatedAt), loadAllMessages(id), getBalance(userId)]);
  if (!full) notFound();
  return (
    <PlayScreen
      data={publicCase(full)}
      initialState={publicState(full, session)}
      initialMessages={publicMessages(messages)}
      initialCredits={credits}
      models={CHAT_MODELS.map(({ id, label, description, credits }) => ({ id, label, description, credits }))}
      defaultModel={getChatModel(null).id}
    />
  );
}
