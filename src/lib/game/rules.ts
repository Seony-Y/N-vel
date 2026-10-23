import type { Accusation, Clue, NarrativeGrade, PlaySession } from "@/types/db";
import type { FullCase } from "./load";

/*
 * 게임 규칙. AI 가 무엇을 요청하든 최종 판정은 여기서 한다.
 */

export const HINT_PENALTY = 5;
export const MAX_HINTS = 4; // 사건 하나에 넣을 수 있는 힌트 수. 뒤로 갈수록 결정적인 힌트
export const MAX_EVIDENCE = 3;

/** 선행 단서를 모두 찾았는지 */
function prerequisitesMet(clue: Clue, found: Set<string>) {
  return clue.requires.every((id) => found.has(id));
}

/**
 * 지금 조사로 찾을 수 있는 장소 단서 (잠긴 단서 제외).
 * 현재 장소에 묶지 않는다. 플레이어가 다른 장소의 물건을 지목하면 나레이터가 그곳으로 옮겨 준다
 */
export function discoverable(full: FullCase, session: PlaySession) {
  const found = new Set(session.foundClueIds);
  return full.clues.filter((c) => c.locationId && !found.has(c.id) && !c.passcode && prerequisitesMet(c, found));
}

/**
 * 이 용의자가 지금 말해 줄 수 있는 증언 단서.
 * 어떤 breakpoint 가 이 단서를 주도록 되어 있으면, 그 breakpoint 가 무너지기 전에는 말할 수 없다.
 */
export function tellableBy(full: FullCase, session: PlaySession, suspectId: string) {
  const found = new Set(session.foundClueIds);
  const broken = new Set(session.brokenIds);
  return full.clues.filter((c) => {
    if (c.holderId !== suspectId || found.has(c.id) || !prerequisitesMet(c, found)) return false;
    const gates = full.breakpoints.filter((b) => b.revealsClueId === c.id);
    return gates.length === 0 || gates.some((b) => broken.has(b.id));
  });
}

/** AI 가 요청한 단서 코드 중 실제로 허용되는 것만 골라 id 로 돌려준다 */
export function validateRequested(codes: string[], allowed: Clue[]): Clue[] {
  const byCode = new Map(allowed.map((c) => [c.code, c]));
  return [...new Set(codes)].map((code) => byCode.get(code)).filter((c): c is Clue => !!c);
}

/** 증거를 제시했을 때 새로 무너지는 지점 */
export function breakpointFor(full: FullCase, session: PlaySession, suspectId: string, clueId: string) {
  const bp = full.breakpoints.find((b) => b.suspectId === suspectId && b.clueId === clueId);
  if (!bp || session.brokenIds.includes(bp.id)) return null;
  return bp;
}


/*
 * 정답 기준 (한곳에서 관리)
 *   해결      = 범인을 맞히고 점수가 SOLVED_SCORE 이상
 *   부분 해결 = 범인은 맞혔지만 점수가 모자람 (동기·수법·증거 중 틀린 게 많음)
 *   실패      = 범인을 틀림 (나머지를 다 맞혀도 실패)
 * 점수 = 범인 40 + 객관식 20(문항 수로 나눔) + 결정적 증거 15(맞힌 개수 비율) + 추리 서술 25(채점 포인트 비율) - 힌트 1개당 HINT_PENALTY(5)
 *        + 효율 보너스: 범인을 맞히고 목표 행동 수 안에 풀면 +10, 1.5배 안이면 +5 (최대 110점)
 *   서술 없이 나머지를 다 맞히면 75점이라, 해결하려면 사건의 전말을 어느 정도 써야 한다
 * 서술 채점 도입 전에 제출한 기록(narrative 없음)은 예전 배점(LEGACY_POINTS)으로 계산한다.
 * 관리자 통계의 "성공"은 '해결'만 센다.
 */
export const SOLVED_SCORE = 80;
export const POINTS = { culprit: 40, quiz: 20, evidence: 15, narrative: 25, efficiency: 10 } as const;
const LEGACY_POINTS = { culprit: 50, quiz: 30, evidence: 20, narrative: 0, efficiency: 0 } as const;
/** 목표 행동 수의 이 배수 안이면 효율 보너스 절반 */
export const EFFICIENCY_HALF_RATIO = 1.5;

