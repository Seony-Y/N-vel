import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/** Neon 에 HTTP 로 접속 (서버리스 환경에서 연결 풀 관리가 필요 없음) */
export const db = drizzle({ client: neon(process.env.DATABASE_URL!), schema });
