import { z } from "zod";
import { getUserId } from "@/lib/auth";
import { createReport } from "@/lib/feedback";
import { REPORT_REASONS, type ReportReason } from "@/lib/feedback-config";
import { canPlay, loadCase } from "@/lib/game/load";
import { MAX_REPORTS_PER_DAY, takeQuota } from "@/lib/quota";

const Body = z.object({ reason: z.enum(Object.keys(REPORT_REASONS) as [ReportReason, ...ReportReason[]]), message: z.string().trim().max(500).default("") });

/** POST /api/cases/:id/report  { reason, message }  사건 신고 (처리 안 된 신고는 사건마다 하나) */
export async function POST(request: Request, ctx: RouteContext<"/api/cases/[id]/report">) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "로그인이 필요합니다" }, { status: 401 });
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "이유를 고르고, 내용은 500자까지 써 주세요" }, { status: 400 });
  const full = await loadCase(id).catch(() => null);
  if (!full || !canPlay(full.case, userId) || full.case.ownerId === userId) return Response.json({ error: "신고할 수 없는 사건입니다" }, { status: 404 });

  const quota = await takeQuota(userId, "report", MAX_REPORTS_PER_DAY);
  if (!quota) return Response.json({ error: `신고는 하루에 ${MAX_REPORTS_PER_DAY}번까지 할 수 있어요` }, { status: 429 });
  if (!(await createReport({ caseId: id, userId, ...parsed.data }))) return Response.json({ error: "이미 신고한 사건이에요. 관리자가 확인하고 있어요" }, { status: 409 });
  return new Response(null, { status: 201 });
}
