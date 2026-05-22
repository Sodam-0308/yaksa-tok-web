"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import HealthIndicatorComparison from "@/components/HealthIndicatorComparison";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

/* ══════════════════════════════════════════
   아이콘
   ══════════════════════════════════════════ */

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
    </svg>
  );
}
function IconAllergy() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M4 10 Q8 8 12 10 Q16 12 20 10" stroke="#0F6E56" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M4 14 Q8 12 12 14 Q16 16 20 14" stroke="#0F6E56" strokeWidth="1.4" strokeLinecap="round" />
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
function IconSmileFace() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="10" r="6" stroke="#534AB7" strokeWidth="1.5" />
      <path d="M8 11 Q11 14 14 11" stroke="#534AB7" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="9" cy="9" r="0.8" fill="#534AB7" />
      <circle cx="13" cy="9" r="0.8" fill="#534AB7" />
    </svg>
  );
}
function IconFrownFace() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="10" r="6" stroke="#993C1D" strokeWidth="1.5" />
      <path d="M8 13 Q11 10 14 13" stroke="#993C1D" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="9" cy="9" r="0.8" fill="#993C1D" />
      <circle cx="13" cy="9" r="0.8" fill="#993C1D" />
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
    </svg>
  );
}
function IconAntiAging() {
  return (
    <svg width="22" height="22" viewBox="0 0 26 26" fill="none">
      <path d="M4 11 A9 9 0 1 1 7 21" stroke="#993C1D" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7 9 L4 11 L2 8" stroke="#993C1D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

interface SymptomOption { id: string; label: string; bg: string; color: string; icon: React.ReactNode; }
const SYMPTOM_OPTIONS: SymptomOption[] = [
  { id: "만성피로", label: "만성피로", bg: "#EAF3DE", color: "#3B6D11", icon: <IconBattery /> },
  { id: "소화장애", label: "소화장애", bg: "#FAEEDA", color: "#854F0B", icon: <IconBowl /> },
  { id: "불면/수면", label: "불면/수면", bg: "#E6F1FB", color: "#185FA5", icon: <IconMoon /> },
  { id: "여성건강/생리통", label: "여성건강/생리통", bg: "#FAECE7", color: "#993C1D", icon: <IconFemale /> },
  { id: "피부", label: "피부", bg: "#FAECE7", color: "#993C1D", icon: <IconSkin /> },
  { id: "비염/알레르기", label: "비염/알레르기", bg: "#E1F5EE", color: "#0F6E56", icon: <IconAllergy /> },
  { id: "변비/장건강", label: "변비/장건강", bg: "#FAEEDA", color: "#854F0B", icon: <IconKnot /> },
  { id: "우울/불안/스트레스", label: "우울/불안/스트레스", bg: "#EEEDFE", color: "#534AB7", icon: <IconSadFace /> },
  { id: "탈모", label: "탈모", bg: "#FAECE7", color: "#993C1D", icon: <IconHair /> },
  { id: "체중 관리/붓기", label: "체중 관리/붓기", bg: "#EAF3DE", color: "#3B6D11", icon: <IconScale /> },
  { id: "항노화/항산화", label: "항노화/항산화", bg: "#FAECE7", color: "#993C1D", icon: <IconAntiAging /> },
  { id: "면역력저하", label: "면역력저하", bg: "#E1F5EE", color: "#0F6E56", icon: <IconImmune /> },
];

/* ══════════════════════════════════════════
   타입
   ══════════════════════════════════════════ */

type ProblemStatus = "상담 중" | "개선 중" | "다시 나빠짐" | "해결됨";
interface ProblemItem {
  id: string;
  label: string;
  color: string;
  bg: string;
  startDate: string;
  durationQuick?: string;
  durationText?: string;
  status: ProblemStatus;
  severity: number;
  quickNote: string;
  memo: { date: string; text: string }[];
  endDate?: string;
}

interface SupplementItem {
  name: string;
  dosage: string;
  timing: string;
  /** "bottle"(통약) vs "compounded"(소분 조제약). 레거시는 필드 없음 → bottle. */
  dispense_type?: "bottle" | "compounded";
  /** 5칩 체크박스 결과(아침/점심/저녁/취침 전/기타). 통약·소분 공통. */
  time_slots?: string[];
  /** 영양제별 복용 일수. 가이드 전체 종료일은 max(days) 기준 derive. */
  days?: number | null;
  /** 하루 복용 횟수. null = 미입력(슬롯 개수 자동), >0 = 약사 직접 입력. */
  daily_count?: number | null;
  /** "기타" 슬롯 선택 시 짧은 설명. */
  etc_note?: string;
  /** 영양제별 메모 (환자에게 표시). */
  memo?: string;
  /** 소분 조제약일 때 "약포지에 표시된 대로 복용" 안내를 환자에게 보낼지 여부. 기본 true. */
  package_note?: boolean;
}
const EMPTY_SUPP: SupplementItem = {
  name: "", dosage: "", timing: "",
  dispense_type: "bottle", time_slots: [], days: null, daily_count: null,
  etc_note: "", memo: "", package_note: true,
};
/** 소분 조제약 전환 시 빈 필드에 채워주는 기본값.
 *  통약 전환 시 이 값과 정확히 일치하면 자동값으로 간주해 비움. 매직스트링 방지. */
const COMPOUND_DEFAULT_NAME = "포장된 조제약";
const COMPOUND_DEFAULT_DOSAGE = "1포";

interface VisitRecord {
  id: string;
  date: string;
  products: SupplementItem[];
  durationDays?: number;
  complaint?: string;
  improvement?: string;
  pharmacistGuide?: string;
  pharmacistNote?: string;
  photos: string[];
}

type ConsultationStatus = "completed" | "active" | "rejected";
interface Consultation {
  id: string;
  requestedAt: string;
  acceptedAt: string;
  status: ConsultationStatus;
  questionnaire: Record<string, string>;
  freeText: string;
}

interface HealthCheck {
  date: string;
  energy: number;
  sleep: number;
  digestion: number;
  mood: number;
  symptomDiscomfort: number;
}

interface Patient {
  id: string;
  name: string;
  birthYear: number | null;
  birthDate: string | null;
  gender: string;
  height: number;
  weight: number;
  weightRecordedAt: string;
  budget: string;
  pharmacistMemo: string;
}

/* ══════════════════════════════════════════
   Mock 데이터
   ══════════════════════════════════════════ */

const MOCK_PATIENT: Patient = {
  id: "patient-001",
  name: "김○○",
  birthYear: 1993,
  birthDate: null,
  gender: "여성",
  height: 162,
  weight: 54,
  weightRecordedAt: "2026-04-18",
  budget: "월 5~10만원",
  pharmacistMemo: "야근 잦고 스트레스 많은 사무직. 카페인에 민감하여 하루 2잔 이상이면 수면에 바로 영향. 식습관 개선 의지 있음.",
};

const MOCK_CONSULTATIONS: Consultation[] = [
  {
    id: "consult-1",
    requestedAt: "2026-03-15",
    acceptedAt: "2026-03-15",
    status: "completed",
    questionnaire: {
      증상: "만성피로, 소화장애",
      기간: "3개월",
      직업: "사무직",
      수면: "6시간",
      음주: "주 2회",
      카페인: "하루 2잔",
      흡연: "비흡연",
      운동: "주 1~2회 걷기",
      간식: "하루 1번",
      예산: "월 5~10만원",
    },
    freeText:
      "아침에 속이 부글거리고 점심 먹으면 소화가 안 돼요. 스트레스 받으면 더 심해져서 회사 일에 집중이 안 될 정도입니다. 여러 약을 먹어봤는데 크게 효과를 못 봤어요.",
  },
  {
    id: "consult-2",
    requestedAt: "2026-04-10",
    acceptedAt: "2026-04-10",
    status: "active",
    questionnaire: {
      증상: "불면, 수면장애",
      기간: "2개월",
      직업: "사무직",
      수면: "4시간",
      음주: "주 3회",
      카페인: "하루 3잔",
      흡연: "비흡연",
      운동: "안 함",
      간식: "하루 2번",
      예산: "월 5~10만원",
    },
    freeText: "요즘 스트레스 많고 잠들기까지 2시간 걸려요. 자다가도 자주 깨서 피곤합니다.",
  },
];

const MOCK_VISITS: VisitRecord[] = [
  {
    id: "visit-2",
    date: "2026-04-12",
    products: [
      { name: "비타민B군", dosage: "1알", timing: "아침 식후" },
      { name: "마그네슘", dosage: "1정", timing: "취침 전" },
    ],
    durationDays: 30,
    complaint: "낮 동안 피로감 여전, 밤에 잠들기 어려움",
    improvement: "소화 문제는 안정, 아침 속 편해짐",
    pharmacistGuide: "비타민B군 꾸준히, 마그네슘은 취침 30분 전 꼭 복용",
    pharmacistNote: "수면 쪽 집중 관리 필요. 카페인 줄이기 재차 안내. 2주 후 재방문 권고.",
    photos: [],
  },
  {
    id: "visit-1",
    date: "2026-03-20",
    products: [
      { name: "유산균", dosage: "1포", timing: "아침 공복" },
      { name: "소화효소", dosage: "1알", timing: "식사 직전" },
    ],
    durationDays: 30,
    complaint: "아침 속 부글거림, 식후 더부룩함",
    improvement: "",
    pharmacistGuide: "아침 공복 유산균, 식사 직전 소화효소 1알",
    pharmacistNote: "첫 방문. 스트레스성 소화장애 가능성. 2주 후 재방문 권고.",
    photos: [],
  },
];

const MOCK_HEALTH_CHECKS: HealthCheck[] = [
  { date: "2026-03-15", energy: 3, sleep: 2, digestion: 4, mood: 3, symptomDiscomfort: 7 },
  { date: "2026-04-10", energy: 5, sleep: 4, digestion: 6, mood: 5, symptomDiscomfort: 4 },
];

/* ── 추가 질문 답변 (환자가 제출한 개별 문답 답변) ── */
type AdditionalAnswerQType = "객관식" | "주관식" | "다중 선택";
interface AdditionalAnswerEntry {
  question: string;
  type: AdditionalAnswerQType;
  answers: string[];
}
interface AdditionalAnswerSet {
  id: string;
  setName: string;
  answeredAt: string;
  entries: AdditionalAnswerEntry[];
}

const MOCK_ADDITIONAL_ANSWERS: AdditionalAnswerSet[] = [
  {
    id: "aans-1",
    setName: "피로·무기력용",
    answeredAt: "2026-04-20",
    entries: [
      { question: "오전과 오후 중 언제 더 피곤함을 느끼나요?", type: "객관식", answers: ["하루종일"] },
      { question: "피로와 함께 오는 증상을 모두 선택해주세요", type: "다중 선택", answers: ["두통", "집중력 저하"] },
      { question: "최근 운동 빈도는?", type: "객관식", answers: ["안 함"] },
      { question: "평소 스트레스 요인이 있다면 적어주세요", type: "주관식", answers: ["업무량이 많고 야근이 잦습니다"] },
    ],
  },
];

const INITIAL_PROBLEMS: ProblemItem[] = [
  {
    id: "p1", label: "만성피로", color: "#3B6D11", bg: "#EAF3DE",
    startDate: "2026-01-15", durationQuick: "3m",
    status: "개선 중", severity: 4, quickNote: "오후에 특히 심함",
    memo: [{ date: "04.03", text: "비타민B군 복용 후 오후 졸림 감소" }],
  },
  {
    id: "p2", label: "불면/수면", color: "#185FA5", bg: "#E6F1FB",
    startDate: "2026-02-10", durationQuick: "2m",
    status: "상담 중", severity: 5, quickNote: "새벽 3시 자주 깸",
    memo: [],
  },
  {
    id: "p3", label: "소화장애", color: "#854F0B", bg: "#FAEEDA",
    startDate: "2026-01-15", durationQuick: "3m",
    status: "해결됨", severity: 2, quickNote: "아침 속 부글거림",
    memo: [{ date: "04.10", text: "유산균 복용 후 증상 거의 소실" }],
    endDate: "2026-04-08",
  },
];

/* ══════════════════════════════════════════
   상수
   ══════════════════════════════════════════ */

const COLOR = {
  sageBg: "#F8F9F7",
  sagePale: "#EDF4F0",
  sageLight: "#B3CCBE",
  sageBright: "#7FA48E",
  sageMid: "#5E7D6C",
  sageDeep: "#4A6355",
  terra: "#C06B45",
  terraPale: "#FBF5F1",
  terraLight: "#F5E6DC",
  textDark: "#2C3630",
  textMid: "#3D4A42",
  border: "rgba(94, 125, 108, 0.14)",
  white: "#fff",
};

const STATUS_CONFIG: Record<ProblemStatus, { color: string; bg: string }> = {
  "상담 중": { color: "#5E7D6C", bg: "#EDF4F0" },
  "개선 중": { color: "#C06B45", bg: "#F5E6DC" },
  "다시 나빠짐": { color: "#D32F2F", bg: "#FFEBEE" },
  "해결됨": { color: "#3D4A42", bg: "#F0F0F0" },
};
const ALL_STATUSES: ProblemStatus[] = ["상담 중", "개선 중", "다시 나빠짐", "해결됨"];

const QUICK_DURATION_OPTIONS: { key: string; label: string }[] = [
  { key: "1w", label: "1주 전" },
  { key: "2w", label: "2주 전" },
  { key: "1m", label: "1개월 전" },
  { key: "2m", label: "2개월 전" },
  { key: "3m", label: "3개월 전" },
  { key: "6m", label: "6개월 전" },
  { key: "1y", label: "1년 전" },
  { key: "2y+", label: "2년 이상" },
];

const HEALTH_METRICS: {
  key: keyof Omit<HealthCheck, "date">;
  label: string;
  icon: React.ReactNode;
  iconBg: string;
  lowerIsBetter?: boolean;
}[] = [
  { key: "energy", label: "에너지/활력", icon: <IconBattery />, iconBg: "#EAF3DE" },
  { key: "sleep", label: "수면의 질", icon: <IconMoon />, iconBg: "#E6F1FB" },
  { key: "digestion", label: "소화 상태", icon: <IconBowl />, iconBg: "#FAEEDA" },
  { key: "mood", label: "기분/정서", icon: <IconSmileFace />, iconBg: "#EEEDFE" },
  { key: "symptomDiscomfort", label: "증상 불편도", icon: <IconFrownFace />, iconBg: "#FAECE7", lowerIsBetter: true },
];

/* ══════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════ */

const fmtDate = (iso: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${y}.${m}.${d}`;
};
const fmtShort = (iso: string) => {
  if (!iso) return "";
  const [, m, d] = iso.split("-");
  return `${m}.${d}`;
};
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** 한글 성별 → DB CHECK 'male'/'female'/'other' 매핑. */
function mapGenderToEn(ko: string | null): "male" | "female" | "other" | null {
  if (!ko) return null;
  if (ko === "남성") return "male";
  if (ko === "여성") return "female";
  if (ko === "기타") return "other";
  return null;
}
/** DB 영문 성별 → 한글 매핑 (Mock 폴백용 빈 문자열 반환). */
function mapGenderToKo(en: string | null): string {
  if (en === "male") return "남성";
  if (en === "female") return "여성";
  if (en === "other") return "기타";
  return "";
}
/** birth_date 우선, 없으면 birth_year. 둘 다 없으면 null. birth_date 있을 때 만 나이. */
function calcAgeFromBirthDate(birthDate: string | null, birthYear: number | null): number | null {
  if (birthDate) {
    const [y, m, d] = birthDate.split("-").map(Number);
    const now = new Date();
    let age = now.getFullYear() - y;
    const monthDiff = (now.getMonth() + 1) - m;
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < d)) age -= 1;
    return age;
  }
  if (birthYear) return new Date().getFullYear() - birthYear;
  return null;
}
type TimeSlotKr = "아침" | "점심" | "저녁" | "취침 전" | "기타";

/** 표시용 포맷. birth_date 있으면 "1988년 6월 15일", birth_year만 있으면 "1988년 __월 __일", 둘 다 없으면 "미입력". */
function formatBirthDateForDisplay(birthDate: string | null, birthYear: number | null): string {
  if (birthDate) {
    const [y, m, d] = birthDate.split("-");
    return `${y}년 ${parseInt(m, 10)}월 ${parseInt(d, 10)}일`;
  }
  if (birthYear) return `${birthYear}년 __월 __일`;
  return "미입력";
}

const calcDateFromQuick = (key: string): string => {
  const d = new Date();
  if (key === "1w") d.setDate(d.getDate() - 7);
  else if (key === "2w") d.setDate(d.getDate() - 14);
  else if (key === "1m") d.setMonth(d.getMonth() - 1);
  else if (key === "2m") d.setMonth(d.getMonth() - 2);
  else if (key === "3m") d.setMonth(d.getMonth() - 3);
  else if (key === "6m") d.setMonth(d.getMonth() - 6);
  else if (key === "1y") d.setFullYear(d.getFullYear() - 1);
  else if (key === "2y+") d.setFullYear(d.getFullYear() - 2);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const calcDurationLabel = (startDate: string): string => {
  if (!startDate) return "";
  const start = new Date(startDate);
  const today = new Date();
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const days = Math.max(1, Math.round((today.getTime() - start.getTime()) / 86400000));
  if (days < 7) return `${days}일째`;
  if (days < 30) return `${Math.round(days / 7)}주째`;
  if (days < 365) return `${Math.round(days / 30)}개월째`;
  return `${Math.round(days / 365)}년째`;
};

const getDurationDisplay = (p: ProblemItem): string => {
  if (p.durationText) return p.durationText;
  if (p.durationQuick === "2y+") return "2년 이상";
  if (p.durationQuick && p.startDate) return `약 ${calcDurationLabel(p.startDate)}`;
  if (p.startDate) return calcDurationLabel(p.startDate);
  return "";
};

const CONSULT_STATUS_CONFIG: Record<ConsultationStatus, { label: string; color: string; bg: string }> = {
  completed: { label: "완료", color: "#3D4A42", bg: "#F0F0F0" },
  active: { label: "진행 중", color: "#4A6355", bg: "#EDF4F0" },
  rejected: { label: "거절", color: "#D32F2F", bg: "#FFEBEE" },
};

/* ══════════════════════════════════════════
   공용 컴포넌트
   ══════════════════════════════════════════ */

function EditIcon({ size = 12, color = COLOR.sageMid }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function EditBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 22, height: 22, borderRadius: 6,
        background: "transparent", border: "none", cursor: "pointer", flexShrink: 0,
      }}
    >
      <EditIcon />
    </button>
  );
}

function ScoreHearts({ score, onChange, size = 18 }: { score: number; onChange?: (v: number) => void; size?: number }) {
  const HEART = "M15 12 Q13 5 9 5 Q5 5 5 9 Q5 13 15 19 Q25 13 25 9 Q25 5 21 5 Q17 5 15 12Z";
  const fullHearts = Math.floor(score / 2);
  const hasHalf = score % 2 === 1;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
      {[0, 1, 2, 3, 4].map((i) => {
        let fill = "#D4D4D4";
        if (i < fullHearts) fill = "#C06B45";
        else if (i === fullHearts && hasHalf) fill = "#D9A08A";
        return onChange ? (
          <button key={i} type="button" onClick={() => onChange((i + 1) * 2)}
            style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer" }}>
            <svg width={size} height={size * 0.78} viewBox="0 0 30 24" fill="none"><path d={HEART} fill={fill} /></svg>
          </button>
        ) : (
          <svg key={i} width={size} height={size * 0.78} viewBox="0 0 30 24" fill="none"><path d={HEART} fill={fill} /></svg>
        );
      })}
    </span>
  );
}

/* ══════════════════════════════════════════
   메인
   ══════════════════════════════════════════ */

function ChartContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEmbedded = searchParams.get("embedded") === "true";
  const chatOpenParam = searchParams.get("chatOpen") === "true";

  /* ── 환자 기본 정보 ── */
  const [patient, setPatient] = useState<Patient>(MOCK_PATIENT);
  const [editingBasicField, setEditingBasicField] = useState<string | null>(null);
  const [editBasicValue, setEditBasicValue] = useState<Record<string, string>>({});
  /* pharmacist_charts.id — UPDATE 시 사용. Mock 모드(UUID 가드 실패)에선 null 유지. */
  const [chartRowId, setChartRowId] = useState<string | null>(null);
  /* 차트 동기화 토스트 — DB UPDATE 실패 시 등 약사에게 즉시 알림. */
  const [chartToast, setChartToast] = useState<string | null>(null);
  const chartToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showChartToast = (msg: string) => {
    setChartToast(msg);
    if (chartToastTimerRef.current) clearTimeout(chartToastTimerRef.current);
    chartToastTimerRef.current = setTimeout(() => setChartToast(null), 3000);
  };
  /* 차트 성공 토스트 — chartToast(살구색 에러 톤)와 시각적 분리 위해 sage-pale 톤 별도 운용. */
  const [chartSuccessToast, setChartSuccessToast] = useState<string | null>(null);
  const chartSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showChartSuccess = (msg: string) => {
    setChartSuccessToast(msg);
    if (chartSuccessTimerRef.current) clearTimeout(chartSuccessTimerRef.current);
    chartSuccessTimerRef.current = setTimeout(() => setChartSuccessToast(null), 3000);
  };

  const startBasicEdit = (field: string) => {
    setEditingBasicField(field);
    if (field === "name") setEditBasicValue({ name: patient.name });
    else if (field === "birthDate") {
      if (patient.birthDate) {
        const [y, m, d] = patient.birthDate.split("-");
        setEditBasicValue({
          birthYear: y,
          birthMonth: String(parseInt(m, 10)),
          birthDay: String(parseInt(d, 10)),
        });
      } else {
        // birth_year 만 있을 때: 년 칸 채우고 월/일 비움. 박소담 약사 A 결정.
        setEditBasicValue({
          birthYear: patient.birthYear ? String(patient.birthYear) : "",
          birthMonth: "",
          birthDay: "",
        });
      }
    }
    else if (field === "gender") setEditBasicValue({ gender: patient.gender });
    else if (field === "height") setEditBasicValue({ height: String(patient.height) });
    else if (field === "weight") setEditBasicValue({ weight: String(patient.weight) });
    else if (field === "budget") setEditBasicValue({ budget: patient.budget });
  };
  const cancelBasicEdit = () => { setEditingBasicField(null); setEditBasicValue({}); };

  /** pharmacist_charts UPDATE 헬퍼 — chartRowId 있을 때만. Mock 모드(없음)는 로컬만. */
  const persistChartUpdate = async (
    patch: Partial<{
      patient_name: string;
      birth_year: number | null;
      birth_date: string | null;
      gender: string | null;
      height_cm: number;
      weight_kg: number;
      weight_recorded_at: string;
      budget: string;
    }>,
  ): Promise<boolean> => {
    if (!chartRowId) return true; // Mock 모드 — 성공 처리
    type ChartUpdate = typeof patch;
    const upResp = await (supabase
      .from("pharmacist_charts") as unknown as {
        update: (p: ChartUpdate) => {
          eq: (col: string, val: string) => Promise<{ error: { message: string; code?: string } | null }>;
        };
      })
      .update(patch)
      .eq("id", chartRowId);
    if (upResp.error) {
      console.error("[chart-sync] update failed:", upResp.error);
      return false;
    }
    return true;
  };

  const saveBasicEdit = async () => {
    if (!editingBasicField) return;
    const field = editingBasicField;

    if (field === "name") {
      const v = (editBasicValue.name || "").trim();
      if (!v) { showChartToast("이름을 입력해주세요"); return; }
      const ok = await persistChartUpdate({ patient_name: v });
      if (!ok) { showChartToast("저장 실패. 다시 시도해주세요"); return; }
      setPatient((p) => ({ ...p, name: v }));
      cancelBasicEdit();
      return;
    }

    if (field === "birthDate") {
      const y = parseInt(editBasicValue.birthYear || "", 10);
      const mRaw = editBasicValue.birthMonth || "";
      const dRaw = editBasicValue.birthDay || "";
      if (!Number.isFinite(y) || y < 1920 || y > new Date().getFullYear()) {
        showChartToast("출생연도가 올바르지 않습니다 (1920~)");
        return;
      }
      // 월/일 둘 다 빈 칸이면 birth_year 만 저장 (박소담 약사 A 결정 — 부분 입력 허용)
      if (mRaw.trim() === "" && dRaw.trim() === "") {
        const ok = await persistChartUpdate({ birth_year: y, birth_date: null });
        if (!ok) { showChartToast("저장 실패. 다시 시도해주세요"); return; }
        setPatient((p) => ({ ...p, birthYear: y, birthDate: null }));
        cancelBasicEdit();
        return;
      }
      const m = parseInt(mRaw, 10);
      const d = parseInt(dRaw, 10);
      if (!Number.isFinite(m) || m < 1 || m > 12) {
        showChartToast("월이 올바르지 않습니다 (1~12)");
        return;
      }
      const maxDay = new Date(y, m, 0).getDate();
      if (!Number.isFinite(d) || d < 1 || d > maxDay) {
        showChartToast(`${y}년 ${m}월은 1~${maxDay}일입니다`);
        return;
      }
      const synthesized = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (new Date(synthesized) > new Date()) {
        showChartToast("미래 날짜는 입력할 수 없습니다");
        return;
      }
      const ok = await persistChartUpdate({ birth_year: y, birth_date: synthesized });
      if (!ok) { showChartToast("저장 실패. 다시 시도해주세요"); return; }
      setPatient((p) => ({ ...p, birthYear: y, birthDate: synthesized }));
      cancelBasicEdit();
      return;
    }

    if (field === "gender") {
      const v = editBasicValue.gender;
      if (!v) { cancelBasicEdit(); return; }
      const ok = await persistChartUpdate({ gender: mapGenderToEn(v) });
      if (!ok) { showChartToast("저장 실패. 다시 시도해주세요"); return; }
      setPatient((p) => ({ ...p, gender: v }));
      cancelBasicEdit();
      return;
    }

    if (field === "height") {
      const h = parseInt(editBasicValue.height, 10);
      if (!Number.isFinite(h) || h <= 0 || h >= 300) {
        showChartToast("키가 올바르지 않습니다");
        return;
      }
      const ok = await persistChartUpdate({ height_cm: h });
      if (!ok) { showChartToast("저장 실패. 다시 시도해주세요"); return; }
      setPatient((p) => ({ ...p, height: h }));
      cancelBasicEdit();
      return;
    }

    if (field === "weight") {
      const w = parseFloat(editBasicValue.weight);
      if (!Number.isFinite(w) || w <= 0 || w >= 500) {
        showChartToast("몸무게가 올바르지 않습니다");
        return;
      }
      const today = todayIso();
      const ok = await persistChartUpdate({ weight_kg: w, weight_recorded_at: today });
      if (!ok) { showChartToast("저장 실패. 다시 시도해주세요"); return; }
      setPatient((p) => ({ ...p, weight: w, weightRecordedAt: today }));
      cancelBasicEdit();
      return;
    }

    if (field === "budget") {
      const v = (editBasicValue.budget || "").trim();
      if (!v) { cancelBasicEdit(); return; }
      const ok = await persistChartUpdate({ budget: v });
      if (!ok) { showChartToast("저장 실패. 다시 시도해주세요"); return; }
      setPatient((p) => ({ ...p, budget: v }));
      cancelBasicEdit();
      return;
    }

    cancelBasicEdit();
  };
  const currentAge = calcAgeFromBirthDate(patient.birthDate, patient.birthYear);

  /* ── 약사 메모 (환자 전체) ── */
  const [editingPharmacistMemo, setEditingPharmacistMemo] = useState(false);
  const [pharmacistMemoDraft, setPharmacistMemoDraft] = useState(patient.pharmacistMemo);
  const savePharmacistMemo = () => {
    setPatient((p) => ({ ...p, pharmacistMemo: pharmacistMemoDraft }));
    setEditingPharmacistMemo(false);
  };
  const cancelPharmacistMemo = () => {
    setPharmacistMemoDraft(patient.pharmacistMemo);
    setEditingPharmacistMemo(false);
  };

  /* ── 현재 증상 (Problem List) ── */
  const [problems, setProblems] = useState<ProblemItem[]>(INITIAL_PROBLEMS);
  const [expandedProblems, setExpandedProblems] = useState<Set<string>>(new Set());
  const [statusDropdownOpen, setStatusDropdownOpen] = useState<string | null>(null);
  const [addingMemoForProblem, setAddingMemoForProblem] = useState<string | null>(null);
  const [newProblemMemo, setNewProblemMemo] = useState("");
  const [showAddSymptomModal, setShowAddSymptomModal] = useState(false);
  const [addSymptomSelected, setAddSymptomSelected] = useState<string | null>(null);
  const [addSymptomCustom, setAddSymptomCustom] = useState("");
  const [addSymptomQuickPick, setAddSymptomQuickPick] = useState<string | null>(null);
  const [addSymptomStartDate, setAddSymptomStartDate] = useState("");
  const [addSymptomDurationText, setAddSymptomDurationText] = useState("");

  const toggleProblem = (id: string) => {
    setExpandedProblems((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const updateProblemStatus = (id: string, newStatus: ProblemStatus) => {
    setProblems((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        if (newStatus === "해결됨") return { ...p, status: newStatus, endDate: p.endDate || todayIso() };
        if (p.status === "해결됨") return { ...p, status: newStatus, endDate: undefined };
        return { ...p, status: newStatus };
      })
    );
    setStatusDropdownOpen(null);
  };
  const updateProblemSeverity = (id: string, v: number) =>
    setProblems((prev) => prev.map((p) => (p.id === id ? { ...p, severity: v } : p)));
  const addProblemMemo = (id: string) => {
    const text = newProblemMemo.trim();
    if (!text) return;
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    setProblems((prev) =>
      prev.map((p) => (p.id === id ? { ...p, memo: [{ date: `${mm}.${dd}`, text }, ...p.memo] } : p))
    );
    setNewProblemMemo("");
    setAddingMemoForProblem(null);
  };
  const addNewSymptom = () => {
    const label = addSymptomSelected || addSymptomCustom.trim();
    if (!label) return;
    const opt = SYMPTOM_OPTIONS.find((o) => o.label === label);
    const newItem: ProblemItem = {
      id: `p${Date.now()}`, label,
      color: opt?.color || COLOR.terra,
      bg: opt?.bg || COLOR.terraLight,
      startDate: addSymptomDurationText ? "" : (addSymptomStartDate || (addSymptomQuickPick ? calcDateFromQuick(addSymptomQuickPick) : todayIso())),
      durationQuick: addSymptomDurationText ? undefined : (addSymptomQuickPick || undefined),
      durationText: addSymptomDurationText || undefined,
      status: "상담 중", severity: 3,
      quickNote: "", memo: [],
    };
    setProblems((prev) => [...prev, newItem]);
    setShowAddSymptomModal(false);
    setAddSymptomSelected(null);
    setAddSymptomCustom("");
    setAddSymptomQuickPick(null);
    setAddSymptomStartDate("");
    setAddSymptomDurationText("");
  };
  const removeProblem = (id: string) => setProblems((prev) => prev.filter((p) => p.id !== id));
  const currentProblems = problems.filter((p) => p.status !== "해결됨");
  const resolvedProblems = problems.filter((p) => p.status === "해결됨");

  /* ── 문답 기록 (Consultations) ── */
  const [consultations] = useState<Consultation[]>(MOCK_CONSULTATIONS);
  // 최신이 가장 위로
  const sortedConsultations = [...consultations].sort((a, b) => (a.requestedAt > b.requestedAt ? -1 : 1));
  const latestConsultId = sortedConsultations[0]?.id;
  const [openConsultationIds, setOpenConsultationIds] = useState<Set<string>>(
    new Set(latestConsultId ? [latestConsultId] : [])
  );
  const toggleConsultation = (id: string) => {
    setOpenConsultationIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const [expandedFreeTextIds, setExpandedFreeTextIds] = useState<Set<string>>(new Set());
  const toggleFreeText = (id: string) => {
    setExpandedFreeTextIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  /* ── 환자 건강지표 (Health Checks) ── */
  const healthChecks = MOCK_HEALTH_CHECKS;
  const sortedHealthChecks = [...healthChecks].sort((a, b) => (a.date > b.date ? 1 : -1));
  const prevCheck = sortedHealthChecks[sortedHealthChecks.length - 2];
  const latestCheck = sortedHealthChecks[sortedHealthChecks.length - 1];

  /* ── 추가 질문 답변 ── */
  const showAdditionalAnswerEmpty = false; // true면 빈 상태, false면 답변 표시
  const [additionalAnswers] = useState<AdditionalAnswerSet[]>(MOCK_ADDITIONAL_ANSWERS);
  const sortedAdditionalAnswers = [...additionalAnswers].sort((a, b) => (a.answeredAt > b.answeredAt ? -1 : 1));
  const [expandedAnswerSets, setExpandedAnswerSets] = useState<Set<string>>(
    () => new Set(sortedAdditionalAnswers.slice(0, 1).map((a) => a.id))
  );
  const toggleAnswerSet = (id: string) => {
    setExpandedAnswerSets((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  /* ── 방문 기록 ── */
  const [visits, setVisits] = useState<VisitRecord[]>(MOCK_VISITS);
  const sortedVisits = [...visits].sort((a, b) => (a.date > b.date ? -1 : 1));
  const [expandedVisits, setExpandedVisits] = useState<Set<string>>(
    new Set(sortedVisits.slice(0, 1).map((v) => v.id))
  );

  /* ── visit_records DB 로드 (consultation_id 기준) ── */
  const params = useParams();
  const consultationId = typeof params?.id === "string" ? params.id : null;
  const { user: authUser } = useAuth();
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isUuid = (s: string | null | undefined): s is string => !!s && UUID_RE.test(s);

  /* ── pharmacist_charts SELECT/INSERT — 마운트 시 1회 ──
   *  1) SELECT consultation_id 기준 (RLS 가 pharmacist_id 자동 필터)
   *  2) 있으면 setChartRowId + setPatient 머지 종료
   *  3) 없으면 consultations JOIN profiles + patient_profiles 로 초기값 만들어 INSERT
   *  4) UNIQUE(pharmacist_id, consultation_id) 위반 (race) 발생 시 SELECT 한 번 더 시도
   *  모든 에러: silent fail (console.error), Mock 폴백 유지. */
  useEffect(() => {
    if (!consultationId || !isUuid(consultationId)) return;
    if (!authUser) return;
    let cancelled = false;
    const pharmacistId = authUser.id;

    type ChartSelectRow = {
      id: string;
      patient_id: string | null;
      patient_name: string;
      birth_year: number | null;
      birth_date: string | null;
      gender: string | null;
      height_cm: number | null;
      weight_kg: number | null;
      weight_recorded_at: string | null;
      budget: string | null;
      pharmacist_memo: string | null;
      chart_type: "self" | "family" | "walkin";
      family_relationship: string | null;
    };

    const applyRow = (row: ChartSelectRow) => {
      setChartRowId(row.id);
      setPatient((prev) => ({
        ...prev,
        id: row.patient_id ?? prev.id,
        name: row.patient_name || prev.name,
        birthYear: row.birth_year ?? prev.birthYear,
        birthDate: row.birth_date,
        gender: mapGenderToKo(row.gender) || prev.gender,
        height: row.height_cm ?? prev.height,
        weight: row.weight_kg ?? prev.weight,
        weightRecordedAt: row.weight_recorded_at ?? prev.weightRecordedAt,
        budget: row.budget ?? prev.budget,
        pharmacistMemo: row.pharmacist_memo ?? prev.pharmacistMemo,
      }));
    };

    const selectExisting = async (): Promise<ChartSelectRow | null> => {
      const { data, error } = await supabase
        .from("pharmacist_charts")
        .select(
          "id, patient_id, patient_name, birth_year, birth_date, gender, height_cm, weight_kg, weight_recorded_at, budget, pharmacist_memo, chart_type, family_relationship",
        )
        .eq("consultation_id", consultationId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle<ChartSelectRow>();
      if (error) {
        console.error("[chart-sync] select failed:", error);
        return null;
      }
      return data ?? null;
    };

    (async () => {
      const existing = await selectExisting();
      if (cancelled) return;
      if (existing) {
        applyRow(existing);
        return;
      }

      // 신규 INSERT — 초기값을 consultations + patient_profiles 에서 수집
      type ConsJoin = {
        patient_id: string;
        patient: { name: string | null } | null;
      };
      const consResp = await supabase
        .from("consultations")
        .select(
          "patient_id, patient:profiles!consultations_patient_id_fkey(name)",
        )
        .eq("id", consultationId)
        .maybeSingle<ConsJoin>();
      if (cancelled) return;
      if (consResp.error || !consResp.data) {
        console.error("[chart-sync] consultation join failed:", consResp.error);
        return;
      }
      const patientId = consResp.data.patient_id;
      const patientName = consResp.data.patient?.name?.trim() || "환자";

      type PpRow = {
        birth_year: number | null;
        birth_date: string | null;
        gender: string | null;
        height_cm: number | null;
        weight_kg: number | null;
        body_recorded_at: string | null;
      };
      const ppResp = await supabase
        .from("patient_profiles")
        .select("birth_year, birth_date, gender, height_cm, weight_kg, body_recorded_at")
        .eq("id", patientId)
        .maybeSingle<PpRow>();
      if (cancelled) return;
      if (ppResp.error) {
        console.error("[chart-sync] patient_profiles fetch failed:", ppResp.error);
      }
      const pp = ppResp.data ?? null;

      type ChartInsertPayload = {
        pharmacist_id: string;
        consultation_id: string;
        patient_id: string;
        patient_name: string;
        chart_type: "self";
        birth_year?: number | null;
        birth_date?: string | null;
        gender?: string | null;
        height_cm?: number | null;
        weight_kg?: number | null;
        weight_recorded_at?: string | null;
      };
      const insertPayload: ChartInsertPayload = {
        pharmacist_id: pharmacistId,
        consultation_id: consultationId,
        patient_id: patientId,
        patient_name: patientName,
        chart_type: "self",
        birth_year: pp?.birth_year ?? null,
        birth_date: pp?.birth_date ?? null,
        gender: pp?.gender ?? null,
        height_cm: pp?.height_cm ?? null,
        weight_kg: pp?.weight_kg ?? null,
        weight_recorded_at: pp?.body_recorded_at ? pp.body_recorded_at.slice(0, 10) : null,
      };

      const insResp = await (supabase
        .from("pharmacist_charts") as unknown as {
          insert: (p: ChartInsertPayload) => {
            select: (cols: string) => {
              maybeSingle: () => Promise<{
                data: ChartSelectRow | null;
                error: { message: string; code?: string } | null;
              }>;
            };
          };
        })
        .insert(insertPayload)
        .select(
          "id, patient_id, patient_name, birth_year, birth_date, gender, height_cm, weight_kg, weight_recorded_at, budget, pharmacist_memo, chart_type, family_relationship",
        )
        .maybeSingle();
      if (cancelled) return;
      if (insResp.error) {
        // UNIQUE(pharmacist_id, consultation_id) 위반 race — 다른 마운트가 먼저 INSERT 한 경우
        if (insResp.error.code === "23505") {
          const retry = await selectExisting();
          if (cancelled) return;
          if (retry) applyRow(retry);
          return;
        }
        console.error("[chart-sync] insert failed:", insResp.error);
        return;
      }
      if (insResp.data) applyRow(insResp.data);
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultationId, authUser?.id]);

  /* ── dosage_guides 발송 이력 SELECT — 본인 약사가 같은 consultation 에 보낸 모든 가이드 ──
   *  차수 모델 X / 누적 모델. 새로고침 후에도 발송 이력이 사이드 패널에 자동 복원됨. */
  useEffect(() => {
    if (!consultationId || !isUuid(consultationId) || !authUser?.id) {
      setGuideHistory([]);
      setGuideHistoryLoaded(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("dosage_guides")
        .select(
          "id, supplements, dosage_days, dosage_end_date, custom_guide, dosage_status, sent_at, created_at",
        )
        .eq("consultation_id", consultationId)
        .eq("pharmacist_id", authUser.id)
        .order("sent_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (error) {
        console.error("[chart] dosage_guides history load failed:", error);
        showChartToast("발송 이력을 불러오지 못했어요.");
        setGuideHistoryLoaded(true);
        return;
      }
      const rows = (data ?? []) as unknown as GuideHistoryRow[];
      setGuideHistory(rows);
      setGuideHistoryLoaded(true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultationId, authUser?.id]);

  useEffect(() => {
    if (!consultationId || !isUuid(consultationId)) return; // mock 차트(c1 등)는 DB 로드 스킵
    if (!authUser) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("visit_records")
        .select(
          "id, visit_date, purchased_supplements, dosage_days, patient_complaint, patient_improvement, pharmacist_guide, pharmacist_opinion, pharmacist_photos",
        )
        .eq("consultation_id", consultationId)
        .order("visit_date", { ascending: false });
      if (cancelled) return;
      if (error) {
        console.error("[chart] visit_records load failed:", error);
        return;
      }
      type VrRow = {
        id: string;
        visit_date: string;
        purchased_supplements: SupplementItem[] | null;
        dosage_days: number | null;
        patient_complaint: string | null;
        patient_improvement: string | null;
        pharmacist_guide: string | null;
        pharmacist_opinion: string | null;
        pharmacist_photos: string[] | null;
      };
      const rows = ((data ?? []) as unknown) as VrRow[];
      if (rows.length === 0) return; // mock 폴백 유지 (개발 편의)
      const mapped: VisitRecord[] = rows.map((r) => ({
        id: r.id,
        date: r.visit_date,
        products: Array.isArray(r.purchased_supplements) ? r.purchased_supplements : [],
        durationDays: r.dosage_days ?? undefined,
        complaint: r.patient_complaint ?? undefined,
        improvement: r.patient_improvement ?? undefined,
        pharmacistGuide: r.pharmacist_guide ?? undefined,
        pharmacistNote: r.pharmacist_opinion ?? undefined,
        photos: Array.isArray(r.pharmacist_photos)
          ? r.pharmacist_photos.filter((u): u is string => typeof u === "string" && u.length > 0)
          : [],
      }));
      setVisits(mapped);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultationId, authUser]);

  /* ── 차트 사진 업로드 (chart-photos 버킷) ── */
  const CHART_BUCKET = "chart-photos";
  const ALLOWED_IMG = ["image/jpeg", "image/png", "image/webp"];
  const MAX_BYTES = 5 * 1024 * 1024;
  const MAX_VISIT_PHOTOS = 4;
  const [photoUploading, setPhotoUploading] = useState<string | null>(null); // visitId
  const [photoToast, setPhotoToast] = useState<string | null>(null);
  const photoToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showPhotoToast = (msg: string) => {
    setPhotoToast(msg);
    if (photoToastTimerRef.current) clearTimeout(photoToastTimerRef.current);
    photoToastTimerRef.current = setTimeout(() => setPhotoToast(null), 2500);
  };
  const extractStoragePath = (publicUrl: string, bucket: string): string | null => {
    const marker = `/storage/v1/object/public/${bucket}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return null;
    return publicUrl.slice(idx + marker.length);
  };
  // visit.id 가 UUID 인 경우만 DB UPDATE 수행 (mock visit 은 로컬 state 만 갱신)
  const persistVisitPhotos = async (visitId: string, photos: string[]) => {
    if (!isUuid(visitId)) return;
    type Vu = { pharmacist_photos: string[] };
    const { error } = await (supabase
      .from("visit_records") as unknown as {
        update: (p: Vu) => { eq: (col: string, val: string) => Promise<{ error: { message: string } | null }> };
      })
      .update({ pharmacist_photos: photos })
      .eq("id", visitId);
    if (error) console.error("[chart] visit_records photos UPDATE failed:", error);
  };
  const addVisitPhotos = async (visitId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!authUser) {
      showPhotoToast("로그인이 필요해요");
      return;
    }
    const target = visits.find((v) => v.id === visitId);
    if (!target) return;
    if (target.photos.length >= MAX_VISIT_PHOTOS) {
      showPhotoToast(`방문당 최대 ${MAX_VISIT_PHOTOS}장까지 등록 가능합니다`);
      return;
    }
    const remaining = MAX_VISIT_PHOTOS - target.photos.length;
    const incoming = Array.from(files).slice(0, remaining);
    if (Array.from(files).length > remaining) {
      showPhotoToast(`방문당 최대 ${MAX_VISIT_PHOTOS}장까지 등록 가능합니다`);
    }
    setPhotoUploading(visitId);
    const newUrls: string[] = [];
    for (let i = 0; i < incoming.length; i++) {
      const file = incoming[i];
      if (!ALLOWED_IMG.includes(file.type)) {
        showPhotoToast("지원하지 않는 형식입니다 (jpg/png/webp)");
        continue;
      }
      if (file.size > MAX_BYTES) {
        showPhotoToast("파일 크기는 5MB 이하만 가능합니다");
        continue;
      }
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
      const consPart = consultationId || "no-cons";
      const path = `${authUser.id}/${consPart}/${visitId}/${Date.now()}-${i}.${safeExt}`;
      const { error: upErr } = await supabase.storage
        .from(CHART_BUCKET)
        .upload(path, file, { upsert: false, cacheControl: "3600", contentType: file.type });
      if (upErr) {
        console.error("[chart] chart-photos upload failed:", upErr);
        showPhotoToast(`업로드 실패: ${upErr.message}`);
        continue;
      }
      const { data: pub } = supabase.storage.from(CHART_BUCKET).getPublicUrl(path);
      if (pub?.publicUrl) newUrls.push(pub.publicUrl);
    }
    if (newUrls.length > 0) {
      const nextPhotos = [...target.photos, ...newUrls];
      setVisits((prev) => prev.map((v) => (v.id === visitId ? { ...v, photos: nextPhotos } : v)));
      await persistVisitPhotos(visitId, nextPhotos);
      showPhotoToast(`사진 ${newUrls.length}장 업로드 완료`);
    }
    setPhotoUploading(null);
  };
  const removeVisitPhoto = async (visitId: string, photoUrl: string) => {
    const target = visits.find((v) => v.id === visitId);
    if (!target) return;
    const nextPhotos = target.photos.filter((p) => p !== photoUrl);
    setVisits((prev) => prev.map((v) => (v.id === visitId ? { ...v, photos: nextPhotos } : v)));
    const path = extractStoragePath(photoUrl, CHART_BUCKET);
    if (path) {
      const { error: delErr } = await supabase.storage.from(CHART_BUCKET).remove([path]);
      if (delErr) console.warn("[chart] chart-photos remove failed (DB 갱신은 진행):", delErr);
    }
    await persistVisitPhotos(visitId, nextPhotos);
  };
  const toggleVisit = (id: string) => {
    setExpandedVisits((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const updateVisit = (id: string, patch: Partial<VisitRecord>) => {
    setVisits((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  };
  const [editingDosageVisitId, setEditingDosageVisitId] = useState<string | null>(null);
  const [editDosageDaysValue, setEditDosageDaysValue] = useState("");
  const startEditDosageDays = (id: string, cur?: number) => {
    setEditingDosageVisitId(id);
    setEditDosageDaysValue(cur ? String(cur) : "");
  };
  const saveDosageDays = (id: string) => {
    const val = parseInt(editDosageDaysValue, 10);
    if (val > 0) updateVisit(id, { durationDays: val });
    setEditingDosageVisitId(null);
    setEditDosageDaysValue("");
  };
  const [editingVisitField, setEditingVisitField] = useState<{ id: string; field: keyof VisitRecord } | null>(null);
  const [editVisitValue, setEditVisitValue] = useState("");
  const getVisitEndDate = (v: VisitRecord): string | null => {
    if (!v.durationDays) return null;
    const [y, m, d] = v.date.split("-").map(Number);
    const end = new Date(y, m - 1, d + v.durationDays);
    return `${end.getFullYear()}.${String(end.getMonth() + 1).padStart(2, "0")}.${String(end.getDate()).padStart(2, "0")}`;
  };

  /* ── 채팅 사이드 패널 (iframe으로 /chat/[id]?role=pharmacist 임베드) ── */
  const [showChatPanel, setShowChatPanel] = useState(chatOpenParam);

  /* ── 복용 가이드 사이드 패널 ── */
  const [showGuidePanel, setShowGuidePanel] = useState(false);
  const [guideSupps, setGuideSupps] = useState<SupplementItem[]>([{ ...EMPTY_SUPP }]);
  const [guideMemo, setGuideMemo] = useState("");
  const [sentBadgeVisible, setSentBadgeVisible] = useState(false);
  /* 가이드 전송 성공 박스 — 사이드 패널 내부 중앙에 떠 있는 박스 팝업. 3.5초 자동 사라짐.
   *  확인 팝업(guideShowConfirm)과 동일한 absolute inset:0 오버레이 패턴. */
  const [guideSuccessMsg, setGuideSuccessMsg] = useState<string | null>(null);
  const guideSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showGuideSuccess = (msg: string) => {
    setGuideSuccessMsg(msg);
    if (guideSuccessTimerRef.current) clearTimeout(guideSuccessTimerRef.current);
    guideSuccessTimerRef.current = setTimeout(() => setGuideSuccessMsg(null), 3500);
  };
  const clearGuideSuccess = () => {
    if (guideSuccessTimerRef.current) clearTimeout(guideSuccessTimerRef.current);
    guideSuccessTimerRef.current = null;
    setGuideSuccessMsg(null);
  };
  /* 발송 이력 — 같은 consultation + 본인 약사 가 보낸 dosage_guides 전체 (active/completed/stopped).
   *  차수 없이 누적 모델. 새 가이드는 기존 active 를 종료시키지 않음. */
  type GuideHistoryRow = {
    id: string;
    supplements: unknown;
    dosage_days: number | null;
    dosage_end_date: string | null;
    custom_guide: string | null;
    dosage_status: "active" | "completed" | "stopped";
    sent_at: string | null;
    created_at: string;
  };
  const [guideHistory, setGuideHistory] = useState<GuideHistoryRow[]>([]);
  const [guideHistoryLoaded, setGuideHistoryLoaded] = useState(false);
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Set<string>>(new Set());
  const toggleHistoryExpanded = (id: string) =>
    setExpandedHistoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const [guideShowConfirm, setGuideShowConfirm] = useState(false);
  const copyGuideFromVisit = () => {
    const latest = sortedVisits[0];
    if (latest && latest.products.length > 0) {
      // 레거시 visit_records.purchased_supplements 는 dispense_type/days/time_slots 가 없을 수 있음
      // → 통약 기본값 + 방문 기록의 durationDays 가 있으면 각 영양제 days 로 동일 적용.
      const defaultDays = latest.durationDays ?? null;
      setGuideSupps(latest.products.map((p) => ({
        name: p.name,
        dosage: p.dosage,
        timing: p.timing,
        dispense_type: p.dispense_type ?? "bottle",
        time_slots: Array.isArray(p.time_slots) ? p.time_slots : [],
        days: p.days ?? defaultDays,
        daily_count: p.daily_count && p.daily_count > 0 ? p.daily_count : null,
        etc_note: typeof p.etc_note === "string" ? p.etc_note : "",
        memo: typeof p.memo === "string" ? p.memo : "",
        package_note: typeof p.package_note === "boolean" ? p.package_note : true,
      })));
    }
  };
  const clearGuide = () => {
    setGuideSupps([{ ...EMPTY_SUPP }]);
    setGuideMemo("");
  };
  /* ── 복용 가이드 전송 ──
   *  1) UUID 가드 — mock 차트(/chart/1 등)는 기존 시뮬레이션 동작 유지
   *  2) dosage_guides INSERT — supplements jsonb 는 마이페이지 약속 형식
   *     [{ name, time_slots, dosage, timing, memo? }] 으로 옵션 B 병기 저장
   *  3) [DOSAGE_GUIDE_SENT] 시스템 메시지 fire-and-forget — 실패해도 본 흐름 진행
   *  4) UI 후처리 (sentBadge, 성공 토스트) — 종료 토큰 흐름과 일관 */
  const confirmSendGuide = async () => {
    const validSupps = guideSupps.filter((s) => s.name.trim());
    if (validSupps.length === 0) {
      showChartToast("영양제를 1개 이상 입력해주세요");
      return;
    }

    // 1) mock 모드 가드
    if (!isUuid(consultationId) || !isUuid(patient.id) || !authUser?.id) {
      setGuideShowConfirm(false);
      // 입력 폼 clear (다음 발송 준비)
      setGuideSupps([{ ...EMPTY_SUPP }]);
      setGuideMemo("");
      setSentBadgeVisible(true);
      setTimeout(() => setSentBadgeVisible(false), 3500);
      const mockPatientName = patient.name?.trim() || "환자";
      showGuideSuccess(`(개발 모드) ${mockPatientName}님 가이드 전송 시뮬레이션`);
      return;
    }

    // 2) supplements jsonb — 통약/소분 입력 필드 동일. dosage/timing 모두 양쪽 보존.
    //    timing = "식후 30분" 등 부가 설명 전용 (슬롯과 무관, 자유텍스트 파싱 폐기)
    //    daily_count: 직접 입력값 우선, 미입력이면 슬롯 개수, 그것도 0이면 1 폴백
    //    etc_note: "기타" 슬롯 선택 시에만 저장 / memo: 영양제별 환자 안내 메모
    const supplementsJson = validSupps.map((s) => {
      const dosageText = (s.dosage ?? "").trim();
      const timingText = (s.timing ?? "").trim();
      const slots = Array.isArray(s.time_slots) ? s.time_slots : [];
      const hasEtc = slots.includes("기타");
      const dailyCount = s.daily_count && s.daily_count > 0
        ? s.daily_count
        : (slots.length > 0 ? slots.length : 1);
      return {
        name: s.name.trim(),
        dispense_type: (s.dispense_type ?? "bottle") as "bottle" | "compounded",
        time_slots: slots,
        dosage: dosageText,
        timing: timingText,
        days: s.days ?? null,
        daily_count: dailyCount,
        etc_note: hasEtc ? (s.etc_note ?? "").trim() : "",
        memo: (s.memo ?? "").trim(),
        package_note: s.package_note ?? true,
      };
    });

    // 3) 가이드 전체 종료일 = max(영양제별 days) 기준. guideEndDate 가 이미 계산되어 있음.
    const endDateIso = guideEndDate ? guideEndDate.replaceAll(".", "-") : null;

    setGuideShowConfirm(false);

    // 4) dosage_guides INSERT
    type DosageGuideInsertPayload = {
      consultation_id: string;
      round_id: string | null;
      pharmacist_id: string;
      patient_id: string;
      supplements: typeof supplementsJson;
      dosage_days: number | null;
      dosage_end_date: string | null;
      custom_guide: string | null;
      dosage_status: "active";
      sent_at: string;
    };
    const guidePayload: DosageGuideInsertPayload = {
      consultation_id: consultationId,
      round_id: null,
      pharmacist_id: authUser.id,
      patient_id: patient.id,
      supplements: supplementsJson,
      dosage_days: guideMaxDays > 0 ? guideMaxDays : null,
      dosage_end_date: endDateIso,
      custom_guide: guideMemo.trim() || null,
      dosage_status: "active",
      sent_at: new Date().toISOString(),
    };
    const guideResp = await (supabase
      .from("dosage_guides") as unknown as {
        insert: (p: DosageGuideInsertPayload) => {
          select: () => {
            single: () => Promise<{
              data: { id: string } | null;
              error: { message: string; code?: string } | null;
            }>;
          };
        };
      })
      .insert(guidePayload)
      .select()
      .single();

    if (guideResp.error || !guideResp.data) {
      console.error("[chart] dosage_guides insert failed:", guideResp.error);
      showChartToast("가이드 전송에 실패했어요. 잠시 후 다시 시도해주세요.");
      return;
    }

    // 5) 시스템 메시지 fire-and-forget — INSERT 실패해도 본 흐름은 진행
    type SystemMsgPayload = {
      consultation_id: string;
      sender_id: string;
      content: string;
      message_type: "system";
      round_id: string | null;
      is_read: boolean;
      metadata: { dosage_guide_id: string };
    };
    const sysPayload: SystemMsgPayload = {
      consultation_id: consultationId,
      sender_id: authUser.id,
      content: "[DOSAGE_GUIDE_SENT]",
      message_type: "system",
      round_id: null,
      is_read: true,
      metadata: { dosage_guide_id: guideResp.data.id },
    };
    void (supabase
      .from("messages") as unknown as {
        insert: (p: SystemMsgPayload) => Promise<{ error: { message: string } | null }>;
      })
      .insert(sysPayload)
      .then(({ error }) => {
        if (error) {
          console.error("[chart] dosage_guide system message insert failed (non-fatal):", error);
        }
      });

    // 6) UI 후처리 — 누적 모델: history 즉시 추가 + 입력 폼 clear + 다음 발송 즉시 가능
    const newRow: GuideHistoryRow = {
      id: guideResp.data.id,
      supplements: supplementsJson,
      dosage_days: guidePayload.dosage_days,
      dosage_end_date: guidePayload.dosage_end_date,
      custom_guide: guidePayload.custom_guide,
      dosage_status: guidePayload.dosage_status,
      sent_at: guidePayload.sent_at,
      created_at: guidePayload.sent_at,
    };
    setGuideHistory((prev) => [newRow, ...prev]);
    setGuideSupps([{ ...EMPTY_SUPP }]);
    setGuideMemo("");
    setSentBadgeVisible(true);
    setTimeout(() => setSentBadgeVisible(false), 3500);
    const sentPatientName = patient.name?.trim() || "환자";
    showGuideSuccess(`복용 가이드를 ${sentPatientName}님께 보냈어요`);
  };
  const addGuideSupp = () => setGuideSupps((p) => [...p, { ...EMPTY_SUPP }]);
  /** 영양제 행의 텍스트 필드(name/dosage/timing) 갱신. dispense_type/time_slots/days 는 전용 헬퍼 사용. */
  const updateGuideSupp = (i: number, f: "name" | "dosage" | "timing", v: string) =>
    setGuideSupps((p) => p.map((s, idx) => (idx === i ? { ...s, [f]: v } : s)));
  /** 통약(bottle) ↔ 소분(compounded) 토글. 입력 필드는 양쪽 동일.
   *  · bottle → compounded: 빈 name/dosage 에 기본값 채움
   *  · compounded → bottle: 기본값 그대로 남아있는 경우만 비움 (약사가 수정한 값은 보존) */
  const setGuideSuppDispense = (i: number, dispense: "bottle" | "compounded") =>
    setGuideSupps((p) => p.map((s, idx) => {
      if (idx !== i) return s;
      const next: SupplementItem = { ...s, dispense_type: dispense };
      if (dispense === "compounded") {
        if (!s.name.trim()) next.name = COMPOUND_DEFAULT_NAME;
        if (!s.dosage.trim()) next.dosage = COMPOUND_DEFAULT_DOSAGE;
      } else {
        // 소분 → 통약 전환: 자동 채움 값이 그대로면 비움
        if (s.name === COMPOUND_DEFAULT_NAME) next.name = "";
        if (s.dosage === COMPOUND_DEFAULT_DOSAGE) next.dosage = "";
      }
      return next;
    }));
  /** 5칩 슬롯 토글 (통약·소분 공통). 토글 직후 daily_count 를 슬롯 개수로 자동 동기화.
   *  약사가 daily_count 를 직접 수정한 뒤에도 칩을 누르면 칩 개수로 덮어쓰는 게 의도된 동작.
   *  슬롯 0개가 되면 daily_count 도 null 로 (placeholder 1 노출). */
  const toggleGuideSuppSlot = (i: number, slot: TimeSlotKr) =>
    setGuideSupps((p) => p.map((s, idx) => {
      if (idx !== i) return s;
      const prev = Array.isArray(s.time_slots) ? s.time_slots : [];
      const has = prev.includes(slot);
      const next = has ? prev.filter((x) => x !== slot) : [...prev, slot];
      const nextDailyCount = next.length > 0 ? next.length : null;
      // "기타" 해제 시 etc_note 도 초기화
      const nextEtcNote = next.includes("기타") ? (s.etc_note ?? "") : "";
      return { ...s, time_slots: next, daily_count: nextDailyCount, etc_note: nextEtcNote };
    }));
  /** 영양제별 일수 갱신. 빈 문자열/잘못된 값은 null 로. */
  const setGuideSuppDays = (i: number, raw: string) =>
    setGuideSupps((p) => p.map((s, idx) => {
      if (idx !== i) return s;
      const v = parseInt(raw, 10);
      return { ...s, days: Number.isFinite(v) && v > 0 ? v : null };
    }));
  /** 영양제별 하루 복용 횟수 갱신. 빈 칸/잘못된 값은 null (placeholder 1 표시). */
  const setGuideSuppDailyCount = (i: number, raw: string) =>
    setGuideSupps((p) => p.map((s, idx) => {
      if (idx !== i) return s;
      const trimmed = raw.trim();
      if (trimmed === "") return { ...s, daily_count: null };
      const v = parseInt(trimmed, 10);
      return { ...s, daily_count: Number.isFinite(v) && v > 0 ? v : null };
    }));
  /** "기타" 슬롯 부가 메모 (예: "오전 11시"). */
  const setGuideSuppEtcNote = (i: number, raw: string) =>
    setGuideSupps((p) => p.map((s, idx) => (idx === i ? { ...s, etc_note: raw } : s)));
  /** 영양제별 메모 (환자에게 표시). 최대 200자. */
  const setGuideSuppMemo = (i: number, raw: string) =>
    setGuideSupps((p) => p.map((s, idx) => {
      if (idx !== i) return s;
      const truncated = raw.length > 200 ? raw.slice(0, 200) : raw;
      return { ...s, memo: truncated };
    }));
  /** 소분 조제약 "약포지에 표시된 대로 복용 안내 보내기" 체크박스 토글. */
  const setGuideSuppPackageNote = (i: number, checked: boolean) =>
    setGuideSupps((p) => p.map((s, idx) => (idx === i ? { ...s, package_note: checked } : s)));
  const removeGuideSupp = (i: number) => setGuideSupps((p) => p.filter((_, idx) => idx !== i));
  /** 가이드 전체 종료일 = max(영양제별 days) 기준 자동 계산. 0/null 만 있으면 null. */
  const guideMaxDays = (() => {
    const ns = guideSupps.map((s) => s.days ?? 0).filter((d) => d > 0);
    return ns.length === 0 ? 0 : Math.max(...ns);
  })();
  const guideEndDate = (() => {
    if (guideMaxDays <= 0) return null;
    const end = new Date();
    end.setDate(end.getDate() + guideMaxDays);
    return `${end.getFullYear()}.${String(end.getMonth() + 1).padStart(2, "0")}.${String(end.getDate()).padStart(2, "0")}`;
  })();
  const canSendGuide = guideSupps.some((s) => s.name.trim()) || guideMemo.trim().length > 0;
  const requestSendGuide = () => {
    if (!canSendGuide) return;
    setGuideShowConfirm(true);
  };

  const handleChatToggle = () => {
    setShowGuidePanel(false);
    clearGuideSuccess();
    setShowChatPanel((v) => !v);
  };
  const handleGuideToggle = () => {
    setShowChatPanel(false);
    setShowGuidePanel((v) => {
      if (v) clearGuideSuccess(); // 닫기 전환일 때만 정리
      return !v;
    });
  };

  /* 사이드 패널 — 오버레이 모드(< 780px)일 때만 body 스크롤 잠금 */
  useEffect(() => {
    if (!showGuidePanel && !showChatPanel) return;
    const mq = window.matchMedia("(min-width: 780px)");
    const prev = document.body.style.overflow;
    const apply = () => {
      document.body.style.overflow = mq.matches ? prev : "hidden";
    };
    apply();
    mq.addEventListener("change", apply);
    return () => {
      mq.removeEventListener("change", apply);
      document.body.style.overflow = prev;
    };
  }, [showGuidePanel, showChatPanel]);

  /* ══════════════════════════════════════════
     Render
     ══════════════════════════════════════════ */

  const card: React.CSSProperties = {
    background: COLOR.white, borderRadius: 16,
    boxShadow: "0 2px 12px rgba(74,99,85,0.07)",
    padding: "20px", marginBottom: 16,
  };
  const sectionTitle: React.CSSProperties = {
    fontSize: 16, fontWeight: 700, color: COLOR.textDark, marginBottom: 14,
  };

  return (
    <>
      <style>{`
        .chart-page { min-height: 100dvh; background: ${COLOR.sageBg}; padding-bottom: 88px; }
        .chart-page nav {
          position: sticky; top: 0; z-index: 50; padding: 0 24px; height: 60px;
          display: flex; align-items: center;
          background: rgba(248,249,247,0.95); backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px); border-bottom: 1px solid ${COLOR.border};
        }
        .chart-container { max-width: 560px; margin: 0 auto; padding: 20px 16px; }
        .chart-grid-2col { display: flex; flex-direction: column; gap: 0; }
        .chart-bottom-bar {
          position: fixed; bottom: 56px; left: 0; right: 0;
          background: rgba(255,255,255,0.95); backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px); border-top: 1px solid ${COLOR.border};
          padding: 12px 16px; z-index: 50;
        }
        .chart-bottom-inner { max-width: 560px; margin: 0 auto; display: flex; gap: 10px; }
        @media (min-width: 1200px) {
          .chart-container {
            max-width: 960px; padding: 28px 24px;
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
            grid-template-areas:
              "basic    basic"
              "memo     memo"
              "problems visits"
              "qanswers consults"
              "health   health";
            gap: 20px;
            align-items: start;
          }
          .chart-container > * { margin-bottom: 0 !important; min-width: 0; }
          .cs-basic    { grid-area: basic; }
          .cs-memo     { grid-area: memo; }
          .cs-problems { grid-area: problems; }
          .cs-qanswers { grid-area: qanswers; }
          .cs-visits   { grid-area: visits; }
          .cs-consults { grid-area: consults; }
          .cs-health   { grid-area: health; }

          .chart-bottom-bar { bottom: 0; }
          .chart-bottom-inner { max-width: 960px; }
          .chart-grid-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
          .chart-grid-2col > * { min-width: 0; }
        }
        /* 백드롭 (오버레이 모드 공용) */
        .chart-guide-backdrop, .chart-chat-backdrop {
          position: fixed; inset: 0; z-index: 999;
          background: rgba(0,0,0,0.3);
        }

        /* 사이드 패널 공통 */
        .chart-guide-panel, .chart-chat-panel {
          display: flex; flex-direction: column; font-style: normal;
          position: fixed; top: 0; right: 0; height: 100vh;
          width: 380px; max-width: 100%;
          background: ${COLOR.white}; z-index: 1000; overflow: hidden;
          border-left: 1px solid ${COLOR.border};
          box-shadow: -4px 0 24px rgba(0,0,0,0.10);
        }

        /* 780px+ 차트와 패널이 나란히 배치 (오버레이 모드 해제) */
        @media (min-width: 780px) {
          .chart-page { transition: padding-right 0.3s ease; }
          .chart-bottom-bar { transition: right 0.3s ease; }
          .chart-with-panel, .chart-with-chat-panel { padding-right: 380px; }
          .chart-with-panel .chart-bottom-bar,
          .chart-with-chat-panel .chart-bottom-bar { right: 380px; }
          .chart-with-panel .chart-guide-backdrop,
          .chart-with-chat-panel .chart-chat-backdrop { display: none; }
          .chart-with-panel .chart-guide-panel,
          .chart-with-chat-panel .chart-chat-panel {
            z-index: 100;
            box-shadow: none;
          }
        }
        @media (min-width: 1200px) {
          .chart-with-panel, .chart-with-chat-panel { padding-right: 400px; }
          .chart-with-panel .chart-bottom-bar,
          .chart-with-chat-panel .chart-bottom-bar { right: 400px; }
          .chart-with-panel .chart-guide-panel,
          .chart-with-chat-panel .chart-chat-panel { width: 400px; }
        }
        @media (min-width: 1600px) {
          .chart-with-panel, .chart-with-chat-panel { padding-right: 500px; }
          .chart-with-panel .chart-bottom-bar,
          .chart-with-chat-panel .chart-bottom-bar { right: 500px; }
          .chart-with-panel .chart-guide-panel,
          .chart-with-chat-panel .chart-chat-panel { width: 500px; }
        }

        ${isEmbedded ? `
          html, body { margin: 0 !important; padding: 0 !important; overflow-x: hidden !important; }
          .chart-page { padding-bottom: 0 !important; }
          .chart-page nav { display: none !important; }
          .chart-bottom-bar { display: none !important; }
          .chart-chat-panel, .chart-guide-panel, .chart-guide-backdrop, .chart-chat-backdrop { display: none !important; }
          .chart-grid-2col { display: flex !important; flex-direction: column !important; }
        ` : ""}
      `}</style>

      <div className={`chart-page${showGuidePanel ? " chart-with-panel" : ""}${showChatPanel ? " chart-with-chat-panel" : ""}`}>
        <nav>
          <button className="nav-back" onClick={() => router.push("/dashboard")} aria-label="뒤로가기">←</button>
          <div style={{ flex: 1, textAlign: "center", fontFamily: "'Gothic A1', sans-serif", fontSize: 16, fontWeight: 700, color: COLOR.textDark, marginRight: 36 }}>
            환자 차트
          </div>
        </nav>

        {/* 차트 사진 업로드 토스트 */}
        {photoToast && (
          <div
            role="status"
            style={{
              position: "fixed",
              top: 70,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 200,
              fontSize: 14,
              color: "#7A5300",
              background: "#FFF8E1",
              border: "1px solid #F5DCA0",
              padding: "10px 16px",
              borderRadius: 10,
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              maxWidth: 360,
            }}
          >
            {photoToast}
          </div>
        )}

        {/* 차트 동기화 토스트 — DB UPDATE 실패 / 검증 실패 시 약사 알림 */}
        {chartToast && (
          <div
            role="status"
            aria-live="polite"
            style={{
              position: "fixed",
              top: photoToast ? 120 : 70,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 201,
              fontSize: 14,
              color: "#9A2C0F",
              background: "#FCEBE4",
              border: "1px solid #E8B49A",
              padding: "10px 16px",
              borderRadius: 10,
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              maxWidth: 360,
              fontFamily: "'Noto Sans KR', sans-serif",
            }}
          >
            {chartToast}
          </div>
        )}

        {/* 차트 성공 토스트 — sage-pale 톤. 다른 토스트와 동시 표시 시 자동 오프셋. */}
        {chartSuccessToast && (
          <div
            role="status"
            aria-live="polite"
            style={{
              position: "fixed",
              top: (photoToast && chartToast)
                ? 170
                : (photoToast || chartToast)
                  ? 120
                  : 70,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 202,
              fontSize: 14,
              color: COLOR.textDark,
              background: COLOR.sagePale,
              border: `1px solid ${COLOR.sageLight}`,
              padding: "10px 16px",
              borderRadius: 10,
              boxShadow: "0 4px 12px rgba(74,99,85,0.10)",
              maxWidth: 360,
              fontFamily: "'Noto Sans KR', sans-serif",
            }}
          >
            {chartSuccessToast}
          </div>
        )}

        <div className="chart-container">
          {/* ── 1. 기본 정보 ── */}
          <div
            className="cs-basic"
            style={{
              background: `linear-gradient(135deg, ${COLOR.sagePale} 0%, ${COLOR.white} 100%)`,
              borderRadius: 16, boxShadow: "0 2px 16px rgba(74,99,85,0.10)",
              padding: "22px 20px", marginBottom: 16, border: `1px solid ${COLOR.sageLight}`,
            }}
          >
            {/* 이름 */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              {editingBasicField === "name" ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                  <input type="text" value={editBasicValue.name || ""} autoFocus
                    onChange={(e) => setEditBasicValue({ name: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") saveBasicEdit(); if (e.key === "Escape") cancelBasicEdit(); }}
                    style={{ fontSize: 18, fontWeight: 800, color: COLOR.sageDeep, padding: "4px 10px", borderRadius: 8, border: `1.5px solid ${COLOR.sageLight}`, outline: "none", width: 140 }} />
                  <button type="button" onClick={saveBasicEdit} style={{ padding: "4px 10px", borderRadius: 6, fontSize: 14, fontWeight: 600, background: COLOR.sageDeep, color: COLOR.white, border: "none", cursor: "pointer" }}>저장</button>
                  <button type="button" onClick={cancelBasicEdit} style={{ padding: "4px 10px", borderRadius: 6, fontSize: 14, fontWeight: 600, background: "transparent", color: COLOR.textMid, border: `1px solid ${COLOR.border}`, cursor: "pointer" }}>취소</button>
                </div>
              ) : (
                <>
                  <span style={{ fontSize: 20, fontWeight: 800, color: COLOR.sageDeep, fontFamily: "'Gothic A1', sans-serif" }}>{patient.name}</span>
                  <EditBtn onClick={() => startBasicEdit("name")} label="이름 편집" />
                </>
              )}
            </div>

            {/* 정보 그리드 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 15 }}>
              <InfoCell label="생년월일" editing={editingBasicField === "birthDate"}
                display={
                  <span style={{ fontWeight: 600, color: COLOR.textDark }}>
                    {formatBirthDateForDisplay(patient.birthDate, patient.birthYear)}
                    {currentAge !== null ? ` (${currentAge}세)` : ""}
                  </span>
                }
                editor={
                  <>
                    <input type="number" placeholder="년" autoFocus min={1920} max={new Date().getFullYear()}
                      value={editBasicValue.birthYear || ""}
                      onChange={(e) => setEditBasicValue((p) => ({ ...p, birthYear: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") saveBasicEdit(); if (e.key === "Escape") cancelBasicEdit(); }}
                      style={{ width: 70, padding: "4px 6px", borderRadius: 6, border: `1.5px solid ${COLOR.sageLight}`, fontSize: 14, color: COLOR.textDark, outline: "none" }} />
                    <span style={{ fontSize: 13, color: COLOR.textMid }}>년</span>
                    <input type="number" placeholder="월" min={1} max={12}
                      value={editBasicValue.birthMonth || ""}
                      onChange={(e) => setEditBasicValue((p) => ({ ...p, birthMonth: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") saveBasicEdit(); if (e.key === "Escape") cancelBasicEdit(); }}
                      style={{ width: 50, padding: "4px 6px", borderRadius: 6, border: `1.5px solid ${COLOR.sageLight}`, fontSize: 14, color: COLOR.textDark, outline: "none" }} />
                    <span style={{ fontSize: 13, color: COLOR.textMid }}>월</span>
                    <input type="number" placeholder="일" min={1} max={31}
                      value={editBasicValue.birthDay || ""}
                      onChange={(e) => setEditBasicValue((p) => ({ ...p, birthDay: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") saveBasicEdit(); if (e.key === "Escape") cancelBasicEdit(); }}
                      style={{ width: 50, padding: "4px 6px", borderRadius: 6, border: `1.5px solid ${COLOR.sageLight}`, fontSize: 14, color: COLOR.textDark, outline: "none" }} />
                    <span style={{ fontSize: 13, color: COLOR.textMid }}>일</span>
                  </>
                }
                onEdit={() => startBasicEdit("birthDate")} onSave={saveBasicEdit} onCancel={cancelBasicEdit} />

              <InfoCell label="성별" editing={editingBasicField === "gender"}
                display={<span style={{ fontWeight: 600, color: COLOR.textDark }}>{patient.gender}</span>}
                editor={
                  <select value={editBasicValue.gender || ""} autoFocus
                    onChange={(e) => setEditBasicValue({ gender: e.target.value })}
                    style={{ padding: "4px 8px", borderRadius: 6, border: `1.5px solid ${COLOR.sageLight}`, fontSize: 14, color: COLOR.textDark, outline: "none" }}>
                    <option value="여성">여성</option>
                    <option value="남성">남성</option>
                    <option value="기타">기타</option>
                  </select>
                }
                onEdit={() => startBasicEdit("gender")} onSave={saveBasicEdit} onCancel={cancelBasicEdit} />

              <InfoCell label="키" editing={editingBasicField === "height"}
                display={<span style={{ fontWeight: 600, color: COLOR.textDark }}>{patient.height}cm</span>}
                editor={
                  <>
                    <input type="number" value={editBasicValue.height || ""} autoFocus min={100} max={250}
                      onChange={(e) => setEditBasicValue({ height: e.target.value })}
                      onKeyDown={(e) => { if (e.key === "Enter") saveBasicEdit(); if (e.key === "Escape") cancelBasicEdit(); }}
                      style={{ width: 70, padding: "4px 8px", borderRadius: 6, border: `1.5px solid ${COLOR.sageLight}`, fontSize: 14, color: COLOR.textDark, outline: "none" }} />
                    <span style={{ fontSize: 14, color: COLOR.textMid }}>cm</span>
                  </>
                }
                onEdit={() => startBasicEdit("height")} onSave={saveBasicEdit} onCancel={cancelBasicEdit} />

              <InfoCell label="몸무게" editing={editingBasicField === "weight"}
                display={
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontWeight: 600, color: COLOR.textDark }}>{patient.weight}kg</span>
                    <span style={{ fontSize: 12, color: COLOR.sageMid }}>기록: {fmtDate(patient.weightRecordedAt)}</span>
                  </div>
                }
                editor={
                  <>
                    <input type="number" value={editBasicValue.weight || ""} autoFocus min={20} max={300} step="0.1"
                      onChange={(e) => setEditBasicValue({ weight: e.target.value })}
                      onKeyDown={(e) => { if (e.key === "Enter") saveBasicEdit(); if (e.key === "Escape") cancelBasicEdit(); }}
                      style={{ width: 70, padding: "4px 8px", borderRadius: 6, border: `1.5px solid ${COLOR.sageLight}`, fontSize: 14, color: COLOR.textDark, outline: "none" }} />
                    <span style={{ fontSize: 14, color: COLOR.textMid }}>kg</span>
                  </>
                }
                onEdit={() => startBasicEdit("weight")} onSave={saveBasicEdit} onCancel={cancelBasicEdit} />

              <div style={{ gridColumn: "1 / -1" }}>
                <InfoCell label="예산" editing={editingBasicField === "budget"}
                  display={<span style={{ fontWeight: 600, color: COLOR.textDark }}>{patient.budget}</span>}
                  editor={
                    <input type="text" value={editBasicValue.budget || ""} autoFocus
                      onChange={(e) => setEditBasicValue({ budget: e.target.value })}
                      onKeyDown={(e) => { if (e.key === "Enter") saveBasicEdit(); if (e.key === "Escape") cancelBasicEdit(); }}
                      style={{ flex: 1, padding: "4px 8px", borderRadius: 6, border: `1.5px solid ${COLOR.sageLight}`, fontSize: 14, color: COLOR.textDark, outline: "none" }} />
                  }
                  onEdit={() => startBasicEdit("budget")} onSave={saveBasicEdit} onCancel={cancelBasicEdit} />
              </div>
            </div>
          </div>

          {/* ── 2. 약사 메모 ── */}
          <div className="cs-memo" style={{
            background: COLOR.sagePale, borderRadius: 12, padding: 16, marginBottom: 16,
            border: `1px solid ${COLOR.sageLight}`,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: COLOR.sageDeep }}>📝 약사 메모</div>
              {!editingPharmacistMemo && (
                <button type="button" onClick={() => { setPharmacistMemoDraft(patient.pharmacistMemo); setEditingPharmacistMemo(true); }}
                  style={{ padding: "4px 12px", borderRadius: 6, fontSize: 13, fontWeight: 600, background: COLOR.white, color: COLOR.sageDeep, border: `1px solid ${COLOR.sageLight}`, cursor: "pointer" }}>
                  수정
                </button>
              )}
            </div>
            {editingPharmacistMemo ? (
              <>
                <textarea value={pharmacistMemoDraft}
                  onChange={(e) => setPharmacistMemoDraft(e.target.value)}
                  placeholder="환자 전반에 대한 메모 (환자에게 보이지 않음)"
                  rows={4}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${COLOR.sageLight}`, fontSize: 14, color: COLOR.textDark, outline: "none", resize: "vertical", fontFamily: "'Noto Sans KR', sans-serif", boxSizing: "border-box", background: COLOR.white, lineHeight: 1.65 }} />
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                  <button type="button" onClick={cancelPharmacistMemo} style={{ padding: "6px 14px", borderRadius: 6, fontSize: 13, fontWeight: 600, background: "transparent", color: COLOR.textMid, border: `1px solid ${COLOR.border}`, cursor: "pointer" }}>취소</button>
                  <button type="button" onClick={savePharmacistMemo} style={{ padding: "6px 14px", borderRadius: 6, fontSize: 13, fontWeight: 700, background: COLOR.sageDeep, color: COLOR.white, border: "none", cursor: "pointer" }}>저장</button>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 14, lineHeight: 1.65, color: patient.pharmacistMemo ? COLOR.textDark : COLOR.textMid, whiteSpace: "pre-wrap" }}>
                {patient.pharmacistMemo || "메모를 추가하세요"}
              </div>
            )}
          </div>

          {/* ── 3. 현재 증상 (Problem List) ── */}
          <div className="cs-problems" style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={sectionTitle}>현재 증상 ({currentProblems.length})</div>
              <button type="button" onClick={() => setShowAddSymptomModal(true)}
                style={{ padding: "5px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: COLOR.sagePale, color: COLOR.sageDeep, border: `1px solid ${COLOR.sageLight}`, cursor: "pointer" }}>
                + 증상 추가
              </button>
            </div>

            {currentProblems.length === 0 ? (
              <div style={{ padding: "20px", background: COLOR.sageBg, borderRadius: 10, fontSize: 14, color: COLOR.textMid, textAlign: "center" }}>
                현재 관리 중인 증상이 없습니다.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {currentProblems.map((p) => {
                  const isExpanded = expandedProblems.has(p.id);
                  const sc = STATUS_CONFIG[p.status];
                  const durationStr = getDurationDisplay(p);
                  return (
                    <div key={p.id} style={{ border: `1px solid ${COLOR.border}`, borderRadius: 10, background: COLOR.white, position: "relative" }}>
                      {/* 헤더 */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", cursor: "pointer", flexWrap: "wrap" }} onClick={() => toggleProblem(p.id)}>
                        <span style={{ fontSize: 11, color: COLOR.sageMid, transition: "transform 0.2s", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
                        <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 100, fontSize: 13, fontWeight: 600, background: p.bg, color: p.color }}>{p.label}</span>
                        {durationStr && <span style={{ fontSize: 13, color: COLOR.textMid }}>· {durationStr}</span>}
                        <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
                          <button type="button" onClick={() => setStatusDropdownOpen(statusDropdownOpen === p.id ? null : p.id)}
                            style={{ padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: sc.bg, color: sc.color, border: `1px solid ${sc.color}33`, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
                            {p.status}
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={sc.color} strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                          </button>
                          {statusDropdownOpen === p.id && (
                            <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, zIndex: 30, background: COLOR.white, borderRadius: 10, padding: 4, boxShadow: "0 4px 16px rgba(0,0,0,0.14)", minWidth: 120, border: `1px solid ${COLOR.border}` }}>
                              {ALL_STATUSES.map((s) => (
                                <button key={s} type="button" onClick={() => updateProblemStatus(p.id, s)}
                                  style={{ display: "block", width: "100%", padding: "7px 10px", textAlign: "left", fontSize: 13, fontWeight: 600, color: STATUS_CONFIG[s].color, background: p.status === s ? STATUS_CONFIG[s].bg : "transparent", border: "none", borderRadius: 6, cursor: "pointer" }}>
                                  {s}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                          <span style={{ fontSize: 12, color: COLOR.sageMid }}>불편</span>
                          <ScoreHearts score={p.severity} onChange={(v) => updateProblemSeverity(p.id, v)} size={16} />
                        </div>
                      </div>

                      {isExpanded && (
                        <div style={{ padding: "0 12px 12px 12px", borderTop: `1px solid ${COLOR.border}`, paddingTop: 10 }}>
                          {p.quickNote && (
                            <div style={{ fontSize: 14, color: COLOR.textDark, marginBottom: 8 }}>메모: {p.quickNote}</div>
                          )}
                          <div style={{ fontSize: 13, color: COLOR.textMid, marginBottom: 8 }}>
                            시작일: {p.startDate ? fmtDate(p.startDate) : p.durationText || "—"}
                          </div>
                          {p.memo.length > 0 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
                              {p.memo.map((m, i) => (
                                <div key={i} style={{ fontSize: 13, color: COLOR.textMid, display: "flex", gap: 6 }}>
                                  <span style={{ color: COLOR.sageMid }}>{m.date}</span>
                                  <span>— {m.text}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {addingMemoForProblem === p.id ? (
                            <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                              <input type="text" value={newProblemMemo} autoFocus
                                onChange={(e) => setNewProblemMemo(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") addProblemMemo(p.id); }}
                                placeholder="메모 입력"
                                style={{ flex: 1, minWidth: 160, padding: "6px 10px", borderRadius: 6, border: `1.5px solid ${COLOR.sageLight}`, fontSize: 14, color: COLOR.textDark, outline: "none" }} />
                              <button type="button" onClick={() => addProblemMemo(p.id)} style={{ padding: "6px 12px", borderRadius: 6, fontSize: 13, fontWeight: 600, background: COLOR.sageDeep, color: COLOR.white, border: "none", cursor: "pointer" }}>추가</button>
                              <button type="button" onClick={() => { setAddingMemoForProblem(null); setNewProblemMemo(""); }} style={{ padding: "6px 10px", borderRadius: 6, fontSize: 13, fontWeight: 600, background: "transparent", color: COLOR.textMid, border: `1px solid ${COLOR.border}`, cursor: "pointer" }}>취소</button>
                            </div>
                          ) : (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              <button type="button" onClick={() => setAddingMemoForProblem(p.id)}
                                style={{ padding: "4px 10px", borderRadius: 6, fontSize: 13, fontWeight: 600, background: COLOR.sagePale, color: COLOR.sageDeep, border: `1px solid ${COLOR.sageLight}`, cursor: "pointer" }}>
                                + 메모 추가
                              </button>
                              <button type="button" onClick={() => removeProblem(p.id)}
                                style={{ padding: "4px 10px", borderRadius: 6, fontSize: 13, fontWeight: 600, background: "transparent", color: "#D32F2F", border: "1px solid #D32F2F33", cursor: "pointer" }}>
                                삭제
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {resolvedProblems.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: COLOR.textMid, marginBottom: 8 }}>지난 증상 ({resolvedProblems.length})</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {resolvedProblems.map((p) => (
                    <div key={p.id} style={{ padding: "10px 12px", background: COLOR.sageBg, borderRadius: 10, border: `1px solid ${COLOR.border}`, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 100, fontSize: 13, fontWeight: 600, background: p.bg, color: p.color }}>{p.label}</span>
                      <span style={{ fontSize: 13, color: COLOR.textMid }}>
                        {p.startDate ? fmtDate(p.startDate) : "—"} ~ {p.endDate ? fmtDate(p.endDate) : ""}
                      </span>
                      <button type="button" onClick={() => updateProblemStatus(p.id, "상담 중")}
                        style={{ marginLeft: "auto", padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: "transparent", color: COLOR.sageDeep, border: `1px solid ${COLOR.sageLight}`, cursor: "pointer" }}>
                        다시 열기
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── 4. 방문 기록 ── */}
          <div className="cs-visits" style={card}>
            <div style={sectionTitle}>방문 기록 ({sortedVisits.length})</div>
            {sortedVisits.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", fontSize: 14, color: "#3D4A42", background: COLOR.sageBg, borderRadius: 12 }}>
                아직 방문 기록이 없어요
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {sortedVisits.map((v, vIdx) => {
                  const isOpen = expandedVisits.has(v.id);
                  const endDate = getVisitEndDate(v);
                  const isEditingDays = editingDosageVisitId === v.id;
                  const visitNumber = sortedVisits.length - vIdx;

                  const dividerStyle: React.CSSProperties = {
                    height: 1,
                    background: "rgba(94,125,108,0.1)",
                    margin: "12px 0",
                  };

                  return (
                    <div
                      key={v.id}
                      style={{
                        background: "#fff",
                        borderRadius: 16,
                        border: "1px solid rgba(94,125,108,0.1)",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                        overflow: "hidden",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => toggleVisit(v.id)}
                        aria-expanded={isOpen}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          width: "100%",
                          padding: 16,
                          minHeight: 56,
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: "#2C3630" }}>
                            {fmtDate(v.date)}
                          </div>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              padding: "3px 8px",
                              borderRadius: 6,
                              background: "#EDF4F0",
                              color: "#4A6355",
                              letterSpacing: "0.01em",
                            }}
                          >
                            {visitNumber}번째 방문
                          </span>
                        </div>
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#5E7D6C"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}
                          aria-hidden="true"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>

                      {isOpen && (
                        <div style={{ padding: "0 16px 16px", borderTop: "1px solid rgba(94,125,108,0.1)" }}>
                          {/* 구매 영양제 */}
                          <div style={{ paddingTop: 14 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#5E7D6C", marginBottom: 8 }}>
                              구매 영양제
                            </div>
                            {v.products.length > 0 ? (
                              v.products.map((p, i) => (
                                <div
                                  key={i}
                                  style={{
                                    padding: 16,
                                    borderRadius: 12,
                                    background: "#EDF4F0",
                                    marginBottom: i < v.products.length - 1 ? 8 : 0,
                                  }}
                                >
                                  <div style={{ fontSize: 15, fontWeight: 700, color: "#2C3630" }}>
                                    {p.name}
                                  </div>
                                  <div style={{ fontSize: 14, marginTop: 4, display: "flex", gap: 10, flexWrap: "wrap" }}>
                                    <span style={{ fontWeight: 600, color: COLOR.terra }}>{p.dosage}</span>
                                    <span style={{ color: "#3D4A42" }}>{p.timing}</span>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div style={{ fontSize: 14, color: "#3D4A42" }}>등록된 영양제 없음</div>
                            )}
                          </div>

                          <div style={dividerStyle} />

                          {/* 복용 일수 */}
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#5E7D6C", marginBottom: 4 }}>
                              복용 일수
                            </div>
                            {isEditingDays ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <input
                                  type="number"
                                  value={editDosageDaysValue}
                                  autoFocus
                                  min={1}
                                  onChange={(e) => setEditDosageDaysValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") saveDosageDays(v.id);
                                    if (e.key === "Escape") setEditingDosageVisitId(null);
                                  }}
                                  style={{ width: 80, padding: "6px 10px", borderRadius: 8, border: `1.5px solid ${COLOR.sageLight}`, fontSize: 15, color: "#2C3630", outline: "none" }}
                                />
                                <span style={{ fontSize: 15, color: "#3D4A42" }}>일</span>
                                <button type="button" onClick={() => saveDosageDays(v.id)} style={{ padding: "4px 12px", borderRadius: 6, fontSize: 13, fontWeight: 600, background: COLOR.sageDeep, color: "#fff", border: "none", cursor: "pointer" }}>저장</button>
                                <button type="button" onClick={() => setEditingDosageVisitId(null)} style={{ padding: "4px 12px", borderRadius: 6, fontSize: 13, fontWeight: 600, background: "transparent", color: "#3D4A42", border: `1px solid ${COLOR.border}`, cursor: "pointer" }}>취소</button>
                              </div>
                            ) : (
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 15, color: "#2C3630", fontWeight: 600 }}>
                                  {v.durationDays ? `${v.durationDays}일` : "미입력"}
                                </span>
                                {endDate && <span style={{ fontSize: 14, color: "#3D4A42" }}>(종료 예정: {endDate})</span>}
                                <EditBtn onClick={() => startEditDosageDays(v.id, v.durationDays)} label="복용 일수 편집" />
                              </div>
                            )}
                          </div>

                          {/* 환자 호소 */}
                          {(v.complaint || (editingVisitField?.id === v.id && editingVisitField.field === "complaint")) && (
                            <>
                              <div style={dividerStyle} />
                              <VisitField label="환자 호소 내용" value={v.complaint}
                                editing={editingVisitField?.id === v.id && editingVisitField.field === "complaint"}
                                editValue={editVisitValue} setEditValue={setEditVisitValue}
                                onStart={() => { setEditingVisitField({ id: v.id, field: "complaint" }); setEditVisitValue(v.complaint || ""); }}
                                onSave={() => { updateVisit(v.id, { complaint: editVisitValue }); setEditingVisitField(null); }}
                                onCancel={() => setEditingVisitField(null)} />
                            </>
                          )}

                          {/* 환자 개선사항 */}
                          {(v.improvement || (editingVisitField?.id === v.id && editingVisitField.field === "improvement")) && (
                            <>
                              <div style={dividerStyle} />
                              <VisitField label="환자 개선사항" value={v.improvement}
                                editing={editingVisitField?.id === v.id && editingVisitField.field === "improvement"}
                                editValue={editVisitValue} setEditValue={setEditVisitValue}
                                onStart={() => { setEditingVisitField({ id: v.id, field: "improvement" }); setEditVisitValue(v.improvement || ""); }}
                                onSave={() => { updateVisit(v.id, { improvement: editVisitValue }); setEditingVisitField(null); }}
                                onCancel={() => setEditingVisitField(null)} />
                            </>
                          )}

                          {/* 약사 가이드 */}
                          {(v.pharmacistGuide || (editingVisitField?.id === v.id && editingVisitField.field === "pharmacistGuide")) && (
                            <>
                              <div style={dividerStyle} />
                              <VisitField label="약사 가이드" value={v.pharmacistGuide} terraBox
                                editing={editingVisitField?.id === v.id && editingVisitField.field === "pharmacistGuide"}
                                editValue={editVisitValue} setEditValue={setEditVisitValue}
                                onStart={() => { setEditingVisitField({ id: v.id, field: "pharmacistGuide" }); setEditVisitValue(v.pharmacistGuide || ""); }}
                                onSave={() => { updateVisit(v.id, { pharmacistGuide: editVisitValue }); setEditingVisitField(null); }}
                                onCancel={() => setEditingVisitField(null)} />
                            </>
                          )}

                          {/* 약사 소견 */}
                          {(v.pharmacistNote || (editingVisitField?.id === v.id && editingVisitField.field === "pharmacistNote")) && (
                            <>
                              <div style={dividerStyle} />
                              <VisitField label="약사 소견 (내부)" value={v.pharmacistNote} grayBox
                                editing={editingVisitField?.id === v.id && editingVisitField.field === "pharmacistNote"}
                                editValue={editVisitValue} setEditValue={setEditVisitValue}
                                onStart={() => { setEditingVisitField({ id: v.id, field: "pharmacistNote" }); setEditVisitValue(v.pharmacistNote || ""); }}
                                onSave={() => { updateVisit(v.id, { pharmacistNote: editVisitValue }); setEditingVisitField(null); }}
                                onCancel={() => setEditingVisitField(null)} />
                            </>
                          )}

                          {/* 차트 사진 업로드 */}
                          <div style={dividerStyle} />
                          <VisitPhotoBlock
                            visit={v}
                            uploading={photoUploading === v.id}
                            maxCount={MAX_VISIT_PHOTOS}
                            onAdd={(files) => addVisitPhotos(v.id, files)}
                            onRemove={(url) => removeVisitPhoto(v.id, url)}
                          />

                          {/* 빈 텍스트 필드 추가 진입점 */}
                          {(() => {
                            const emptyFields: { key: "complaint" | "improvement" | "pharmacistGuide" | "pharmacistNote"; label: string }[] = [];
                            if (!v.complaint && !(editingVisitField?.id === v.id && editingVisitField.field === "complaint")) emptyFields.push({ key: "complaint", label: "환자 호소 내용" });
                            if (!v.improvement && !(editingVisitField?.id === v.id && editingVisitField.field === "improvement")) emptyFields.push({ key: "improvement", label: "환자 개선사항" });
                            if (!v.pharmacistGuide && !(editingVisitField?.id === v.id && editingVisitField.field === "pharmacistGuide")) emptyFields.push({ key: "pharmacistGuide", label: "약사 가이드" });
                            if (!v.pharmacistNote && !(editingVisitField?.id === v.id && editingVisitField.field === "pharmacistNote")) emptyFields.push({ key: "pharmacistNote", label: "약사 소견 (내부)" });
                            if (emptyFields.length === 0) return null;
                            return (
                              <>
                                <div style={dividerStyle} />
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                  {emptyFields.map((ef) => (
                                    <button
                                      key={ef.key}
                                      type="button"
                                      onClick={() => { setEditingVisitField({ id: v.id, field: ef.key }); setEditVisitValue(""); }}
                                      style={{
                                        padding: "8px 12px",
                                        borderRadius: 8,
                                        border: `1px dashed ${COLOR.sageLight}`,
                                        background: "transparent",
                                        color: "#5E7D6C",
                                        fontSize: 13,
                                        fontWeight: 600,
                                        cursor: "pointer",
                                      }}
                                    >
                                      + {ef.label}
                                    </button>
                                  ))}
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── 5. 문답 기록 ── */}
          <div className="cs-consults" style={card}>
            <div style={sectionTitle}>📋 문답 기록</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {sortedConsultations.map((c, idx) => {
                const isLatest = idx === 0;
                const isOpen = openConsultationIds.has(c.id);
                const sc = CONSULT_STATUS_CONFIG[c.status];
                const isFreeTextExpanded = expandedFreeTextIds.has(c.id);

                return (
                  <div key={c.id} style={{
                    border: isLatest ? `1.5px solid ${COLOR.terraLight}` : `1px solid ${COLOR.border}`,
                    borderRadius: 12, overflow: "hidden",
                  }}>
                    <button type="button" onClick={() => toggleConsultation(c.id)}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "14px 16px",
                        background: isLatest ? COLOR.terraPale : (isOpen ? COLOR.sagePale : COLOR.white),
                        border: "none", cursor: "pointer", gap: 10,
                      }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 14, color: isLatest ? COLOR.terra : COLOR.sageMid, transition: "transform 0.2s", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
                        <span style={{ fontSize: 15, fontWeight: 700, color: isLatest ? COLOR.terra : COLOR.textDark }}>
                          {fmtDate(c.requestedAt)}
                        </span>
                        {isLatest && (
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: COLOR.terra, color: COLOR.white }}>최근</span>
                        )}
                        <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: sc.bg, color: sc.color }}>{sc.label}</span>
                      </div>
                    </button>

                    {isOpen && (
                      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14, background: COLOR.white, borderTop: `1px solid ${COLOR.border}` }}>
                        {/* 호소 증상 */}
                        {c.questionnaire.증상 && (
                          <div style={{ padding: "12px 14px", background: isLatest ? COLOR.terraPale : COLOR.sagePale, borderRadius: 10 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: isLatest ? COLOR.terra : COLOR.sageDeep, marginBottom: 4 }}>호소 증상</div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: COLOR.textDark, lineHeight: 1.5 }}>{c.questionnaire.증상}</div>
                          </div>
                        )}

                        {/* 문답 답변 */}
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: COLOR.sageDeep, marginBottom: 8 }}>문답 답변</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {Object.entries(c.questionnaire).map(([k, v]) => (
                              <div key={k} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 14 }}>
                                <span style={{ color: COLOR.sageMid, minWidth: 60, flexShrink: 0 }}>{k}</span>
                                <span style={{ color: COLOR.textDark }}>— {v}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* 자유 서술 */}
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: COLOR.sageDeep, marginBottom: 6 }}>자유 서술</div>
                          <div style={{ padding: "12px", background: COLOR.sageBg, borderRadius: 10 }}>
                            <div style={{
                              fontSize: 14,
                              color: COLOR.textDark,
                              ...(isFreeTextExpanded
                                ? { wordBreak: "break-word" as const }
                                : {
                                    overflow: "hidden",
                                    display: "-webkit-box",
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: "vertical" as const,
                                    wordBreak: "break-word" as const,
                                  }),
                            }}>
                              {c.freeText}
                            </div>
                          </div>
                          {(c.freeText.length > 60 || c.freeText.includes("\n")) && (
                            <button
                              type="button"
                              onClick={() => toggleFreeText(c.id)}
                              style={{
                                marginTop: 4,
                                padding: "2px 0",
                                fontSize: 14,
                                fontWeight: 600,
                                color: "#5E7D6C",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                fontFamily: "'Noto Sans KR', sans-serif",
                              }}
                            >
                              {isFreeTextExpanded ? "접기" : "더 보기"}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── 6. 추가 질문 답변 ── */}
          <div className="cs-qanswers" style={card}>
            <div style={sectionTitle}>📋 추가 질문 답변</div>

            {showAdditionalAnswerEmpty || sortedAdditionalAnswers.length === 0 ? (
              <div style={{
                padding: "28px 20px", background: COLOR.white, borderRadius: 12,
                border: `1px solid ${COLOR.border}`, textAlign: "center",
              }}>
                <div style={{
                  width: 48, height: 48, margin: "0 auto 12px", borderRadius: "50%",
                  background: COLOR.sagePale, display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 22,
                }}>📝</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: COLOR.textDark, marginBottom: 6 }}>
                  아직 환자에게 보낸 개별 문답이 없어요
                </div>
                <div style={{ fontSize: 13, color: COLOR.textMid, lineHeight: 1.6 }}>
                  내 정보 &gt; 맞춤 추가 질문에서 질문 세트를 만들 수 있어요
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {sortedAdditionalAnswers.map((a) => {
                  const isOpen = expandedAnswerSets.has(a.id);
                  return (
                    <div key={a.id} style={{
                      borderRadius: 12, overflow: "hidden",
                      border: `1px solid ${COLOR.border}`,
                    }}>
                      <button
                        type="button"
                        onClick={() => toggleAnswerSet(a.id)}
                        style={{
                          width: "100%", display: "flex",
                          alignItems: "center", justifyContent: "space-between",
                          padding: 16, background: "#F8F9F7",
                          border: "none", cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 600, color: "#2C3630" }}>
                            {a.setName}
                          </div>
                          <div style={{ fontSize: 13, color: "#3D4A42", marginTop: 2 }}>
                            답변일 {fmtDate(a.answeredAt)} · 질문 {a.entries.length}개
                          </div>
                        </div>
                        <svg
                          width="20" height="20" viewBox="0 0 24 24" fill="none"
                          stroke={COLOR.sageMid} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                          style={{ transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>

                      {isOpen && (
                        <div style={{ padding: "4px 16px 12px 16px", background: COLOR.white }}>
                          {a.entries.map((e, i) => (
                            <div
                              key={i}
                              style={{
                                padding: "12px 0",
                                borderBottom: i === a.entries.length - 1 ? "none" : "1px solid rgba(94,125,108,0.08)",
                              }}
                            >
                              <div style={{ fontSize: 14, color: "#3D4A42", lineHeight: 1.5, marginBottom: 6 }}>
                                Q{i + 1}. {e.question}
                              </div>
                              {e.type === "주관식" ? (
                                <div style={{ fontSize: 14, fontWeight: 600, color: "#2C3630", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                                  {e.answers[0] ?? "(답변 없음)"}
                                </div>
                              ) : (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                  {e.answers.length === 0 ? (
                                    <span style={{ fontSize: 14, color: "#3D4A42" }}>(답변 없음)</span>
                                  ) : (
                                    e.answers.map((ans, ai) => (
                                      <span key={ai} style={{
                                        display: "inline-block",
                                        padding: "4px 10px", borderRadius: 8,
                                        background: "#EDF4F0", color: "#4A6355",
                                        fontSize: 14, fontWeight: 600,
                                      }}>
                                        {ans}
                                      </span>
                                    ))
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── 7. 환자 건강지표 (공용 컴포넌트 — 마이페이지와 100% 동일 렌더) ── */}
          <div className="cs-health" style={card}>
            <div style={sectionTitle}>환자 건강지표</div>
            <HealthIndicatorComparison
              emptyState={!latestCheck}
              previousDate={prevCheck ? fmtDate(prevCheck.date) : undefined}
              currentDate={latestCheck ? fmtDate(latestCheck.date) : undefined}
              items={HEALTH_METRICS.map((m) => ({
                label: m.label,
                before: prevCheck ? prevCheck[m.key] : undefined,
                after: latestCheck ? latestCheck[m.key] : 0,
                lowerIsBetter: m.lowerIsBetter,
              }))}
              showCheckButton={false}
            />
            {sortedHealthChecks.length > 2 && (
              <details style={{ marginTop: 14 }}>
                <summary style={{ cursor: "pointer", fontSize: 14, fontWeight: 600, color: COLOR.sageDeep, padding: "8px 0" }}>
                  지난 기록 보기 ({sortedHealthChecks.length - 2}건)
                </summary>
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                  {sortedHealthChecks.slice(0, -2).reverse().map((h) => (
                    <div key={h.date} style={{ padding: "10px 12px", borderRadius: 8, background: COLOR.sageBg, fontSize: 13, color: COLOR.textMid }}>
                      {fmtDate(h.date)} 체크
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>

        {/* ── 하단 액션 바 ── */}
        <div className="chart-bottom-bar">
          <div className="chart-bottom-inner">
            <button type="button" onClick={handleChatToggle}
              style={{ flex: 1, padding: "12px 0", borderRadius: 10, fontSize: 14, fontWeight: 700, background: showChatPanel ? COLOR.sageDeep : COLOR.sagePale, color: showChatPanel ? COLOR.white : COLOR.sageDeep, border: showChatPanel ? "none" : `1.5px solid ${COLOR.sageLight}`, cursor: "pointer" }}>
              💬 {showChatPanel ? "채팅창 닫기" : "채팅창 열기"}
            </button>
            <button type="button" onClick={handleGuideToggle}
              style={{ flex: 1, padding: "12px 0", borderRadius: 10, fontSize: 14, fontWeight: 700, background: showGuidePanel ? COLOR.terra : COLOR.terraPale, color: showGuidePanel ? COLOR.white : COLOR.terra, border: showGuidePanel ? "none" : `1.5px solid ${COLOR.terraLight}`, cursor: "pointer" }}>
              📋 {showGuidePanel ? "복용 가이드 닫기" : "복용 가이드 열기"}
            </button>
          </div>
        </div>

        {/* ── 채팅 사이드 패널 (약사 채팅 페이지를 iframe으로 임베드 — 모든 기능 포함) ── */}
        {showChatPanel && (
          <>
            <div
              className="chart-chat-backdrop"
              onClick={() => setShowChatPanel(false)}
              aria-hidden="true"
            />
            <div className="chart-chat-panel">
              <div style={{ padding: "12px 16px", borderBottom: `1px solid ${COLOR.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, background: COLOR.sageBg }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: COLOR.sageDeep, fontFamily: "'Gothic A1', sans-serif" }}>
                    채팅
                  </span>
                  <span style={{ fontSize: 14, color: COLOR.textMid, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {patient.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowChatPanel(false)}
                  aria-label="닫기"
                  style={{
                    width: 40, height: 40, minWidth: 40, minHeight: 40,
                    background: COLOR.white,
                    border: `1px solid ${COLOR.border}`,
                    borderRadius: 10,
                    cursor: "pointer",
                    color: COLOR.textDark,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: 0, lineHeight: 1, fontSize: 18, fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  ✕
                </button>
              </div>
              <iframe
                src={`/chat/c1?role=pharmacist&embedded=true`}
                title="약사 채팅"
                style={{ flex: 1, width: "100%", border: "none", background: COLOR.white }}
              />
            </div>
          </>
        )}

        {/* ── 복용 가이드 사이드 패널 ── */}
        {showGuidePanel && (
          <>
            <div
              className="chart-guide-backdrop"
              onClick={() => { setShowGuidePanel(false); clearGuideSuccess(); }}
              aria-hidden="true"
            />
          <div className="chart-guide-panel">
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${COLOR.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, background: COLOR.sageBg }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: COLOR.sageDeep, fontFamily: "'Gothic A1', sans-serif" }}>복용 가이드</span>
                {sentBadgeVisible && (
                  <span style={{ padding: "2px 10px", borderRadius: 100, fontSize: 12, fontWeight: 700, background: COLOR.sageDeep, color: COLOR.white }}>
                    ✓ 전송 완료
                  </span>
                )}
              </div>
              <button type="button" onClick={() => { setShowGuidePanel(false); clearGuideSuccess(); }} aria-label="닫기"
                style={{ width: 40, height: 40, minWidth: 40, minHeight: 40, background: COLOR.white, border: `1px solid ${COLOR.border}`, borderRadius: 10, cursor: "pointer", color: COLOR.textDark, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, lineHeight: 1, fontSize: 18, fontWeight: 600, flexShrink: 0 }}>
                ✕
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
              {/* 환자 이름 카드 */}
              <div style={{
                background: "linear-gradient(135deg, #EDF4F0 0%, #fff 100%)",
                borderRadius: 12, padding: "12px 14px",
                border: `1px solid ${COLOR.sageLight}`, marginBottom: 16,
              }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: COLOR.sageDeep }}>{patient.name}</div>
                <div style={{ fontSize: 13, color: COLOR.textMid, marginTop: 2 }}>
                  {patient.gender} · {currentAge !== null ? `${currentAge}세` : "—세"} · 예산 {patient.budget}
                </div>
              </div>

              {/* ── 발송 이력 섹션 (누적 모델) ──
               *   guideHistory: 같은 consultation + 본인 약사 발송분 전체. 차수 없음. */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: COLOR.sageDeep }}>
                    {guideHistory.length > 0 ? `발송 이력 ${guideHistory.length}건` : "발송 이력"}
                  </div>
                </div>

                {!guideHistoryLoaded ? (
                  <div style={{ fontSize: 13, color: COLOR.textMid, padding: "8px 0" }}>불러오는 중...</div>
                ) : guideHistory.length === 0 ? (
                  <div style={{
                    fontSize: 13, color: COLOR.textMid,
                    padding: "12px 14px", borderRadius: 10,
                    background: COLOR.sageBg, border: `1px dashed ${COLOR.sageLight}`,
                  }}>
                    아직 발송한 가이드가 없어요
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {guideHistory.map((g) => {
                      const isOpen = expandedHistoryIds.has(g.id);
                      const isoSrc = g.sent_at || g.created_at;
                      const sentDate = (() => {
                        if (!isoSrc) return "";
                        const d = new Date(isoSrc);
                        return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
                      })();
                      type HistorySupp = { name?: unknown; time_slots?: unknown; dosage?: unknown; timing?: unknown; dispense_type?: unknown; days?: unknown; daily_count?: unknown; etc_note?: unknown; memo?: unknown };
                      const supps: HistorySupp[] = Array.isArray(g.supplements) ? (g.supplements as HistorySupp[]) : [];
                      const suppNames = supps
                        .map((s) => (typeof s?.name === "string" ? s.name : ""))
                        .filter((n): n is string => !!n);
                      const summary = (() => {
                        if (suppNames.length === 0) return "영양제 0건";
                        if (suppNames.length <= 2) return suppNames.join(", ");
                        return `${suppNames.slice(0, 2).join(", ")} 외 ${suppNames.length - 2}건`;
                      })();
                      const statusLabel =
                        g.dosage_status === "active" ? "복용 중"
                        : g.dosage_status === "completed" ? "복용 완료"
                        : "중단";
                      const statusBg = g.dosage_status === "active" ? COLOR.sageDeep : "#9AA39E";
                      return (
                        <div key={g.id} style={{
                          borderRadius: 10,
                          border: `1px solid ${COLOR.sageLight}`,
                          background: COLOR.sagePale,
                          overflow: "hidden",
                        }}>
                          <button
                            type="button"
                            onClick={() => toggleHistoryExpanded(g.id)}
                            style={{
                              width: "100%", padding: "10px 12px",
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                              gap: 8, flexWrap: "wrap",
                              background: "transparent", border: "none", cursor: "pointer",
                              textAlign: "left", fontFamily: "'Noto Sans KR', sans-serif",
                            }}
                          >
                            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: COLOR.textDark }}>{sentDate}</span>
                                <span style={{
                                  padding: "1px 8px", borderRadius: 100,
                                  fontSize: 11, fontWeight: 700,
                                  background: statusBg, color: COLOR.white,
                                }}>
                                  {statusLabel}
                                </span>
                                {g.dosage_days ? (
                                  <span style={{ fontSize: 12, color: COLOR.textMid }}>{g.dosage_days}일분</span>
                                ) : null}
                                {g.dosage_end_date ? (
                                  <span style={{ fontSize: 12, color: COLOR.textMid }}>~{g.dosage_end_date.replaceAll("-", ".")}</span>
                                ) : null}
                              </div>
                              <div style={{ fontSize: 13, color: COLOR.textMid }}>
                                {summary}
                              </div>
                            </div>
                            <span aria-hidden style={{
                              fontSize: 14, color: COLOR.sageMid, flexShrink: 0,
                              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                              transition: "transform 0.2s",
                            }}>▼</span>
                          </button>
                          {isOpen && (
                            <div style={{
                              padding: "0 12px 12px",
                              borderTop: `1px solid ${COLOR.sageLight}`,
                              background: COLOR.white,
                            }}>
                              {supps.length === 0 ? (
                                <div style={{ fontSize: 13, color: COLOR.textMid, padding: "10px 0" }}>
                                  영양제 정보 없음
                                </div>
                              ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 10 }}>
                                  {supps.map((s, i) => {
                                    const name = typeof s.name === "string" ? s.name : "";
                                    const timing = typeof s.timing === "string" ? s.timing : "";
                                    const dosage = typeof s.dosage === "string" ? s.dosage : "";
                                    // 레거시 row (dispense_type 없음) → "bottle" 간주
                                    const isCompound = s.dispense_type === "compounded";
                                    const slotsArr = Array.isArray(s.time_slots)
                                      ? (s.time_slots as unknown[]).filter((x): x is string => typeof x === "string")
                                      : [];
                                    const days = typeof s.days === "number" ? s.days : null;
                                    // 레거시 row (daily_count 없음) → 1 간주
                                    const dailyCount = typeof s.daily_count === "number" && s.daily_count > 0 ? s.daily_count : 1;
                                    const etcNote = typeof s.etc_note === "string" ? s.etc_note.trim() : "";
                                    const memo = typeof s.memo === "string" ? s.memo.trim() : "";
                                    // "기타" 슬롯 라벨에 메모 병기 — 예: "기타(오전 11시)"
                                    const slotsDisplay = slotsArr.map((slot) =>
                                      slot === "기타" && etcNote ? `기타(${etcNote})` : slot,
                                    );
                                    return (
                                      <div key={i} style={{
                                        padding: "8px 10px",
                                        borderRadius: 8,
                                        background: COLOR.sageBg,
                                        border: `1px solid ${COLOR.border}`,
                                      }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                          <span style={{ fontSize: 14, fontWeight: 600, color: COLOR.textDark }}>{name || "—"}</span>
                                          <span style={{
                                            padding: "1px 7px", borderRadius: 100,
                                            fontSize: 10, fontWeight: 700,
                                            background: isCompound ? "var(--terra-pale, #FBF5F1)" : COLOR.sagePale,
                                            color: isCompound ? "#C06B45" : COLOR.sageDeep,
                                            border: `1px solid ${isCompound ? "var(--terra-light, #F5E6DC)" : COLOR.sageLight}`,
                                          }}>
                                            {isCompound ? "소분 조제약" : "통약"}
                                          </span>
                                          <span style={{ fontSize: 12, color: COLOR.textMid }}>· 하루 {dailyCount}회</span>
                                          {days !== null ? (
                                            <span style={{ fontSize: 12, color: COLOR.textMid }}>· {days}일분</span>
                                          ) : null}
                                        </div>
                                        {(() => {
                                          // 통약·소분 동일 표기 — 슬롯 + 용량 + 부가설명 조합. 소분 + 모두 빈값일 때만 "약포지대로 복용" 폴백.
                                          const parts = [
                                            slotsDisplay.length > 0 ? slotsDisplay.join(" · ") : "",
                                            dosage,
                                            timing,
                                          ].filter(Boolean);
                                          if (parts.length > 0) {
                                            return (
                                              <div style={{ fontSize: 13, color: COLOR.textMid, marginTop: 2 }}>
                                                {parts.join(" · ")}
                                              </div>
                                            );
                                          }
                                          if (isCompound) {
                                            return (
                                              <div style={{ fontSize: 12, color: COLOR.textMid, marginTop: 2 }}>
                                                약포지대로 복용
                                              </div>
                                            );
                                          }
                                          return null;
                                        })()}
                                        {memo && (
                                          <div style={{ fontSize: 12, color: COLOR.textMid, marginTop: 4 }}>
                                            📝 {memo}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              {g.custom_guide && (
                                <div style={{
                                  marginTop: 8, padding: "8px 10px",
                                  borderRadius: 8,
                                  background: "var(--terra-pale, #FBF5F1)",
                                  border: "1px solid var(--terra-light, #F5E6DC)",
                                  fontSize: 13, color: COLOR.textDark, lineHeight: 1.5,
                                }}>
                                  {g.custom_guide}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 발송 이력과 새 가이드 작성 분리선 */}
              <div style={{
                height: 1, background: COLOR.border, margin: "0 0 14px",
              }} />
              <div style={{ fontSize: 13, fontWeight: 700, color: COLOR.sageDeep, marginBottom: 8 }}>
                새 가이드 작성
              </div>

              {/* 영양제 + 복용법 헤더 */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 6 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: COLOR.sageDeep }}>영양제 + 복용법</div>
                <div style={{ display: "inline-flex", gap: 4 }}>
                  <button type="button" onClick={copyGuideFromVisit}
                    style={{ padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: COLOR.sagePale, color: COLOR.sageDeep, border: `1px solid ${COLOR.sageLight}`, cursor: "pointer" }}>
                    최근 방문 기록에서 복사
                  </button>
                  <button type="button" onClick={clearGuide}
                    style={{ padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: "transparent", color: COLOR.textMid, border: `1px solid ${COLOR.border}`, cursor: "pointer" }}>
                    전체 삭제
                  </button>
                </div>
              </div>
              <div style={{ fontSize: 12, color: COLOR.textMid, marginBottom: 10 }}>
                환자에게 안내할 영양제와 복용법을 입력해주세요
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 10 }}>
                {guideSupps.map((s, i) => {
                  const isCompound = s.dispense_type === "compounded";
                  return (
                  <div key={i} style={{ padding: 10, background: COLOR.sageBg, borderRadius: 10, border: `1px solid ${COLOR.border}` }}>
                    {/* 통약/소분 토글 + ✕ 삭제 */}
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
                      <div style={{ display: "inline-flex", borderRadius: 8, overflow: "hidden", border: `1px solid ${COLOR.sageLight}`, flexShrink: 0 }}>
                        <button type="button" onClick={() => setGuideSuppDispense(i, "bottle")}
                          style={{
                            padding: "5px 10px", fontSize: 12, fontWeight: 700,
                            background: !isCompound ? COLOR.sageDeep : COLOR.white,
                            color: !isCompound ? COLOR.white : COLOR.sageDeep,
                            border: "none", cursor: "pointer",
                          }}>
                          통약
                        </button>
                        <button type="button" onClick={() => setGuideSuppDispense(i, "compounded")}
                          style={{
                            padding: "5px 10px", fontSize: 12, fontWeight: 700,
                            background: isCompound ? COLOR.sageDeep : COLOR.white,
                            color: isCompound ? COLOR.white : COLOR.sageDeep,
                            border: "none", borderLeft: `1px solid ${COLOR.sageLight}`,
                            cursor: "pointer",
                          }}>
                          소분 조제약
                        </button>
                      </div>
                      <div style={{ flex: 1 }} />
                      <button type="button" onClick={() => removeGuideSupp(i)} aria-label="삭제"
                        style={{ width: 28, height: 28, borderRadius: 6, background: "transparent", border: `1px solid ${COLOR.border}`, cursor: "pointer", color: COLOR.textMid, flexShrink: 0 }}>
                        ✕
                      </button>
                    </div>

                    {/* 이름 input */}
                    <input type="text" value={s.name}
                      onChange={(e) => updateGuideSupp(i, "name", e.target.value)}
                      placeholder="이름 (예: 비타민B군)"
                      style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: `1px solid ${COLOR.border}`, fontSize: 14, outline: "none", background: COLOR.white, marginBottom: 6, boxSizing: "border-box" }} />

                    {/* 용량 + 부가 설명 — 통약·소분 공통. 소분은 기본값 "1포"로 채워져 있고 수정 가능. */}
                    <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                      <input type="text" value={s.dosage}
                        onChange={(e) => updateGuideSupp(i, "dosage", e.target.value)}
                        placeholder="용량 (예: 1정, 2포)"
                        style={{ flex: 1, padding: "7px 10px", borderRadius: 6, border: `1px solid ${COLOR.border}`, fontSize: 14, outline: "none", background: COLOR.white, minWidth: 0 }} />
                      <input type="text" value={s.timing}
                        onChange={(e) => updateGuideSupp(i, "timing", e.target.value)}
                        placeholder="설명 (식후, 흔들어서)"
                        style={{ flex: 1.2, padding: "7px 10px", borderRadius: 6, border: `1px solid ${COLOR.border}`, fontSize: 14, outline: "none", background: COLOR.white, minWidth: 0 }} />
                    </div>

                    {/* 5칩 슬롯 체크박스 — 통약·소분 공통. "기타" 포함 다중 선택. 칩 개수가 daily_count 자동 결정. */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6, alignItems: "center" }}>
                      {(["아침", "점심", "저녁", "취침 전", "기타"] as const).map((slot) => {
                        const checked = (s.time_slots ?? []).includes(slot);
                        return (
                          <button key={slot} type="button"
                            onClick={() => toggleGuideSuppSlot(i, slot)}
                            style={{
                              padding: "5px 10px", borderRadius: 100, fontSize: 12, fontWeight: 600,
                              background: checked ? COLOR.sageDeep : COLOR.white,
                              color: checked ? COLOR.white : COLOR.sageDeep,
                              border: `1px solid ${checked ? COLOR.sageDeep : COLOR.sageLight}`,
                              cursor: "pointer",
                            }}>
                            {checked ? "✓ " : ""}{slot}
                          </button>
                        );
                      })}
                      {/* "기타" 선택 시 짧은 설명 input */}
                      {(s.time_slots ?? []).includes("기타") && (
                        <input type="text" value={s.etc_note ?? ""}
                          onChange={(e) => setGuideSuppEtcNote(i, e.target.value)}
                          placeholder="예: 오전 11시"
                          maxLength={40}
                          style={{
                            width: 120, padding: "5px 10px",
                            borderRadius: 100,
                            border: `1px solid ${COLOR.sageLight}`,
                            fontSize: 12, outline: "none", background: COLOR.white,
                          }} />
                      )}
                    </div>

                    {isCompound && (
                      <label style={{
                        display: "flex", alignItems: "center", gap: 6,
                        fontSize: 13, color: COLOR.textMid,
                        marginBottom: 6, cursor: "pointer",
                      }}>
                        <input
                          type="checkbox"
                          checked={s.package_note ?? true}
                          onChange={(e) => setGuideSuppPackageNote(i, e.target.checked)}
                          style={{ width: 16, height: 16, accentColor: COLOR.sageDeep, cursor: "pointer" }}
                        />
                        '약포지에 표시된 대로 복용하세요' 안내 보내기
                      </label>
                    )}

                    {/* 하루 횟수 + 일수 나란히 */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 13, color: COLOR.textMid }}>하루</span>
                        <input type="number" min={1} value={s.daily_count ?? ""}
                          onChange={(e) => setGuideSuppDailyCount(i, e.target.value)}
                          placeholder="1"
                          style={{ width: 64, padding: "7px 10px", borderRadius: 6, border: `1px solid ${COLOR.border}`, fontSize: 14, outline: "none", background: COLOR.white }} />
                        <span style={{ fontSize: 13, color: COLOR.textMid }}>회</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <input type="number" min={1} value={s.days ?? ""}
                          onChange={(e) => setGuideSuppDays(i, e.target.value)}
                          placeholder="14"
                          style={{ width: 72, padding: "7px 10px", borderRadius: 6, border: `1px solid ${COLOR.border}`, fontSize: 14, outline: "none", background: COLOR.white }} />
                        <span style={{ fontSize: 13, color: COLOR.textMid }}>일분</span>
                      </div>
                    </div>

                    {/* 영양제별 메모 — 환자에게도 표시. 200자 제한. */}
                    <div style={{ marginTop: 8 }}>
                      <input type="text" value={s.memo ?? ""}
                        onChange={(e) => setGuideSuppMemo(i, e.target.value)}
                        placeholder="메모 (선택) · 주의·참고사항 (환자에게 표시됩니다)"
                        maxLength={200}
                        style={{
                          width: "100%", padding: "7px 10px",
                          borderRadius: 6, border: `1px solid ${COLOR.border}`,
                          fontSize: 13, outline: "none", background: COLOR.white,
                          boxSizing: "border-box",
                        }} />
                    </div>
                  </div>
                  );
                })}
              </div>
              <button type="button" onClick={addGuideSupp}
                style={{ width: "100%", padding: "8px 0", borderRadius: 8, fontSize: 13, fontWeight: 600, background: COLOR.sagePale, color: COLOR.sageDeep, border: `1px dashed ${COLOR.sageLight}`, cursor: "pointer", marginBottom: 18 }}>
                + 영양제 추가
              </button>

              {/* 가이드 전체 종료 예정일 — 영양제별 일수 중 max 기준 자동 계산 */}
              {guideEndDate && (
                <div style={{
                  padding: "10px 12px", borderRadius: 8,
                  background: COLOR.sagePale, border: `1px solid ${COLOR.sageLight}`,
                  fontSize: 13, color: COLOR.textDark, marginBottom: 18,
                  fontFamily: "'Noto Sans KR', sans-serif",
                }}>
                  전체 종료 예정: <strong style={{ color: COLOR.sageDeep }}>{guideEndDate}</strong>
                  <span style={{ marginLeft: 6, color: COLOR.textMid }}>(가장 긴 {guideMaxDays}일 기준)</span>
                </div>
              )}

              {/* 맞춤 가이드 */}
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: COLOR.sageDeep }}>
                  맞춤 가이드 <span style={{ fontSize: 12, fontWeight: 500, color: COLOR.textMid }}>(선택)</span>
                </div>
                <span style={{ fontSize: 12, color: COLOR.textMid }}>{guideMemo.length}/500</span>
              </div>
              <textarea value={guideMemo}
                onChange={(e) => { if (e.target.value.length <= 500) setGuideMemo(e.target.value); }}
                placeholder="복용 시 주의사항, 생활습관 안내 등을 자유롭게 입력해주세요"
                rows={4}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${COLOR.sageLight}`, fontSize: 14, color: COLOR.textDark, outline: "none", resize: "vertical", fontFamily: "'Noto Sans KR', sans-serif", boxSizing: "border-box", marginBottom: 18, lineHeight: 1.6 }} />
            </div>

            <div style={{ padding: "12px 16px", borderTop: `1px solid ${COLOR.border}`, flexShrink: 0 }}>
              <button type="button" onClick={requestSendGuide} disabled={!canSendGuide}
                style={{
                  width: "100%", padding: "14px 0", borderRadius: 12,
                  fontSize: 15, fontWeight: 700,
                  background: canSendGuide ? COLOR.sageDeep : COLOR.sageLight,
                  color: COLOR.white, border: "none",
                  cursor: canSendGuide ? "pointer" : "default",
                }}>
                가이드 전송
              </button>
            </div>

            {/* 전송 확인 팝업 */}
            {guideShowConfirm && (
              <div style={{
                position: "absolute", inset: 0, zIndex: 20,
                background: "rgba(0,0,0,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }} onClick={() => setGuideShowConfirm(false)}>
                <div onClick={(e) => e.stopPropagation()}
                  style={{
                    background: COLOR.white, borderRadius: 16, padding: "28px 24px 24px",
                    maxWidth: 300, width: "85%", textAlign: "center",
                    boxShadow: "0 6px 24px rgba(0,0,0,0.15)",
                  }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>📋</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: COLOR.textDark, marginBottom: 6, fontFamily: "'Noto Sans KR', sans-serif" }}>
                    가이드를 전송하시겠습니까?
                  </div>
                  <div style={{ fontSize: 13, color: COLOR.textMid, lineHeight: 1.6, marginBottom: 18 }}>
                    전송 후에는 수정이 어렵습니다. 내용을 다시 한번 확인해주세요.
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" onClick={() => setGuideShowConfirm(false)}
                      style={{ flex: 1, padding: "12px", minHeight: 48, borderRadius: 10, fontSize: 14, fontWeight: 600, background: COLOR.white, color: COLOR.sageDeep, border: `1.5px solid ${COLOR.sageDeep}`, cursor: "pointer" }}>
                      취소
                    </button>
                    <button type="button" onClick={confirmSendGuide}
                      style={{ flex: 1, padding: "12px", minHeight: 48, borderRadius: 10, fontSize: 14, fontWeight: 700, background: COLOR.sageDeep, color: COLOR.white, border: "none", cursor: "pointer" }}>
                      전송하기
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 전송 성공 박스 — 확인 팝업과 동일 absolute inset:0 오버레이. 3.5초 자동 사라짐 + backdrop 클릭 즉시 닫힘. */}
            {guideSuccessMsg && (
              <div
                role="status"
                aria-live="polite"
                style={{
                  position: "absolute", inset: 0, zIndex: 21,
                  background: "rgba(0,0,0,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
                onClick={clearGuideSuccess}
              >
                <div onClick={(e) => e.stopPropagation()}
                  style={{
                    background: COLOR.white, borderRadius: 14, padding: "24px 22px 22px",
                    maxWidth: 280, width: "85%", textAlign: "center",
                    boxShadow: "0 8px 28px rgba(74,99,85,0.18)",
                    animation: "fadeInScale 0.18s ease-out",
                    fontFamily: "'Noto Sans KR', sans-serif",
                  }}
                >
                  <div
                    aria-hidden
                    style={{
                      width: 44, height: 44, borderRadius: "50%",
                      background: COLOR.sageDeep, color: COLOR.white,
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      fontSize: 22, fontWeight: 700, marginBottom: 12,
                    }}
                  >
                    ✓
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: COLOR.textDark, lineHeight: 1.5 }}>
                    {guideSuccessMsg}
                  </div>
                </div>
                <style>{`
                  @keyframes fadeInScale {
                    from { opacity: 0; transform: scale(0.92); }
                    to { opacity: 1; transform: scale(1); }
                  }
                `}</style>
              </div>
            )}
          </div>
          </>
        )}

        {/* 증상 추가 모달 */}
        {showAddSymptomModal && (
          <div onClick={() => setShowAddSymptomModal(false)}
            style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div onClick={(e) => e.stopPropagation()}
              style={{ background: COLOR.white, borderRadius: 14, padding: 22, maxWidth: 480, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: COLOR.textDark, marginBottom: 14 }}>증상 추가</div>

              {/* 카테고리 선택 */}
              <div style={{ fontSize: 13, fontWeight: 700, color: COLOR.sageDeep, marginBottom: 6 }}>카테고리</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                {SYMPTOM_OPTIONS.map((o) => (
                  <button key={o.id} type="button"
                    onClick={() => { setAddSymptomSelected(o.label); setAddSymptomCustom(""); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "10px 12px", borderRadius: 10,
                      background: addSymptomSelected === o.label ? o.bg : COLOR.sageBg,
                      border: addSymptomSelected === o.label ? `1.5px solid ${o.color}` : `1px solid ${COLOR.border}`,
                      cursor: "pointer", fontSize: 13, fontWeight: 600, color: COLOR.textDark, textAlign: "left",
                    }}>
                    {o.icon}<span>{o.label}</span>
                  </button>
                ))}
              </div>
              <input type="text" value={addSymptomCustom}
                onChange={(e) => { setAddSymptomCustom(e.target.value); setAddSymptomSelected(null); }}
                placeholder="직접 입력"
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${COLOR.sageLight}`, fontSize: 14, color: COLOR.textDark, outline: "none", marginBottom: 14, boxSizing: "border-box", fontFamily: "'Noto Sans KR', sans-serif" }} />

              {/* 기간 */}
              <div style={{ fontSize: 13, fontWeight: 700, color: COLOR.sageDeep, marginBottom: 6 }}>시작 시점</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {QUICK_DURATION_OPTIONS.map((q) => (
                  <button key={q.key} type="button"
                    onClick={() => { setAddSymptomQuickPick(q.key); setAddSymptomStartDate(calcDateFromQuick(q.key)); setAddSymptomDurationText(""); }}
                    style={{
                      padding: "5px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                      background: addSymptomQuickPick === q.key ? COLOR.sageDeep : COLOR.sageBg,
                      color: addSymptomQuickPick === q.key ? COLOR.white : COLOR.textMid,
                      border: addSymptomQuickPick === q.key ? `1.5px solid ${COLOR.sageDeep}` : `1px solid ${COLOR.border}`,
                      cursor: "pointer",
                    }}>
                    {q.label}
                  </button>
                ))}
              </div>
              <input type="date" value={addSymptomStartDate}
                onChange={(e) => { setAddSymptomStartDate(e.target.value); setAddSymptomQuickPick(null); setAddSymptomDurationText(""); }}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: `1px solid ${COLOR.border}`, fontSize: 14, color: COLOR.textDark, outline: "none", marginBottom: 8, boxSizing: "border-box", fontFamily: "'Noto Sans KR', sans-serif" }} />
              <input type="text" value={addSymptomDurationText}
                onChange={(e) => { setAddSymptomDurationText(e.target.value); setAddSymptomQuickPick(null); setAddSymptomStartDate(""); }}
                placeholder="직접 텍스트 (예: 어릴 때부터, 출산 후부터)"
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: `1px solid ${COLOR.border}`, fontSize: 14, color: COLOR.textDark, outline: "none", marginBottom: 14, boxSizing: "border-box", fontFamily: "'Noto Sans KR', sans-serif" }} />

              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => setShowAddSymptomModal(false)}
                  style={{ flex: 1, padding: "10px 0", borderRadius: 8, fontSize: 14, fontWeight: 600, background: COLOR.sageBg, color: COLOR.textMid, border: `1px solid ${COLOR.border}`, cursor: "pointer" }}>
                  취소
                </button>
                <button type="button" onClick={addNewSymptom}
                  disabled={!addSymptomSelected && !addSymptomCustom.trim()}
                  style={{ flex: 1, padding: "10px 0", borderRadius: 8, fontSize: 14, fontWeight: 700, background: (addSymptomSelected || addSymptomCustom.trim()) ? COLOR.sageDeep : COLOR.sageLight, color: COLOR.white, border: "none", cursor: "pointer" }}>
                  추가
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ══════════════════════════════════════════
   보조 컴포넌트
   ══════════════════════════════════════════ */

function InfoCell({
  label, display, editor, editing, onEdit, onSave, onCancel,
}: {
  label: string;
  display: React.ReactNode;
  editor: React.ReactNode;
  editing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", background: COLOR.white, borderRadius: 10, border: `1px solid ${COLOR.border}`, flexWrap: "wrap" }}>
      <span style={{ fontSize: 13, color: COLOR.sageMid, minWidth: 40 }}>{label}</span>
      {editing ? (
        <>
          {editor}
          <button type="button" onClick={onSave} style={{ padding: "3px 8px", borderRadius: 4, fontSize: 12, fontWeight: 600, background: COLOR.sageDeep, color: COLOR.white, border: "none", cursor: "pointer" }}>저장</button>
          <button type="button" onClick={onCancel} style={{ padding: "3px 8px", borderRadius: 4, fontSize: 12, fontWeight: 600, background: "transparent", color: COLOR.textMid, border: `1px solid ${COLOR.border}`, cursor: "pointer" }}>취소</button>
        </>
      ) : (
        <>
          {display}
          <EditBtn onClick={onEdit} label={`${label} 편집`} />
        </>
      )}
    </div>
  );
}

function VisitField({
  label, value, editing, editValue, setEditValue, onStart, onSave, onCancel, terraBox, grayBox,
}: {
  label: string;
  value?: string;
  editing: boolean;
  editValue: string;
  setEditValue: (v: string) => void;
  onStart: () => void;
  onSave: () => void;
  onCancel: () => void;
  terraBox?: boolean;
  grayBox?: boolean;
}) {
  const boxed = terraBox || grayBox;
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#5E7D6C", marginBottom: 4 }}>{label}</div>
      {editing ? (
        <div style={{ display: "flex", gap: 6 }}>
          <textarea value={editValue} autoFocus
            onChange={(e) => setEditValue(e.target.value)} rows={3}
            style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${COLOR.sageLight}`, fontSize: 15, color: "#2C3630", outline: "none", resize: "vertical", fontFamily: "'Noto Sans KR', sans-serif", lineHeight: 1.6 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <button type="button" onClick={onSave} style={{ padding: "6px 12px", borderRadius: 6, fontSize: 13, fontWeight: 600, background: COLOR.sageDeep, color: COLOR.white, border: "none", cursor: "pointer" }}>저장</button>
            <button type="button" onClick={onCancel} style={{ padding: "6px 12px", borderRadius: 6, fontSize: 13, fontWeight: 600, background: "transparent", color: "#3D4A42", border: `1px solid ${COLOR.border}`, cursor: "pointer" }}>취소</button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
          <div style={{
            flex: 1,
            padding: boxed ? "10px 12px" : 0,
            background: terraBox ? COLOR.terraPale : grayBox ? "#F4F6F3" : "transparent",
            border: terraBox ? `1px solid ${COLOR.terraLight}` : undefined,
            borderRadius: boxed ? 10 : 0,
            fontSize: 15, color: "#2C3630", lineHeight: 1.6,
            whiteSpace: "pre-wrap",
          }}>
            {value || "—"}
          </div>
          <EditBtn onClick={onStart} label={`${label} 편집`} />
        </div>
      )}
    </div>
  );
}

/* ── 차트 사진 업로드 블록 (각 방문 기록 카드 내부) ── */
function VisitPhotoBlock({
  visit,
  uploading,
  maxCount,
  onAdd,
  onRemove,
}: {
  visit: VisitRecord;
  uploading: boolean;
  maxCount: number;
  onAdd: (files: FileList | null) => void;
  onRemove: (url: string) => void;
}) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const reachedMax = visit.photos.length >= maxCount;
  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "9px 0",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    background: "#EDF4F0",
    color: "#4A6355",
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
  });
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#5E7D6C", marginBottom: 8 }}>
        방문 사진 (방문당 최대 {maxCount}장 · jpg/png/webp · 5MB 이하)
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          disabled={reachedMax || uploading}
          style={btnStyle(reachedMax || uploading)}
        >
          🖼 갤러리
        </button>
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={reachedMax || uploading}
          style={btnStyle(reachedMax || uploading)}
        >
          📸 카메라
        </button>
      </div>
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={(e) => { onAdd(e.target.files); e.target.value = ""; }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={(e) => { onAdd(e.target.files); e.target.value = ""; }}
      />
      {visit.photos.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
          {visit.photos.map((url, i) => (
            <div
              key={url + i}
              style={{
                position: "relative",
                width: 80,
                height: 80,
                borderRadius: 10,
                overflow: "hidden",
                border: "1px solid rgba(94,125,108,0.14)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`방문 사진 ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <button
                type="button"
                onClick={() => onRemove(url)}
                style={{
                  position: "absolute", top: 3, right: 3,
                  width: 20, height: 20, borderRadius: "50%",
                  background: "rgba(0,0,0,0.55)", color: "#fff",
                  border: "none", fontSize: 12, lineHeight: "20px",
                  textAlign: "center", cursor: "pointer", padding: 0,
                }}
                aria-label={`방문 사진 ${i + 1} 삭제`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize: 12, color: "#5E7D6C" }}>
        {uploading ? "업로드 중..." : `${visit.photos.length}/${maxCount}장`}
      </div>
    </div>
  );
}

export default function ChartClient() {
  return (
    <Suspense>
      <ChartContent />
    </Suspense>
  );
}
