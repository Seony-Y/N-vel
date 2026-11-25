import { after } from "next/server";
import { z } from "zod";
import { bump } from "@/lib/funnel";
import { accusationProblem, GuestAccusation, GuestSave, guestSession, loadGuestCase } from "@/lib/game/guest";
import { publicState } from "@/lib/game/public";
import { buildReveal } from "@/lib/game/reveal";
import { grade, MAX_HINTS, openableLocks } from "@/lib/game/rules";
import { scriptTurn } from "@/lib/game/script";
import type { FullCase } from "@/lib/game/load";
import type { Clue } from "@/types/db";

const Body = z.object({ save: GuestSave });
const Act = z.object({ target: z.string().min(1).max(60), message: z.string().trim().max(1000).default(""), presentClueId: z.string().max(60).optional() });
const Move = z.object({ locationId: z.string().max(60) });
const Unlock = z.object({ clueId: z.string().max(60), code: z.string().trim().min(1).max(30) });

const TRAILER = "\u001e";
const bad = (error: string, status = 400) => Response.json({ error }, { status });

/** 가이드 목표인 단서를 찾으면 이탈 지점 집계에 남긴다 */
function count(full: FullCase, revealed: Clue[]) {
  const goals = new Set(full.case.guide.map((g) => (g.goal?.type === "find" ? g.goal.target : g.goal?.clue)));
  for (const c of revealed) if (goals.has(c.id)) after(() => bump(`find:${c.code}`));
}

/**
 * POST /api/guest/:action  { save, ... }  비회원 프롤로그. 진행 상황(save)은 브라우저가 보내고, 서버는 저장하지 않는다.
 * action: start, state, act, move, unlock, hint, accuse, giveup (회원용 /api/play/:id/* 와 같은 모양으로 답한다)
 */
export async function POST(request: Request, ctx: RouteContext<"/api/guest/[action]">) {
  const { action } = await ctx.params;
  const json = await request.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return bad("잘못된 요청");
  const full = await loadGuestCase();
  if (!full) return bad("지금은 프롤로그를 할 수 없어요", 404);
  const s = guestSession(full, parsed.data.save);
  const state = () => publicState(full, s);

  switch (action) {
    case "start":
      after(() => bump("start"));
      return Response.json({ state: state() });
    case "state":
      return Response.json({ state: state() });
    case "act": {
      const p = Act.safeParse(json);
      if (!p.success) return bad("잘못된 요청");
      const { target, message, presentClueId } = p.data;
      if (target !== "narrator" && !full.suspects.some((x) => x.id === target)) return bad("없는 용의자입니다");
      if (presentClueId && (target === "narrator" || !s.foundClueIds.includes(presentClueId))) return bad("아직 찾지 않은 단서입니다");
      const turn = scriptTurn(full, s, { thread: target, message, presentClueId });
      if (!turn) return bad("프롤로그에서는 화면의 선택지로만 행동할 수 있어요");
      s.actionsUsed++;
      s.foundClueIds = [...s.foundClueIds, ...turn.revealed.map((c) => c.id)];
      count(full, turn.revealed);
      return new Response(turn.reply + TRAILER + JSON.stringify({ state: state(), events: turn.events, talkTo: null, suggestions: [], credits: 0 }), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
    case "move": {
      const p = Move.safeParse(json);
      const loc = p.success ? full.locations.find((l) => l.id === p.data.locationId) : null;
      if (!loc) return bad("없는 장소입니다");
      s.currentLocationId = loc.id;
      return Response.json({ state: state() });
    }
    case "unlock": {
      const p = Unlock.safeParse(json);
      const clue = p.success ? openableLocks(full, s).find((c) => c.id === p.data.clueId) : null;
      if (!p.success || !clue || clue.locationId !== s.currentLocationId) return bad("없는 잠금 장치입니다");
      const ok = p.data.code === clue.passcode;
      if (ok) {
        s.foundClueIds = [...s.foundClueIds, clue.id];
        count(full, [clue]);
      } else s.actionsUsed++;
      return Response.json({ ok, state: state() });
    }
    case "hint":
      s.hintsUsed = Math.min(s.hintsUsed + 1, full.case.hints.length, MAX_HINTS);
      return Response.json({ state: state() });
    case "accuse": {
      const p = GuestAccusation.safeParse(json);
      if (!p.success) return bad("범인을 고르고, 증거는 3개까지 골라 주세요");
      const problem = accusationProblem(full, s, p.data);
      if (problem) return bad(problem);
      const g = grade(full, s, { ...p.data, narrative: "" });
      after(async () => {
        await bump("submit");
        if (g.ending === "correct") await bump("solved");
      });
      return Response.json({ result: { ending: g.ending, score: g.score, items: g.items.map(({ label, ok, mine, answer, kind }) => ({ label, ok, mine, answer: kind === "evidence" ? "" : answer })), reveal: buildReveal(full, g.ending) } });
    }
    case "giveup":
      after(() => bump("giveup"));
      return Response.json({ result: { ending: "gaveup", score: 0, items: [], reveal: buildReveal(full, "gaveup") } });
    default:
      return bad("없는 요청입니다", 404);
  }
}
