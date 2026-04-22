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
  textDark: "#2C3630",
  textMid: "#3D4A42",
  border: "rgba(94, 125, 108, 0.14)",
  white: "#fff",
  error: "#D4544C",
};

/* ══════════════════════════════════════════
   타입 & 상수
   ══════════════════════════════════════════ */

type Category = "첫 인사" | "방문 안내" | "영양제 설명" | "생활 가이드" | "팔로업" | "기타";

const CATEGORIES: Category[] = ["첫 인사", "방문 안내", "영양제 설명", "생활 가이드", "팔로업", "기타"];

const CATEGORY_STYLE: Record<Category, { bg: string; color: string }> = {
  "첫 인사":     { bg: "#EDF4F0", color: "#4A6355" },
  "방문 안내":   { bg: "#FFF8E1", color: "#B06D00" },
  "영양제 설명": { bg: "#E6F1FB", color: "#185FA5" },
  "생활 가이드": { bg: "#FBF5F1", color: "#C06B45" },
  "팔로업":      { bg: "#EEEDFE", color: "#534AB7" },
  "기타":        { bg: "#F0F0F0", color: "#555555" },
};

interface Template {
  id: string;
  category: Category;
  title: string;
  content: string;
}

const INITIAL_TEMPLATES: Template[] = [
  {
    id: "t-1",
    category: "첫 인사",
    title: "인사 및 문답 확인",
    content: "안녕하세요, 김서연 약사입니다. 문답 내용 잘 확인했어요. 궁금한 점 편하게 물어봐 주세요!",
  },
  {
    id: "t-2",
    category: "방문 안내",
    title: "방문 일정 안내",
    content: "약국 방문 시 현재 복용 중인 영양제가 있으시면 함께 가져와 주세요. 체질에 맞게 조정해드릴게요.",
  },
  {
    id: "t-3",
    category: "영양제 설명",
    title: "유산균 복용법",
    content: "유산균은 공복에 드시는 게 가장 효과적이에요. 아침 식사 30분 전이 좋습니다.",
  },
  {
    id: "t-4",
    category: "생활 가이드",
    title: "카페인 줄이기",
    content: "카페인은 하루 2잔 이하로 줄여보세요. 오후 2시 이후에는 되도록 피하시는 게 수면에 도움이 됩니다.",
  },
  {
    id: "t-5",
    category: "팔로업",
    title: "복용 확인",
    content: "영양제 복용 시작하신 지 2주 됐는데, 혹시 변화가 느껴지시나요? 불편한 점 있으면 말씀해주세요.",
  },
];

/* ══════════════════════════════════════════
   메인
   ══════════════════════════════════════════ */

