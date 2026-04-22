"use client";

import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";

/* ══════════════════════════════════════════
   더미 데이터 & 상수
   ══════════════════════════════════════════ */

interface CheckItem {
  key: string;
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  low: string;
  high: string;
}

function HcIconBattery() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="6" width="14" height="12" rx="2" stroke="#3B6D11" strokeWidth="1.5" />
      <rect x="18" y="9" width="2" height="6" rx="0.5" fill="#3B6D11" />
      <rect x="6" y="8" width="10" height="8" rx="1" fill="#3B6D11" opacity="0.45" />
    </svg>
  );
}
function HcIconMoon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#185FA5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
      <circle cx="18" cy="6" r="1" fill="#185FA5" stroke="none" />
    </svg>
  );
}
function HcIconBowl() {
  return (
    <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
      <path d="M5 13 Q7 10 14 10 Q21 10 23 13" stroke="#854F0B" strokeWidth="1.6" fill="#854F0B" opacity="0.35" />
      <path d="M5 13 Q5 22 14 22 Q23 22 23 13" stroke="#854F0B" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <line x1="5" y1="13" x2="23" y2="13" stroke="#854F0B" strokeWidth="1.6" />
    </svg>
  );
}
function HcIconSmile() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="10" r="6" stroke="#534AB7" strokeWidth="1.5" />
      <path d="M8 11 Q11 14 14 11" stroke="#534AB7" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="9" cy="9" r="0.8" fill="#534AB7" />
      <circle cx="13" cy="9" r="0.8" fill="#534AB7" />
    </svg>
  );
}
function HcIconFrown() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="10" r="6" stroke="#993C1D" strokeWidth="1.5" />
      <path d="M8 13 Q11 10 14 13" stroke="#993C1D" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="9" cy="9" r="0.8" fill="#993C1D" />
      <circle cx="13" cy="9" r="0.8" fill="#993C1D" />
    </svg>
  );
}

const ITEMS: CheckItem[] = [
  { key: "energy",    icon: <HcIconBattery />, iconBg: "#EAF3DE", label: "에너지/활력",   low: "매우 힘들어요",      high: "에너지가 넘쳐요" },
  { key: "sleep",     icon: <HcIconMoon />,    iconBg: "#E6F1FB", label: "수면의 질",    low: "거의 못 자요",       high: "깊이 푹 자요" },
  { key: "digestion", icon: <HcIconBowl />,    iconBg: "#FAEEDA", label: "소화 상태",    low: "많이 불편해요",      high: "아주 편해요" },
  { key: "mood",      icon: <HcIconSmile />,   iconBg: "#EEEDFE", label: "기분/정서",    low: "많이 우울해요",      high: "아주 좋아요" },
  { key: "symptom",   icon: <HcIconFrown />,   iconBg: "#FAECE7", label: "증상 불편도",  low: "일상이 힘들 정도",   high: "거의 안 느껴요" },
];

const INITIAL_SCORES: Record<string, number> = {
  energy: 5, sleep: 4, digestion: 6, mood: 5, symptom: 4,
};

const PREV_SCORES: Record<string, number> = {
  energy: 3, sleep: 2, digestion: 4, mood: 3, symptom: 2,
};

interface HistoryEntry {
  date: string;
  scores: Record<string, number>;
  memo?: string;
}

const HISTORY: HistoryEntry[] = [
  { date: "2026.03.27", scores: { energy: 3, sleep: 2, digestion: 4, mood: 3, symptom: 2 }, memo: "전반적으로 피곤한 한 주였어요" },
  { date: "2026.03.15", scores: { energy: 2, sleep: 2, digestion: 3, mood: 2, symptom: 2 }, memo: "첫 체크" },
];

/* ══════════════════════════════════════════
   컬러
   ══════════════════════════════════════════ */

const C = {
  sageBg: "#F8F9F7", sagePale: "#EDF4F0", sageLight: "#B3CCBE",
  sageMid: "#5E7D6C", sageDeep: "#4A6355",
  terra: "#C06B45", terraLight: "#F5E6DC",
  textDark: "#2C3630", textMid: "#3D4A42",
  border: "rgba(94, 125, 108, 0.14)", white: "#fff",
};

