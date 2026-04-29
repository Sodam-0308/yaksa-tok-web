"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

type AiQuestionnaireUpdate = Database["public"]["Tables"]["ai_questionnaires"]["Update"];
type ConsultationInsert = Database["public"]["Tables"]["consultations"]["Insert"];

const QUESTIONNAIRE_ID_KEY = "yaksa-tok-questionnaire-id";
const PENDING_MATCH_KEY = "yaksa-tok-pending-match";

interface PharmacistData {
  id: string;
  name: string;
  avatar: string;
  pharmacyName: string;
  location: string;
  distance: string;
  travelTime: string;
  matchLevel: 1 | 2 | 3;
  badge?: string;
  specialties: { label: string; variant: string; isMatch?: boolean }[];
  caseCount: number;
  avgResponseTime: string;
}

const MATCH_LEVEL_INFO: Record<1 | 2 | 3, { stars: string; label: string }> = {
  3: { stars: "✦✦✦", label: "전문 분야 매칭" },
  2: { stars: "✦✦", label: "상담 분야 매칭" },
  1: { stars: "✦", label: "기본 매칭" },
};

const MOCK_PHARMACISTS: PharmacistData[] = [
  {
    id: "kim-seoyeon",
    name: "김서연 약사",
    avatar: "👩‍⚕️",
    pharmacyName: "초록숲 약국",
    location: "서울 강남",
    distance: "1.2km",
    travelTime: "도보 16분",
    matchLevel: 3,
    badge: "TOP 매칭",
    specialties: [
      { label: "소화장애 전문", variant: "match", isMatch: true },
      { label: "만성피로 전문", variant: "match", isMatch: true },
      { label: "수면 관리", variant: "l" },
    ],
    caseCount: 24,
    avgResponseTime: "2시간",
  },
  {
    id: "park-junho",
    name: "박준호 약사",
    avatar: "👨‍⚕️",
    pharmacyName: "자연담은 약국",
    location: "서울 서초",
    distance: "2.8km",
    travelTime: "차로 8분",
    matchLevel: 2,
    specialties: [
      { label: "불면·수면 전문", variant: "match", isMatch: true },
      { label: "소화 관리", variant: "s" },
      { label: "면역·염증", variant: "b" },
    ],
    caseCount: 18,
    avgResponseTime: "4시간",
  },
  {
    id: "lee-haeun",
    name: "이하은 약사",
    avatar: "👩‍⚕️",
    pharmacyName: "봄빛 약국",
    location: "서울 강남",
    distance: "4.1km",
    travelTime: "차로 12분",
    matchLevel: 1,
    specialties: [
      { label: "피로·에너지 전문", variant: "match", isMatch: true },
      { label: "피부 관리", variant: "r" },
      { label: "소화 관리", variant: "s" },
    ],
    caseCount: 31,
    avgResponseTime: "1시간",
  },
];

type SortKey = "match" | "distance" | "cases";
type TabView = "list" | "map";

export default function MatchClient() {
  return (
    <Suspense>
      <MatchContent />
    </Suspense>
  );
}

function MatchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const alreadyLoaded = (() => {
    try { return sessionStorage.getItem("yaksa-tok-match-loaded") === "1"; } catch { return false; }
  })();
  const [loading, setLoading] = useState(!alreadyLoaded);
  const [tab, setTab] = useState<TabView>("list");
  const [sortBy, setSortBy] = useState<SortKey>("match");
  const [requestedNames, setRequestedNames] = useState<Set<string>>(new Set());
  const [requestingNames, setRequestingNames] = useState<Set<string>>(new Set());
  const [requestToast, setRequestToast] = useState<string | null>(null);

  /* ── DB 약사 로드 (있으면 DB, 없으면 Mock 폴백) ── */
  interface DbPharmRow {
    id: string;
    pharmacy_name: string | null;
    address: string | null;
    expert_specialties: string[] | null;
    available_specialties: string[] | null;
    total_consultations: number | null;
    avg_response_minutes: number | null;
    is_active: boolean | null;
    profile: { id: string; name: string; avatar_url: string | null; role: string } | null;
  }
  const [dbPharms, setDbPharms] = useState<PharmacistData[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    // 사용자가 선택한 증상(URL ?symptom=) 추출
    const targetSymptoms = (() => {
      const s = searchParams.get("symptom");
      return s ? s.split(",").map((v) => v.trim()).filter(Boolean) : [];
    })();

    (async () => {
      const { data, error } = await supabase
        .from("pharmacist_profiles")
        .select(
          `
          id, pharmacy_name, address, expert_specialties, available_specialties,
          total_consultations, avg_response_minutes, is_active,
          profile:profiles!pharmacist_profiles_id_fkey(id, name, avatar_url, role)
        `,
        )
        .eq("is_active", true);
      if (cancelled) return;
      if (error) {
        console.error("[match] pharmacist_profiles load failed:", error);
        setDbPharms([]);
        return;
      }
      const rows = (data ?? []) as unknown as DbPharmRow[];
      const list: PharmacistData[] = rows
        .filter((r) => r.profile && r.profile.role === "pharmacist")
        .map((r) => {
          const expert = r.expert_specialties ?? [];
          const available = r.available_specialties ?? [];
          const matchedExpert = targetSymptoms.filter((s) =>
            expert.some((e) => e.includes(s) || s.includes(e)),
          );
          const matchedAvail = targetSymptoms.filter((s) =>
            available.some((a) => a.includes(s) || s.includes(a)),
          );
          const matchLevel: 1 | 2 | 3 =
            matchedExpert.length > 0 ? 3 : matchedAvail.length > 0 ? 2 : 1;
          const specialtyTags: PharmacistData["specialties"] = [
            ...expert.slice(0, 2).map((label) => ({
              label: matchedExpert.some((m) => label.includes(m) || m.includes(label))
                ? `${label} 전문`
                : label,
              variant: "match",
              isMatch: matchedExpert.some((m) => label.includes(m) || m.includes(label)),
            })),
            ...available.slice(0, 1).map((label) => ({ label, variant: "s" as const })),
          ];
          const avgMin = r.avg_response_minutes;
          const avgResponseTime =
            avgMin == null
              ? "—"
              : avgMin < 60
                ? `${avgMin}분`
                : `${Math.round(avgMin / 60)}시간`;
          // 주소에서 시·구 추출 (예: "서울특별시 강남구 ..." → "서울 강남")
          const addrParts = (r.address ?? "").trim().split(/\s+/);
          const location = addrParts.length >= 2
            ? `${addrParts[0].replace(/(특별시|광역시|특별자치시|특별자치도)$/, "")} ${addrParts[1].replace(/(시|군|구)$/, "")}`
            : (r.address ?? "");
          return {
            id: r.id,
            name: r.profile?.name ? `${r.profile.name} 약사` : "약사",
            avatar: "👩‍⚕️",
            pharmacyName: r.pharmacy_name ?? "",
            location,
            distance: "—",
            travelTime: "—",
            matchLevel,
            specialties: specialtyTags.length > 0 ? specialtyTags : [{ label: "건강 상담", variant: "s" }],
            caseCount: r.total_consultations ?? 0,
            avgResponseTime,
          } satisfies PharmacistData;
        });
      console.log("[match] DB pharmacists loaded:", list.length);
      setDbPharms(list);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // DB에 1명이라도 있으면 DB, 아니면 Mock 폴백
  const effectivePharmacists: PharmacistData[] =
    dbPharms !== null && dbPharms.length > 0 ? dbPharms : MOCK_PHARMACISTS;

  const symptoms = useMemo(() => {
    const s = searchParams.get("symptom");
    return s ? s.split(",").map((v) => v.trim()) : ["만성피로", "소화장애", "불면"];
  }, [searchParams]);

  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => {
      setLoading(false);
      try { sessionStorage.setItem("yaksa-tok-match-loaded", "1"); } catch {}
    }, 2000);
    return () => clearTimeout(timer);
  }, [loading]);

  /* ── 비로그인으로 작성한 문답이 있으면 현재 user 에 연결 ── */
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined") return;

    const orphanId = sessionStorage.getItem(QUESTIONNAIRE_ID_KEY);
    if (!orphanId) return;

    (async () => {
      try {
        const update: AiQuestionnaireUpdate = { patient_id: user.id };
        const { error } = await (supabase
          .from("ai_questionnaires") as unknown as {
            update: (p: AiQuestionnaireUpdate) => {
              eq: (col: string, val: string) => {
                is: (col: string, val: null) => Promise<{ error: Error | null }>;
              };
            };
          })
          .update(update)
          .eq("id", orphanId)
          .is("patient_id", null);
        if (error) {
          console.error("[match] questionnaire link failed:", error);
          return;
        }
        sessionStorage.removeItem(QUESTIONNAIRE_ID_KEY);
        sessionStorage.removeItem(PENDING_MATCH_KEY);
      } catch (err) {
        console.error("[match] questionnaire link threw:", err);
      }
    })();
  }, [user]);

  const sorted = useMemo(() => {
    const list = [...effectivePharmacists];
    if (sortBy === "match")
      list.sort((a, b) => b.matchLevel - a.matchLevel);
    else if (sortBy === "distance")
      list.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
    else if (sortBy === "cases")
      list.sort((a, b) => b.caseCount - a.caseCount);
    return list;
  }, [effectivePharmacists, sortBy]);

  const PHARM_UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const handleRequestConsult = async (
    pharmacist: PharmacistData,
    e: React.MouseEvent,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const pharmacistName = pharmacist.name;

    if (!user) {
      setRequestToast("로그인이 필요해요.");
      router.push("/signup");
      return;
    }
    if (requestingNames.has(pharmacistName) || requestedNames.has(pharmacistName)) {
      return;
    }

    setRequestingNames((prev) => new Set(prev).add(pharmacistName));

    const questionnaireId =
      typeof window !== "undefined"
        ? sessionStorage.getItem(QUESTIONNAIRE_ID_KEY)
        : null;

    // 실제 DB 약사면 UUID 그대로 사용. Mock 약사면 pharmacist_id는 null.
    const realPharmacistId = PHARM_UUID_RE.test(pharmacist.id) ? pharmacist.id : null;

    const payload: ConsultationInsert = {
      patient_id: user.id,
      pharmacist_id: realPharmacistId,
      questionnaire_id: questionnaireId,
      consultation_type: "local",
      status: "pending",
      matching_source: "ai_questionnaire",
    };

    console.log("[match] consultations insert payload:", payload);

    try {
      const { data, error } = await (supabase
        .from("consultations") as unknown as {
          insert: (p: ConsultationInsert) => {
            select: (cols: string) => {
              maybeSingle: () => Promise<{
                data: { id: string } | null;
                error: { message: string; code?: string; details?: string; hint?: string } | null;
              }>;
            };
          };
        })
        .insert(payload)
        .select("id")
        .maybeSingle();

      if (error) {
        console.error("[match] consultation create FAILED:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        setRequestToast("상담 요청을 보내지 못했어요. 잠시 후 다시 시도해주세요.");
        setRequestingNames((prev) => {
          const next = new Set(prev);
          next.delete(pharmacistName);
          return next;
        });
        setTimeout(() => setRequestToast(null), 2500);
        return;
      }

      console.log("[match] consultation created — id:", data?.id);
      setRequestedNames((prev) => new Set(prev).add(pharmacistName));
      setRequestingNames((prev) => {
        const next = new Set(prev);
        next.delete(pharmacistName);
        return next;
      });
      setRequestToast(`${pharmacistName}에게 상담 요청을 보냈어요!`);
      setTimeout(() => setRequestToast(null), 2500);
    } catch (err) {
      console.error("[match] consultation create threw:", err);
      setRequestingNames((prev) => {
        const next = new Set(prev);
        next.delete(pharmacistName);
        return next;
      });
      setRequestToast("상담 요청을 보내지 못했어요.");
      setTimeout(() => setRequestToast(null), 2500);
    }
  };

  return (
    <div className="match-page" style={{ paddingBottom: 80 }}>
      <nav>
        <button className="nav-back" onClick={() => router.push("/questionnaire")} aria-label="뒤로가기">
          ←
        </button>
        <div className="nav-title">근처 약사 찾기</div>
      </nav>

      <div className="match-container">
        {/* Summary Card */}
        <div className="summary-card">
          <div className="summary-label">내 증상 분석 결과</div>
          <div className="summary-symptoms">
            {symptoms.map((s) => (
              <span key={s} className="summary-tag">{s}</span>
            ))}
          </div>
          <div className="summary-meta">
            <span><span className="meta-dot" /> 증상 기간 6개월 이상</span>
            <span><span className="meta-dot" /> 불편도 7/10</span>
          </div>
        </div>
        <Link href="/questionnaire?from=start" className="edit-answers-link">
          답변 수정하기 →
        </Link>

        {/* Loading */}
        {loading && (
          <div className="loading-state">
            <div className="loading-dots">
              <div className="loading-dot" />
              <div className="loading-dot" />
              <div className="loading-dot" />
            </div>
            <div className="loading-text">내 증상에 맞는 근처 약사를 찾고 있어요...</div>
          </div>
        )}

        {/* Results */}
        {!loading && (
          <>
            {/* Tab */}
            <div className="tab-bar">
              <button
                className={`tab${tab === "list" ? " active" : ""}`}
                onClick={() => setTab("list")}
              >
                📋 목록
              </button>
              <button
                className={`tab${tab === "map" ? " active" : ""}`}
                onClick={() => setTab("map")}
              >
                🗺️ 지도
              </button>
            </div>

            {tab === "list" && (
              <>
                {/* Sort Row */}
                <div className="sort-row">
                  <div className="sort-count">
                    근처 약사 <strong>{MOCK_PHARMACISTS.length}</strong>명
                  </div>
                  <select
                    className="sort-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortKey)}
                  >
                    <option value="match">매칭 등급순</option>
                    <option value="distance">거리순</option>
                    <option value="cases">개선 사례순</option>
                  </select>
                </div>

                <div className="match-insight-banner">
                  내 체질과 생활습관에 맞는 약사를 매칭했어요.<br />
                  남들이 좋다는 영양제가 나한테도 좋은 건 아니니까요.
                </div>

                <div className="card-hint">
                  약사 카드를 누르면 상세 프로필을 볼 수 있어요
                </div>

                {/* Pharmacist List */}
                <div className="match-pharm-list">
                  {sorted.map((p) => (
                    <Link
                      key={p.id}
                      href={`/pharmacist/${p.id}`}
                      className="match-pharm-card"
                    >
                      <div className="match-pharm-top">
                        <div className="match-pharm-avatar">{p.avatar}</div>
                        <div className="match-pharm-info">
                          <div className="match-pharm-name-row">
                            <span className="match-pharm-name">{p.name}</span>
                            {p.badge && (
                              <span className="match-pharm-badge">{p.badge}</span>
                            )}
                          </div>
                          <div className="match-pharm-pharmacy">
                            {p.pharmacyName} · {p.location}
                          </div>
                          <span className="match-pharm-distance">
                            📍 {p.distance}
                          </span>
                        </div>
                      </div>

                      {/* Match Level Stars */}
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 12px",
                        backgroundColor: "var(--terra-pale, #FBF5F1)",
                        borderRadius: 8,
                        marginBottom: 4,
                      }}>
                        <span style={{
                          color: "#C06B45",
                          fontSize: 16,
                          fontWeight: 700,
                          letterSpacing: 2,
                        }}>
                          {MATCH_LEVEL_INFO[p.matchLevel].stars}
                        </span>
                        <span style={{
                          color: "var(--text-dark, #2C3630)",
                          fontSize: 14,
                          fontWeight: 600,
                        }}>
                          {MATCH_LEVEL_INFO[p.matchLevel].label}
                        </span>
                      </div>

                      {/* Quick Stats */}
                      <div style={{
                        display: "flex",
                        gap: 8,
                        marginBottom: 4,
                      }}>
                        <div style={{
                          flex: 1,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "10px 12px",
                          backgroundColor: "var(--sage-pale, #EDF4F0)",
                          borderRadius: 8,
                        }}>
                          <span style={{ fontSize: 18 }}>⚡</span>
                          <span style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: "var(--text-dark, #2C3630)",
                          }}>{p.avgResponseTime} 내 답변</span>
                        </div>
                        <div style={{
                          flex: 1,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "10px 12px",
                          backgroundColor: "var(--sage-pale, #EDF4F0)",
                          borderRadius: 8,
                        }}>
                          <span style={{ fontSize: 18 }}>⭐</span>
                          <span style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: "var(--text-dark, #2C3630)",
                          }}>개선 {p.caseCount}건</span>
                        </div>
                        <div style={{
                          flex: 1,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "10px 12px",
                          backgroundColor: "var(--sage-pale, #EDF4F0)",
                          borderRadius: 8,
                        }}>
                          <span style={{ fontSize: 18 }}>🏥</span>
                          <span style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: "var(--text-dark, #2C3630)",
                          }}>{p.travelTime}</span>
                        </div>
                      </div>

                      {/* Tags — 전문 분야 / 상담 가능 분리 */}
                      {(() => {
                        const expert = p.specialties.filter((s) => s.isMatch);
                        const consult = p.specialties.filter((s) => !s.isMatch);
                        return (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {expert.length > 0 && (
                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                <span style={{
                                  fontSize: 13,
                                  fontWeight: 700,
                                  color: "var(--terra, #C06B45)",
                                  whiteSpace: "nowrap",
                                }}>전문 분야</span>
                                {expert.map((s) => (
                                  <span
                                    key={s.label}
                                    className={`p-tag p-tag-${s.variant}`}
                                  >
                                    ✦ {s.label}
                                  </span>
                                ))}
                              </div>
                            )}
                            {consult.length > 0 && (
                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                <span style={{
                                  fontSize: 13,
                                  fontWeight: 700,
                                  color: "var(--sage-mid, #5E7D6C)",
                                  whiteSpace: "nowrap",
                                }}>상담 가능</span>
                                {consult.map((s) => (
                                  <span
                                    key={s.label}
                                    className={`p-tag p-tag-${s.variant}`}
                                  >
                                    {s.label}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Bottom */}
                      <div className="match-pharm-bottom">
                        <div />
                        <button
                          className="match-pharm-action"
                          onClick={(e) => handleRequestConsult(p, e)}
                          disabled={requestedNames.has(p.name) || requestingNames.has(p.name)}
                        >
                          {requestedNames.has(p.name)
                            ? "요청 완료 ✓"
                            : requestingNames.has(p.name)
                              ? "요청 중..."
                              : "상담 요청"}
                        </button>
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            )}

            {tab === "map" && (
              <div className="map-placeholder">
                <div className="map-icon">🗺️</div>
                <div>카카오맵 연동 후 표시됩니다</div>
                <div style={{ fontSize: "13px", color: "#3D4A42" }}>
                  지도에서 약사 위치를 확인할 수 있어요
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom Info */}
      <div className="match-bottom-info" style={{ position: "static" }}>
        <div className="bottom-info-text">
          상담 요청은 <strong>무료</strong>예요. 약사가 수락하면 채팅이 시작돼요.
        </div>
      </div>

      {/* 상담 요청 토스트 */}
      {requestToast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            bottom: 80,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#2C3630",
            color: "#fff",
            padding: "12px 20px",
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 600,
            boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
            zIndex: 300,
            maxWidth: "calc(100vw - 32px)",
            textAlign: "center",
          }}
        >
          {requestToast}
        </div>
      )}
    </div>
  );
}
