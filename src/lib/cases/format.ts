import { z } from "zod";

/*
 * 사건 파일 형식 (JSON). 공식 사건 시드와, 나중에 사건 에디터의 저장/불러오기에 함께 쓴다.
 * 장소·용의자·단서는 id 대신 사건 안의 짧은 코드(L1, S1, C1)로 서로를 가리킨다. 가져올 때 실제 id 로 바꾼다.
 */

const code = z.string().regex(/^[A-Z][A-Z0-9]{0,7}$/, "코드는 영문 대문자로 시작하는 짧은 문자열 (예: C1)");
const https = z.url({ protocol: /^https$/ });

export const CaseFile = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]+$/).optional(),
    title: z.string().min(1).max(80),
    tagline: z.string().max(200).default(""),
    rating: z.enum(["all", "15", "19"]).default("15"),
    warningTags: z.array(z.string().max(20)).max(10).default([]),
    difficulty: z.number().int().min(1).max(5).default(2),
    estimatedMinutes: z.number().int().min(5).max(600).default(30),
    coverImage: https.optional(),
    briefing: z.string().min(1).max(4000),
    introHtml: z.string().max(50 * 1024).default(""),
    victim: z.string().max(2000).default(""),
    maxActions: z.number().int().min(5).max(500).nullable().default(null),
    hints: z.array(z.string().max(500)).max(10).default([]),
    // 플레이 가이드: 화면에 단계별로 보여 주고, 목표를 이루면 다음 단계로 넘어간다 (스포일러이므로 튜토리얼 사건에만)
    guide: z
      .array(
        z.object({
          title: z.string().min(1).max(60),
          body: z.string().min(1).max(1000),
          goal: z.object({ type: z.enum(["visit", "find", "talk", "present"]), target: code, clue: code.optional() }).optional(),
        }),
      )
      .max(20)
      .default([]),
    // 대본: 있으면 AI 대신 정해진 선택지와 반응으로 진행한다 (크레딧 무료). 자유 입력은 받지 않는다
    script: z
      .array(
        z.object({
          where: code, // 장소 코드(조사) 또는 용의자 코드(심문)
          say: z.string().min(1).max(200).optional(), // 플레이어가 고르는 선택지
          present: code.optional(), // 또는 이 단서를 제시했을 때의 반응
          reply: z.string().min(1).max(2000),
          reveals: z.array(code).max(5).default([]),
          requires: z.array(code).max(5).default([]),
        }),
      )
      .max(200)
      .default([]),

    culprit: code,
    truth: z.string().min(1).max(8000),
    quiz: z
      .array(z.object({ question: z.string().min(1).max(200), options: z.array(z.string().min(1).max(200)).min(2).max(6), answer: z.number().int().min(0) }))
      .max(5)
      .default([]),
    endingCorrect: z.string().max(4000).default(""),
    endingPartial: z.string().max(4000).default(""),
    endingWrong: z.string().max(4000).default(""),
    endingGiveUp: z.string().max(4000).default(""),

    locations: z
      .array(z.object({ code, name: z.string().min(1).max(50), description: z.string().max(2000).default(""), detail: z.string().max(4000).default("") }))
      .min(1)
      .max(20),
    suspects: z
      .array(
        z.object({
          code,
          name: z.string().min(1).max(50),
          age: z.number().int().min(0).max(150).optional(),
          role: z.string().max(200).default(""),
          profile: z.string().max(2000).default(""),
          portrait: https.optional(),
          personality: z.string().max(2000).default(""),
          speechStyle: z.string().max(1000).default(""),
          alibi: z.string().max(2000).default(""),
          actual: z.string().max(4000).default(""),
          secrets: z.string().max(4000).default(""),
          knowledge: z.string().max(4000).default(""),
          breakpoints: z
            .array(z.object({ clue: code, admission: z.string().min(1).max(2000), reveals: code.optional() }))
            .max(20)
            .default([]),
        }),
      )
      .min(2)
      .max(10),
    clues: z
      .array(
        z.object({
          code,
          name: z.string().min(1).max(60),
          description: z.string().min(1).max(2000),
          image: https.optional(),
          docHtml: z.string().max(50 * 1024).default(""),
          location: code.optional(),
          holder: code.optional(),
          discoverHint: z.string().max(1000).default(""),
          requires: z.array(code).max(5).default([]),
          lock: z.object({ label: z.string().min(1).max(60), passcode: z.string().min(1).max(30) }).optional(),
          isKey: z.boolean().default(false),
        }),
      )
      .min(1)
      .max(60),
  })
  .superRefine((c, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: "custom", message });
    const L = new Set(c.locations.map((l) => l.code));
    const S = new Set(c.suspects.map((s) => s.code));
    const C = new Set(c.clues.map((x) => x.code));
    const dup = (arr: string[]) => arr.find((x, i) => arr.indexOf(x) !== i);
    const d = dup([...c.locations.map((l) => l.code), ...c.suspects.map((s) => s.code), ...c.clues.map((x) => x.code)]);
    if (d) issue(`코드가 겹칩니다: ${d}`);
    if (!S.has(c.culprit)) issue(`범인 코드가 용의자에 없습니다: ${c.culprit}`);
    for (const q of c.quiz) if (q.answer >= q.options.length) issue(`퀴즈 정답 번호가 보기 범위를 벗어났습니다: ${q.question}`);
    for (const x of c.clues) {
      if (!x.location === !x.holder) issue(`단서 ${x.code}: location 과 holder 중 하나만 지정하세요`);
      if (x.location && !L.has(x.location)) issue(`단서 ${x.code}: 없는 장소 ${x.location}`);
      if (x.holder && !S.has(x.holder)) issue(`단서 ${x.code}: 없는 용의자 ${x.holder}`);
      for (const r of x.requires) if (!C.has(r)) issue(`단서 ${x.code}: 없는 선행 단서 ${r}`);
    }
    for (const s of c.suspects) {
      for (const b of s.breakpoints) {
        if (!C.has(b.clue)) issue(`용의자 ${s.code}: 없는 단서 ${b.clue}`);
        if (b.reveals && !C.has(b.reveals)) issue(`용의자 ${s.code}: 없는 단서 ${b.reveals}`);
      }
    }
    for (const [i, g] of c.guide.entries()) {
      if (!g.goal) continue;
      const { type, target, clue } = g.goal;
      const want = type === "visit" ? L : type === "find" ? C : S;
      if (!want.has(target)) issue(`가이드 ${i + 1}단계: 없는 대상 ${target}`);
      if (type === "present" && !(clue && C.has(clue))) issue(`가이드 ${i + 1}단계: 제시할 단서를 지정하세요`);
    }
    for (const [i, s] of c.script.entries()) {
      const at = `대본 ${i + 1}번`;
      if (!L.has(s.where) && !S.has(s.where)) issue(`${at}: 없는 장소·용의자 ${s.where}`);
      if (!s.say === !s.present) issue(`${at}: say 와 present 중 하나만 지정하세요`);
      if (s.present && !S.has(s.where)) issue(`${at}: 증거 제시는 용의자에게만 할 수 있습니다`);
      for (const x of [s.present, ...s.reveals, ...s.requires]) if (x && !C.has(x)) issue(`${at}: 없는 단서 ${x}`);
    }
    if (!c.clues.some((x) => x.isKey)) issue("결정적 증거(isKey)가 하나 이상 있어야 합니다");
  });

export type CaseFile = z.infer<typeof CaseFile>;
