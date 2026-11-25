"use client";

import { useState } from "react";
import { shareText } from "@/lib/share";

/** 결과 공유. 휴대폰은 공유 창, 그 밖에는 글을 복사한다 */
export function ShareResult({ path, ...p }: Omit<Parameters<typeof shareText>[0], "url"> & { path: string }) {
  const [note, setNote] = useState<string | null>(null);

  async function share() {
    const text = shareText({ ...p, url: location.origin + path });
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      await navigator.share({ text }).catch(() => null); // 취소하면 아무것도 하지 않는다
      return;
    }
    const ok = await navigator.clipboard.writeText(text).then(
      () => true,
      () => false,
    );
    setNote(ok ? "복사했어요. 붙여넣어 공유해 보세요" : "복사하지 못했어요");
    setTimeout(() => setNote(null), 2500);
  }

  return (
    <button type="button" onClick={share} className="w-full rounded-xl border border-zinc-300 py-3 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
      <span role="status">{note ?? "📤 결과 공유하기 (스포일러 없음)"}</span>
    </button>
  );
}
