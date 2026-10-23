import type { Metadata } from "next";
import { Suspense } from "react";
import { CreditLedger } from "@/components/CreditLedger";
import { SiteHeader } from "@/components/SiteHeader";
import { Loading } from "@/components/Loading";
import { CHAT_MODELS } from "@/lib/ai/models";
import { requireUserId } from "@/lib/auth";
import { getBalance, ledger } from "@/lib/credits";

export const metadata: Metadata = { title: "내 크레딧 | N-vel" };

export default function MyCreditsPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-bold">내 크레딧</h1>
        <Suspense fallback={<Loading />}>
          <MyCredits />
        </Suspense>
      </main>
    </>
  );
}

async function MyCredits() {
  const userId = await requireUserId("/my/credits");
  const [balance, rows] = await Promise.all([getBalance(userId), ledger(userId, 100)]);

  return (
    <>
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-500">잔액</p>
        <p className="mt-1 text-4xl font-bold tabular-nums">💎 {balance.toLocaleString()}</p>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CHAT_MODELS.map((m) => (
            <div key={m.id} className="rounded-xl bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-800/50">
              <div className="font-medium">{m.label}</div>
              <div className="text-xs text-zinc-500">
                행동당 {m.credits} · 약 {Math.floor(balance / m.credits).toLocaleString()}회
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-zinc-400">조사·심문 1회마다 고른 모델의 크레딧이 차감돼요. 장소 이동, 메모, 힌트, 비밀번호 입력, 추리 제출에는 크레딧이 들지 않아요.</p>
      </section>

      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="border-b border-zinc-200 px-4 py-3 font-semibold dark:border-zinc-800">사용 내역</h2>
        <div className="overflow-x-auto">
          <CreditLedger rows={rows} />
        </div>
      </section>
    </>
  );
}
