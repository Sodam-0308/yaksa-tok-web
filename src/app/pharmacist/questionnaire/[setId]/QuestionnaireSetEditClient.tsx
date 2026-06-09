"use client";

import { useState, useEffect, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import type { PharmacistQuestion } from "@/types/database";

/* ══════════════════════════════════════════
   타입 & Mock
   ══════════════════════════════════════════ */

type QuestionType = "객관식" | "주관식" | "다중 선택";

interface Question {
  id: string;
  text: string;
  type: QuestionType;
  choices: string[];
}

interface QuestionSet {
  id: string;
  name: string;
  isDefault: boolean;
  questions: Question[];
}

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
  terraPale: "#FBF5F1",
  textDark: "#2C3630",
  textMid: "#3D4A42",
  border: "rgba(94, 125, 108, 0.14)",
  white: "#fff",
  error: "#D4544C",
};

const TYPE_BADGE: Record<QuestionType, { bg: string; color: string }> = {
  "객관식": { bg: "#EDF4F0", color: "#4A6355" },
  "주관식": { bg: "#FBF5F1", color: "#C06B45" },
  "다중 선택": { bg: "#EEEDFE", color: "#534AB7" },
};

/* ══════════════════════════════════════════
   메인
   ══════════════════════════════════════════ */

function Content() {
  const router = useRouter();
  const params = useParams();
  const setId = (params?.setId as string) ?? "new";
  const isNew = setId === "new";

  const { user } = useAuth();
  const [loading, setLoading] = useState(!isNew);
  const [notFound, setNotFound] = useState(false);
  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [original, setOriginal] = useState<{ name: string; isDefault: boolean; questions: Question[] } | null>(null);
  const [savingSet, setSavingSet] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  /* ── 로드 ── */
  useEffect(() => {
    if (isNew) {
      setOriginal({ name: "", isDefault: false, questions: [] });
      setLoading(false);
      return;
    }
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from("pharmacist_question_sets")
          .select("title, is_default, questions, pharmacist_id")
          .eq("id", setId)
          .maybeSingle<{ title: string | null; is_default: boolean | null; questions: PharmacistQuestion[] | null; pharmacist_id: string }>();
        if (cancelled) return;
        if (error || !data || data.pharmacist_id !== user.id) { setNotFound(true); return; }
        const loadedName = data.title ?? "";
        const loadedDefault = !!data.is_default;
        const rawQs = Array.isArray(data.questions) ? data.questions : [];
        // DB엔 질문 id 없음 → 화면용 보조 id를 인덱스로 부여
        const loadedQs: Question[] = rawQs.map((q, i) => ({
          id: `q-${i}`,
          text: String(q?.text ?? ""),
          type: (["객관식", "주관식", "다중 선택"].includes(q?.type as string) ? q.type : "객관식") as QuestionType,
          choices: Array.isArray(q?.choices) ? q.choices.map(String) : [],
        }));
        setName(loadedName);
        setIsDefault(loadedDefault);
        setQuestions(loadedQs);
        setOriginal({ name: loadedName, isDefault: loadedDefault, questions: loadedQs });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isNew, setId, user]);

  // 드래그 상태
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // 인라인 편집/추가 폼 상태: "new" = 새로 추가, questionId = 편집, null = 닫힘
  const [formMode, setFormMode] = useState<string | null>(null);
  const [formText, setFormText] = useState("");
  const [formType, setFormType] = useState<QuestionType>("객관식");
  const [formChoices, setFormChoices] = useState<string[]>(["", ""]);
  const [showDelete, setShowDelete] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState(false);

  const openAddForm = () => {
    setFormMode("new");
    setFormText("");
    setFormType("객관식");
    setFormChoices(["", ""]);
  };
  const openEditForm = (q: Question) => {
    setFormMode(q.id);
    setFormText(q.text);
    setFormType(q.type);
    setFormChoices(q.type === "주관식" ? [] : [...q.choices, ...(q.choices.length < 2 ? ["", ""].slice(0, 2 - q.choices.length) : [])]);
  };
  const closeForm = () => {
    setFormMode(null);
    setFormText("");
    setFormType("객관식");
    setFormChoices(["", ""]);
  };
  const updateFormChoice = (i: number, v: string) => {
    setFormChoices((p) => p.map((c, idx) => (idx === i ? v : c)));
  };
  const addFormChoice = () => setFormChoices((p) => [...p, ""]);
  const removeFormChoice = (i: number) => {
    if (formChoices.length <= 2) return;
    setFormChoices((p) => p.filter((_, idx) => idx !== i));
  };
  const canSaveForm = formText.trim().length > 0 && (
    formType === "주관식" || formChoices.filter((c) => c.trim()).length >= 2
  );
  const saveForm = () => {
    if (!canSaveForm) return;
    const cleanedChoices = formType === "주관식" ? [] : formChoices.map((c) => c.trim()).filter(Boolean);
    if (formMode === "new") {
      const newQ: Question = {
        id: `q-${Date.now()}`,
        text: formText.trim(),
        type: formType,
        choices: cleanedChoices,
      };
      setQuestions((prev) => [...prev, newQ]);
    } else if (formMode) {
      setQuestions((prev) =>
        prev.map((q) => (q.id === formMode ? { ...q, text: formText.trim(), type: formType, choices: cleanedChoices } : q))
      );
    }
    closeForm();
  };

  const confirmDelete = () => {
    if (!showDelete) return;
    setQuestions((prev) => prev.filter((q) => q.id !== showDelete));
    if (formMode === showDelete) closeForm();
    setShowDelete(null);
  };

  // 드래그 앤 드롭 순서 변경
  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };
  const handleDrop = (e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === dropIdx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }
    setQuestions((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(dropIdx, 0, moved);
      return next;
    });
    setDragIdx(null);
    setDragOverIdx(null);
  };
  const handleDragEnd = () => {
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const canSaveSet = name.trim().length > 0 && questions.length > 0;

  /* dirty 판정 — 로드 원본 대비 변경 여부 */
  const isDirty = original !== null &&
    JSON.stringify({ name, isDefault, questions }) !== JSON.stringify(original);

  const saveSet = async () => {
    if (savingSet || !canSaveSet || !user) return;
    setSavingSet(true);
    setSaveError(null);
    // DB 구조: { text, type, choices? } — 화면 보조 id 제거, 주관식은 choices 생략
    const dbQuestions = questions.map((q) =>
      q.type === "주관식"
        ? { text: q.text, type: q.type }
        : { text: q.text, type: q.type, choices: q.choices }
    );
    // 새 컬럼(updated_at 등) 유연 처리 위해 write 빌더 캐스팅
    type Writer = {
      update: (p: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: Error | null }> };
      insert: (p: Record<string, unknown>) => { select: (c: string) => { single: () => Promise<{ data: { id: string } | null; error: Error | null }> } };
    };
    const pqs = () => supabase.from("pharmacist_question_sets") as unknown as Writer;
    try {
      // 기본 세트는 1개만 — 켤 때 본인 다른 세트를 모두 내림
      if (isDefault) {
        const { error: rErr } = await pqs().update({ is_default: false }).eq("pharmacist_id", user.id);
        if (rErr) throw rErr;
      }
      if (isNew) {
        const { data, error } = await pqs()
          .insert({ pharmacist_id: user.id, title: name.trim(), is_default: isDefault, questions: dbQuestions })
          .select("id").single();
        if (error || !data) throw error ?? new Error("insert failed");
      } else {
        const { error } = await pqs()
          .update({ title: name.trim(), is_default: isDefault, questions: dbQuestions, updated_at: new Date().toISOString() })
          .eq("id", setId);
        if (error) throw error;
      }
      // dirty 리셋 기준 갱신
      setOriginal({ name, isDefault, questions });
      setSavedToast(true);
      setTimeout(() => { setSavedToast(false); router.push("/pharmacist/mypage"); }, 1200);
    } catch (e) {
      console.error("[question-set] save failed:", e);
      setSaveError("저장에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSavingSet(false);
    }
  };

  /* 이탈 경고 — 브라우저 새로고침·창닫기 (isDirty일 때만) */
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  /* 앱 내 이탈(뒤로가기/취소) — dirty면 커스텀 모달 */
  const requestLeave = () => {
    if (isDirty) { setShowLeaveModal(true); return; }
    router.push("/pharmacist/mypage");
  };

  return (
    <>
      <style>{`
        .qs-page { min-height: 100dvh; background: ${C.sageBg}; padding-bottom: 120px; }
        .qs-page nav {
          position: sticky; top: 0; z-index: 50;
          padding: 0 24px; height: 60px;
          display: flex; align-items: center; gap: 8px;
          background: rgba(248,249,247,0.95);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid ${C.border};
        }
        .qs-c { max-width: 560px; margin: 0 auto; padding: 20px 16px; }
        .qs-bottom {
          position: fixed; bottom: 0; left: 0; right: 0; z-index: 60;
          background: rgba(255,255,255,0.96);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-top: 1px solid ${C.border};
          padding: 12px 16px;
        }
        .qs-bottom-inner { max-width: 560px; margin: 0 auto; }
      `}</style>

      <div className="qs-page">
        <nav>
          <button
            type="button"
            onClick={requestLeave}
            aria-label="뒤로가기"
            style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: C.textDark, padding: 6, lineHeight: 1 }}
          >←</button>
          <div style={{ flex: 1, textAlign: "center", fontFamily: "'Gothic A1', sans-serif", fontSize: 16, fontWeight: 700, color: C.textDark, marginRight: 36 }}>
            {isNew ? "새 세트 만들기" : "세트 편집"}
          </div>
        </nav>

        {loading ? (
          <div className="qs-c" style={{ minHeight: "50vh", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, color: C.textMid }}>
            불러오는 중이에요…
          </div>
        ) : notFound ? (
          <div className="qs-c" style={{ minHeight: "50vh", display: "flex", flexDirection: "column", gap: 8, alignItems: "center", justifyContent: "center", textAlign: "center" }}>
            <div style={{ fontSize: 40 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.textDark }}>세트를 찾을 수 없어요</div>
            <button type="button" onClick={() => router.push("/pharmacist/mypage")} style={{ marginTop: 8, padding: "10px 20px", border: `1px solid ${C.sageLight}`, borderRadius: 10, background: C.white, color: C.sageDeep, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>목록으로</button>
          </div>
        ) : (
          <>
        <div className="qs-c">
          {/* ── 세트 이름 + 기본 세트 토글 ── */}
          <div style={{ background: C.white, borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: "0 2px 12px rgba(74,99,85,0.07)" }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: C.textMid, display: "block", marginBottom: 8 }}>세트 이름</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 소화 문제용"
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 10,
                border: `1.5px solid ${C.border}`,
                fontSize: 18, fontWeight: 700, color: C.textDark,
                background: C.white, outline: "none",
                fontFamily: "'Gothic A1', sans-serif",
                boxSizing: "border-box",
                marginBottom: 14,
              }}
            />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: C.sageBg, borderRadius: 10 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.textDark, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: "#F59E0B" }}>★</span> 기본 세트 지정
                </div>
                <div style={{ fontSize: 13, color: C.textMid, marginTop: 2 }}>
                  매칭 수락 후 환자에게 자동 전송됩니다
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDefault((v) => !v)}
                aria-checked={isDefault}
                role="switch"
                style={{
                  position: "relative", width: 44, height: 24, borderRadius: 12,
                  background: isDefault ? C.sageDeep : "#D1D5D3", border: "none",
                  cursor: "pointer", flexShrink: 0, transition: "background 0.2s",
                }}
              >
                <span style={{
                  position: "absolute", top: 2, left: isDefault ? 22 : 2,
                  width: 20, height: 20, borderRadius: "50%",
                  background: C.white, transition: "left 0.2s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                }} />
              </button>
            </div>
          </div>

          {/* ── 질문 목록 ── */}
          <div style={{ background: C.white, borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: "0 2px 12px rgba(74,99,85,0.07)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: C.textDark, fontFamily: "'Gothic A1', sans-serif" }}>
                질문 목록 ({questions.length})
              </div>
            </div>
            <div style={{ fontSize: 13, color: C.textMid, lineHeight: 1.5, marginBottom: 14 }}>
              드래그해서 순서를 바꿀 수 있어요
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {questions.map((q, idx) => {
                const isEditing = formMode === q.id;
                const isDragging = dragIdx === idx;
                const isDragOver = dragOverIdx === idx && dragIdx !== idx;
                return (
                  <div key={q.id}>
                    {!isEditing && (
                      <div
                        draggable
                        onDragStart={() => handleDragStart(idx)}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDrop={(e) => handleDrop(e, idx)}
                        onDragEnd={handleDragEnd}
                        style={{
                          padding: 14, borderRadius: 12,
                          background: isDragOver ? C.sagePale : C.white,
                          border: `1px solid ${isDragOver ? C.sageLight : C.border}`,
                          opacity: isDragging ? 0.45 : 1,
                          transition: "background 0.15s, border 0.15s",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                          <span
                            style={{
                              color: C.sageLight, cursor: "grab",
                              fontSize: 18, lineHeight: 1.4,
                              userSelect: "none", flexShrink: 0,
                            }}
                            aria-label="드래그로 순서 변경"
                          >☰</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: C.sageMid, flexShrink: 0, paddingTop: 1 }}>
                            {idx + 1}.
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 15, fontWeight: 600, color: C.textDark, lineHeight: 1.5, wordBreak: "break-word" }}>
                              {q.text}
                            </div>
                            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <span style={{
                                padding: "2px 8px", borderRadius: 6,
                                fontSize: 13, fontWeight: 600,
                                background: TYPE_BADGE[q.type].bg,
                                color: TYPE_BADGE[q.type].color,
                              }}>{q.type}</span>
                              {q.choices.length > 0 && (
                                <span style={{ fontSize: 13, color: C.textMid }}>
                                  선택지 {q.choices.length}개
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, paddingLeft: 34 }}>
                          <button
                            type="button"
                            onClick={() => openEditForm(q)}
                            style={{
                              padding: "5px 12px", borderRadius: 8,
                              fontSize: 14, fontWeight: 600,
                              background: C.sagePale, color: C.sageMid,
                              border: `1px solid ${C.sageLight}`, cursor: "pointer",
                            }}
                          >편집</button>
                          <button
                            type="button"
                            onClick={() => setShowDelete(q.id)}
                            style={{
                              padding: "5px 12px", borderRadius: 8,
                              fontSize: 14, fontWeight: 600,
                              background: C.white, color: C.error,
                              border: `1px solid ${C.border}`, cursor: "pointer",
                            }}
                          >삭제</button>
                        </div>
                      </div>
                    )}

                    {isEditing && (
                      <InlineQuestionForm
                        mode="edit"
                        formText={formText} setFormText={setFormText}
                        formType={formType} setFormType={setFormType}
                        formChoices={formChoices}
                        updateFormChoice={updateFormChoice}
                        addFormChoice={addFormChoice}
                        removeFormChoice={removeFormChoice}
                        canSave={canSaveForm}
                        onSave={saveForm}
                        onCancel={closeForm}
                      />
                    )}
                  </div>
                );
              })}

              {/* 새 질문 추가 폼 */}
              {formMode === "new" && (
                <InlineQuestionForm
                  mode="new"
                  formText={formText} setFormText={setFormText}
                  formType={formType} setFormType={setFormType}
                  formChoices={formChoices}
                  updateFormChoice={updateFormChoice}
                  addFormChoice={addFormChoice}
                  removeFormChoice={removeFormChoice}
                  canSave={canSaveForm}
                  onSave={saveForm}
                  onCancel={closeForm}
                />
              )}

              {questions.length === 0 && formMode !== "new" && (
                <div style={{
                  padding: "24px 16px", borderRadius: 12,
                  background: C.sageBg, border: `1px dashed ${C.sageLight}`,
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: 14, color: C.textMid, marginBottom: 4 }}>
                    아직 질문이 없어요
                  </div>
                  <div style={{ fontSize: 13, color: C.sageMid }}>
                    아래 [+ 질문 추가] 버튼으로 질문을 추가해 보세요
                  </div>
                </div>
              )}
            </div>

            {formMode !== "new" && (
              <button
                type="button"
                onClick={openAddForm}
                style={{
                  width: "100%", marginTop: 14,
                  padding: "12px 0", borderRadius: 10,
                  fontSize: 14, fontWeight: 600,
                  background: C.sagePale, color: C.sageDeep,
                  border: `1px dashed ${C.sageLight}`, cursor: "pointer",
                }}
              >
                + 질문 추가
              </button>
            )}
          </div>
        </div>

        {/* 하단 저장 바 */}
        <div className="qs-bottom">
          {saveError && (
            <div className="qs-bottom-inner" style={{ marginBottom: 8, fontSize: 13, color: C.error, fontWeight: 600 }}>
              {saveError}
            </div>
          )}
          <div className="qs-bottom-inner" style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={requestLeave}
              style={{
                padding: "14px 0", borderRadius: 12,
                fontSize: 15, fontWeight: 700,
                background: C.white, color: C.sageDeep,
                border: `1.5px solid ${C.sageLight}`,
                cursor: "pointer", flex: 1,
              }}
            >취소</button>
            <button
              type="button"
              onClick={saveSet}
              disabled={!canSaveSet || savingSet}
              style={{
                padding: "14px 0", borderRadius: 12,
                fontSize: 15, fontWeight: 700,
                background: !canSaveSet ? C.sageLight : (isDirty ? C.terra : C.sageLight),
                color: C.white, border: "none",
                cursor: (!canSaveSet || savingSet) ? "default" : "pointer",
                opacity: savingSet ? 0.7 : 1,
                boxShadow: (canSaveSet && isDirty) ? "0 4px 14px rgba(192,107,69,0.35)" : "none",
                transition: "background 0.15s, box-shadow 0.15s",
                flex: 2,
              }}
            >
              {savingSet ? "저장 중..." : isDirty ? "• 변경사항 저장" : "저장됨"}
            </button>
          </div>
        </div>
        </>
        )}
      </div>

      {/* 질문 삭제 확인 */}
      {showDelete && (
        <div
          onClick={() => setShowDelete(null)}
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
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: C.textDark, marginBottom: 6 }}>
              이 질문을 삭제하시겠습니까?
            </div>
            <div style={{ fontSize: 13, color: C.textMid, lineHeight: 1.6, marginBottom: 16 }}>
              삭제된 질문은 복구할 수 없어요.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowDelete(null)}
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

      {/* 저장 완료 토스트 — 화면 정중앙 */}
      {savedToast && (
        <div role="status" style={{
          position: "fixed", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          padding: "14px 24px", borderRadius: 12,
          background: C.sageDeep, color: C.white,
          fontSize: 15, fontWeight: 700,
          boxShadow: "0 8px 28px rgba(0,0,0,0.28)",
          zIndex: 1000, whiteSpace: "nowrap",
          fontFamily: "'Noto Sans KR', sans-serif",
        }}>
          문답 세트가 저장됐어요 ✓
        </div>
      )}

      {/* 이탈 확인 모달 (저장 안 한 변경사항 있을 때) */}
      {showLeaveModal && (
        <div
          onClick={() => setShowLeaveModal(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 400,
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
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
              저장하지 않은 변경사항이 있어요
            </div>
            <div style={{ fontSize: 13, color: C.textMid, lineHeight: 1.6, marginBottom: 16 }}>
              지금 나가면 변경한 내용이 사라져요.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                style={{
                  flex: 1, padding: "11px 0", borderRadius: 10,
                  fontSize: 14, fontWeight: 600,
                  background: C.sageBg, color: C.textMid,
                  border: `1px solid ${C.border}`, cursor: "pointer",
                }}
              >취소</button>
              <button
                type="button"
                onClick={() => { setShowLeaveModal(false); router.push("/pharmacist/mypage"); }}
                style={{
                  flex: 1, padding: "11px 0", borderRadius: 10,
                  fontSize: 14, fontWeight: 700,
                  background: C.error, color: C.white,
                  border: "none", cursor: "pointer",
                }}
              >나가기</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ══════════════════════════════════════════
   인라인 질문 폼
   ══════════════════════════════════════════ */

interface InlineQuestionFormProps {
  mode: "new" | "edit";
  formText: string;
  setFormText: (v: string) => void;
  formType: QuestionType;
  setFormType: (v: QuestionType) => void;
  formChoices: string[];
  updateFormChoice: (i: number, v: string) => void;
  addFormChoice: () => void;
  removeFormChoice: (i: number) => void;
  canSave: boolean;
  onSave: () => void;
  onCancel: () => void;
}

function InlineQuestionForm({
  mode,
  formText, setFormText,
  formType, setFormType,
  formChoices,
  updateFormChoice, addFormChoice, removeFormChoice,
  canSave, onSave, onCancel,
}: InlineQuestionFormProps) {
  const hasChoices = formType === "객관식" || formType === "다중 선택";
  return (
    <div style={{
      padding: 14, borderRadius: 12,
      background: C.sagePale,
      border: `1.5px solid ${C.sageLight}`,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.sageDeep, marginBottom: 10 }}>
        {mode === "new" ? "새 질문 추가" : "질문 편집"}
      </div>

      <label style={{ fontSize: 13, fontWeight: 600, color: C.textMid, display: "block", marginBottom: 6 }}>
        질문 내용
      </label>
      <textarea
        value={formText}
        onChange={(e) => setFormText(e.target.value)}
        placeholder="예: 식후 더부룩함이 얼마나 자주 있나요?"
        rows={2}
        style={{
          width: "100%", padding: "10px 12px", borderRadius: 8,
          border: `1.5px solid ${C.border}`,
          fontSize: 14, color: C.textDark,
          background: C.white, outline: "none",
          resize: "vertical", fontFamily: "'Noto Sans KR', sans-serif",
          lineHeight: 1.6, boxSizing: "border-box",
          marginBottom: 12,
        }}
      />

      <label style={{ fontSize: 13, fontWeight: 600, color: C.textMid, display: "block", marginBottom: 6 }}>
        유형
      </label>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        {(["객관식", "주관식", "다중 선택"] as const).map((t) => (
          <label key={t} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 12px", borderRadius: 8,
            background: formType === t ? C.white : "transparent",
            border: formType === t ? `1.5px solid ${C.sageDeep}` : `1px solid ${C.border}`,
            cursor: "pointer", fontSize: 14, color: C.textDark, fontWeight: 600,
          }}>
            <input
              type="radio"
              name={`type-${mode}`}
              checked={formType === t}
              onChange={() => setFormType(t)}
              style={{ margin: 0 }}
            />
            {t}
          </label>
        ))}
      </div>

      {hasChoices && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: C.textMid, display: "block", marginBottom: 6 }}>
            선택지 (최소 2개)
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {formChoices.map((c, i) => (
              <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="text"
                  value={c}
                  onChange={(e) => updateFormChoice(i, e.target.value)}
                  placeholder={`선택지 ${i + 1}`}
                  style={{
                    flex: 1, padding: "8px 10px", borderRadius: 6,
                    border: `1px solid ${C.border}`,
                    fontSize: 14, color: C.textDark,
                    background: C.white, outline: "none",
                    minWidth: 0,
                  }}
                />
                {formChoices.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeFormChoice(i)}
                    aria-label={`선택지 ${i + 1} 삭제`}
                    style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: "transparent", border: `1px solid ${C.border}`,
                      cursor: "pointer", color: C.textMid, flexShrink: 0,
                      fontSize: 14,
                    }}
                  >✕</button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addFormChoice}
            style={{
              marginTop: 6, padding: "6px 12px", borderRadius: 6,
              fontSize: 13, fontWeight: 600,
              background: "transparent", color: C.sageMid,
              border: `1px dashed ${C.sageLight}`, cursor: "pointer",
            }}
          >+ 선택지 추가</button>
        </div>
      )}

      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: "8px 16px", borderRadius: 8,
            fontSize: 14, fontWeight: 600,
            background: C.white, color: C.textMid,
            border: `1px solid ${C.border}`, cursor: "pointer",
          }}
        >취소</button>
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          style={{
            padding: "8px 16px", borderRadius: 8,
            fontSize: 14, fontWeight: 700,
            background: canSave ? C.sageDeep : C.sageLight,
            color: C.white, border: "none",
            cursor: canSave ? "pointer" : "default",
          }}
        >저장</button>
      </div>
    </div>
  );
}

export default function QuestionnaireSetEditClient() {
  return (
    <Suspense>
      <Content />
    </Suspense>
  );
}
