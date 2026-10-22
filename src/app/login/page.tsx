import type { Metadata } from "next";
import { Suspense } from "react";
import { googleEnabled } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "로그인 | N-vel" };

export default function LoginPage() {
  // useSearchParams 를 쓰는 클라이언트 컴포넌트는 Suspense 로 감싸야 한다
  return (
    <Suspense>
      <LoginForm googleEnabled={googleEnabled} />
    </Suspense>
  );
}
