import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Loading } from "@/components/Loading";
import { SiteHeader } from "@/components/SiteHeader";
import { getUserId } from "@/lib/auth";
import { findNextCase } from "@/lib/game/catalog";
import { guestSession, loadGuestCase } from "@/lib/game/guest";
import { publicCase, publicState } from "@/lib/game/public";
import { GuestPlay } from "./GuestPlay";

export const metadata: Metadata = { title: "프롤로그 | N-vel" };

/** 로그인 없이 하는 프롤로그 */
export default function GuestPage() {
  return (
    <>
      <SiteHeader />
      <Suspense fallback={<Loading text="사건 파일을 펼치는 중..." />}>
        <Guest />
      </Suspense>
    </>
  );
}

async function Guest() {
  const [userId, full] = await Promise.all([getUserId(), loadGuestCase()]);
  if (!full) notFound();
  if (userId) redirect(`/cases/${full.case.id}`); // 회원은 기록이 남는 평소 방식으로
  const next = await findNextCase(null, full.case.id);
  const fresh = guestSession(full, { locationId: null, foundClueIds: [], actionsUsed: 0, hintsUsed: 0 });
  return <GuestPlay data={publicCase(full)} fresh={publicState(full, fresh)} next={next && { id: next.id, title: next.title, estimatedMinutes: next.estimatedMinutes }} />;
}
