import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { CHAT_MODELS, getChatModel } from "@/lib/ai/models";
import { requireUserId } from "@/lib/auth";
import { getBalance } from "@/lib/credits";
import { canPlay, loadAllMessages, loadCase, loadSession } from "@/lib/game/load";
import { publicCase, publicMessages, publicState } from "@/lib/game/public";
import { PlayScreen } from "./PlayScreen";

export const metadata: Metadata = { title: "수사 중 | N-vel" };

export default function PlayPage({ params }: PageProps<"/play/[id]">) {
  return (
    <>
      <SiteHeader />
      <Suspense fallback={<p className="p-8 text-sm text-zinc-400">사건 파일을 펼치는 중...</p>}>
        <Play params={params} />
      </Suspense>
    </>
  );
}

async function Play({ params }: { params: PageProps<"/play/[id]">["params"] }) {
  const { id } = await params;
  const userId = await requireUserId(`/play/${id}`);
  const session = await loadSession(id, userId).catch(() => null);
  if (!session) notFound();
  if (session.status === "finished") redirect(`/play/${id}/result`);

  const full = await loadCase(session.caseId);
  if (!full || !canPlay(full.case, userId)) notFound();

  const [messages, credits] = await Promise.all([loadAllMessages(id), getBalance(userId)]);
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
