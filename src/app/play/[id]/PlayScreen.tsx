"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { PublicCase, PublicClue, PublicMessage, PublicState } from "@/lib/game/public";
import { STATEMENT_PREFIX } from "@/lib/game/statements";
import type { GuestProgress, GuestResult } from "@/lib/guest-storage";
import { AccuseModal, ActionsBadge, Bubble, ClueModal, FoundClue, Guide, LockInput, Modal, type ModelOption, ModelPicker, Notebook, StoryModal, useDismiss } from "./parts";

const TRAILER = "\u001e";
const FOUND_PREFIX = "🔍 단서 발견: ";
const PAINT_MS = 50; // 답이 들어올 때 화면을 다시 그리는 간격
const NEAR_BOTTOM = 80; // 맨 아래에서 이만큼 안이면 새 글을 따라 내려간다 (위로 올려 읽는 중이면 그대로 둔다)
const RESYNC_TRIES = 12; // 답이 도중에 끊겼을 때 서버에 저장된 결과를 다시 물어보는 횟수
const RESYNC_MS = 2500;

type Target = "narrator" | string; // 용의자 id

/** 브라우저 저장소 읽기 (막혀 있으면 없음으로). 다른 탭에서 바뀌면 storage 이벤트로 다시 읽는다 */
function readStorage(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function subscribeStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}
export function PlayScreen({
  data,
  initialState,
  initialMessages,
  initialCredits,
  models,
  defaultModel,
  guest,
}: {
  data: PublicCase;
  initialState: PublicState;
  initialMessages: PublicMessage[];
  initialCredits: number;
  models: ModelOption[];
  defaultModel: string;
  // 비회원 프롤로그: 진행 상황을 서버가 아니라 이 브라우저에 둔다
  guest?: {
    onProgress: (save: GuestProgress["save"], messages: PublicMessage[]) => void;
    onDone: (save: GuestProgress["save"], accusation: { culpritId: string; answers: number[]; evidenceIds: string[] } | null, result: GuestResult) => void;
  };
}) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [messages, setMessages] = useState(initialMessages);
  const [target, setTarget] = useState<Target>("narrator");
  const [drafts, setDrafts] = useState<Record<string, string>>({}); // 쓰던 글. 대화 상대마다 따로 둔다
  const [stream, setStream] = useState<{ thread: string; text: string } | null>(null); // 지금 들어오는 답. 어느 대화의 답인지 함께 둔다
  const [busy, setBusy] = useState(false);
  const acting = useRef(false); // busy 가 화면에 반영되기 전에 두 번 보내지 않게
  const [talkOffer, setTalkOffer] = useState<string | null>(null); // 나레이터가 마주하게 한 용의자
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openClue, setOpenClue] = useState<PublicClue | null>(null);
  const [presenting, setPresenting] = useState(false);
  const closePresenting = useCallback(() => setPresenting(false), []);
  const presentRef = useDismiss<HTMLDivElement>(presenting, closePresenting);
  const [accusing, setAccusing] = useState(false);
  const [mobileTab, setMobileTab] = useState<"play" | "notebook">("play");
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showStory, setShowStory] = useState(false);
  const [confirmGiveUp, setConfirmGiveUp] = useState(false);
  const [notes, setNotes] = useState(initialState.notes);
  const [savedNotes, setSavedNotes] = useState(initialState.notes);
  const [savingNotes, setSavingNotes] = useState(false);
  const [leaveTo, setLeaveTo] = useState<string | null>(null); // 저장 안 한 메모가 있는데 나가려던 주소
  const [narrative, setNarrative] = useState(""); // 추리 서술 초안. 제출 창을 닫았다 열어도 남도록 여기에 둔다
  const [toast, setToast] = useState<string | null>(null);
  const [credits, setCredits] = useState(initialCredits);
  // 대화 상대마다 AI 가 마지막으로 추천한 다음 행동. 없으면 기본 추천을 보여 준다
  const [suggested, setSuggested] = useState<Record<string, string[]>>({});
  const model = models.find((m) => m.id === state.model) ?? models.find((m) => m.id === defaultModel) ?? models[0];
  const creditsPerAction = model.credits;
  const noCredits = !data.scripted && credits < creditsPerAction; // 대본 사건은 무료

  const suspect = data.suspects.find((s) => s.id === target) ?? null;
  const location = data.locations.find((l) => l.id === state.currentLocationId) ?? null;
  const thread = target === "narrator" ? "narrator" : target;
  const input = drafts[thread] ?? "";
  const setInput = (v: string, at = thread) => setDrafts((d) => ({ ...d, [at]: v }));
  const streaming = stream?.thread === thread ? stream.text : null;
  const threadMessages = useMemo(() => messages.filter((m) => m.thread === thread), [messages, thread]);
  const badges = (
    <div className="flex flex-wrap items-center gap-1.5">
      {data.scripted ? (
        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">🎁 무료</span>
      ) : (
        <>
          <ModelPicker models={models} value={model.id} disabled={busy} onChange={changeModel} />
          <span
        className={`rounded-full px-2.5 py-1 text-xs font-medium ${noCredits ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"}`}
        title={`행동 1회에 ${creditsPerAction}크레딧`}
      >
            💎 {credits.toLocaleString()}
          </span>
        </>
      )}
      <ActionsBadge used={state.actionsUsed} target={data.targetActions} />
    </div>
  );

  const listRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true); // 맨 아래를 보고 있는지
  const shownThread = useRef(thread);
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (shownThread.current !== thread) stick.current = true; // 대화 상대를 바꾸면 맨 아래부터
    shownThread.current = thread;
    if (stick.current) el.scrollTop = el.scrollHeight;
  }, [threadMessages.length, streaming, thread, talkOffer]);

  function flash(text: string) {
    setToast(text);
    setTimeout(() => setToast(null), 2500);
  }

  function pushLocal(...items: Omit<PublicMessage, "id">[]) {
    setMessages((m) => [...m, ...items.map((x) => ({ ...x, id: crypto.randomUUID() }))]);
  }

  const guestSave = { locationId: state.currentLocationId, foundClueIds: state.foundClues.map((c) => c.id), actionsUsed: state.actionsUsed, hintsUsed: state.hintsUsed };
  const request = (path: string, body?: unknown) =>
    fetch(guest ? `/api/guest/${path}` : `/api/play/${state.sessionId}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: guest ? JSON.stringify({ ...(body as object | undefined), save: guestSave }) : body ? JSON.stringify(body) : undefined,
    });
  const onProgress = useEffectEvent(() => guest?.onProgress(guestSave, messages));
  useEffect(() => onProgress(), [state, messages]);

  async function post(path: string, body?: unknown) {
    const res = await request(path, body);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? "요청에 실패했습니다");
    return json;
  }

  /** 답이 도중에 끊겼을 때: 서버는 끝까지 받아 저장하므로, 저장된 결과가 나올 때까지 기다렸다가 화면을 맞춘다 */
  async function resync(at: string) {
    for (let i = 0; i < RESYNC_TRIES; i++) {
      if (i) await new Promise((r) => setTimeout(r, RESYNC_MS));
      const r = (await fetch(`/api/play/${state.sessionId}/state`)
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null)) as { state: PublicState; messages: PublicMessage[]; credits: number } | null;
      if (!r) continue;
      setState(r.state);
      setMessages(r.messages);
      setCredits(r.credits);
      if (r.messages.filter((m) => m.thread === at && m.role !== "event").at(-1)?.role === "assistant") return true;
    }
    return false;
  }

  async function act(message: string, presentClueId?: string) {
    if (acting.current) return;
    acting.current = true;
    const at = thread;
    stick.current = true;
    setBusy(true);
    setError(null);
    setTalkOffer(null);
    const clue = presentClueId ? state.foundClues.find((c) => c.id === presentClueId) : null;
    const tempId = crypto.randomUUID();
    setMessages((m) => [...m, { id: tempId, thread, role: "user", content: clue ? `[증거 제시: ${clue.name}] ${clue.description}${message ? `\n${message}` : ""}` : message }]);
    setInput("", at);
    setStream({ thread: at, text: "" });
    const undo = () => {
      setMessages((m) => m.filter((x) => x.id !== tempId));
      setInput(message, at);
    };

    try {
      const res = await request("act", { target, message, presentClueId }).catch(() => null);
      if (!res) {
        undo();
        throw new Error("인터넷 연결이 끊겨 보내지 못했어요. 연결을 확인하고 다시 보내 주세요");
      }
      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => ({}));
        // 행동이 처리되지 않았으므로 방금 띄운 내 메시지를 거두고 입력을 되돌린다
        undo();
        if (json.code === "NO_CREDITS") setCredits(json.credits);
        throw new Error(json.error ?? "요청에 실패했습니다");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let raw = "";
      let painted = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          raw += decoder.decode(value, { stream: true });
          if (Date.now() - painted < PAINT_MS) continue;
          painted = Date.now();
          setStream({ thread: at, text: raw.split(TRAILER)[0] });
        }
      } catch {} // 도중에 끊김: 아래에서 저장된 결과로 맞춘다

      const [text, trailer] = raw.split(TRAILER);
      if (!trailer) {
        setStream({ thread: at, text: `${text.trim()}\n\n(연결이 끊겨 나머지를 불러오는 중…)`.trim() });
        if (guest || !(await resync(at))) throw new Error("답을 끝까지 받지 못했어요. 새로고침하면 저장된 내용을 볼 수 있어요");
        return;
      }
      const result = trailer ? (JSON.parse(trailer) as { state: PublicState; events: string[]; talkTo: string | null; suggestions?: string[]; credits: number }) : null;
      pushLocal({ thread: at, role: "assistant", content: text.trim() }, ...(result?.events ?? []).map((content) => ({ thread: at, role: "event" as const, content })));
      if (result) {
        setState(result.state);
        setCredits(result.credits);
        const found = result.events.filter((e) => e.startsWith(FOUND_PREFIX)).length;
        if (found) flash(`🔍 단서 ${found}개 발견 · 수첩에 적었어요`);
        setSuggested((s) => ({ ...s, [at]: result.suggestions ?? [] }));
        // 나레이터가 용의자를 마주하게 했으면, 글을 읽고 넘어갈 수 있게 심문 버튼을 띄운다
        if (result.talkTo) setTalkOffer(result.talkTo);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStream(null);
      setBusy(false);
      acting.current = false;
    }
  }

  async function move(locationId: string) {
    const loc = data.locations.find((l) => l.id === locationId);
    if (!loc) return;
    if (busy && locationId !== state.currentLocationId) return flash("답이 끝난 뒤에 이동할 수 있어요");
    setTarget("narrator");
    setMobileTab("play");
    setError(null);
    if (locationId === state.currentLocationId) return;
    setTalkOffer(null);
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
        flash("비밀번호가 틀렸습니다 (행동 1회로 셌어요)");
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }

  /** 수첩의 단서 2~3개를 잇는다. 맞았는지 돌려준다 */
  async function combine(clueIds: string[]) {
    setError(null);
    try {
      const r = (await post("combine", { clueIds })) as { ok: boolean; clueId?: string; events: string[]; state: PublicState };
      setState(r.state);
      pushLocal(...r.events.map((content) => ({ thread: "narrator", role: "event" as const, content })));
      flash(r.ok ? "🧩 단서가 이어졌어요!" : state.mode === "hard" ? "아직 맞물리지 않아요 (행동 1회로 셌어요)" : "아직 맞물리지 않아요");
      if (r.ok) setOpenClue(r.state.foundClues.find((c) => c.id === r.clueId) ?? null);
      return r.ok;
    } catch (e) {
      flash((e as Error).message);
      return false;
    }
  }

  async function changeModel(id: string) {
    const before = state.model;
    setState((s) => ({ ...s, model: id }));
    try {
      await post("model", { model: id });
      const m = models.find((x) => x.id === id);
      if (m) flash(`다음 행동부터 ${m.label} (행동당 💎 ${m.credits})`);
    } catch (e) {
      setState((s) => ({ ...s, model: before }));
      setError((e as Error).message);
    }
  }

  // 기본 추천: 아직 AI 추천이 없을 때 (처음, 새로고침 뒤, 대화 상대를 막 바꿨을 때)
  const otherLocation = data.locations.find((l) => l.id !== state.currentLocationId);
  const lastClue = state.foundClues.at(-1);
  // 대본 사건: 지금 장소·상대의 선택지 중 아직 고르지 않았고 필요한 단서를 찾은 것
  const foundIds = new Set(state.foundClues.map((c) => c.id));
  const asked = new Set(threadMessages.filter((m) => m.role === "user").map((m) => m.content));
  const here = suspect ? suspect.id : state.currentLocationId;
  const suggestions = data.scripted
    ? data.choices.filter((c) => c.where === here && c.requires.every((r) => foundIds.has(r)) && !asked.has(c.say)).map((c) => c.say)
    : suggested[thread]?.length
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
      {/* 지금 수사 중인 사건. 누르면 사건 개요를 다시 볼 수 있다 */}
      <button
        type="button"
        onClick={() => setShowStory(true)}
        className="block w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-left hover:border-red-300 lg:py-2.5 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="hidden text-xs text-zinc-500 lg:block">📁 수사 중인 사건</div>
        <div className="line-clamp-1 text-sm font-semibold lg:mt-0.5 lg:line-clamp-2">
          <span className="lg:hidden">📁 </span>
          {data.title}
          <span className="ml-1 text-xs font-medium text-red-600 lg:hidden">개요 ›</span>
        </div>
        <div className="mt-1 hidden text-xs font-medium text-red-600 lg:block">사건 개요 보기</div>
      </button>
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

  // 모바일: 장소·용의자를 선택 상자로 한 줄에. 고른 쪽이 지금 대화 상대다 (조사 중이면 장소, 심문 중이면 용의자)
  const pickClass = (active: boolean) =>
    `min-w-0 flex-1 rounded-lg border bg-white py-2 pl-2.5 text-sm outline-none focus:outline-none dark:bg-zinc-900 ${active ? "border-red-500 font-medium text-red-700 dark:text-red-300" : "border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"}`;
  const mobilePicker = (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={() => setShowStory(true)} aria-label="사건 개요 보기" title="사건 개요" className="shrink-0 rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-900">
        📁
      </button>
      <select
        aria-label="장소"
        value={target === "narrator" ? (state.currentLocationId ?? "") : ""}
        onChange={(e) => e.target.value && move(e.target.value)}
        className={pickClass(target === "narrator")}
      >
        {target !== "narrator" && <option value="">📍 장소 조사</option>}
        {data.locations.map((l) => (
          <option key={l.id} value={l.id}>
            📍 {l.name}
          </option>
        ))}
      </select>
      <select
        aria-label="용의자"
        value={suspect?.id ?? ""}
        onChange={(e) => {
          if (!e.target.value) return;
          setTarget(e.target.value);
          setMobileTab("play");
        }}
        className={pickClass(!!suspect)}
      >
        {!suspect && <option value="">🗣 용의자 심문</option>}
        {data.suspects.map((s) => (
          <option key={s.id} value={s.id}>
            🗣 {s.name}
          </option>
        ))}
      </select>
    </div>
  );

  // ── 메모: 자동 저장하지 않고 임시저장 버튼으로 저장. 저장 안 한 채 나가려 하면 붙잡는다 ──
  const notesDirty = notes !== savedNotes;

  // 임시저장 전의 메모는 이 브라우저에 백업해 둔다. 뒤로 가기·탭 종료처럼 붙잡을 수 없는 경우에도 돌아오면 되살린다
  const backupKey = `nvel:notes:${state.sessionId}`;
  function changeNotes(v: string) {
    setNotes(v);
    try {
      if (v === savedNotes) localStorage.removeItem(backupKey);
      else localStorage.setItem(backupKey, v);
    } catch {}
  }
  // 지난번에 임시저장하지 않고 나간 메모가 있으면 수첩에서 되살릴 수 있게 한다 (서버 렌더링 때는 없음으로)
  const backup = useSyncExternalStore(subscribeStorage, () => readStorage(backupKey), () => null);
  const restorable = backup !== null && backup !== notes && !notesDirty ? backup : null;

  async function saveNotes() {
    setSavingNotes(true);
    try {
      if (!guest) await post("notes", { notes });
      setSavedNotes(notes);
      try {
        localStorage.removeItem(backupKey);
      } catch {}
      flash("💾 메모를 임시저장했어요");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setSavingNotes(false);
    }
  }

  useEffect(() => {
    if (!notesDirty) return;
    // 새로고침·탭 닫기: 브라우저 기본 확인 창
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    // 사이트 안의 링크: 이동을 멈추고 임시저장 안내를 띄운다 (React 보다 먼저 받도록 document 캡처 단계)
    // 같은 사이트의 다른 페이지로 가는 링크만. 바깥 주소는 beforeunload 가, 새 탭·다운로드·같은 페이지 안 이동은 그대로 둔다
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!a || a.hasAttribute("download") || (a.getAttribute("target") ?? "_self") !== "_self") return;
      const here = window.location;
      const url = new URL(a.getAttribute("href")!, here.href);
      if (url.origin !== here.origin || (url.pathname === here.pathname && url.search === here.search)) return;
      e.preventDefault();
      e.stopPropagation();
      setLeaveTo(url.pathname + url.search + url.hash);
    };
    window.addEventListener("beforeunload", onUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [notesDirty]);

  // 추리 서술 초안도 이 브라우저에 백업한다. 새로고침해도 제출 창을 다시 열면 이어서 쓸 수 있게
  const narrativeKey = `nvel:narrative:${state.sessionId}`;
  function changeNarrative(v: string) {
    setNarrative(v);
    try {
      if (v.trim()) localStorage.setItem(narrativeKey, v);
      else localStorage.removeItem(narrativeKey);
    } catch {}
  }
  function openAccuse() {
    if (!narrative) {
      try {
        const saved = localStorage.getItem(narrativeKey);
        if (saved) setNarrative(saved);
      } catch {}
    }
    setAccusing(true);
  }

  // 사건을 끝낼 때(추리 제출·포기)는 따로 묻지 않고 메모를 저장해 둔다
  async function finish(path: "giveup" | null) {
    if (finishing) return;
    setFinishing(true);
    if (notesDirty) await saveNotes();
    try {
      const r = path ? await post(path) : null;
      try {
        localStorage.removeItem(narrativeKey);
      } catch {}
      if (guest) return guest.onDone(guestSave, null, r.result);
      router.push(`/play/${state.sessionId}/result`);
    } catch (e) {
      setFinishing(false);
      setConfirmGiveUp(false);
      setError((e as Error).message);
    }
  }

  const notebook = (
    <Notebook
      state={state}
      statements={data.suspects.map((s) => ({ name: s.name, items: messages.filter((m) => m.thread === s.id && m.role === "event" && m.content.startsWith(STATEMENT_PREFIX)) })).filter((s) => s.items.length)}
      onCombine={combine}
      onOpenClue={setOpenClue}
      onHint={hint}
      notes={notes}
      onNotesChange={changeNotes}
      restorable={restorable}
      notesDirty={notesDirty}
      savingNotes={savingNotes}
      onSaveNotes={saveNotes}
    />
  );

  // 수사 화면 전체를 화면 높이(상단 바 57px 제외)에 고정한다. 대화가 길어져도 페이지가 아니라 대화창 안에서 스크롤되고,
  // 그 아래 추리 제출·포기 버튼은 늘 화면 안에 남는다. (flex-1 을 같이 걸면 높이 지정이 무시되고 내용만큼 늘어나므로 flex-none)
  return (
    <div className="mx-auto flex h-[calc(100dvh-57px)] w-full max-w-7xl flex-none flex-col px-3 py-3 sm:px-4 lg:flex-row lg:gap-4">
      {/* 상단 정보 (모바일) */}
      <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2 lg:hidden">
        <div className="flex rounded-lg bg-zinc-100 p-1 text-sm dark:bg-zinc-800">
          {(["play", "notebook"] as const).map((t) => (
            <button key={t} onClick={() => setMobileTab(t)} className={`rounded-md px-3 py-1 ${mobileTab === t ? "bg-white shadow-sm dark:bg-zinc-900" : "text-zinc-500"}`}>
              {t === "play" ? "수사" : `수첩 (${state.foundClues.length})`}
              {t === "notebook" && notesDirty && <span className="ml-1 text-amber-500" title="저장 안 한 메모">●</span>}
            </button>
          ))}
        </div>
        {badges}
      </div>

      {/* PC: 사건 개요·장소·용의자 목록 / 모바일: 대화창을 넓게 쓰도록 한 줄짜리 선택 상자 */}
      <aside className="hidden shrink-0 lg:block lg:w-52 lg:overflow-y-auto">{sidebar}</aside>
      {mobileTab === "play" && <div className="mb-2 shrink-0 lg:hidden">{mobilePicker}</div>}

      {/* 대화 + 그 아래 사건을 끝내는 버튼 (수첩과 따로) */}
      <div className={`flex min-h-0 min-w-0 flex-1 flex-col gap-3 ${mobileTab === "play" ? "" : "hidden lg:flex"}`}>
        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <div className="min-w-0">{header}</div>
            <div className="hidden shrink-0 lg:block">{badges}</div>
          </div>

          {data.guide.length > 0 && <Guide data={data} state={state} messages={messages} notes={notes} onHint={hint} />}

          <div
            ref={listRef}
            onScroll={(e) => {
              const el = e.currentTarget;
              stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM;
            }}
            className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"
          >
            {threadMessages.length === 0 && (
              <p className="py-8 text-center text-sm text-zinc-400">{suspect ? `${suspect.name}에게 질문해 보세요. 수첩의 단서를 증거로 제시할 수도 있어요.` : data.scripted ? "아래 선택지에서 할 행동을 골라 보세요." : "무엇을 조사할지 입력해 보세요. 예) 책상 서랍을 열어본다"}</p>
            )}
            {threadMessages.map((m) => {
              const found = m.role === "event" && m.content.startsWith(FOUND_PREFIX) ? state.foundClues.find((c) => c.name === m.content.slice(FOUND_PREFIX.length).trim()) : null;
              return found ? (
                <FoundClue key={m.id} clue={found} suspects={data.suspects} inInterrogation={!!suspect} onOpen={setOpenClue} />
              ) : (
                <Bubble key={m.id} m={m} name={suspect?.name} />
              );
            })}
            {streaming !== null && <Bubble m={{ id: "s", thread, role: "assistant", content: streaming || "…" }} name={suspect?.name} />}
            {!suspect && talkOffer && !busy && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setTarget(talkOffer);
                    setTalkOffer(null);
                  }}
                  className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
                >
                  🗣 {data.suspects.find((s) => s.id === talkOffer)?.name} 심문하기
                </button>
              </div>
            )}
          </div>

          {/* 잠금 장치 */}
          {target === "narrator" &&
            state.locks
              .filter((l) => l.locationId === state.currentLocationId)
              .map((l) => <LockInput key={l.clueId} label={l.label} disabled={busy} onSubmit={(code) => unlock(l.clueId, code)} />)}

          {error && <p className="border-t border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40">{error}</p>}
          {noCredits && (
            <p className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              💎 크레딧이 부족해요 (행동 1회에 {creditsPerAction}크레딧).{" "}
              {credits >= Math.min(...models.map((m) => m.credits)) ? "위에서 더 저렴한 모델로 바꾸거나, " : ""}
              아래 &lsquo;추리 제출&rsquo;로 지금까지 모은 단서로 추리를 낼 수 있어요 (크레딧이 들지 않아요). 크레딧이 더 필요하면{" "}
              <Link href="/my/credits#request" className="font-medium underline underline-offset-2">
                관리자에게 요청
              </Link>
              해 주세요.
            </p>
          )}

          {/* 추천 행동: 내 말풍선처럼 오른쪽에 띄우고, 누르면 바로 보낸다. 접어 둘 수 있다. 직접 입력도 그대로 가능 (대본 사건은 선택지로만) */}
          {!noCredits && (suggestions.length > 0 || data.scripted) && (
            <div className="border-t border-zinc-200 px-3 py-2 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setShowSuggestions((v) => !v)}
                aria-expanded={showSuggestions}
                className="flex w-full items-center justify-between text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                <span>
                  💡 {data.scripted ? "선택지" : "추천 행동"}
                  {suggestions.length > 0 && ` ${suggestions.length}`}
                </span>
                <span>{showSuggestions ? "닫기 ▾" : "보기 ▴"}</span>
              </button>
              {showSuggestions && (
                <div className="mt-2 flex max-h-40 flex-wrap justify-end gap-1.5 overflow-y-auto">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={busy}
                      onClick={() => act(s)}
                      title={data.scripted ? "고르기" : `보내기 (💎 ${creditsPerAction})`}
                      className="max-w-[85%] rounded-2xl rounded-br-sm border border-red-300 bg-red-50 px-3 py-1.5 text-left text-sm text-red-800 hover:bg-red-100 disabled:opacity-50 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200 dark:hover:bg-red-950/60"
                    >
                      {s}
                    </button>
                  ))}
                  {data.scripted && !suggestions.length && (
                    <p className="w-full text-right text-xs text-zinc-400">{suspect ? "더 물어볼 건 없어요. 증거를 제시하거나 다른 곳으로 가 보세요." : "여기서 할 수 있는 조사는 다 했어요. 다른 장소나 용의자에게 가 보세요."}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {(!data.scripted || suspect) && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (input.trim()) act(input.trim());
              }}
              className="flex items-end gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800"
            >
              {suspect && (
                <div ref={presentRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setPresenting((v) => !v)}
                    disabled={busy || noCredits || !state.foundClues.length}
                    className="shrink-0 whitespace-nowrap rounded-lg border border-zinc-300 px-3 py-2.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    증거 제시
                  </button>
                  {presenting && (
                    <div className="absolute bottom-full left-0 z-10 mb-2 max-h-72 w-72 max-w-[calc(100vw-2.5rem)] overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
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
              {data.scripted ? (
                <span className="self-center text-xs text-zinc-400">수첩의 단서를 들이밀어 반응을 볼 수 있어요</span>
              ) : (
                <>
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
                    disabled={busy || noCredits}
                    placeholder={suspect ? `${suspect.name}에게 질문하기` : "무엇을 조사할까요?"}
                    className={`max-h-32 min-h-[42px] min-w-0 flex-1 resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 ${input ? "" : "overflow-hidden whitespace-nowrap placeholder:text-ellipsis"}`}
                  />
                  <button type="submit" disabled={busy || noCredits || !input.trim()} className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                    {busy ? "…" : "보내기"}
                  </button>
                </>
              )}
            </form>
          )}
        </section>

        <div className="shrink-0">
          <button onClick={openAccuse} className="w-full rounded-xl bg-red-600 py-3 font-semibold text-white shadow-sm hover:bg-red-700">
            ⚖️ 추리 제출
          </button>
          <button onClick={() => setConfirmGiveUp(true)} className="mx-auto mt-3 block px-3 py-1 text-center text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300">
            수사 포기
          </button>
        </div>
      </div>

      <aside className={`min-h-0 flex-1 overflow-y-auto lg:block lg:w-80 lg:flex-none ${mobileTab === "notebook" ? "" : "hidden"}`}>{notebook}</aside>

      {openClue && <ClueModal clue={openClue} onClose={() => setOpenClue(null)} />}
      {showStory && <StoryModal data={data} onClose={() => setShowStory(false)} />}
      {accusing && <AccuseModal data={data} state={state} notes={notes} narrative={narrative} onNarrative={changeNarrative} onClose={() => setAccusing(false)} onSubmit={(a) => request("accuse", a)} onDone={(a, result) => (guest ? guest.onDone(guestSave, a, result) : finish(null))} />}
      {confirmGiveUp && (
        <Modal title="수사 포기" onClose={() => setConfirmGiveUp(false)}>
          <p className="text-sm leading-relaxed">수사를 포기하면 사건은 미제로 남고 진상이 공개돼요. 나중에 다시 도전할 수 있어요.</p>
          <div className="mt-5 flex justify-end gap-2 text-sm">
            <button onClick={() => setConfirmGiveUp(false)} className="rounded-lg px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800">
              계속 수사
            </button>
            <button onClick={() => finish("giveup")} disabled={finishing} className="rounded-lg bg-zinc-700 px-4 py-2 font-medium text-white hover:bg-zinc-600 disabled:opacity-60">
              {finishing ? "정리하는 중…" : "포기하기"}
            </button>
          </div>
        </Modal>
      )}
      {leaveTo && (
        <Modal title="💾 메모를 저장하지 않았어요" onClose={() => setLeaveTo(null)}>
          <p className="text-sm leading-relaxed">수첩의 메모가 아직 저장되지 않았어요. 나가기 전에 임시저장을 눌러 주세요.</p>
          <div className="mt-5 flex flex-wrap justify-end gap-2 text-sm">
            <button onClick={() => setLeaveTo(null)} className="rounded-lg px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800">
              머무르기
            </button>
            <button
              onClick={() => {
                setSavedNotes(notes); // 버리기로 했으니 다시 붙잡지도, 되살리라고 하지도 않는다
                try {
                  localStorage.removeItem(backupKey);
                } catch {}
                router.push(leaveTo);
              }}
              className="rounded-lg border border-zinc-300 px-4 py-2 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              저장하지 않고 나가기
            </button>
            <button
              onClick={async () => {
                if (await saveNotes()) router.push(leaveTo);
              }}
              className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700"
            >
              💾 임시저장하고 나가기
            </button>
          </div>
        </Modal>
      )}
      {toast && <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-white dark:text-zinc-900">{toast}</div>}
    </div>
  );
}