/** 효율 보너스: 목표 행동 수 안이면 전부, 1.5배 안이면 절반 */
export function efficiencyBonus(target: number | null, used: number, max: number) {
  if (!target) return 0;
  if (used <= target) return max;
  if (used <= Math.floor(target * EFFICIENCY_HALF_RATIO)) return max / 2;
  return 0;
}
const LEGACY_HINT_PENALTY = 10; // 예전 기록은 제출할 때의 감점으로 다시 계산해야 저장된 점수·엔딩과 맞는다
export const MAX_NARRATIVE = 3000; // 서술형 추리 글자 수
export const GUIDE_NOTE_MIN = 40; // 가이드 '추리 정리하기' 단계: 메모를 이만큼 쓰면 다음 단계로

const VERDICT_VALUE = { hit: 1, partial: 0.5, miss: 0 } as const;

/** 서술 채점 결과 → 0~1 (포인트 가중치 반영) */
export function narrativeRatio(g: NarrativeGrade | undefined) {
  const total = g?.points.reduce((sum, p) => sum + p.weight, 0) ?? 0;
  if (!g || !total) return 0;
  return g.points.reduce((sum, p) => sum + p.weight * VERDICT_VALUE[p.verdict], 0) / total;
}

/** 서술 채점 요약 (예: 채점 포인트 5개 중 맞음 3 · 부분 1) */
function narrativeSummary(g: NarrativeGrade | undefined) {
  if (!g) return "";
  const n = (v: string) => g.points.filter((p) => p.verdict === v).length;
  return `채점 포인트 ${g.points.length}개 중 맞음 ${n("hit")} · 부분 ${n("partial")}`;
}

export interface GradeItem {
  kind: "culprit" | "quiz" | "evidence" | "narrative" | "efficiency";
  label: string;
  ok: boolean;
  mine: string; // 플레이어가 고른 것
  answer: string; // 정답
  points: number;
  max: number;
}

export interface Grade {
  score: number;
  ending: "correct" | "partial" | "wrong";
  culpritCorrect: boolean;
  quizCorrect: boolean[];
  evidenceMatched: number;
  evidenceNeeded: number;
  hintPenalty: number;
  /** 항목별 비교 (범인, 객관식 문항들, 결정적 증거) */
  items: GradeItem[];
  /** 내 추리와 실제 정답의 일치율 (0~100). 범인 1 + 객관식 문항 수 + 증거 칸 수 중 맞힌 비율 */
  matchRate: number;
  /** 제출한 증거 하나하나가 결정적 증거였는지 */
  evidence: { name: string; ok: boolean }[];
  /** 찾았어야 할 결정적 증거 중 내지 않은 것 */
  missedKeys: { name: string; found: boolean }[];
  /** 서술형 추리와 채점 결과 (예전 기록이면 null) */
  narrative: { text: string; grade: NarrativeGrade | null } | null;
  /** 채점 결과를 저장하기 전의 기록이라 항목별 내역을 지금 사건 기준으로 다시 계산했고, 그 합이 저장된 점수와 다르다 */
  stale?: boolean;
}

/**
 * 결과 화면용 채점 결과. 제출할 때 저장해 둔 결과가 있으면 그대로 쓴다 (사건을 고쳐도 지난 기록은 그대로).
 * 저장하기 전의 기록은 지금 사건으로 다시 계산하되, 점수·엔딩·일치율은 제출할 때 저장된 값을 쓴다
 */
export function savedGrade(full: FullCase, session: PlaySession): Grade | null {
  const a = session.accusation;
  if (!a) return null;
  if (a.graded) return a.graded;
  const g = grade(full, session, a);
  if (session.score == null || session.ending == null || session.ending === "gaveup") return g;
  const stale = g.score !== session.score || g.ending !== session.ending;
  return { ...g, score: session.score, ending: session.ending, matchRate: session.matchRate ?? g.matchRate, stale };
}

