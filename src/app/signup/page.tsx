import type { Metadata } from "next";
import { Suspense } from "react";
import { googleEnabled } from "@/lib/auth";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = { title: "회원가입 | N-vel" };

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm googleEnabled={googleEnabled} />
    </Suspense>
  );
}
