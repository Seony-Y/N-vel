import type { TemplateVars } from "@/lib/widget/template";
import { buildSandboxDocument } from "@/lib/widget/template";

/**
 * 사용자가 작성한 HTML 을 격리된 iframe 에서 보여준다.
 * sandbox="" (빈 값) = 스크립트·폼·팝업·상위 페이지 접근 전부 차단, 쿠키 접근 불가.
 */
export function SandboxedHtml({
  code,
  vars,
  title,
  className,
}: {
  code: string;
  vars?: TemplateVars;
  title: string;
  className?: string;
}) {
  return (
    <iframe
      title={title}
      sandbox=""
      referrerPolicy="no-referrer"
      srcDoc={buildSandboxDocument(code, vars)}
      className={className ?? "w-full border-0"}
    />
  );
}
