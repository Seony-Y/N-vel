"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { SandboxedHtml } from "@/components/SandboxedHtml";
import type { PublicCase, PublicClue, PublicMessage, PublicState } from "@/lib/game/public";
import { splitProse } from "@/lib/game/prose";
import { EFFICIENCY_HALF_RATIO, GUIDE_NOTE_MIN, HINT_PENALTY, MAX_EVIDENCE, MAX_NARRATIVE, POINTS, SOLVED_SCORE } from "@/lib/game/rules";
import type { GuestResult } from "@/lib/guest-storage";
import { STATEMENT_PREFIX } from "@/lib/game/statements";

/* 수사 화면의 조각들 (배지, 가이드, 말풍선, 잠금, 수첩, 창). 진행 상태와 서버 요청은 PlayScreen 이 맡는다 */

export type ModelOption = { id: string; label: string; description: string; credits: number };

/** 눌러서 연 창(증거 목록, 말풍선 등): 바깥을 누르거나 Esc 를 누르면 닫는다. 돌려준 ref 를 창과 여는 버튼을 감싼 요소에 단다 */
export function useDismiss<T extends HTMLElement>(open: boolean, close: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

/** 수사 도중 모델 바꾸기. 다음 행동부터 적용된다 */
export function ModelPicker({ models, value, disabled, onChange }: { models: ModelOption[]; value: string; disabled: boolean; onChange: (id: string) => void }) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      aria-label="AI 연기"
      title="AI 연기 (다음 행동부터 적용)"
      className="rounded-full border border-zinc-200 bg-white py-1 pr-7 pl-2.5 text-xs font-medium outline-none focus:outline-none disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
    >
      {models.map((m) => (
        <option key={m.id} value={m.id}>
          {m.label} 💎{m.credits}
        </option>
      ))}
    </select>
  );
}

/**
 * 쓴 행동 수. 목표 행동 수가 있으면 함께 보여 주고, 목표 안이면 초록·넘으면 주황 (막지는 않는다).
 * 마우스를 올리거나 누르면 말풍선으로 설명한다 (휴대폰에서는 title 툴팁이 보이지 않아서)
 */
export function ActionsBadge({ used, target }: { used: number; target: number | null }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss<HTMLSpanElement>(open, close);
  const counted = "조사·질문·증거 제시 1번이 행동 1회예요 (비밀번호를 틀려도 1회, 어려움에서는 단서 잇기를 틀려도 1회). 장소 이동, 메모, 힌트, 추리 제출은 세지 않아요.";
  const over = !!target && used > target;
  return (
    <span ref={ref} className="relative inline-block" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={
          target
            ? `rounded-full px-2.5 py-1 text-xs font-medium tabular-nums outline-none ${over ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"}`
            : "text-xs text-zinc-400 outline-none"
        }
      >
        {target ? `🎯 행동 ${used} / 목표 ${target}` : `행동 ${used}회`}
      </button>
      {open && (
        <span role="tooltip" className="absolute right-0 top-full z-30 mt-1.5 block w-64 rounded-lg bg-zinc-900 px-3 py-2 text-left text-xs leading-relaxed text-white shadow-lg dark:bg-white dark:text-zinc-900">
          {target ? (
            <>
              <b className="font-semibold">목표를 넘겨도 실패가 아니에요.</b> 행동 수에 제한은 없어요.
              <br />
              범인을 맞히면서 {target}회 안에 풀면 효율 보너스 <b className="font-semibold">+{POINTS.efficiency}점</b>, {Math.floor(target * EFFICIENCY_HALF_RATIO)}회 안이면 +{POINTS.efficiency / 2}점을 더 받아요.
              <span className="mt-1 block opacity-70">{counted}</span>
            </>
          ) : (
            <>
              이 사건은 행동 수 제한도 보너스도 없어요.
              <span className="mt-1 block opacity-70">{counted}</span>
            </>
          )}
        </span>
      )}
    </span>
  );
}

/**
 * 프롤로그 사건의 단계별 안내. 목표를 이뤘는지는 화면에 이미 있는 기록(이동·발견한 단서·대화)으로 판단한다.
 * 이룬 단계는 건너뛰므로 순서를 바꿔 진행해도 맞는 단계가 보인다
 */
