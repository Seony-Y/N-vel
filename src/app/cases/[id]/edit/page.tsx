import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CaseEditor } from "@/components/case-editor/CaseEditor";
import { SiteHeader } from "@/components/SiteHeader";
import { requireUserId } from "@/lib/auth";
import { toCaseFile } from "@/lib/cases/import";
import { loadCase } from "@/lib/game/load";

export const metadata: Metadata = { title: "사건 수정 | N-vel" };

export default function EditCasePage({ params }: PageProps<"/cases/[id]/edit">) {
  return (
    <>
      <SiteHeader />
      <Suspense>
        <EditCase params={params} />
      </Suspense>
    </>
  );
}

async function EditCase({ params }: { params: PageProps<"/cases/[id]/edit">["params"] }) {
  const { id } = await params;
  const userId = await requireUserId(`/cases/${id}/edit`);
  const full = await loadCase(id).catch(() => null);
  // 진상이 담긴 화면이므로 만든 사람만. 공식 사건(owner 없음)은 아무도 못 연다
  if (!full || full.case.ownerId !== userId) notFound();

  return <CaseEditor initial={toCaseFile(full)} initialPublic={full.case.isPublic} caseId={id} hiddenReason={full.case.hiddenAt ? full.case.hiddenReason : null} />;
}
