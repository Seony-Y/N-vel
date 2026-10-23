import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/*
 * DB 스키마. 바꾼 뒤에는 `npm run db:generate` → `npm run db:migrate`
 * 접근 권한(본인 데이터만)은 DB 가 아니라 서버 코드에서 확인한다
 */

// ───────────────────────── 로그인 (Better Auth 필수 테이블) ─────────────────────────
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: text("role", { enum: ["user", "admin"] }).notNull().default("user"), // 관리자 지정: npm run admin -- <이메일>
  credits: integer("credits").notNull().default(0), // 크레딧 잔액. 바꿀 때는 반드시 src/lib/credits.ts 를 거친다 (내역이 남도록)
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  providerId: text("provider_id").notNull(),
  accountId: text("account_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// 가입·로그인 요청 횟수 제한 (Better Auth). 서버가 여러 대여도 한도가 공유되도록 DB 에 둔다
export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});


// ───────────────────────── 사건 ─────────────────────────
// 진상(culprit~solution)은 서버 전용. 화면으로 보내는 값은 src/lib/cases/public.ts 에서 골라낸다
export const caseRating = pgEnum("case_rating", ["all", "15", "19"]);

export interface QuizQuestion {
  question: string; // 예) 흉기는 무엇인가?
  options: string[];
  answer: number; // 정답 options 인덱스
}

/** 플레이 가이드 한 단계. 목표의 대상은 DB 에서는 id, 사건 파일에서는 코드(L1, S1, C1) */
export interface GuideStep {
  title: string;
  body: string;
  goal?: { type: "visit" | "find" | "talk" | "present"; target: string; clue?: string }; // present: target 에게 clue 를 제시. 없으면 읽기만 하는 단계
}

/**
 * 대본 사건의 정해진 선택지 하나. 대본이 있는 사건은 AI 를 부르지 않고 이대로 응답한다 (크레딧 무료).
 * where: 장소(그 장소에서 조사) 또는 용의자(심문). say 를 고르거나, 용의자에게 present 단서를 제시하면 reply 를 보여 주고 reveals 단서를 준다
 */
export interface ScriptLine {
  where: string;
  say?: string;
  present?: string;
  reply: string;
  reveals: string[];
  requires: string[]; // 이 단서를 모두 찾아야 선택지가 보인다
}

export const cases = pgTable(
  "cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").unique(), // 공식 사건의 고정 주소·시드 식별자
    ownerId: text("owner_id").references(() => user.id, { onDelete: "cascade" }), // 공식 사건은 null
    isOfficial: boolean("is_official").notNull().default(false),
    isPublic: boolean("is_public").notNull().default(false),
    // ── 공개 정보 ──
    title: text("title").notNull(),
    tagline: text("tagline").notNull().default(""),
    rating: caseRating("rating").notNull().default("15"),
    warningTags: text("warning_tags").array().notNull().default([]),
    difficulty: integer("difficulty").notNull().default(2), // 1~5
    estimatedMinutes: integer("estimated_minutes").notNull().default(30),
    coverImage: text("cover_image"),
    briefing: text("briefing").notNull().default(""), // 플레이 시작 시 보여주는 사건 개요
    introHtml: text("intro_html").notNull().default(""), // 꾸민 도입부 (선택)
    victim: text("victim").notNull().default(""), // 피해자 공개 정보
    maxActions: integer("max_actions"), // 행동 횟수 제한. null 이면 무제한
    hints: text("hints").array().notNull().default([]), // 순서대로 공개, 쓸 때마다 감점
    guide: jsonb("guide").$type<GuideStep[]>().notNull().default([]), // 처음 하는 사람을 위한 단계별 안내 (프롤로그 사건)
    script: jsonb("script").$type<ScriptLine[]>().notNull().default([]), // 있으면 AI 대신 정해진 대본으로 진행 (무료)
    // ── 진상 (비공개) ──
    culpritId: uuid("culprit_id"), // suspects.id. 순환 참조라 FK 는 걸지 않음
    truth: text("truth").notNull().default(""), // 실제로 일어난 일 (타임라인)
    quiz: jsonb("quiz").$type<QuizQuestion[]>().notNull().default([]), // 동기·수단 등 객관식
    endingCorrect: text("ending_correct").notNull().default(""),
    endingPartial: text("ending_partial").notNull().default(""),
    endingWrong: text("ending_wrong").notNull().default(""),
    endingGiveUp: text("ending_give_up").notNull().default(""), // 수사를 포기했을 때 (비우면 기본 문구)
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("cases_list_idx").on(t.isPublic, t.isOfficial, t.updatedAt), index("cases_owner_idx").on(t.ownerId)],
);

