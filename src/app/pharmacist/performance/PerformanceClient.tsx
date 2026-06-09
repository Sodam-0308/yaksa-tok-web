"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

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

/* avg_response_minutes → 사람이 읽는 형식 (60→"약 1시간", 90→"약 1시간 30분") */
function formatAvgResponse(min: number): string {
  if (min < 60) return `약 ${min}분`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `약 ${h}시간` : `약 ${h}시간 ${m}분`;
}

/* 카테고리 키 → 한글 라벨 (피드와 동일) */
const CATEGORY_LABELS: Record<string, string> = {
  digestion: "소화·장", sleep: "수면·마음", fatigue: "피로·기력",
  skin: "피부", pain: "통증·염증", women: "여성건강",
  circulation: "체중관리·순환", growth: "소아·성장", etc: "기타",
};

/* created_at → yy.mm.dd (빈/잘못된 값은 "") */
function formatYmd(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}.${mm}.${dd}`;
}

/* case_studies + pharmacist_stories 통합 모델 */
type PostKind = "case" | "story";
interface MyPost {
  id: string;
  kind: PostKind;
  title: string;
  tags: string[];
  likes: number;
  createdAt: string;        // 정렬용 원본 ISO
  writtenAt: string;        // 표시용 yy.mm.dd
  subjectRelation: string;  // story 전용 (본인/가족 구분 표시)
}

/* 종류 배지 라벨 */
function kindLabel(p: MyPost): string {
  if (p.kind === "case") return "환자 사례";
  const rel = (p.subjectRelation || "").trim();
  if (rel === "self" || rel.includes("본인") || rel.includes("내")) return "내 경험";
  if (rel === "family" || rel.includes("가족")) return "가족 사례";
  return "내 경험·가족";
}

const PER_PAGE = 10;

/* ══════════════════════════════════════════
   메인
   ══════════════════════════════════════════ */

function Content() {
  const router = useRouter();
  const { user } = useAuth();
  const [posts, setPosts] = useState<MyPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; kind: PostKind } | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* ── 관리 화면 — 필터/검색/페이지 ── */
  const [kindFilter, setKindFilter] = useState<"all" | PostKind>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  /* ── 상담 실적 (실데이터) ── */
  const [statsLoading, setStatsLoading] = useState(true);
  const [totalConsultations, setTotalConsultations] = useState<number | null>(null);
  const [avgResponseMinutes, setAvgResponseMinutes] = useState<number | null>(null);
  const [improvementCount, setImprovementCount] = useState<number | null>(null);

  /* tags 정규화 — categories(한글) 우선, 없으면 symptoms */
  const tagsFromRow = (row: Record<string, unknown>): string[] => {
    const categories = Array.isArray(row.categories) ? (row.categories as string[]) : [];
    const symptoms = Array.isArray(row.symptoms) ? (row.symptoms as string[]) : [];
    return categories.length > 0 ? categories.map((k) => CATEGORY_LABELS[k] ?? k) : symptoms;
  };

  useEffect(() => {
    if (!user) { setStatsLoading(false); setPostsLoading(false); return; }
    let cancelled = false;
    setStatsLoading(true);
    setPostsLoading(true);
    (async () => {
      try {
        const [ppRes, impRes, csRes, psRes] = await Promise.all([
          supabase
            .from("pharmacist_profiles")
            .select("total_consultations, avg_response_minutes")
            .eq("id", user.id)
            .maybeSingle<{ total_consultations: number | null; avg_response_minutes: number | null }>(),
          supabase
            .from("improvement_confirmations")
            .select("id", { count: "exact", head: true })
            .eq("pharmacist_id", user.id),
          supabase
            .from("case_studies")
            .select("*")
            .eq("pharmacist_id", user.id)
            .eq("is_published", true)
            .order("created_at", { ascending: false }),
          supabase
            .from("pharmacist_stories")
            .select("*")
            .eq("pharmacist_id", user.id)
            .eq("is_published", true)
            .order("created_at", { ascending: false }),
        ]);
        if (cancelled) return;
        setTotalConsultations(ppRes.data?.total_consultations ?? 0);
        setAvgResponseMinutes(ppRes.data?.avg_response_minutes ?? null);
        setImprovementCount(impRes.error ? 0 : (impRes.count ?? 0));

        const caseRows = (csRes.data ?? []) as Record<string, unknown>[];
        const storyRows = (psRes.data ?? []) as Record<string, unknown>[];
        const casePosts: MyPost[] = caseRows.map((row) => {
          const createdAt = (row.created_at as string) ?? "";
          return {
            id: (row.id as string) ?? "",
            kind: "case",
            title: ((row.title as string) ?? "").trim(),
            tags: tagsFromRow(row),
            likes: (row.likes_count as number) ?? 0,
            createdAt,
            writtenAt: formatYmd(createdAt),
            subjectRelation: "",
          };
        });
        const storyPosts: MyPost[] = storyRows.map((row) => {
          const createdAt = (row.created_at as string) ?? "";
          return {
            id: (row.id as string) ?? "",
            kind: "story",
            title: ((row.title as string) ?? "").trim(),
            tags: tagsFromRow(row),
            likes: (row.likes_count as number) ?? 0,
            createdAt,
            writtenAt: formatYmd(createdAt),
            subjectRelation: ((row.subject_relation as string) ?? "").trim(),
          };
        });
        const merged = [...casePosts, ...storyPosts].sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt)
        );
        setPosts(merged);
      } finally {
        if (!cancelled) { setStatsLoading(false); setPostsLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  /* 필터·검색 변경 시 1페이지로 리셋 */
  useEffect(() => { setPage(0); }, [kindFilter, search]);

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    const table = deleteTarget.kind === "case" ? "case_studies" : "pharmacist_stories";
    const { error } = await supabase.from(table).delete().eq("id", deleteTarget.id);
    setDeleting(false);
    if (error) {
      console.error(`[performance] ${table} delete failed:`, error);
      alert("삭제에 실패했어요. 권한 또는 네트워크 문제일 수 있어요. 잠시 후 다시 시도해주세요.");
      return;
    }
    setPosts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  /* 필터 + 검색 + 페이지네이션 (클라) */
  const q = search.trim().toLowerCase();
  const filtered = posts.filter((p) =>
    (kindFilter === "all" || p.kind === kindFilter) &&
    (q === "" || p.title.toLowerCase().includes(q))
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const pageClamped = Math.min(page, totalPages - 1);
  const pageItems = filtered.slice(pageClamped * PER_PAGE, pageClamped * PER_PAGE + PER_PAGE);

  const editPath = (p: MyPost) =>
    p.kind === "case" ? `/feed/new?edit=${p.id}` : `/feed/recommend?edit=${p.id}`;

  const KIND_CHIPS: { key: "all" | PostKind; label: string }[] = [
    { key: "all", label: "전체" },
    { key: "case", label: "환자 사례" },
    { key: "story", label: "내 경험·가족" },
  ];

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
              섹션 2 — 상담 실적
              ══════════════════════════════════════════ */}
          <section style={{ background: C.white, borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: "0 2px 12px rgba(74,99,85,0.07)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: C.textDark, fontFamily: "'Gothic A1', sans-serif", margin: 0 }}>
                상담 실적
              </h2>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <StatBox label="총 상담" value={statsLoading ? "—" : `${totalConsultations ?? 0}건`} />
              <StatBox
                label="평균 답변 시간"
                value={statsLoading ? "—" : (avgResponseMinutes != null ? formatAvgResponse(avgResponseMinutes) : "—")}
              />
              <StatBox
                label="개선 확인"
                value={statsLoading ? "—" : (improvementCount != null ? `${improvementCount}건` : "—")}
                accent
              />
            </div>
          </section>

          {/* ══════════════════════════════════════════
              섹션 3 — 내 개선 사례
              ══════════════════════════════════════════ */}
          <section style={{ background: C.white, borderRadius: 16, padding: 20, boxShadow: "0 2px 12px rgba(74,99,85,0.07)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: C.textDark, fontFamily: "'Gothic A1', sans-serif", margin: 0 }}>
                내 사례·이야기
              </h2>
              {posts.length > 0 && (
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

            <div style={{ fontSize: 13, color: C.sageMid, lineHeight: 1.5, marginBottom: 14 }}>
              여기서 작성한 사례는 피드(개선 경험)에도 공개돼요.
            </div>

            {/* 종류 필터 칩 */}
            <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              {KIND_CHIPS.map((chip) => {
                const active = kindFilter === chip.key;
                return (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => setKindFilter(chip.key)}
                    style={{
                      padding: "7px 14px", borderRadius: 100,
                      fontSize: 14, fontWeight: 600,
                      border: `1px solid ${active ? C.sageDeep : C.border}`,
                      background: active ? C.sageDeep : C.white,
                      color: active ? C.white : C.textMid,
                      cursor: "pointer",
                    }}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>

            {/* 검색 */}
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="제목으로 검색"
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 10,
                border: `1.5px solid ${C.border}`, fontSize: 14, color: C.textDark,
                background: C.white, outline: "none", marginBottom: 14,
                fontFamily: "'Noto Sans KR', sans-serif",
              }}
            />

            {postsLoading ? (
              <div style={{ padding: "28px 20px", textAlign: "center", fontSize: 14, color: C.textMid }}>
                불러오는 중이에요…
              </div>
            ) : posts.length === 0 ? (
              <div style={{
                padding: "28px 20px", borderRadius: 12,
                background: C.sageBg, border: `1px dashed ${C.sageLight}`,
                textAlign: "center",
              }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>✍️</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.textDark, marginBottom: 6 }}>
                  아직 등록한 사례가 없어요
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
            ) : filtered.length === 0 ? (
              <div style={{
                padding: "28px 20px", borderRadius: 12,
                background: C.sageBg, border: `1px dashed ${C.sageLight}`,
                textAlign: "center", fontSize: 14, color: C.textMid,
              }}>
                조건에 맞는 사례가 없어요
              </div>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {pageItems.map((p) => (
                    <div
                      key={`${p.kind}-${p.id}`}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "12px 14px", borderRadius: 12,
                        background: C.white, border: `1px solid ${C.border}`,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                          <span style={{
                            flexShrink: 0,
                            padding: "2px 8px", borderRadius: 6,
                            fontSize: 12, fontWeight: 700,
                            background: p.kind === "case" ? C.sagePale : C.terraLight,
                            color: p.kind === "case" ? C.sageDeep : C.terraDark,
                          }}>
                            {kindLabel(p)}
                          </span>
                          <button
                            type="button"
                            onClick={() => router.push(editPath(p))}
                            style={{
                              flex: 1, minWidth: 0, textAlign: "left",
                              background: "none", border: "none", padding: 0, cursor: "pointer",
                              fontSize: 15, fontWeight: 600, color: C.textDark,
                              fontFamily: "'Noto Sans KR', sans-serif",
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }}
                          >
                            {p.title || "(제목 없음)"}
                          </button>
                        </div>
                        <div style={{ fontSize: 13, color: C.textMid, display: "flex", alignItems: "center", gap: 8 }}>
                          <span>{p.writtenAt}</span>
                          <span style={{ color: C.sageLight }}>·</span>
                          <span>💚 {p.likes}</span>
                        </div>
                      </div>
                      <div style={{ display: "inline-flex", gap: 6, flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => router.push(editPath(p))}
                          style={{
                            padding: "5px 12px", borderRadius: 8,
                            fontSize: 13, fontWeight: 600,
                            background: C.sagePale, color: C.sageMid,
                            border: `1px solid ${C.sageLight}`, cursor: "pointer",
                          }}
                        >수정</button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget({ id: p.id, kind: p.kind })}
                          style={{
                            padding: "5px 12px", borderRadius: 8,
                            fontSize: 13, fontWeight: 600,
                            background: C.white, color: C.error,
                            border: `1px solid ${C.border}`, cursor: "pointer",
                          }}
                        >삭제</button>
                      </div>
                    </div>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12 }}>
                    <button
                      type="button"
                      onClick={() => setPage((pg) => Math.max(pg - 1, 0))}
                      disabled={pageClamped === 0}
                      aria-label="이전 페이지"
                      style={{
                        background: "none", border: "none", padding: "6px 18px",
                        fontSize: 26, lineHeight: 1,
                        color: pageClamped === 0 ? C.sageLight : C.sageMid,
                        cursor: pageClamped === 0 ? "default" : "pointer",
                      }}
                    >‹</button>
                    <span style={{ fontSize: 14, color: C.textMid, fontFamily: "'Noto Sans KR', sans-serif" }}>
                      {pageClamped + 1} / {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage((pg) => Math.min(pg + 1, totalPages - 1))}
                      disabled={pageClamped >= totalPages - 1}
                      aria-label="다음 페이지"
                      style={{
                        background: "none", border: "none", padding: "6px 18px",
                        fontSize: 26, lineHeight: 1,
                        color: pageClamped >= totalPages - 1 ? C.sageLight : C.sageMid,
                        cursor: pageClamped >= totalPages - 1 ? "default" : "pointer",
                      }}
                    >›</button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>

      {/* 삭제 확인 팝업 */}
      {deleteTarget && (
        <div
          onClick={() => !deleting && setDeleteTarget(null)}
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
              이 글을 삭제하시겠습니까?
            </div>
            <div style={{ fontSize: 13, color: C.textMid, lineHeight: 1.6, marginBottom: 16 }}>
              삭제된 글은 되돌릴 수 없어요.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => !deleting && setDeleteTarget(null)}
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
                disabled={deleting}
                style={{
                  flex: 1, padding: "11px 0", borderRadius: 10,
                  fontSize: 14, fontWeight: 700,
                  background: C.error, color: C.white,
                  border: "none", cursor: deleting ? "not-allowed" : "pointer",
                  opacity: deleting ? 0.6 : 1,
                }}
              >{deleting ? "삭제 중..." : "삭제"}</button>
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
