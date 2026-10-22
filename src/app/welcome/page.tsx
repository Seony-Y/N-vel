import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { getUserId } from "@/lib/auth";
import { getBalance } from "@/lib/credits";

export const metadata: Metadata = { title: "환영합니다 | N-vel" };

/** 이메일 인증 링크를 누르면 오는 곳. 링크가 만료됐으면 ?error=TOKEN_EXPIRED 가 붙어 온다 */
export default function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <Suspense>
          <Welcome searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

async function Welcome({ searchParams }: { searchParams: PageProps<"/welcome">["searchParams"] }) {
  const { error } = await searchParams;
  const userId = await getUserId();

  if (error || !userId) {
    return (
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-4xl">⏰</p>
        <h1 className="mt-3 text-xl font-semibold">인증 링크가 만료됐거나 올바르지 않아요</h1>
        <p className="mt-2 text-sm text-zinc-500">로그인하면 인증 메일을 다시 보내 드려요.</p>
        <Link href="/login" className="mt-5 inline-block w-full rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700">
          로그인하기
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-4xl">🎉</p>
      <h1 className="mt-3 text-xl font-semibold">이메일 인증이 끝났어요</h1>
      <p className="mt-2 text-sm text-zinc-500">가입 선물로 크레딧을 드렸어요.</p>
      <p className="mt-4 text-3xl font-bold tabular-nums">💎 {(await getBalance(userId)).toLocaleString()}</p>
      <Link href="/" className="mt-6 inline-block w-full rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700">
        첫 사건 수사하러 가기
      </Link>
    </div>
  );
}
