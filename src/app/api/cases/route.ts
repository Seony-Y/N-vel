import { getUserId } from "@/lib/auth";
import { parseSave } from "@/lib/cases/api";
import { writeCase } from "@/lib/cases/import";

/** POST /api/cases  { file, isPublic } → 새 사건 { id } */
export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const parsed = parseSave(await request.json().catch(() => null));
  if ("errors" in parsed) return Response.json({ error: parsed.errors[0], errors: parsed.errors }, { status: 400 });

  const id = await writeCase(parsed.file, { ownerId: userId, isPublic: parsed.isPublic });
  return Response.json({ id }, { status: 201 });
}
