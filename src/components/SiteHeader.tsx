import Link from "next/link";
import { Suspense } from "react";
import { UserMenu } from "@/components/auth/UserMenu";
import { getUserId, isAdmin } from "@/lib/auth";
import { getBalance } from "@/lib/credits";

const linkClass = "shrink-0 rounded-lg px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-zinc-200 bg-white/80 px-4 py-3 backdrop-blur sm:px-6 dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="flex min-w-0 items-center gap-1 overflow-x-auto sm:gap-3">
        <Link href="/" className="mr-1 shrink-0 text-lg font-bold tracking-tight">
          N-vel
        </Link>
        <Link href="/" className={linkClass}>
          사건 목록
        </Link>
        <Link href="/my/plays" className={linkClass}>
          내 수사
        </Link>
        <Link href="/my/cases" className={linkClass}>
          사건 만들기
        </Link>
        {/* 로그인 정보를 읽으므로 Suspense 안에서 (나머지 헤더는 바로 보인다) */}
        <Suspense>
          <AdminLink />
        </Suspense>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Suspense>
          <CreditBadge />
        </Suspense>
        <UserMenu />
      </div>
    </header>
  );
}

async function AdminLink() {
  if (!(await isAdmin(await getUserId()))) return null;
  return (
    <Link href="/admin" className={linkClass}>
      🛡 관리자
    </Link>
  );
}

async function CreditBadge() {
  const userId = await getUserId();
  if (!userId) return null;
  return (
    <Link href="/my/credits" className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-200" title="내 크레딧">
      💎 {(await getBalance(userId)).toLocaleString()}
    </Link>
  );
}
