"use client";

import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";

/* ══════════════════════════════════════════
   더미 데이터
   ══════════════════════════════════════════ */

const STORY = {
  pharmacist: {
    id: "kim-seoyeon",
    name: "김서연",
    pharmacy: "그린약국",
    career: "15년차 약사",
    location: "서울 강남 · 1.2km",
    specialties: [
      { label: "만성피로", variant: "terra" },
      { label: "수면장애", variant: "lavender" },
      { label: "소화장애", variant: "sage" },
    ],
  },
  title: "태어날 때부터 아토피였던 딸, 6개월 만에 연고를 끊었어요",
  target: "약사 가족 · 10대 딸",
  tags: [{ label: "아토피", variant: "rose" }],
  changes: [{ before: "긁어서 피가 날 정도였어요", after: "연고 없이 지내요" }],
  duration: "6개월 관리",
  body: `약사로 15년 일하면서 수많은 환자를 봤지만, 정작 가장 마음이 아팠던 건 제 딸이었어요.

태어날 때부터 아토피가 심해서, 잠잘 때도 긁고, 아침에 일어나면 이불에 피가 묻어있을 정도였거든요. 소아과, 피부과 다 다녔지만 스테로이드 연고 없이는 일주일도 못 버텼어요.

약사니까 뭐가 문제인지는 감이 왔어요. 겉이 아니라 속부터 바꿔야 한다고 생각했죠. 장 환경을 중심으로 영양 밸런스를 잡아주기 시작했어요.

처음 2개월은 솔직히 변화가 크지 않았어요. 포기하고 싶을 때도 있었죠. 그런데 3개월째부터 긁는 횟수가 눈에 띄게 줄었고, 6개월이 되니까 연고를 안 발라도 되는 날이 생기기 시작했어요.

지금은 연고 없이 지내고 있어요. 완전히 없어진 건 아니지만, 아이가 밤에 푹 자는 것만으로도 감사해요.

같은 고민을 하고 계신 부모님이 있다면, 겉으로 보이는 증상만 잡으려 하지 마시고 근본적인 영양 밸런스를 한번 살펴보세요.`,
  photos: [
    { id: 1, placeholder: true },
    { id: 2, placeholder: true },
  ],
  likes: 287,
};

const OTHER_STORIES = [
  { id: "story-4", title: "약사인 저 자신의 2년 난임, 8개월 만에 기쁜 소식", likes: 312 },
  { id: "story-5", title: "만성피로에 시달리던 남편, 3개월 만에 아침이 달라졌어요", likes: 178 },
];

/* ══════════════════════════════════════════
   컬러
   ══════════════════════════════════════════ */

const C = {
  sageBg: "#F8F9F7", sagePale: "#EDF4F0", sageLight: "#B3CCBE",
  sageBright: "#7FA48E", sageMid: "#5E7D6C", sageDeep: "#4A6355",
  terra: "#C06B45", terraPale: "#FBF5F1",
  textDark: "#2C3630", textMid: "#3D4A42",
  border: "rgba(94, 125, 108, 0.14)", white: "#fff",
};

const TAG_COLORS: Record<string, { bg: string; color: string }> = {
  sage: { bg: "#EDF4F0", color: "#4A6355" },
  terra: { bg: "#F5E6DC", color: "#C06B45" },
  lavender: { bg: "#EEEDFE", color: "#534AB7" },
  rose: { bg: "#FDEDF1", color: "#C4788E" },
  blue: { bg: "#E8F2F8", color: "#5A8BA8" },
};

/* ══════════════════════════════════════════
   메인 컴포넌트
   ══════════════════════════════════════════ */

