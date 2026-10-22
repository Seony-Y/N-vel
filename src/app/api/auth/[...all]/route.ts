import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

// 회원가입, 로그인, 로그아웃 등 /api/auth/* 전부 Better Auth 가 처리
export const { GET, POST } = toNextJsHandler(auth);
