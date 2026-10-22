import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetForm } from "./ResetForm";

export const metadata: Metadata = { title: "비밀번호 재설정 | N-vel" };

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
