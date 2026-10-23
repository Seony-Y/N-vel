"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { SandboxedHtml } from "@/components/SandboxedHtml";
import type { PublicCase, PublicClue, PublicMessage, PublicState } from "@/lib/game/public";

const TRAILER = "\u001e";
const MAX_EVIDENCE = 3;
const FOUND_PREFIX = "🔍 단서 발견: ";

type Target = "narrator" | string; // 용의자 id
type ModelOption = { id: string; label: string; description: string; credits: number };

export function PlayScreen({
  data,
  initialState,
  initialMessages,
  initialCredits,
  models,
  defaultModel,
}: {
  data: PublicCase;
  initialState: PublicState;
  initialMessages: PublicMessage[];
  initialCredits: number;
  models: ModelOption[];
  defaultModel: string;
}) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [messages, setMessages] = useState(initialMessages);
  const [target, setTarget] = useState<Target>("narrator");
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openClue, setOpenClue] = useState<PublicClue | null>(null);
  const [presenting, setPresenting] = useState(false);
  const [accusing, setAccusing] = useState(false);
  const [mobileTab, setMobileTab] = useState<"play" | "notebook">("play");
  const [toast, setToast] = useState<string | null>(null);
  const [credits, setCredits] = useState(initialCredits);
  // 대화 상대마다 AI 가 마지막으로 추천한 다음 행동. 없으면 기본 추천을 보여 준다
  const [suggested, setSuggested] = useState<Record<string, string[]>>({});
  const model = models.find((m) => m.id === state.model) ?? models.find((m) => m.id === defaultModel) ?? models[0];
  const creditsPerAction = model.credits;
  const noCredits = credits < creditsPerAction;

  const suspect = data.suspects.find((s) => s.id === target) ?? null;
  const location = data.locations.find((l) => l.id === state.currentLocationId) ?? null;
  const thread = target === "narrator" ? "narrator" : target;
  const threadMessages = useMemo(() => messages.filter((m) => m.thread === thread), [messages, thread]);
  const outOfActions = state.actionsLeft === 0;
  const badges = (
    <div className="flex items-center gap-1.5">
      <ModelPicker models={models} value={model.id} disabled={busy} onChange={changeModel} />
      <span
        className={`rounded-full px-2.5 py-1 text-xs font-medium ${noCredits ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"}`}
        title={`행동 1회에 ${creditsPerAction}크레딧`}
      >
        💎 {credits.toLocaleString()}
      </span>
      <ActionsBadge state={state} />
    </div>
  );

  const bottomRef = useRef<HTMLDivElement>(null);
  const shownThread = useRef(thread);
  useEffect(() => {
    // 대화 상대를 바꿨을 때는 기다리지 않고 바로 맨 아래로, 새 메시지가 올 때만 부드럽게
    const switched = shownThread.current !== thread;
    shownThread.current = thread;
    bottomRef.current?.scrollIntoView({ behavior: switched ? "instant" : "smooth", block: "end" });
  }, [threadMessages.length, streaming, thread]);

  function flash(text: string) {
    setToast(text);
    setTimeout(() => setToast(null), 2500);
  }

  function pushLocal(...items: Omit<PublicMessage, "id">[]) {
    setMessages((m) => [...m, ...items.map((x) => ({ ...x, id: crypto.randomUUID() }))]);
  }

  async function post(path: string, body?: unknown) {
    const res = await fetch(`/api/play/${state.sessionId}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? "요청에 실패했습니다");
    return json;
  }

  async function act(message: string, presentClueId?: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const clue = presentClueId ? state.foundClues.find((c) => c.id === presentClueId) : null;
    const tempId = crypto.randomUUID();
    setMessages((m) => [...m, { id: tempId, thread, role: "user", content: clue ? `[증거 제시: ${clue.name}] ${clue.description}${message ? `\n${message}` : ""}` : message }]);
    setInput("");
    setStreaming("");

    try {
      const res = await fetch(`/api/play/${state.sessionId}/act`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, message, presentClueId }),
      });
      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => ({}));
        // 행동이 처리되지 않았으므로 방금 띄운 내 메시지를 거두고 입력을 되돌린다
        setMessages((m) => m.filter((x) => x.id !== tempId));
        setInput(message);
        if (json.code === "NO_CREDITS") setCredits(json.credits);
        throw new Error(json.error ?? "요청에 실패했습니다");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let raw = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += decoder.decode(value, { stream: true });
        setStreaming(raw.split(TRAILER)[0]);
      }

      const [text, trailer] = raw.split(TRAILER);
      const result = trailer ? (JSON.parse(trailer) as { state: PublicState; events: string[]; talkTo: string | null; suggestions?: string[]; credits: number }) : null;
      pushLocal({ thread, role: "assistant", content: text.trim() }, ...(result?.events ?? []).map((content) => ({ thread, role: "event" as const, content })));
      if (result) {
        setState(result.state);
        setCredits(result.credits);
        const found = result.events.filter((e) => e.startsWith(FOUND_PREFIX)).length;
        if (found) flash(`🔍 단서 ${found}개 발견 · 수첩에 적었어요`);
        setSuggested((s) => ({ ...s, [thread]: result.suggestions ?? [] }));
        // 나레이터가 용의자를 마주하는 장면으로 넘겼으면 바로 심문 화면으로
        if (result.talkTo) setTarget(result.talkTo);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStreaming(null);
      setBusy(false);
    }
  }

  async function move(locationId: string) {
    setTarget("narrator");
    setMobileTab("play");
    const loc = data.locations.find((l) => l.id === locationId);
    if (!loc || locationId === state.currentLocationId || busy) return;
    // 화면은 바로 옮기고, 저장은 뒤에서 한다 (장소 정보는 이미 화면에 있음)
    const before = state.currentLocationId;
    setState((s) => ({ ...s, currentLocationId: locationId }));
    pushLocal({ thread: "narrator", role: "event", content: `📍 ${loc.name}\n${loc.description}` });
    try {
      await post("move", { locationId });
    } catch (e) {
      setState((s) => ({ ...s, currentLocationId: before }));
      setError((e as Error).message);
    }
  }

  async function unlock(clueId: string, code: string) {
    try {
      const r = await post("unlock", { clueId, code });
      setState(r.state);
      const lock = state.locks.find((l) => l.clueId === clueId);
      if (r.ok) {
        const clue = (r.state as PublicState).foundClues.find((c) => c.id === clueId);
        pushLocal({ thread: "narrator", role: "event", content: `🔓 ${lock?.label ?? "잠금 장치"}이(가) 열렸습니다` }, { thread: "narrator", role: "event", content: `🔍 단서 발견: ${clue?.name}` });
        flash("🔓 열렸습니다!");
        if (clue) setOpenClue(clue);
      } else {
        pushLocal({ thread: "narrator", role: "event", content: `🔒 ${lock?.label ?? "잠금 장치"}: 비밀번호가 틀렸습니다` });
        flash("비밀번호가 틀렸습니다 (행동 1회 사용)");
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function changeModel(id: string) {
    const before = state.model;
    setState((s) => ({ ...s, model: id }));
    try {
      await post("model", { model: id });
      const m = models.find((x) => x.id === id);
      if (m) flash(`다음 행동부터 ${m.label} · 💎 ${m.credits}`);
    } catch (e) {
      setState((s) => ({ ...s, model: before }));
      setError((e as Error).message);
    }
  }

  // 기본 추천: 아직 AI 추천이 없을 때 (처음, 새로고침 뒤, 대화 상대를 막 바꿨을 때)
  const otherLocation = data.locations.find((l) => l.id !== state.currentLocationId);
  const lastClue = state.foundClues.at(-1);
  const suggestions =
    suggested[thread]?.length
      ? suggested[thread]
      : suspect
        ? ["사건 당일 밤 어디에 계셨나요?", "피해자와는 어떤 사이였나요?", lastClue ? `「${lastClue.name}」에 대해 아는 게 있나요?` : "혹시 수상한 걸 보거나 들으셨나요?"]
        : ["주위를 천천히 둘러본다", location ? `${location.name}에서 눈에 띄는 물건을 살펴본다` : "현장을 자세히 살펴본다", otherLocation ? `${otherLocation.name}(으)로 가 본다` : `${data.suspects[0]?.name ?? "용의자"}에게 말을 건다`];

  async function hint() {
    try {
      const r = await post("hint");
      setState(r.state);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const header = suspect ? (
    <div>
      <div className="font-semibold">🗣 {suspect.name} 심문</div>
      <div className="text-xs text-zinc-500">{suspect.role}</div>
    </div>
  ) : (
    <div>
      <div className="font-semibold">🔎 {location?.name ?? "조사"}</div>
      <div className="line-clamp-1 text-xs text-zinc-500">{location?.description}</div>
    </div>
  );

  const sidebar = (
    <div className="space-y-5">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">장소</h3>
        <div className="flex flex-wrap gap-1.5 lg:flex-col">
          {data.locations.map((l) => {
            const active = target === "narrator" && l.id === state.currentLocationId;
            return (
              <button
                key={l.id}
                onClick={() => move(l.id)}
                className={`rounded-lg px-3 py-2 text-left text-sm transition ${active ? "bg-red-600 text-white" : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"}`}
              >
                {l.name}
                {l.id === state.currentLocationId && !active && <span className="ml-1 text-xs text-zinc-400">(현재)</span>}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">용의자</h3>
        <div className="flex flex-wrap gap-1.5 lg:flex-col">
          {data.suspects.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setTarget(s.id);
                setMobileTab("play");
              }}
              className={`rounded-lg px-3 py-2 text-left text-sm transition ${target === s.id ? "bg-red-600 text-white" : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"}`}
            >
              <div>{s.name}</div>
              <div className={`hidden text-xs lg:block ${target === s.id ? "text-red-100" : "text-zinc-500"}`}>{s.role}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const notebook = (
    <Notebook
      state={state}
      onOpenClue={setOpenClue}
      onHint={hint}
      onAccuse={() => setAccusing(true)}
      onGiveUp={async () => {
        try {
          await post("giveup");
          router.push(`/play/${state.sessionId}/result`);
        } catch (e) {
          setError((e as Error).message);
        }
      }}
      sessionId={state.sessionId}
    />
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-3 py-3 sm:px-4 lg:h-[calc(100vh-57px)] lg:flex-row lg:gap-4">
      {/* 상단 정보 (모바일) */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 lg:hidden">
        <div className="flex rounded-lg bg-zinc-100 p-1 text-sm dark:bg-zinc-800">
          {(["play", "notebook"] as const).map((t) => (
            <button key={t} onClick={() => setMobileTab(t)} className={`rounded-md px-3 py-1 ${mobileTab === t ? "bg-white shadow-sm dark:bg-zinc-900" : "text-zinc-500"}`}>
              {t === "play" ? "수사" : `수첩 (${state.foundClues.length})`}
            </button>
          ))}
        </div>
        {badges}
      </div>

      <aside className={`shrink-0 lg:block lg:w-52 lg:overflow-y-auto ${mobileTab === "play" ? "mb-3" : "hidden"}`}>{sidebar}</aside>

      {/* 대화 */}
      <section className={`flex min-h-[60vh] flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white lg:min-h-0 dark:border-zinc-800 dark:bg-zinc-900 ${mobileTab === "play" ? "" : "hidden lg:flex"}`}>
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          {header}
          <div className="hidden lg:block">{badges}</div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {threadMessages.length === 0 && (
            <p className="py-8 text-center text-sm text-zinc-400">{suspect ? `${suspect.name}에게 질문해 보세요. 수첩의 단서를 증거로 제시할 수도 있어요.` : "무엇을 조사할지 입력해 보세요. 예) 책상 서랍을 열어본다"}</p>
          )}
          {threadMessages.map((m) => {
            const found = m.role === "event" && m.content.startsWith(FOUND_PREFIX) ? state.foundClues.find((c) => c.name === m.content.slice(FOUND_PREFIX.length).trim()) : null;
            return found ? (
              <FoundClue key={m.id} clue={found} suspects={data.suspects} inInterrogation={!!suspect} onOpen={() => setOpenClue(found)} />
            ) : (
              <Bubble key={m.id} m={m} name={suspect?.name} />
            );
          })}
          {streaming !== null && <Bubble m={{ id: "s", thread, role: "assistant", content: streaming || "…" }} name={suspect?.name} />}
          <div ref={bottomRef} />
        </div>

        {/* 잠금 장치 */}
        {target === "narrator" &&
          state.locks
            .filter((l) => l.locationId === state.currentLocationId)
            .map((l) => <LockInput key={l.clueId} label={l.label} disabled={busy || outOfActions} onSubmit={(code) => unlock(l.clueId, code)} />)}

        {error && <p className="border-t border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40">{error}</p>}
        {noCredits && (
          <p className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            💎 크레딧이 부족해요 (행동 1회에 {creditsPerAction}크레딧). 위에서 더 저렴한 모델로 바꾸거나, 수첩에서 추리를 제출할 수 있어요.
          </p>
        )}

        {/* 추천 행동: 누르면 바로 보낸다. 직접 입력도 그대로 가능 */}
        {!outOfActions && !noCredits && (
          <div className="flex gap-1.5 overflow-x-auto border-t border-zinc-200 px-3 pt-2.5 dark:border-zinc-800">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                disabled={busy}
                onClick={() => act(s)}
                title={`보내기 (💎 ${creditsPerAction})`}
                className="shrink-0 rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-700 hover:border-red-400 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-red-800 dark:hover:bg-red-950/30 dark:hover:text-red-300"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim()) act(input.trim());
          }}
          className="flex items-end gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800"
        >
          {suspect && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setPresenting((v) => !v)}
                disabled={busy || outOfActions || noCredits || !state.foundClues.length}
                className="rounded-lg border border-zinc-300 px-3 py-2.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                증거 제시
              </button>
              {presenting && (
                <div className="absolute bottom-full left-0 z-10 mb-2 max-h-72 w-72 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                  {state.foundClues.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setPresenting(false);
                        act(input.trim(), c.id);
                      }}
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-zinc-500">{c.source}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                if (input.trim()) act(input.trim());
              }
            }}
            rows={1}
            maxLength={1000}
            disabled={busy || outOfActions || noCredits}
            placeholder={outOfActions ? "행동 횟수를 모두 썼습니다. 추리를 제출하세요" : suspect ? `${suspect.name}에게 질문하기` : "무엇을 조사할까요?"}
            className="max-h-32 min-h-[42px] flex-1 resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button type="submit" disabled={busy || outOfActions || noCredits || !input.trim()} className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
            {busy ? "…" : "보내기"}
          </button>
        </form>
      </section>

      <aside className={`shrink-0 lg:block lg:w-80 lg:overflow-y-auto ${mobileTab === "notebook" ? "" : "hidden"}`}>{notebook}</aside>

      {openClue && <ClueModal clue={openClue} onClose={() => setOpenClue(null)} />}
      {accusing && <AccuseModal data={data} state={state} onClose={() => setAccusing(false)} onDone={() => router.push(`/play/${state.sessionId}/result`)} />}
      {toast && <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-white dark:text-zinc-900">{toast}</div>}
    </div>
  );
}

