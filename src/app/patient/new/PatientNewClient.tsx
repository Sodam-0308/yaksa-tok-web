"use client";

import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";

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
   증상 아이콘 (랜딩 페이지 동일)
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

function IconBattery() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="6" width="14" height="12" rx="2" stroke="#3B6D11" strokeWidth="1.5" />
      <rect x="18" y="9" width="2" height="6" rx="0.5" fill="#3B6D11" />
      <rect x="6" y="8" width="10" height="8" rx="1" fill="#3B6D11" opacity="0.45" />
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

/* ══════════════════════════════════════════
   증상 데이터
   ══════════════════════════════════════════ */

interface SymptomItem {
  id: string;
  label: string;
  bg: string;
  icon: React.ReactNode;
}

const SYMPTOMS: SymptomItem[] = [
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

const EXTRA_SYMPTOMS = [
  "두통/목어깨결림",
  "수족냉증",
  "안구건조",
  "관절/뼈",
  "간 건강",
  "갱년기",
  "남성건강",
];

/* ══════════════════════════════════════════
   몸 상태 체크 항목 (health-check 동일)
   ══════════════════════════════════════════ */

interface CheckItem {
  key: string;
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  low: string;
  high: string;
}

function PnIconBattery() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="6" width="14" height="12" rx="2" stroke="#3B6D11" strokeWidth="1.5" />
      <rect x="18" y="9" width="2" height="6" rx="0.5" fill="#3B6D11" />
      <rect x="6" y="8" width="10" height="8" rx="1" fill="#3B6D11" opacity="0.45" />
    </svg>
  );
}
function PnIconMoon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#185FA5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
      <circle cx="18" cy="6" r="1" fill="#185FA5" stroke="none" />
    </svg>
  );
}
function PnIconBowl() {
  return (
    <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
      <path d="M5 13 Q7 10 14 10 Q21 10 23 13" stroke="#854F0B" strokeWidth="1.6" fill="#854F0B" opacity="0.35" />
      <path d="M5 13 Q5 22 14 22 Q23 22 23 13" stroke="#854F0B" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <line x1="5" y1="13" x2="23" y2="13" stroke="#854F0B" strokeWidth="1.6" />
    </svg>
  );
}
function PnIconSmile() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="10" r="6" stroke="#534AB7" strokeWidth="1.5" />
      <path d="M8 11 Q11 14 14 11" stroke="#534AB7" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="9" cy="9" r="0.8" fill="#534AB7" />
      <circle cx="13" cy="9" r="0.8" fill="#534AB7" />
    </svg>
  );
}
function PnIconFrown() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="10" r="6" stroke="#993C1D" strokeWidth="1.5" />
      <path d="M8 13 Q11 10 14 13" stroke="#993C1D" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="9" cy="9" r="0.8" fill="#993C1D" />
      <circle cx="13" cy="9" r="0.8" fill="#993C1D" />
    </svg>
  );
}

const HEALTH_ITEMS: CheckItem[] = [
  { key: "energy",    icon: <PnIconBattery />, iconBg: "#EAF3DE", label: "에너지/활력",   low: "매우 힘들어요",      high: "에너지가 넘쳐요" },
  { key: "sleep",     icon: <PnIconMoon />,    iconBg: "#E6F1FB", label: "수면의 질",    low: "거의 못 자요",       high: "깊이 푹 자요" },
  { key: "digestion", icon: <PnIconBowl />,    iconBg: "#FAEEDA", label: "소화 상태",    low: "많이 불편해요",      high: "아주 편해요" },
  { key: "mood",      icon: <PnIconSmile />,   iconBg: "#EEEDFE", label: "기분/정서",    low: "많이 우울해요",      high: "아주 좋아요" },
  { key: "symptom",   icon: <PnIconFrown />,   iconBg: "#FAECE7", label: "증상 불편도",  low: "일상이 힘들 정도",   high: "거의 안 느껴요" },
];

