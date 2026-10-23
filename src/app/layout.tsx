import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import "./globals.css";

export const metadata: Metadata = {
  title: "N-vel",
  description: "AI 용의자를 심문하고 단서를 모아 범인을 지목하는 추리 게임",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
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
