import { readFileSync } from "node:fs";
import { CaseFile } from "@/lib/cases/format";
import type { PlaySession } from "@/types/db";
import type { FullCase } from "./load";

/** 테스트용: 사건 파일을 DB 에서 읽은 모양으로. id 는 코드(C1)를 그대로 쓴다 */
export function fixture(slug: string): FullCase {
  const c = CaseFile.parse(JSON.parse(readFileSync(`content/cases/${slug}.json`, "utf8")));
  return {
    case: { ...c, culpritId: c.culprit },
    locations: c.locations.map((l) => ({ ...l, id: l.code })),
    suspects: c.suspects.map((s) => ({ ...s, id: s.code })),
    clues: c.clues.map((x) => ({ ...x, id: x.code, locationId: x.location ?? null, holderId: x.holder ?? null, passcode: x.lock?.passcode ?? null, lockLabel: x.lock?.label ?? null })),
    breakpoints: c.suspects.flatMap((s) => s.breakpoints.map((b, i) => ({ id: `${s.code}-${i}`, suspectId: s.code, clueId: b.clue, admission: b.admission, revealsClueId: b.reveals ?? null }))),
  } as unknown as FullCase;
}

export function playing(over: Partial<PlaySession> = {}): PlaySession {
  return { id: "s", model: null, currentLocationId: "L1", foundClueIds: [], brokenIds: [], hintsUsed: 0, actionsUsed: 0, ...over } as PlaySession;
}