export function Guide({ data, state, messages, notes, onHint }: { data: PublicCase; state: PublicState; messages: PublicMessage[]; notes: string; onHint: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [folded, setFolded] = useState(false);

  const done = data.guide.map(({ goal }) => {
    if (!goal) return true;
    const asked = (thread: string, prefix = "") => messages.some((m) => m.thread === thread && m.role === "user" && m.content.startsWith(prefix));
    switch (goal.type) {
      case "visit": {
        const loc = data.locations.find((l) => l.id === goal.target);
        return state.currentLocationId === goal.target || messages.some((m) => m.thread === "narrator" && m.role === "event" && m.content.startsWith(`📍 ${loc?.name}\n`));
      }
      case "find":
        return state.foundClues.some((c) => c.id === goal.target);
      case "talk":
        return asked(goal.target ?? "");
      case "present": {
        const clue = state.foundClues.find((c) => c.id === goal.clue);
        return !!clue && asked(goal.target ?? "", `[증거 제시: ${clue.name}]`);
      }
      case "note":
        return notes.trim().length >= GUIDE_NOTE_MIN;
    }
  });
  const firstLeft = done.findIndex((d) => !d);
  const current = firstLeft === -1 ? data.guide.length - 1 : firstLeft;
  const step = data.guide[current];

  return (
    <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm dark:border-emerald-900 dark:bg-emerald-950/30">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => setFolded((v) => !v)} className="min-w-0 truncate text-left font-semibold text-emerald-800 dark:text-emerald-200">
          🧭 가이드 {current + 1}/{data.guide.length} · {step.title}
        </button>
        <div className="flex shrink-0 gap-1 text-xs">
          {!folded && (
            <button type="button" onClick={() => setExpanded((v) => !v)} className="rounded-md px-2 py-1 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/40">
              {expanded ? "현재 단계만" : "전체 단계"}
            </button>
          )}
          <button type="button" onClick={() => setFolded((v) => !v)} className="rounded-md px-2 py-1 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/40">
            {folded ? "펼치기" : "접기"}
          </button>
        </div>
      </div>
      {!folded &&
        (expanded ? (
          <ol className="mt-2 max-h-64 space-y-2 overflow-y-auto">
            {data.guide.map((g, i) => (
              <li key={i} className={i === current ? "" : "opacity-60"}>
                <div className="font-medium">
                  {done[i] && i !== current ? "✅" : i === current ? "👉" : "▫️"} {i + 1}. {g.title}
                </div>
                {i === current && <p className="mt-0.5 whitespace-pre-wrap leading-relaxed text-zinc-700 dark:text-zinc-300">{g.body}</p>}
              </li>
            ))}
          </ol>
        ) : (
          <div className="mt-1 max-h-48 overflow-y-auto">
            <p className="whitespace-pre-wrap leading-relaxed text-zinc-700 dark:text-zinc-300">{step.body}</p>
            {/* 메모 쓰기 단계: 얼마나 썼는지 */}
            {step.goal?.type === "note" && (
              <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                ✏️ 수첩 메모 {Math.min(notes.trim().length, GUIDE_NOTE_MIN)} / {GUIDE_NOTE_MIN}자 · 수첩 탭(모바일) 또는 오른쪽 수첩의 메모 칸에 써 주세요
              </p>
            )}
            {/* 마지막 단계(추리 제출): 자신이 없으면 제출 전에 여기서 바로 힌트를 볼 수 있게 */}
            {current === data.guide.length - 1 && state.hintsTotal > 0 && (
              <div className="mt-2 space-y-1.5">
                {state.hints.map((h, i) => (
                  <p key={i} className="rounded-lg bg-white px-3 py-2 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                    💡 {i + 1}. {h}
                  </p>
                ))}
                {state.hintsUsed < state.hintsTotal && (
                  <button type="button" onClick={onHint} className="rounded-lg border border-emerald-400 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-900/40">
                    💡 힌트 {state.hintsUsed + 1} 보기 (-{HINT_PENALTY}점, {state.hintsTotal - state.hintsUsed}개 남음)
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
    </div>
  );
}

/** 말풍선. 글자가 들어올 때마다 지난 말풍선까지 다시 그리지 않도록 memo */
export const Bubble = memo(function Bubble({ m, name }: { m: PublicMessage; name?: string }) {
  if (m.role === "event" && m.content.startsWith(STATEMENT_PREFIX)) return <p className="text-center text-xs text-zinc-400">{m.content}</p>;
  if (m.role === "event") {
    return <div className="mx-auto max-w-md whitespace-pre-wrap rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">{m.content}</div>;
  }
  const mine = m.role === "user";
  // 나레이션은 말풍선 없이 책처럼, 대화는 말풍선으로
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`whitespace-pre-wrap text-[15px] leading-[1.75] ${mine ? "max-w-[85%] rounded-2xl rounded-br-sm bg-bubble px-4 py-2.5" : name ? "max-w-[85%] rounded-2xl rounded-bl-sm bg-zinc-100 px-4 py-2.5 dark:bg-zinc-800" : "max-w-[42rem] px-1 font-serif"}`}>
        {!mine && name && <div className="mb-0.5 text-xs font-semibold text-zinc-500">{name}</div>}
        {mine ? m.content : splitProse(m.content).map((p, i) => (p.action ? <em key={i} className="text-zinc-500 dark:text-zinc-400">{p.text}</em> : p.text))}
      </div>
    </div>
  );
});

/** 대화 중에 찾은 단서: 무엇을 찾았는지, 누구와 관련 있어 보이는지, 이걸로 무엇을 할 수 있는지 */
export const FoundClue = memo(function FoundClue({ clue, suspects, inInterrogation, onOpen }: { clue: PublicClue; suspects: PublicCase["suspects"]; inInterrogation: boolean; onOpen: (c: PublicClue) => void }) {
  // 단서 내용에 이름이 나오는 사람만 보여 준다 (내용에 이미 있는 정보라 정답을 흘리지 않음)
  const related = suspects.filter((s) => clue.description.includes(s.name));
  return (
    <div className="mx-auto w-full max-w-md rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-medium text-amber-700 dark:text-amber-300">🔍 단서 발견 · {clue.source}</div>
          <div className="mt-0.5 font-semibold text-zinc-900 dark:text-zinc-100">{clue.name}</div>
        </div>
        <button type="button" onClick={() => onOpen(clue)} className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/40">
          자세히
        </button>
      </div>
      <p className="mt-1.5 whitespace-pre-wrap leading-relaxed text-zinc-700 dark:text-zinc-300">{clue.description}</p>
      <p className="mt-2 text-xs text-zinc-500">
        {related.length ? `관련 인물: ${related.map((s) => s.name).join(", ")} · ` : ""}
        {inInterrogation ? "수첩에 적었어요. 이 내용을 더 캐묻거나 다른 용의자에게 증거로 제시해 보세요." : "수첩에 적었어요. 용의자를 심문할 때 '증거 제시'로 들이밀 수 있어요."}
      </p>
    </div>
  );
});

export function LockInput({ label, disabled, onSubmit }: { label: string; disabled: boolean; onSubmit: (code: string) => Promise<void> }) {
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!code.trim() || pending) return; // 두 번 눌러 행동이 두 번 세지 않게
        setPending(true);
        await onSubmit(code.trim());
        setCode("");
        setPending(false);
      }}
      className="space-y-1.5 border-t border-zinc-200 bg-zinc-50 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950"
    >
      {/* 윗줄: 잠긴 물건과 안내 / 아랫줄: 입력칸과 열기 (좁은 화면에서 한 줄에 몰리지 않게) */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-sm font-medium">🔒 {label}</span>
        <span className="shrink-0 whitespace-nowrap text-[11px] text-zinc-400">틀리면 행동 1회</span>
      </div>
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="비밀번호 입력"
          maxLength={30}
          disabled={disabled}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label={`${label} 비밀번호`}
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button type="submit" disabled={disabled || pending || !code.trim()} className="shrink-0 whitespace-nowrap rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-200 dark:text-zinc-900">
          {pending ? "여는 중…" : "열기"}
        </button>
      </div>
    </form>
  );
}

/** 수첩: 단서·진술·힌트·메모. 추리 제출과 수사 포기는 대화창 위에 따로 있다 */
export function Notebook({
  state,
  statements,
  onCombine,
  onOpenClue,
  onHint,
  notes,
  onNotesChange,
  restorable,
  notesDirty,
  savingNotes,
  onSaveNotes,
}: {
  state: PublicState;
  statements: { name: string; items: PublicMessage[] }[]; // 용의자별 진술
  onCombine: (clueIds: string[]) => Promise<boolean>;
  onOpenClue: (c: PublicClue) => void;
  onHint: () => void;
  notes: string;
  onNotesChange: (v: string) => void;
  restorable: string | null; // 지난번에 임시저장하지 않은 메모
  notesDirty: boolean;
  savingNotes: boolean;
  onSaveNotes: () => void;
}) {
  // 단서 연결: 고르는 중이면 고른 단서 id 목록, 아니면 null
  const [linking, setLinking] = useState<string[] | null>(null);
  const [pending, setPending] = useState(false);
  const [showStep, setShowStep] = useState(false);
  const toggle = (id: string) => setLinking((l) => l && (l.includes(id) ? l.filter((x) => x !== id) : l.length < 3 ? [...l, id] : l));

  return (
    <div className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">📒 단서 ({state.foundClues.length})</h3>
          {state.links.total > 0 && state.foundClues.length >= 2 && (
            <button type="button" onClick={() => setLinking(linking ? null : [])} className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
              {linking ? "취소" : `🧩 단서 잇기 (${state.links.found}/${state.links.total})`}
            </button>
          )}
        </div>
        {!linking && state.links.ready && <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">🧩 지금 이을 수 있는 단서가 있어요!</p>}
        {linking && (
          <div className="mb-2 space-y-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            <p>함께 보면 새로운 사실이 드러나는 단서 2~3개를 고르세요. 맞으면 새 단서를 얻고{state.mode === "hard" ? ", 틀리면 행동 1회로 세요" : ", 틀려도 괜찮아요"}. 크레딧은 들지 않아요.</p>
            <button
              type="button"
              disabled={linking.length < 2 || pending}
              onClick={async () => {
                setPending(true);
                if (await onCombine(linking)) setLinking(null);
                setPending(false);
              }}
              className="w-full rounded-lg bg-red-600 py-2 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {linking.length}개 잇기
            </button>
          </div>
        )}
        {state.foundClues.length === 0 ? (
          <p className="text-sm text-zinc-400">아직 찾은 단서가 없어요.</p>
        ) : (
          <ul className="space-y-1.5">
            {state.foundClues.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => (linking ? toggle(c.id) : onOpenClue(c))}
                  aria-pressed={linking ? linking.includes(c.id) : undefined}
                  className={`block w-full rounded-lg border px-3 py-2 text-left hover:border-red-300 ${linking?.includes(c.id) ? "border-red-600 bg-red-50 dark:bg-red-950/30" : "border-zinc-200 dark:border-zinc-800"}`}
                >
                  <div className="text-sm font-medium">{c.name}</div>
                  <div className="text-xs text-zinc-500">{c.source}</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 쉬움: 막혔을 때 다음에 할 일 (무료, 감점 없음) */}
      {state.nextStep && (
        <div>
          <button type="button" onClick={() => setShowStep((v) => !v)} aria-expanded={showStep} className="w-full rounded-lg border border-emerald-400 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-950/30">
            🧭 막혔어요, 뭘 할까요? (무료)
          </button>
          {showStep && <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm leading-relaxed text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">{state.nextStep}</p>}
        </div>
      )}

      {statements.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">📝 진술</h3>
          <div className="space-y-2">
            {statements.map((s) => (
              <details key={s.name} open className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
                <summary className="cursor-pointer font-medium">
                  {s.name} <span className="text-xs font-normal text-zinc-400">{s.items.length}</span>
                </summary>
                <ul className="mt-1.5 list-disc space-y-1 pl-4 leading-relaxed text-zinc-600 dark:text-zinc-300">
                  {s.items.map((m) => (
                    <li key={m.id}>{m.content.slice(STATEMENT_PREFIX.length)}</li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-zinc-400">용의자가 한 말이에요. 사실이 아닐 수 있으니 단서와 비교해 보세요.</p>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">💡 힌트</h3>
          <button
            onClick={onHint}
            disabled={state.hintsUsed >= state.hintsTotal}
            className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:text-zinc-400 disabled:hover:bg-transparent dark:hover:bg-red-950/30"
          >
            {state.hintsUsed >= state.hintsTotal ? "힌트 없음" : `힌트 보기 (-${HINT_PENALTY}점, ${state.hintsTotal - state.hintsUsed}개 남음)`}
          </button>
        </div>
        {state.hints.map((h, i) => (
          <p key={i} className="mb-1.5 rounded-lg bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-800/50">
            {h}
          </p>
        ))}
      </div>

      {/* 메모는 자동 저장하지 않는다. 화면에서는 유지되고, 임시저장을 눌러야 저장된다 */}
      <div>
        <h3 className="mb-2 flex items-center justify-between text-sm font-semibold">
          ✏️ 메모
          <span className={`text-xs font-normal ${notesDirty ? "text-amber-600" : "text-zinc-400"}`}>{savingNotes ? "저장 중…" : notesDirty ? "저장 안 됨" : "저장됨"}</span>
        </h3>
        {restorable !== null && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            <span>지난번에 임시저장하지 않은 메모가 있어요</span>
            <button type="button" onClick={() => onNotesChange(restorable)} className="shrink-0 rounded-md px-2 py-1 font-medium hover:bg-amber-100 dark:hover:bg-amber-900/40">
              되살리기
            </button>
          </div>
        )}
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={6}
          maxLength={10000}
          placeholder="추리를 정리해 보세요"
          className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-500 dark:border-zinc-700 dark:bg-zinc-950"
        />
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <p className={`text-xs ${notesDirty ? "text-amber-600" : "text-zinc-400"}`}>{notesDirty ? "나가기 전에 임시저장을 눌러 주세요" : "임시저장한 메모는 다음에 이어서 볼 수 있어요"}</p>
          <button
            onClick={onSaveNotes}
            disabled={!notesDirty || savingNotes}
            className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            💾 임시저장
          </button>
        </div>
      </div>
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="닫기">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** 사건 개요: 수사 도중에 무슨 사건인지 다시 확인한다 (사건 페이지에 공개된 정보만) */
export function StoryModal({ data, onClose }: { data: PublicCase; onClose: () => void }) {
  return (
    <Modal title={`📁 ${data.title}`} onClose={onClose}>
      {data.tagline && <p className="mb-4 text-sm text-zinc-500">{data.tagline}</p>}
      <h3 className="mb-1 text-sm font-semibold text-zinc-500">사건 개요</h3>
      <p className="whitespace-pre-wrap font-serif leading-[1.8]">{data.briefing}</p>
      {data.victim && (
        <>
          <h3 className="mb-1 mt-5 text-sm font-semibold text-zinc-500">피해자</h3>
          <p className="leading-relaxed">{data.victim}</p>
        </>
      )}
      <h3 className="mb-2 mt-5 text-sm font-semibold text-zinc-500">용의자</h3>
      <ul className="space-y-2">
        {data.suspects.map((s) => (
          <li key={s.id} className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50">
            <div className="text-sm font-medium">
              {s.name}
              {s.age && <span className="ml-1 font-normal text-zinc-400">{s.age}세</span>}
              <span className="ml-2 text-xs font-normal text-zinc-500">{s.role}</span>
            </div>
            {s.profile && <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">{s.profile}</p>}
          </li>
        ))}
      </ul>
    </Modal>
  );
}

export function ClueModal({ clue, onClose }: { clue: PublicClue; onClose: () => void }) {
  return (
    <Modal title={clue.name} onClose={onClose}>
      <p className="mb-3 text-xs text-zinc-500">{clue.source}</p>
      {clue.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={clue.image} alt="" referrerPolicy="no-referrer" className="mb-3 w-full rounded-lg" />
      )}
      <p className="whitespace-pre-wrap leading-relaxed">{clue.description}</p>
      {clue.docHtml && (
        <div className="mt-4 h-80 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <SandboxedHtml title={clue.name} code={clue.docHtml} className="h-full w-full border-0 bg-white" />
        </div>
      )}
    </Modal>
  );
}

export function AccuseModal({
  data,
  state,
  notes,
  narrative,
  onNarrative,
  onClose,
  onSubmit,
  onDone,
}: {
  data: PublicCase;
  state: PublicState;
  notes: string;
  narrative: string;
  onNarrative: (v: string) => void;
  onClose: () => void;
  onSubmit: (body: unknown) => Promise<Response>;
  onDone: (accusation: { culpritId: string; answers: number[]; evidenceIds: string[] }, result: GuestResult) => void;
}) {
  const [culpritId, setCulpritId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<number[]>(data.quiz.map(() => -1));
  const [evidence, setEvidence] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const ready = culpritId && answers.every((a) => a >= 0);
  const checklist = data.guide.find((g) => g.goal?.type === "note")?.body;

  async function submit() {
    setPending(true);
    setError(null);
    // 서술 채점을 기다리느라 오래 걸릴 수 있다. 연결이 끊겨도 버튼이 멈춰 있지 않게
    const res = await onSubmit({ culpritId, answers, evidenceIds: evidence, narrative: data.scripted ? "" : narrative }).catch(() => null);
    if (!res?.ok) {
      setError((await res?.json().catch(() => ({})))?.error ?? "제출하지 못했어요. 연결을 확인하고 다시 제출해 주세요");
      setPending(false);
      return;
    }
    onDone({ culpritId: culpritId!, answers, evidenceIds: evidence }, (await res.json().catch(() => ({}))).result);
  }

  return (
    <Modal title="⚖️ 추리 제출" onClose={onClose}>
      <p className="mb-3 text-sm text-zinc-500">제출하면 사건이 끝나고 결과가 공개됩니다. 다시 수정할 수 없어요.</p>
      {/* 채점 기준 (rules.ts 의 값 그대로) */}
      <p className="mb-5 rounded-lg bg-zinc-50 px-3 py-2 text-xs leading-relaxed text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400">
        📊 범인 {POINTS.culprit}점 · 질문 {POINTS.quiz}점 · 결정적 증거 {POINTS.evidence}점 · 힌트 1개당 -{HINT_PENALTY}점
        {!data.scripted && ` · 추리 서술(선택) 보너스 최대 +${POINTS.narrative}점`}
        {data.targetActions && ` · 목표 행동(${data.targetActions}회) 안에 풀면 효율 보너스 +${POINTS.efficiency}점`}
        <br />
        범인을 맞히고 {data.targetActions ? "효율 보너스를 뺀 점수가 " : ""}{SOLVED_SCORE}점 이상이면 해결, 범인을 틀리면 나머지를 다 맞혀도 실패예요.
      </p>

      <fieldset className="mb-5">
        <legend className="mb-2 font-medium">범인은 누구인가?</legend>
        <div className="grid grid-cols-2 gap-2">
          {data.suspects.map((s) => (
            <label key={s.id} className={`cursor-pointer rounded-lg border-2 px-3 py-2 text-sm ${culpritId === s.id ? "border-red-600 bg-red-50 dark:bg-red-950/30" : "border-zinc-200 dark:border-zinc-700"}`}>
              <input type="radio" name="culprit" className="sr-only" checked={culpritId === s.id} onChange={() => setCulpritId(s.id)} />
              {s.name}
            </label>
          ))}
        </div>
      </fieldset>

      {data.quiz.map((q, qi) => (
        <fieldset key={qi} className="mb-5">
          <legend className="mb-2 font-medium">{q.question}</legend>
          <div className="space-y-1.5">
            {q.options.map((o, oi) => (
              <label key={oi} className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="radio" name={`q${qi}`} checked={answers[qi] === oi} onChange={() => setAnswers((a) => a.map((v, i) => (i === qi ? oi : v)))} className="accent-red-600" />
                {o}
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      <fieldset className="mb-5">
        <legend className="mb-1 font-medium">결정적 증거 (최대 {MAX_EVIDENCE}개)</legend>
        <p className="mb-2 text-xs text-zinc-500">범행을 증명하는 데 가장 중요한 단서를 고르세요.</p>
        {state.foundClues.length === 0 ? (
          <p className="text-sm text-zinc-400">찾은 단서가 없어요.</p>
        ) : (
          <div className="space-y-1.5">
            {state.foundClues.map((c) => {
              const checked = evidence.includes(c.id);
              return (
                <label key={c.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!checked && evidence.length >= MAX_EVIDENCE}
                    onChange={() => setEvidence((e) => (checked ? e.filter((x) => x !== c.id) : [...e, c.id]))}
                    className="accent-red-600"
                  />
                  {c.name}
                </label>
              );
            })}
          </div>
        )}
      </fieldset>

      {/* 서술은 선택이라 접어 둔다 (쓰던 글이 있으면 펼친다). 대본 사건(프롤로그)에는 없다 */}
      {!data.scripted && (
      <details open={!!narrative.trim() || undefined} className="mb-5 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
        <summary className="mb-1 cursor-pointer font-medium">
          ✍️ 추리 서술 <span className="text-sm font-normal text-zinc-500">(선택 · 보너스 최대 +{POINTS.narrative}점)</span>
        </summary>
        <p className="mb-2 text-xs leading-relaxed text-zinc-500">
          사건의 전말을 내 말로 정리해 보세요. 범인이 <b className="font-medium">언제·어떻게</b> 범행했는지, <b className="font-medium">왜</b> 그랬는지, 범인의 <b className="font-medium">알리바이가 왜 거짓인지</b>와 그 근거가 된 단서를 쓰면 점수가 올라가요. AI 가 사건의 진상과
          비교해 채점해요. 문장력은 상관없어요.
        </p>
        {/* 가이드 사건(프롤로그): '추리 정리하기' 단계의 체크리스트를 쓰면서 볼 수 있게 */}
        {checklist && (
          <details open className="mb-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs dark:bg-emerald-950/30">
            <summary className="cursor-pointer font-semibold text-emerald-800 dark:text-emerald-200">🧭 서술 체크리스트</summary>
            <p className="mt-1.5 whitespace-pre-wrap leading-relaxed text-zinc-700 dark:text-zinc-300">{checklist}</p>
          </details>
        )}
        {/* 수첩 메모는 옮겨 붙이지 않고 보기만. 서술은 직접 쓴다 */}
        {notes.trim() && (
          <details className="mb-2 rounded-lg bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-800/50">
            <summary className="cursor-pointer font-semibold text-zinc-600 dark:text-zinc-300">📒 내 수첩 메모 보기</summary>
            <p className="mt-1.5 max-h-40 overflow-y-auto whitespace-pre-wrap leading-relaxed text-zinc-700 dark:text-zinc-300">{notes.trim()}</p>
          </details>
        )}
        <textarea
          value={narrative}
          onChange={(e) => onNarrative(e.target.value)}
          rows={7}
          maxLength={MAX_NARRATIVE}
          placeholder={"예) ○○는 △시쯤 모두가 □□에 있는 틈을 타 …\n◇◇에 있었다는 말은 거짓이다. ☆☆ 기록에 그 시간 기록이 없기 때문이다 …"}
          className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-500 dark:border-zinc-700 dark:bg-zinc-950"
        />
        <p className="mt-1 text-right text-xs text-zinc-400">
          {narrative.length.toLocaleString()} / {MAX_NARRATIVE.toLocaleString()}
          {!narrative.trim() && " · 비워 두어도 괜찮아요"}
        </p>
      </details>
      )}

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <button onClick={submit} disabled={!ready || pending} className="w-full rounded-xl bg-red-600 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-50">
        {pending ? (narrative.trim() ? "AI 가 추리 서술을 채점하는 중..." : "제출 중...") : ready ? "제출하기" : "범인과 모든 질문의 답을 고르세요"}
      </button>
    </Modal>
  );
}
