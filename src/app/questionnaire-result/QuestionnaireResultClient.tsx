"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

/* ══════════════════════════════════════════
   컬러
   ══════════════════════════════════════════ */

const C = {
  sageBg: "#F8F9F7",
  sagePale: "#EDF4F0",
  sageLight: "#B3CCBE",
  sageMid: "#5E7D6C",
  sageDeep: "#4A6355",
  terra: "#C06B45",
  textDark: "#2C3630",
  textMid: "#3D4A42",
  border: "rgba(94, 125, 108, 0.14)",
  white: "#fff",
};

/* ══════════════════════════════════════════
   Mock 미리보기 약사 (매칭 카드)
   ══════════════════════════════════════════ */

interface PreviewPharmacist {
  maskedName: string;
  stars: string;
  matchLabel: string;
  specialties: string[];
  distance: string;
  travelTime: string;
}

const PREVIEW_PHARMACISTS: PreviewPharmacist[] = [
  {
    maskedName: "김○○ 약사",
    stars: "✦✦✦",
    matchLabel: "전문 분야 매칭",
    specialties: ["소화장애 전문", "만성피로 전문"],
    distance: "1.2km",
    travelTime: "도보 16분",
  },
  {
    maskedName: "박○○ 약사",
    stars: "✦✦",
    matchLabel: "상담 분야 매칭",
    specialties: ["불면·수면 전문"],
    distance: "2.8km",
    travelTime: "차로 8분",
  },
  {
    maskedName: "이○○ 약사",
    stars: "✦",
    matchLabel: "기본 매칭",
    specialties: ["피로·에너지 전문"],
    distance: "4.1km",
    travelTime: "차로 12분",
  },
];

/* ══════════════════════════════════════════
   메인
   ══════════════════════════════════════════ */

export default function QuestionnaireResultClient() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100dvh",
            background: C.sageBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: C.textMid,
            fontSize: 15,
          }}
        >
          불러오는 중...
        </div>
      }
    >
      <QuestionnaireResultContent />
    </Suspense>
  );
}

function QuestionnaireResultContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();

  // 로그인된 사용자는 가입 유도를 건너뛰고 바로 매칭으로 이동
  useEffect(() => {
    if (loading) return;
    if (user) {
      const symptom = searchParams.get("symptom") ?? "";
      const target = symptom
        ? `/match?symptom=${encodeURIComponent(symptom)}`
        : "/match";
      router.replace(target);
    }
  }, [loading, user, router, searchParams]);

  // 로그인 확인 중 또는 로그인 사용자 — 가입 유도 UI를 잠깐도 보이지 않도록 가림
  if (loading || user) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: C.sageBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: C.textMid,
          fontSize: 15,
        }}
      >
        매칭 화면으로 이동 중...
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: C.sageBg, fontFamily: "'Noto Sans KR', sans-serif" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: 24 }}>
        {/* ── 상단 완료 아이콘 + 타이틀 ── */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div
            style={{
              width: 72, height: 72, borderRadius: "50%",
              background: C.sagePale,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              marginBottom: 14,
              border: `1.5px solid ${C.sageLight}`,
            }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={C.sageDeep} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.textDark, fontFamily: "'Gothic A1', sans-serif", marginBottom: 8 }}>
            문답이 완료되었어요!
          </div>
          <div style={{ fontSize: 16, color: C.textMid, lineHeight: 1.6 }}>
            내 증상에 맞는 약사님을 찾았어요
          </div>
        </div>

        {/* ── 블러 미리보기 카드 + 오버레이 ── */}
        <div style={{ position: "relative", marginBottom: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {PREVIEW_PHARMACISTS.map((p, idx) => {
              const blur = idx === 0 ? "1px" : idx === 1 ? "4px" : "6px";
              const dim = idx === 0 ? 0.95 : idx === 1 ? 0.6 : 0.4;
              return (
                <div
                  key={idx}
                  aria-hidden="true"
                  style={{
                    filter: `blur(${blur})`,
                    opacity: dim,
                    background: C.white,
                    borderRadius: 16,
                    border: `1px solid ${C.border}`,
                    padding: 20,
                    pointerEvents: "none",
                    userSelect: "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: "50%",
                      background: C.sagePale,
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      fontSize: 24, flexShrink: 0,
                    }}>
                      👩‍⚕️
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: C.textDark, marginBottom: 2 }}>
                        {p.maskedName}
                      </div>
                      <div style={{ fontSize: 13, color: C.sageMid, display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ color: C.terra, fontWeight: 700 }}>{p.stars}</span>
                        <span>{p.matchLabel}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                    {p.specialties.map((s) => (
                      <span key={s} style={{
                        padding: "4px 10px", borderRadius: 100,
                        fontSize: 13, fontWeight: 600,
                        background: C.sagePale, color: C.sageDeep,
                      }}>
                        {s}
                      </span>
                    ))}
                  </div>
                  <div style={{ fontSize: 13, color: C.textMid, display: "flex", alignItems: "center", gap: 6 }}>
                    <span>📍</span>
                    <span>{p.distance} · {p.travelTime}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 오버레이 메시지 */}
          <div
            style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 16,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                background: "rgba(255,255,255,0.92)",
                backdropFilter: "blur(2px)",
                WebkitBackdropFilter: "blur(2px)",
                border: `1px solid ${C.sageLight}`,
                borderRadius: 14,
                padding: "16px 20px",
                maxWidth: 360,
                textAlign: "center",
                boxShadow: "0 4px 16px rgba(74,99,85,0.10)",
              }}
            >
              <div style={{
                fontSize: 16, fontWeight: 600, color: C.textDark, lineHeight: 1.6,
              }}>
                가입하면 약사님 프로필을 확인하고<br />무료 상담을 받을 수 있어요
              </div>
            </div>
          </div>
        </div>

        {/* ── 가입 혜택 ── */}
        <div
          style={{
            background: C.white,
            borderRadius: 16,
            border: `1px solid ${C.border}`,
            padding: "12px 20px",
            marginBottom: 24,
          }}
        >
          {[
            { icon: "💬", text: "전문 약사와 1:1 채팅 상담 무료", highlight: false },
            { icon: "📋", text: "내 문답 결과 저장 & 맞춤 가이드", highlight: false },
            { icon: "💚", text: "내 전담 약사님 만들기", highlight: true },
          ].map((b, i, arr) => (
            <div
              key={i}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 0",
                borderBottom: i === arr.length - 1 ? "none" : `1px solid ${C.border}`,
              }}
            >
              <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{b.icon}</span>
              <span style={{
                fontSize: 15,
                fontWeight: b.highlight ? 700 : 500,
                color: b.highlight ? C.terra : C.textDark,
                lineHeight: 1.5,
              }}>
                {b.text}
              </span>
            </div>
          ))}
        </div>

        {/* ── CTA ── */}
        <div style={{
          fontSize: 14,
          color: "#5E7D6C",
          textAlign: "center",
          marginBottom: 12,
        }}>
          휴대폰 번호만으로 30초 만에 가입 완료!
        </div>
        <button
          type="button"
          onClick={() => router.push("/signup")}
          style={{
            width: "100%", height: 56,
            borderRadius: 16,
            background: C.sageDeep, color: C.white,
            border: "none", cursor: "pointer",
            fontSize: 17, fontWeight: 700,
            fontFamily: "'Noto Sans KR', sans-serif",
            marginBottom: 14,
          }}
        >
          가입하고 약사 확인하기
        </button>
        <div style={{ textAlign: "center", fontSize: 14, color: C.textMid }}>
          이미 계정이 있으신가요?{" "}
          <Link
            href="/signup"
            style={{
              color: C.sageMid, fontWeight: 600,
              textDecoration: "underline", textUnderlineOffset: 2,
            }}
          >
            로그인
          </Link>
        </div>
      </div>
    </div>
  );
}
