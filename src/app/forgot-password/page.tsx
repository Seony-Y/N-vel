"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthCard, Field, FormError, SubmitButton } from "@/components/auth/AuthCard";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-rules";

/** 비밀번호 찾기: 이메일로 가입한 계정에 재설정 링크를 보낸다 (구글 계정은 해당 없음) */
export default function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email"));
    setPending(true);
    setError(null);
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    setPending(false);
    if (error) return setError(authErrorMessage(error));
    // 가입 여부를 알려주지 않기 위해, 있든 없든 같은 안내를 보여준다
    setSentTo(email);
  }

  return (
    <AuthCard title="비밀번호 찾기" subtitle="이메일로 가입한 계정의 비밀번호를 다시 정해요" footer={<Link href="/login" className="font-medium text-red-600 hover:underline">로그인으로 돌아가기</Link>}>
      {sentTo ? (
        <div className="space-y-3 text-center text-sm leading-relaxed">
          <p className="text-4xl">📮</p>
          <p>
            <b>{sentTo}</b> 이 가입된 이메일이라면
            <br />
            비밀번호 재설정 링크를 보냈어요. (1시간 동안 유효)
          </p>
          <p className="text-xs text-zinc-500">메일이 안 보이면 스팸함도 확인해 주세요.</p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <p className="rounded-lg bg-zinc-100 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">구글로 가입했다면 비밀번호가 따로 없어요. 로그인 화면에서 Google 로 계속하기를 눌러 주세요.</p>
          <Field label="가입한 이메일" name="email" type="email" autoComplete="email" required autoFocus />
          <FormError message={error} />
          <SubmitButton pending={pending}>재설정 링크 받기</SubmitButton>
        </form>
      )}
    </AuthCard>
  );
}
