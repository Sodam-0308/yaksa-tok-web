"use client";

import { useState, useMemo, useCallback, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { questions, Question, OptionItem } from "@/lib/questions";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import type { Database, Json } from "@/types/database";

type AiQuestionnaireInsert = Database["public"]["Tables"]["ai_questionnaires"]["Insert"];

const QUESTIONNAIRE_ID_KEY = "yaksa-tok-questionnaire-id";
const PENDING_MATCH_KEY = "yaksa-tok-pending-match";

/** 비로그인 유저가 가입/로그인 후 /match 로 이동하도록 표시 (cookie + sessionStorage 모두) */
function markPendingMatch() {
  if (typeof document !== "undefined") {
    document.cookie = `${PENDING_MATCH_KEY}=1; path=/; max-age=3600; samesite=lax`;
  }
  if (typeof window !== "undefined") {
    sessionStorage.setItem(PENDING_MATCH_KEY, "1");
  }
}

/* ═══ 증상 SVG 아이콘 (랜딩 페이지와 동일) ═══ */

function IconBattery() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="6" width="14" height="12" rx="2" stroke="#3B6D11" strokeWidth="1.5" />
      <rect x="18" y="9" width="2" height="6" rx="0.5" fill="#3B6D11" />
      <rect x="6" y="8" width="4" height="8" rx="1" fill="#C06B45" opacity="0.6" />
    </svg>
  );
}
function IconBowl() {
  return (
    <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
      <path d="M5 13 Q7 10 14 10 Q21 10 23 13" stroke="#854F0B" strokeWidth="1.6" fill="#854F0B" opacity="0.35" />
      <path d="M5 13 Q5 22 14 22 Q23 22 23 13" stroke="#854F0B" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <line x1="5" y1="13" x2="23" y2="13" stroke="#854F0B" strokeWidth="1.6" />
    </svg>
  );
}
function IconMoon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#185FA5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
      <circle cx="18" cy="6" r="1" fill="#185FA5" stroke="none" />
    </svg>
  );
}
function IconFemale() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#993C1D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="9" r="5" />
      <line x1="12" y1="14" x2="12" y2="22" />
      <line x1="9" y1="19" x2="15" y2="19" />
    </svg>
  );
}
function IconSkin() {
  return (
    <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
      <path d="M6 10 Q6 4 14 4 Q22 4 22 10 L22 18 Q22 24 14 24 Q6 24 6 18Z" stroke="#993C1D" strokeWidth="1.5" />
      <circle cx="9" cy="12" r="1.4" fill="#C06B45" opacity="0.55" />
      <circle cx="19" cy="10" r="1.2" fill="#C06B45" opacity="0.5" />
      <circle cx="14" cy="16" r="1.5" fill="#C06B45" opacity="0.5" />
      <circle cx="8" cy="18" r="1" fill="#C06B45" opacity="0.4" />
      <circle cx="18" cy="17" r="1.1" fill="#C06B45" opacity="0.45" />
      <circle cx="12" cy="9" r="0.8" fill="#C06B45" opacity="0.35" />
    </svg>
  );
}
function IconAllergy() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M4 10 Q8 8 12 10 Q16 12 20 10" stroke="#0F6E56" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M4 14 Q8 12 12 14 Q16 16 20 14" stroke="#0F6E56" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="7" cy="6" r="1.2" fill="#0F6E56" opacity="0.4" />
      <circle cx="14" cy="5" r="0.9" fill="#0F6E56" opacity="0.4" />
      <circle cx="18" cy="7" r="1" fill="#0F6E56" opacity="0.4" />
      <circle cx="10" cy="18" r="0.8" fill="#0F6E56" opacity="0.4" />
    </svg>
  );
}
function IconKnot() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M5 12 Q8 6 11 12 Q14 18 17 12" stroke="#854F0B" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="11" cy="12" r="2.5" stroke="#854F0B" strokeWidth="1.4" fill="none" />
    </svg>
  );
}
function IconSadFace() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="10" r="6" stroke="#534AB7" strokeWidth="1.5" />
      <path d="M8 13 Q11 10 14 13" stroke="#534AB7" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="9" cy="9" r="0.8" fill="#534AB7" />
      <circle cx="13" cy="9" r="0.8" fill="#534AB7" />
      <path d="M6 4 L8 6" stroke="#534AB7" strokeWidth="1" strokeLinecap="round" />
      <path d="M16 4 L14 6" stroke="#534AB7" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}
