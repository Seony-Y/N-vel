import { ImageResponse } from "next/og";
import { publicCaseSummary } from "@/lib/game/catalog";

export const alt = "N-vel 사건";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** 링크 미리보기 그림: 제목·한 줄 소개·난이도. 비공개 사건은 사이트 이름만 */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const c = await publicCaseSummary((await params).id);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, color: "white", background: "linear-gradient(135deg, #27272a 0%, #18181b 55%, #450a0a 100%)" }}>
        <div style={{ display: "flex", fontSize: 36, color: "#f87171" }}>N-vel · AI 추리 게임</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 700, lineHeight: 1.2 }}>{c?.title ?? "진실은 단서 속에 있다"}</div>
          <div style={{ display: "flex", marginTop: 24, fontSize: 34, color: "#d4d4d8", lineHeight: 1.4 }}>{c?.tagline ?? "현장을 조사하고, 용의자를 심문하고, 범인을 지목하세요."}</div>
        </div>
        <div style={{ display: "flex", fontSize: 32, color: "#fbbf24" }}>{c ? `난이도 ${c.difficulty}/5 · 약 ${c.estimatedMinutes}분` : " "}</div>
      </div>
    ),
    size,
  );
}
