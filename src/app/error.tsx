"use client"; // 오류 경계는 클라이언트 컴포넌트여야 한다

import { useEffect } from "react";
import { Notice } from "@/components/Notice";

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <Notice icon="🌧" title="문제가 생겼어요" text="잠시 후 다시 시도해 주세요. 수사 기록은 저장되어 있어요.">
      <button onClick={() => retry()} className="block w-full rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700">
        다시 시도
      </button>
    </Notice>
  );
}
