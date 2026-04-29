"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

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
  { label: "피드", href: "/feed?role=pharmacist" },
  { label: "채팅", href: "/chat" },
  { label: "내 정보", href: "/pharmacist/mypage" },
];

/* ── 색상 ── */
const C = {
  sageDeep: "#4A6355",
  sageMid: "#5E7D6C",
  terra: "#C06B45",
  textMid: "#3D4A42",
  border: "rgba(94, 125, 108, 0.14)",
};

/* ── 메인 컴포넌트 ── */
export default function DesktopHeader({ pathname }: { pathname: string }) {
  const router = useRouter();
  const { user, profile, loading, profileLoading, signOut } = useAuth();

  // 분기 로직 (LandingClient.tsx 패턴 참고)
  //  - loading 또는 (user && profileLoading)  → 스켈레톤 (탭/액션 영역 비움, 깜빡임 방지)
  //  - user 없음                                → 비로그인: 로고 + 로그인 버튼
  //  - role === 'pharmacist'                    → 약사용 탭 + 로그아웃
  //  - role === 'patient'                       → 환자용 탭 + 로그아웃
  //  - 그 외 (role NULL 등)                      → 비로그인과 동일 (안전 기본값)
  const role = profile?.role ?? null;
  const isPharmacist = role === "pharmacist";
  const isPatient = role === "patient";
  const showSkeleton = loading || (!!user && profileLoading);
  const showAuthed = !showSkeleton && !!user && (isPharmacist || isPatient);
  const showLogin = !showSkeleton && !showAuthed;

  const tabs = isPharmacist ? PHARMACIST_TABS : PATIENT_TABS;
  const logoHref = isPharmacist ? "/dashboard" : "/";

  const isActive = (href: string) => {
    const base = href.split("?")[0];
    if (base === "/") return pathname === "/";
    return pathname.startsWith(base);
  };

  const handleLogout = async () => {
    await signOut();
    router.replace("/");
  };

  return (
    <>
      <style>{`
        .dh-wrap{display:none}
        @media(min-width:768px){
          .dh-wrap{display:flex}
          body{padding-top:60px}
        }
        .dh-tab:hover{color:${C.sageDeep}!important}
        .dh-cta:hover{background:${C.sageMid}!important}
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

        {/* 가운데: 탭 메뉴 (인증된 사용자에게만) */}
        {showAuthed ? (
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
        ) : (
          // 스켈레톤/비로그인: 가운데는 비워둠 (로고-액션 양쪽 정렬 유지)
          <div aria-hidden="true" />
        )}

        {/* 오른쪽: 액션 (환영합니다 + 로그아웃 / 로그인 / 스켈레톤) */}
        {showSkeleton ? (
          <div aria-hidden="true" style={{ width: 120, height: 32 }} />
        ) : showAuthed ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14,
              color: C.textMid,
              fontFamily: "'Noto Sans KR', sans-serif",
              flexShrink: 0,
            }}
          >
            <span>
              {profile?.name ? `${profile.name}님 환영합니다` : "환영합니다"}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              style={{
                background: "transparent",
                border: "none",
                padding: "4px 6px",
                fontSize: 13,
                color: C.sageMid,
                textDecoration: "underline",
                cursor: "pointer",
                fontFamily: "'Noto Sans KR', sans-serif",
              }}
            >
              로그아웃
            </button>
          </span>
        ) : showLogin ? (
          <button
            type="button"
            className="dh-cta"
            onClick={() => router.push("/signup")}
            style={{
              background: C.sageDeep,
              color: "#fff",
              border: "none",
              borderRadius: 999,
              padding: "8px 18px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "'Noto Sans KR', sans-serif",
              flexShrink: 0,
              transition: "background 0.15s",
            }}
          >
            로그인
          </button>
        ) : null}
      </header>
    </>
  );
}
