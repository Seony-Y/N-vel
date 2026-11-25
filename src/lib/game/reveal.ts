import type { Reveal } from "@/types/db";
import { DEFAULT_GIVE_UP_ENDING, type EndingKey } from "./endings";
import type { FullCase } from "./load";

/** 결과 화면에 공개할 진상 */
export function buildReveal(full: FullCase, ending: EndingKey): Reveal {
  const c = full.case;
  const endings = { correct: c.endingCorrect, partial: c.endingPartial, wrong: c.endingWrong, gaveup: c.endingGiveUp || DEFAULT_GIVE_UP_ENDING };
  return {
    culprit: full.suspects.find((s) => s.id === c.culpritId)?.name ?? "-",
    truth: c.truth,
    endingText: endings[ending],
    keyClues: full.clues.filter((x) => x.isKey).map(({ id, name, description }) => ({ id, name, description })),
    clueTotal: full.clues.length,
  };
}
