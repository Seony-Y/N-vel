import { eq } from "drizzle-orm";
import Link from "next/link";
import { cache, Suspense } from "react";
import { GuestMenu, UserMenu } from "@/components/auth/UserMenu";
import { db } from "@/db";
import { user } from "@/db/schema";
import { getUserId } from "@/lib/auth";

const linkClass = "shrink-0 rounded-lg px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800";

/**
 * 상단 바. 왼쪽: 로고 · 사건 목록 · 관리자(관리자만). 오른쪽: "OO님 ▾" 메뉴 (내 수사, 사건 만들기, 내 크레딧, 로그아웃)
 * 모바일에서도 가로 스크롤이 생기지 않도록 나머지 메뉴는 드롭다운 안에 둔다.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-zinc-200 bg-white/80 px-3 py-2.5 backdrop-blur sm:px-6 dark:border-zinc-800 dark:bg-zinc-950/80">
      <nav className="flex min-w-0 items-center gap-1 sm:gap-2">
        <Link href="/" className="mr-1 shrink-0 text-lg font-bold tracking-tight">
          N-vel
        </Link>
        <Link href="/" className={linkClass}>
          사건 목록
        </Link>
        {/* 로그인 정보를 읽는 부분은 Suspense 안에서 (나머지 헤더는 바로 보인다) */}
        <Suspense>
          <AdminLink />
        </Suspense>
      </nav>
      <Suspense fallback={<div className="h-9 w-24" />}>
        <Account />
      </Suspense>
    </header>
  );
}

/** 현재 사용자. 관리자 링크와 계정 메뉴가 같이 쓰므로 요청당 한 번만 조회한다 */
const me = cache(async () => {
  const userId = await getUserId();
  if (!userId) return null;
  const [row] = await db.select({ name: user.name, role: user.role, credits: user.credits }).from(user).where(eq(user.id, userId));
  return row ?? null;
});

async function AdminLink() {
  const u = await me();
  if (u?.role !== "admin") return null;
  return (
    <Link href="/admin" className={linkClass} title="관리자">
      🛡<span className="hidden sm:inline"> 관리자</span>
    </Link>
  );
}

async function Account() {
  const u = await me();
  return u ? <UserMenu name={u.name} credits={u.credits} /> : <GuestMenu />;
}
