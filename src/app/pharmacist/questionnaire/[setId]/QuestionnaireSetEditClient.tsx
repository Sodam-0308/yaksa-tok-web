"use client";

import { useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";

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

const MOCK_SETS: Record<string, QuestionSet> = {
  "set-1": {
    id: "set-1",
    name: "소화 문제용",
    isDefault: true,
    questions: [
      {
        id: "q1",
        text: "식후 더부룩함이 얼마나 자주 있나요?",
        type: "객관식",
        choices: ["거의 없음", "가끔", "자주", "매일"],
      },
      {
        id: "q2",
        text: "배변 주기는 어떻게 되나요?",
        type: "객관식",
        choices: ["매일", "2~3일에 한 번", "일주일에 2~3회", "일주일에 한 번 이하"],
      },
      {
        id: "q3",
        text: "소화에 도움이 되는 음식이 있다면 자유롭게 적어주세요.",
        type: "주관식",
        choices: [],
      },
      {
        id: "q4",
        text: "평소 불편한 증상을 모두 선택해주세요.",
        type: "다중 선택",
        choices: ["속쓰림", "더부룩함", "가스 참", "메스꺼움", "복통"],
      },
      {
        id: "q5",
        text: "하루 수분 섭취량은 어느 정도인가요?",
        type: "객관식",
        choices: ["500mL 이하", "500mL~1L", "1L~2L", "2L 이상"],
      },
    ],
  },
  "set-2": {
    id: "set-2",
    name: "수면 문제용",
    isDefault: false,
    questions: [
      {
        id: "q1",
        text: "잠드는 데까지 걸리는 시간은?",
        type: "객관식",
        choices: ["10분 이내", "10~30분", "30분~1시간", "1시간 이상"],
      },
      {
        id: "q2",
        text: "자다가 깨는 횟수는?",
        type: "객관식",
        choices: ["없음", "1회", "2~3회", "4회 이상"],
      },
      {
        id: "q3",
        text: "수면 관련 더 말씀하고 싶은 내용이 있다면 적어주세요.",
        type: "주관식",
        choices: [],
      },
    ],
  },
  "set-3": {
    id: "set-3",
    name: "피로·무기력용",
    isDefault: false,
    questions: [
      {
        id: "q1",
        text: "오전과 오후 중 언제 더 피곤함을 느끼나요?",
        type: "객관식",
        choices: ["오전", "오후", "온종일", "저녁 이후"],
      },
      {
        id: "q2",
        text: "피로와 함께 오는 증상을 모두 선택해주세요.",
        type: "다중 선택",
        choices: ["두통", "어지러움", "집중력 저하", "근육통", "식욕 저하"],
      },
      {
        id: "q3",
        text: "최근 운동 빈도는?",
        type: "객관식",
        choices: ["안 함", "주 1~2회", "주 3~4회", "거의 매일"],
      },
      {
        id: "q4",
        text: "평소 스트레스 요인이 있다면 적어주세요.",
        type: "주관식",
        choices: [],
      },
    ],
  },
};

function loadSet(setId: string): QuestionSet {
  if (setId === "new") {
    return {
      id: `set-${Date.now()}`,
      name: "",
      isDefault: false,
      questions: [],
    };
  }
  return (
    MOCK_SETS[setId] ?? {
      id: setId,
      name: "새 세트",
      isDefault: false,
      questions: [],
    }
  );
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

  const [initial] = useState<QuestionSet>(() => loadSet(setId));
  const [name, setName] = useState(initial.name);
  const [isDefault, setIsDefault] = useState(initial.isDefault);
  const [questions, setQuestions] = useState<Question[]>(initial.questions);

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

  const saveSet = () => {
    // 실제 저장은 백엔드 연결 후 구현
    setSavedToast(true);
    setTimeout(() => {
      setSavedToast(false);
      router.push("/pharmacist/mypage");
    }, 1200);
  };

  const canSaveSet = name.trim().length > 0 && questions.length > 0;

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
            onClick={() => router.push("/pharmacist/mypage")}
            aria-label="뒤로가기"
            style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: C.textDark, padding: 6, lineHeight: 1 }}
          >←</button>
          <div style={{ flex: 1, textAlign: "center", fontFamily: "'Gothic A1', sans-serif", fontSize: 16, fontWeight: 700, color: C.textDark, marginRight: 36 }}>
            {isNew ? "새 세트 만들기" : "세트 편집"}
          </div>
        </nav>

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
          <div className="qs-bottom-inner" style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={() => router.push("/pharmacist/mypage")}
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
              disabled={!canSaveSet}
              style={{
                padding: "14px 0", borderRadius: 12,
                fontSize: 15, fontWeight: 700,
                background: canSaveSet ? C.sageDeep : C.sageLight,
                color: C.white, border: "none",
                cursor: canSaveSet ? "pointer" : "default",
                flex: 2,
              }}
            >
              세트 저장
            </button>
          </div>
        </div>
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

      {/* 저장 완료 토스트 */}
      {savedToast && (
        <div style={{
          position: "fixed", bottom: 88, left: "50%",
          transform: "translateX(-50%)",
          padding: "12px 22px", borderRadius: 24,
          background: "rgba(50,55,52,0.95)", color: C.white,
          fontSize: 14, fontWeight: 600,
          boxShadow: "0 6px 24px rgba(0,0,0,0.18)",
          zIndex: 500, whiteSpace: "nowrap",
        }}>
          ✓ 세트가 저장되었습니다
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
