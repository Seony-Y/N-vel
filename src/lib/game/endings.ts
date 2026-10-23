/** 결과 종류별 이름 (화면 공통). 상태는 색만으로 구분하지 않고 아이콘 + 글자를 함께 쓴다 */
export const ENDINGS = {
  correct: { icon: "✅", label: "해결", title: "사건 해결" },
  partial: { icon: "🟡", label: "부분 해결", title: "부분 해결" },
  wrong: { icon: "❌", label: "미제", title: "미제 사건" },
  gaveup: { icon: "🏳️", label: "포기", title: "미제 사건 (수사 포기)" },
} as const;

export type EndingKey = keyof typeof ENDINGS;

export const endingText = (e: EndingKey | null | undefined) => (e ? `${ENDINGS[e].icon} ${ENDINGS[e].label}` : "-");

/** 포기 엔딩 문구를 비워 둔 사건에 쓰는 기본 문구 */
export const DEFAULT_GIVE_UP_ENDING = "당신은 수첩을 덮었다. 더는 실마리를 따라갈 수 없었다.\n\n범인은 끝내 잡히지 않았고, 사건은 미제로 남았다. 진실은 그렇게 묻혔다.";
