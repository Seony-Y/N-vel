import { z } from "zod";
import { anthropic, CHAT_MAX_TOKENS } from "@/lib/ai/config";
import { MOCK_AI, mockGameReply, streamText } from "@/lib/ai/mock";
import { getChatModel } from "@/lib/ai/models";
import { logEvent, logUsage } from "@/lib/ai/usage";
import { changeCredits, getBalance } from "@/lib/credits";
import { loadThread } from "@/lib/game/load";
import { extractClueCodes, extractMoves, extractSuggestions, narratorPrompt, suspectPrompt, visibleText } from "@/lib/game/prompts";
import { publicState } from "@/lib/game/public";
import { actionsLeft, breakpointFor, discoverable, tellableBy, validateRequested } from "@/lib/game/rules";
import { addMessages, addProgress, openSession } from "@/lib/game/session";
import type { FullCase } from "@/lib/game/load";
import type { Clue, PlaySession } from "@/types/db";

const Body = z.object({
  target: z.string().min(1), // "narrator" 또는 용의자 id
  message: z.string().trim().max(1000).default(""),
  presentClueId: z.uuid().optional(), // 용의자에게 증거 제시
});

/** 호스팅의 함수 최대 실행 시간 (초). 응답이 길어져도 끊기지 않도록 */
export const maxDuration = 60;

/** 스트림 끝에 붙는 구분자. 그 뒤에 JSON { state, events, talkTo, suggestions, credits } 가 온다 */
const TRAILER = "\u001e";