function IconHair() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M8 4 L7 20" stroke="#993C1D" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M12 4 L12 20" stroke="#993C1D" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M16 4 L17 20" stroke="#993C1D" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function IconScale() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M5 16 Q5 8 11 8 Q17 8 17 16" stroke="#3B6D11" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="5" y1="16" x2="17" y2="16" stroke="#3B6D11" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M11 12 L11 16" stroke="#3B6D11" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="11" cy="11" r="0.7" fill="#3B6D11" />
    </svg>
  );
}

function IconAntiAging() {
  return (
    <svg width="22" height="22" viewBox="0 0 26 26" fill="none">
      <path d="M4 11 A9 9 0 1 1 7 21" stroke="#993C1D" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7 9 L4 11 L2 8" stroke="#993C1D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="13" y1="13" x2="13" y2="8" stroke="#993C1D" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="13" y1="13" x2="17" y2="13" stroke="#993C1D" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="13" cy="13" r="1" fill="#993C1D" />
    </svg>
  );
}
function IconImmune() {
  return (
    <svg width="22" height="22" viewBox="0 0 26 26" fill="none">
      <path d="M13 3 L5 7 L5 14 Q5 20 13 23 Q21 20 21 14 L21 7 Z" stroke="#0F6E56" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M11 9 L14 12 L11 15 L14 18" stroke="#C06B45" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

interface SymptomIconData { id: string; label: string; bg: string; icon: React.ReactNode; }

const MAIN_SYMPTOM_ICONS: SymptomIconData[] = [
  { id: "만성피로", label: "만성피로", bg: "#EAF3DE", icon: <IconBattery /> },
  { id: "소화장애", label: "소화장애", bg: "#FAEEDA", icon: <IconBowl /> },
  { id: "불면/수면", label: "불면/수면", bg: "#E6F1FB", icon: <IconMoon /> },
  { id: "여성건강/생리통", label: "여성건강/생리통", bg: "#FAECE7", icon: <IconFemale /> },
  { id: "피부", label: "피부", bg: "#FAECE7", icon: <IconSkin /> },
  { id: "비염/알레르기", label: "비염/알레르기", bg: "#E1F5EE", icon: <IconAllergy /> },
  { id: "변비/장건강", label: "변비/장건강", bg: "#FAEEDA", icon: <IconKnot /> },
  { id: "우울/불안/스트레스", label: "우울/불안/스트레스", bg: "#EEEDFE", icon: <IconSadFace /> },
  { id: "탈모", label: "탈모", bg: "#FAECE7", icon: <IconHair /> },
  { id: "체중 관리/붓기", label: "체중 관리/붓기", bg: "#EAF3DE", icon: <IconScale /> },
  { id: "항노화/항산화", label: "항노화/항산화", bg: "#FAECE7", icon: <IconAntiAging /> },
  { id: "면역력저하", label: "면역력저하", bg: "#E1F5EE", icon: <IconImmune /> },
];

const EXTRA_SYMPTOM_LABELS = [
  "두통/목어깨결림", "수족냉증", "안구건조",
  "관절/뼈", "간 건강", "갱년기", "남성건강",
];

type Answers = Record<string, unknown>;

const STORAGE_KEY_ANSWERS = "yaksa-tok-answers";
const STORAGE_KEY_IDX = "yaksa-tok-question-idx";

function getOptionText(opt: string | OptionItem): string {
  return typeof opt === "string" ? opt : opt.text;
}

function getOptionEmoji(opt: string | OptionItem): string | undefined {
  return typeof opt === "object" ? opt.emoji : undefined;
}

function saveToSession(answers: Answers, idx: number) {
  try {
    sessionStorage.setItem(STORAGE_KEY_ANSWERS, JSON.stringify(answers));
    sessionStorage.setItem(STORAGE_KEY_IDX, String(idx));
  } catch { /* ignore */ }
}

function loadFromSession(): { answers: Answers; idx: number } | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_ANSWERS);
    const idxRaw = sessionStorage.getItem(STORAGE_KEY_IDX);
    if (raw) {
      return { answers: JSON.parse(raw), idx: idxRaw ? parseInt(idxRaw, 10) : 0 };
    }
  } catch { /* ignore */ }
  return null;
}

