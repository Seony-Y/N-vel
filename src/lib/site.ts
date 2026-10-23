/** 사이트 운영 정보 (푸터·이용약관·개인정보처리방침이 함께 쓴다). 바꾸면 여기만 고친다 */
export const SITE = {
  name: "N-vel",
  version: "1.0.0", // package.json 의 version 과 맞춘다
  operator: "Sihyeon Yoon",
  contact: "seony1107@gmail.com",
  /** 이용약관·개인정보처리방침 시행일. 내용을 바꾸면 날짜도 바꾸고, 바뀐 점을 사이트에 알린다 */
  policyDate: "2026-10-23",
} as const;
