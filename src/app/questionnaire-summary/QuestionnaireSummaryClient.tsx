"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { questions, type Question, type OptionItem } from "@/lib/questions";
import { STORAGE_KEY_ANSWERS } from "@/app/questionnaire/QuestionnaireClient";

/* ══════════════════════════════════════════
   컬러
   ══════════════════════════════════════════ */

const C = {
  sageBg: "#F8F9F7",
  sagePale: "#EDF4F0",
  sageLight: "#B3CCBE",
  sageMid: "#5E7D6C",
  sageDeep: "#4A6355",
  textDark: "#2C3630",
  textMid: "#3D4A42",
  textDim: "#9CA3AF",
  border: "rgba(94, 125, 108, 0.14)",
  cardBorder: "#E5E7EB",
  white: "#fff",
};

type Answers = Record<string, unknown>;

/* ══════════════════════════════════════════
   sessionStorage 로더
   ══════════════════════════════════════════ */

function loadAnswers(): Answers | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_ANSWERS);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Answers;
    }
    return null;
  } catch {
    return null;
  }
}

/* ══════════════════════════════════════════
   답변 포매팅
   ══════════════════════════════════════════ */

function getOptionText(opt: string | OptionItem): string {
  return typeof opt === "string" ? opt : opt.text;
}

/** 질문 title 의 <br/> · HTML 태그 제거 (요약 한 줄 표시용) */
function stripHtml(s: string): string {
  return s.replace(/<br\s*\/?\s*>/gi, " ").replace(/<[^>]+>/g, "").trim();
}

/** 답변 객체 → 표시용 텍스트. 빈 값/잘못된 형식이면 null 반환 (호출 측에서 "(답변 없음)" 처리). */
function formatAnswer(q: Question, value: unknown): string | null {
  if (value === undefined || value === null) return null;

  // single (radio) / bristol — 선택된 옵션 텍스트 그대로
  if (q.type === "single" || q.type === "bristol") {
    if (typeof value !== "string" || !value.trim()) return null;
    return value;
  }

  // multi (checkbox) — 배열 join
  if (q.type === "multi") {
    if (!Array.isArray(value)) return null;
    const arr = value
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .filter((s) => s.length > 0);
    if (arr.length === 0) return null;
    return arr.join(", ");
  }

  // slider — 숫자 + "점"
  if (q.type === "slider") {
    if (typeof value !== "number" || Number.isNaN(value)) return null;
    return `${value}점`;
  }

  // input_row — Record<string, string> 형태. inputs 정의 순서대로 "라벨: 값단위"
  if (q.type === "input_row") {
    if (typeof value !== "object" || !q.inputs) return null;
    const rec = value as Record<string, unknown>;
    const parts: string[] = [];
    for (const inp of q.inputs) {
      const v = rec[inp.key];
      if (v === undefined || v === null) continue;
      const s = typeof v === "string" ? v.trim() : String(v).trim();
      if (!s) continue;
      parts.push(`${inp.label} ${s}${inp.unit}`);
    }
    if (parts.length === 0) return null;
    return parts.join(" · ");
  }

  // textarea — 그대로 (줄바꿈은 렌더 측에서 white-space: pre-wrap 처리)
  if (q.type === "textarea") {
    if (typeof value !== "string" || !value.trim()) return null;
    return value;
  }

  return null;
}

/* ══════════════════════════════════════════
   메인
   ══════════════════════════════════════════ */

export default function QuestionnaireSummaryClient() {
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
      <QuestionnaireSummaryContent />
    </Suspense>
  );
}

