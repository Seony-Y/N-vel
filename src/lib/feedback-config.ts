/** 신고·평가 선택지 (서버·화면 공통) */
export const REPORT_REASONS = {
  real_person: "실존 인물 비방·사생활 침해",
  harmful: "따라 할 수 있는 범죄 방법",
  sexual: "미성년자 관련·성적인 내용",
  hate: "혐오·차별",
  copyright: "저작권 침해",
  other: "그 밖의 문제",
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;

export const LEVELS = { easy: "쉬웠어요", ok: "적당해요", hard: "어려웠어요" } as const;
export const LENGTHS = { short: "짧았어요", ok: "적당해요", long: "길었어요" } as const;
export type Level = keyof typeof LEVELS;
export type Length = keyof typeof LENGTHS;