/**
 * POST /api/play/:id/act
 * 조사(나레이터) 또는 심문(용의자). 응답을 텍스트 스트림으로 보내고, 끝에 갱신된 게임 상태를 붙인다.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/play/[id]/act">) {
  const { id } = await ctx.params;
  const opened = await openSession(id, { requirePlaying: true });
  if (opened instanceof Response) return opened;
  let { session } = opened;
  const { userId, full } = opened;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "잘못된 요청" }, { status: 400 });
  const { target, message, presentClueId } = parsed.data;
  if (!message && !presentClueId) return Response.json({ error: "행동이나 질문을 입력하세요" }, { status: 400 });
  if (actionsLeft(full, session) === 0) return Response.json({ error: "행동 횟수를 모두 썼습니다. 추리를 제출하세요" }, { status: 403 });

  const model = getChatModel(session.model);
  const isNarrator = target === "narrator";
  const suspect = isNarrator ? null : full.suspects.find((s) => s.id === target);
  if (!isNarrator && !suspect) return Response.json({ error: "없는 용의자입니다" }, { status: 400 });
  if (presentClueId && isNarrator) return Response.json({ error: "증거는 용의자에게만 제시할 수 있습니다" }, { status: 400 });
  if (presentClueId && !session.foundClueIds.includes(presentClueId)) return Response.json({ error: "아직 찾지 않은 단서입니다" }, { status: 400 });

  const thread = isNarrator ? "narrator" : suspect!.id;

  // 대본 사건 (프롤로그): AI 를 부르지 않고 정해진 반응을 돌려준다. 크레딧을 쓰지 않는다
  if (full.case.isOfficial && full.case.script.length) return scriptedAct({ id, userId, full, session, thread, message, presentClueId });

  // ── 크레딧 차감 (AI 를 부르기 전에). 모자라면 행동하지 않는다. 오류가 나면 아래에서 돌려준다 ──
  // 대화 기록은 차감과 상관없으니 같이 읽어 둔다 (DB 왕복을 줄여 첫 글자가 빨리 나오도록)
  const [balance, history] = await Promise.all([
    changeCredits({ userId, amount: -model.credits, reason: "action", sessionId: id, note: `${model.label} · ${isNarrator ? "조사" : `${suspect!.name} 심문`}` }),
    loadThread(id, thread),
  ]);
  if (balance === null) {
    return Response.json({ error: `크레딧이 부족해요. 이 모델은 행동 1회에 ${model.credits}크레딧이 필요해요`, code: "NO_CREDITS", credits: await getBalance(userId) }, { status: 402 });
  }

  // ── 증거 제시: 무너지는 지점은 AI 가 아니라 서버가 정한다 ──
  let userText = message;
  let newlyBroken: string | null = null;
  const revealed: Clue[] = [];
  if (presentClueId) {
    const clue = full.clues.find((c) => c.id === presentClueId)!;
    userText = `[증거 제시: ${clue.name}] ${clue.description}${message ? `\n${message}` : ""}`;

    const bp = breakpointFor(full, session, suspect!.id, presentClueId);
    if (bp) {
      newlyBroken = bp.admission;
      const reveal = bp.revealsClueId ? full.clues.find((c) => c.id === bp.revealsClueId) : null;
      if (reveal && !session.foundClueIds.includes(reveal.id)) revealed.push(reveal);
      session = await addProgress(id, { brokenIds: [bp.id], clueIds: revealed.map((c) => c.id) });
    }
  }

  const candidates = isNarrator ? discoverable(full, session) : tellableBy(full, session, suspect!.id);

  const { system, messages } = isNarrator
    ? narratorPrompt(full, session, history, userText, candidates)
    : suspectPrompt(full, suspect!, session, history, userText, { tellable: candidates, newlyBroken });

  // 행동 횟수·내 메시지 저장은 AI 응답을 기다리지 않고 함께 진행한다
  const saving = Promise.all([addProgress(id, { actions: 1, credits: model.credits }), addMessages(id, thread, [{ role: "user", content: userText }])]);

  const source: AsyncIterable<string> & { final?: () => Promise<{ refused: boolean; stopReason: string | null; model: string; usage: Parameters<typeof logUsage>[0]["usage"] }> } =
    MOCK_AI
      ? streamText(mockGameReply({ userText, modelLabel: model.label, who: suspect?.name ?? "나레이터", candidates, admission: newlyBroken, full: isNarrator ? full : null }))
      : anthropicSource({ model: model.id, supportsFallback: model.supportsFallback, system, messages });

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let raw = "";
      let sent = 0;
      try {
        for await (const chunk of source) {
          raw += chunk;
          const visible = visibleText(raw);
          if (visible.length > sent) {
            controller.enqueue(encoder.encode(visible.slice(sent)));
            sent = visible.length;
          }
        }

        const result = source.final ? await source.final() : null;
        let finalText = visibleText(raw, true);
        let found: Clue[] = [...revealed];
        const where = "play/act";
        const ctxLog = { userId, sessionId: id, caseId: full.case.id };
        if (result?.refused) {
          finalText = "(이 내용에는 응답할 수 없습니다. 다른 방식으로 행동해 보세요)";
          controller.enqueue(encoder.encode(finalText.slice(sent)));
          await logEvent({ type: "refusal", where, message: "AI 가 응답을 거절했습니다", ...ctxLog, detail: { thread, userText } });
        } else {
          if (finalText.length > sent) controller.enqueue(encoder.encode(finalText.slice(sent)));
          // AI 가 요청한 단서 중 규칙상 허용되는 것만 인정
          const requested = extractClueCodes(raw);
          const accepted = validateRequested(requested, candidates);
          found = [...found, ...accepted];
          const rejected = requested.filter((code) => !accepted.some((c) => c.code === code));
          if (rejected.length) {
            await logEvent({ type: "rejected_clue", where, message: `허용되지 않은 단서 요청: ${rejected.join(", ")}`, ...ctxLog, detail: { thread, rejected, allowed: candidates.map((c) => c.code) } });
          }
          if (result?.stopReason === "max_tokens") await logEvent({ type: "truncated", where, message: "응답이 길이 제한에 걸려 잘렸습니다", ...ctxLog, detail: { thread } });
        }

        // 나레이터의 장소 이동·심문 전환 요청. 없는 코드는 무시한다
        // 태그가 없어도 다른 장소의 단서를 찾았으면 그 장소로 옮긴다
        let movedTo: (typeof full.locations)[number] | null = null;
        let talkTo: string | null = null;
        if (isNarrator && !result?.refused) {
          const { go, talk } = extractMoves(raw);
          const foundAt = found.at(-1)?.locationId;
          movedTo = full.locations.find((l) => (go ? l.code === go : l.id === foundAt)) ?? null;
          if (movedTo?.id === session.currentLocationId) movedTo = null;
          talkTo = full.suspects.find((s) => s.code === talk)?.id ?? null;
        }

        [session] = await saving;
        const newIds = found.filter((c) => !revealed.includes(c)).map((c) => c.id);
        const events = [
          ...(movedTo ? [`📍 ${movedTo.name}(으)로 이동했습니다`] : []),
          ...found.map((c) => `🔍 단서 발견: ${c.name}`),
        ];
        const [updated] = await Promise.all([
          newIds.length || movedTo ? addProgress(id, { clueIds: newIds, locationId: movedTo?.id }) : session,
          addMessages(id, thread, [{ role: "assistant", content: finalText }, ...events.map((content) => ({ role: "event" as const, content }))]),
          result && logUsage({ userId, sessionId: id, kind: isNarrator ? "narrator" : "suspect", model: result.model, usage: result.usage }),
        ]);
        session = updated;

        controller.enqueue(encoder.encode(TRAILER + JSON.stringify({ state: publicState(full, session), events, talkTo, suggestions: result?.refused ? [] : extractSuggestions(raw), credits: balance })));
      } catch (err) {
        console.error("[play/act] 응답 실패", err);
        await logEvent({ type: "error", where: "play/act", message: err instanceof Error ? err.message : String(err), userId, sessionId: id, caseId: full.case.id, detail: { thread } });
        // 응답을 못 받았으니 크레딧을 돌려준다
        await saving.catch(() => null);
        const refunded = await changeCredits({ userId, amount: model.credits, reason: "refund", sessionId: id, note: "응답 오류" }).catch(() => null);
        session = (await addProgress(id, { credits: -model.credits }).catch(() => null)) ?? session;
        controller.enqueue(
          encoder.encode("\n\n(응답 중 오류가 발생했습니다. 크레딧은 돌려드렸어요)" + TRAILER + JSON.stringify({ state: publicState(full, session), events: [], talkTo: null, suggestions: [], credits: refunded ?? balance })),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

/**
 * 대본대로 응답한다. 선택지는 지금 장소(조사) 또는 그 용의자(심문)의 것이어야 하고, 필요한 단서를 찾았어야 한다.
 * 증거 제시는 무너지는 지점도 평소처럼 서버가 처리하고, 대본에 반응이 없으면 기본 문구를 보여 준다
 */