// 조사할 수 있는 장소
export const locations = pgTable(
  "locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id").notNull().references(() => cases.id, { onDelete: "cascade" }),
    code: text("code").notNull(), // 사건 안에서의 짧은 식별자 (L1)
    sortOrder: integer("sort_order").notNull().default(0),
    name: text("name").notNull(),
    description: text("description").notNull().default(""), // 들어가면 보이는 공개 묘사
    detail: text("detail").notNull().default(""), // 나레이터만 아는 상세 (무엇이 어디 있는지)
  },
  (t) => [unique().on(t.caseId, t.code)],
);

// 용의자. 진상 관련 필드는 그 용의자의 프롬프트에만 들어간다
export const suspects = pgTable(
  "suspects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id").notNull().references(() => cases.id, { onDelete: "cascade" }),
    code: text("code").notNull(), // S1
    sortOrder: integer("sort_order").notNull().default(0),
    // 공개
    name: text("name").notNull(),
    age: integer("age"),
    role: text("role").notNull().default(""), // 피해자와의 관계, 직업
    profile: text("profile").notNull().default(""), // 첫인상, 공개 소개
    portrait: text("portrait"),
    // 연기용
    personality: text("personality").notNull().default(""),
    speechStyle: text("speech_style").notNull().default(""),
    // 비공개
    alibi: text("alibi").notNull().default(""), // 주장하는 알리바이
    actual: text("actual").notNull().default(""), // 실제 행적
    secrets: text("secrets").notNull().default(""), // 숨기는 것, 거짓말 지침
    knowledge: text("knowledge").notNull().default(""), // 다른 사람·사건에 대해 아는 것
  },
  (t) => [unique().on(t.caseId, t.code)],
);

// 단서. 장소에 있거나(locationId) 용의자가 증언으로 준다(holderId)
export const clues = pgTable(
  "clues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id").notNull().references(() => cases.id, { onDelete: "cascade" }),
    code: text("code").notNull(), // C1, T1
    sortOrder: integer("sort_order").notNull().default(0),
    name: text("name").notNull(),
    description: text("description").notNull(), // 발견하면 수첩에 적히는 내용
    image: text("image"),
    docHtml: text("doc_html").notNull().default(""), // 편지·신문 등 문서 (선택)
    locationId: uuid("location_id").references(() => locations.id, { onDelete: "cascade" }),
    holderId: uuid("holder_id").references(() => suspects.id, { onDelete: "cascade" }),
    discoverHint: text("discover_hint").notNull().default(""), // AI 판정용: 어떻게 하면 찾는지
    requires: uuid("requires").array().notNull().default([]), // 먼저 찾아야 하는 단서 id
    lockLabel: text("lock_label"), // 잠금 단서: 화면에 보이는 이름 (예: 금고, 숫자 4자리)
    passcode: text("passcode"), // 잠금 단서의 정답. 서버에서만 비교
    isKey: boolean("is_key").notNull().default(false), // 결정적 증거 (채점용)
  },
  (t) => [unique().on(t.caseId, t.code), index("clues_case_idx").on(t.caseId)],
);

// 증거를 들이밀었을 때 용의자가 무너지는 지점
export const breakpoints = pgTable("breakpoints", {
  id: uuid("id").primaryKey().defaultRandom(),
  suspectId: uuid("suspect_id").notNull().references(() => suspects.id, { onDelete: "cascade" }),
  clueId: uuid("clue_id").notNull().references(() => clues.id, { onDelete: "cascade" }),
  admission: text("admission").notNull(), // 이 증거 앞에서 인정하는 내용 (AI 연기 지침)
  revealsClueId: uuid("reveals_clue_id").references(() => clues.id, { onDelete: "set null" }), // 인정하면서 주는 증언 단서
});

