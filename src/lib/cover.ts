/** 표지 그림이 없는 사건의 배경. 사건마다 색이 조금씩 다르고, 한쪽에서 등불이 비치는 느낌 */
const TONES = [
  ["#2f3b46", "#1b2229", "#c9a86a"],
  ["#3a2c33", "#1f1a20", "#c98783"],
  ["#2b3a35", "#19211f", "#b9b27f"],
  ["#34324a", "#1c1c28", "#a0b5ca"],
];

export function coverBackground(id: string): string {
  let n = 0;
  for (const ch of id) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  const [from, to, light] = TONES[n % TONES.length];
  return `radial-gradient(circle at 82% 8%, ${light}40, transparent 55%), linear-gradient(150deg, ${from}, ${to})`;
}