/* ══════════════════════════════════════════
   전화번호 포맷
   ══════════════════════════════════════════ */

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

/* ══════════════════════════════════════════
   메인
   ══════════════════════════════════════════ */

function PatientNewContent() {
  const router = useRouter();

  // 1. 기본 정보 (모두 선택)
  const [name, setName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [phone, setPhone] = useState("");

  // 2. 증상
  const [selectedSymptoms, setSelectedSymptoms] = useState<Set<string>>(new Set());
  const [showMoreSymptoms, setShowMoreSymptoms] = useState(false);
  const [customSymptom, setCustomSymptom] = useState("");

  // 3. 생활습관/환경
  const [lifestyleNote, setLifestyleNote] = useState("");

  // 4. 복용 약/영양제
  const [currentMeds, setCurrentMeds] = useState("");

  // 5. 메모
  const [memo, setMemo] = useState("");

  // 6. 몸 상태 (null = 선택 안 함)
  const [healthScores, setHealthScores] = useState<Record<string, number | null>>({
    energy: null, sleep: null, digestion: null, mood: null, symptom: null,
  });

  const toggleSymptom = (id: string) => {
    setSelectedSymptoms((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const addCustomSymptom = () => {
    const trimmed = customSymptom.trim();
    if (!trimmed) return;
    setSelectedSymptoms((prev) => new Set(prev).add(trimmed));
    setCustomSymptom("");
  };

  const handleSubmit = () => {
    alert("환자가 등록되었습니다");
    router.push("/chart/1");
  };

  const card: React.CSSProperties = {
    background: C.white, borderRadius: 16,
    boxShadow: "0 2px 12px rgba(74,99,85,0.07)",
    padding: 20, marginBottom: 16,
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: 16, fontWeight: 700, color: C.textDark,
    marginBottom: 16, fontFamily: "'Gothic A1', sans-serif",
  };

  const optionalBadge = (
    <span style={{ fontSize: 12, fontWeight: 500, color: C.sageMid, marginLeft: 6 }}>선택</span>
  );

  const labelStyle: React.CSSProperties = {
    fontSize: 14, fontWeight: 600, color: C.textDark, marginBottom: 8, display: "block",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 14px", borderRadius: 10,
    border: `1.5px solid ${C.border}`, fontSize: 15, color: C.textDark,
    outline: "none", fontFamily: "'Noto Sans KR', sans-serif",
    background: C.white,
  };

  const textareaStyle: React.CSSProperties = {
    ...inputStyle, resize: "vertical", lineHeight: 1.6,
  };

  return (
    <>
      <style>{`
        .pn-page { min-height:100dvh; background:${C.sageBg}; }
        .pn-page nav { position:sticky; top:0; z-index:50; padding:0 24px; height:60px; display:flex; align-items:center; background:rgba(248,249,247,0.95); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); border-bottom:1px solid ${C.border}; }
        .pn-c { max-width:560px; margin:0 auto; padding:20px 16px; }
        .pn-slider { -webkit-appearance:none; appearance:none; width:100%; height:8px; border-radius:100px; background:#E8ECE9; outline:none; cursor:pointer; }
        .pn-slider::-webkit-slider-thumb { -webkit-appearance:none; appearance:none; width:28px; height:28px; border-radius:50%; background:${C.sageDeep}; border:3px solid ${C.white}; box-shadow:0 2px 6px rgba(74,99,85,0.25); cursor:pointer; }
        .pn-slider::-moz-range-thumb { width:28px; height:28px; border-radius:50%; background:${C.sageDeep}; border:3px solid ${C.white}; box-shadow:0 2px 6px rgba(74,99,85,0.25); cursor:pointer; }
        .pn-slider::-webkit-slider-runnable-track { border-radius:100px; }
        .pn-slider-inactive::-webkit-slider-thumb { background:#C8CEC9; box-shadow:none; opacity:0.5; }
        .pn-slider-inactive::-moz-range-thumb { background:#C8CEC9; box-shadow:none; opacity:0.5; }
      `}</style>

      <div className="pn-page">
        {/* ── 헤더 ── */}
        <nav>
          <button className="nav-back" onClick={() => router.back()} aria-label="뒤로가기">
            ←
          </button>
          <div style={{ flex: 1, textAlign: "center", fontFamily: "'Gothic A1', sans-serif", fontSize: 16, fontWeight: 700, color: C.textDark, marginRight: 36 }}>
            환자 직접 등록
          </div>
        </nav>

        <div className="pn-c">

          {/* ═══════ 1. 기본 정보 ═══════ */}
          <div style={card}>
            <div style={sectionTitle}>
              기본 정보{optionalBadge}
            </div>
            <div style={{ fontSize: 14, color: C.textMid, marginBottom: 16, marginTop: -8, lineHeight: 1.5 }}>
              아는 정보만 입력하시면 됩니다.
            </div>

            <label style={labelStyle}>이름</label>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="환자 이름" style={{ ...inputStyle, marginBottom: 14 }}
            />

            <label style={labelStyle}>출생연도</label>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <input
                type="number" inputMode="numeric" value={birthYear}
                onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="예: 1975" style={{ ...inputStyle, flex: 1 }}
              />
              {(() => {
                const y = parseInt(birthYear, 10);
                if (birthYear.length === 4 && y >= 1920 && y <= new Date().getFullYear()) {
                  const koreanAge = new Date().getFullYear() - y + 1;
                  return (
                    <span style={{
                      fontSize: 15, fontWeight: 700, color: C.sageDeep,
                      whiteSpace: "nowrap", flexShrink: 0,
                    }}>
                      {koreanAge}세
                    </span>
                  );
                }
                return null;
              })()}
            </div>

            <label style={labelStyle}>성별</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {(["male", "female"] as const).map((g) => (
                <button
                  key={g} type="button"
                  onClick={() => setGender(gender === g ? "" : g)}
                  style={{
                    flex: 1, padding: "12px 0", borderRadius: 10, fontSize: 15, fontWeight: 600,
                    background: gender === g ? C.sageDeep : C.sageBg,
                    color: gender === g ? C.white : C.textMid,
                    border: gender === g ? `1.5px solid ${C.sageDeep}` : `1px solid ${C.border}`,
                    cursor: "pointer", minHeight: 48,
                  }}
                >
                  {g === "male" ? "남성" : "여성"}
                </button>
              ))}
            </div>

            <label style={labelStyle}>전화번호</label>
            <input
              type="tel" inputMode="tel" value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="010-0000-0000" style={inputStyle}
            />
          </div>

          {/* ═══════ 2. 증상 선택 ═══════ */}
          <div style={card}>
            <div style={sectionTitle}>
              증상 선택{optionalBadge}
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 10,
            }}>
              {SYMPTOMS.map((s) => {
                const selected = selectedSymptoms.has(s.id);
                return (
                  <button
                    key={s.id} type="button" onClick={() => toggleSymptom(s.id)}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center",
                      gap: 6, padding: "14px 6px", borderRadius: 12,
                      background: selected ? C.sagePale : s.bg,
                      border: selected ? `2px solid ${C.sageDeep}` : `1.5px solid transparent`,
                      cursor: "pointer", position: "relative",
                      transition: "all 0.15s", minHeight: 48,
                    }}
                  >
                    {selected && (
                      <div style={{
                        position: "absolute", top: 6, right: 6,
                        width: 18, height: 18, borderRadius: "50%",
                        background: C.sageDeep,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.white} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}
                    <div style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {s.icon}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.textDark, textAlign: "center", lineHeight: 1.3 }}>
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
                  padding: "8px 20px", borderRadius: 100,
                  fontSize: 14, fontWeight: 600,
                  background: C.sagePale, color: C.sageDeep,
                  border: "none", cursor: "pointer", minHeight: 48,
                }}
              >
                {showMoreSymptoms ? "접기 ▲" : "찾는 증상이 없나요? ▼"}
              </button>
            </div>

            {/* 더보기 증상 태그 */}
            {showMoreSymptoms && (
              <div style={{
                display: "flex", flexWrap: "wrap", gap: 8,
                justifyContent: "center", marginTop: 12,
              }}>
                {EXTRA_SYMPTOMS.map((label) => {
                  const selected = selectedSymptoms.has(label);
                  return (
                    <button
                      key={label} type="button" onClick={() => toggleSymptom(label)}
                      style={{
                        padding: "8px 16px", borderRadius: 100,
                        fontSize: 14, fontWeight: selected ? 600 : 500,
                        background: selected ? C.sageDeep : C.white,
                        color: selected ? C.white : C.textMid,
                        border: selected ? `1.5px solid ${C.sageDeep}` : `1.5px solid ${C.border}`,
                        cursor: "pointer", minHeight: 48,
                      }}
                    >
                      {selected && "✓ "}{label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* 증상 직접 입력 */}
            {showMoreSymptoms && (
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <input
                  type="text" value={customSymptom}
                  onChange={(e) => setCustomSymptom(e.target.value)}
                  placeholder="증상을 직접 입력하세요"
                  style={{ ...inputStyle, flex: 1 }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); addCustomSymptom(); }
                  }}
                />
                {customSymptom.trim() && (
                  <button
                    type="button" onClick={addCustomSymptom}
                    style={{
                      padding: "10px 16px", borderRadius: 10,
                      fontSize: 14, fontWeight: 700,
                      background: C.terra, color: C.white,
                      border: "none", cursor: "pointer",
                      whiteSpace: "nowrap", minHeight: 48,
                    }}
                  >
                    추가
                  </button>
                )}
              </div>
            )}

            {/* 선택된 커스텀 증상 태그 표시 */}
            {Array.from(selectedSymptoms).filter(
              (s) => !SYMPTOMS.some((sym) => sym.id === s) && !EXTRA_SYMPTOMS.includes(s)
            ).length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                {Array.from(selectedSymptoms)
                  .filter((s) => !SYMPTOMS.some((sym) => sym.id === s) && !EXTRA_SYMPTOMS.includes(s))
                  .map((s) => (
                    <span key={s} style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "6px 12px", borderRadius: 100,
                      fontSize: 13, fontWeight: 600,
                      background: C.sagePale, color: C.sageDeep,
                      border: `1px solid ${C.sageLight}`,
                    }}>
                      {s}
                      <button type="button" onClick={() => toggleSymptom(s)} style={{
                        background: "none", border: "none", cursor: "pointer",
                        padding: 0, fontSize: 14, color: C.sageMid, lineHeight: 1,
                      }}>
                        ×
                      </button>
                    </span>
                  ))
                }
              </div>
            )}
          </div>

          {/* ═══════ 3. 생활습관/환경 ═══════ */}
          <div style={card}>
            <div style={sectionTitle}>
              생활습관/환경{optionalBadge}
            </div>
            <textarea
              value={lifestyleNote} onChange={(e) => setLifestyleNote(e.target.value)}
              placeholder="직업, 생활 패턴, 수면, 운동, 식습관 등 파악한 내용을 자유롭게 기록해주세요"
              rows={4}
              style={textareaStyle}
            />
          </div>

          {/* ═══════ 4. 기존 복용 약/영양제 ═══════ */}
          <div style={card}>
            <div style={sectionTitle}>
              기존 복용 약/영양제{optionalBadge}
            </div>
            <textarea
              value={currentMeds} onChange={(e) => setCurrentMeds(e.target.value)}
              placeholder="현재 복용 중인 약이나 영양제를 입력해주세요"
              rows={3}
              style={textareaStyle}
            />
          </div>

          {/* ═══════ 5. 메모 ═══════ */}
          <div style={card}>
            <div style={sectionTitle}>
              메모{optionalBadge}
            </div>
            <textarea
              value={memo} onChange={(e) => setMemo(e.target.value)}
              placeholder="상담 내용이나 특이사항을 기록해주세요"
              rows={4}
              style={textareaStyle}
            />
          </div>

          {/* ═══════ 6. 몸 상태 (맨 하단) ═══════ */}
          <div style={card}>
            <div style={sectionTitle}>
              몸 상태{optionalBadge}
            </div>
            <div style={{ fontSize: 14, color: C.textMid, marginBottom: 20, marginTop: -8, lineHeight: 1.5 }}>
              환자와 대화하며 체크해보세요. 건너뛰어도 됩니다.
            </div>
            {HEALTH_ITEMS.map((item, idx) => {
              const val = healthScores[item.key];
              const isSet = val !== null;
              return (
                <div key={item.key} style={{ marginBottom: idx < HEALTH_ITEMS.length - 1 ? 20 : 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: isSet ? C.textDark : C.sageMid }}>
                      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "50%", background: item.iconBg, marginRight: 8, flexShrink: 0, verticalAlign: "middle" }}>{item.icon}</span>{item.label}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {isSet ? (
                        <>
                          <ScoreHearts score={val} />
                          <span style={{ fontSize: 20, fontWeight: 800, color: C.sageDeep }}>{val}</span>
                          <button
                            type="button"
                            onClick={() => setHealthScores({ ...healthScores, [item.key]: null })}
                            aria-label="초기화"
                            style={{
                              width: 28, height: 28, borderRadius: "50%",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              background: "#F0F0F0", border: "none", cursor: "pointer",
                              fontSize: 14, color: "#999", lineHeight: 1, padding: 0,
                            }}
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <span style={{ fontSize: 13, color: C.sageMid }}>아직 체크 전이에요</span>
                      )}
                    </div>
                  </div>
                  <input
                    type="range" min={1} max={10} value={isSet ? val : 5}
                    onChange={(e) => setHealthScores({ ...healthScores, [item.key]: +e.target.value })}
                    onMouseDown={() => { if (!isSet) setHealthScores((prev) => ({ ...prev, [item.key]: 5 })); }}
                    onTouchStart={() => { if (!isSet) setHealthScores((prev) => ({ ...prev, [item.key]: 5 })); }}
                    className={isSet ? "pn-slider" : "pn-slider pn-slider-inactive"}
                    style={{
                      background: isSet
                        ? `linear-gradient(to right, ${C.sageDeep} 0%, ${C.sageDeep} ${((val - 1) / 9) * 100}%, #E8ECE9 ${((val - 1) / 9) * 100}%, #E8ECE9 100%)`
                        : "#E8ECE9",
                    }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                    <span style={{ fontSize: 12, color: C.sageMid }}>{item.low}</span>
                    <span style={{ fontSize: 12, color: C.sageMid }}>{item.high}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── 하단 고정 버튼 ── */}
        <div style={{
          position: "sticky", bottom: 0,
          background: "rgba(255,255,255,0.95)",
          borderTop: `1px solid ${C.border}`,
          padding: "12px 16px",
        }}>
          <div style={{ maxWidth: 560, margin: "0 auto" }}>
            <button
              type="button" onClick={handleSubmit}
              style={{
                width: "100%", padding: "15px 0", borderRadius: 14,
                fontSize: 16, fontWeight: 700,
                background: C.sageDeep, color: C.white,
                border: "none", cursor: "pointer",
                minHeight: 48,
              }}
            >
              환자 등록
            </button>
          </div>
        </div>

        {/* 하단 여백 */}
        <div style={{ height: 20 }} />
      </div>
    </>
  );
}

/* ══════════════════════════════════════════
   Export
   ══════════════════════════════════════════ */

export default function PatientNewClient() {
  return <Suspense><PatientNewContent /></Suspense>;
}
