/** 사이트 운영 정보 (푸터·이용약관·개인정보처리방침이 함께 쓴다). 바꾸면 여기만 고친다 */
export const SITE = {
  name: "N-vel",
  version: "1.0.0", // package.json 의 version 과 맞춘다
  operator: "Sihyeon Yoon",
  contact: "seony1107@gmail.com",
  /** 이용약관·개인정보처리방침 시행일. 내용을 바꾸면 날짜도 바꾸고, 바뀐 점을 사이트에 알린다 */
  policyDate: "2026-10-23",
  /** 저작권 표시 연도 (화면을 그릴 때 현재 시각을 읽으면 사전 렌더링이 막힌다) */
  copyrightYear: "2026",
} as const;
