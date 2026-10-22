import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic();

/**
 * 응답 1회의 출력 상한. 사고(thinking) 토큰도 여기에 포함되므로 너무 낮추면 응답이 잘린다.
 * 실제 길이는 프롬프트의 "짧게 답하라" 지시로 조절한다.
 * 모델은 플레이마다 고른다 (models.ts)
 */
export const CHAT_MAX_TOKENS = 2000;
