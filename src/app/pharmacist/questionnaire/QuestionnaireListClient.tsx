"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import type { PharmacistQuestion } from "@/types/database";

/* ══════════════════════════════════════════
   컬러 (약사 페이지 공통 톤)
   ══════════════════════════════════════════ */
const C = {
  sageBg: "#F8F9F7", sagePale: "#EDF4F0", sageLight: "#B3CCBE",
  sageMid: "#5E7D6C", sageDeep: "#4A6355",
  terra: "#C06B45", terraDark: "#A35A39", terraLight: "#F5E6DC",
  textDark: "#2C3630", textMid: "#3D4A42",
  border: "rgba(94, 125, 108, 0.14)", white: "#fff", error: "#D4544C",
};

interface QSet {
  id: string;
  title: string;
  isDefault: boolean;
  questionCount: number;
  questions: PharmacistQuestion[]; // 복제용 원본 보관
}

export default function QuestionnaireListClient() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [sets, setSets] = useState<QSet[]>([]);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false); // 복제 중복 클릭 방지
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  /* write 빌더 캐스팅 — jsonb questions 등 타입 마찰 우회 */
  type Writer = {
    insert: (p: Record<string, unknown>) => Promise<{ error: Error | null }>;
    delete: () => { eq: (c: string, v: string) => Promise<{ error: Error | null }> };
  };
  const pqs = () => supabase.from("pharmacist_question_sets") as unknown as Writer;

  /* ── 목록 로드 ── */
  const loadSets = async (uid: string) => {
    const { data, error } = await supabase
      .from("pharmacist_question_sets")
      .select("id, title, is_default, questions, created_at")
      .eq("pharmacist_id", uid)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[question-list] load failed:", error);
      return [];
    }
    const rows = (data ?? []) as Record<string, unknown>[];
    return rows.map((r) => {
      const questions = Array.isArray(r.questions) ? (r.questions as PharmacistQuestion[]) : [];
      return {
        id: (r.id as string) ?? "",
        title: ((r.title as string) ?? "").trim(),
        isDefault: !!r.is_default,
        questionCount: questions.length,
        questions,
      };
    });
  };

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const next = await loadSets(user.id);
        if (!cancelled) setSets(next);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  /* ── 복제 ── */
  const duplicateSet = async (src: QSet) => {
    if (busy || !user) return;
    setBusy(true);
    const { error } = await pqs().insert({
      pharmacist_id: user.id,
      title: `${src.title} (복사본)`,
      is_default: false,
      questions: src.questions,
    });
    if (error) {
      console.error("[question-list] duplicate failed:", error);
      showToast("복제에 실패했어요");
    } else {
      const next = await loadSets(user.id);
      setSets(next);
      showToast("복제됐어요 ✓");
    }
    setBusy(false);
  };

  /* ── 삭제 ── */
  const confirmDelete = async () => {
    if (!deleteTargetId || deleting) return;
    setDeleting(true);
    const { error } = await pqs().delete().eq("id", deleteTargetId);
    setDeleting(false);
    if (error) {
      console.error("[question-list] delete failed:", error);
      showToast("삭제에 실패했어요");
      return;
    }
    setSets((prev) => prev.filter((s) => s.id !== deleteTargetId));
    setDeleteTargetId(null);
    showToast("삭제됐어요 ✓");
  };

  return (
    <>
      <style>{`
        .ql-page { min-height: 100dvh; background: ${C.sageBg}; padding-bottom: 40px; }
        .ql-page nav {
          position: sticky; top: 0; z-index: 50;
          padding: 0 24px; height: 60px;
          display: flex; align-items: center; gap: 8px;
          background: rgba(248,249,247,0.95);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid ${C.border};
        }
        .ql-c { max-width: 560px; margin: 0 auto; padding: 20px 16px; }
      `}</style>

      <div className="ql-page">
        <nav>
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="뒤로가기"
            style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: C.textDark, padding: 6, lineHeight: 1 }}
          >←</button>
          <div style={{ flex: 1, textAlign: "center", fontFamily: "'Gothic A1', sans-serif", fontSize: 16, fontWeight: 700, color: C.textDark, marginRight: 36 }}>
            맞춤 추가 문답
          </div>
        </nav>

        <div className="ql-c">
          {/* 헤더 + 새 세트 버튼 */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, gap: 8, flexWrap: "wrap" }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.textDark, fontFamily: "'Gothic A1', sans-serif" }}>
              내 문답 세트
            </div>
            <button
              type="button"
              onClick={() => router.push("/pharmacist/questionnaire/new")}
              style={{
                padding: "8px 14px", borderRadius: 10, fontSize: 14, fontWeight: 700,
                background: C.sageDeep, color: C.white, border: "none", cursor: "pointer",
              }}
            >
              + 새 세트 만들기
            </button>
          </div>
          <div style={{ fontSize: 14, color: C.textMid, lineHeight: 1.6, marginBottom: 16 }}>
            자주 묻는 문답을 세트로 만들어 환자에게 보낼 수 있어요. ★ 기본 세트는 매칭 수락 후 자동 전송돼요.
          </div>

          {loading ? (
            <div style={{ padding: "40px 20px", textAlign: "center", fontSize: 15, color: C.textMid }}>
              불러오는 중이에요…
            </div>
          ) : sets.length === 0 ? (
            <div style={{
              padding: "28px 20px", borderRadius: 12,
              background: C.sageBg, border: `1px dashed ${C.sageLight}`,
              textAlign: "center",
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.textDark, marginBottom: 4 }}>
                아직 만든 문답 세트가 없어요
              </div>
              <div style={{ fontSize: 14, color: C.textMid, lineHeight: 1.6, marginBottom: 14 }}>
                자주 묻는 문답을 세트로 만들어 환자에게 보낼 수 있어요
              </div>
              <button
                type="button"
                onClick={() => router.push("/pharmacist/questionnaire/new")}
                style={{
                  padding: "10px 18px", borderRadius: 10, fontSize: 14, fontWeight: 700,
                  background: C.sageDeep, color: C.white, border: "none", cursor: "pointer",
                }}
              >
                + 새 세트 만들기
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {sets.map((s) => (
                <div key={s.id} style={{
                  background: C.white, border: `1px solid ${C.border}`,
                  borderRadius: 16, padding: 16,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: C.textDark }}>{s.title || "(제목 없음)"}</span>
                    {s.isDefault && (
                      <span style={{
                        padding: "2px 8px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                        background: "#FFF8E1", color: "#F59E0B",
                        display: "inline-flex", alignItems: "center", gap: 3,
                      }}>
                        ★ 기본 세트
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 14, color: C.textMid, marginBottom: 12 }}>
                    문답 {s.questionCount}개
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => router.push(`/pharmacist/questionnaire/${s.id}`)}
                      style={{
                        padding: "6px 14px", borderRadius: 8, fontSize: 14, fontWeight: 600,
                        background: C.sagePale, color: C.sageMid,
                        border: `1px solid ${C.sageLight}`, cursor: "pointer",
                      }}
                    >수정</button>
                    <button
                      type="button"
                      onClick={() => duplicateSet(s)}
                      disabled={busy}
                      style={{
                        padding: "6px 14px", borderRadius: 8, fontSize: 14, fontWeight: 600,
                        background: C.white, color: C.sageMid,
                        border: `1px solid ${C.border}`, cursor: busy ? "default" : "pointer",
                        opacity: busy ? 0.6 : 1,
                      }}
                    >복제</button>
                    <button
                      type="button"
                      onClick={() => setDeleteTargetId(s.id)}
                      style={{
                        padding: "6px 14px", borderRadius: 8, fontSize: 14, fontWeight: 600,
                        background: C.white, color: C.error,
                        border: `1px solid ${C.border}`, cursor: "pointer",
                      }}
                    >삭제</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      {deleteTargetId && (
        <div
          onClick={() => !deleting && setDeleteTargetId(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 400,
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: C.white, borderRadius: 16,
              padding: "24px 22px", maxWidth: 320, width: "100%",
              boxShadow: "0 8px 32px rgba(0,0,0,0.15)", textAlign: "center",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: C.textDark, marginBottom: 6 }}>
              이 문답 세트를 삭제하시겠어요?
            </div>
            <div style={{ fontSize: 13, color: C.textMid, lineHeight: 1.6, marginBottom: 16 }}>
              삭제하면 되돌릴 수 없어요.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => !deleting && setDeleteTargetId(null)}
                style={{
                  flex: 1, padding: "11px 0", borderRadius: 10, fontSize: 14, fontWeight: 600,
                  background: C.sageBg, color: C.textMid, border: `1px solid ${C.border}`, cursor: "pointer",
                }}
              >취소</button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                style={{
                  flex: 1, padding: "11px 0", borderRadius: 10, fontSize: 14, fontWeight: 700,
                  background: C.error, color: C.white, border: "none",
                  cursor: deleting ? "default" : "pointer", opacity: deleting ? 0.6 : 1,
                }}
              >{deleting ? "삭제 중..." : "삭제"}</button>
            </div>
          </div>
        </div>
      )}

      {/* 토스트 — 화면 정중앙 */}
      {toast && (
        <div role="status" style={{
          position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          padding: "14px 24px", borderRadius: 12,
          background: C.sageDeep, color: C.white, fontSize: 15, fontWeight: 700,
          boxShadow: "0 8px 28px rgba(0,0,0,0.28)", zIndex: 1000, whiteSpace: "nowrap",
          fontFamily: "'Noto Sans KR', sans-serif",
        }}>
          {toast}
        </div>
      )}
    </>
  );
}