function StoryDetailContent() {
  const router = useRouter();
  const [liked, setLiked] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const likeCount = liked ? STORY.likes + 1 : STORY.likes;
  const ph = STORY.pharmacist;

  return (
    <>
      <style>{`
        .sd-page {
          min-height: 100dvh;
          background: ${C.sageBg};
          padding-bottom: 100px;
        }
        .sd-page nav {
          position: sticky; top: 0; z-index: 50;
          padding: 0 24px; height: 60px;
          display: flex; align-items: center;
          background: rgba(248,249,247,0.95);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid ${C.border};
        }
        .sd-c {
          max-width: 560px;
          margin: 0 auto;
          padding: 20px 16px;
        }
        .sd-bottom {
          position: fixed; bottom: 56px; left: 0; right: 0;
          background: rgba(255,255,255,0.97);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-top: 1px solid ${C.border};
          padding: 10px 16px 14px;
          z-index: 50;
        }
        .sd-bottom-inner {
          max-width: 560px;
          margin: 0 auto;
        }
        @keyframes sdFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .sd-animate {
          animation: sdFadeIn 0.4s ease both;
        }
      `}</style>

      <div className="sd-page">
        {/* ── 1. 헤더 ── */}
        <nav>
          <button
            className="nav-back"
            onClick={() => router.back()}
            aria-label="뒤로가기"
          >
            ←
          </button>
          <div style={{
            flex: 1, textAlign: "center",
            fontFamily: "'Gothic A1', sans-serif",
            fontSize: 16, fontWeight: 700,
            color: C.textDark, marginRight: 36,
          }}>
            약사의 이야기
          </div>
        </nav>

        <div className="sd-c">
          {/* ── 2. 약사 프로필 카드 ── */}
          <div
            className="sd-animate"
            style={{
              background: C.white,
              borderRadius: 16,
              boxShadow: "0 2px 12px rgba(74,99,85,0.07)",
              padding: 20,
              marginBottom: 16,
              cursor: "pointer",
            }}
            onClick={() => router.push(`/pharmacist/${ph.id}`)}
          >
            <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14 }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                background: C.sagePale,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 24, fontWeight: 700, color: C.sageDeep, flexShrink: 0,
              }}>
                {ph.name.charAt(0)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 17, fontWeight: 700, color: C.sageDeep,
                  fontFamily: "'Gothic A1', sans-serif", marginBottom: 2,
                }}>
                  {ph.name} 약사
                </div>
                <div style={{ fontSize: 14, color: C.textMid, marginBottom: 2 }}>
                  {ph.pharmacy} · {ph.career}
                </div>
                <div style={{ fontSize: 14, color: C.sageMid }}>
                  {ph.location}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {ph.specialties.map((s) => {
                const tc = TAG_COLORS[s.variant] || TAG_COLORS.sage;
                return (
                  <span key={s.label} style={{
                    display: "inline-block",
                    padding: "4px 10px", borderRadius: 100,
                    fontSize: 13, fontWeight: 600,
                    background: tc.bg, color: tc.color,
                  }}>
                    {s.label}
                  </span>
                );
              })}
            </div>
          </div>

          {/* ── 3. 글 제목 ── */}
          <div
            className="sd-animate"
            style={{
              fontSize: 21, fontWeight: 800, color: C.textDark,
              lineHeight: 1.45,
              fontFamily: "'Gothic A1', sans-serif",
              marginBottom: 16,
              animationDelay: "0.05s",
            }}
          >
            {STORY.title}
          </div>

          {/* ── 4. 대상 + 증상 ── */}
          <div
            className="sd-animate"
            style={{
              display: "flex", alignItems: "center", gap: 10,
              marginBottom: 16, flexWrap: "wrap",
              animationDelay: "0.1s",
            }}
          >
            <span style={{
              fontSize: 14, fontWeight: 500, color: C.sageMid,
              padding: "5px 12px", borderRadius: 100,
              background: C.sagePale,
            }}>
              {STORY.target}
            </span>
            {STORY.tags.map((t) => {
              const tc = TAG_COLORS[t.variant] || TAG_COLORS.sage;
              return (
                <span key={t.label} style={{
                  display: "inline-block",
                  padding: "5px 12px", borderRadius: 100,
                  fontSize: 14, fontWeight: 600,
                  background: tc.bg, color: tc.color,
                }}>
                  {t.label}
                </span>
              );
            })}
          </div>

          {/* ── 5. 전/후 변화 카드 ── */}
          <div
            className="sd-animate"
            style={{
              background: C.white,
              borderRadius: 16,
              boxShadow: "0 2px 12px rgba(74,99,85,0.07)",
              padding: 20,
              marginBottom: 20,
              animationDelay: "0.15s",
            }}
          >
            {STORY.changes.map((ch, i) => (
              <div key={i} style={{ marginBottom: i < STORY.changes.length - 1 ? 16 : 0 }}>
                {/* Before */}
                <div style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                  padding: "12px 14px", borderRadius: 12,
                  background: "#FBF5F1",
                }}>
                  <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>😫</span>
                  <span style={{ fontSize: 15, fontWeight: 500, color: C.textMid, lineHeight: 1.5 }}>
                    &ldquo;{ch.before}&rdquo;
                  </span>
                </div>

                {/* Arrow + duration */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  gap: 8, padding: "10px 0",
                }}>
                  <div style={{
                    width: 2, height: 20,
                    background: `linear-gradient(to bottom, ${C.sageLight}, ${C.sageDeep})`,
                    borderRadius: 2,
                  }} />
                  <span style={{
                    fontSize: 13, fontWeight: 700, color: C.sageDeep,
                    padding: "4px 12px", borderRadius: 100,
                    background: C.sagePale,
                  }}>
                    {STORY.duration}
                  </span>
                  <div style={{
                    width: 2, height: 20,
                    background: `linear-gradient(to bottom, ${C.sageLight}, ${C.sageDeep})`,
                    borderRadius: 2,
                  }} />
                </div>

                {/* After */}
                <div style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                  padding: "12px 14px", borderRadius: 12,
                  background: C.sagePale,
                }}>
                  <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>😊</span>
                  <span style={{ fontSize: 15, fontWeight: 600, color: C.sageDeep, lineHeight: 1.5 }}>
                    &ldquo;{ch.after}&rdquo;
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* ── 6. 본문 ── */}
          <div
            className="sd-animate"
            style={{
              background: C.white,
              borderRadius: 16,
              boxShadow: "0 2px 12px rgba(74,99,85,0.07)",
              padding: 20,
              marginBottom: 16,
              animationDelay: "0.2s",
            }}
          >
            <p style={{
              fontSize: 15, color: C.textMid,
              lineHeight: 1.8, whiteSpace: "pre-wrap",
              margin: 0,
            }}>
              {STORY.body}
            </p>
          </div>

          {/* ── 7. 사진 ── */}
          <div
            className="sd-animate"
            style={{
              background: C.white,
              borderRadius: 16,
              boxShadow: "0 2px 12px rgba(74,99,85,0.07)",
              padding: 16,
              marginBottom: 16,
              animationDelay: "0.25s",
            }}
          >
            <div style={{
              display: "grid",
              gridTemplateColumns: STORY.photos.length === 1 ? "1fr" : "1fr 1fr",
              gap: 8,
            }}>
              {STORY.photos.map((p, i) => (
                <div
                  key={p.id}
                  onClick={() => setLightboxIdx(i)}
                  style={{
                    aspectRatio: STORY.photos.length === 1 ? "16/9" : "1/1",
                    borderRadius: 12, overflow: "hidden",
                    background: C.sagePale,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  <div style={{
                    display: "flex", flexDirection: "column",
                    alignItems: "center", gap: 6,
                  }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.sageLight} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="m21 15-5-5L5 21" />
                    </svg>
                    <span style={{ fontSize: 13, color: C.sageLight, fontWeight: 500 }}>
                      사진 {i + 1}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── 8. 좋아요 ── */}
          <div
            className="sd-animate"
            style={{
              display: "flex", justifyContent: "center",
              marginBottom: 16,
              animationDelay: "0.3s",
            }}
          >
            <button
              type="button"
              onClick={() => setLiked((v) => !v)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "12px 28px", borderRadius: 100,
                background: liked ? C.sagePale : C.white,
                border: `1.5px solid ${liked ? C.sageDeep : C.sageLight}`,
                cursor: "pointer",
                fontSize: 15, fontWeight: 700,
                color: liked ? C.sageDeep : C.textMid,
                transition: "all 0.2s",
              }}
            >
              <span style={{ fontSize: 18 }}>{liked ? "💚" : "🤍"}</span>
              <span>{likeCount}</span>
            </button>
          </div>

          {/* ── 9. 면책 문구 ── */}
          <div
            className="sd-animate"
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              background: C.terraPale,
              fontSize: 14,
              color: C.terra,
              lineHeight: 1.6,
              textAlign: "center",
              marginBottom: 24,
              animationDelay: "0.35s",
            }}
          >
            개인의 경험이며, 같은 증상이라도 사람마다 원인이 다릅니다. 정확한 분석은 전문 약사와 상담하세요.
          </div>

          {/* ── 11. 다른 글 추천 ── */}
          <div
            className="sd-animate"
            style={{ marginBottom: 20, animationDelay: "0.4s", overflow: "hidden" }}
          >
            <div style={{
              fontSize: 16, fontWeight: 700, color: C.textDark,
              fontFamily: "'Gothic A1', sans-serif",
              marginBottom: 12,
            }}>
              {ph.name} 약사의 다른 이야기
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: OTHER_STORIES.length === 1 ? "1fr" : "1fr 1fr",
              gap: 12,
            }}>
              {OTHER_STORIES.map((os) => (
                <div
                  key={os.id}
                  onClick={() => router.push(`/feed/recommend/${os.id}`)}
                  style={{
                    background: C.white,
                    borderRadius: 14,
                    boxShadow: "0 2px 10px rgba(74,99,85,0.06)",
                    padding: 16,
                    cursor: "pointer",
                    transition: "transform 0.15s",
                  }}
                >
                  <div style={{
                    fontSize: 15, fontWeight: 600, color: C.textDark,
                    lineHeight: 1.5, marginBottom: 10,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical" as const,
                    overflow: "hidden",
                  }}>
                    {os.title}
                  </div>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 6,
                    fontSize: 14, color: C.sageMid,
                  }}>
                    <span>🤍</span>
                    <span>{os.likes}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── 10. 하단 고정 상담 버튼 ── */}
        <div className="sd-bottom">
          <div className="sd-bottom-inner">
            <div style={{
              fontSize: 13, color: C.sageMid, textAlign: "center",
              marginBottom: 6, fontWeight: 500,
            }}>
              근처 약사 · 무료 상담
            </div>
            <button
              type="button"
              onClick={() => router.push(`/pharmacist/${ph.id}`)}
              style={{
                width: "100%",
                padding: "15px 0",
                borderRadius: 14,
                fontSize: 16, fontWeight: 700,
                background: C.sageDeep, color: C.white,
                border: "none", cursor: "pointer",
                letterSpacing: "0.02em",
              }}
            >
              {ph.name} 약사에게 상담받기 →
            </button>
          </div>
        </div>
      </div>

      {/* ── 라이트박스 ── */}
      {lightboxIdx !== null && (
        <div
          onClick={() => setLightboxIdx(null)}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.8)",
            backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 200, cursor: "pointer",
          }}
        >
          <div style={{
            width: "85vw", maxWidth: 480,
            aspectRatio: "4/3",
            borderRadius: 16, overflow: "hidden",
            background: C.sagePale,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              display: "flex", flexDirection: "column",
              alignItems: "center", gap: 8,
            }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={C.sageLight} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
              <span style={{ fontSize: 14, color: C.sageMid, fontWeight: 500 }}>
                사진 {lightboxIdx + 1}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function StoryDetailClient() {
  return (
    <Suspense>
      <StoryDetailContent />
    </Suspense>
  );
}