function QuestionnaireSummaryContent() {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // 마운트 시 sessionStorage 로드 — 답변 없으면 /questionnaire?reset=1 로 리다이렉트
  useEffect(() => {
    const loaded = loadAnswers();
    if (!loaded || Object.keys(loaded).length === 0) {
      router.replace("/questionnaire?reset=1");
      return;
    }
    setAnswers(loaded);
    setHydrated(true);
  }, [router]);

  if (!hydrated || !answers) {
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
        불러오는 중...
      </div>
    );
  }

  // 동적 flow — 조건부 질문 제외 후 실제 노출되는 문항만
  const flow = questions.filter((q) => !q.condition || q.condition(answers));

  // /match 진입용 symptom 파라미터 — symptoms 첫 값
  const firstSymptom = (() => {
    const s = answers.symptoms;
    if (Array.isArray(s) && s.length > 0 && typeof s[0] === "string") {
      return s[0];
    }
    return "";
  })();

  const handleEdit = (idx: number) => {
    router.push(`/questionnaire?step=${idx}`);
  };

  const handleComplete = () => {
    const target = firstSymptom
      ? `/match?symptom=${encodeURIComponent(firstSymptom)}`
      : "/match";
    router.push(target);
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: C.sageBg,
        fontFamily: "'Noto Sans KR', sans-serif",
        paddingBottom: 96, // 하단 고정 CTA 영역 가림 방지
      }}
    >
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "16px 16px 0" }}>
        {/* ── 헤더 ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 12,
          }}
        >
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="뒤로가기"
            style={{
              background: "transparent",
              border: "none",
              padding: 8,
              fontSize: 20,
              color: C.textDark,
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            ←
          </button>
          <h1
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: C.textDark,
              fontFamily: "'Gothic A1', sans-serif",
              margin: 0,
            }}
          >
            약사 찾기로 돌아가기
          </h1>
        </div>

        {/* ── 안내 문구 ── */}
        <div
          style={{
            fontSize: 13,
            color: C.textMid,
            lineHeight: 1.5,
            marginBottom: 14,
            padding: "0 4px",
          }}
        >
          수정하고 싶은 항목의 [수정]을 눌러주세요.
        </div>

        {/* ── 답변 리스트 ── */}
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {flow.map((q, idx) => {
            const ans = formatAnswer(q, answers[q.id]);
            const isEmpty = ans === null;
            const title = stripHtml(q.title);
            return (
              <li
                key={q.id}
                style={{
                  background: C.white,
                  border: `1px solid ${C.cardBorder}`,
                  borderRadius: 12,
                  padding: "12px 14px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* 라벨 + 본문 한 줄 인라인: "1. 주로 불편한 증상을..." */}
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 500,
                        color: "#1F2937",
                        lineHeight: 1.35,
                        marginBottom: isEmpty ? 2 : 6,
                        wordBreak: "keep-all",
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 700,
                          color: C.sageMid,
                          marginRight: 4,
                        }}
                      >
                        {idx + 1}.
                      </span>
                      {title}
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 400,
                        color: isEmpty ? C.textDim : "#6B7280",
                        lineHeight: 1.4,
                        whiteSpace: "pre-wrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        wordBreak: "break-word",
                      }}
                    >
                      {isEmpty ? "(답변 없음)" : ans}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleEdit(idx)}
                    aria-label={`${q.label} 수정`}
                    style={{
                      background: "transparent",
                      border: `1px solid ${C.sageLight}`,
                      borderRadius: 8,
                      padding: "6px 12px",
                      fontSize: 13,
                      fontWeight: 600,
                      color: C.sageDeep,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      fontFamily: "'Noto Sans KR', sans-serif",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = C.sagePale;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    수정
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* ── 하단 고정 CTA ── */}
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          background: C.white,
          borderTop: `1px solid ${C.border}`,
          padding: "12px 16px",
          boxShadow: "0 -2px 8px rgba(74,99,85,0.06)",
          zIndex: 100,
        }}
      >
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <button
            type="button"
            onClick={handleComplete}
            style={{
              width: "100%",
              height: 52,
              borderRadius: 12,
              background: C.sageDeep,
              color: C.white,
              border: "none",
              cursor: "pointer",
              fontSize: 16,
              fontWeight: 700,
              fontFamily: "'Noto Sans KR', sans-serif",
            }}
          >
            완료
          </button>
        </div>
      </div>
    </div>
  );
}