async function scriptedAct(p: { id: string; userId: string; full: FullCase; session: PlaySession; thread: string; message: string; presentClueId?: string }) {
  const { id, full, thread, message, presentClueId } = p;
  const found = new Set(p.session.foundClueIds);
  const where = thread === "narrator" ? p.session.currentLocationId : thread;
  const clue = presentClueId ? full.clues.find((c) => c.id === presentClueId)! : null;
  const line = full.case.script.find((s) => s.where === where && (clue ? s.present === clue.id : !s.present && s.say === message) && s.requires.every((r) => found.has(r)));
  if (!clue && !line) return Response.json({ error: "프롤로그에서는 화면의 선택지로만 행동할 수 있어요" }, { status: 400 });

  const bp = clue ? breakpointFor(full, p.session, thread, clue.id) : null;
  const revealIds = [...(line?.reveals ?? []), ...(bp?.revealsClueId ? [bp.revealsClueId] : [])];
  const revealed = full.clues.filter((c) => revealIds.includes(c.id) && !found.has(c.id));
  const reply = line?.reply ?? "(그 증거에는 별다른 반응이 없다. 다른 증거를 보여 주거나 다른 사람에게 가져가 보자.)";
  const events = revealed.map((c) => `🔍 단서 발견: ${c.name}`);

  const userText = clue ? `[증거 제시: ${clue.name}] ${clue.description}${message ? `\n${message}` : ""}` : message;
  const [session, , credits] = await Promise.all([
    addProgress(id, { actions: 1, clueIds: revealed.map((c) => c.id), brokenIds: bp ? [bp.id] : [] }),
    addMessages(id, thread, [{ role: "user", content: userText }, { role: "assistant", content: reply }, ...events.map((content) => ({ role: "event" as const, content }))]),
    getBalance(p.userId),
  ]);
  return new Response(reply + TRAILER + JSON.stringify({ state: publicState(full, session), events, talkTo: null, suggestions: [], credits }), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

/** Claude 스트림을 텍스트 조각으로. 끝나면 final() 로 거절 여부와 사용량을 얻는다 */
function anthropicSource(params: {
  model: string;
  supportsFallback: boolean;
  system: ReturnType<typeof narratorPrompt>["system"];
  messages: ReturnType<typeof narratorPrompt>["messages"];
}) {
  const stream = anthropic.beta.messages.stream({
    model: params.model,
    max_tokens: CHAT_MAX_TOKENS,
    output_config: { effort: "low" },
    ...(params.supportsFallback && { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }),
    system: params.system,
    messages: params.messages,
  });

  async function* text() {
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield event.delta.text;
    }
  }
  return Object.assign(text(), {
    final: async () => {
      const msg = await stream.finalMessage();
      return { refused: msg.stop_reason === "refusal", stopReason: msg.stop_reason, model: msg.model, usage: msg.usage };
    },
  });
}
