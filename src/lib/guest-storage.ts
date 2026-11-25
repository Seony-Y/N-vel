"use client";

/** 비회원 프롤로그의 진행 상황 (이 브라우저에만). 저장소가 막혀 있으면 없는 것으로 본다 */
const PLAY_KEY = "nvel:guest:play";
const DONE_KEY = "nvel:guest:done";

function read<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") as T | null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export interface GuestProgress {
  caseId: string;
  save: { locationId: string | null; foundClueIds: string[]; actionsUsed: number; hintsUsed: number };
  messages: { id: string; thread: string; role: "user" | "assistant" | "event"; content: string }[];
}
export interface GuestResult {
  ending: "correct" | "partial" | "wrong" | "gaveup";
  score: number;
  items: { label: string; ok: boolean; mine: string; answer: string }[];
  reveal: { culprit: string; truth: string; endingText: string };
}
export interface GuestDone extends GuestProgress {
  accusation: { culpritId: string; answers: number[]; evidenceIds: string[] } | null; // 포기하면 null
  result: GuestResult;
}

export const readGuestPlay = () => read<GuestProgress>(PLAY_KEY);
export const writeGuestPlay = (v: GuestProgress | null) => write(PLAY_KEY, v);
export const readGuestDone = () => read<GuestDone>(DONE_KEY);
export const writeGuestDone = (v: GuestDone | null) => write(DONE_KEY, v);
