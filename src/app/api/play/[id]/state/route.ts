import { getBalance } from "@/lib/credits";
import { loadAllMessages } from "@/lib/game/load";
import { publicMessages, publicState } from "@/lib/game/public";
import { openSession } from "@/lib/game/session";

/** GET /api/play/:id/state  저장된 진행 상황과 대화. 답이 도중에 끊겼을 때 화면을 다시 맞춘다 */
export async function GET(_request: Request, ctx: RouteContext<"/api/play/[id]/state">) {
  const { id } = await ctx.params;
  const opened = await openSession(id);
  if (opened instanceof Response) return opened;
  const [messages, credits] = await Promise.all([loadAllMessages(id), getBalance(opened.userId)]);
  return Response.json({ state: publicState(opened.full, opened.session), messages: publicMessages(messages), credits });
}
