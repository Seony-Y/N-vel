import type { Metadata } from "next";
import { Noto_Sans_KR, Noto_Serif_KR } from "next/font/google";
import { Suspense } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import "./globals.css";

// 한글 글꼴은 글자 묶음별로 나뉘어 있어 쓰인 것만 내려받는다. 첫 화면을 늦추지 않게 미리 받지 않는다
const sans = Noto_Sans_KR({ variable: "--font-noto-sans", display: "swap", preload: false, adjustFontFallback: false });
const serif = Noto_Serif_KR({ variable: "--font-noto-serif", display: "swap", preload: false, adjustFontFallback: false });

const description = "AI 용의자를 심문하고 단서를 모아 범인을 지목하는 추리 게임";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.BETTER_AUTH_URL || "http://localhost:3001"),
  title: "N-vel",
  description,
  openGraph: { title: "N-vel", description, type: "website", siteName: "N-vel", locale: "ko_KR" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`h-full antialiased ${sans.variable} ${serif.variable}`}>
      <body className="flex min-h-full flex-col">
        {children}
        {/* 푸터는 지금 주소를 읽으므로(수사 화면에서 숨기기) 사전 렌더링을 막지 않게 따로 그린다 */}
        <Suspense>
          <SiteFooter />
        </Suspense>
      </body>
    </html>
  );
}
