"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { AuthCard, Field, FormError, SubmitButton } from "@/components/auth/AuthCard";
import { ResendVerification } from "@/components/auth/ResendVerification";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage, NAME_MAX, PASSWORD_MAX, PASSWORD_MIN, safeRedirect, VERIFIED_CALLBACK } from "@/lib/auth-rules";
import { SIGNUP_BONUS } from "@/lib/credits-config";

export function SignupForm() {
  const next = safeRedirect(useSearchParams().get("next"));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name")).trim();
    const password = String(form.get("password"));

    if (password !== form.get("passwordConfirm")) {
      setError("비밀번호가 서로 다릅니다.");
      return;
    }

    setPending(true);
    setError(null);

    // 가입하면 인증 메일이 간다. 메일의 버튼을 눌러야 로그인되고 보너스 크레딧을 받는다
    const email = String(form.get("email"));
    const { error } = await authClient.signUp.email({ name, email, password, callbackURL: VERIFIED_CALLBACK });

    if (error) {
      setError(authErrorMessage(error));
      setPending(false);
      return;
    }
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <AuthCard title="메일함을 확인해 주세요" footer={<Link href="/login" className="font-medium text-red-600 hover:underline">로그인 화면으로</Link>}>
        <div className="space-y-4 text-center">
          <p className="text-4xl">📮</p>
          <p className="text-sm leading-relaxed">
            <b>{sentTo}</b> 으로 인증 메일을 보냈어요.
            <br />
            메일의 <b>이메일 인증하기</b> 버튼을 누르면 가입이 끝나고
            <br />
            <b>💎 {SIGNUP_BONUS} 크레딧</b>을 드려요.
          </p>
          <p className="text-xs text-zinc-500">메일이 안 보이면 스팸함도 확인해 주세요. 링크는 24시간 동안 유효해요.</p>
          <ResendVerification email={sentTo} />
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="회원가입"
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
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="닉네임" name="name" autoComplete="nickname" required maxLength={NAME_MAX} autoFocus />
        <Field label="이메일" name="email" type="email" autoComplete="email" required />
        <Field
          label="비밀번호"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN}
          maxLength={PASSWORD_MAX}
          hint={`${PASSWORD_MIN}자 이상`}
        />
        <Field label="비밀번호 확인" name="passwordConfirm" type="password" autoComplete="new-password" required />
        <FormError message={error} />
        <SubmitButton pending={pending}>가입하기</SubmitButton>
      </form>
    </AuthCard>
  );
}
