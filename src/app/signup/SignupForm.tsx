"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { safeRedirect } from "@/lib/auth-rules";
import { SIGNUP_BONUS } from "@/lib/credits-config";

/** 가입은 구글 계정으로만 받는다 (메일 인증 없이 바로, 가짜 계정을 대량으로 만들기 어렵다) */
export function SignupForm({ googleEnabled }: { googleEnabled: boolean }) {
  const next = safeRedirect(useSearchParams().get("next"));

  return (
    <AuthCard
      title="가입하기"
      subtitle="가입하고 첫 사건을 수사해 보세요"
      footer={
        <>
          이미 계정이 있나요?{" "}
          <Link href={`/login${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-red-600 hover:underline">
            로그인
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-center text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          🎁 가입하면 <b>💎 {SIGNUP_BONUS} 크레딧</b>을 드려요
        </div>
        <GoogleButton enabled={googleEnabled} next={next} />
        <p className="text-center text-xs leading-relaxed text-zinc-500">
          구글 계정의 이름과 이메일만 받아요.
          <br />
          비밀번호는 N-vel 에 저장되지 않아요.
        </p>
      </div>
    </AuthCard>
  );
}
