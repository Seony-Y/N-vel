import { finishSession } from "@/lib/game/finish";
import { openSession } from "@/lib/game/session";

/** POST /api/play/:id/giveup  수사 포기 → 미제로 끝내고 진상을 공개한다 */
export async function POST(_request: Request, ctx: RouteContext<"/api/play/[id]/giveup">) {
  const { id } = await ctx.params;
  const opened = await openSession(id, { requirePlaying: true });
  if (opened instanceof Response) return opened;

  const done = await finishSession(opened.full, opened.session, { ending: "gaveup", score: 0 });
  if (!done) return Response.json({ error: "이미 끝난 사건입니다" }, { status: 409 });
  return Response.json({ sessionId: id });
}
