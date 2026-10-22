/** {{변수}} 에 들어갈 값 */
export type TemplateVars = Record<string, string | number | boolean>;

/*
 * 제작자가 입력한 HTML 코드(소개 페이지, 위젯)를 화면에 띄울 문서로 만든다.
 *
 * 보안 원칙
 * - 결과물은 반드시 <SandboxedHtml> (sandbox iframe) 안에서만 렌더링한다.
 * - sandbox 에 allow-scripts 를 주지 않으므로 <script>, onclick 등은 실행되지 않는다.
 * - CSP 로 외부 요청을 막는다. 이미지만 https 로 허용 (추적·데이터 유출 방지).
 * - {{변수}} 값은 HTML 이스케이프해서 넣는다. 상태값으로 태그를 주입할 수 없다.
 */

const CSP = [
  "default-src 'none'",
  "img-src https: data:",
  "style-src 'unsafe-inline'",
  "font-src https: data:",
].join("; ");

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** {{키}} 를 상태값으로 바꾼다. 없는 키는 빈 문자열 */
export function fillVariables(code: string, vars: TemplateVars): string {
  return code.replace(/\{\{\s*([\w가-힣]+)\s*\}\}/g, (_, key: string) =>
    key in vars ? escapeHtml(String(vars[key])) : "",
  );
}

export function buildSandboxDocument(code: string, vars: TemplateVars = {}): string {
  return `<!doctype html>
<html><head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>html,body{margin:0;font-family:system-ui,sans-serif;}</style>
</head><body>${fillVariables(code, vars)}</body></html>`;
}