/** 수사 도중 모델 바꾸기. 다음 행동부터 적용된다 */
function ModelPicker({ models, value, disabled, onChange }: { models: ModelOption[]; value: string; disabled: boolean; onChange: (id: string) => void }) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      aria-label="AI 모델"
      title="AI 모델 (다음 행동부터 적용)"
      className="rounded-full border border-zinc-200 bg-white py-1 pr-7 pl-2.5 text-xs font-medium disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
    >
      {models.map((m) => (
        <option key={m.id} value={m.id}>
          {m.label} · 💎{m.credits}
        </option>
      ))}
    </select>
  );
}

function ActionsBadge({ state }: { state: PublicState }) {
  if (state.actionsLeft === null) return <span className="text-xs text-zinc-400">행동 {state.actionsUsed}회</span>;
  const low = state.actionsLeft <= 10;
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${low ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"}`}>남은 행동 {state.actionsLeft}</span>;
}

function Bubble({ m, name }: { m: PublicMessage; name?: string }) {
  if (m.role === "event") {
    return <div className="mx-auto max-w-md whitespace-pre-wrap rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">{m.content}</div>;
  }
  const mine = m.role === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${mine ? "rounded-br-sm bg-red-600 text-white" : "rounded-bl-sm bg-zinc-100 dark:bg-zinc-800"}`}>
        {!mine && name && <div className="mb-0.5 text-xs font-semibold text-zinc-500">{name}</div>}
        {m.content}
      </div>
    </div>
  );
}

/** 대화 중에 찾은 단서: 무엇을 찾았는지, 누구와 관련 있어 보이는지, 이걸로 무엇을 할 수 있는지 */
function FoundClue({ clue, suspects, inInterrogation, onOpen }: { clue: PublicClue; suspects: PublicCase["suspects"]; inInterrogation: boolean; onOpen: () => void }) {
  // 단서 내용에 이름이 나오는 사람만 보여 준다 (내용에 이미 있는 정보라 정답을 흘리지 않음)
  const related = suspects.filter((s) => clue.description.includes(s.name));
  return (
    <div className="mx-auto w-full max-w-md rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-medium text-amber-700 dark:text-amber-300">🔍 단서 발견 · {clue.source}</div>
          <div className="mt-0.5 font-semibold text-zinc-900 dark:text-zinc-100">{clue.name}</div>
        </div>
        <button type="button" onClick={onOpen} className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/40">
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
}

function LockInput({ label, disabled, onSubmit }: { label: string; disabled: boolean; onSubmit: (code: string) => void }) {
  const [code, setCode] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (code.trim()) {
          onSubmit(code.trim());
          setCode("");
        }
      }}
      className="flex items-center gap-2 border-t border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <span className="text-sm">🔒 {label}</span>
      <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="비밀번호" maxLength={30} disabled={disabled} className="w-28 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
      <button type="submit" disabled={disabled || !code.trim()} className="rounded-md bg-zinc-800 px-3 py-1 text-sm text-white disabled:opacity-50 dark:bg-zinc-200 dark:text-zinc-900">
        열기
      </button>
      <span className="text-xs text-zinc-400">틀리면 행동 1회</span>
    </form>
  );
}

function Notebook({
  state,
  onOpenClue,
  onHint,
  onAccuse,
  onGiveUp,
  sessionId,
}: {
  state: PublicState;
  onOpenClue: (c: PublicClue) => void;
  onHint: () => void;
  onAccuse: () => void;
  onGiveUp: () => void;
  sessionId: string;
}) {
  const [notes, setNotes] = useState(state.notes);
  const [confirmGiveUp, setConfirmGiveUp] = useState(false);
  const [saved, setSaved] = useState(true);

  // 입력을 멈추고 1초 뒤 저장
  useEffect(() => {
    if (saved) return;
    const t = setTimeout(async () => {
      await fetch(`/api/play/${sessionId}/notes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes }) });
      setSaved(true);
    }, 1000);
    return () => clearTimeout(t);
  }, [notes, saved, sessionId]);

  return (
    <div className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div>
        <h3 className="mb-2 text-sm font-semibold">📒 단서 ({state.foundClues.length})</h3>
        {state.foundClues.length === 0 ? (
          <p className="text-sm text-zinc-400">아직 찾은 단서가 없어요.</p>
        ) : (
          <ul className="space-y-1.5">
            {state.foundClues.map((c) => (
              <li key={c.id}>
                <button onClick={() => onOpenClue(c)} className="block w-full rounded-lg border border-zinc-200 px-3 py-2 text-left hover:border-red-300 dark:border-zinc-800">
                  <div className="text-sm font-medium">{c.name}</div>
                  <div className="text-xs text-zinc-500">{c.source}</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">💡 힌트</h3>
          <button onClick={onHint} disabled={state.hintsUsed >= state.hintsTotal} className="text-xs font-medium text-red-600 hover:underline disabled:text-zinc-400 disabled:no-underline">
            {state.hintsUsed >= state.hintsTotal ? "힌트 없음" : `힌트 보기 (-10점, ${state.hintsTotal - state.hintsUsed}개 남음)`}
          </button>
        </div>
        {state.hints.map((h, i) => (
          <p key={i} className="mb-1.5 rounded-lg bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-800/50">
            {h}
          </p>
        ))}
      </div>

      <div>
        <h3 className="mb-2 flex items-center justify-between text-sm font-semibold">
          ✏️ 메모 <span className="text-xs font-normal text-zinc-400">{saved ? "저장됨" : "저장 중…"}</span>
        </h3>
        <textarea
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setSaved(false);
          }}
          rows={6}
          maxLength={10000}
          placeholder="추리를 정리해 보세요"
          className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-500 dark:border-zinc-700 dark:bg-zinc-950"
        />
      </div>

      <button onClick={onAccuse} className="w-full rounded-xl bg-zinc-900 py-3 font-semibold text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200">
        ⚖️ 추리 제출
      </button>

      {confirmGiveUp ? (
        <div className="space-y-2 rounded-xl bg-zinc-100 p-3 text-sm dark:bg-zinc-800">
          <p>수사를 포기하면 사건은 미제로 남고 진상이 공개돼요. 나중에 다시 도전할 수 있어요.</p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setConfirmGiveUp(false)} className="rounded-lg px-3 py-1.5 hover:bg-white dark:hover:bg-zinc-900">
              계속 수사
            </button>
            <button onClick={onGiveUp} className="rounded-lg bg-zinc-700 px-3 py-1.5 font-medium text-white hover:bg-zinc-600">
              포기하기
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setConfirmGiveUp(true)} className="w-full text-center text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
          🏳 수사 포기
        </button>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
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

function ClueModal({ clue, onClose }: { clue: PublicClue; onClose: () => void }) {
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

function AccuseModal({ data, state, onClose, onDone }: { data: PublicCase; state: PublicState; onClose: () => void; onDone: () => void }) {
  const [culpritId, setCulpritId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<number[]>(data.quiz.map(() => -1));
  const [evidence, setEvidence] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const ready = culpritId && answers.every((a) => a >= 0);

  async function submit() {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/play/${state.sessionId}/accuse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ culpritId, answers, evidenceIds: evidence }),
    });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "제출하지 못했습니다");
      setPending(false);
      return;
    }
    onDone();
  }

  return (
    <Modal title="⚖️ 추리 제출" onClose={onClose}>
      <p className="mb-4 text-sm text-zinc-500">제출하면 사건이 끝나고 결과가 공개됩니다. 다시 수정할 수 없어요.</p>

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

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <button onClick={submit} disabled={!ready || pending} className="w-full rounded-xl bg-red-600 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-50">
        {pending ? "제출 중..." : ready ? "제출하기" : "범인과 모든 질문의 답을 고르세요"}
      </button>
    </Modal>
  );
}
