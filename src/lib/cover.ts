/** 표지 그림이 없는 사건의 배경. 사건마다 색과 등불 자리가 다르다 [위, 아래, 등불] */
const TONES = [
  ["#2f3b46", "#1b2229", "#c9a86a"], // 청회색
  ["#3a2c33", "#1f1a20", "#c98783"], // 와인
  ["#2b3a35", "#19211f", "#b9b27f"], // 이끼
  ["#34324a", "#1c1c28", "#a0b5ca"], // 남보라
  ["#3b342a", "#211d18", "#d2a866"], // 갈색
  ["#263c42", "#172326", "#8fbcb5"], // 청록
  ["#40302a", "#231b18", "#d09a78"], // 벽돌
];

export function coverBackground(id: string): string {
  let n = 2166136261; // FNV-1a
  for (const ch of id) n = Math.imul(n ^ ch.charCodeAt(0), 16777619) >>> 0;
  const [from, to, light] = TONES[(n >>> 12) % TONES.length];
  const x = 62 + ((n >>> 4) % 30);
  return `radial-gradient(circle at ${x}% 8%, ${light}40, transparent 55%), linear-gradient(150deg, ${from}, ${to})`;
}
