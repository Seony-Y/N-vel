import { z } from "zod";
import { publicState } from "@/lib/game/public";
import { addMessages, addProgress, openSession } from "@/lib/game/session";

const Body = z.object({ clueId: z.uuid(), code: z.string().trim().min(1).max(30) });

/**
 * POST /api/play/:id/unlock  잠금 장치에 비밀번호 입력.
 * 틀리면 행동 1회로 센다 (마구 눌러 맞히면 효율 보너스를 잃도록). 맞으면 단서를 얻는다.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/play/[id]/unlock">) {
  const { id } = await ctx.params;
  const opened = await openSession(id, { requirePlaying: true });
  if (opened instanceof Response) return opened;
  const { full } = opened;
  let { session } = opened;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "비밀번호를 입력하세요" }, { status: 400 });
  const clue = full.clues.find((c) => c.id === parsed.data.clueId && c.passcode);
  if (!clue) return Response.json({ error: "없는 잠금 장치입니다" }, { status: 400 });
  if (clue.locationId !== session.currentLocationId) return Response.json({ error: "그 장소에 가야 열 수 있습니다" }, { status: 400 });
  if (session.foundClueIds.includes(clue.id)) return Response.json({ ok: true, state: publicState(full, session) });

  const label = clue.lockLabel ?? "잠금 장치";
  if (parsed.data.code !== clue.passcode) {
    session = await addProgress(id, { actions: 1 });
    await addMessages(id, "narrator", [{ role: "event", content: `🔒 ${label}: 비밀번호가 틀렸습니다` }]);
    return Response.json({ ok: false, state: publicState(full, session) });
  }

  session = await addProgress(id, { clueIds: [clue.id] });
  await addMessages(id, "narrator", [
    { role: "event", content: `🔓 ${label}이(가) 열렸습니다` },
    { role: "event", content: `🔍 단서 발견: ${clue.name}` },
  ]);
  return Response.json({ ok: true, state: publicState(full, session) });
}
