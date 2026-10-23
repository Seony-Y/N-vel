import { NextResponse, type NextRequest } from "next/server";

/*
 * 운영 배포는 대표 주소(BETTER_AUTH_URL) 하나로만 쓴다.
 * Vercel 은 같은 배포를 여러 주소(n-vel-xxx.vercel.app 등)로도 열어 주는데, 그 주소에서는
 * 로그인 쿠키·구글 콜백이 대표 주소 기준이라 로그인이 실패한다. 그래서 대표 주소로 옮겨 보낸다.
 */
const canonical = process.env.VERCEL_ENV === "production" && process.env.BETTER_AUTH_URL ? new URL(process.env.BETTER_AUTH_URL) : null;

export function proxy(request: NextRequest) {
  if (!canonical || request.nextUrl.host === canonical.host) return NextResponse.next();
  const url = new URL(request.nextUrl.pathname + request.nextUrl.search, canonical);
  return NextResponse.redirect(url, 308);
}

export const config = {
  // 정적 파일은 건너뛴다
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
