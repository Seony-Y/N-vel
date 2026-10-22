"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage, VERIFIED_CALLBACK } from "@/lib/auth-rules";

/** 인증 메일 다시 보내기 버튼 (보낸 뒤 60초 동안은 다시 누를 수 없다) */
export function ResendVerification({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function resend() {
    setState("sending");
    setError(null);
    const { error } = await authClient.sendVerificationEmail({ email, callbackURL: VERIFIED_CALLBACK });
    if (error) {
      setError(authErrorMessage(error));
      setState("idle");
      return;
    }
    setState("sent");
    setTimeout(() => setState("idle"), 60_000);
  }

  return (
    <div className="text-center text-sm">
      <button onClick={resend} disabled={state !== "idle"} className="font-medium text-red-600 hover:underline disabled:text-zinc-400 disabled:no-underline">
        {state === "sending" ? "보내는 중..." : state === "sent" ? "다시 보냈어요 (1분 뒤 다시 보낼 수 있어요)" : "인증 메일 다시 보내기"}
      </button>
      {error && <p className="mt-1 text-red-600">{error}</p>}
    </div>
  );
}
