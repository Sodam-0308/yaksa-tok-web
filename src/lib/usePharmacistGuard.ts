"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

/**
 * 약사 페이지 공용 접근 가드.
 *
 * 반환 { checking, failed }:
 *  - checking=true  : 아직 통과 확정 안 됨(로딩/리다이렉트/재시도 진행 중) → 호출부는 "확인 중…" 로딩 렌더
 *  - failed=true    : 재시도까지 했는데 끝내 판정 실패(네트워크 등) → 호출부는 실패 안내 + [새로고침] 렌더
 *  - 둘 다 false     : 약사 정상 통과 → 본문 렌더
 *
 * 판정 흐름(일시적 데이터 미수신을 "거부"로 단정하지 않음):
 *  - auth/profile 로딩 중 → 대기(checking)
 *  - 비로그인 → / 로 replace
 *  - profile == null(아직 못 받음) → 환자 확정 아님 → 대기(8s 타임아웃 시 failed 로 탈출)
 *  - profile 있고 role !== 'pharmacist'(환자 확정) → / 로 replace
 *  - 약사 → pharmacist_profiles.license_name 조회
 *      · 에러 → 800ms 간격 최대 2회 재시도 → 끝내 실패면 failed(=replace 안 함, 약사일 수 있음)
 *      · row 없음(가입 미완주) → /signup/pharmacist (처음 step1부터 — 약국·주소 등도 없어 면허만 넣으면 못 빠져나옴)
 *      · row 있고 license 빈값(레거시) → /signup/pharmacist?step=license (면허만 보완)
 *      · license 정상 → 통과(checking=false)
 *  - 어떤 경로로도 영구 멈춤 안 되게 8s 전체 타임아웃 안전장치.
 *  - replace 사용 — 뒤로가기 시 약사 페이지로 안 돌아오게.
 */
export function usePharmacistGuard(): { checking: boolean; failed: boolean } {
  const router = useRouter();
  const { user: authUser, loading: authLoading, profile, profileLoading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [failed, setFailed] = useState(false);
  const retryCountRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const clearAll = () => timers.forEach(clearTimeout);

    // 매 평가는 깨끗한 상태에서 시작 — 실패/통과는 아래 분기에서만 확정.
    setFailed(false);

    // 1) auth/profile 로딩 중 — 대기
    if (authLoading || profileLoading) {
      setChecking(true);
      return () => { cancelled = true; clearAll(); };
    }

    // 2) 비로그인 — 메인 홈
    if (!authUser) {
      setChecking(true);
      router.replace("/");
      return () => { cancelled = true; clearAll(); };
    }

    // 3) profile 아직 못 받음(null/undefined) — "환자 확정" 아님. 즉시 튕기지 말고 대기.
    //    profile dep 변화로 재평가됨. 영영 안 오면 8s 후 failed 로 탈출(영구 멈춤 방지).
    if (profile == null) {
      setChecking(true);
      const t = setTimeout(() => {
        if (cancelled) return;
        setFailed(true);
        setChecking(false);
      }, 8000);
      timers.push(t);
      return () => { cancelled = true; clearAll(); };
    }

    // 4) 환자로 확정 — 메인 홈
    if (profile.role !== "pharmacist") {
      setChecking(true);
      router.replace("/");
      return () => { cancelled = true; clearAll(); };
    }

    // 5) 약사 — license 조회(재시도 가능). 전체 타임아웃 안전장치 동반.
    setChecking(true);
    retryCountRef.current = 0;
    const overall = setTimeout(() => {
      if (cancelled) return;
      setFailed(true);
      setChecking(false);
    }, 8000);
    timers.push(overall);

    const attempt = async () => {
      const { data, error } = await supabase
        .from("pharmacist_profiles")
        .select("license_name")
        .eq("id", authUser.id)
        .maybeSingle<{ license_name: string | null }>();
      if (cancelled) return;

      if (error) {
        console.error("[dashboard guard] license check failed:", error);
        if (retryCountRef.current < 2) {
          retryCountRef.current += 1;
          const t = setTimeout(() => { if (!cancelled) void attempt(); }, 800);
          timers.push(t);
          return;
        }
        // 재시도 소진 — 약사일 수 있으므로 replace 하지 않고 실패 안내로 탈출.
        retryCountRef.current = 0;
        clearTimeout(overall);
        setFailed(true);
        setChecking(false);
        return;
      }

      if (!data) {
        // 약사인데 pharmacist_profiles row 미생성(가입 미완주) — 약국명·주소(NOT NULL)·전문분야도 없는
        // 상태라 면허 단계(step3)로 보내면 끝까지 못 가고 튕김. 가입 처음(step1)부터 완주시켜야 프로필이 온전히 생성됨.
        console.error("[dashboard guard] no pharmacist_profiles row found");
        retryCountRef.current = 0;
        clearTimeout(overall);
        setChecking(true);
        router.replace("/signup/pharmacist");
        return;
      }

      retryCountRef.current = 0;
      clearTimeout(overall);
      const ln = (data.license_name ?? "").trim();
      if (!ln) {
        setChecking(true);
        router.replace("/signup/pharmacist?step=license");
        return;
      }
      setFailed(false);
      setChecking(false);
    };
    void attempt();

    return () => { cancelled = true; clearAll(); };
  }, [authUser, router, profile, authLoading, profileLoading]);

  return { checking, failed };
}
