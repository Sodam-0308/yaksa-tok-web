"use client";

import { useState, useMemo, useCallback, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { questions, Question, OptionItem } from "@/lib/questions";

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

    if (resetParam === "1") {
      clearQuestionnaireSession();
      const initial: Answers = {};
      if (symptom) initial.symptoms = symptom.split(",").map((s) => s.trim());
      if (gender) initial.gender = gender;
      setAnswers(initial);
      setCurrentIdx(0);
      setRestored(true);
      return;
    }

    if (saved) {
      // Merge URL params into saved answers (URL params take precedence for symptoms/gender)
      const merged = { ...saved.answers };
      if (symptom) merged.symptoms = symptom.split(",").map((s) => s.trim());
      if (gender) merged.gender = gender;
      setAnswers(merged);
      // from=start means go to question 1 with existing answers
      setCurrentIdx(fromStart ? 0 : saved.idx);
    } else {
      const initial: Answers = {};
      if (symptom) initial.symptoms = symptom.split(",").map((s) => s.trim());
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
      router.push("/signup");
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
              href={`/match?symptom=${encodeURIComponent(((answers.symptoms as string[]) || []).join(","))}`}
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
            <div className={q.options.length >= 5 ? "option-grid" : "option-list"}>
              {q.options.map((opt) => {
                const text = getOptionText(opt);
                const emoji = getOptionEmoji(opt);
                const selected = answers[q.id] === text;
                return (
                  <div
                    key={text}
                    className={`option-chip${selected ? " selected" : ""}`}
                    onClick={() => pickSingle(q.id, text)}
                  >
                    {emoji && <span className="emoji">{emoji}</span>}
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
              <div className="q-symptom-grid">
                {q.options.map((opt) => {
                  const text = getOptionText(opt);
                  const emoji = getOptionEmoji(opt);
                  const selected = ((answers[q.id] as string[]) || []).includes(text);
                  return (
                    <div
                      key={text}
                      className={`q-symptom-chip${selected ? " selected" : ""}`}
                      onClick={() => pickMulti(q.id, text)}
                    >
                      <span className="q-symptom-emoji">{emoji}</span>
                      <span className="q-symptom-text">{text}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={q.options.length >= 5 ? "option-grid" : "option-list"}>
                {q.options.map((opt) => {
                  const text = getOptionText(opt);
                  const emoji = getOptionEmoji(opt);
                  const selected = ((answers[q.id] as string[]) || []).includes(text);
                  return (
                    <div
                      key={text}
                      className={`option-chip${selected ? " selected" : ""}`}
                      onClick={() => pickMulti(q.id, text)}
                    >
                      {emoji && <span className="emoji">{emoji}</span>}
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
                    <span className="bristol-emoji">{opt.emoji}</span>
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
            <div className="q-input-row">
              {q.inputs.map((inp) => {
                const obj = (answers[q.id] as Record<string, string>) || {};
                const maxLen = inp.key === "height" ? 3 : inp.key === "weight" ? 3 : undefined;
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
            </div>
          )}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="q-bottom-bar">
        {currentIdx > 0 && (
          <button className="btn-prev" onClick={goPrev}>
            이전
          </button>
        )}
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
