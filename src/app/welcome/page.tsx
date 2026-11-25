import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { getUserId } from "@/lib/auth";
import { safeRedirect } from "@/lib/auth-rules";
import { getBalance } from "@/lib/credits";
import { findPrologue } from "@/lib/game/catalog";

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
  const { error, next: rawNext } = await searchParams;
  const next = safeRedirect(typeof rawNext === "string" ? rawNext : null); // 가입 전에 보던 곳
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

  const [balance, prologue] = await Promise.all([getBalance(userId), findPrologue()]);
  return (
    <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-4xl">🎉</p>
      <h1 className="mt-3 text-xl font-semibold">가입을 환영해요</h1>
      <p className="mt-2 text-sm text-zinc-500">{balance > 0 ? "가입 선물로 크레딧을 드렸어요." : "이 이메일은 전에 가입 선물을 받아 다시 드리지 않아요. 프롤로그는 무료로 할 수 있어요."}</p>
      <p className="mt-4 text-3xl font-bold tabular-nums">💎 {balance.toLocaleString()}</p>
      {/* 첫 사건은 프롤로그로. 가이드를 따라 하는 법을 익힌다 */}
      <Link href={next !== "/" ? next : prologue ? `/cases/${prologue.id}` : "/"} className="mt-6 inline-block w-full rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700">
        {next !== "/" ? "🔎 보던 사건 이어서 시작하기" : prologue ? "🧭 프롤로그로 시작하기" : "첫 사건 수사하러 가기"}
      </Link>
    </div>
  );
}
