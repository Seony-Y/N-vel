/** AI 응답을 말과 행동 묘사(*별표*)로 나눈다. 받는 중이라 아직 닫히지 않은 별표도 묘사로 본다 */
export function splitProse(text: string): { text: string; action: boolean }[] {
  const parts: { text: string; action: boolean }[] = [];
  let at = 0;
  for (const m of text.matchAll(/(\*{1,2})([^*\n]+)(?:\1|$)/g)) {
    if (m.index > at) parts.push({ text: text.slice(at, m.index), action: false });
    parts.push({ text: m[2], action: true });
    at = m.index + m[0].length;
  }
  if (at < text.length) parts.push({ text: text.slice(at), action: false });
  return parts;
}
