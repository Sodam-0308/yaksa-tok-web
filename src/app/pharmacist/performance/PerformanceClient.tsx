"use client";

import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";

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
  terraDark: "#A35A39",
  terraLight: "#F5E6DC",
  terraPale: "#FBF5F1",
  textDark: "#2C3630",
  textMid: "#3D4A42",
  border: "rgba(94, 125, 108, 0.14)",
  borderDashed: "rgba(94, 125, 108, 0.2)",
  white: "#fff",
  error: "#D4544C",
};

/* ══════════════════════════════════════════
   Mock 데이터
   ══════════════════════════════════════════ */

interface Badge {
  id: string;
  emoji: string;
  name: string;
  description: string;
  earned: boolean;
  earnedAt?: string;
  /** 미획득 시 남은 조건 설명 */
  remaining?: string;
  /** 현재 강조 뱃지 */
  current?: boolean;
}

const BADGES: Badge[] = [
  {
    id: "b-1",
    emoji: "🌱",
    name: "신규 약사",
    description: "가입 직후 자동 획득",
    earned: true,
    earnedAt: "2026.03.01",
  },
  {
    id: "b-2",
    emoji: "💊",
    name: "상담 활동",
    description: "상담 10건 이상 진행",
    earned: true,
    earnedAt: "2026.03.18",
  },
  {
    id: "b-3",
    emoji: "⚡",
    name: "빠른 답변",
    description: "평균 답변 시간 3시간 이내",
    earned: true,
    earnedAt: "2026.04.02",
  },
  {
    id: "b-4",
    emoji: "⭐",
    name: "개선 확인",
    description: "개선 확인 5건 이상",
    earned: true,
    earnedAt: "2026.04.10",
    current: true,
  },
  {
    id: "b-5",
    emoji: "🏅",
    name: "종합 건강관리",
    description: "3개 이상 분야에서 각 2건 이상 개선 확인",
    earned: false,
    remaining: "1개 분야 더 필요",
  },
  {
    id: "b-6",
    emoji: "👑",
    name: "베스트 약사",
    description: "개선 확인 20건 이상 & 평균 답변 3시간 이내",
    earned: false,
    remaining: "개선 확인 8건 더 필요",
  },
];

const STATS = {
  total: 28,
  completed: 23,
  avgTime: "2시간 30분",
  improved: 12,
  badge: "개선 확인",
  nextBadge: "종합 건강관리까지 1개 분야 더 필요",
  thisMonthDelta: "+5건",
};

interface CaseStudy {
  id: string;
  title: string;
  tags: string[];
  writtenAt: string;
  likes: number;
  /** 상세 — 펼침 시 표시 */
  description: string;
  supplements: string[];
  outcome: string;
  duration: string;
}

const INITIAL_CASES: CaseStudy[] = [
  {
    id: "cs-1",
    title: "만성피로 환자, 비타민B군 + 마그네슘으로 개선된 사례",
    tags: ["만성피로", "수면장애"],
    writtenAt: "2026.04.12",
    likes: 24,
    description:
      "30대 사무직 여성 환자. 오후 극심한 피로와 입면 어려움을 6개월간 호소. 카페인 과다 섭취와 수면 부족이 겹친 상태로, 식습관 개선과 함께 영양제 보조를 시작.\n2주차부터 아침 기상이 수월해지고, 4주차엔 오후 졸림이 확연히 줄었다고 보고.",
    supplements: ["비타민B군", "마그네슘", "비타민D"],
    outcome: "에너지 3→5 · 수면 2→4로 개선 확인",
    duration: "8주 (2개월)",
  },
  {
    id: "cs-2",
    title: "식후 더부룩함, 유산균 + 소화효소 조합 효과 있음",
    tags: ["소화장애"],
    writtenAt: "2026.03.28",
    likes: 18,
    description:
      "40대 남성 환자. 식후 30분 내 더부룩함과 가스 참 증상. 브리스톨 척도 1~2형의 배변 패턴이 3개월간 지속.\n장 건강 중심 접근으로 유산균(아침 공복) + 소화효소(식사 직전) 조합 안내.",
    supplements: ["유산균", "소화효소", "식이섬유"],
    outcome: "더부룩함 빈도 주 5회 → 주 1~2회로 감소",
    duration: "6주",
  },
  {
    id: "cs-3",
    title: "관절 불편감 + 면역력 저하, 오메가3와 비타민D 병행",
    tags: ["관절통", "면역력"],
    writtenAt: "2026.03.15",
    likes: 11,
    description:
      "50대 여성 환자. 무릎·손가락 관절 불편감 2년 + 감기 잦음. 아침 관절 강직 호소.\n오메가3(고용량 EPA) + 비타민D 4000IU + 아연 조합으로 항염 지원.",
    supplements: ["오메가3", "비타민D 4000IU", "아연"],
    outcome: "아침 관절 강직 감소, 감기 빈도 월 2회 → 1회 이하",
    duration: "12주 (3개월)",
  },
];

