"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { Suspense } from "react";
import DesktopHeader from "./DesktopHeader";

/* ══════════════════════════════════════════
   상수
   ══════════════════════════════════════════ */

const HIDDEN_PATHS = ["/signup", "/questionnaire"];

const PHARMACIST_PATHS = ["/dashboard", "/report", "/chart", "/pharmacist/mypage"];

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
    label: "채팅",
    href: "/chat/1?role=pharmacist",
    icon: (c) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" />
      </svg>
    ),
    badge: true,
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
   내부 컴포넌트 (searchParams 사용)
   ══════════════════════════════════════════ */

function BottomNavInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  /* 완전 숨기기 (가입/문답 — 헤더도 하단네비도 없음) */
  const fullyHidden = HIDDEN_PATHS.some((p) => pathname.startsWith(p));
  if (fullyHidden) return null;

  /* 모바일 하단 네비 숨기기 (랜딩 페이지 — 데스크톱 헤더만 표시) */
  const hideMobileNav = pathname === "/";

  /* 약사 판별 */
  const isPharmacist =
    searchParams.get("role") === "pharmacist" ||
    PHARMACIST_PATHS.some((p) => pathname.startsWith(p));

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
        @media(min-width:1200px){
          .bnav-mobile-spacer,.bnav-mobile-bar{display:none!important}
        }
      `}</style>

      {/* 데스크톱 상단 헤더 (1200px+) */}
      <DesktopHeader isPharmacist={isPharmacist} pathname={pathname} />

      {/* 모바일 하단 네비 (랜딩 페이지에서는 숨김) */}
      {!hideMobileNav && (
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

/* ══════════════════════════════════════════
   export
   ══════════════════════════════════════════ */

export default function BottomNav() {
  return (
    <Suspense>
      <BottomNavInner />
    </Suspense>
  );
}
