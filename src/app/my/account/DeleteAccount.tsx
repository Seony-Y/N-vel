"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DELETE_CONFIRM } from "@/lib/account-rules";
import { authClient } from "@/lib/auth-client";

/** 회원 탈퇴: 확인 문구를 입력해야 버튼이 켜진다 */
export function DeleteAccount({ credits }: { credits: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; reauth: boolean } | null>(null);

  async function submit() {
    setPending(true);
    setError(null);
    const res = await fetch("/api/account/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: text }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError({ message: body.error ?? "탈퇴하지 못했습니다", reauth: body.code === "REAUTH" });
      setPending(false);
      return;
    }
    await authClient.signOut().catch(() => null); // 세션은 이미 지워졌지만 쿠키를 정리한다
    router.replace("/?bye=1");
    router.refresh();
  }

  async function reauth() {
    await authClient.signOut();
    router.replace(`/login?next=${encodeURIComponent("/my/account")}`);
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm text-zinc-500 hover:text-red-600 hover:underline">
        회원 탈퇴
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm dark:border-red-900 dark:bg-red-950/30">
      <p className="font-semibold text-red-700 dark:text-red-300">탈퇴하면 아래 정보가 모두 지워지고 되돌릴 수 없어요</p>
      <ul className="list-disc space-y-0.5 pl-5 text-zinc-700 dark:text-zinc-300">
        <li>남은 크레딧 💎 {credits.toLocaleString()} (환불되지 않아요)</li>
        <li>모든 수사 기록과 결과</li>
        <li>내가 만든 사건 (공개한 사건도 사라져요)</li>
      </ul>
      <label className="block">
        <span className="mb-1 block text-zinc-600 dark:text-zinc-400">
          계속하려면 <b>{DELETE_CONFIRM}</b> 를 입력하세요
        </span>
        <input value={text} onChange={(e) => setText(e.target.value)} className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950" />
      </label>
      {error && (
        <p className="text-red-600">
          {error.message}{" "}
          {error.reauth && (
            <button type="button" onClick={reauth} className="font-medium underline">
              다시 로그인하기
            </button>
          )}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => (setOpen(false), setText(""), setError(null))} className="rounded-lg px-3 py-2 hover:bg-white dark:hover:bg-zinc-900">
          취소
        </button>
        <button type="button" onClick={submit} disabled={text !== DELETE_CONFIRM || pending} className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white disabled:opacity-40">
          {pending ? "처리 중..." : "탈퇴하기"}
        </button>
      </div>
    </div>
  );
}
