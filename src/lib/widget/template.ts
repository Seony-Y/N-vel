/*
 * 제작자가 입력한 HTML 코드(사건 도입부, 문서 단서)를 화면에 띄울 문서로 만든다.
 *
 * 보안 원칙
 * - 결과물은 반드시 <SandboxedHtml> (sandbox iframe) 안에서만 렌더링한다.
 * - sandbox 에 allow-scripts 를 주지 않으므로 <script>, onclick 등은 실행되지 않는다.
 * - CSP 로 스크립트·연결을 막는다. 이미지와 글꼴만 https 로 허용한다.
 */

const CSP = ["default-src 'none'", "img-src https: data:", "style-src 'unsafe-inline'", "font-src https: data:"].join("; ");

export function buildSandboxDocument(code: string): string {
  return `<!doctype html>
<html><head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>html,body{margin:0;font-family:system-ui,sans-serif;}</style>
</head><body>${code}</body></html>`;
}
