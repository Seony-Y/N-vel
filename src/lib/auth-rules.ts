/** 서버(auth.ts)와 화면(로그인 폼)이 함께 쓰는 규칙 */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
export const NAME_MAX = 30;

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "이메일 또는 비밀번호가 올바르지 않습니다.",
  INVALID_EMAIL: "이메일 형식이 올바르지 않습니다.",
  USER_ALREADY_EXISTS: "이미 가입된 이메일입니다.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "이미 가입된 이메일입니다.",
  PASSWORD_TOO_SHORT: `비밀번호는 ${PASSWORD_MIN}자 이상이어야 합니다.`,
  PASSWORD_TOO_LONG: `비밀번호는 ${PASSWORD_MAX}자 이하여야 합니다.`,
};

/** Better Auth 오류 코드를 한국어 안내 문구로 바꾼다 */
export function authErrorMessage(error: { code?: string; status?: number } | null | undefined): string {
  if (error?.code && ERROR_MESSAGES[error.code]) return ERROR_MESSAGES[error.code];
  if (error?.status === 429) return "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";
  return "문제가 발생했습니다. 잠시 후 다시 시도해 주세요.";
}

/** 로그인 후 돌아갈 주소. 외부 사이트로 보내지 않도록 내부 경로만 허용 */
export function safeRedirect(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
