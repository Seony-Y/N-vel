import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { cases } from "@/db/schema";
import { CaseFile } from "./format";

/** 사건 저장 요청: 사건 파일 + 공개 여부 */
export const SaveBody = z.object({ file: z.unknown(), isPublic: z.boolean() });

/** 요청 본문을 검사해 사건 파일로. 실패하면 화면에 보여줄 오류 목록을 돌려준다 */
export function parseSave(body: unknown): { file: CaseFile; isPublic: boolean } | { errors: string[] } {
  const outer = SaveBody.safeParse(body);
  if (!outer.success) return { errors: ["잘못된 요청입니다"] };
  const parsed = CaseFile.safeParse(outer.data.file);
  if (!parsed.success) return { errors: parsed.error.issues.slice(0, 20).map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message)) };

  // 사용자 사건은 slug 를 쓰지 않는다 (공식 사건 주소용)
  const file = { ...parsed.data, slug: undefined };
  if (outer.data.isPublic && file.rating === "19") return { errors: ["19세 사건은 성인 인증 기능이 준비될 때까지 공개할 수 없어요"] };
  return { file, isPublic: outer.data.isPublic };
}

/** 내가 만든 사건인지 (공식 사건은 owner 가 없어 누구도 수정할 수 없다) */
export async function ownedCase(caseId: string, userId: string) {
  const [row] = await db
    .select({ id: cases.id })
    .from(cases)
    .where(and(eq(cases.id, caseId), eq(cases.ownerId, userId)))
    .catch(() => []);
  return row ?? null;
}
