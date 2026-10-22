import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "N-vel",
  description: "AI 용의자를 심문하고 단서를 모아 범인을 지목하는 추리 게임",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
