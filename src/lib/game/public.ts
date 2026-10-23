import type { GuideStep } from "@/db/schema";
import type { PlayMessage, PlaySession } from "@/types/db";
import type { FullCase } from "./load";
import { MAX_HINTS } from "./rules";

/*
 * 화면으로 보내도 되는 값만 골라낸다.
 * 범인, 진상, 객관식 정답, 비밀번호, 아직 못 찾은 단서, 용의자의 비밀은 절대 포함하지 않는다.
 */

export interface PublicClue {
  id: string;
  name: string;
  description: string;
  image: string | null;
  docHtml: string;
  source: string; // 어디서 얻었는지 (장소 이름 또는 "○○의 증언")
}

export interface PublicState {
  sessionId: string;
  status: PlaySession["status"];
  model: string | null;
  currentLocationId: string | null;
  actionsUsed: number;
  hintsUsed: number;
  hints: string[]; // 이미 공개한 힌트만
  hintsTotal: number;
  foundClues: PublicClue[];
  locks: { clueId: string; label: string; locationId: string }[]; // 아직 안 열린 잠금 장치
  notes: string;
}

export interface PublicCase {
  id: string;
  title: string;
  tagline: string;
  rating: string;
  warningTags: string[];
  difficulty: number;
  estimatedMinutes: number;
  coverImage: string | null;
  briefing: string;
  introHtml: string;
  victim: string;
  targetActions: number | null; // 목표 행동 수 (보너스 기준, 제한 아님)
  isOfficial: boolean;
  locations: { id: string; name: string; description: string }[];
  suspects: { id: string; name: string; age: number | null; role: string; profile: string; portrait: string | null }[];
  quiz: { question: string; options: string[] }[]; // 정답 제외
  guide: GuideStep[]; // 제작자가 일부러 공개하는 단계별 안내 (목표의 대상은 id)
  scripted: boolean; // 대본 사건: AI 없이 선택지로만 진행 (무료)
  choices: { where: string; say: string; requires: string[] }[]; // 대본의 선택지 (반응·주는 단서는 제외)
}

export function publicCase(full: FullCase): PublicCase {
  const c = full.case;
  return {
    id: c.id,
    title: c.title,
    tagline: c.tagline,
    rating: c.rating,
    warningTags: c.warningTags,
    difficulty: c.difficulty,
    estimatedMinutes: c.estimatedMinutes,
    coverImage: c.coverImage,
    briefing: c.briefing,
    introHtml: c.introHtml,
    victim: c.victim,
    targetActions: c.targetActions,
    isOfficial: c.isOfficial,
    locations: full.locations.map(({ id, name, description }) => ({ id, name, description })),
    suspects: full.suspects.map(({ id, name, age, role, profile, portrait }) => ({ id, name, age, role, profile, portrait })),
    quiz: c.quiz.map(({ question, options }) => ({ question, options })),
    // 가이드·대본은 공식 사건에서만
    guide: c.isOfficial ? c.guide : [],
    scripted: c.isOfficial && c.script.length > 0,
    choices: (c.isOfficial ? c.script : []).flatMap(({ where, say, requires }) => (say ? [{ where, say, requires }] : [])),
  };
}

export function publicState(full: FullCase, s: PlaySession): PublicState {
  const found = new Set(s.foundClueIds);
  const locName = new Map(full.locations.map((l) => [l.id, l.name]));
  const susName = new Map(full.suspects.map((x) => [x.id, x.name]));
  // 찾은 순서대로
  const foundClues = s.foundClueIds
    .map((id) => full.clues.find((c) => c.id === id))
    .filter((c) => !!c)
    .map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      image: c.image,
      docHtml: c.docHtml,
      source: c.locationId ? (locName.get(c.locationId) ?? "") : `${susName.get(c.holderId ?? "") ?? ""}의 증언`,
    }));

  return {
    sessionId: s.id,
    status: s.status,
    model: s.model,
    currentLocationId: s.currentLocationId,
    actionsUsed: s.actionsUsed,
    hintsUsed: s.hintsUsed,
    hints: full.case.hints.slice(0, s.hintsUsed),
    hintsTotal: Math.min(full.case.hints.length, MAX_HINTS), // 예전에 4개 넘게 넣은 사건도 4개까지만
    foundClues,
    locks: full.clues
      .filter((c) => c.passcode && c.locationId && !found.has(c.id))
      .map((c) => ({ clueId: c.id, label: c.lockLabel ?? "잠긴 물건", locationId: c.locationId! })),
    notes: s.notes,
  };
}

export interface PublicMessage {
  id: string;
  thread: string;
  role: PlayMessage["role"];
  content: string;
}

export function publicMessages(msgs: PlayMessage[]): PublicMessage[] {
  return msgs.map(({ id, thread, role, content }) => ({ id, thread, role, content }));
}
