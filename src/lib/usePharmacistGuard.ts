"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

/**
 * 약사 페이지 공용 가드 — pharmacist_profiles.license_name 이 NULL/빈값인 약사를
 * 면허증 이름 입력 단계(/signup/pharmacist?step=license) 로 자동 이동시킴.
 *
 * 원본: DashboardClient.tsx 의 useEffect(2026-05-27 추출, 동작 변경 없음).
 * /dashboard 와 /dashboard/patients 등 약사 전용 페이지에서 동일하게 호출해 일관 적용.
 *
 * race condition 방지:
 *  - auth/profile 로딩 중에는 절대 쿼리 안 던짐 (세션 토큰 stale 로 RLS 일시 거부 회피)
 *  - profile.role 이 'pharmacist' 일 때만 가드 동작 (환자 계정 보호)
 *  - 쿼리 에러/row 없음 vs 진짜 빈 값을 구분 — 진짜 빈 값일 때만 redirect
 */
export function usePharmacistGuard(): void {
  const router = useRouter();
  const { user: authUser, loading: authLoading, profile, profileLoading } = useAuth();

  useEffect(() => {
    if (authLoading || profileLoading) return;
    if (!authUser) return;
    if (profile?.role !== "pharmacist") return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("pharmacist_profiles")
        .select("license_name")
        .eq("id", authUser.id)
        .maybeSingle<{ license_name: string | null }>();
      if (cancelled) return;
      if (error) {
        console.error("[dashboard guard] license check failed:", error);
        return;
      }
      if (!data) {
        console.error("[dashboard guard] no pharmacist_profiles row found");
        return;
      }
      const ln = (data.license_name ?? "").trim();
      if (!ln) {
        router.replace("/signup/pharmacist?step=license");
      }
    })();
    return () => { cancelled = true; };
  }, [authUser, router, profile, authLoading, profileLoading]);
}