export function grade(full: FullCase, session: PlaySession, a: Accusation): Grade {
  const c = full.case;
  const suspectName = (id: string | null | undefined) => full.suspects.find((s) => s.id === id)?.name ?? "-";
  const clueName = (id: string) => full.clues.find((x) => x.id === id)?.name ?? "-";

  const culpritCorrect = a.culpritId === c.culpritId;
  const quizCorrect = c.quiz.map((q, i) => a.answers[i] === q.answer);

  const keyIds = new Set(full.clues.filter((x) => x.isKey).map((x) => x.id));
  const found = new Set(session.foundClueIds);
  const evidenceNeeded = Math.min(MAX_EVIDENCE, keyIds.size);
  const evidence = a.evidenceIds.map((id) => ({ name: clueName(id), ok: keyIds.has(id) && found.has(id) }));
  const evidenceMatched = Math.min(evidenceNeeded, evidence.filter((e) => e.ok).length);
  const missedKeys = [...keyIds].filter((id) => !a.evidenceIds.includes(id)).map((id) => ({ name: clueName(id), found: found.has(id) }));

  const legacy = a.narrative === undefined;
  const P = legacy ? LEGACY_POINTS : POINTS;
  const ratio = narrativeRatio(a.narrativeGrade);

  const quizMax = c.quiz.length ? P.quiz / c.quiz.length : 0;
  const items: GradeItem[] = [
    { kind: "culprit", label: "범인", ok: culpritCorrect, mine: suspectName(a.culpritId), answer: suspectName(c.culpritId), points: culpritCorrect ? P.culprit : 0, max: P.culprit },
    ...c.quiz.map((q, i) => ({
      kind: "quiz" as const,
      label: q.question,
      ok: quizCorrect[i],
      mine: q.options[a.answers[i]] ?? "-",
      answer: q.options[q.answer],
      points: quizCorrect[i] ? quizMax : 0,
      max: quizMax,
    })),
    {
      kind: "evidence",
      label: "결정적 증거",
      ok: evidenceMatched === evidenceNeeded,
      mine: evidence.map((e) => e.name).join(", ") || "-",
      answer: `결정적 증거 ${keyIds.size}개 중 ${evidenceNeeded}개`,
      points: evidenceNeeded ? (P.evidence * evidenceMatched) / evidenceNeeded : P.evidence,
      max: P.evidence,
    },
    ...(legacy
      ? []
      : [
          {
            kind: "narrative" as const,
            label: "추리 서술",
            ok: ratio >= 0.7,
            mine: a.narrative || "-",
            answer: narrativeSummary(a.narrativeGrade),
            points: P.narrative * ratio,
            max: P.narrative,
          },
        ]),
    // 효율 보너스 (목표 행동 수가 있는 사건, 범인을 맞혔을 때만. 아무나 빨리 찍어서 받지 않도록)
    ...(legacy || !c.targetActions
      ? []
      : [
          {
            kind: "efficiency" as const,
            label: "효율 보너스",
            ok: culpritCorrect && session.actionsUsed <= c.targetActions,
            mine: `행동 ${session.actionsUsed}회`,
            answer: `목표 ${c.targetActions}회 이내 +${P.efficiency} · ${Math.floor(c.targetActions * EFFICIENCY_HALF_RATIO)}회 이내 +${P.efficiency / 2} (범인을 맞혔을 때)`,
            points: culpritCorrect ? efficiencyBonus(c.targetActions, session.actionsUsed, P.efficiency) : 0,
            max: P.efficiency,
          },
        ]),
  ];
  // 객관식이 없는 사건은 그 점수를 그냥 준다 (범인과 증거만으로 채점)
  const raw = items.reduce((sum, it) => sum + it.points, 0) + (c.quiz.length ? 0 : P.quiz);
  const hintPenalty = session.hintsUsed * (legacy ? LEGACY_HINT_PENALTY : HINT_PENALTY);
  const score = Math.max(0, Math.round(raw - hintPenalty));
  const ending = culpritCorrect && score >= SOLVED_SCORE ? "correct" : culpritCorrect ? "partial" : "wrong";

  // 일치율: 서술은 한 칸으로 치고 채점 비율만큼 맞힌 것으로 본다
  const slots = 1 + c.quiz.length + evidenceNeeded + (legacy ? 0 : 1);
  const hits = (culpritCorrect ? 1 : 0) + quizCorrect.filter(Boolean).length + evidenceMatched + (legacy ? 0 : ratio);
  const matchRate = Math.round((100 * hits) / slots);

  const narrative = legacy ? null : { text: a.narrative ?? "", grade: a.narrativeGrade ?? null };
  return { score, ending, culpritCorrect, quizCorrect, evidenceMatched, evidenceNeeded, hintPenalty, items, matchRate, evidence, missedKeys, narrative };
}
