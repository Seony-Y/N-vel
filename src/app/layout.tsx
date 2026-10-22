import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "N-vel",
  description: "캐릭터와 함께 만드는 이야기",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
