"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { AuthCard, Field, FormError, SubmitButton } from "@/components/auth/AuthCard";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage, PASSWORD_MAX, PASSWORD_MIN } from "@/lib/auth-rules";

/** 메일의 재설정 링크를 누르면 ?token=... 이 붙어 온다. 만료됐으면 ?error=INVALID_TOKEN */
export function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!token || params.get("error")) {
    return (
      <AuthCard title="링크가 만료됐어요" footer={<Link href="/login" className="font-medium text-red-600 hover:underline">로그인으로</Link>}>
        <div className="space-y-4 text-center text-sm">
          <p className="text-4xl">⏰</p>
          <p>재설정 링크가 만료됐거나 이미 사용됐어요.</p>
          <Link href="/forgot-password" className="inline-block w-full rounded-lg bg-red-600 py-2.5 font-semibold text-white hover:bg-red-700">
            링크 다시 받기
          </Link>
        </div>
      </AuthCard>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const newPassword = String(form.get("password"));
    if (newPassword !== form.get("passwordConfirm")) return setError("비밀번호가 서로 다릅니다.");
    setPending(true);
    setError(null);
    const { error } = await authClient.resetPassword({ newPassword, token: token! });
    if (error) {
      setError(error.code === "INVALID_TOKEN" ? "링크가 만료됐어요. 비밀번호 찾기를 다시 해 주세요." : authErrorMessage(error));
      setPending(false);
      return;
    }
    router.replace("/login?reset=done");
  }

  return (
    <AuthCard title="새 비밀번호 정하기" subtitle="바꾸면 다른 기기의 로그인은 모두 끊겨요" footer={<Link href="/login" className="font-medium text-red-600 hover:underline">로그인으로</Link>}>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="새 비밀번호" name="password" type="password" autoComplete="new-password" required minLength={PASSWORD_MIN} maxLength={PASSWORD_MAX} hint={`${PASSWORD_MIN}자 이상`} autoFocus />
        <Field label="새 비밀번호 확인" name="passwordConfirm" type="password" autoComplete="new-password" required />
        <FormError message={error} />
        <SubmitButton pending={pending}>비밀번호 바꾸기</SubmitButton>
      </form>
    </AuthCard>
  );
}
