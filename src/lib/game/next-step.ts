import type { PlaySession } from "@/types/db";
import type { FullCase } from "./load";
import { breakpointFor, discoverable, linksReady, openableLocks, tellableBy } from "./rules";

/**
 * 쉬움 모드의 무료 안내: 지금 진행을 앞으로 옮길 수 있는 일 하나. AI 를 쓰지 않는다.
 * 어디(장소)·누구(용의자)·무엇(이미 찾은 단서)까지만 알려 주고, 아직 못 찾은 단서의 이름이나 내용은 말하지 않는다
 */
export function nextStep(full: FullCase, s: PlaySession): string {
  if (linksReady(full, s).length) return "수첩에 이을 수 있는 단서가 있어요. '단서 잇기'에서 서로 관련 있어 보이는 단서를 골라 보세요.";

  for (const id of s.foundClueIds) {
    for (const sus of full.suspects) {
      const bp = breakpointFor(full, s, sus.id, id);
      if (bp?.revealsClueId && !s.foundClueIds.includes(bp.revealsClueId)) {
        return `「${full.clues.find((c) => c.id === id)!.name}」을(를) ${sus.name}에게 증거로 보여 주세요.`;
      }
    }
  }

  // 지금 있는 장소 → 다른 장소 순서로
  const left = discoverable(full, s);
  const here = left.some((c) => c.locationId === s.currentLocationId) ? s.currentLocationId : left[0]?.locationId;
  const loc = full.locations.find((l) => l.id === here);
  if (loc) return `'${loc.name}'에 아직 살펴보지 않은 것이 있어요. 눈에 띄는 물건을 하나씩 조사해 보세요.`;

  const talker = full.suspects.find((x) => tellableBy(full, s, x.id).length);
  if (talker) return `${talker.name}에게 아직 듣지 못한 이야기가 있어요. 사건 무렵의 일과 다른 사람들에 대해 물어보세요.`;

  const lock = openableLocks(full, s)[0];
  if (lock) return `'${lock.lockLabel ?? "잠긴 물건"}'을(를) 열어 보세요. 비밀번호는 이미 찾은 단서와 증언 속에 있어요.`;

  return "모을 수 있는 단서는 다 모았어요. 진술과 어긋나는 증거를 떠올리며 추리를 제출해 보세요.";
}
