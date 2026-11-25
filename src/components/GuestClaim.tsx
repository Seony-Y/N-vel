"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { readGuestDone, writeGuestDone } from "@/lib/guest-storage";

/** 로그인한 화면에서: 비회원으로 끝낸 프롤로그가 이 브라우저에 있으면 내 기록으로 옮긴다 */
export function GuestClaim() {
  const router = useRouter();
  useEffect(() => {
    const done = readGuestDone();
    if (!done) return;
    if (!done.accusation) return writeGuestDone(null); // 포기한 기록은 옮기지 않는다
    fetch("/api/play/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseId: done.caseId, save: done.save, accusation: done.accusation }) })
      .then((res) => {
        if (res.status === 401 || res.status >= 500) return; // 다음에 다시 시도
        writeGuestDone(null);
        if (res.status === 201) router.refresh();
      })
      .catch(() => null);
  }, [router]);
  return null;
}
