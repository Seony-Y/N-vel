import type { Metadata } from "next";
import { Suspense } from "react";
import { CaseEditor } from "@/components/case-editor/CaseEditor";
import { SiteHeader } from "@/components/SiteHeader";
import { requireUserId } from "@/lib/auth";

export const metadata: Metadata = { title: "사건 만들기 | N-vel" };

export default function NewCasePage() {
  return (
    <>
      <SiteHeader />
      <Suspense>
        <NewCase />
      </Suspense>
    </>
  );
}

async function NewCase() {
  await requireUserId("/cases/new");
  return <CaseEditor initial={null} initialPublic={false} />;
}
