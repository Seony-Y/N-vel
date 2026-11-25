"use client";

import { useEffect, useEffectEvent } from "react";

/** 저장하지 않은 내용이 있을 때 나가지 못하게 붙잡는다. 사이트 안의 링크를 누르면 이동을 멈추고 onLeave(주소)를 부른다 */
export function useLeaveGuard(dirty: boolean, onLeave: (href: string) => void) {
  const leave = useEffectEvent(onLeave);
  useEffect(() => {
    if (!dirty) return;
    // 새로고침·탭 닫기: 브라우저 기본 확인 창
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    // 사이트 안의 링크: React 보다 먼저 받도록 document 캡처 단계에서 멈춘다.
    // 같은 사이트의 다른 페이지로 가는 링크만. 바깥 주소는 beforeunload 가, 새 탭·다운로드·같은 페이지 안 이동은 그대로 둔다
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!a || a.hasAttribute("download") || (a.getAttribute("target") ?? "_self") !== "_self") return;
      const here = window.location;
      const url = new URL(a.getAttribute("href")!, here.href);
      if (url.origin !== here.origin || (url.pathname === here.pathname && url.search === here.search)) return;
      e.preventDefault();
      e.stopPropagation();
      leave(url.pathname + url.search + url.hash);
    };
    window.addEventListener("beforeunload", onUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);
}
