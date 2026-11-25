"use client";

import Link from "next/link";
import { useState } from "react";
import { REPORT_REASONS, type ReportReason } from "@/lib/feedback-config";

/** 사건 신고. 로그인 전이면 로그인 화면으로 */
export function ReportCase({ caseId, loggedIn }: { caseId: string; loggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState<{ text: string; done: boolean } | null>(null);

  const link = "text-xs text-zinc-400 hover:text-red-600 hover:underline";
  if (!loggedIn) {
    return (
      <Link href={`/login?next=${encodeURIComponent(`/cases/${caseId}`)}`} className={link}>
        🚩 신고
      </Link>
    );
  }
  if (note?.done) return <p role="status" className="text-xs text-zinc-500">{note.text}</p>;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={link}>
        🚩 신고
      </button>
    );
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (pending || !reason) return;
    setPending(true);
    const res = await fetch(`/api/cases/${caseId}/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason, message }) }).catch(() => null);
    setPending(false);
    if (res?.ok) return setNote({ text: "신고를 보냈어요. 관리자가 확인할게요.", done: true });
    setNote({ text: (await res?.json().catch(() => ({})))?.error ?? "보내지 못했어요. 잠시 후 다시 시도해 주세요", done: res?.status === 409 });
  }

  return (
    <form onSubmit={send} className="space-y-2 rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-700">
      <p className="font-medium">🚩 이 사건 신고하기</p>
      <select aria-label="신고 이유" value={reason} onChange={(e) => setReason(e.target.value as ReportReason)} className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950">
        <option value="">이유를 고르세요</option>
        {Object.entries(REPORT_REASONS).map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </select>
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} rows={2} placeholder="어떤 부분이 문제인지 알려 주세요 (선택)" className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950" />
      {note && <p className="text-red-600">{note.text}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">
          취소
        </button>
        <button type="submit" disabled={!reason || pending} className="rounded-lg bg-red-600 px-3 py-1.5 font-semibold text-white disabled:opacity-50">
          {pending ? "보내는 중..." : "신고하기"}
        </button>
      </div>
    </form>
  );
}
