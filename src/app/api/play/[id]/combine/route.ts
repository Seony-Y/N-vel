import { z } from "zod";
import { publicState } from "@/lib/game/public";
import { combination } from "@/lib/game/rules";
import { addMessages, addProgress, openSession } from "@/lib/game/session";

const Body = z.object({ clueIds: z.array(z.uuid()).min(2).max(3) });

/**
 * POST /api/play/:id/combine  { clueIds }  수첩의 단서 2~3개를 잇는다.
 * 맞으면 연결 단서를 얻고, 틀리면 행동 1회로 센다 (마구 이어 맞히면 효율 보너스를 잃도록. 쉬움에서는 세지 않는다). AI 를 쓰지 않아 크레딧은 들지 않는다
 */
export async function POST(request: Request, ctx: RouteContext<"/api/play/[id]/combine">) {
  const { id } = await ctx.params;
  const opened = await openSession(id, { requirePlaying: true });
  if (opened instanceof Response) return opened;
  const { full } = opened;
  let { session } = opened;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "이을 단서를 2~3개 고르세요" }, { status: 400 });
  const clueIds = [...new Set(parsed.data.clueIds)];
  if (clueIds.length < 2) return Response.json({ error: "이을 단서를 2~3개 고르세요" }, { status: 400 });
  if (clueIds.some((c) => !session.foundClueIds.includes(c))) return Response.json({ error: "아직 찾지 않은 단서입니다" }, { status: 400 });

  const names = clueIds.map((c) => full.clues.find((x) => x.id === c)?.name ?? "-").join(" + ");
  const clue = combination(full, clueIds);
  if (!clue) {
    const event = `🧩 ${names}: 아직 맞물리지 않습니다`;
    session = await addProgress(id, { actions: session.mode === "hard" ? 1 : 0 });
    await addMessages(id, "narrator", [{ role: "event", content: event }]);
    return Response.json({ ok: false, events: [event], state: publicState(full, session) });
  }
  if (session.foundClueIds.includes(clue.id)) return Response.json({ ok: true, clueId: clue.id, events: [], state: publicState(full, session) });

  const events = [`🧩 ${names}: 하나로 이어졌습니다`, `🔍 단서 발견: ${clue.name}`];
  session = await addProgress(id, { clueIds: [clue.id] });
  await addMessages(id, "narrator", events.map((content) => ({ role: "event" as const, content })));
  return Response.json({ ok: true, clueId: clue.id, events, state: publicState(full, session) });
}
