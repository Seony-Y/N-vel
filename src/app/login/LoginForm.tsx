"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { AuthCard, Field, FormError, SubmitButton } from "@/components/auth/AuthCard";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { ResendVerification } from "@/components/auth/ResendVerification";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage, safeRedirect, VERIFIED_CALLBACK } from "@/lib/auth-rules";

export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeRedirect(params.get("next"));
  const notice = params.get("reset") === "done" ? "비밀번호를 바꿨어요. 새 비밀번호로 로그인하세요." : null;
  const [error, setError] = useState<string | null>(params.get("error") ? "구글 로그인에 실패했어요. 다시 시도해 주세요." : null);
  const [pending, setPending] = useState(false);
  const [unverified, setUnverified] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(null);

    const email = String(form.get("email"));
    const { error } = await authClient.signIn.email({ email, password: String(form.get("password")), callbackURL: VERIFIED_CALLBACK });

    if (error) {
      setUnverified(error.code === "EMAIL_NOT_VERIFIED" ? email : null);
      setError(authErrorMessage(error));
      setPending(false);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <AuthCard
      title="로그인"
      subtitle="다시 오신 걸 환영해요"
      footer={
        <>
          처음이신가요?{" "}
          <Link href={`/signup${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-red-600 hover:underline">
            가입하기
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        {notice && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{notice}</p>}
        <div>
          <GoogleButton enabled={googleEnabled} next={next} />
          {/* 처음 쓰는 구글 계정이면 여기서도 바로 가입되므로 같은 조건을 알린다 */}
          <p className="mt-2 text-center text-xs leading-relaxed text-zinc-500">
            처음이면 자동으로 가입돼요. 계속하면 만 14세 이상이며{" "}
            <Link href="/terms" target="_blank" className="underline underline-offset-2">
              이용약관
            </Link>
            ·
            <Link href="/privacy" target="_blank" className="underline underline-offset-2">
              개인정보처리방침
            </Link>
            에 동의하는 것으로 봐요.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs text-zinc-400">
          <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          또는 이메일로 로그인
          <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="이메일" name="email" type="email" autoComplete="email" required />
          <Field label="비밀번호" name="password" type="password" autoComplete="current-password" required />
          <FormError message={error} />
          <SubmitButton pending={pending}>이메일로 로그인</SubmitButton>
          {unverified && <ResendVerification email={unverified} />}
          <p className="text-center text-sm">
            <Link href="/forgot-password" className="text-zinc-500 hover:text-zinc-800 hover:underline dark:hover:text-zinc-200">
              비밀번호를 잊으셨나요?
            </Link>
          </p>
        </form>
      </div>
    </AuthCard>
  );
}
