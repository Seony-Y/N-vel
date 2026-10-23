import { eq, inArray } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { db } from "@/db";
import { breakpoints, cases, clues, locations, suspects } from "@/db/schema";
import type { FullCase } from "@/lib/game/load";
import type { CaseFile } from "./format";

/**
 * 사건 파일을 DB 에 저장한다 (새로 만들기 / 덮어쓰기). 한 트랜잭션으로 실행.
 *
 * 수정할 때 같은 코드(L1, S1, C1)의 장소·용의자·단서는 id 를 그대로 유지한다.
 * 그래야 진행 중인 플레이 기록(찾은 단서 id 등)과 끝난 기록(지목한 범인 id)이 깨지지 않는다.
 * 하위 항목은 전부 지우고 같은 id 로 다시 넣는다.
 */
export async function writeCase(
  file: CaseFile,
  opts: { caseId?: string; ownerId?: string | null; isOfficial?: boolean; isPublic?: boolean } = {},
): Promise<string> {
  const caseId = opts.caseId ?? crypto.randomUUID();

  // 기존 코드 → id
  const ids = new Map<string, string>();
  if (opts.caseId) {
    const [l, s, c] = await Promise.all([
      db.select({ code: locations.code, id: locations.id }).from(locations).where(eq(locations.caseId, caseId)),
      db.select({ code: suspects.code, id: suspects.id }).from(suspects).where(eq(suspects.caseId, caseId)),
      db.select({ code: clues.code, id: clues.id }).from(clues).where(eq(clues.caseId, caseId)),
    ]);
    for (const r of [...l, ...s, ...c]) ids.set(r.code, r.id);
  }
  for (const x of [...file.locations, ...file.suspects, ...file.clues]) if (!ids.has(x.code)) ids.set(x.code, crypto.randomUUID());
  const id = (code: string) => ids.get(code)!;

  const caseValues = {
    slug: file.slug ?? null,
    title: file.title,
    tagline: file.tagline,
    rating: file.rating,
    warningTags: file.warningTags,
    difficulty: file.difficulty,
    estimatedMinutes: file.estimatedMinutes,
    coverImage: file.coverImage ?? null,
    briefing: file.briefing,
    introHtml: file.introHtml,
    victim: file.victim,
    maxActions: file.maxActions,
    hints: file.hints,
    guide: file.guide.map((g) => ({ ...g, ...(g.goal && { goal: { ...g.goal, target: id(g.goal.target), ...(g.goal.clue && { clue: id(g.goal.clue) }) } }) })),
    script: file.script.map((s) => ({ ...s, where: id(s.where), ...(s.present && { present: id(s.present) }), reveals: s.reveals.map(id), requires: s.requires.map(id) })),
    culpritId: id(file.culprit),
    truth: file.truth,
    quiz: file.quiz,
    endingCorrect: file.endingCorrect,
    endingPartial: file.endingPartial,
    endingWrong: file.endingWrong,
    endingGiveUp: file.endingGiveUp,
    ...(opts.isPublic !== undefined && { isPublic: opts.isPublic }),
    updatedAt: new Date(),
  };

  const queries: BatchItem<"pg">[] = [];
  if (opts.caseId) {
    const susIds = db.select({ id: suspects.id }).from(suspects).where(eq(suspects.caseId, caseId));
    queries.push(
      db.update(cases).set(caseValues).where(eq(cases.id, caseId)),
      db.delete(breakpoints).where(inArray(breakpoints.suspectId, susIds)),
      db.delete(clues).where(eq(clues.caseId, caseId)),
      db.delete(suspects).where(eq(suspects.caseId, caseId)),
      db.delete(locations).where(eq(locations.caseId, caseId)),
    );
  } else {
    queries.push(db.insert(cases).values({ id: caseId, ownerId: opts.ownerId ?? null, isOfficial: opts.isOfficial ?? false, isPublic: opts.isPublic ?? false, ...caseValues }));
  }

  queries.push(
    db.insert(locations).values(file.locations.map((l, i) => ({ id: id(l.code), caseId, code: l.code, sortOrder: i, name: l.name, description: l.description, detail: l.detail }))),
    db.insert(suspects).values(
      file.suspects.map((s, i) => ({
        id: id(s.code),
        caseId,
        code: s.code,
        sortOrder: i,
        name: s.name,
        age: s.age ?? null,
        role: s.role,
        profile: s.profile,
        portrait: s.portrait ?? null,
        personality: s.personality,
        speechStyle: s.speechStyle,
        alibi: s.alibi,
        actual: s.actual,
        secrets: s.secrets,
        knowledge: s.knowledge,
      })),
    ),
    db.insert(clues).values(
      file.clues.map((c, i) => ({
        id: id(c.code),
        caseId,
        code: c.code,
        sortOrder: i,
        name: c.name,
        description: c.description,
        image: c.image ?? null,
        docHtml: c.docHtml,
        locationId: c.location ? id(c.location) : null,
        holderId: c.holder ? id(c.holder) : null,
        discoverHint: c.discoverHint,
        requires: c.requires.map(id),
        lockLabel: c.lock?.label ?? null,
        passcode: c.lock?.passcode ?? null,
        isKey: c.isKey,
      })),
    ),
  );

  const bps = file.suspects.flatMap((s) =>
    s.breakpoints.map((b) => ({ suspectId: id(s.code), clueId: id(b.clue), admission: b.admission, revealsClueId: b.reveals ? id(b.reveals) : null })),
  );
  if (bps.length) queries.push(db.insert(breakpoints).values(bps));

  await db.batch(queries as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
  return caseId;
}

/** 공식 사건 시드용: 같은 slug 가 있으면 그 사건을 덮어쓰고, 없으면 새로 만든다 */
export async function upsertBySlug(file: CaseFile, opts: { isOfficial?: boolean; isPublic?: boolean }) {
  const [existing] = file.slug ? await db.select({ id: cases.id }).from(cases).where(eq(cases.slug, file.slug)) : [];
  return writeCase(file, { ...opts, caseId: existing?.id });
}

/** DB 의 사건을 사건 파일 형식으로 (에디터에서 불러오기·내보내기용). 진상이 포함되므로 만든 사람에게만 */
export function toCaseFile(full: FullCase): CaseFile {
  const code = new Map<string, string>();
  for (const x of [...full.locations, ...full.suspects, ...full.clues]) code.set(x.id, x.code);
  const c = full.case;
  return {
    ...(c.slug && { slug: c.slug }),
    title: c.title,
    tagline: c.tagline,
    rating: c.rating,
    warningTags: c.warningTags,
    difficulty: c.difficulty,
    estimatedMinutes: c.estimatedMinutes,
    ...(c.coverImage && { coverImage: c.coverImage }),
    briefing: c.briefing,
    introHtml: c.introHtml,
    victim: c.victim,
    maxActions: c.maxActions,
    hints: c.hints,
    guide: c.guide.map((g) => ({ ...g, ...(g.goal && { goal: { ...g.goal, target: code.get(g.goal.target) ?? "", ...(g.goal.clue && { clue: code.get(g.goal.clue) }) } }) })),
    script: c.script.map((s) => ({
      ...s,
      where: code.get(s.where) ?? "",
      ...(s.present && { present: code.get(s.present) }),
      reveals: s.reveals.map((r) => code.get(r)!).filter(Boolean),
      requires: s.requires.map((r) => code.get(r)!).filter(Boolean),
    })),
    culprit: code.get(c.culpritId ?? "") ?? "",
    truth: c.truth,
    quiz: c.quiz,
    endingCorrect: c.endingCorrect,
    endingPartial: c.endingPartial,
    endingWrong: c.endingWrong,
    endingGiveUp: c.endingGiveUp,
    locations: full.locations.map((l) => ({ code: l.code, name: l.name, description: l.description, detail: l.detail })),
    suspects: full.suspects.map((s) => ({
      code: s.code,
      name: s.name,
      ...(s.age != null && { age: s.age }),
      role: s.role,
      profile: s.profile,
      ...(s.portrait && { portrait: s.portrait }),
      personality: s.personality,
      speechStyle: s.speechStyle,
      alibi: s.alibi,
      actual: s.actual,
      secrets: s.secrets,
      knowledge: s.knowledge,
      breakpoints: full.breakpoints
        .filter((b) => b.suspectId === s.id)
        .map((b) => ({ clue: code.get(b.clueId)!, admission: b.admission, ...(b.revealsClueId && { reveals: code.get(b.revealsClueId) }) })),
    })),
    clues: full.clues.map((x) => ({
      code: x.code,
      name: x.name,
      description: x.description,
      ...(x.image && { image: x.image }),
      docHtml: x.docHtml,
      ...(x.locationId && { location: code.get(x.locationId) }),
      ...(x.holderId && { holder: code.get(x.holderId) }),
      discoverHint: x.discoverHint,
      requires: x.requires.map((r) => code.get(r)!).filter(Boolean),
      ...(x.passcode && { lock: { label: x.lockLabel ?? "잠금 장치", passcode: x.passcode } }),
      isKey: x.isKey,
    })),
  };
}
