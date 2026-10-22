"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { AuthCard, Field, FormError, SubmitButton } from "@/components/auth/AuthCard";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage, NAME_MAX, PASSWORD_MAX, PASSWORD_MIN, safeRedirect } from "@/lib/auth-rules";

export function SignupForm() {
  const router = useRouter();
  const next = safeRedirect(useSearchParams().get("next"));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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

    // 가입에 성공하면 바로 로그인된 상태가 된다
    const { error } = await authClient.signUp.email({
      name,
      email: String(form.get("email")),
      password,
    });

    if (error) {
      setError(authErrorMessage(error));
      setPending(false);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <AuthCard
      title="회원가입"
      subtitle="나만의 캐릭터와 이야기를 시작해 보세요"
      footer={
        <>
          이미 계정이 있나요?{" "}
          <Link href={`/login${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-violet-600 hover:underline">
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