// ───────────────────────── 플레이 ─────────────────────────
export interface Accusation {
  culpritId: string;
  answers: number[];
  evidenceIds: string[];
}

export const playSessions = pgTable(
  "play_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    caseId: uuid("case_id").notNull().references(() => cases.id, { onDelete: "cascade" }),
    model: text("model"),
    status: text("status", { enum: ["playing", "finished"] }).notNull().default("playing"),
    currentLocationId: uuid("current_location_id"),
    actionsUsed: integer("actions_used").notNull().default(0),
    hintsUsed: integer("hints_used").notNull().default(0),
    creditsUsed: integer("credits_used").notNull().default(0), // 사용자에게 차감한 크레딧 (행동 1회 = 모델별 크레딧)
    foundClueIds: uuid("found_clue_ids").array().notNull().default([]),
    brokenIds: uuid("broken_ids").array().notNull().default([]), // 무너진 breakpoints.id
    notes: text("notes").notNull().default(""),
    accusation: jsonb("accusation").$type<Accusation>(),
    score: integer("score"),
    matchRate: integer("match_rate"), // 추리와 정답의 일치율 0~100
    ending: text("ending", { enum: ["correct", "partial", "wrong", "gaveup"] }), // gaveup: 수사 포기 (추리 미제출)
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("play_sessions_user_idx").on(t.userId, t.updatedAt)],
);

// 대화 기록. thread 는 'narrator'(조사) 또는 용의자 id. 용의자끼리 기록을 공유하지 않는다
export const playMessages = pgTable(
  "play_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id").notNull().references(() => playSessions.id, { onDelete: "cascade" }),
    thread: text("thread").notNull(),
    role: text("role", { enum: ["user", "assistant", "event"] }).notNull(), // event: 단서 발견 등 화면 알림
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("play_messages_thread_idx").on(t.sessionId, t.thread, t.createdAt)],
);

// 즐겨찾기한 사건. 내 수사에서 먼저 보여 준다
export const caseFavorites = pgTable(
  "case_favorites",
  {
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    caseId: uuid("case_id").notNull().references(() => cases.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.caseId] })],
);

// ───────────────────────── 사용량 기록 ─────────────────────────
export const usageLogs = pgTable(
  "usage_logs",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => playSessions.id, { onDelete: "set null" }),
    kind: text("kind").notNull(), // 'narrator' | 'suspect' | 'review'
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
    cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
    costMicros: integer("cost_micros").notNull().default(0), // 실제 API 원가 (백만분의 1달러)
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("usage_logs_user_idx").on(t.userId, t.createdAt)],
);

// ───────────────────────── 이벤트 기록 (관리자용) ─────────────────────────
// 오류, AI 거절, 규칙 위반 요청 등 플레이 품질을 판단할 근거
export const eventLogs = pgTable(
  "event_logs",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    type: text("type", { enum: ["error", "refusal", "rejected_clue", "truncated"] }).notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => playSessions.id, { onDelete: "set null" }),
    caseId: uuid("case_id").references(() => cases.id, { onDelete: "set null" }),
    where: text("where").notNull(), // 'play/act', 'cases/review' 등
    message: text("message").notNull(),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("event_logs_created_idx").on(t.createdAt), index("event_logs_user_idx").on(t.userId, t.createdAt)],
);

// ───────────────────────── 크레딧 내역 ─────────────────────────
// 잔액(user.credits)이 바뀔 때마다 한 줄씩. 잔액이 왜 이렇게 됐는지 언제든 추적할 수 있게
export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(), // +지급 / -차감
    balanceAfter: integer("balance_after").notNull(),
    reason: text("reason", { enum: ["signup_bonus", "action", "refund", "admin"] }).notNull(),
    sessionId: uuid("session_id").references(() => playSessions.id, { onDelete: "set null" }),
    adminId: text("admin_id").references(() => user.id, { onDelete: "set null" }), // 관리자가 지급·회수한 경우
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("credit_ledger_user_idx").on(t.userId, t.createdAt),
    // 가입 보너스는 한 사람에게 한 번만 (동시에 두 번 인증돼도 두 번 지급되지 않게)
    uniqueIndex("credit_ledger_signup_bonus_once").on(t.userId).where(sql`${t.reason} = 'signup_bonus'`),
  ],
);
