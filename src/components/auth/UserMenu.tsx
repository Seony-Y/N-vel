"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";

/** 로그인 안 했을 때: 로그인 / 회원가입 */
export function GuestMenu() {
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <Link href="/login" className="rounded-lg px-3 py-2 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800">
        로그인
      </Link>
      <Link href="/signup" className="rounded-lg bg-red-600 px-3 py-2 font-semibold text-white hover:bg-red-700">
        회원가입
      </Link>
    </div>
  );
}

const MENU = [
  { href: "/my/plays", label: "🔎 내 수사" },
  { href: "/my/cases", label: "✏️ 사건 만들기" },
  { href: "/my/credits", label: "💎 내 크레딧" },
  { href: "/my/account", label: "⚙️ 계정 설정" },
];

/** 로그인했을 때: "OO님 ▾" 을 누르면 메뉴가 열린다. 바깥을 누르거나 Esc 로 닫힌다 */
export function UserMenu({ name, credits }: { name: string; credits: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function signOut() {
    setOpen(false);
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        <span className="hidden rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium tabular-nums text-zinc-700 sm:inline dark:bg-zinc-800 dark:text-zinc-300">💎 {credits.toLocaleString()}</span>
        <span className="max-w-[6rem] truncate font-medium sm:max-w-[10rem]">{name}님</span>
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`h-4 w-4 shrink-0 text-zinc-400 transition ${open ? "rotate-180" : ""}`} aria-hidden>
          <path d="M6 8l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-1.5 w-52 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <div className="border-b border-zinc-100 px-4 py-2.5 dark:border-zinc-800">
            <p className="truncate text-sm font-semibold">{name}님</p>
            <p className="text-xs tabular-nums text-zinc-500">💎 {credits.toLocaleString()} 크레딧</p>
          </div>
          {MENU.map((m) => (
            <Link key={m.href} href={m.href} role="menuitem" onClick={() => setOpen(false)} className="block px-4 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
              {m.label}
            </Link>
          ))}
          <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
          <button type="button" role="menuitem" onClick={signOut} className="block w-full px-4 py-2 text-left text-sm text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100">
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}
