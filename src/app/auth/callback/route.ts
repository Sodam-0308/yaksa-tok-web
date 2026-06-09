import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServer } from "@/lib/supabase-server";

const PENDING_MATCH_COOKIE = "yaksa-tok-pending-match";

/**
 * OAuth 콜백
 *  - profile 없음 또는 role_confirmed = false → /signup/complete
 *    (pendingMatch 쿠키는 유지되어 /signup/complete가 역할 선택 후 /match 로 라우팅)
 *  - role_confirmed = true 이고 pendingMatch 쿠키 있음 → /match (쿠키 삭제, 최우선)
 *  - role_confirmed = true 이고 role = 'pharmacist' 이고 pharmacist_profiles 조회 일시 실패
 *      → /dashboard (row 없음으로 강등 금지. 클라이언트 가드가 재판정)
 *  - role_confirmed = true 이고 role = 'pharmacist' 이고 pharmacist_profiles row 없음(가입 미완주)
 *      → /signup/pharmacist (처음 step1부터 — 약국·주소 등도 없어 면허만 넣으면 못 빠져나옴)
 *  - role_confirmed = true 이고 role = 'pharmacist' 이고 row 있고 license_name NULL/빈값(레거시)
 *      → /signup/pharmacist?step=license (면허증 이름 입력 단계로)
 *  - role_confirmed = true 이고 role = 'pharmacist' (license_name 정상) → /dashboard
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

  // 약사인 경우에만 pharmacist_profiles 추가 조회.
  //  조회 에러(ppHadError) / row 존재(hasProfileRow) / license_name 빈값(licenseEmpty)을 분리.
  //  특히 "조회 일시 실패"는 "row 없음"과 구분 — 에러를 가입 강등 트리거로 쓰지 않고,
  //  클라이언트 가드(2회 재시도 + 실패 화면 보유)에 최종 판정을 위임하기 위함. 재시도는 콜백에 넣지 않음(가드 중복 회피).
  let ppHadError = false;
  let hasProfileRow = false;
  let licenseEmpty = true;
  if (profile.role === "pharmacist") {
    const { data: pp, error: ppError } = await supabase
      .from("pharmacist_profiles")
      .select("license_name")
      .eq("id", user.id)
      .maybeSingle<{ license_name: string | null }>();
    ppHadError = ppError != null;
    hasProfileRow = pp != null;
    licenseEmpty = !(pp?.license_name?.trim());
  }

  // 확정된 사용자 — 우선순위:
  //   1) pendingMatch 쿠키 (사용자가 의도적으로 /match 가는 흐름 보존, 역할 무관)
  //   약사 갈래(아래 순서대로, 에러를 row 판정보다 먼저 분리):
  //   2) role === 'pharmacist' && 조회 일시 실패 → /dashboard
  //        (row 없음으로 강등 금지. 클라이언트 가드가 대시보드에서 재판정)
  //   3) role === 'pharmacist' && row 없음(가입 미완주) → /signup/pharmacist (처음 step1부터)
  //   4) role === 'pharmacist' && row 있고 면허 빈값(레거시) → /signup/pharmacist?step=license (면허만 보완)
  //   5) role === 'pharmacist' (license_name OK) → /dashboard
  //   6) role === 'patient' → /
  //   7) 그 외 (role NULL 등 비정상) → / (안전 기본값)
  let target: string;
  if (pendingMatch) {
    target = `${origin}/match`;
  } else if (profile.role === "pharmacist") {
    if (ppHadError) {
      target = `${origin}/dashboard`;
    } else if (!hasProfileRow) {
      target = `${origin}/signup/pharmacist`;
    } else if (licenseEmpty) {
      target = `${origin}/signup/pharmacist?step=license`;
    } else {
      target = `${origin}/dashboard`;
    }
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
