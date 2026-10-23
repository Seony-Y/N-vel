"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { safeRedirect } from "@/lib/auth-rules";
import { SIGNUP_BONUS } from "@/lib/credits-config";

/** 가입은 구글 계정으로만 받는다 (메일 인증 없이 바로, 가짜 계정을 대량으로 만들기 어렵다) */
export function SignupForm({ googleEnabled }: { googleEnabled: boolean }) {
  const next = safeRedirect(useSearchParams().get("next"));
  // 구글은 나이를 알려 주지 않으므로 만 14세 이상 여부와 약관 동의는 본인 확인(체크)으로 받는다
  const [agreed, setAgreed] = useState(false);

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
        <label className="flex items-start gap-2.5 rounded-lg border border-zinc-200 px-3 py-2.5 text-sm dark:border-zinc-800">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-red-600" />
          <span>
            <b className="font-medium">(필수)</b> 만 14세 이상이며,{" "}
            <Link href="/terms" target="_blank" className="text-red-600 underline underline-offset-2">
              이용약관
            </Link>
            과{" "}
            <Link href="/privacy" target="_blank" className="text-red-600 underline underline-offset-2">
              개인정보처리방침
            </Link>
            에 동의합니다
          </span>
        </label>
        <GoogleButton enabled={googleEnabled} next={next} blocked={!agreed} />
        <p className="text-center text-xs leading-relaxed text-zinc-500">
          구글 계정의 이름, 이메일, 프로필 사진만 받아요.
          <br />
          비밀번호는 N-vel 에 저장되지 않아요.
        </p>

      </div>
    </AuthCard>
  );
}
