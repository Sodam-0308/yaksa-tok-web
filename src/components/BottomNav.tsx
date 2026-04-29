"use client";

import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import DesktopHeader from "./DesktopHeader";

/* ══════════════════════════════════════════
   상수
   ══════════════════════════════════════════ */

const HIDDEN_PATHS = ["/signup", "/questionnaire"];

const ACTIVE = "#4A6355";
const INACTIVE = "#8A9A90";

interface Tab {
  label: string;
  href: string;
  icon: (color: string) => React.ReactNode;
  badge?: boolean;
}

const PATIENT_TABS: Tab[] = [
  {
    label: "홈",
    href: "/",
    icon: (c) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
        <path d="M9 21V12h6v9" />
      </svg>
    ),
  },
  {
    label: "피드",
    href: "/feed",
    icon: (c) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M7 7h10M7 12h10M7 17h6" />
      </svg>
    ),
  },
  {
    label: "채팅",
    href: "/chat/1",
    icon: (c) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" />
      </svg>
    ),
    badge: true,
  },
  {
    label: "내 정보",
    href: "/mypage",
    icon: (c) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M20 21c0-3.3-3.6-6-8-6s-8 2.7-8 6" />
      </svg>
    ),
  },
];

const PHARMACIST_TABS: Tab[] = [
  {
    label: "대시보드",
    href: "/dashboard",
    icon: (c) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="13" width="4" height="8" rx="1" />
        <rect x="10" y="8" width="4" height="13" rx="1" />
        <rect x="17" y="3" width="4" height="18" rx="1" />
      </svg>
    ),
  },
  {
    label: "피드",
    href: "/feed?role=pharmacist",
    icon: (c) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M7 7h10M7 12h10M7 17h6" />
      </svg>
    ),
  },
  {
    label: "채팅",
    href: "/chat",
    icon: (c) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" />
      </svg>
    ),
    badge: true,
  },
  {
    label: "내 정보",
    href: "/pharmacist/mypage",
    icon: (c) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M20 21c0-3.3-3.6-6-8-6s-8 2.7-8 6" />
      </svg>
    ),
  },
];

/* ══════════════════════════════════════════
   메인 컴포넌트
   ══════════════════════════════════════════ */

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading, profileLoading } = useAuth();

  /* 완전 숨기기 (가입/문답 — 헤더도 하단네비도 없음) */
  const fullyHidden = HIDDEN_PATHS.some((p) => pathname.startsWith(p));
  if (fullyHidden) return null;

  /* 분기 (LandingClient.tsx 패턴 참고)
   *   - loading 또는 (user && profileLoading)  → 깜빡임 방지: 하단 네비 미렌더, 헤더는 스켈레톤
   *   - user 없음                                → 비로그인: 하단 네비 미렌더, 헤더는 로그인 버튼
   *   - role === 'pharmacist'                    → 약사용 하단 네비
   *   - role === 'patient'                       → 환자용 하단 네비
   *   - 그 외 (role NULL 등)                      → 비로그인과 동일 (안전 기본값)
   */
  const role = profile?.role ?? null;
  const isPharmacist = role === "pharmacist";
  const isPatient = role === "patient";
  const showSkeleton = loading || (!!user && profileLoading);
  const showAuthed = !showSkeleton && !!user && (isPharmacist || isPatient);

  // 비로그인 + / 만 숨기는 동작은 showAuthed=false 자동 처리됨.
  // 로그인한 사용자는 랜딩(/)에서도 하단바 표시 — 별도 hideMobileNav 분기 제거.

  const tabs = isPharmacist ? PHARMACIST_TABS : PATIENT_TABS;

  /* 현재 탭 판별 */
  const isActive = (href: string) => {
    const base = href.split("?")[0];
    if (base === "/") return pathname === "/";
    return pathname.startsWith(base);
  };

  return (
    <>
      <style>{`
        .bnav-mobile-spacer,.bnav-mobile-bar{display:flex}
        .bnav-mobile-spacer{display:block}
        @media(min-width:768px){
          .bnav-mobile-spacer,.bnav-mobile-bar{display:none!important}
        }
      `}</style>

      {/* 데스크톱 상단 헤더 (768px+) — 자체적으로 인증 상태 분기 처리 */}
      <DesktopHeader pathname={pathname} />

      {/* 모바일 하단 네비 — 인증된 사용자에게만, 랜딩 포함 모든 페이지 */}
      {showAuthed && (
        <>
          <div className="bnav-mobile-spacer" style={{ height: 56 }} />
          <nav
            className="bnav-mobile-bar"
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              height: 56,
              background: "rgba(255,255,255,0.97)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              borderTop: "1px solid rgba(94, 125, 108, 0.14)",
              display: "flex",
              zIndex: 90,
            }}
            aria-label="메인 네비게이션"
          >
            {tabs.map((tab) => {
              const active = isActive(tab.href);
              const color = active ? ACTIVE : INACTIVE;
              return (
                <button
                  key={tab.label}
                  type="button"
                  onClick={() => router.push(tab.href)}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 2,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    position: "relative",
                  }}
                  aria-label={tab.label}
                  aria-current={active ? "page" : undefined}
                >
                  <div style={{ position: "relative", lineHeight: 0 }}>
                    {tab.icon(color)}
                    {tab.badge && (
                      <span
                        style={{
                          position: "absolute",
                          top: -1,
                          right: -3,
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "#E0574F",
                          border: "1.5px solid #fff",
                        }}
                      />
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: active ? 700 : 500,
                      color,
                      fontFamily: "'Noto Sans KR', sans-serif",
                      lineHeight: 1,
                    }}
                  >
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </nav>
        </>
      )}
    </>
  );
}
