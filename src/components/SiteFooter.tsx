"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SITE } from "@/lib/site";

/** 모든 화면 아래의 운영 정보. 화면 높이를 꽉 채우는 수사 화면에서는 숨긴다 (결과 화면에는 보인다) */
export function SiteFooter() {
  const path = usePathname();
  if (/^\/play\/[^/]+$/.test(path)) return null;

  return (
    <footer className="mt-auto border-t border-zinc-200 px-4 py-6 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/terms" className="hover:text-zinc-800 dark:hover:text-zinc-200">
            이용약관
          </Link>
          <Link href="/privacy" className="font-semibold hover:text-zinc-800 dark:hover:text-zinc-200">
            개인정보처리방침
          </Link>
          <a href={`mailto:${SITE.contact}`} className="hover:text-zinc-800 dark:hover:text-zinc-200">
            문의 {SITE.contact}
          </a>
        </nav>
        <p>
          © {SITE.copyrightYear} {SITE.name} · 운영자 {SITE.operator} · v{SITE.version}
        </p>
      </div>
    </footer>
  );
}
