import { CHAT_MODELS, DEFAULT_CHAT_MODEL } from "@/lib/ai/models";

/** GET /api/models  모델 선택 UI 용 목록 */
export function GET() {
  return Response.json({
    default: DEFAULT_CHAT_MODEL,
    models: CHAT_MODELS.map(({ id, label, description, credits }) => ({ id, label, description, credits })),
  });
}
