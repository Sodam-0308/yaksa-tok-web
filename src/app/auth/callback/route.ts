import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServer } from "@/lib/supabase-server";

const PENDING_MATCH_COOKIE = "yaksa-tok-pending-match";

/**
 * OAuth 콜백
 *  - profile.role_confirmed = true 이고 pendingMatch 쿠키 있음 → /match (쿠키 삭제)
 *  - profile.role_confirmed = true → /
 *  - profile 없음 또는 role_confirmed = false → /signup/complete
 *    (pendingMatch 쿠키는 유지되어 /signup/complete가 역할 선택 후 /match 로 라우팅)
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
      role: "patient" | "pharmacist";
      role_confirmed: boolean | null;
    }>();

  // 프로필 없음 또는 미확정 → 역할 선택 (pendingMatch 쿠키 유지)
  if (profileError || !profile || profile.role_confirmed !== true) {
    return NextResponse.redirect(`${origin}/signup/complete`);
  }

  // 확정된 사용자 — pendingMatch 가 있으면 /match, 없으면 /
  const target = pendingMatch ? `${origin}/match` : `${origin}/`;
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
