import type { CaseFile } from "@/lib/cases/format";

/*
 * 사건 에디터의 편집 상태 = 사건 파일(CaseFile) 그대로.
 * 장소·용의자·단서는 코드(L1, S1, C1, T1)로 서로를 가리키고, 화면에서는 이름으로 보여준다.
 * 코드는 자동으로 붙이고, 한 번 붙인 코드는 바꾸지 않는다 (수정해도 진행 중인 플레이가 이어지도록).
 */

export type Draft = CaseFile;
export type DraftLocation = Draft["locations"][number];
export type DraftSuspect = Draft["suspects"][number];
export type DraftClue = Draft["clues"][number];

export function nextCode(prefix: "L" | "S" | "C" | "T", d: Draft) {
  const used = new Set([...d.locations, ...d.suspects, ...d.clues].map((x) => x.code));
  for (let i = 1; ; i++) if (!used.has(`${prefix}${i}`)) return `${prefix}${i}`;
}

export function emptyDraft(): Draft {
  return {
    title: "",
    tagline: "",
    rating: "15",
    warningTags: [],
    difficulty: 2,
    estimatedMinutes: 30,
    briefing: "",
    introHtml: "",
    victim: "",
    maxActions: 50,
    hints: [],
    culprit: "S1",
    truth: "",
    quiz: [],
    endingCorrect: "",
    endingPartial: "",
    endingWrong: "",
    endingGiveUp: "",
    locations: [{ code: "L1", name: "", description: "", detail: "" }],
    suspects: [emptySuspect("S1"), emptySuspect("S2")],
    clues: [],
  };
}

export function emptySuspect(code: string): DraftSuspect {
  return { code, name: "", role: "", profile: "", personality: "", speechStyle: "", alibi: "", actual: "", secrets: "", knowledge: "", breakpoints: [] };
}

export function emptyClue(code: string, where: { location?: string; holder?: string }): DraftClue {
  return { code, name: "", description: "", docHtml: "", discoverHint: "", requires: [], isKey: false, ...where };
}

/** 항목을 지울 때 그 항목을 가리키던 참조도 함께 정리한다 */
export function removeLocation(d: Draft, code: string) {
  d.locations = d.locations.filter((l) => l.code !== code);
  for (const c of d.clues) if (c.location === code) c.location = undefined;
}

export function removeSuspect(d: Draft, code: string) {
  d.suspects = d.suspects.filter((s) => s.code !== code);
  d.clues = d.clues.filter((c) => c.holder !== code); // 그 사람의 증언도 함께 삭제
  if (d.culprit === code) d.culprit = d.suspects[0]?.code ?? "";
  cleanClueRefs(d);
}

export function removeClue(d: Draft, code: string) {
  d.clues = d.clues.filter((c) => c.code !== code);
  cleanClueRefs(d);
}

function cleanClueRefs(d: Draft) {
  const codes = new Set(d.clues.map((c) => c.code));
  for (const c of d.clues) c.requires = c.requires.filter((r) => codes.has(r));
  for (const s of d.suspects) {
    s.breakpoints = s.breakpoints.filter((b) => codes.has(b.clue));
    for (const b of s.breakpoints) if (b.reveals && !codes.has(b.reveals)) b.reveals = undefined;
  }
}

/** 저장 전 정리: 빈 선택 항목을 없앤다 */
export function cleanDraft(d: Draft): Draft {
  const blank = (v?: string) => (v && v.trim() ? v.trim() : undefined);
  return {
    ...d,
    coverImage: blank(d.coverImage),
    warningTags: d.warningTags.map((t) => t.trim()).filter(Boolean),
    hints: d.hints.map((h) => h.trim()).filter(Boolean),
    suspects: d.suspects.map((s) => ({ ...s, portrait: blank(s.portrait), age: Number.isFinite(s.age) ? s.age : undefined })),
    clues: d.clues.map((c) => ({ ...c, image: blank(c.image) })),
  };
}

/** 저장 오류 경로(clues.3.name)가 어느 탭인지 */
export function tabForPath(path: string): TabId {
  const head = path.split(".")[0];
  if (head === "locations") return "locations";
  if (head === "suspects") return "suspects";
  if (head === "clues") return "clues";
  if (["culprit", "truth", "quiz"].includes(head)) return "truth";
  if (["endingCorrect", "endingPartial", "endingWrong", "endingGiveUp", "hints"].includes(head)) return "endings";
  return "basic";
}

export const TABS = [
  { id: "basic", label: "개요" },
  { id: "locations", label: "장소" },
  { id: "suspects", label: "용의자" },
  { id: "clues", label: "단서" },
  { id: "truth", label: "진상·채점" },
  { id: "endings", label: "엔딩·힌트" },
  { id: "review", label: "검수·공개" },
] as const;
export type TabId = (typeof TABS)[number]["id"];
