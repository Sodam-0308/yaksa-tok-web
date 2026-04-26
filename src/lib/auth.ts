"use client";

import { supabase } from "./supabase";
import type { Session, User } from "@supabase/supabase-js";

/** 카카오 OAuth 로그인
 *  - 이메일 권한이 카카오 앱에 없을 수 있으므로 닉네임·프로필 이미지만 요청.
 *  - redirectTo를 /auth/callback 으로 명시 — 우리 라우트에서 role_confirmed 검사 후 분기.
 *    (이 URL은 Supabase Auth Settings의 "Redirect URLs" 화이트리스트에 등록되어 있어야 함)
 */
export async function signInWithKakao() {
  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback`
      : undefined;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "kakao",
    options: {
      redirectTo,
      scopes: "profile_nickname profile_image",
      queryParams: {
        prompt: "login",
      },
    },
  });
  return { data, error };
}

/** 로그아웃 */
export async function signOut() {
  return supabase.auth.signOut();
}

/** 현재 세션 가져오기 */
export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/**
 * 인증 상태 변화 리스너 등록
 * @returns subscription 객체 (unsubscribe 가능)
 */
export function onAuthStateChange(
  callback: (event: string, session: Session | null, user: User | null) => void,
) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session, session?.user ?? null);
  });
}
