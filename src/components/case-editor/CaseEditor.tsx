"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Section } from "@/components/form/fields";
import type { CheckIssue } from "@/lib/cases/check";
import { CaseFile } from "@/lib/cases/format";
import type { Review } from "@/lib/cases/review";
import sample from "../../../content/cases/stage-brooch.json";
import { cleanDraft, emptyDraft, tabForPath, TABS, type Draft, type TabId } from "./draft";
import { BasicTab, CluesTab, EndingsTab, LocationsTab, SuspectsTab, Toggle, TruthTab } from "./sections";

/*
 * 사건 에디터. 탭마다 사건 파일의 일부를 고치고, 저장할 때 CaseFile 검사를 통과해야 한다.
 */

const SEVERITY = {
  error: { icon: "⛔", cls: "text-red-600 dark:text-red-400" },
  warning: { icon: "⚠️", cls: "text-amber-600 dark:text-amber-400" },
  tip: { icon: "💡", cls: "text-zinc-600 dark:text-zinc-300" },
} as const;

export function CaseEditor({ initial, initialPublic, caseId }: { initial: Draft | null; initialPublic: boolean; caseId?: string }) {
  const router = useRouter();
  const [d, setD] = useState<Draft>(() => initial ?? emptyDraft());
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [tab, setTab] = useState<TabId>("basic");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [importing, setImporting] = useState(false);

  const update = (fn: (d: Draft) => void) => {
    setD((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
    setDirty(true);
  };

  // 저장하지 않고 나가려 하면 경고
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  function validate(): CaseFile | null {
    const parsed = CaseFile.safeParse(cleanDraft(d));
    if (parsed.success) {
      setErrors([]);
      return parsed.data;
    }
    const list = parsed.error.issues.map((i) => (i.path.length ? `${pathLabel(d, i.path.join("."))}: ${i.message}` : i.message));
    setErrors(list);
    const first = parsed.error.issues[0];
    if (first?.path.length) setTab(tabForPath(first.path.join(".")));
    return null;
  }

  async function save() {
    setNotice(null);
    const file = validate();
    if (!file) return;
    if (isPublic && file.rating === "19") {
      setErrors(["19세 사건은 성인 인증 기능이 준비될 때까지 공개할 수 없어요"]);
      return;
    }
    setSaving(true);
    const res = await fetch(caseId ? `/api/cases/${caseId}` : "/api/cases", {
      method: caseId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file, isPublic }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setErrors(body.errors ?? [body.error ?? "저장에 실패했습니다"]);
      return;
    }
    setDirty(false);
    if (!caseId) {
      router.replace(`/cases/${body.id}/edit`);
      router.refresh();
    } else {
      setNotice("저장했어요");
      router.refresh();
    }
  }

  async function remove() {
    if (!caseId) return;
    setSaving(true);
    const res = await fetch(`/api/cases/${caseId}`, { method: "DELETE" });
    setSaving(false);
    if (!res.ok) return setErrors(["삭제에 실패했습니다"]);
    setDirty(false);
    router.push("/my/cases");
    router.refresh();
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(cleanDraft(d), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${d.title || "사건"}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function load(file: Draft, message: string) {
    setD(structuredClone(file));
    setDirty(true);
    setErrors([]);
    setNotice(message);
    setTab("basic");
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-28 pt-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{caseId ? "사건 수정" : "사건 만들기"}</h1>
        <div className="flex flex-wrap gap-2 text-sm">
          {!caseId && (
            <button type="button" onClick={() => load(CaseFile.parse(sample), "예시 사건을 불러왔어요. 고쳐서 저장해 보세요")} className="rounded-lg border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
              예시 불러오기
            </button>
          )}
          <button type="button" onClick={() => setImporting(true)} className="rounded-lg border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
            JSON 가져오기
          </button>
          <button type="button" onClick={exportJson} className="rounded-lg border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
            JSON 내보내기
          </button>
          {caseId && (
            <>
              <Link href={`/cases/${caseId}/answer`} className="rounded-lg border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
                정답지
              </Link>
              <Link href={`/cases/${caseId}`} className="rounded-lg border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
                사건 페이지 ↗
              </Link>
            </>
          )}
        </div>
      </div>

      <nav className="sticky top-[57px] z-10 -mx-4 mt-4 flex flex-wrap gap-x-1 border-b border-zinc-200 bg-[var(--background)] px-4 sm:-mx-6 sm:px-6 dark:border-zinc-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition ${tab === t.id ? "border-red-600 text-red-600" : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"}`}
          >
            {t.label}
            {t.id === "suspects" && <span className="ml-1 text-xs text-zinc-400">{d.suspects.length}</span>}
            {t.id === "clues" && <span className="ml-1 text-xs text-zinc-400">{d.clues.length}</span>}
          </button>
        ))}
      </nav>

      {errors.length > 0 && (
        <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <p className="mb-1 font-semibold">저장하려면 고쳐야 할 곳이 있어요</p>
          <ul className="list-disc space-y-0.5 pl-5">
            {errors.slice(0, 10).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 space-y-6">
        {tab === "basic" && <BasicTab d={d} update={update} />}
        {tab === "locations" && <LocationsTab d={d} update={update} />}
        {tab === "suspects" && <SuspectsTab d={d} update={update} />}
        {tab === "clues" && <CluesTab d={d} update={update} />}
        {tab === "truth" && <TruthTab d={d} update={update} />}
        {tab === "endings" && <EndingsTab d={d} update={update} />}
        {tab === "review" && <ReviewTab d={d} isPublic={isPublic} setIsPublic={(v) => (setIsPublic(v), setDirty(true))} caseId={caseId} />}
      </div>

      {importing && <ImportDialog onClose={() => setImporting(false)} onLoad={(f) => (load(f, "JSON 을 불러왔어요. 확인 후 저장하세요"), setImporting(false))} />}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <p className="min-w-0 flex-1 truncate text-sm text-zinc-500">{notice ?? (dirty ? "저장하지 않은 변경 사항이 있어요" : isPublic ? "🌐 공개 중" : "🔒 비공개")}</p>
          {caseId &&
            (confirmDelete ? (
              <>
                <span className="hidden text-sm text-zinc-500 sm:inline">플레이 기록까지 모두 지워져요</span>
                <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-lg px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  취소
                </button>
                <button type="button" onClick={remove} disabled={saving} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
                  삭제
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40">
                삭제
              </button>
            ))}
          <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** "clues.3.name" → "단서 「수첩」.name" 처럼 읽기 쉽게 */
function pathLabel(d: Draft, path: string) {
  const [head, idx, ...rest] = path.split(".");
  const i = Number(idx);
  const tail = rest.length ? ` ${rest.join(".")}` : "";
  if (head === "locations" && d.locations[i]) return `장소 「${d.locations[i].name || i + 1}」${tail}`;
  if (head === "suspects" && d.suspects[i]) return `용의자 「${d.suspects[i].name || i + 1}」${tail}`;
  if (head === "clues" && d.clues[i]) return `단서 「${d.clues[i].name || i + 1}」${tail}`;
  if (head === "quiz") return `객관식 ${i + 1}${tail}`;
  return path;
}

function ReviewTab({ d, isPublic, setIsPublic, caseId }: { d: Draft; isPublic: boolean; setIsPublic: (v: boolean) => void; caseId?: string }) {
  const [checks, setChecks] = useState<CheckIssue[] | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [pending, setPending] = useState<"check" | "ai" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function run(ai: boolean) {
    setPending(ai ? "ai" : "check");
    setError(null);
    const res = await fetch("/api/cases/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file: cleanDraft(d), ai }) });
    const body = await res.json().catch(() => ({}));
    setPending(null);
    if (body.checks) setChecks(body.checks);
    if (!res.ok) return setError(body.errors ? `${body.error}: ${body.errors[0]}` : (body.error ?? "검수에 실패했습니다"));
    if (ai) setReview(body.review);
  }

  return (
    <>
      <Section title="검수" description="저장하기 전에 사건이 공정하게 풀리는지 확인해 보세요">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => run(false)} disabled={!!pending} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800">
            {pending === "check" ? "점검 중..." : "자동 점검 (무료)"}
          </button>
          <button type="button" onClick={() => run(true)} disabled={!!pending} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900">
            {pending === "ai" ? "AI 가 사건을 읽는 중... (1분 정도)" : "🤖 AI 검수"}
          </button>
        </div>
        <p className="text-xs text-zinc-500">AI 검수는 해결 가능성, 타임라인 모순, 난이도, 정보 유출을 확인해요. 한 시간에 10번까지 할 수 있어요.</p>
        {error && <p className="text-sm text-red-600">{error}</p>}

        {checks && (
          <div>
            <h3 className="mb-2 text-sm font-semibold">자동 점검</h3>
            {checks.length === 0 ? (
              <p className="text-sm text-emerald-600">✅ 발견된 문제가 없어요</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {checks.map((c, i) => (
                  <li key={i} className={SEVERITY[c.severity].cls}>
                    {SEVERITY[c.severity].icon} {c.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {review && (
          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <h3 className="mb-1 text-sm font-semibold">
              AI 검수 결과: {review.verdict === "good" ? "✅ 좋아요" : review.verdict === "needs_work" ? "🛠 다듬으면 좋아요" : "⛔ 풀 수 없는 문제가 있어요"}
            </h3>
            <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-300">{review.summary}</p>
            <ul className="space-y-2 text-sm">
              {review.issues.map((x, i) => (
                <li key={i} className={SEVERITY[x.severity].cls}>
                  {SEVERITY[x.severity].icon} <b>{x.area}</b> — {x.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Section title="공개" description="공개하면 사건 목록에 보이고 누구나 플레이할 수 있어요. 비공개 사건도 나는 직접 플레이해 볼 수 있어요">
        <Toggle title="🌐 공개" hint={d.rating === "19" ? "19세 사건은 아직 공개할 수 없어요" : "저장해야 반영돼요"} checked={isPublic} onChange={setIsPublic} />
        {caseId && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-500">공유 링크</span>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(`${location.origin}/cases/${caseId}`);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              {copied ? "복사했어요" : "링크 복사"}
            </button>
            {!isPublic && <span className="text-xs text-zinc-400">(비공개라 다른 사람은 열 수 없어요)</span>}
          </div>
        )}
      </Section>
    </>
  );
}

function ImportDialog({ onClose, onLoad }: { onClose: () => void; onLoad: (f: Draft) => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return setError("JSON 형식이 아니에요");
    }
    const parsed = CaseFile.safeParse(json);
    if (!parsed.success) {
      const i = parsed.error.issues[0];
      return setError(`${i.path.join(".") || "사건"}: ${i.message}`);
    }
    onLoad({ ...parsed.data, slug: undefined });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-white p-5 dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-2 text-lg font-semibold">JSON 가져오기</h2>
        <p className="mb-3 text-sm text-zinc-500">JSON 내보내기로 저장한 사건 파일 내용을 붙여넣으세요. 지금 편집 중인 내용은 바뀝니다.</p>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={14} spellCheck={false} className="w-full rounded-lg border border-zinc-300 bg-white p-3 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950" />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">
            취소
          </button>
          <button onClick={submit} disabled={!text.trim()} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            불러오기
          </button>
        </div>
      </div>
    </div>
  );
}
