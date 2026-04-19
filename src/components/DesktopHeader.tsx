"use client";

import { useRouter } from "next/navigation";

/* ── 타입 ── */
interface Tab {
  label: string;
  href: string;
}

const PATIENT_TABS: Tab[] = [
  { label: "홈", href: "/" },
  { label: "피드", href: "/feed" },
  { label: "채팅", href: "/chat/1" },
  { label: "내 정보", href: "/mypage" },
];

const PHARMACIST_TABS: Tab[] = [
  { label: "대시보드", href: "/dashboard" },
  { label: "차트", href: "/chart/1" },
  { label: "가이드", href: "/report/new" },
  { label: "채팅", href: "/chat/1?role=pharmacist" },
  { label: "피드", href: "/feed?role=pharmacist" },
  { label: "내 정보", href: "/pharmacist/mypage" },
];

/* ── 색상 ── */
const C = {
  sageDeep: "#4A6355",
  terra: "#C06B45",
  textMid: "#3D4A42",
  border: "rgba(94, 125, 108, 0.14)",
};

/* ── 메인 컴포넌트 ── */
export default function DesktopHeader({
  isPharmacist,
  pathname,
}: {
  isPharmacist: boolean;
  pathname: string;
}) {
  const router = useRouter();
  const tabs = isPharmacist ? PHARMACIST_TABS : PATIENT_TABS;
  const logoHref = isPharmacist ? "/dashboard" : "/";

  const isActive = (href: string) => {
    const base = href.split("?")[0];
    if (base === "/") return pathname === "/";
    return pathname.startsWith(base);
  };

  return (
    <>
      <style>{`
        .dh-wrap{display:none}
        @media(min-width:1200px){
          .dh-wrap{display:flex}
          body{padding-top:60px}
        }
        .dh-tab:hover{color:${C.sageDeep}!important}
      `}</style>

      <header
        className="dh-wrap"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          height: 60,
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 32px",
          background: "rgba(255,255,255,0.97)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid #E5E7E3",
        }}
      >
        {/* 왼쪽: 로고 */}
        <button
          type="button"
          onClick={() => router.push(logoHref)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            fontFamily: "'Gothic A1', sans-serif",
            fontSize: 20,
            fontWeight: 800,
            color: C.sageDeep,
            display: "flex",
            alignItems: "center",
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          약사톡<span style={{ color: C.terra }}>.</span>
        </button>

        {/* 가운데: 탭 메뉴 */}
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {tabs.map((tab) => {
            const active = isActive(tab.href);
            return (
              <button
                key={tab.href + tab.label}
                type="button"
                className="dh-tab"
                onClick={() => router.push(tab.href)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "18px 16px",
                  fontSize: 15,
                  fontWeight: active ? 700 : 500,
                  color: active ? C.sageDeep : C.textMid,
                  fontFamily: "'Noto Sans KR', sans-serif",
                  position: "relative",
                  lineHeight: 1,
                  borderBottom: active
                    ? `2.5px solid ${C.sageDeep}`
                    : "2.5px solid transparent",
                  marginBottom: -1,
                  transition: "color 0.15s",
                }}
                aria-current={active ? "page" : undefined}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* 오른쪽: 알림 아이콘 */}
        <button
          type="button"
          aria-label="알림"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 8,
            fontSize: 20,
            lineHeight: 1,
            position: "relative",
            flexShrink: 0,
          }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke={C.textMid}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
          {/* 알림 뱃지 */}
          <span
            style={{
              position: "absolute",
              top: 6,
              right: 6,
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#E0574F",
              border: "1.5px solid #fff",
            }}
          />
        </button>
      </header>
    </>
  );
}
