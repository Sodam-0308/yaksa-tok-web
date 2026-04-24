"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

interface Props {
  children: ReactNode;
  /** 프로필이 없을 때 리다이렉트될 경로 (기본: /signup/complete) */
  completeProfilePath?: string;
  /** 로그인되지 않았을 때 리다이렉트될 경로 (기본: /signup) */
  signInPath?: string;
}

/**
 * 로그인 필수 페이지 래퍼.
 * - 세션 없음 → signInPath 로 이동
 * - 세션은 있으나 profiles 레코드 없음 → completeProfilePath 로 이동
 * - 로딩 중 → 간단한 스피너 표시
 * - 통과하면 children 렌더
 */
export default function AuthGuard({
  children,
  completeProfilePath = "/signup/complete",
  signInPath = "/signup",
}: Props) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [profileChecked, setProfileChecked] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);

  // 1) 세션 없으면 sign-in 으로
  useEffect(() => {
    if (!loading && !user) {
      router.replace(signInPath);
    }
  }, [loading, user, router, signInPath]);

  // 2) 세션 있으면 profiles 조회
  useEffect(() => {
    let cancelled = false;
    if (loading || !user) return;

    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (!data) {
        router.replace(completeProfilePath);
        return;
      }
      setHasProfile(true);
      setProfileChecked(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, user, router, completeProfilePath]);

  if (loading || !user || !profileChecked || !hasProfile) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: "#F8F9F7",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#3D4A42",
          fontSize: 15,
        }}
        role="status"
        aria-live="polite"
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              border: "2px solid rgba(94,125,108,0.25)",
              borderTopColor: "#4A6355",
              animation: "auth-guard-spin 0.8s linear infinite",
              display: "inline-block",
            }}
          />
          불러오는 중...
        </div>
        <style>{`
          @keyframes auth-guard-spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return <>{children}</>;
}
