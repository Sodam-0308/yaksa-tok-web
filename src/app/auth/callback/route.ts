import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

/**
 * OAuth 콜백 핸들러
 * 카카오 로그인 완료 후 Supabase가 ?code=... 로 리다이렉트 → 세션 교환.
 * - profiles 레코드가 있으면: / (기존 회원)
 * - 없으면: /signup/complete (신규 가입자, 추가 정보 입력)
 * - 실패 시: /signup?error=auth
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/signup`);
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/signup?error=auth`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/signup?error=auth`);
  }

  // profiles 레코드 확인
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.redirect(`${origin}/signup/complete`);
  }

  return NextResponse.redirect(`${origin}/`);
}