export function clearQuestionnaireSession() {
  try {
    sessionStorage.removeItem(STORAGE_KEY_ANSWERS);
    sessionStorage.removeItem(STORAGE_KEY_IDX);
    sessionStorage.removeItem("yaksa-tok-match-loaded");
  } catch { /* ignore */ }
}

export default function QuestionnaireClient() {
  return (
    <Suspense>
      <QuestionnaireContent />
    </Suspense>
  );
}

function QuestionnaireContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [answers, setAnswers] = useState<Answers>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [restored, setRestored] = useState(false);
  const [showMoreSymptoms, setShowMoreSymptoms] = useState(false);
  const [customSymptomInput, setCustomSymptomInput] = useState("");
  const answersRef = useRef(answers);
  const idxRef = useRef(currentIdx);

  // Keep refs in sync for saving
  answersRef.current = answers;
  idxRef.current = currentIdx;

  // Restore from sessionStorage on mount, then apply URL params on top
  useEffect(() => {
    const saved = loadFromSession();
    const symptom = searchParams.get("symptom");
    const gender = searchParams.get("gender");
    const resetParam = searchParams.get("reset");
    const fromStart = searchParams.get("from") === "start";

    const knownLabels = new Set([
      ...MAIN_SYMPTOM_ICONS.map((s) => s.id),
      ...EXTRA_SYMPTOM_LABELS,
    ]);

    const applySymptomParams = (symptomsStr: string | null) => {
      if (!symptomsStr) return undefined;
      const all = symptomsStr.split(",").map((s) => s.trim()).filter(Boolean);
      const custom = all.filter((s) => !knownLabels.has(s));
      if (custom.length > 0) {
        setCustomSymptomInput(custom.join(", "));
        setShowMoreSymptoms(true);
      }
      return all;
    };

    if (resetParam === "1") {
      clearQuestionnaireSession();
      const initial: Answers = {};
      const parsed = applySymptomParams(symptom);
      if (parsed) initial.symptoms = parsed;
      if (gender) initial.gender = gender;
      setAnswers(initial);
      setCurrentIdx(0);
      setRestored(true);
      return;
    }

    if (saved) {
      const merged = { ...saved.answers };
      const parsed = applySymptomParams(symptom);
      if (parsed) merged.symptoms = parsed;
      if (gender) merged.gender = gender;
      setAnswers(merged);
      setCurrentIdx(fromStart ? 0 : saved.idx);
    } else {
      const initial: Answers = {};
      const parsed = applySymptomParams(symptom);
      if (parsed) initial.symptoms = parsed;
      if (gender) initial.gender = gender;
      if (Object.keys(initial).length) setAnswers(initial);
    }
    setRestored(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save to sessionStorage whenever answers or currentIdx change
  useEffect(() => {
    if (restored) {
      saveToSession(answers, currentIdx);
    }
  }, [answers, currentIdx, restored]);

  const flow = useMemo(
    () => questions.filter((q) => !q.condition || q.condition(answers)),
    [answers]
  );

  const q = flow[currentIdx] as Question | undefined;
  const isComplete = currentIdx >= flow.length;
  const isLast = currentIdx === flow.length - 1;

  /* ── 완료 시 ai_questionnaires 저장 (1회) ── */
  const { user, loading: authLoading } = useAuth();
  const savedRef = useRef(false);
  useEffect(() => {
    console.log("[questionnaire] effect tick", {
      isComplete,
      restored,
      authLoading,
      hasUser: !!user,
      saved: savedRef.current,
    });
    // 인증 상태 확정 전에는 저장 보류 (로그인 사용자가 patient_id=null로 저장되는 것 방지)
    if (!isComplete || !restored || authLoading || savedRef.current) return;
    savedRef.current = true;

    // 비로그인 사용자: 가입 후 /match 로 이동하도록 플래그 표시
    if (!user) {
      markPendingMatch();
    }

    const symptoms =
      Array.isArray(answers.symptoms) ? (answers.symptoms as string[]) : [];
    const freeText =
      typeof answers.free_text === "string" ? (answers.free_text as string) : "";

    const payload: AiQuestionnaireInsert = {
      patient_id: user?.id ?? null,
      symptoms,
      free_text: freeText,
      detailed_answers: answers as unknown as Json,
      completed_at: new Date().toISOString(),
    };

    console.log("[questionnaire] saving ai_questionnaires", {
      patient_id: payload.patient_id,
      symptomsCount: symptoms.length,
      freeTextLength: freeText.length,
      payload,
    });

    (async () => {
      try {
        // 1) INSERT — RLS에서 막히면 error.code = "42501" (insufficient_privilege)
        //    스키마 불일치면 "PGRST204" 또는 "42703" (column does not exist)
        const insertResp = await (supabase
          .from("ai_questionnaires") as unknown as {
            insert: (
              p: AiQuestionnaireInsert,
            ) => {
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

        console.log("[questionnaire] insert response:", insertResp);

        if (insertResp.error) {
          console.error("[questionnaire] save FAILED:", {
            message: insertResp.error.message,
            code: insertResp.error.code,
            details: insertResp.error.details,
            hint: insertResp.error.hint,
          });
          savedRef.current = false;
          return;
        }

        const newId = insertResp.data?.id ?? null;
        if (!newId) {
          console.warn(
            "[questionnaire] insert succeeded but no id returned — RLS가 SELECT를 막고 있을 수 있어요",
          );
        } else {
          console.log("[questionnaire] save SUCCESS — id:", newId);
          if (typeof window !== "undefined") {
            sessionStorage.setItem(QUESTIONNAIRE_ID_KEY, newId);
          }
        }
      } catch (err) {
        console.error("[questionnaire] save threw:", err);
        savedRef.current = false;
      }
    })();
  }, [isComplete, restored, authLoading, answers, user]);

  const setAnswer = useCallback(
    (id: string, value: unknown) => {
      setAnswers((prev) => ({ ...prev, [id]: value }));
    },
    []
  );

  const pickSingle = (id: string, value: string) => {
    setAnswer(id, value);
  };

  const pickMulti = (id: string, value: string) => {
    setAnswers((prev) => {
      const arr = (prev[id] as string[]) || [];
      const next = arr.includes(value)
        ? arr.filter((v) => v !== value)
        : [...arr, value];
      return { ...prev, [id]: next };
    });
  };

  const isValid = useMemo(() => {
    if (!q) return false;
    const val = answers[q.id];
    switch (q.type) {
      case "single":
      case "bristol":
        return !!val;
      case "multi":
        return ((val as string[]) || []).length > 0;
      case "slider":
        return true;
      case "input_row": {
        const obj = (val as Record<string, string>) || {};
        return (q.inputs || []).every((inp) => {
          const v = obj[inp.key]?.trim();
          if (!v) return false;
          const num = Number(v);
          if (inp.key === "height") return v.length >= 2 && num >= 50 && num <= 250;
          if (inp.key === "weight") return v.length >= 1 && num >= 1 && num <= 300;
          if (inp.key === "year") return v.length === 4 && num >= 1920 && num <= new Date().getFullYear();
          return true;
        });
      }
      case "textarea":
        return ((val as string) || "").length >= (q.minChars || 0);
      default:
        return false;
    }
  }, [q, answers]);

  const goNext = () => {
    if (!isValid) return;
    setCurrentIdx((i) => i + 1);
    setAnimKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goPrev = () => {
    if (currentIdx <= 0) {
      router.push("/");
      return;
    }
    setCurrentIdx((i) => i - 1);
    setAnimKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // 엔터키 → 다음 질문 (textarea 제외)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      // textarea에서는 줄바꿈 유지
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA") return;
      if (isValid && !isComplete) {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReset = () => {
    clearQuestionnaireSession();
    setAnswers({});
    setCurrentIdx(0);
    setAnimKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const percent = isComplete
    ? 100
    : ((currentIdx + 1) / flow.length) * 100;

  // Don't render until restoration is done
  if (!restored) return null;

  // Complete screen
  if (isComplete) {
    return (
      <div className="questionnaire-page">
        <nav>
          <button className="nav-back" onClick={goPrev} aria-label="뒤로가기">
            ←
          </button>
          <div className="nav-center">
            <div className="nav-step">분석 완료</div>
          </div>
        </nav>
        <div className="progress-wrap">
          <div className="q-progress-bar" style={{ width: "100%" }} />
        </div>

        <div className="q-container">
          <div className="complete-screen">
            <div className="complete-icon">✨</div>
            <h2 className="complete-title">분석 준비 완료!</h2>
            <p className="complete-desc">
              답변해주신 내용을 바탕으로
              <br />
              가장 적합한 근처 약사를 찾고 있어요.
              <br />
              <strong style={{ color: "var(--terra)" }}>잠시만 기다려주세요.</strong>
            </p>
            <Link
              href={`/questionnaire-result?symptom=${encodeURIComponent(((answers.symptoms as string[]) || []).join(","))}`}
              className="complete-btn"
            >
              약사 매칭 확인하기 →
            </Link>
            <button
              className="reset-btn"
              onClick={handleReset}
            >
              처음부터 다시하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!q) return null;

  return (
    <div className="questionnaire-page">
      <style>{`
        @media (max-width: 480px) {
          .questionnaire-page nav { padding-top: 8px !important; padding-bottom: 8px !important; }
          .questionnaire-page .q-container {
            padding-top: 20px !important;
            padding-bottom: 120px !important;
          }
          .questionnaire-page .q-card { padding: 16px !important; }
          .questionnaire-page .q-choices { gap: 8px !important; }
          .questionnaire-page .q-bottom-bar {
            position: sticky !important; bottom: 0 !important;
            background: #fff !important;
            padding: 12px 16px !important;
            box-shadow: 0 -2px 8px rgba(0,0,0,0.06) !important;
            z-index: 40;
          }
        }
      `}</style>
      <nav>
        <button className="nav-back" onClick={goPrev} aria-label="뒤로가기">
          ←
        </button>
        <div className="nav-center">
          <div className="nav-step">
            질문 {currentIdx + 1} / {flow.length}
          </div>
        </div>
      </nav>
      <div className="progress-wrap">
        <div
          className="q-progress-bar"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="q-container">
        {currentIdx === 0 && (
          <div className="q-insight-banner">
            내 몸에 맞는 관리를 찾기 위한 질문이에요.<br />
            같은 증상도 사람마다 해결법이 달라요.
          </div>
        )}
        <div className="q-area" key={animKey}>
          {/* Section Label */}
          {q.sectionLabel && (
            <div className="section-divider">{q.sectionLabel}</div>
          )}

          <div className="q-number">{q.label}</div>
          <h2
            className="q-title"
            dangerouslySetInnerHTML={{ __html: q.title }}
          />
          {q.desc && <p className="q-desc">{q.desc}</p>}

          {/* Single Select */}
          {q.type === "single" && q.options && (
            <div className={q.options.length >= 6 ? "option-grid" : "option-list"}>
              {q.options.map((opt) => {
                const text = getOptionText(opt);
                const selected = answers[q.id] === text;
                return (
                  <div
                    key={text}
                    className={`option-chip${selected ? " selected" : ""}`}
                    onClick={() => pickSingle(q.id, text)}
                  >
                    {text}
                    <span className="check">{selected ? "✓" : ""}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Multi Select */}
          {q.type === "multi" && q.options && (
            q.id === "symptoms" ? (
              <div>
                {/* 메인 증상 10개 — 4열 그리드 */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 10,
                  maxWidth: 440,
                  margin: "0 auto",
                }}>
                  {MAIN_SYMPTOM_ICONS.map((s) => {
                    const active = ((answers[q.id] as string[]) || []).includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => pickMulti(q.id, s.id)}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 6,
                          padding: "12px 4px 10px",
                          borderRadius: 14,
                          border: active ? "2px solid var(--sage-mid, #5E7D6C)" : "2px solid transparent",
                          background: active ? "var(--sage-pale, #EDF4F0)" : "var(--white, #fff)",
                          cursor: "pointer",
                          transition: "all 0.15s",
                          boxShadow: active ? "0 2px 8px rgba(74,99,85,0.13)" : "0 1px 4px rgba(0,0,0,0.06)",
                        }}
                      >
                        <div style={{
                          width: 40,
                          height: 40,
                          borderRadius: "50%",
                          background: s.bg,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}>
                          {s.icon}
                        </div>
                        <span style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: active ? "var(--sage-deep, #4A6355)" : "var(--text-dark, #2C3630)",
                          textAlign: "center",
                          lineHeight: 1.3,
                          wordBreak: "keep-all",
                        }}>
                          {s.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* 찾는 증상이 없나요? */}
                <div style={{ textAlign: "center", marginTop: 16 }}>
                  <button
                    type="button"
                    onClick={() => setShowMoreSymptoms((v) => !v)}
                    style={{
                      padding: "8px 20px",
                      borderRadius: 100,
                      fontSize: 14,
                      fontWeight: 600,
                      background: "var(--sage-pale, #EDF4F0)",
                      color: "var(--sage-deep, #4A6355)",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    {showMoreSymptoms ? "접기 ▲" : "찾는 증상이 없나요? ▼"}
                  </button>
                </div>

                {/* 더보기 증상 태그 */}
                {showMoreSymptoms && (
                  <div style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    justifyContent: "center",
                    marginTop: 12,
                    maxWidth: 440,
                    marginLeft: "auto",
                    marginRight: "auto",
                  }}>
                    {EXTRA_SYMPTOM_LABELS.map((label) => {
                      const active = ((answers[q.id] as string[]) || []).includes(label);
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => pickMulti(q.id, label)}
                          style={{
                            padding: "7px 16px",
                            borderRadius: 100,
                            fontSize: 14,
                            fontWeight: 500,
                            background: active ? "var(--sage-mid, #5E7D6C)" : "var(--white, #fff)",
                            color: active ? "#fff" : "var(--text-mid, #3D4A42)",
                            border: active ? "1.5px solid var(--sage-mid, #5E7D6C)" : "1.5px solid var(--border, rgba(94,125,108,0.14))",
                            cursor: "pointer",
                            transition: "all 0.15s",
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 증상 직접 입력 */}
                {showMoreSymptoms && (
                  <div style={{
                    maxWidth: 440,
                    margin: "14px auto 0",
                  }}>
                    <input
                      type="text"
                      value={customSymptomInput}
                      onChange={(e) => setCustomSymptomInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && customSymptomInput.trim()) {
                          e.preventDefault();
                          e.stopPropagation();
                          const val = customSymptomInput.trim();
                          const arr = (answers[q.id] as string[]) || [];
                          if (!arr.includes(val)) {
                            setAnswers((prev) => ({ ...prev, [q.id]: [...arr, val] }));
                          }
                          setCustomSymptomInput("");
                        }
                      }}
                      placeholder="다른 증상을 직접 입력하세요"
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: "1.5px solid var(--border, rgba(94,125,108,0.14))",
                        fontSize: 14,
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                    {customSymptomInput.trim() && (
                      <button
                        type="button"
                        onClick={() => {
                          const val = customSymptomInput.trim();
                          const arr = (answers[q.id] as string[]) || [];
                          if (!arr.includes(val)) {
                            setAnswers((prev) => ({ ...prev, [q.id]: [...arr, val] }));
                          }
                          setCustomSymptomInput("");
                        }}
                        style={{
                          marginTop: 8,
                          width: "100%",
                          padding: "10px",
                          borderRadius: 10,
                          fontSize: 14,
                          fontWeight: 600,
                          background: "var(--sage-mid, #5E7D6C)",
                          color: "#fff",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        &ldquo;{customSymptomInput.trim()}&rdquo; 증상 추가하기
                      </button>
                    )}
                  </div>
                )}

                {/* 추가된 기타 증상 태그 */}
                {(() => {
                  const knownIds = new Set([
                    ...MAIN_SYMPTOM_ICONS.map((si) => si.id),
                    ...EXTRA_SYMPTOM_LABELS,
                  ]);
                  const customs = ((answers[q.id] as string[]) || []).filter((s) => !knownIds.has(s));
                  if (customs.length === 0) return null;
                  return (
                    <div style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      marginTop: 12,
                      maxWidth: 440,
                      marginLeft: "auto",
                      marginRight: "auto",
                    }}>
                      {customs.map((c) => (
                        <span
                          key={c}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "6px 12px",
                            borderRadius: 100,
                            fontSize: 14,
                            fontWeight: 500,
                            background: "var(--sage-mid, #5E7D6C)",
                            color: "#fff",
                          }}
                        >
                          {c}
                          <button
                            type="button"
                            onClick={() => pickMulti(q.id, c)}
                            style={{
                              background: "none",
                              border: "none",
                              color: "#fff",
                              cursor: "pointer",
                              fontSize: 16,
                              fontWeight: 700,
                              padding: 0,
                              lineHeight: 1,
                            }}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className={q.options.length >= 6 ? "option-grid" : "option-list"}>
                {q.options.map((opt) => {
                  const text = getOptionText(opt);
                  const selected = ((answers[q.id] as string[]) || []).includes(text);
                  return (
                    <div
                      key={text}
                      className={`option-chip${selected ? " selected" : ""}`}
                      onClick={() => pickMulti(q.id, text)}
                    >
                      {text}
                      <span className="check">{selected ? "✓" : ""}</span>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* Bristol */}
          {q.type === "bristol" && q.bristolOptions && (
            <div>
              {q.bristolOptions.map((opt) => {
                const selected = answers[q.id] === opt.label;
                return (
                  <div
                    key={opt.label}
                    className={`bristol-chip${selected ? " selected" : ""}`}
                    onClick={() => pickSingle(q.id, opt.label)}
                  >
                    <div>
                      <div className="bristol-label">{opt.label}</div>
                      <div className="bristol-desc">{opt.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Slider */}
          {q.type === "slider" && (
            <div className="slider-wrap">
              <div className="slider-value">
                {(answers[q.id] as number) ?? q.value ?? 5}
              </div>
              <input
                type="range"
                min={q.min}
                max={q.max}
                value={(answers[q.id] as number) ?? q.value ?? 5}
                onChange={(e) => setAnswer(q.id, Number(e.target.value))}
              />
              <div className="slider-labels">
                <span>{q.leftLabel}</span>
                <span>{q.rightLabel}</span>
              </div>
            </div>
          )}

          {/* Input Row */}
          {q.type === "input_row" && q.inputs && (
            <div>
              <div className="q-input-row">
                {q.inputs.map((inp) => {
                  const obj = (answers[q.id] as Record<string, string>) || {};
                  const maxLen = inp.key === "height" ? 3 : inp.key === "weight" ? 3 : inp.key === "year" ? 4 : undefined;
                  return (
                    <div key={inp.key} className="q-input-group">
                      <label className="q-input-label">{inp.label}</label>
                      <input
                        type={inp.type}
                        inputMode="numeric"
                        placeholder={inp.placeholder}
                        value={obj[inp.key] || ""}
                        maxLength={maxLen}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9]/g, "").slice(0, maxLen || 10);
                          setAnswers((prev) => {
                            const updated = { ...(prev[q.id] as Record<string, string> || {}), [inp.key]: raw };
                            if (q.id === "body") {
                              const h = parseFloat(updated.height);
                              const w = parseFloat(updated.weight);
                              if (h >= 50 && h <= 250 && w >= 1 && w <= 300) {
                                const hm = h / 100;
                                const bmi = w / (hm * hm);
                                return { ...prev, [q.id]: updated, bmi: Math.round(bmi * 10) / 10 };
                              } else {
                                const { bmi: _removed, ...rest } = prev;
                                return { ...rest, [q.id]: updated };
                              }
                            }
                            return { ...prev, [q.id]: updated };
                          });
                        }}
                        className="q-input-field"
                      />
                      <div className="input-unit">{inp.unit}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Textarea */}
          {q.type === "textarea" && (
            <div>
              <textarea
                className="textarea-field"
                placeholder={q.placeholder}
                value={(answers[q.id] as string) || ""}
                onChange={(e) => setAnswer(q.id, e.target.value)}
              />
              {(q.minChars ?? 0) > 0 && (
                <div
                  className={`char-count ${
                    ((answers[q.id] as string) || "").length >= (q.minChars || 0)
                      ? "ok"
                      : "short"
                  }`}
                >
                  {((answers[q.id] as string) || "").length} / {q.minChars}자
                  이상
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="q-bottom-bar">
        <button className="btn-prev" onClick={goPrev}>
          이전
        </button>
        <button
          className="q-btn-next"
          onClick={goNext}
          disabled={!isValid}
        >
          {isLast ? "분석 시작" : "다음"} →
        </button>
      </div>
    </div>
  );
}
