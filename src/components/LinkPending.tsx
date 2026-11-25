"use client";

import { useLinkStatus } from "next/link";

/** 링크를 누른 뒤 화면이 바뀔 때까지 도는 작은 표시 (Link 안에 둔다) */
export function LinkPending() {
  const { pending } = useLinkStatus();
  return pending ? <span role="status" aria-label="불러오는 중" className="ml-1.5 inline-block h-3 w-3 animate-spin rounded-full border-2 border-zinc-300 border-t-red-600 align-[-1px]" /> : null;
}
