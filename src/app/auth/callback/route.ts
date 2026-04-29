import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServer } from "@/lib/supabase-server";

const PENDING_MATCH_COOKIE = "yaksa-tok-pending-match";

/**
 * OAuth 콜백
 *  - profile 없음 또는 role_confirmed = false → /signup/complete
 *    (pendingMatch 쿠키는 유지되어 /signup/complete가 역할 선택 후 /match 로 라우팅)
 *  - role_confirmed = true 이고 pendingMatch 쿠키 있음 → /match (쿠키 삭제, 최우선)
 *  - role_confirmed = true 이고 role = 'pharmacist' → /dashboard
 *  - role_confirmed = true 이고 role = 'patient' → /
 *  - role_confirmed = true 이지만 role 이 NULL/그 외 → / (안전 기본값)
 *  - 어떤 단계든 실패하면 /signup?error=auth
 *
 *  주의: /auth/callback 은 Supabase Authentication URL Configuration의
 *        "Redirect URLs" 화이트리스트에 등록되어 있어야 합니다.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/signup`);
  }

  const supabase = await createSupabaseServer();

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return NextResponse.redirect(`${origin}/signup?error=auth`);
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.redirect(`${origin}/signup?error=auth`);
  }

  const cookieStore = await cookies();
  const pendingMatch = cookieStore.get(PENDING_MATCH_COOKIE)?.value === "1";

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, role_confirmed")
    .eq("id", user.id)
    .maybeSingle<{
      role: "patient" | "pharmacist" | null;
      role_confirmed: boolean | null;
    }>();

  // 프로필 없음 또는 미확정 → 역할 선택 (pendingMatch 쿠키 유지)
  if (profileError || !profile || profile.role_confirmed !== true) {
    return NextResponse.redirect(`${origin}/signup/complete`);
  }

  // 확정된 사용자 — 우선순위:
  //   1) pendingMatch 쿠키 (사용자가 의도적으로 /match 가는 흐름 보존, 역할 무관)
  //   2) role === 'pharmacist' → /dashboard
  //   3) role === 'patient' → /
  //   4) 그 외 (role NULL 등 비정상) → / (안전 기본값)
  let target: string;
  if (pendingMatch) {
    target = `${origin}/match`;
  } else if (profile.role === "pharmacist") {
    target = `${origin}/dashboard`;
  } else if (profile.role === "patient") {
    target = `${origin}/`;
  } else {
    target = `${origin}/`;
  }

  const response = NextResponse.redirect(target);
  if (pendingMatch) {
    // 한 번 사용했으므로 쿠키 제거
    response.cookies.set(PENDING_MATCH_COOKIE, "", {
      path: "/",
      maxAge: 0,
    });
  }
  return response;
}