/* ══════════════════════════════════════════
   유틸
   ══════════════════════════════════════════ */

function ScoreHearts({ score, size = 24 }: { score: number; size?: number }) {
  const HEART = "M15 12 Q13 5 9 5 Q5 5 5 9 Q5 13 15 19 Q25 13 25 9 Q25 5 21 5 Q17 5 15 12Z";
  const fullHearts = Math.floor(score / 2);
  const hasHalf = score % 2 === 1;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      {[0, 1, 2, 3, 4].map((i) => {
        let fill = "#D4D4D4";
        if (i < fullHearts) fill = "#C06B45";
        else if (i === fullHearts && hasHalf) fill = "#D9A08A";
        return (
          <svg key={i} width={size} height={size * 0.75} viewBox="0 0 30 24" fill="none">
            <path d={HEART} fill={fill} />
          </svg>
        );
      })}
    </span>
  );
}

/* ══════════════════════════════════════════
   메인
   ══════════════════════════════════════════ */

function HealthCheckContent() {
  const router = useRouter();
  const [scores, setScores] = useState(INITIAL_SCORES);
  const [memo, setMemo] = useState("");
  const [isCompleted, setIsCompleted] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [openHistory, setOpenHistory] = useState<Set<number>>(new Set());
  const [step1HistoryOpen, setStep1HistoryOpen] = useState(false);

  const update = (key: string, val: number) => setScores({ ...scores, [key]: val });

  const finishAndRedirect = () => {
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
      router.push("/mypage");
    }, 1800);
  };

  const handleStep1Complete = () => {
    setIsCompleted(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleFinalSave = () => {
    const hasImproved = ITEMS.some((it) => scores[it.key] - PREV_SCORES[it.key] >= 2);
    if (hasImproved) {
      setShowConsentModal(true);
    } else {
      finishAndRedirect();
    }
  };

  const handleReedit = () => {
    setIsCompleted(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleHistory = (i: number) => {
    setOpenHistory((prev) => {
      const n = new Set(prev);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });
  };

  const card: React.CSSProperties = { background: C.white, borderRadius: 16, boxShadow: "0 2px 12px rgba(74,99,85,0.07)", padding: 20, marginBottom: 16 };

  return (
    <>
      <style>{`
        .hc-page { min-height:100dvh; background:${C.sageBg}; }
        .hc-page nav { position:sticky; top:0; z-index:50; padding:0 24px; height:60px; display:flex; align-items:center; background:rgba(248,249,247,0.95); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); border-bottom:1px solid ${C.border}; }
        .hc-c { max-width:560px; margin:0 auto; padding:20px 16px; }
        .hc-slider { -webkit-appearance:none; appearance:none; width:100%; height:8px; border-radius:100px; background:#E8ECE9; outline:none; cursor:pointer; }
        .hc-slider::-webkit-slider-thumb { -webkit-appearance:none; appearance:none; width:28px; height:28px; border-radius:50%; background:${C.sageDeep}; border:3px solid ${C.white}; box-shadow:0 2px 6px rgba(74,99,85,0.25); cursor:pointer; }
        .hc-slider::-moz-range-thumb { width:28px; height:28px; border-radius:50%; background:${C.sageDeep}; border:3px solid ${C.white}; box-shadow:0 2px 6px rgba(74,99,85,0.25); cursor:pointer; }
        .hc-slider::-webkit-slider-runnable-track { border-radius:100px; }
        .hc-bottom { background:rgba(255,255,255,0.95); border-top:1px solid ${C.border}; padding:12px 16px; margin-top:8px; }
        .hc-bottom-inner { max-width:560px; margin:0 auto; }
        .hc-toast { position:fixed; bottom:80px; left:50%; transform:translateX(-50%); background:${C.sageDeep}; color:${C.white}; padding:14px 28px; border-radius:14px; font-size:15px; font-weight:700; z-index:200; animation:hcFadeUp .3s ease; box-shadow:0 4px 20px rgba(74,99,85,0.2); }
        @keyframes hcFadeUp { from{opacity:0;transform:translateX(-50%) translateY(10px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
      `}</style>

      <div className="hc-page">
        {/* ── 1. 헤더 ── */}
        <nav>
          <button className="nav-back" onClick={() => router.back()} aria-label="뒤로가기">←</button>
          <div style={{ flex: 1, textAlign: "center", fontFamily: "'Gothic A1', sans-serif", fontSize: 16, fontWeight: 700, color: C.textDark, marginRight: 36 }}>
            몸 상태 체크
          </div>
        </nav>

        <div className="hc-c">
          {/* ── 2. 안내 카드 ── */}
          <div style={{ ...card, background: `linear-gradient(135deg, ${C.sagePale} 0%, ${C.white} 100%)`, border: `1px solid ${C.sageLight}` }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.sageDeep, marginBottom: 6, fontFamily: "'Gothic A1', sans-serif" }}>
              오늘의 몸 상태를 체크해주세요
            </div>
            <div style={{ fontSize: 15, color: C.textMid, lineHeight: 1.6, marginBottom: 10 }}>
              정기적으로 체크하면 건강 변화를 정확히 확인할 수 있어요
            </div>
            <div style={{ fontSize: 14, color: C.sageMid, display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.sageMid} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              지난 체크: 2026.03.27
            </div>
          </div>

          {/* 1단계: 편집 화면 — 점수 + 메모 */}
          {!isCompleted && (
            <>
          {/* ── 3. 체크 항목 ── */}
          {ITEMS.map((item) => {
            const val = scores[item.key];
            const prev = PREV_SCORES[item.key];
            const diff = val - prev;
            return (
              <div key={item.key} style={card}>
                {/* 헤더 */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.textDark, fontFamily: "'Gothic A1', sans-serif" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "50%", background: item.iconBg, marginRight: 8, flexShrink: 0, verticalAlign: "middle" }}>{item.icon}</span>{item.label}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <ScoreHearts score={val} />
                    <span style={{ fontSize: 20, fontWeight: 800, color: C.sageDeep }}>{val}</span>
                  </div>
                </div>

                {/* 슬라이더 */}
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={val}
                  onChange={(e) => update(item.key, +e.target.value)}
                  className="hc-slider"
                  style={{
                    background: `linear-gradient(to right, ${C.sageDeep} 0%, ${C.sageDeep} ${((val - 1) / 9) * 100}%, #E8ECE9 ${((val - 1) / 9) * 100}%, #E8ECE9 100%)`,
                  }}
                />

                {/* 라벨 */}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                  <span style={{ fontSize: 13, color: C.sageMid }}>{item.low}</span>
                  <span style={{ fontSize: 13, color: C.sageMid }}>{item.high}</span>
                </div>

                {/* 이전 비교 */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 13, color: C.sageMid }}>이전 {prev}</span>
                  <span style={{ fontSize: 13, color: C.textMid }}>→</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.sageDeep }}>현재 {val}</span>
                  {diff !== 0 && (
                    <span style={{ fontSize: 13, fontWeight: 600, color: diff > 0 ? C.sageDeep : "#D4544C" }}>
                      {diff > 0 ? `+${diff} ↑` : `${diff} ↓`}
                    </span>
                  )}
                  {diff >= 2 && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.sageDeep, padding: "2px 8px", borderRadius: 6, background: C.sagePale }}>
                      개선 확인
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* ── 4. 한줄 메모 ── */}
          <div style={card}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.textDark, marginBottom: 8 }}>
              오늘 특별히 느낀 점이 있나요? (선택)
            </div>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value.slice(0, 100))}
              placeholder="예: 오늘은 아침에 덜 피곤했어요"
              rows={2}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 10,
                border: `1.5px solid ${C.border}`,
                fontSize: 15,
                color: C.textDark,
                background: C.white,
                outline: "none",
                fontFamily: "'Noto Sans KR', sans-serif",
                lineHeight: 1.6,
                resize: "none",
              }}
            />
            <div style={{ fontSize: 13, color: C.sageMid, textAlign: "right", marginTop: 4 }}>{memo.length}/100</div>
          </div>

          {/* 지난 기록 (접이식, 체크 전 참고용) */}
          <div style={card}>
            <button
              type="button"
              onClick={() => setStep1HistoryOpen((v) => !v)}
              aria-expanded={step1HistoryOpen}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 0,
                minHeight: 48,
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 600, color: C.textDark, fontFamily: "'Gothic A1', sans-serif" }}>
                지난 기록 보기
              </span>
              <svg
                width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.sageMid} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ transition: "transform 0.2s", transform: step1HistoryOpen ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {step1HistoryOpen && (
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                {HISTORY.length === 0 ? (
                  <div style={{ fontSize: 14, color: "#3D4A42", textAlign: "center", padding: "12px 0" }}>
                    아직 기록이 없어요
                  </div>
                ) : (
                  HISTORY.map((h, hi) => (
                    <div key={hi} style={{ padding: "12px 14px", borderRadius: 10, background: C.sageBg, border: `1px solid ${C.border}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: hi === 0 ? C.sageDeep : C.sageLight, flexShrink: 0 }} />
                        <span style={{ fontSize: 14, fontWeight: 600, color: C.textDark }}>{h.date}</span>
                        {hi === HISTORY.length - 1 && (
                          <span style={{ fontSize: 12, fontWeight: 600, color: C.sageDeep, padding: "2px 8px", borderRadius: 6, background: C.sagePale }}>첫 체크</span>
                        )}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {ITEMS.map((item) => (
                          <div key={item.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 14, color: C.textMid, display: "inline-flex", alignItems: "center", gap: 6 }}>
                              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "50%", background: item.iconBg, flexShrink: 0 }}>{item.icon}</span>
                              {item.label}
                            </span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: C.sageDeep }}>{h.scores[item.key]}/10</span>
                          </div>
                        ))}
                      </div>
                      {h.memo && (
                        <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}`, fontSize: 14, color: "#3D4A42", lineHeight: 1.5 }}>
                          &ldquo;{h.memo}&rdquo;
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
            </>
          )}

          {/* 2단계: 완료 후 읽기 전용 요약 + 비교 + 지난 기록 */}
          {isCompleted && (
            <>
          {/* 오늘의 점수 요약 (읽기 전용) */}
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.textDark, fontFamily: "'Gothic A1', sans-serif" }}>
                오늘의 체크 완료
              </div>
              <button
                type="button"
                onClick={handleReedit}
                style={{
                  padding: "6px 12px",
                  minHeight: 36,
                  borderRadius: 8,
                  background: "transparent",
                  color: C.sageDeep,
                  fontSize: 13,
                  fontWeight: 600,
                  border: `1px solid ${C.sageLight}`,
                  cursor: "pointer",
                }}
              >
                다시 수정하기
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {ITEMS.map((item) => (
                <div key={item.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "50%", background: item.iconBg, flexShrink: 0 }}>{item.icon}</span>
                    <span style={{ fontSize: 15, fontWeight: 600, color: C.textDark }}>{item.label}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <ScoreHearts score={scores[item.key]} size={18} />
                    <span style={{ fontSize: 17, fontWeight: 800, color: C.sageDeep, minWidth: 28, textAlign: "right" }}>{scores[item.key]}</span>
                  </div>
                </div>
              ))}
            </div>
            {memo && (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}`, fontSize: 14, color: C.textMid, lineHeight: 1.6 }}>
                &ldquo;{memo}&rdquo;
              </div>
            )}
          </div>

          {/* ── 5. 이전 기록 비교 요약 ── */}
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.textDark, fontFamily: "'Gothic A1', sans-serif" }}>
                이전 기록과 비교
              </div>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 12, height: 8, borderRadius: 4, background: "#C5D5C0" }} />
                  <span style={{ fontSize: 12, color: C.textMid }}>이전</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 12, height: 8, borderRadius: 4, background: "#4A6355" }} />
                  <span style={{ fontSize: 12, color: C.textMid }}>현재</span>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {ITEMS.map((item) => {
                const val = scores[item.key];
                const prev = PREV_SCORES[item.key];
                const diff = val - prev;
                const pct = ((val / 10) * 100);
                const prevPct = ((prev / 10) * 100);
                return (
                  <div key={item.key}>
                    {/* 라벨 */}
                    <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "50%", background: item.iconBg, marginRight: 8, flexShrink: 0 }}>{item.icon}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: C.textDark }}>{item.label}</span>
                    </div>
                    {/* 변화량 (하트 위, 오른쪽 정렬) */}
                    <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 4, marginBottom: 2 }}>
                      {diff > 0 ? (
                        <>
                          <span style={{ fontSize: 12, fontWeight: 600, color: C.sageDeep }}>{`+${diff} ↑`}</span>
                          {diff >= 2 && <span style={{ fontSize: 11, fontWeight: 700, color: C.sageDeep, padding: "1px 6px", borderRadius: 4, background: C.sagePale }}>개선</span>}
                        </>
                      ) : diff < 0 ? (
                        <>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#D4544C" }}>{`${diff} ↓`}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#D4544C", padding: "1px 6px", borderRadius: 4, background: "#FEF2F2" }}>주의</span>
                        </>
                      ) : (
                        <span style={{ fontSize: 12, color: C.sageMid }}>변화 없음</span>
                      )}
                    </div>
                    {/* 하트 (오른쪽 정렬 — 모든 항목 동일 위치) */}
                    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
                      <ScoreHearts score={val} size={18} />
                    </div>
                    {/* 막대 + 점수 */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                        <div style={{ height: 6, borderRadius: 3 }}>
                          <div style={{ height: "100%", width: `${prevPct}%`, background: "#C5D5C0", borderRadius: 3 }} />
                        </div>
                        <div style={{ height: 6, background: "#E5E7E3", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: "#4A6355", borderRadius: 3 }} />
                        </div>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.textMid, whiteSpace: "nowrap" }}>{prev} → <span style={{ color: C.sageDeep, fontWeight: 700 }}>{val}</span></span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 격려 메시지 */}
            {(() => {
              const improvedCount = ITEMS.filter((it) => scores[it.key] - PREV_SCORES[it.key] >= 2).length;
              if (improvedCount === 0) return null;
              return (
                <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 12, background: `linear-gradient(135deg, ${C.sagePale} 0%, ${C.white} 100%)`, border: `1px solid ${C.sageLight}`, textAlign: "center" }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.sageDeep }}>
                    {improvedCount}개 항목이 개선되었어요!
                  </div>
                  <div style={{ fontSize: 14, color: C.textMid, marginTop: 4 }}>
                    꾸준히 관리하고 계시네요. 잘하고 있어요!
                  </div>
                </div>
              );
            })()}
          </div>

          {/* ── 7. 체크 히스토리 ── */}
          <div style={card}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.textDark, marginBottom: 14, fontFamily: "'Gothic A1', sans-serif" }}>
              지난 기록
            </div>
            {HISTORY.map((h, hi) => {
              const isOpen = openHistory.has(hi);
              return (
                <div key={hi} style={{ marginBottom: hi < HISTORY.length - 1 ? 8 : 0 }}>
                  <button
                    type="button"
                    onClick={() => toggleHistory(hi)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 14px",
                      borderRadius: 10,
                      background: isOpen ? C.sagePale : C.sageBg,
                      border: `1px solid ${isOpen ? C.sageLight : C.border}`,
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: hi === 0 ? C.sageDeep : C.sageLight, flexShrink: 0 }} />
                      <span style={{ fontSize: 15, fontWeight: 600, color: C.textDark }}>{h.date}</span>
                      {hi === HISTORY.length - 1 && (
                        <span style={{ fontSize: 12, fontWeight: 600, color: C.sageDeep, padding: "2px 8px", borderRadius: 6, background: C.sagePale }}>첫 체크</span>
                      )}
                    </div>
                    <svg
                      width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.sageMid} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      style={{ transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  {isOpen && (
                    <div style={{ padding: "12px 14px", background: C.white, border: `1px solid ${C.border}`, borderTop: "none", borderRadius: "0 0 10px 10px" }}>
                      {ITEMS.map((item) => (
                        <div key={item.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
                          <span style={{ fontSize: 14, color: C.textMid }}><span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "50%", background: item.iconBg, marginRight: 8, flexShrink: 0, verticalAlign: "middle" }}>{item.icon}</span>{item.label}</span>
                          <span style={{ fontSize: 15, fontWeight: 700, color: C.sageDeep }}>{h.scores[item.key]}/10</span>
                        </div>
                      ))}
                      {h.memo && (
                        <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}`, fontSize: 14, color: C.textMid, lineHeight: 1.5, fontStyle: "italic" }}>
                          &ldquo;{h.memo}&rdquo;
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
            </>
          )}
        </div>

        {/* ── 6. 하단 버튼 ── */}
        <div className="hc-bottom">
          <div className="hc-bottom-inner">
            <button
              type="button"
              onClick={isCompleted ? handleFinalSave : handleStep1Complete}
              style={{
                width: "100%",
                padding: "15px 0",
                minHeight: 52,
                borderRadius: 14,
                fontSize: 16,
                fontWeight: 700,
                background: C.sageDeep,
                color: C.white,
                border: "none",
                cursor: "pointer",
              }}
            >
              {isCompleted ? "저장하고 나가기" : "체크 완료"}
            </button>
          </div>
        </div>

        {/* 네비게이션 바 여백 */}
        <div style={{ height: 16 }} />

        {/* 토스트 */}
        {showToast && <div className="hc-toast">체크가 완료되었습니다! 💚</div>}

        {/* 개선 사례 동의 모달 */}
        {showConsentModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 300,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.45)",
              padding: 20,
            }}
            onClick={() => { setShowConsentModal(false); finishAndRedirect(); }}
          >
            <div
              style={{
                background: C.white,
                borderRadius: 20,
                padding: "32px 24px 24px",
                maxWidth: 360,
                width: "100%",
                boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
                textAlign: "center",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.textDark, marginBottom: 10, fontFamily: "'Gothic A1', sans-serif", lineHeight: 1.4 }}>
                축하해요! 건강이 좋아지고 있네요
              </div>
              <div style={{ fontSize: 15, color: C.textMid, lineHeight: 1.65, marginBottom: 24 }}>
                이 경험이 같은 증상으로 고민하는 분들에게 큰 도움이 돼요. 약사 선생님이 익명으로 개선 사례를 공유해도 괜찮으실까요?
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowConsentModal(false);
                    finishAndRedirect();
                  }}
                  style={{
                    flex: 1,
                    padding: "13px 0",
                    borderRadius: 12,
                    fontSize: 15,
                    fontWeight: 600,
                    background: C.white,
                    color: C.textMid,
                    border: `1.5px solid ${C.border}`,
                    cursor: "pointer",
                  }}
                >
                  괜찮아요
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowConsentModal(false);
                    alert("동의해주셔서 감사합니다!");
                    finishAndRedirect();
                  }}
                  style={{
                    flex: 1,
                    padding: "13px 0",
                    borderRadius: 12,
                    fontSize: 15,
                    fontWeight: 700,
                    background: C.sageDeep,
                    color: C.white,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  좋아요
                </button>
              </div>
              <div style={{ fontSize: 13, color: C.sageMid, marginTop: 14 }}>
                동의는 언제든 내 정보에서 철회할 수 있어요
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ══════════════════════════════════════════
   Export
   ══════════════════════════════════════════ */

export default function HealthCheckClient() {
  return <Suspense><HealthCheckContent /></Suspense>;
}
