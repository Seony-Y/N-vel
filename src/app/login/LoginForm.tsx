"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { AuthCard, Field, FormError, SubmitButton } from "@/components/auth/AuthCard";
import { ResendVerification } from "@/components/auth/ResendVerification";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage, safeRedirect, VERIFIED_CALLBACK } from "@/lib/auth-rules";

export function LoginForm() {
  const router = useRouter();
  const next = safeRedirect(useSearchParams().get("next"));
  const [error, setError] = useState<string | null>(null);
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
          아직 계정이 없나요?{" "}
          <Link href={`/signup${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-red-600 hover:underline">
            회원가입
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="이메일" name="email" type="email" autoComplete="email" required autoFocus />
        <Field label="비밀번호" name="password" type="password" autoComplete="current-password" required />
        <FormError message={error} />
        <SubmitButton pending={pending}>로그인</SubmitButton>
        {unverified && <ResendVerification email={unverified} />}
      </form>
    </AuthCard>
  );
}
