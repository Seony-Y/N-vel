"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

/** 상단 오른쪽: 로그인 상태면 닉네임 + 로그아웃, 아니면 로그인/회원가입 버튼 */
export function UserMenu() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) return <div className="h-9 w-32" />;

  if (!session) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Link href="/login" className="rounded-lg px-3 py-2 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800">
          로그인
        </Link>
        <Link href="/signup" className="rounded-lg bg-violet-600 px-3 py-2 font-semibold text-white hover:bg-violet-700">
          회원가입
        </Link>
      </div>
    );
  }

  async function signOut() {
    await authClient.signOut();
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="font-medium">{session.user.name}님</span>
      <button
        onClick={signOut}
        className="rounded-lg px-3 py-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      >
        로그아웃
      </button>
    </div>
  );
}
