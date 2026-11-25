import { useEffect, useState } from "react";

const EVENT = "n-vel:credits";

/** 화면을 새로 부르지 않고 잔액이 바뀌었을 때 상단 메뉴에 알린다 */
export function announceCredits(credits: number) {
  window.dispatchEvent(new CustomEvent<number>(EVENT, { detail: credits }));
}

/** 서버가 준 잔액. 그 뒤에 알려진 잔액이 있으면 그것을 쓰고, 서버 값이 새로 오면 다시 서버 값을 쓴다 */
export function useLiveCredits(fromServer: number) {
  const [live, setLive] = useState({ base: fromServer, credits: fromServer });
  useEffect(() => {
    const on = (e: Event) => setLive({ base: fromServer, credits: (e as CustomEvent<number>).detail });
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, [fromServer]);
  return live.base === fromServer ? live.credits : fromServer;
}
