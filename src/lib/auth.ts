"use client";

import { supabase } from "./supabase";
import type { Session, User } from "@supabase/supabase-js";

/** 카카오 OAuth 로그인
 *  - 이메일 권한이 카카오 앱에 없을 수 있으므로 닉네임·프로필 이미지만 요청.
 *  - redirectTo는 지정하지 않음 — Supabase 프로젝트 Site URL로 자동 리다이렉트.
 */
export async function signInWithKakao() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "kakao",
    options: {
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
