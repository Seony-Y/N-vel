import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { playSessions } from "@/db/schema";
import { publicState } from "@/lib/game/public";
import { addMessages, openSession } from "@/lib/game/session";

const Body = z.object({ locationId: z.uuid() });

/** POST /api/play/:id/move  장소 이동 (행동 횟수를 쓰지 않음) */
export async function POST(request: Request, ctx: RouteContext<"/api/play/[id]/move">) {
  const { id } = await ctx.params;
  const opened = await openSession(id, { requirePlaying: true });
  if (opened instanceof Response) return opened;
  const { full } = opened;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  const loc = parsed.success ? full.locations.find((l) => l.id === parsed.data.locationId) : null;
  if (!loc) return Response.json({ error: "없는 장소입니다" }, { status: 400 });

  const [session] = await db
    .update(playSessions)
    .set({ currentLocationId: loc.id, updatedAt: new Date() })
    .where(eq(playSessions.id, id))
    .returning();
  const event = `📍 ${loc.name}\n${loc.description}`;
  await addMessages(id, "narrator", [{ role: "event", content: event }]);

  return Response.json({ state: publicState(full, session), event });
}
