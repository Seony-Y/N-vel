"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** 즐겨찾기 별. 화면은 바로 바꾸고 저장은 뒤에서 한다. 실패하면 되돌린다. 로그인 전이면 안내 말풍선만 잠깐 띄운다 */
export function FavoriteButton({ caseId, initial, loggedIn, variant = "icon" }: { caseId: string; initial: boolean; loggedIn: boolean; variant?: "icon" | "text" }) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [pending, setPending] = useState(false);
  const [needLogin, setNeedLogin] = useState(false);

  async function toggle() {
    if (pending) return; // 저장 중 두 번 누르기 방지 (disabled 로 두면 커서가 '금지' 모양으로 깜빡인다)
    if (!loggedIn) {
      setNeedLogin(true);
      setTimeout(() => setNeedLogin(false), 2000);
      return;
    }
    const next = !on;
    setOn(next);
    setPending(true);
    const res = await fetch(`/api/cases/${caseId}/favorite`, { method: next ? "PUT" : "DELETE" }).catch(() => null);
    setPending(false);
    if (!res?.ok) setOn(!next);
    else router.refresh(); // 내 수사의 즐겨찾기 묶음 등 서버 화면을 다시 그린다
  }

  const label = on ? "즐겨찾기 해제" : "즐겨찾기";
  const title = loggedIn ? label : "로그인이 필요해요";
  const tip = needLogin && (
    <span role="status" className="absolute right-0 top-full z-10 mt-1.5 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white shadow-lg dark:bg-white dark:text-zinc-900">
      로그인이 필요해요
    </span>
  );
  if (variant === "text") {
    return (
      <span className="relative inline-block">
        <button type="button" onClick={toggle} aria-busy={pending} aria-pressed={on} title={title} className={`rounded-md px-1.5 py-0.5 font-medium hover:bg-amber-50 dark:hover:bg-amber-950/30 ${on ? "text-amber-500" : "text-zinc-500 hover:text-amber-600"}`}>
          <Star on={on} className="mr-1 inline-block h-3.5 w-3.5 -translate-y-px align-middle" />
          {label}
        </button>
        {tip}
      </span>
    );
  }
  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={toggle}
        aria-busy={pending}
        aria-pressed={on}
        aria-label={label}
        title={title}
        className={`flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-lg leading-none backdrop-blur-sm hover:bg-black/70 ${on ? "text-amber-400" : "text-white"}`}
      >
        <Star on={on} className="h-[18px] w-[18px]" />
      </button>
      {tip}
    </span>
  );
}

/** 별 아이콘. 글자(★☆)는 글꼴마다 기준선이 달라 동그라미 안에서 가운데가 맞지 않아 SVG 로 그린다 */
function Star({ on, className }: { on: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round">
      <path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" />
    </svg>
  );
}