function Content() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>(INITIAL_TEMPLATES);

  // 인라인 편집: "new" = 새로 추가, templateId = 편집, null = 닫힘
  const [formMode, setFormMode] = useState<string | null>(null);
  const [formCategory, setFormCategory] = useState<Category>("첫 인사");
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const openAddForm = () => {
    setFormMode("new");
    setFormCategory("첫 인사");
    setFormTitle("");
    setFormContent("");
  };
  const openEditForm = (t: Template) => {
    setFormMode(t.id);
    setFormCategory(t.category);
    setFormTitle(t.title);
    setFormContent(t.content);
  };
  const closeForm = () => {
    setFormMode(null);
    setFormTitle("");
    setFormContent("");
  };

  const canSaveForm = formTitle.trim().length > 0 && formContent.trim().length > 0;

  const saveForm = () => {
    if (!canSaveForm) return;
    if (formMode === "new") {
      const newT: Template = {
        id: `t-${Date.now()}`,
        category: formCategory,
        title: formTitle.trim(),
        content: formContent.trim(),
      };
      setTemplates((prev) => [...prev, newT]);
    } else if (formMode) {
      setTemplates((prev) => prev.map((t) => (t.id === formMode ? { ...t, category: formCategory, title: formTitle.trim(), content: formContent.trim() } : t)));
    }
    closeForm();
  };

  const confirmDelete = () => {
    if (!deleteTargetId) return;
    setTemplates((prev) => prev.filter((t) => t.id !== deleteTargetId));
    if (formMode === deleteTargetId) closeForm();
    setDeleteTargetId(null);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1500);
  };

  const handleCopy = async (t: Template) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(t.content);
      }
      showToast("복사됨!");
    } catch {
      showToast("복사됨!");
    }
  };

  return (
    <>
      <style>{`
        .tmpl-page { min-height: 100dvh; background: ${C.sageBg}; padding-bottom: 40px; }
        .tmpl-page nav {
          position: sticky; top: 0; z-index: 50;
          padding: 0 24px; height: 60px;
          display: flex; align-items: center; gap: 8px;
          background: rgba(248,249,247,0.95);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid ${C.border};
        }
        .tmpl-c { max-width: 560px; margin: 0 auto; padding: 20px 16px; }
      `}</style>

      <div className="tmpl-page">
        <nav>
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="뒤로가기"
            style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: C.textDark, padding: 6, lineHeight: 1 }}
          >←</button>
          <div style={{ flex: 1, textAlign: "center", fontFamily: "'Gothic A1', sans-serif", fontSize: 16, fontWeight: 700, color: C.textDark, marginRight: 36 }}>
            답변 템플릿
          </div>
        </nav>

        <div className="tmpl-c">
          {/* 헤더 + 추가 버튼 */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 8, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: C.textDark, fontFamily: "'Gothic A1', sans-serif", margin: 0 }}>답변 템플릿</h1>
            {templates.length > 0 && formMode !== "new" && (
              <button
                type="button"
                onClick={openAddForm}
                style={{
                  padding: "8px 14px", borderRadius: 10,
                  fontSize: 14, fontWeight: 700,
                  background: C.sageDeep, color: C.white,
                  border: "none", cursor: "pointer",
                  fontFamily: "'Noto Sans KR', sans-serif",
                }}
              >
                + 새 템플릿
              </button>
            )}
          </div>

          {/* 신규 추가 폼 (목록 최상단) */}
          {formMode === "new" && (
            <div style={{ marginBottom: 14 }}>
              <TemplateForm
                mode="new"
                category={formCategory} setCategory={setFormCategory}
                title={formTitle} setTitle={setFormTitle}
                content={formContent} setContent={setFormContent}
                canSave={canSaveForm}
                onSave={saveForm}
                onCancel={closeForm}
              />
            </div>
          )}

          {/* 빈 상태 */}
          {templates.length === 0 && formMode !== "new" ? (
            <div style={{
              padding: "36px 24px",
              background: C.white,
              border: `1px solid ${C.border}`, borderRadius: 16,
              textAlign: "center",
            }}>
              <div style={{ fontSize: 40, marginBottom: 10, lineHeight: 1 }}>💬</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.textDark, marginBottom: 6 }}>
                아직 저장한 템플릿이 없어요
              </div>
              <div style={{ fontSize: 14, color: C.textMid, lineHeight: 1.6, marginBottom: 18 }}>
                자주 쓰는 답변을 템플릿으로 저장하면<br />채팅에서 빠르게 불러올 수 있어요
              </div>
              <button
                type="button"
                onClick={openAddForm}
                style={{
                  padding: "10px 18px", borderRadius: 10,
                  fontSize: 14, fontWeight: 700,
                  background: C.sageDeep, color: C.white,
                  border: "none", cursor: "pointer",
                }}
              >
                + 새 템플릿
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {templates.map((t) => {
                const isEditing = formMode === t.id;
                if (isEditing) {
                  return (
                    <TemplateForm
                      key={t.id}
                      mode="edit"
                      category={formCategory} setCategory={setFormCategory}
                      title={formTitle} setTitle={setFormTitle}
                      content={formContent} setContent={setFormContent}
                      canSave={canSaveForm}
                      onSave={saveForm}
                      onCancel={closeForm}
                    />
                  );
                }
                const cStyle = CATEGORY_STYLE[t.category];
                return (
                  <article
                    key={t.id}
                    style={{
                      background: C.white,
                      border: `1px solid ${C.border}`,
                      borderRadius: 16,
                      padding: 20,
                    }}
                  >
                    <div style={{ marginBottom: 6 }}>
                      <span style={{
                        display: "inline-block",
                        padding: "3px 10px", borderRadius: 8,
                        fontSize: 13, fontWeight: 700,
                        background: cStyle.bg, color: cStyle.color,
                      }}>{t.category}</span>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: C.textDark, marginBottom: 6, lineHeight: 1.4 }}>
                      {t.title}
                    </div>
                    <div style={{
                      fontSize: 14, color: C.textMid, lineHeight: 1.55, marginBottom: 12,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical" as const,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      wordBreak: "break-word",
                    }}>
                      {t.content}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => openEditForm(t)}
                        style={{
                          padding: "6px 12px", borderRadius: 8,
                          fontSize: 14, fontWeight: 600,
                          background: C.sagePale, color: C.sageMid,
                          border: `1px solid ${C.sageLight}`, cursor: "pointer",
                        }}
                      >수정</button>
                      <button
                        type="button"
                        onClick={() => handleCopy(t)}
                        style={{
                          padding: "6px 12px", borderRadius: 8,
                          fontSize: 14, fontWeight: 600,
                          background: C.white, color: C.sageMid,
                          border: `1px solid ${C.border}`, cursor: "pointer",
                        }}
                      >복사</button>
                      <button
                        type="button"
                        onClick={() => setDeleteTargetId(t.id)}
                        style={{
                          padding: "6px 12px", borderRadius: 8,
                          fontSize: 14, fontWeight: 600,
                          background: C.white, color: C.error,
                          border: `1px solid ${C.border}`, cursor: "pointer",
                        }}
                      >삭제</button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
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
              이 템플릿을 삭제하시겠습니까?
            </div>
            <div style={{ fontSize: 13, color: C.textMid, lineHeight: 1.6, marginBottom: 16 }}>
              삭제된 템플릿은 복구할 수 없어요.
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

      {/* 복사 토스트 */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 40, left: "50%",
          transform: "translateX(-50%)",
          padding: "12px 22px", borderRadius: 24,
          background: "rgba(50,55,52,0.95)", color: C.white,
          fontSize: 14, fontWeight: 600,
          boxShadow: "0 6px 24px rgba(0,0,0,0.18)",
          zIndex: 500, whiteSpace: "nowrap",
          fontFamily: "'Noto Sans KR', sans-serif",
        }}>
          {toast}
        </div>
      )}
    </>
  );
}