/* ══════════════════════════════════════════
   메인
   ══════════════════════════════════════════ */

function Content() {
  const router = useRouter();
  const [cases, setCases] = useState<CaseStudy[]>(INITIAL_CASES);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [expandedCaseIds, setExpandedCaseIds] = useState<Set<string>>(new Set());
  const toggleCase = (id: string) => {
    setExpandedCaseIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const confirmDelete = () => {
    if (!deleteTargetId) return;
    setCases((prev) => prev.filter((c) => c.id !== deleteTargetId));
    setDeleteTargetId(null);
  };

  const earnedCount = BADGES.filter((b) => b.earned).length;
  const currentBadge = BADGES.find((b) => b.current);

  return (
    <>
      <style>{`
        .perf-page { min-height: 100dvh; background: ${C.sageBg}; padding-bottom: 40px; }
        .perf-page nav {
          position: sticky; top: 0; z-index: 50;
          padding: 0 24px; height: 60px;
          display: flex; align-items: center; gap: 8px;
          background: rgba(248,249,247,0.95);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid ${C.border};
        }
        .perf-c { max-width: 560px; margin: 0 auto; padding: 20px 16px; }
      `}</style>

      <div className="perf-page">
        <nav>
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="뒤로가기"
            style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: C.textDark, padding: 6, lineHeight: 1 }}
          >←</button>
          <div style={{ flex: 1, textAlign: "center", fontFamily: "'Gothic A1', sans-serif", fontSize: 16, fontWeight: 700, color: C.textDark, marginRight: 36 }}>
            내 실적
          </div>
        </nav>

        <div className="perf-c">
          {/* ══════════════════════════════════════════
              섹션 1 — 뱃지 현황
              ══════════════════════════════════════════ */}
          <section style={{ background: C.white, borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: "0 2px 12px rgba(74,99,85,0.07)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: C.textDark, fontFamily: "'Gothic A1', sans-serif", margin: 0 }}>
                내 뱃지
              </h2>
              <span style={{ fontSize: 13, color: C.sageMid, fontWeight: 600 }}>
                {earnedCount}/{BADGES.length}개 획득
              </span>
            </div>

            {/* 현재 뱃지 강조 카드 */}
            {currentBadge && (
              <div style={{
                padding: "14px 16px", borderRadius: 12,
                background: `linear-gradient(135deg, ${C.terraPale} 0%, ${C.white} 100%)`,
                border: `1px solid ${C.terraLight}`, marginBottom: 16,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 22 }}>{currentBadge.emoji}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: C.terraDark }}>
                    현재 뱃지: {currentBadge.name}
                  </span>
                </div>
                <div style={{ fontSize: 14, color: C.textMid, lineHeight: 1.5 }}>
                  다음 목표: {STATS.nextBadge}
                </div>
              </div>
            )}

            {/* 뱃지 목록 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {BADGES.map((b) => (
                <div
                  key={b.id}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 12,
                    padding: "14px 16px", borderRadius: 14,
                    background: C.white,
                    border: b.earned
                      ? `1px solid ${C.border}`
                      : `1px dashed ${C.borderDashed}`,
                    opacity: b.earned ? 1 : 0.4,
                  }}
                >
                  <div style={{ fontSize: 28, lineHeight: 1, flexShrink: 0, position: "relative" }}>
                    {b.emoji}
                    {!b.earned && (
                      <span
                        aria-hidden="true"
                        style={{
                          position: "absolute", bottom: -2, right: -4,
                          fontSize: 12,
                        }}
                      >🔒</span>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: C.textDark }}>{b.name}</span>
                      {b.earned && b.earnedAt && (
                        <span style={{ fontSize: 12, color: C.sageMid }}>{b.earnedAt} 획득</span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: C.textMid, lineHeight: 1.55 }}>
                      {b.description}
                    </div>
                    {!b.earned && b.remaining && (
                      <div style={{ fontSize: 13, color: C.terra, fontWeight: 600, marginTop: 4 }}>
                        {b.remaining}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ══════════════════════════════════════════
              섹션 2 — 상담 실적
              ══════════════════════════════════════════ */}
          <section style={{ background: C.white, borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: "0 2px 12px rgba(74,99,85,0.07)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: C.textDark, fontFamily: "'Gothic A1', sans-serif", margin: 0 }}>
                상담 실적
              </h2>
              <span style={{
                padding: "3px 10px", borderRadius: 100,
                fontSize: 12, fontWeight: 700,
                background: C.sagePale, color: C.sageDeep,
              }}>
                이번 달 {STATS.thisMonthDelta}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <StatBox label="총 상담" value={`${STATS.total}건`} />
              <StatBox label="완료" value={`${STATS.completed}건`} />
              <StatBox label="평균 답변 시간" value={STATS.avgTime} />
              <StatBox label="개선 확인" value={`${STATS.improved}건`} accent />
            </div>

            <div style={{ marginTop: 14, fontSize: 13, color: C.textMid, lineHeight: 1.6, padding: "10px 12px", background: C.sageBg, borderRadius: 10, border: `1px solid ${C.border}` }}>
              📊 지난달 대비 상담 수가 늘어나고 있어요. 꾸준히 환자분들과 소통하고 계시네요.
            </div>
          </section>

          {/* ══════════════════════════════════════════
              섹션 3 — 내 개선 사례
              ══════════════════════════════════════════ */}
          <section style={{ background: C.white, borderRadius: 16, padding: 20, boxShadow: "0 2px 12px rgba(74,99,85,0.07)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: C.textDark, fontFamily: "'Gothic A1', sans-serif", margin: 0 }}>
                내 개선 사례
              </h2>
              {cases.length > 0 && (
                <button
                  type="button"
                  onClick={() => router.push("/feed/new")}
                  style={{
                    padding: "8px 14px", borderRadius: 10,
                    fontSize: 14, fontWeight: 700,
                    background: C.sageDeep, color: C.white,
                    border: "none", cursor: "pointer",
                    fontFamily: "'Noto Sans KR', sans-serif",
                  }}
                >
                  + 새 사례 작성
                </button>
              )}
            </div>

            {cases.length === 0 ? (
              <div style={{
                padding: "28px 20px", borderRadius: 12,
                background: C.sageBg, border: `1px dashed ${C.sageLight}`,
                textAlign: "center",
              }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>✍️</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.textDark, marginBottom: 6 }}>
                  아직 작성한 개선 사례가 없어요
                </div>
                <div style={{ fontSize: 13, color: C.textMid, lineHeight: 1.6, marginBottom: 14 }}>
                  환자 상담에서 얻은 인사이트를 공유해보세요
                </div>
                <button
                  type="button"
                  onClick={() => router.push("/feed/new")}
                  style={{
                    padding: "10px 18px", borderRadius: 10,
                    fontSize: 14, fontWeight: 700,
                    background: C.sageDeep, color: C.white,
                    border: "none", cursor: "pointer",
                  }}
                >
                  첫 사례 작성하기
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {cases.map((c) => {
                  const isOpen = expandedCaseIds.has(c.id);
                  return (
                    <article
                      key={c.id}
                      style={{
                        background: C.white,
                        border: `1px solid ${C.border}`,
                        borderRadius: 16,
                        overflow: "hidden",
                        transition: "background 0.15s",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => toggleCase(c.id)}
                        style={{
                          width: "100%", textAlign: "left",
                          background: "none", border: "none",
                          padding: 16, cursor: "pointer",
                          display: "block",
                          fontFamily: "'Noto Sans KR', sans-serif",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 15, fontWeight: 700, color: C.textDark, marginBottom: 8, lineHeight: 1.45 }}>
                              {c.title}
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                              {c.tags.map((t) => (
                                <span key={t} style={{
                                  padding: "3px 10px", borderRadius: 100,
                                  fontSize: 12, fontWeight: 600,
                                  background: C.sagePale, color: C.sageDeep,
                                }}>
                                  {t}
                                </span>
                              ))}
                            </div>
                            <div style={{ fontSize: 13, color: C.textMid, display: "flex", alignItems: "center", gap: 8 }}>
                              <span>{c.writtenAt}</span>
                              <span style={{ color: C.sageLight }}>·</span>
                              <span>💚 {c.likes}</span>
                            </div>
                          </div>
                          <svg
                            width="20" height="20" viewBox="0 0 24 24" fill="none"
                            stroke={C.sageMid} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                            style={{
                              transition: "transform 0.2s",
                              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                              flexShrink: 0, marginTop: 2,
                            }}
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </div>
                      </button>

                      {isOpen && (
                        <div style={{
                          padding: "14px 16px 16px",
                          borderTop: `1px solid ${C.border}`,
                          background: C.sageBg,
                        }}>
                          {/* 상세 설명 */}
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: C.sageDeep, marginBottom: 6 }}>
                              상세 설명
                            </div>
                            <div style={{ fontSize: 14, color: C.textDark, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                              {c.description}
                            </div>
                          </div>

                          {/* 사용 영양제 */}
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: C.sageDeep, marginBottom: 6 }}>
                              사용 영양제
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {c.supplements.map((s) => (
                                <span key={s} style={{
                                  display: "inline-block",
                                  padding: "4px 10px", borderRadius: 8,
                                  fontSize: 13, fontWeight: 600,
                                  background: C.white, color: C.sageDeep,
                                  border: `1px solid ${C.sageLight}`,
                                }}>
                                  {s}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* 결과 */}
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: C.sageDeep, marginBottom: 6 }}>
                              결과
                            </div>
                            <div style={{
                              padding: "10px 12px", borderRadius: 10,
                              background: C.terraPale, border: `1px solid ${C.terraLight}`,
                              fontSize: 14, color: C.terraDark, fontWeight: 600, lineHeight: 1.55,
                            }}>
                              {c.outcome}
                            </div>
                          </div>

                          {/* 기간 + 액션 */}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                            <div style={{ fontSize: 13, color: C.textMid }}>
                              관찰 기간: <span style={{ color: C.textDark, fontWeight: 600 }}>{c.duration}</span>
                            </div>
                            <div style={{ display: "inline-flex", gap: 6 }}>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); router.push(`/feed/new?edit=${c.id}`); }}
                                style={{
                                  padding: "5px 12px", borderRadius: 8,
                                  fontSize: 13, fontWeight: 600,
                                  background: C.sagePale, color: C.sageMid,
                                  border: `1px solid ${C.sageLight}`, cursor: "pointer",
                                }}
                              >수정</button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setDeleteTargetId(c.id); }}
                                style={{
                                  padding: "5px 12px", borderRadius: 8,
                                  fontSize: 13, fontWeight: 600,
                                  background: C.white, color: C.error,
                                  border: `1px solid ${C.border}`, cursor: "pointer",
                                }}
                              >삭제</button>
                            </div>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* 삭제 확인 팝업 */}
      {deleteTargetId && (
        <div
          onClick={() => setDeleteTargetId(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: C.white, borderRadius: 16,
              padding: "24px 22px",
              maxWidth: 320, width: "100%",
              boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
              textAlign: "center",
              fontFamily: "'Noto Sans KR', sans-serif",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: C.textDark, marginBottom: 6 }}>
              이 사례를 삭제하시겠습니까?
            </div>
            <div style={{ fontSize: 13, color: C.textMid, lineHeight: 1.6, marginBottom: 16 }}>
              삭제된 사례는 복구할 수 없어요.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                style={{
                  flex: 1, padding: "11px 0", borderRadius: 10,
                  fontSize: 14, fontWeight: 600,
                  background: C.sageBg, color: C.textMid,
                  border: `1px solid ${C.border}`, cursor: "pointer",
                }}
              >취소</button>
              <button
                type="button"
                onClick={confirmDelete}
                style={{
                  flex: 1, padding: "11px 0", borderRadius: 10,
                  fontSize: 14, fontWeight: 700,
                  background: C.error, color: C.white,
                  border: "none", cursor: "pointer",
                }}
              >삭제</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function StatBox({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{
      padding: "14px 16px", borderRadius: 12,
      background: accent ? C.sagePale : C.sageBg,
      border: `1px solid ${accent ? C.sageLight : C.border}`,
    }}>
      <div style={{ fontSize: 13, color: C.textMid, marginBottom: 4 }}>{label}</div>
      <div style={{
        fontSize: 20, fontWeight: 800,
        color: accent ? C.sageDeep : C.textDark,
        fontFamily: "'Gothic A1', sans-serif",
      }}>
        {value}
      </div>
    </div>
  );
}

export default function PerformanceClient() {
  return (
    <Suspense>
      <Content />
    </Suspense>
  );
}
