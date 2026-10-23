import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { Loading } from "@/components/Loading";
import { db } from "@/db";
import { account, user } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { DeleteAccount } from "./DeleteAccount";

export const metadata: Metadata = { title: "계정 설정 | N-vel" };

export default function AccountPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-bold">계정 설정</h1>
        <Suspense fallback={<Loading />}>
          <Account />
        </Suspense>
      </main>
    </>
  );
}

const PROVIDER_LABEL: Record<string, string> = { google: "Google", credential: "이메일·비밀번호" };

async function Account() {
  const userId = await requireUserId("/my/account");
  const [[me], logins] = await Promise.all([
    db.select({ name: user.name, email: user.email, credits: user.credits, createdAt: user.createdAt }).from(user).where(eq(user.id, userId)),
    db.select({ providerId: account.providerId }).from(account).where(eq(account.userId, userId)),
  ]);
  if (!me) notFound();
  const hasPassword = logins.some((l) => l.providerId === "credential");

  return (
    <>
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <dl className="grid grid-cols-[6rem_1fr] gap-y-3 text-sm">
          <dt className="text-zinc-500">닉네임</dt>
          <dd className="font-medium">{me.name}</dd>
          <dt className="text-zinc-500">이메일</dt>
          <dd>{me.email}</dd>
          <dt className="text-zinc-500">로그인 방법</dt>
          <dd>{logins.map((l) => PROVIDER_LABEL[l.providerId] ?? l.providerId).join(", ") || "-"}</dd>
          <dt className="text-zinc-500">가입일</dt>
          <dd>{me.createdAt.toLocaleDateString("ko-KR")}</dd>
          <dt className="text-zinc-500">크레딧</dt>
          <dd>
            💎 {me.credits.toLocaleString()}{" "}
            <Link href="/my/credits" className="ml-1 text-xs text-red-600 hover:underline">
              내역 보기
            </Link>
          </dd>
        </dl>
      </section>

      {hasPassword && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="font-semibold">비밀번호</h2>
          <p className="mt-1 text-sm text-zinc-500">가입한 이메일로 재설정 링크를 받아 바꿀 수 있어요.</p>
          <Link href="/forgot-password" className="mt-3 inline-block rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
            비밀번호 바꾸기
          </Link>
        </section>
      )}

      <section className="px-1">
        <DeleteAccount credits={me.credits} />
      </section>
    </>
  );
}