/* ══════════════════════════════════════════
   인라인 템플릿 편집 폼
   ══════════════════════════════════════════ */

interface TemplateFormProps {
  mode: "new" | "edit";
  category: Category;
  setCategory: (c: Category) => void;
  title: string;
  setTitle: (t: string) => void;
  content: string;
  setContent: (c: string) => void;
  canSave: boolean;
  onSave: () => void;
  onCancel: () => void;
}

function TemplateForm({
  mode,
  category, setCategory,
  title, setTitle,
  content, setContent,
  canSave, onSave, onCancel,
}: TemplateFormProps) {
  return (
    <div style={{
      background: C.white,
      border: `1.5px solid ${C.sageLight}`,
      borderRadius: 16, padding: 20,
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.sageDeep, marginBottom: 10, fontFamily: "'Gothic A1', sans-serif" }}>
        {mode === "new" ? "새 템플릿" : "템플릿 편집"}
      </div>

      {/* 카테고리 */}
      <label style={{ fontSize: 13, fontWeight: 600, color: C.textMid, display: "block", marginBottom: 6 }}>
        카테고리
      </label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {CATEGORIES.map((c) => {
          const active = category === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              style={{
                padding: "6px 12px", borderRadius: 8,
                fontSize: 13, fontWeight: 600,
                background: active ? C.sageDeep : C.white,
                color: active ? C.white : C.textMid,
                border: active ? "none" : `1px solid ${C.border}`,
                cursor: "pointer",
                fontFamily: "'Noto Sans KR', sans-serif",
              }}
            >
              {c}
            </button>
          );
        })}
      </div>

      {/* 제목 */}
      <label style={{ fontSize: 13, fontWeight: 600, color: C.textMid, display: "block", marginBottom: 6 }}>
        제목
      </label>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="예: 인사 및 문답 확인"
        style={{
          width: "100%", padding: "10px 12px", borderRadius: 10,
          border: `1.5px solid ${C.border}`,
          fontSize: 16, color: C.textDark,
          outline: "none", fontFamily: "'Noto Sans KR', sans-serif",
          boxSizing: "border-box",
          marginBottom: 14,
        }}
      />

      {/* 내용 */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: C.textMid }}>내용</label>
        <span style={{ fontSize: 12, color: C.textMid }}>{content.length}/500</span>
      </div>
      <textarea
        value={content}
        onChange={(e) => { if (e.target.value.length <= 500) setContent(e.target.value); }}
        placeholder="채팅에서 빠르게 불러올 답변 내용을 입력해주세요"
        rows={5}
        style={{
          width: "100%", padding: "10px 12px", borderRadius: 10,
          border: `1.5px solid ${C.border}`,
          fontSize: 14, color: C.textDark,
          outline: "none", resize: "vertical",
          fontFamily: "'Noto Sans KR', sans-serif",
          lineHeight: 1.6, minHeight: 120,
          boxSizing: "border-box",
          marginBottom: 12,
        }}
      />

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: "9px 16px", borderRadius: 8,
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
            padding: "9px 18px", borderRadius: 8,
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

export default function TemplatesClient() {
  return (
    <Suspense>
      <Content />
    </Suspense>
  );
}
