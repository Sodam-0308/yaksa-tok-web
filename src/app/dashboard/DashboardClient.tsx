"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";


/* ── 타입 ── */
type PatientStatus = "requested" | "managing" | "inactive";

type SymptomCategory = "digestion" | "fatigue" | "sleep" | "skin" | "immune";

interface PatientConsult {
  id: string;
  patientName: string;
  patientGender: string;
  birthYear: number;
  patientStatus: PatientStatus;
  consultType: "local" | "remote";
  symptoms: { label: string; category: SymptomCategory }[];
  aiSummary: string;
  freeText: string;
  unreadCount: number;
  lastMessageAt: string; // relative
  createdAt: string;
  prevConsultCount: number;
  healthScores?: { label: string; before: number; after: number }[];
  memo?: string;
  visitDate?: string;
  nextVisitDate?: string;
  purchasedMeds?: string[];
  registrationSource: "app" | "offline";
  hasAppAccount: boolean;
  supplementStatus: "taking" | "not_taking" | "completed";
  consultationCount: number;
  hasPurchase: boolean;
  hasVisit: boolean;
  isRejected?: boolean;
  rejectedReason?: string;
  rejectedAt?: string;
  /** 환자 마지막 메시지 시각 (ISO). 약사 답장 긴급도 계산용. */
  lastPatientMessageAt?: string;
  /** 약사가 환자 마지막 메시지를 읽었는지 여부. false면 미답변. */
  isReadByPharmacist?: boolean;
  /** AI 문답 답변 (라벨-값). requested 환자 펼침 시 전문 표시. */
  questionnaire?: Record<string, string>;
  /** 이전 거절 이력 (재요청 환자 경고용) */
  previousRejections?: { date: string; reason: string; symptoms: string[] }[];
}

const CURRENT_YEAR = 2026;
const TODAY_STR = "2026.04.18";
/** 24시간 이상 미답변 여부. 환자 마지막 메시지 시간과 약사 읽음 상태 기준. */
const URGENT_THRESHOLD_HOURS = 24;
const NOW_ISO = "2026-04-21T10:00:00+09:00"; // Mock "현재" 시각

function hoursSince(iso: string, nowIso = NOW_ISO): number {
  const then = new Date(iso).getTime();
  const now = new Date(nowIso).getTime();
  if (Number.isNaN(then) || Number.isNaN(now)) return 0;
  return (now - then) / 3_600_000;
}

function needsUrgentReply(c: PatientConsult): boolean {
  if (!c.lastPatientMessageAt) return false;
  if (c.isReadByPharmacist) return false;
  if (c.isRejected) return false;
  // 🔥 답장 필요는 이미 수락된(상담 중) 환자에게만 적용.
  // 상담 요청 대기(requested)나 비활성(inactive)은 대상 아님.
  if (c.patientStatus !== "managing") return false;
  return hoursSince(c.lastPatientMessageAt) >= URGENT_THRESHOLD_HOURS;
}

/** 상담 요청(requested) 대기 24시간 경과 여부 — 수락 기다리는 상태 */
function needsAcceptUrgent(c: PatientConsult): boolean {
  if (c.patientStatus !== "requested") return false;
  if (c.isRejected) return false;
  // lastPatientMessageAt 있으면 우선, 없으면 createdAt(YYYY.MM.DD)을 timestamp로 변환
  const iso = c.lastPatientMessageAt ?? `${c.createdAt.replace(/\./g, "-")}T00:00:00+09:00`;
  return hoursSince(iso) >= URGENT_THRESHOLD_HOURS;
}

/** 마지막 환자 메시지로부터 경과 시간(시간 단위). 뱃지 색상 단계 계산용. */
function hoursOfLastPatientMsg(c: PatientConsult): number {
  if (c.lastPatientMessageAt) return Math.max(0, hoursSince(c.lastPatientMessageAt));
  const label = c.lastMessageAt ?? "";
  const hm = label.match(/(\d+)\s*시간/);
  if (hm) return parseInt(hm[1], 10);
  if (label === "어제") return 24;
  const dm = label.match(/(\d+)\s*일/);
  if (dm) return parseInt(dm[1], 10) * 24;
  const wm = label.match(/(\d+)\s*주/);
  if (wm) return parseInt(wm[1], 10) * 24 * 7;
  return 0;
}

/** 경과 시간별 뱃지 배경·글씨 색상. 24h+는 pulse 애니메이션 적용. */
function getUnreadBadgeStyle(hours: number): React.CSSProperties {
  if (hours < 6) return { background: "#FFD4A8", color: "#8B4513" };
  if (hours < 12) return { background: "#FF9A4D", color: "#fff" };
  if (hours < 24) return { background: "#F06820", color: "#fff" };
  return { background: "#E02020", color: "#fff", animation: "dashUnreadPulse 1s ease-in-out infinite" };
}

/**
 * 마지막 대화 시각을 정렬용 timestamp(ms)로 변환.
 * lastPatientMessageAt(ISO) 우선, 없으면 lastMessageAt 상대 표현 파싱.
 * 큰 값 = 최신.
 */
function sortableLastMsgTs(c: PatientConsult): number {
  const now = new Date(NOW_ISO).getTime();
  if (c.lastPatientMessageAt) {
    const t = new Date(c.lastPatientMessageAt).getTime();
    if (!Number.isNaN(t)) return t;
  }
  const label = c.lastMessageAt ?? "";
  let hoursAgo = 9999;
  const hm = label.match(/(\d+)\s*시간/);
  const dm = label.match(/(\d+)\s*일/);
  const wm = label.match(/(\d+)\s*주/);
  if (hm) hoursAgo = parseInt(hm[1], 10);
  else if (label === "어제") hoursAgo = 24;
  else if (dm) hoursAgo = parseInt(dm[1], 10) * 24;
  else if (wm) hoursAgo = parseInt(wm[1], 10) * 24 * 7;
  return now - hoursAgo * 3_600_000;
}

interface ChatMsg {
  id: string;
  sender: string;
  text: string;
  time: string;
}

/* ── 상수 ── */
const PATIENT_STATUS_CONFIG: Record<PatientStatus, { label: string; emoji: string; bg: string; color: string }> = {
  requested: { label: "상담 요청",    emoji: "🔔", bg: "#FFF3D6", color: "#B06D00" },
  managing:  { label: "사후 관리 중", emoji: "💊", bg: "var(--sage-pale, #EDF4F0)", color: "var(--sage-deep, #4A6355)" },
  inactive:  { label: "",             emoji: "",   bg: "",         color: "" },
};

const SYMPTOM_TAG_CLASS: Record<SymptomCategory, string> = {
  digestion: "dash-tag-digestion",
  fatigue:   "dash-tag-fatigue",
  sleep:     "dash-tag-sleep",
  skin:      "dash-tag-skin",
  immune:    "dash-tag-immune",
};

/* ── 관계 태그 ── */
type RelationTag = "regular" | "over" | "none";

function getRelationTag(c: PatientConsult): RelationTag {
  if (c.hasPurchase && c.hasVisit) return "regular";          // 💚 단골
  if (!c.hasPurchase && !c.hasVisit && c.consultationCount >= 5) return "over"; // ⏳ 상담만 5회+
  return "none"; // 일반 (태그 없음)
}

function getRelationSortPriority(tag: RelationTag): number {
  if (tag === "regular") return 0;  // 단골 최상위
  if (tag === "none") return 1;     // 일반 중간
  return 2;                         // over(상담만5회+) 최하위
}

type FilterKey = "all" | "requested" | "managing" | "visit_scheduled" | "unread" | "rejected";
type SortKey = "recent" | "unread";
type DateRangeKey = "all" | "1w" | "1m" | "3m" | "custom";

/* ── 상태 뱃지 (아이콘만 + 툴팁) ── */
function StatusBadge({
  emoji, tooltip, bg, borderColor,
}: {
  emoji: string; tooltip: string; bg: string; borderColor?: string;
}) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLSpanElement>(null);

  const updatePos = () => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 6, left: rect.left + rect.width / 2 });
  };

  return (
    <span
      ref={ref}
      title={tooltip}
      onMouseEnter={() => { updatePos(); setShow(true); }}
      onMouseLeave={() => setShow(false)}
      onClick={(e) => {
        e.stopPropagation();
        updatePos();
        setShow((s) => {
          const next = !s;
          if (next) {
            setTimeout(() => setShow(false), 1800);
          }
          return next;
        });
      }}
      style={{
        position: "relative", display: "inline-flex",
        alignItems: "center", justifyContent: "center",
        width: 28, height: 28, borderRadius: 14,
        background: bg, border: borderColor ? `1px solid ${borderColor}` : "none",
        fontSize: 16, lineHeight: 1, flexShrink: 0, cursor: "default",
      }}
    >
      {emoji}
      {show && (
        <span
          role="tooltip"
          style={{
            position: "fixed", top: pos.top, left: pos.left,
            transform: "translateX(-50%)",
            background: "#333", color: "#fff",
            padding: "6px 10px", borderRadius: 6,
            fontSize: 12, fontWeight: 500, lineHeight: 1.3,
            whiteSpace: "nowrap", zIndex: 1000,
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              position: "absolute", top: -4, left: "50%",
              transform: "translateX(-50%) rotate(45deg)",
              width: 8, height: 8, background: "#333",
            }}
          />
          {tooltip}
        </span>
      )}
    </span>
  );
}

/* ── 색상 상수 (사이드 패널용) ── */
const C = {
  sageBg: "#F8F9F7",
  sagePale: "#EDF4F0",
  sageLight: "#B3CCBE",
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

/* ── 더미 채팅 메시지 (환자별) ── */
const DUMMY_CHAT_MAP: Record<string, ChatMsg[]> = {
  "c-1": [
    { id: "m1", sender: "patient", text: "안녕하세요, 약사님. 만성피로 때문에 상담 신청했습니다.", time: "오전 10:30" },
    { id: "m2", sender: "patient", text: "아침에 일어나기가 너무 힘들고 오후 3시면 아무것도 할 수가 없어요.", time: "오전 10:31" },
  ],
  "c-2": [
    { id: "m1", sender: "pharmacist", text: "안녕하세요, 박○○님. 문답 내용 잘 확인했어요.", time: "오전 9:00" },
    { id: "m2", sender: "patient", text: "네, 식사 후 더부룩함이 심해서 상담 요청했습니다.", time: "오전 9:15" },
    { id: "m3", sender: "pharmacist", text: "유산균 종류를 변경해보는 것이 좋겠어요. 약국에 방문하시면 자세히 안내드리겠습니다.", time: "오전 9:20" },
    { id: "m4", sender: "patient", text: "알겠습니다. 이번 주에 방문할게요!", time: "오전 9:25" },
    { id: "m5", sender: "pharmacist", text: "좋습니다. 편하신 시간에 오세요!", time: "오전 9:30" },
  ],
  "c-3": [
    { id: "m1", sender: "pharmacist", text: "이○○님, 오메가3와 비타민D 복용 경과가 궁금해요.", time: "오후 2:00" },
    { id: "m2", sender: "patient", text: "관절 통증이 많이 줄었어요. 감사합니다!", time: "오후 3:10" },
  ],
  "c-4": [
    { id: "m1", sender: "patient", text: "턱 라인 트러블 때문에 상담 신청합니다.", time: "오후 1:00" },
  ],
  "c-5": [
    { id: "m1", sender: "pharmacist", text: "정○○님, 마그네슘과 테아닌 복용 후 수면이 어떠세요?", time: "오전 11:00" },
    { id: "m2", sender: "patient", text: "새벽에 깨는 횟수가 확실히 줄었어요!", time: "오후 12:30" },
    { id: "m3", sender: "pharmacist", text: "좋은 변화네요! 꾸준히 복용 유지해주세요.", time: "오후 12:45" },
  ],
  "c-6": [
    { id: "m1", sender: "patient", text: "안녕하세요. 만성피로와 면역력 때문에 상담 신청합니다.", time: "오후 4:00" },
    { id: "m2", sender: "pharmacist", text: "안녕하세요, 한○○님. 문답 내용 확인했습니다. 방문 일정 잡아드릴게요.", time: "오후 5:00" },
  ],
  "c-7": [
    { id: "m1", sender: "patient", text: "소화가 안 되고 피로가 심해서 상담 신청합니다.", time: "오전 10:00" },
    { id: "m2", sender: "pharmacist", text: "윤○○님, 문답 내용 확인했어요. 소화효소와 비타민B군 조합을 ���천드려요.", time: "오전 11:00" },
  ],
  "c-8": [
    { id: "m1", sender: "patient", text: "환절기만 되면 감기가 반복됩니다. 도움이 될까요?", time: "오후 1:00" },
  ],
  "c-9": [
    { id: "m1", sender: "patient", text: "탈모가 심해져서 영양제 상담받고 싶어요.", time: "오전 9:00" },
  ],
  "c-10": [
    { id: "m1", sender: "pharmacist", text: "강○○님, 수면 개선 경과가 궁금해요.", time: "오전 10:00" },
    { id: "m2", sender: "patient", text: "많이 좋아졌어요! 새벽에 깨는 횟수가 줄었습니다.", time: "오전 11:30" },
  ],
  "c-11": [
    { id: "m1", sender: "patient", text: "무릎이 아프고 속도 쓰려요. 영양제로 도움받을 수 있을까요?", time: "오전 8:30" },
    { id: "m2", sender: "patient", text: "약을 많이 먹어서 위장이 걱정됩니다.", time: "오전 8:32" },
  ],
};

/* ── 팔로업 관련 ── */
interface PanelFollowUp { date: string; time: string; message: string; }

const FU_DEFAULT_MSG = "안녕하세요! 지난번 상담 이후 경과가 궁금해요. 혹시 변화가 있으셨나요? 편하게 말씀해 주세요.";
const FU_TIME_OPTIONS = ["오전 9시", "오전 10시", "오후 12시", "오후 5시", "직접 입력"];

function formatFuLabel(dateStr: string): string {
  const [, m, d] = dateStr.split(".");
  return `${Number(m)}월 ${Number(d)}일`;
}

function calcFuDate(interval: string): string {
  const d = new Date(2026, 3, 10);
  if (interval === "1w") d.setDate(d.getDate() + 7);
  else if (interval === "2w") d.setDate(d.getDate() + 14);
  else if (interval === "1m") d.setMonth(d.getMonth() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${dd}`;
}

function calcDaysLeft(dateStr: string): string {
  const [y, m, d] = dateStr.split(".").map(Number);
  const target = new Date(y, m - 1, d);
  const now = new Date(2026, 3, 10);
  const diff = Math.round((target.getTime() - now.getTime()) / 86400000);
  if (diff <= 0) return "오늘";
  if (diff === 1) return "내일";
  if (diff === 2) return "이틀 뒤";
  return `${diff}일 뒤`;
}

function getEffectiveFuTime(fuTime: string, fuCustomTime: string): string {
  if (fuTime !== "직접 입력") return fuTime;
  if (!fuCustomTime) return "오전 10시";
  const [hh, mm] = fuCustomTime.split(":").map(Number);
  const ampm = hh < 12 ? "오전" : "오후";
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return mm === 0 ? `${ampm} ${h12}시` : `${ampm} ${h12}시 ${mm}분`;
}

/* ── 더미 데이터 ── */
const MOCK_CONSULTS: PatientConsult[] = [
  {
    id: "c-1",
    patientName: "김○○",
    patientGender: "여",
    birthYear: 1997,
    patientStatus: "managing",
    consultType: "local",
    symptoms: [
      { label: "만성피로", category: "fatigue" },
      { label: "수면장애", category: "sleep" },
    ],
    aiSummary: "6개월 이상 오후 피로감 심화, 입면 장애 동반. 기분 저하와 집중력 저하도 호소.",
    questionnaire: {
      증상: "만성피로, 수면장애",
      기간: "6개월 이상",
      직업: "사무직",
      수면: "5시간 (입면 어려움)",
      음주: "주 1회",
      카페인: "하루 3잔 이상",
      흡연: "비흡연",
      운동: "주 1~2회 요가",
      간식: "하루 1번",
      예산: "월 5~7만원",
    },
    freeText: "아침에 일어나기가 너무 힘들고 오후 3시쯤 되면 정말 아무것도 할 수가 없어요. 커피를 3잔 이상 마시는데도 효과가 없습니다. 밤에 잠들려면 2시간은 걸려요.",
    unreadCount: 2,
    lastMessageAt: "2시간 전",
    createdAt: "2026.04.03",
    prevConsultCount: 0,
    visitDate: "2026.04.03",
    purchasedMeds: ["비타민D", "마그네슘"],
    registrationSource: "app",
    hasAppAccount: true,
    supplementStatus: "taking",
    consultationCount: 5,
    hasPurchase: true,
    hasVisit: true,
  },
  {
    id: "c-2",
    patientName: "박○○",
    patientGender: "남",
    birthYear: 1985,
    patientStatus: "managing",
    consultType: "local",
    symptoms: [
      { label: "소화장애", category: "digestion" },
    ],
    aiSummary: "식후 더부룩함, 가스 과다. 브리스톨 척도 1~2형. 배변 주기 불규칙.",
    questionnaire: {
      증상: "소화장애",
      기간: "3개월",
      직업: "회사원",
      수면: "6시간",
      음주: "주 2회",
      카페인: "하루 2잔",
      흡연: "비흡연",
      운동: "주 1회 등산",
      간식: "가끔",
      예산: "월 8만원",
    },
    freeText: "식사 후 30분이면 배가 빵빵해지고 가스가 많이 찹니다. 변비도 있어서 2~3일에 한 번 정도 화장실에 갑니다.",
    unreadCount: 5,
    lastMessageAt: "어제",
    createdAt: "2026.04.01",
    prevConsultCount: 1,
    healthScores: [
      { label: "소화", before: 2, after: 5 },
      { label: "에너지", before: 4, after: 6 },
    ],
    visitDate: undefined,
    purchasedMeds: [],
    registrationSource: "app",
    hasAppAccount: true,
    supplementStatus: "not_taking",
    consultationCount: 2,
    lastPatientMessageAt: "2026-04-19T14:20:00+09:00",
    isReadByPharmacist: false,
    hasPurchase: false,
    hasVisit: false,
  },
  {
    id: "c-3",
    patientName: "이○○",
    patientGender: "여",
    birthYear: 1972,
    patientStatus: "managing",
    consultType: "local",
    symptoms: [
      { label: "관절통", category: "immune" },
      { label: "면역력 저하", category: "immune" },
    ],
    aiSummary: "무릎·손가락 관절 불편감 2년. 감기 잦음. 아침 관절 강직 호소.",
    questionnaire: {
      증상: "관절통, 면역력 저하",
      기간: "2년 이상",
      직업: "가정주부",
      수면: "6~7시간",
      음주: "안 함",
      카페인: "하루 1잔",
      흡연: "비흡연",
      운동: "주 3회 산책",
      간식: "하루 1번 이하",
      예산: "월 12만원",
    },
    freeText: "무릎이 시리고 아침에 손가락이 뻣뻣합니다. 감기도 자주 걸리고 낫는 데 오래 걸려요. 병원에서는 큰 이상 없다고 합니다.",
    unreadCount: 0,
    lastMessageAt: "3일 전",
    createdAt: "2026.03.28",
    prevConsultCount: 2,
    healthScores: [
      { label: "관절", before: 3, after: 6 },
      { label: "면역력", before: 2, after: 5 },
    ],
    visitDate: "2026.03.27",
    purchasedMeds: ["오메가3", "비타민D 4000IU", "아연"],
    registrationSource: "offline",
    hasAppAccount: false,
    supplementStatus: "taking",
    consultationCount: 3,
    hasPurchase: true,
    hasVisit: true,
  },
  {
    id: "c-4",
    patientName: "최○○",
    patientGender: "남",
    birthYear: 1999,
    patientStatus: "requested",
    consultType: "remote",
    symptoms: [
      { label: "여드름", category: "skin" },
      { label: "소화장애", category: "digestion" },
    ],
    aiSummary: "턱 라인 트러블 반복 8개월. 장 건강 연관 가능성. 식후 불편감 동반.",
    questionnaire: {
      증상: "여드름, 소화장애",
      기간: "8개월",
      직업: "대학원생",
      수면: "7시간",
      음주: "주 1회",
      카페인: "하루 3잔",
      흡연: "비흡연",
      운동: "주 2~3회 헬스",
      간식: "하루 2번 이상",
      예산: "월 5만원 이내",
    },
    freeText: "턱 쪽에 큰 트러블이 반복적으로 올라옵니다. 피부과에서 약도 먹어봤는데 끊으면 다시 나요. 장이 안 좋은 것과 관련 있을 수 있다고 해서 상담 신청합니다. 아침에 일어나면 속이 더부룩하고 점심 먹으면 소화가 잘 안 되는 느낌이 자주 있어요.",
    unreadCount: 1,
    lastMessageAt: "5시간 전",
    createdAt: "2026.04.03",
    prevConsultCount: 0,
    visitDate: undefined,
    purchasedMeds: [],
    registrationSource: "offline",
    hasAppAccount: false,
    supplementStatus: "not_taking",
    consultationCount: 6,
    hasPurchase: false,
    hasVisit: false,
  },
  {
    id: "c-5",
    patientName: "정○○",
    patientGender: "여",
    birthYear: 1991,
    patientStatus: "inactive",
    consultType: "local",
    symptoms: [
      { label: "불면", category: "sleep" },
    ],
    aiSummary: "새벽 3시 반복 각성 패턴. 입면은 양호하나 수면 유지 어려움 호소.",
    questionnaire: {
      증상: "불면",
      기간: "4개월",
      직업: "디자이너",
      수면: "4~5시간 (새벽 각성)",
      음주: "주 1회",
      카페인: "하루 3잔",
      흡연: "비흡연",
      운동: "거의 안 함",
      간식: "하루 1번",
      예산: "월 6만원",
    },
    freeText: "새벽 3시에 꼭 깹니다. 다시 잠들기 너무 힘들어요.",
    unreadCount: 0,
    lastMessageAt: "1주 전",
    createdAt: "2026.03.20",
    prevConsultCount: 1,
    healthScores: [
      { label: "수면", before: 3, after: 7 },
      { label: "피로", before: 7, after: 3 },
    ],
    visitDate: "2026.03.20",
    purchasedMeds: ["마그네슘", "테아닌"],
    registrationSource: "app",
    hasAppAccount: true,
    supplementStatus: "completed",
    consultationCount: 1,
    hasPurchase: false,
    hasVisit: false,
  },
  {
    id: "c-6",
    patientName: "한○○",
    patientGender: "남",
    birthYear: 1962,
    patientStatus: "requested",
    nextVisitDate: "2026.04.20",
    consultType: "local",
    symptoms: [
      { label: "만성피로", category: "fatigue" },
      { label: "면역력 저하", category: "immune" },
    ],
    aiSummary: "만성 피로감 1년+, 잦은 감기. 식욕 저하와 체중 감소 동반.",
    questionnaire: {
      증상: "만성피로, 면역력 저하",
      기간: "1년 이상",
      직업: "영업직",
      수면: "5~6시간",
      음주: "주 3회",
      카페인: "하루 4잔",
      흡연: "비흡연",
      운동: "거의 안 함",
      간식: "하루 1번",
      예산: "월 10~15만원",
    },
    freeText: "항상 몸이 무겁고 기운이 없습니다. 감기도 달고 살고요. 영양제를 여러 개 먹고 있는데 뭐가 맞는 건지 모르겠어요. 출장이 잦아 식사 시간이 일정치 않고, 저녁에는 거의 외식으로 해결합니다.",
    unreadCount: 0,
    lastMessageAt: "1일 전",
    createdAt: "2026.04.02",
    prevConsultCount: 0,
    visitDate: undefined,
    purchasedMeds: ["비타민D 2000IU"],
    registrationSource: "offline",
    hasAppAccount: true,
    supplementStatus: "not_taking",
    consultationCount: 4,
    hasPurchase: false,
    hasVisit: false,
  },
  {
    id: "c-7",
    patientName: "윤○○",
    patientGender: "여",
    birthYear: 1980,
    patientStatus: "managing",
    consultType: "local",
    symptoms: [
      { label: "소화장애", category: "digestion" },
      { label: "만성피로", category: "fatigue" },
    ],
    aiSummary: "위장 기능 저하 + 피로감 복합. 식후 졸음과 더부룩함 반복.",
    questionnaire: {
      증상: "소화장애, 만성피로",
      기간: "5개월",
      직업: "교사",
      수면: "6시간",
      음주: "월 1~2회",
      카페인: "하루 2잔",
      흡연: "비흡연",
      운동: "주 2회 필라테스",
      간식: "하루 2번",
      예산: "월 8~10만원",
    },
    freeText: "밥 먹고 나면 항상 속이 더부룩하고 오후에 너무 피곤해요. 소화제를 달고 삽니다.",
    unreadCount: 3,
    lastMessageAt: "3시간 전",
    createdAt: "2026.04.05",
    prevConsultCount: 1,
    visitDate: "2026.04.06",
    purchasedMeds: ["소화효소", "비타민B군"],
    registrationSource: "app",
    hasAppAccount: true,
    supplementStatus: "taking",
    consultationCount: 4,
    hasPurchase: true,
    hasVisit: true,
  },
  {
    id: "c-8",
    patientName: "서○○",
    patientGender: "남",
    birthYear: 1973,
    patientStatus: "inactive",
    isRejected: true,
    rejectedReason: "전문 분야 아님",
    rejectedAt: "2026.04.10",
    consultType: "remote",
    symptoms: [
      { label: "면역력 저하", category: "immune" },
    ],
    aiSummary: "환절기 감기 반복, 만성 비염. 코막힘과 후비루 증상 지속.",
    questionnaire: {
      증상: "면역력 저하, 비염",
      기간: "1년 이상",
      직업: "IT 개발자",
      수면: "7시간",
      음주: "주 2회",
      카페인: "하루 3잔",
      흡연: "비흡연",
      운동: "거의 안 함",
      간식: "하루 1번",
      예산: "월 10만원",
    },
    freeText: "환절기만 되면 감기를 달고 살아요. 코도 항상 막히고 비염약을 계속 먹고 있습니다.",
    unreadCount: 0,
    lastMessageAt: "2일 전",
    createdAt: "2026.03.25",
    prevConsultCount: 0,
    visitDate: undefined,
    purchasedMeds: [],
    registrationSource: "app",
    hasAppAccount: true,
    supplementStatus: "not_taking",
    consultationCount: 7,
    hasPurchase: false,
    hasVisit: false,
  },
  {
    id: "c-9",
    patientName: "조○○",
    patientGender: "여",
    birthYear: 2003,
    patientStatus: "managing",
    nextVisitDate: "2026.04.18",
    consultType: "local",
    symptoms: [
      { label: "탈모", category: "skin" },
    ],
    aiSummary: "미만성 탈모 6개월. 두피 전반 모발 가늘어짐, 빠지는 양 증가 호소.",
    questionnaire: {
      증상: "탈모",
      기간: "6개월",
      직업: "대학생",
      수면: "6~7시간",
      음주: "가끔",
      카페인: "하루 2잔",
      흡연: "비흡연",
      운동: "주 1회 걷기",
      간식: "하루 2번",
      예산: "월 3~5만원",
    },
    freeText: "머리카락이 점점 가늘어지고 빠지는 양이 많아졌어요. 병원에서 특별한 이상은 없다고 했는데 걱정됩니다.",
    unreadCount: 1,
    lastMessageAt: "어제",
    createdAt: "2026.04.07",
    prevConsultCount: 0,
    visitDate: undefined,
    purchasedMeds: [],
    registrationSource: "app",
    hasAppAccount: true,
    supplementStatus: "not_taking",
    consultationCount: 1,
    lastPatientMessageAt: "2026-04-20T08:30:00+09:00",
    isReadByPharmacist: false,
    hasPurchase: false,
    hasVisit: false,
  },
  {
    id: "c-10",
    patientName: "강○○",
    patientGender: "남",
    birthYear: 1994,
    patientStatus: "managing",
    consultType: "local",
    symptoms: [
      { label: "수면장애", category: "sleep" },
      { label: "만성피로", category: "fatigue" },
    ],
    aiSummary: "수면 유지 장애 + 오전 피로. 새벽 반복 각성, 주간 졸림 심함.",
    questionnaire: {
      증상: "수면장애, 만성피로",
      기간: "3개월",
      직업: "회사원",
      수면: "5시간 (새벽 각성 2~3회)",
      음주: "주 3회",
      카페인: "하루 4잔",
      흡연: "비흡연",
      운동: "주 1회",
      간식: "하루 1번",
      예산: "월 7만원",
    },
    freeText: "새벽에 2~3번씩 깨고 아침에 개운하지 않아요. 낮에 집중이 안 되고 항상 졸립니다.",
    unreadCount: 0,
    lastMessageAt: "4일 전",
    createdAt: "2026.03.30",
    prevConsultCount: 1,
    healthScores: [
      { label: "수면", before: 2, after: 6 },
      { label: "에너지", before: 3, after: 6 },
    ],
    visitDate: "2026.03.31",
    purchasedMeds: ["마그네슘", "GABA", "비타민D"],
    registrationSource: "offline",
    hasAppAccount: true,
    supplementStatus: "taking",
    consultationCount: 3,
    hasPurchase: true,
    hasVisit: true,
  },
  {
    id: "c-11",
    patientName: "송○○",
    patientGender: "여",
    birthYear: 1963,
    patientStatus: "inactive",
    isRejected: true,
    rejectedReason: "상담 여유 없음",
    rejectedAt: "2026.04.12",
    consultType: "local",
    symptoms: [
      { label: "관절통", category: "immune" },
      { label: "���화장애", category: "digestion" },
    ],
    aiSummary: "무릎 관절 불편감 + 속 쓰림. 계단 보행 곤란, 위장 부담감 호소.",
    questionnaire: {
      증상: "관절통, 소화장애",
      기간: "1년 이상",
      직업: "자영업",
      수면: "6시간",
      음주: "안 함",
      카페인: "하루 1잔",
      흡연: "비흡연",
      운동: "거의 안 함",
      간식: "하루 1번",
      예산: "월 10만원",
    },
    freeText: "무릎이 아파서 계단 오르기가 힘들고 속도 자주 쓰려요. 약을 많�� 먹어서 위장에 부담이 가는 것 같아요.",
    unreadCount: 2,
    lastMessageAt: "6시간 전",
    createdAt: "2026.04.04",
    prevConsultCount: 0,
    visitDate: undefined,
    purchasedMeds: [],
    registrationSource: "offline",
    hasAppAccount: false,
    supplementStatus: "not_taking",
    consultationCount: 5,
    hasPurchase: false,
    hasVisit: false,
  },
  {
    id: "c-12",
    patientName: "장○○",
    patientGender: "여",
    birthYear: 1988,
    patientStatus: "requested",
    consultType: "local",
    symptoms: [
      { label: "소화장애", category: "digestion" },
      { label: "만성피로", category: "fatigue" },
    ],
    aiSummary: "재요청 상담. 증상 교체 — 이전엔 관절통·소화장애, 이번엔 소화장애·피로.",
    questionnaire: {
      증상: "소화장애, 만성피로",
      기간: "2개월",
      직업: "회계사",
      수면: "6시간",
      음주: "주 1회",
      카페인: "하루 2잔",
      흡연: "비흡연",
      운동: "거의 안 함",
      간식: "하루 1번",
      예산: "월 8만원",
    },
    freeText: "한 달 전쯤부터 다시 속이 불편하고 오후만 되면 많이 피곤해요. 전에 상담 신청드렸다가 거절되셨는데 이번엔 증상이 좀 달라서 다시 요청드립니다.",
    unreadCount: 1,
    lastMessageAt: "3시간 전",
    createdAt: "2026.04.21",
    prevConsultCount: 0,
    visitDate: undefined,
    purchasedMeds: [],
    registrationSource: "app",
    hasAppAccount: true,
    supplementStatus: "not_taking",
    consultationCount: 2,
    hasPurchase: false,
    hasVisit: false,
    previousRejections: [
      {
        date: "2026.03.20",
        reason: "전문 분야 아님",
        symptoms: ["관절통", "소화장애"],
      },
    ],
  },
  {
    id: "c-13",
    patientName: "오○○",
    patientGender: "여",
    birthYear: 1995,
    patientStatus: "managing",
    consultType: "local",
    symptoms: [
      { label: "여드름", category: "skin" },
    ],
    aiSummary: "방문 후 제품 결정 미뤄짐. 생활 습관 먼저 점검하고 구매는 다음 기회로.",
    questionnaire: {
      증상: "여드름",
      기간: "3개월",
      직업: "프리랜서",
      수면: "7시간",
      음주: "월 1회",
      카페인: "하루 2잔",
      흡연: "비흡연",
      운동: "주 1회 요가",
      간식: "하루 2번",
      예산: "월 5만원",
    },
    freeText: "상담만 받고 제품 구매는 다음에 하기로 했어요. 약사님 말씀대로 식습관부터 바꿔보고 있습니다.",
    unreadCount: 0,
    lastMessageAt: "2일 전",
    createdAt: "2026.04.05",
    prevConsultCount: 0,
    visitDate: "2026.04.08",
    purchasedMeds: [],
    registrationSource: "app",
    hasAppAccount: true,
    supplementStatus: "not_taking",
    consultationCount: 2,
    hasPurchase: false,
    hasVisit: true,
  },
];

/* ── 날짜 유틸 ── */
function parseDate(str: string): Date {
  const [y, m, d] = str.split(".").map(Number);
  return new Date(y, m - 1, d);
}

function getLatestDate(c: PatientConsult): Date {
  const created = parseDate(c.createdAt);
  if (!c.visitDate) return created;
  const visited = parseDate(c.visitDate);
  return visited > created ? visited : created;
}

/* ── 환자 카드 컴포넌트 ── */
function PatientCard({
  data,
  expanded,
  onToggle,
  onOpenChat,
  chatOpen,
  onAccept,
  onReject,
}: {
  data: PatientConsult;
  expanded: boolean;
  onToggle: () => void;
  onOpenChat: (id: string) => void;
  chatOpen: boolean;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const router = useRouter();
  const [memo, setMemo] = useState(data.memo ?? "");
  const [showMemo, setShowMemo] = useState(false);
  const statusCfg = PATIENT_STATUS_CONFIG[data.patientStatus];
  const showStatusBadge = data.patientStatus !== "inactive" && !data.isRejected;
  const relationTag = getRelationTag(data);
  const isOverConsult = relationTag === "over";
  const age = CURRENT_YEAR - data.birthYear;
  const isRequested = data.patientStatus === "requested" && !data.isRejected;
  const isUrgent = needsUrgentReply(data);         // managing + 24h (답장 필요)
  const isAcceptUrgent = needsAcceptUrgent(data);  // requested + 24h (수락 필요)
  const [freeTextExpanded, setFreeTextExpanded] = useState(false);
  const [rejectionHistoryExpanded, setRejectionHistoryExpanded] = useState(false);
  const hasPrevRejections = (data.previousRejections?.length ?? 0) > 0;

  const badgeIsApp = data.hasAppAccount;

  return (
    <article style={{
      padding: 16, background: isOverConsult ? "#FAFAFA" : "#fff",
      border: "1px solid var(--border, rgba(94,125,108,0.14))",
      borderRadius: 12,
    }}>
      {/* 카드 클릭 영역 */}
      <div onClick={onToggle} style={{ cursor: "pointer" }}>
        {/* ── 상단 줄: 좌(이름+정보+상태) / 우(마지막 대화) ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          {/* 왼쪽 */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "nowrap", flex: 1, minWidth: 0, overflow: "hidden" }}>
            <span style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.5, color: "#2C3630", whiteSpace: "nowrap" }}>{data.patientName}</span>
            {relationTag === "regular" && (
              <span style={{ fontSize: 16, lineHeight: 1.5, flexShrink: 0 }}>💚</span>
            )}
            <span style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.5, whiteSpace: "nowrap", flexShrink: 0, color: badgeIsApp ? "var(--sage-deep, #4A6355)" : "var(--terra, #C06B45)" }}>
              {badgeIsApp ? "📱 약사톡" : "🏥 워크인"}
            </span>
            <span style={{ fontSize: 14, color: "var(--text-mid, #3D4A42)", lineHeight: 1.5, whiteSpace: "nowrap", flexShrink: 0 }}>
              ({data.patientGender}, {age}세)
            </span>
            {data.consultType === "remote" && (
              <span className="dash-badge-remote" style={{ lineHeight: 1.5, flexShrink: 0 }}>원격</span>
            )}
            {showStatusBadge && (
              <StatusBadge
                emoji={statusCfg.emoji}
                tooltip={statusCfg.label}
                bg={statusCfg.bg}
              />
            )}
            {data.isRejected && (
              <StatusBadge
                emoji="❌"
                tooltip={`거절됨 - ${data.rejectedReason ?? ""}`}
                bg="#FFE5E5"
              />
            )}
          </div>
          {/* 오른쪽 */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 12 }}>
            <span style={{ fontSize: 13, color: "var(--text-mid, #3D4A42)", whiteSpace: "nowrap", lineHeight: 1.5 }}>마지막 대화: {data.lastMessageAt}</span>
            {data.unreadCount > 0 && (
              <span
                className="dash-unread-badge"
                style={{ flexShrink: 0, ...getUnreadBadgeStyle(hoursOfLastPatientMsg(data)) }}
              >
                {data.unreadCount}
              </span>
            )}
          </div>
        </div>
        {/* ⚠️ 거절 이력 경고 배너 (접힘/펼침 공통, 이름 줄 아래) */}
        {hasPrevRejections && (
          <div
            style={{
              background: "#FFF8E1", color: "#B06D00",
              fontSize: 14, fontWeight: 600,
              padding: "8px 14px", borderRadius: 10,
              marginBottom: 10,
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <span>⚠️ 이 환자는 이전 거절 이력이 {data.previousRejections!.length}건 있어요</span>
          </div>
        )}
        {/* ── 하단 줄: 좌(복용+태그) / 우(방문일) ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {/* 왼쪽 — 복용 중인 환자에게만 복용 뱃지 표시. 미복용/완료는 숨김 */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "nowrap", flex: 1, minWidth: 0, overflow: "hidden" }}>
            {data.supplementStatus === "taking" && (
              <>
                <span style={{
                  display: "inline-block", padding: "4px 10px", borderRadius: 12, fontSize: 13, fontWeight: 500, lineHeight: "18px",
                  background: "#EAF3DE", color: "#3B6D11",
                  whiteSpace: "nowrap", flexShrink: 0,
                }}>
                  복용 중
                </span>
                <span style={{ fontSize: 14, color: "var(--text-mid, #3D4A42)", flexShrink: 0 }}>|</span>
              </>
            )}
            {data.symptoms.map((s) => (
              <span key={s.label} className={`dash-tag ${SYMPTOM_TAG_CLASS[s.category]}`} style={{ fontSize: 14, fontWeight: 500, color: "var(--text-dark, #2C3630)", padding: "4px 10px", whiteSpace: "nowrap", flexShrink: 0 }}>
                {s.label}
              </span>
            ))}
          </div>
          {/* 오른쪽 — 거절 / 방문 예정+"방문 전" / 최근 방문+"구매 영양제: 없음" */}
          <div style={{ flexShrink: 0, marginLeft: 12, textAlign: "right" }}>
            {data.isRejected ? (
              <span style={{ fontSize: 13, color: "#D32F2F", fontWeight: 600, whiteSpace: "nowrap" }}>
                거절: {data.rejectedAt?.slice(5).replace(".", "/")}
              </span>
            ) : data.nextVisitDate ? (
              <>
                <div style={{ fontSize: 14, color: "var(--sage-deep, #4A6355)", fontWeight: 600, whiteSpace: "nowrap" }}>
                  🗓️ 방문 예정: {data.nextVisitDate.slice(5).replace(".", "/")}
                </div>
                {!data.visitDate && (
                  <div style={{ fontSize: 13, color: "#3D4A42", whiteSpace: "nowrap", marginTop: 2 }}>
                    방문 전
                  </div>
                )}
              </>
            ) : data.visitDate ? (
              <>
                <div style={{ fontSize: 14, color: "var(--text-mid, #3D4A42)", whiteSpace: "nowrap" }}>
                  최근 방문: {data.visitDate.slice(5).replace(".", "/")}
                </div>
                {(!data.purchasedMeds || data.purchasedMeds.length === 0) && (
                  <div style={{ fontSize: 13, color: "#3D4A42", whiteSpace: "nowrap", marginTop: 2 }}>
                    구매 영양제: 없음
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* 접기/펼치기 상세 */}
      {expanded && (
        <div className="dash-detail">
          {/* 🔥 경고 — managing은 답변 지연, requested는 수락 지연 */}
          {(isUrgent || isAcceptUrgent) && !data.isRejected && (
            <div
              role="alert"
              style={{
                background: "#FFF0E6",
                color: "#E05A1A",
                fontSize: 14, fontWeight: 600,
                padding: "10px 16px",
                borderRadius: 10,
                marginTop: 12,
                marginBottom: 12,
                display: "flex", alignItems: "center", gap: 8,
              }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>🔥</span>
              <span>
                {isAcceptUrgent
                  ? "환자가 24시간 이상 수락을 기다리고 있어요"
                  : "환자가 24시간 이상 답변을 기다리고 있어요"}
              </span>
            </div>
          )}
          {/* 첫 상담 날짜 */}
          <div className="dash-detail-section">
            <div className="dash-detail-title">첫 상담</div>
            <div style={{ fontSize: 14, color: "var(--text-mid)" }}>{data.createdAt}</div>
          </div>

          {/* 이전 거절 이력 (재요청 환자) */}
          {hasPrevRejections && (
            <div className="dash-detail-section">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setRejectionHistoryExpanded((v) => !v); }}
                style={{
                  width: "100%", textAlign: "left",
                  padding: "10px 14px", borderRadius: 10,
                  background: "#FFFDF5", border: "1px solid #F5E6AE",
                  cursor: "pointer", fontSize: 14, fontWeight: 600,
                  color: "#B06D00",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  fontFamily: "'Noto Sans KR', sans-serif",
                }}
              >
                <span>이전 거절 이력 ({data.previousRejections!.length}건)</span>
                <span style={{ fontSize: 13 }}>{rejectionHistoryExpanded ? "접기 ▲" : "이전 이력 보기 ▼"}</span>
              </button>
              {rejectionHistoryExpanded && (
                <div style={{
                  marginTop: 8,
                  background: "#FFFDF5", borderRadius: 10, padding: 14,
                }}>
                  {data.previousRejections!.map((r, i, arr) => (
                    <div
                      key={i}
                      style={{
                        paddingBottom: i === arr.length - 1 ? 0 : 10,
                        marginBottom: i === arr.length - 1 ? 0 : 10,
                        borderBottom: i === arr.length - 1 ? "none" : "1px solid rgba(94,125,108,0.08)",
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#2C3630", marginBottom: 4 }}>
                        {r.date}
                      </div>
                      <div style={{ fontSize: 14, color: "#3D4A42", marginBottom: 6 }}>
                        사유: <span style={{ fontWeight: 600, color: "#B06D00" }}>{r.reason}</span>
                      </div>
                      <div style={{ fontSize: 13, color: "#3D4A42", marginBottom: 4 }}>당시 증상</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {r.symptoms.map((s) => (
                          <span key={s} style={{
                            display: "inline-block",
                            padding: "3px 10px", borderRadius: 100,
                            fontSize: 13, fontWeight: 600,
                            background: "#F8F9F7", color: "#3D4A42",
                            border: "1px solid rgba(94,125,108,0.14)",
                          }}>
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 문답 전문 — 모든 상태의 환자에게 동일하게 표시 */}
          {data.questionnaire && Object.keys(data.questionnaire).length > 0 && (
            <div className="dash-detail-section">
              <div className="dash-detail-title">문답 답변</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {Object.entries(data.questionnaire).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 14, lineHeight: 1.6 }}>
                    <span style={{ color: "#3D4A42", minWidth: 60, flexShrink: 0 }}>{k}</span>
                    <span style={{ color: "#3D4A42" }}>—</span>
                    <span style={{ color: "#2C3630", fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 자유 서술 (펼침 가능) */}
          <div className="dash-detail-section">
            <div className="dash-detail-title">자유 서술</div>
            <div
              style={{
                fontSize: 14, color: "#2C3630",
                ...(freeTextExpanded
                  ? { wordBreak: "break-word" as const }
                  : {
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical" as const,
                      wordBreak: "break-word" as const,
                    }),
              }}
            >
              {data.freeText}
            </div>
            {(data.freeText.length > 60 || data.freeText.includes("\n")) && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setFreeTextExpanded((v) => !v); }}
                style={{
                  marginTop: 4, padding: "2px 0",
                  fontSize: 14, fontWeight: 600,
                  color: "#5E7D6C",
                  background: "none", border: "none",
                  cursor: "pointer", fontFamily: "'Noto Sans KR', sans-serif",
                }}
              >
                {freeTextExpanded ? "접기" : "더 보기"}
              </button>
            )}
          </div>

          {/* 최근 방문 (날짜 + 구매 영양제 통합) */}
          {data.visitDate && (
            <div className="dash-detail-section">
              <div className="dash-detail-title">최근 방문</div>
              <div style={{ fontSize: 14, color: "var(--text-dark)", fontWeight: 600, marginBottom: 6 }}>
                {data.visitDate}
              </div>
              <div style={{ fontSize: 14, color: "var(--text-mid)", lineHeight: 1.5 }}>
                구매 영양제:{" "}
                {data.purchasedMeds && data.purchasedMeds.length > 0
                  ? data.purchasedMeds.join(", ")
                  : "없음"}
              </div>
            </div>
          )}

          {/* 약사 메모 */}
          <div className="dash-detail-section">
            <div className="dash-detail-title">
              내 메모
              <button className="dash-memo-toggle" onClick={() => setShowMemo(!showMemo)}>
                {showMemo ? "접기" : "작성"}
              </button>
            </div>
            {showMemo && (
              <textarea
                className="dash-memo-input"
                placeholder="환자에게 보이지 않는 내부 메모입니다."
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                rows={3}
              />
            )}
            {!showMemo && memo && (
              <div className="dash-memo-preview">{memo}</div>
            )}
          </div>

          {/* 빠른 액션 */}
          {data.isRejected ? (
            <div style={{
              marginTop: 14, padding: "12px 14px", borderRadius: 10,
              background: "#FFF5F5", border: "1px solid #FCD6D6",
              fontSize: 14, fontWeight: 600, color: "#D32F2F", textAlign: "center",
            }}>
              거절됨 — 사유: {data.rejectedReason ?? "기타"}
            </div>
          ) : isRequested ? (
            <div style={{ display: "flex", gap: 12, marginTop: 14, padding: "0 20px" }}>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onReject(data.id); }}
                style={{
                  flex: 1, padding: "12px 0", borderRadius: 10,
                  fontSize: 14, fontWeight: 700,
                  background: "#fff", color: "#D32F2F",
                  border: "1.5px solid #D32F2F", cursor: "pointer",
                }}
              >거절</button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onAccept(data.id); }}
                style={{
                  flex: 1, padding: "12px 0", borderRadius: 10,
                  fontSize: 14, fontWeight: 700,
                  background: "var(--sage-deep, #4A6355)", color: "#fff",
                  border: "1.5px solid var(--sage-deep, #4A6355)", cursor: "pointer",
                }}
              >수락</button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 12, marginTop: 14, padding: "0 20px" }}>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onOpenChat(data.id); }}
                style={{
                  flex: 1, padding: "12px 0", borderRadius: 10,
                  fontSize: 14, fontWeight: 700,
                  background: isUrgent ? "#C06B45" : "var(--sage-deep, #4A6355)",
                  color: "#fff",
                  border: "none", cursor: "pointer",
                }}
              >채팅창 열기</button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); router.push(`/chart/${data.id}${chatOpen ? "?chatOpen=true" : ""}`); }}
                style={{
                  flex: 1, padding: "12px 0", borderRadius: 10,
                  fontSize: 14, fontWeight: 700,
                  background: "#fff", color: "var(--sage-deep, #4A6355)",
                  border: "1.5px solid var(--sage-light, #B3CCBE)", cursor: "pointer",
                }}
              >차트 보기</button>
            </div>
          )}
        </div>
      )}

      {/* 펼치기/접기 버튼 */}
      <button className="dash-expand-btn" onClick={onToggle}>
        {expanded ? "접기 ▲" : "상세보기 ▼"}
      </button>
    </article>
  );
}

/* ══════════════════════════════════════════
   채팅 사이드 패널 컴포넌트
   ══════════════════════════════════════════ */
function ChatSidePanel({
  patient,
  onClose,
}: {
  patient: PatientConsult;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<ChatMsg[]>(
    () => (DUMMY_CHAT_MAP[patient.id] ?? []).map((m) => ({ ...m })),
  );
  const [input, setInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  /* 팔로업 */
  const [followUp, setFollowUp] = useState<PanelFollowUp | null>(null);
  const [showFuSettings, setShowFuSettings] = useState(false);
  const [fuInterval, setFuInterval] = useState("2w");
  const [fuCustomDate, setFuCustomDate] = useState("");
  const [fuTime, setFuTime] = useState("오전 10시");
  const [fuCustomTime, setFuCustomTime] = useState("10:00");
  const [fuMessage, setFuMessage] = useState(FU_DEFAULT_MSG);
  const [showFuCancel, setShowFuCancel] = useState(false);
  const [systemMsgs, setSystemMsgs] = useState<string[]>([]);

  /* 방문 안내 */
  const VISIT_SLOTS = ["오전", "오후", "종일", "직접 입력"];
  const [showVisitPanel, setShowVisitPanel] = useState(false);
  const [vDate, setVDate] = useState("");
  const [vTimeSlot, setVTimeSlot] = useState("오전");
  const [vCustomTime, setVCustomTime] = useState("");
  const [vMemo, setVMemo] = useState("");

  const sendVisitGuide = () => {
    if (!vDate) return;
    const ts = vTimeSlot === "직접 입력" ? (vCustomTime || "오전") : vTimeSlot;
    const [y, m, d] = vDate.split("-").map(Number);
    const label = `${y}년 ${m}월 ${d}일 ${ts}${vMemo ? ` · ${vMemo}` : ""}`;
    const now = new Date();
    const hh = now.getHours(); const mm = now.getMinutes();
    const ampm = hh < 12 ? "오전" : "오후";
    const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
    const timeStr = `${ampm} ${h12}:${String(mm).padStart(2, "0")}`;
    setMessages(prev => [...prev, {
      id: `visit-${Date.now()}`, sender: "pharmacist", text: `📅 방문 안내: ${label}`, time: timeStr,
    }]);
    setSystemMsgs(prev => [...prev, `방문 안내가 ${m}월 ${d}일 ${ts}에 전송되었습니다.`]);
    setShowVisitPanel(false);
    setVDate(""); setVMemo("");
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const confirmFu = () => {
    const dateStr = fuInterval === "custom" ? fuCustomDate.replace(/-/g, ".") : calcFuDate(fuInterval);
    const timeStr = getEffectiveFuTime(fuTime, fuCustomTime);
    setFollowUp({ date: dateStr, time: timeStr, message: fuMessage });
    setSystemMsgs((prev) => [...prev, `팔로업이 ${formatFuLabel(dateStr)} ${timeStr}에 설정되었습니다.`]);
    setShowFuSettings(false);
  };

  const sendMessage = () => {
    const text = input.trim();
    if (!text) return;
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const ampm = h < 12 ? "오전" : "오후";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const timeStr = `${ampm} ${h12}:${String(m).padStart(2, "0")}`;
    setMessages((prev) => [
      ...prev,
      { id: `m${Date.now()}`, sender: "pharmacist", text, time: timeStr },
    ]);
    setInput("");
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const symptomLabels = patient.symptoms.map((s) => s.label).join(" · ");

  return (
    <div
      onMouseEnter={() => { document.body.style.overflow = "hidden"; }}
      onMouseLeave={() => { document.body.style.overflow = "auto"; }}
      style={{
        position: "fixed", top: 64, right: 0, width: 400, height: "calc(100vh - 64px)",
        display: "flex", flexDirection: "column",
        borderLeft: `1px solid ${C.border}`, background: C.white,
        zIndex: 100, overflow: "hidden",
        boxShadow: "-4px 0 24px rgba(0,0,0,0.08)",
      }}
    >
      {/* 패널 헤더 */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 20px", borderBottom: `1px solid ${C.border}`, flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.textDark }}>채팅 상담</div>
          <div style={{ fontSize: 13, color: C.sageMid, marginTop: 2 }}>
            {patient.patientName} · {symptomLabels}
          </div>
        </div>
        <button
          type="button"
          onClick={() => { onClose(); document.body.style.overflow = "auto"; }}
          aria-label="채팅 패널 닫기"
          style={{
            width: 32, height: 32, borderRadius: 8,
            background: C.sagePale, border: "none",
            cursor: "pointer", display: "flex",
            alignItems: "center", justifyContent: "center",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.textMid} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* 팔로업 배너 */}
      {followUp && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 16px", background: C.terraPale,
          borderBottom: `1px solid ${C.terraLight}`,
          fontSize: 12, color: C.terra, fontWeight: 600, flexShrink: 0,
        }}>
          <span>팔로업: {formatFuLabel(followUp.date)} {followUp.time} ({calcDaysLeft(followUp.date)})</span>
          <button type="button" onClick={() => setShowFuCancel(true)} style={{
            padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: "transparent", color: C.terra,
            border: `1px solid ${C.terra}`, cursor: "pointer", flexShrink: 0, marginLeft: 6,
          }}>취소</button>
        </div>
      )}

      {/* 메시지 영역 */}
      <div
        onWheel={(e) => e.stopPropagation()}
        style={{
          flex: 1, overflowY: "auto", padding: "16px 16px 8px",
          display: "flex", flexDirection: "column", gap: 12,
        }}
      >
        {/* 날짜 구분선 */}
        <div style={{
          textAlign: "center", fontSize: 12, color: C.sageMid,
          padding: "4px 12px", background: C.sagePale,
          borderRadius: 100, alignSelf: "center",
        }}>
          2026년 4월 7일
        </div>

        {messages.map((msg) => {
          const isMe = msg.sender === "pharmacist";
          return (
            <div
              key={msg.id}
              style={{
                display: "flex", flexDirection: "column",
                alignItems: isMe ? "flex-end" : "flex-start",
                maxWidth: "85%", alignSelf: isMe ? "flex-end" : "flex-start",
              }}
            >
              <div style={{
                padding: "10px 14px",
                borderRadius: isMe ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                background: isMe ? C.sageDeep : C.sagePale,
                color: isMe ? C.white : C.textDark,
                fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap",
              }}>
                {msg.text}
              </div>
              <span style={{
                fontSize: 11, color: C.sageMid, marginTop: 4,
                paddingLeft: isMe ? 0 : 4, paddingRight: isMe ? 4 : 0,
              }}>
                {msg.time}
              </span>
            </div>
          );
        })}

        {/* 시스템 메시지 */}
        {systemMsgs.map((sm, si) => (
          <div key={`sys-${si}`} style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            padding: "6px 0", gap: 3,
          }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "5px 14px", borderRadius: 100,
              background: C.sagePale, border: `1px solid ${C.sageLight}`,
              fontSize: 12, color: C.sageDeep, fontWeight: 600,
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.sageDeep} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              {sm}
            </div>
            <span style={{ fontSize: 10, color: "#9AA8A0" }}>약사님만 보이는 메세지입니다.</span>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* 템플릿 + 팔로업 버튼 */}
      <div style={{
        padding: "6px 16px", borderTop: `1px solid ${C.border}`,
        display: "flex", gap: 8, flexShrink: 0,
      }}>
        <button type="button" onClick={() => {
          setInput("안녕하세요, 초록숲 약국 김서연 약사입니다. 문답 내용 잘 확인했어요. 궁금한 점 편하게 물어봐 주세요!");
        }} style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "5px 12px", borderRadius: 16,
          fontSize: 12, fontWeight: 600,
          background: C.sagePale, color: C.sageDeep,
          border: `1px solid ${C.sageLight}`, cursor: "pointer",
        }}>템플릿</button>
        <button type="button" onClick={() => {
          setFuMessage(followUp?.message ?? FU_DEFAULT_MSG);
          setShowFuSettings(true);
        }} style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "5px 12px", borderRadius: 16,
          fontSize: 12, fontWeight: 600,
          background: C.terraPale, color: C.terra,
          border: `1px solid ${C.terraLight}`, cursor: "pointer",
        }}>팔로업 설정</button>
        <button type="button" onClick={() => setShowVisitPanel(true)} style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "5px 12px", borderRadius: 16,
          fontSize: 12, fontWeight: 600,
          background: "#E8F0F5", color: "#5A8BA8",
          border: "1px solid #B3D1E0", cursor: "pointer",
        }}>방문 안내</button>
      </div>

      {/* 입력 영역 */}
      <div style={{
        padding: "12px 16px", borderTop: `1px solid ${C.border}`,
        display: "flex", gap: 8, alignItems: "flex-end", flexShrink: 0,
      }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
              e.preventDefault();
              sendMessage();
            }
            if (e.key === "Enter" && e.ctrlKey) {
              e.preventDefault();
              setInput((prev) => prev + "\n");
            }
          }}
          placeholder="메시지를 입력하세요..."
          rows={1}
          style={{
            flex: 1, padding: "10px 14px", borderRadius: 12,
            border: `1.5px solid ${C.sageLight}`,
            fontSize: 14, color: C.textDark, outline: "none",
            resize: "none", fontFamily: "'Noto Sans KR', sans-serif",
            lineHeight: 1.5, background: C.sageBg, maxHeight: 80,
          }}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = Math.min(el.scrollHeight, 80) + "px";
          }}
        />
        <button
          type="button"
          onClick={sendMessage}
          style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            background: input.trim() ? C.sageDeep : C.sageLight,
            border: "none", cursor: input.trim() ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.2s",
          }}
          disabled={!input.trim()}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.white} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>

      {/* 팔로업 설정 오버레이 */}
      {showFuSettings && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 10,
          background: "rgba(0,0,0,0.3)",
          display: "flex", alignItems: "flex-end",
        }} onClick={() => setShowFuSettings(false)}>
          <div style={{
            background: C.white, borderRadius: "16px 16px 0 0",
            padding: "16px 18px 20px", width: "100%",
            maxHeight: "75%", overflowY: "auto",
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.textDark, marginBottom: 4 }}>팔로업 설정</div>
            <div style={{ fontSize: 13, color: C.textMid, marginBottom: 14, lineHeight: 1.5 }}>
              설정한 날짜에 환자에게 경과 확인 메시지가 자동 발송됩니다.
            </div>

            <div style={{ fontSize: 13, fontWeight: 700, color: C.textDark, marginBottom: 8 }}>간격 선택</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {([
                { value: "1w", label: "1주 후" },
                { value: "2w", label: "2주 후" },
                { value: "1m", label: "한 달 후" },
                { value: "custom", label: "직접 입력" },
              ] as const).map((opt) => (
                <button key={opt.value} type="button" onClick={() => setFuInterval(opt.value)} style={{
                  padding: "6px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: fuInterval === opt.value ? C.sageDeep : C.sageBg,
                  color: fuInterval === opt.value ? C.white : C.textMid,
                  border: fuInterval === opt.value ? `1.5px solid ${C.sageDeep}` : `1px solid ${C.border}`,
                  cursor: "pointer",
                }}>{opt.label}</button>
              ))}
            </div>

            {fuInterval === "custom" && (
              <input type="date" value={fuCustomDate} onChange={(e) => setFuCustomDate(e.target.value)} style={{
                width: "100%", padding: "8px 10px", borderRadius: 8,
                border: `1.5px solid ${C.sageLight}`, fontSize: 13, color: C.textDark,
                outline: "none", marginBottom: 12, fontFamily: "'Noto Sans KR', sans-serif",
              }} />
            )}
            {fuInterval !== "custom" && (
              <div style={{ padding: "8px 12px", borderRadius: 8, background: C.sagePale, marginBottom: 12, fontSize: 13, color: C.sageDeep, fontWeight: 600 }}>
                예정: {formatFuLabel(calcFuDate(fuInterval))} {fuTime === "직접 입력" ? getEffectiveFuTime(fuTime, fuCustomTime) : fuTime}
              </div>
            )}

            <div style={{ fontSize: 13, fontWeight: 700, color: C.textDark, marginBottom: 8 }}>시간 선택</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: fuTime === "직접 입력" ? 6 : 12 }}>
              {FU_TIME_OPTIONS.map((t) => (
                <button key={t} type="button" onClick={() => setFuTime(t)} style={{
                  padding: "5px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: fuTime === t ? C.sageDeep : C.sageBg,
                  color: fuTime === t ? C.white : C.textMid,
                  border: fuTime === t ? `1.5px solid ${C.sageDeep}` : `1px solid ${C.border}`,
                  cursor: "pointer",
                }}>{t}</button>
              ))}
            </div>
            {fuTime === "직접 입력" && (
              <input type="time" value={fuCustomTime} onChange={(e) => setFuCustomTime(e.target.value)} style={{
                width: "100%", padding: "7px 10px", borderRadius: 8,
                border: `1.5px solid ${C.sageLight}`, fontSize: 13, color: C.textDark,
                outline: "none", marginBottom: 12, fontFamily: "'Noto Sans KR', sans-serif",
              }} />
            )}

            <div style={{ fontSize: 13, fontWeight: 700, color: C.textDark, marginBottom: 8 }}>메시지 내용</div>
            <textarea value={fuMessage} onChange={(e) => setFuMessage(e.target.value)} rows={3} style={{
              width: "100%", padding: "10px 12px", borderRadius: 10,
              border: `1.5px solid ${C.sageLight}`, fontSize: 13, color: C.textDark,
              outline: "none", resize: "vertical", fontFamily: "'Noto Sans KR', sans-serif", lineHeight: 1.6,
            }} />
            <button type="button" onClick={confirmFu} disabled={fuInterval === "custom" && !fuCustomDate} style={{
              width: "100%", padding: "12px 0", borderRadius: 10, fontSize: 14, fontWeight: 700, marginTop: 12,
              background: (fuInterval === "custom" && !fuCustomDate) ? C.sageLight : C.sageDeep,
              color: C.white, border: "none", cursor: "pointer",
            }}>설정 완료</button>
          </div>
        </div>
      )}

      {/* 방문 안내 설정 오버레이 */}
      {showVisitPanel && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 10,
          background: "rgba(0,0,0,0.3)",
          display: "flex", alignItems: "flex-end",
        }} onClick={() => setShowVisitPanel(false)}>
          <div style={{
            background: C.white, borderRadius: "16px 16px 0 0",
            padding: "16px 18px 20px", width: "100%",
            maxHeight: "80%", overflowY: "auto",
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.textDark, marginBottom: 4 }}>방문 안내</div>
            <div style={{ fontSize: 13, color: C.textMid, marginBottom: 12, lineHeight: 1.5 }}>
              환자에게 약국 방문 일정을 안내합니다.
            </div>

            {/* AI 제안 */}
            <div style={{
              padding: "12px 14px", borderRadius: 10, marginBottom: 14,
              background: "#F4F5F3", border: `1px solid ${C.border}`,
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.sageDeep, marginBottom: 4 }}>
                (AI) 대화 내용을 보니 이번 주 토요일 오전은 어떨까요?
              </div>
              <button type="button" onClick={() => {
                const sat = new Date(); sat.setDate(sat.getDate() + (6 - sat.getDay()));
                const iso = `${sat.getFullYear()}-${String(sat.getMonth() + 1).padStart(2, "0")}-${String(sat.getDate()).padStart(2, "0")}`;
                setVDate(iso); setVTimeSlot("오전");
              }} style={{
                padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                background: C.sageDeep, color: C.white, border: "none", cursor: "pointer",
              }}>이대로 설정</button>
              <div style={{ fontSize: 10, color: "#9AA8A0", marginTop: 4 }}>(백엔드 연결 후 실제 AI가 제안합니다)</div>
            </div>

            <div style={{ fontSize: 13, fontWeight: 700, color: C.textDark, marginBottom: 8 }}>날짜 선택</div>
            <input type="date" value={vDate} onChange={(e) => setVDate(e.target.value)} style={{
              width: "100%", padding: "8px 10px", borderRadius: 8,
              border: `1.5px solid ${C.sageLight}`, fontSize: 13, color: C.textDark,
              outline: "none", marginBottom: 12, fontFamily: "'Noto Sans KR', sans-serif",
            }} />

            <div style={{ fontSize: 13, fontWeight: 700, color: C.textDark, marginBottom: 8 }}>시간대 선택</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: vTimeSlot === "직접 입력" ? 6 : 12 }}>
              {VISIT_SLOTS.map((t) => (
                <button key={t} type="button" onClick={() => setVTimeSlot(t)} style={{
                  padding: "5px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: vTimeSlot === t ? C.sageDeep : C.sageBg,
                  color: vTimeSlot === t ? C.white : C.textMid,
                  border: vTimeSlot === t ? `1.5px solid ${C.sageDeep}` : `1px solid ${C.border}`,
                  cursor: "pointer",
                }}>{t}</button>
              ))}
            </div>
            {vTimeSlot === "직접 입력" && (
              <input type="text" value={vCustomTime} onChange={(e) => setVCustomTime(e.target.value)}
                placeholder="예: 9시-10시" style={{
                  width: "100%", padding: "7px 10px", borderRadius: 8,
                  border: `1.5px solid ${C.sageLight}`, fontSize: 13, color: C.textDark,
                  outline: "none", marginBottom: 12, fontFamily: "'Noto Sans KR', sans-serif",
                }} />
            )}

            <div style={{ fontSize: 13, fontWeight: 700, color: C.textDark, marginBottom: 8 }}>메모</div>
            <input type="text" value={vMemo} onChange={(e) => setVMemo(e.target.value)}
              placeholder="예: 9시-10시가 한가해요" style={{
                width: "100%", padding: "7px 10px", borderRadius: 8,
                border: `1.5px solid ${C.sageLight}`, fontSize: 13, color: C.textDark,
                outline: "none", marginBottom: 12, fontFamily: "'Noto Sans KR', sans-serif",
              }} />

            <button type="button" onClick={sendVisitGuide} disabled={!vDate} style={{
              width: "100%", padding: "12px 0", borderRadius: 10, fontSize: 14, fontWeight: 700, marginTop: 4,
              background: !vDate ? C.sageLight : "#5A8BA8",
              color: C.white, border: "none", cursor: "pointer",
            }}>방문 안내 보내기</button>
          </div>
        </div>
      )}

      {/* 팔로업 취소 확인 */}
      {showFuCancel && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 20,
          background: "rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => setShowFuCancel(false)}>
          <div style={{
            background: C.white, borderRadius: 14, padding: 20,
            maxWidth: 280, width: "90%", textAlign: "center",
            boxShadow: "0 6px 24px rgba(0,0,0,0.15)",
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.textDark, marginBottom: 6 }}>팔로업을 취소하시겠습니까?</div>
            <div style={{ fontSize: 13, color: C.textMid, marginBottom: 16, lineHeight: 1.5 }}>설정된 팔로업 메시지가 발송되지 않습니다.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => setShowFuCancel(false)} style={{
                flex: 1, padding: "10px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: C.sageBg, color: C.textMid, border: `1px solid ${C.border}`, cursor: "pointer",
              }}>아니오</button>
              <button type="button" onClick={() => { setFollowUp(null); setShowFuCancel(false); }} style={{
                flex: 1, padding: "10px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                background: C.terra, color: C.white, border: "none", cursor: "pointer",
              }}>취소하기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 대시보드 메인 ── */
function DashboardContent() {
  const router = useRouter();
  const showEmptyState = false;
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sortBy, setSortBy] = useState<SortKey>("recent");
  const [search, setSearch] = useState("");

  /* ── 실시간 상담 요청 (DB) — 상단 배너 + 전용 리스트 ── */
  interface DbQuestionnaireDetail {
    symptoms: string[] | null;
    symptom_duration: string | null;
    severity: string | null;
    occupation: string | null;
    sleep_hours: number | null;
    water_intake: number | null;
    meal_pattern: string | null;
    snack_frequency: string | null;
    exercise_frequency: string | null;
    exercise_types: string[] | null;
    alcohol: string | null;
    caffeine: string | null;
    smoking: string | null;
    current_supplements: string[] | null;
    current_medications: string[] | null;
    allergies: string[] | null;
    monthly_budget: number | null;
    free_text: string | null;
    detailed_answers: Record<string, unknown> | null;
  }
  interface DbPendingRow {
    id: string;
    created_at: string;
    patient: { id: string; name: string; avatar_url: string | null } | null;
    questionnaire: DbQuestionnaireDetail | null;
    patient_profile: { birth_year: number | null; gender: string | null } | null;
  }
  interface DbActiveRow {
    id: string;
    status: string;
    created_at: string;
    last_message_at: string | null;
    patient: { id: string; name: string; avatar_url: string | null } | null;
    questionnaire: { symptoms: string[] | null } | null;
    patient_profile: { birth_year: number | null; gender: string | null } | null;
  }
  const { user: authUser } = useAuth();
  const [dbPendingCount, setDbPendingCount] = useState<number | null>(null);
  const [dbPendingList, setDbPendingList] = useState<DbPendingRow[] | null>(null);
  const [dbPendingLoading, setDbPendingLoading] = useState(true);
  const [expandedPendingId, setExpandedPendingId] = useState<string | null>(null);
  const [dbActiveList, setDbActiveList] = useState<DbActiveRow[] | null>(null);
  const [dbActiveLoading, setDbActiveLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const fetchPendingRequests = async (myUserId: string | null) => {
    setDbPendingLoading(true);
    console.log("[dashboard] fetchPendingRequests — myUserId:", myUserId);

    // 1) consultations 만 단순 SELECT — 임베드(JOIN) 없이 가져와 400 회피
    const unassignedQuery = supabase
      .from("consultations")
      .select("*")
      .eq("status", "pending")
      .is("pharmacist_id", null);

    const myQuery = myUserId
      ? supabase
          .from("consultations")
          .select("*")
          .eq("status", "pending")
          .eq("pharmacist_id", myUserId)
      : Promise.resolve({ data: [] as unknown[], error: null });

    const [unRes, myRes] = await Promise.all([unassignedQuery, myQuery]);

    console.log("[dashboard] unassigned query result:", unRes);
    console.log("[dashboard] mine query result:", myRes);

    if (unRes.error) {
      console.error("[dashboard] pending unassigned query FAILED:", {
        message: unRes.error.message,
        code: unRes.error.code,
        details: unRes.error.details,
        hint: unRes.error.hint,
      });
    }
    if (myRes && "error" in myRes && myRes.error) {
      console.error("[dashboard] pending mine query FAILED:", {
        message: myRes.error.message,
        code: (myRes.error as { code?: string }).code,
        details: (myRes.error as { details?: string }).details,
        hint: (myRes.error as { hint?: string }).hint,
      });
    }

    interface ConsRow {
      id: string;
      status: string;
      pharmacist_id: string | null;
      patient_id: string;
      questionnaire_id: string | null;
      created_at: string;
    }
    const unRows = ((unRes.data ?? []) as unknown) as ConsRow[];
    const myRows =
      myRes && "data" in myRes ? ((myRes.data ?? []) as unknown as ConsRow[]) : [];

    // id 기준 중복 제거
    const byId = new Map<string, ConsRow>();
    for (const r of [...unRows, ...myRows]) byId.set(r.id, r);

    // 본인(약사)이 환자로서 보낸 요청은 제외
    const filtered = Array.from(byId.values()).filter(
      (c) => !myUserId || c.patient_id !== myUserId,
    );

    const consultations = filtered.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    console.log(
      "[dashboard] consultations merged (self-filtered):",
      consultations.length,
    );

    if (consultations.length === 0) {
      setDbPendingList([]);
      setDbPendingCount(0);
      setDbPendingLoading(false);
      return;
    }

    // 2) 각 consultation의 patient/questionnaire/patient_profile 을 IN 쿼리로 일괄 조회
    const patientIds = Array.from(new Set(consultations.map((c) => c.patient_id)));
    const questionnaireIds = consultations
      .map((c) => c.questionnaire_id)
      .filter((v): v is string => !!v);

    const [profilesRes, qRes, patientProfRes] = await Promise.all([
      patientIds.length > 0
        ? supabase
            .from("profiles")
            .select("id, name, avatar_url")
            .in("id", patientIds)
        : Promise.resolve({ data: [] as unknown[], error: null }),
      questionnaireIds.length > 0
        ? supabase
            .from("ai_questionnaires")
            .select(
              "id, symptoms, symptom_duration, severity, occupation, sleep_hours, water_intake, meal_pattern, snack_frequency, exercise_frequency, exercise_types, alcohol, caffeine, smoking, current_supplements, current_medications, allergies, monthly_budget, free_text, detailed_answers",
            )
            .in("id", questionnaireIds)
        : Promise.resolve({ data: [] as unknown[], error: null }),
      patientIds.length > 0
        ? supabase
            .from("patient_profiles")
            .select("id, birth_year, gender")
            .in("id", patientIds)
        : Promise.resolve({ data: [] as unknown[], error: null }),
    ]);

    if ("error" in profilesRes && profilesRes.error) {
      console.error("[dashboard] profiles fetch FAILED:", profilesRes.error);
    }
    if ("error" in qRes && qRes.error) {
      console.error("[dashboard] ai_questionnaires fetch FAILED:", qRes.error);
    }
    if ("error" in patientProfRes && patientProfRes.error) {
      console.error("[dashboard] patient_profiles fetch FAILED:", patientProfRes.error);
    }

    const profileById = new Map<string, { id: string; name: string; avatar_url: string | null }>();
    for (const p of (profilesRes.data ?? []) as { id: string; name: string; avatar_url: string | null }[]) {
      profileById.set(p.id, p);
    }
    type QFull = DbQuestionnaireDetail & { id: string };
    const qById = new Map<string, QFull>();
    for (const q of (qRes.data ?? []) as QFull[]) {
      qById.set(q.id, q);
    }
    const patientProfById = new Map<string, { id: string; birth_year: number | null; gender: string | null }>();
    for (const pp of (patientProfRes.data ?? []) as { id: string; birth_year: number | null; gender: string | null }[]) {
      patientProfById.set(pp.id, pp);
    }

    const rows: DbPendingRow[] = consultations.map((c) => ({
      id: c.id,
      created_at: c.created_at,
      patient: profileById.get(c.patient_id) ?? null,
      questionnaire: c.questionnaire_id ? qById.get(c.questionnaire_id) ?? null : null,
      patient_profile: patientProfById.get(c.patient_id) ?? null,
    }));

    console.log("[dashboard] pending list final:", rows);
    setDbPendingList(rows);
    setDbPendingCount(rows.length);
    setDbPendingLoading(false);
  };

  const fetchActiveConsultations = async (pharmacistId: string) => {
    setDbActiveLoading(true);
    console.log("[dashboard] fetchActiveConsultations — pharmacistId:", pharmacistId);

    // 1) consultations 만 단순 SELECT — 임베드 없이 (400 회피)
    const consRes = await supabase
      .from("consultations")
      .select("*")
      .in("status", ["accepted", "chatting", "visit_scheduled"])
      .eq("pharmacist_id", pharmacistId)
      .order("last_message_at", { ascending: false, nullsFirst: false });

    console.log("[dashboard] active consultations query result:", consRes);

    if (consRes.error) {
      console.error("[dashboard] active list failed:", {
        message: consRes.error.message,
        code: consRes.error.code,
        details: consRes.error.details,
        hint: consRes.error.hint,
      });
      setDbActiveList([]);
      setDbActiveLoading(false);
      return;
    }

    interface ActiveConsRow {
      id: string;
      status: string;
      created_at: string;
      last_message_at: string | null;
      patient_id: string;
      questionnaire_id: string | null;
    }
    const consultations = ((consRes.data ?? []) as unknown) as ActiveConsRow[];

    if (consultations.length === 0) {
      setDbActiveList([]);
      setDbActiveLoading(false);
      return;
    }

    // 2) IN 쿼리로 patient/questionnaire/patient_profile 일괄 조회
    const patientIds = Array.from(new Set(consultations.map((c) => c.patient_id)));
    const questionnaireIds = consultations
      .map((c) => c.questionnaire_id)
      .filter((v): v is string => !!v);

    const [profilesRes, qRes, patientProfRes] = await Promise.all([
      patientIds.length > 0
        ? supabase
            .from("profiles")
            .select("id, name, avatar_url")
            .in("id", patientIds)
        : Promise.resolve({ data: [] as unknown[], error: null }),
      questionnaireIds.length > 0
        ? supabase
            .from("ai_questionnaires")
            .select("id, symptoms")
            .in("id", questionnaireIds)
        : Promise.resolve({ data: [] as unknown[], error: null }),
      patientIds.length > 0
        ? supabase
            .from("patient_profiles")
            .select("id, birth_year, gender")
            .in("id", patientIds)
        : Promise.resolve({ data: [] as unknown[], error: null }),
    ]);

    if ("error" in profilesRes && profilesRes.error) {
      console.error("[dashboard] active profiles fetch FAILED:", profilesRes.error);
    }
    if ("error" in qRes && qRes.error) {
      console.error("[dashboard] active ai_questionnaires fetch FAILED:", qRes.error);
    }
    if ("error" in patientProfRes && patientProfRes.error) {
      console.error("[dashboard] active patient_profiles fetch FAILED:", patientProfRes.error);
    }

    const profileById = new Map<string, { id: string; name: string; avatar_url: string | null }>();
    for (const p of (profilesRes.data ?? []) as { id: string; name: string; avatar_url: string | null }[]) {
      profileById.set(p.id, p);
    }
    const qById = new Map<string, { id: string; symptoms: string[] | null }>();
    for (const q of (qRes.data ?? []) as { id: string; symptoms: string[] | null }[]) {
      qById.set(q.id, q);
    }
    const patientProfById = new Map<string, { id: string; birth_year: number | null; gender: string | null }>();
    for (const pp of (patientProfRes.data ?? []) as { id: string; birth_year: number | null; gender: string | null }[]) {
      patientProfById.set(pp.id, pp);
    }

    const rows: DbActiveRow[] = consultations.map((c) => ({
      id: c.id,
      status: c.status,
      created_at: c.created_at,
      last_message_at: c.last_message_at,
      patient: profileById.get(c.patient_id) ?? null,
      questionnaire: c.questionnaire_id ? qById.get(c.questionnaire_id) ?? null : null,
      patient_profile: patientProfById.get(c.patient_id) ?? null,
    }));

    console.log("[dashboard] active list final:", rows);
    setDbActiveList(rows);
    setDbActiveLoading(false);
  };

  useEffect(() => {
    fetchPendingRequests(authUser?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

  useEffect(() => {
    if (!authUser) {
      setDbActiveList([]);
      setDbActiveLoading(false);
      return;
    }
    fetchActiveConsultations(authUser.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

  const updatePendingStatus = async (
    id: string,
    nextStatus: "accepted" | "rejected",
  ) => {
    if (actingId) return;
    setActingId(id);

    type Patch = {
      status: string;
      rejected_at?: string;
      pharmacist_id?: string;
    };
    const patch: Patch = { status: nextStatus };
    if (nextStatus === "rejected") {
      patch.rejected_at = new Date().toISOString();
    }
    if (nextStatus === "accepted" && authUser) {
      // 수락 시 자기 자신을 pharmacist_id 로 설정
      patch.pharmacist_id = authUser.id;
    }

    const { error } = await (supabase
      .from("consultations") as unknown as {
        update: (p: Patch) => {
          eq: (col: string, val: string) => Promise<{ error: Error | null }>;
        };
      })
      .update(patch)
      .eq("id", id);

    if (error) {
      console.error(`[dashboard] consultation ${nextStatus} failed:`, error);
      setActingId(null);
      return;
    }
    console.log(`[dashboard] consultation ${nextStatus} success — id:`, id);
    setActingId(null);
    // 목록에서 즉시 제거
    setDbPendingList((prev) => prev?.filter((r) => r.id !== id) ?? null);
    setDbPendingCount((prev) => (prev !== null ? Math.max(0, prev - 1) : null));
    // 수락한 건은 진행 중 영역에 즉시 반영
    if (nextStatus === "accepted" && authUser) {
      fetchActiveConsultations(authUser.id);
    }
  };
  // 뷰 모드: sessionStorage 복원 전까지 null → 깜빡임 없음
  const [viewMode, setViewMode] = useState<"card" | "list" | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.sessionStorage.getItem("dashboardViewMode");
    setViewMode(saved === "list" ? "list" : "card");
  }, []);
  useEffect(() => {
    if (!viewMode) return;
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem("dashboardViewMode", viewMode);
  }, [viewMode]);

  /* 추가 필터 (토글, 복수 선택 가능) */
  const [filterSource, setFilterSource] = useState<"app" | "offline" | null>(null);
  const [filterVisit, setFilterVisit] = useState<"no_visit" | "has_visit" | null>(null);
  const [filterSupplement, setFilterSupplement] = useState<"taking" | "not_taking" | "completed" | null>(null);
  const [filterRelation, setFilterRelation] = useState<"regular" | null>(null);
  const [showRelationTooltip, setShowRelationTooltip] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  /* 날짜 범위 필터 */
  const [dateRange, setDateRange] = useState<DateRangeKey>("all");
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");

  /* AI 검색 */
  const [aiSearchMode, setAiSearchMode] = useState(false);
  const [aiSearchQuery, setAiSearchQuery] = useState("");
  const [aiSearched, setAiSearched] = useState(false);

  /* 환자 데이터 (수락/거절로 변경됨) */
  const [consults, setConsults] = useState<PatientConsult[]>(MOCK_CONSULTS);

  /* 토스트 */
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2200);
  };

  const handleAccept = (id: string) => {
    setConsults((prev) => prev.map((c) => c.id === id ? { ...c, patientStatus: "managing" } : c));
    showToast("✓ 수락됨");
  };

  const handleReject = (id: string, reason: string) => {
    setConsults((prev) => prev.map((c) => c.id === id ? { ...c, isRejected: true, rejectedReason: reason, rejectedAt: TODAY_STR, patientStatus: "inactive" } : c));
    showToast("거절 처리되었습니다");
  };

  /* 공용 거절 사유 선택 모달 (카드뷰/리스트뷰 공통) */
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [rejectModalReason, setRejectModalReason] = useState<"전문 분야 아님" | "상담 여유 없음" | "기타">("전문 분야 아님");
  const [rejectModalCustom, setRejectModalCustom] = useState("");
  const openRejectModal = (id: string) => {
    setRejectTargetId(id);
    setRejectModalReason("전문 분야 아님");
    setRejectModalCustom("");
  };
  const closeRejectModal = () => {
    setRejectTargetId(null);
    setRejectModalCustom("");
  };
  const confirmRejectModal = () => {
    if (!rejectTargetId) return;
    const reason = rejectModalReason === "기타" ? (rejectModalCustom.trim() || "기타") : rejectModalReason;
    handleReject(rejectTargetId, reason);
    closeRejectModal();
  };

  /* 채팅 사이드 패널 */
  const [chatPanelId, setChatPanelId] = useState<string | null>(null);
  const chatPanelPatient = chatPanelId ? consults.find((c) => c.id === chatPanelId) : null;

  /* 창 크기 추적 (채팅 패널 반응형) */
  const [windowWidth, setWindowWidth] = useState(0);
  useEffect(() => {
    const update = () => setWindowWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  /* 스크롤바 자리 확보 (채팅 패널 열고 닫을 때 화면 흔들림 방지) */
  useEffect(() => {
    const html = document.documentElement;
    const prevGutter = html.style.scrollbarGutter;
    const prevOverflow = html.style.overflowY;
    html.style.scrollbarGutter = "stable";
    html.style.overflowY = "scroll";
    return () => {
      html.style.scrollbarGutter = prevGutter;
      html.style.overflowY = prevOverflow;
    };
  }, []);

  const handleOpenChat = (id: string) => {
    if (typeof window !== "undefined" && window.innerWidth >= 1200) {
      // 이미 같은 환자 채팅이 열려있으면 닫기(토글), 다른 환자면 전환
      setChatPanelId((prev) => (prev === id ? null : id));
    } else {
      router.push(`/chat/${id}?role=pharmacist`);
    }
  };

  // 필터 + 검색
  // 새 상담 요청(requested)은 위쪽 영역에서만 표시 — 아래 목록에서 항상 제외
  let result = consults.filter(
    (c) => !(c.patientStatus === "requested" && !c.isRejected),
  );
  if (filter === "managing") {
    result = result.filter((c) => c.patientStatus === "managing");
  } else if (filter === "visit_scheduled") {
    result = result.filter((c) => !!c.nextVisitDate);
  } else if (filter === "unread") {
    result = result.filter((c) => c.unreadCount > 0);
  } else if (filter === "rejected") {
    result = result.filter((c) => !!c.isRejected);
  }
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    result = result.filter(
      (c) =>
        c.patientName.includes(q) ||
        c.symptoms.some((s) => s.label.includes(q)) ||
        (c.purchasedMeds && c.purchasedMeds.some((m) => m.toLowerCase().includes(q))),
    );
  }

  // 날짜 범위 필터
  if (dateRange !== "all") {
    const now = new Date(2026, 3, 10);
    let fromDate: Date | null = null;
    let toDate: Date | null = null;

    if (dateRange === "1w") {
      fromDate = new Date(now);
      fromDate.setDate(fromDate.getDate() - 7);
    } else if (dateRange === "1m") {
      fromDate = new Date(now);
      fromDate.setMonth(fromDate.getMonth() - 1);
    } else if (dateRange === "3m") {
      fromDate = new Date(now);
      fromDate.setMonth(fromDate.getMonth() - 3);
    } else if (dateRange === "custom") {
      if (customDateFrom) fromDate = new Date(customDateFrom);
      if (customDateTo) toDate = new Date(customDateTo);
    }

    result = result.filter((c) => {
      const latest = getLatestDate(c);
      if (fromDate && latest < fromDate) return false;
      if (toDate && latest > toDate) return false;
      return true;
    });
  }

  // 추가 필터: 등록 경로
  if (filterSource) {
    result = result.filter((c) => c.registrationSource === filterSource);
  }
  // 추가 필터: 방문 여부
  if (filterVisit === "no_visit") {
    result = result.filter((c) => !c.visitDate);
  } else if (filterVisit === "has_visit") {
    result = result.filter((c) => !!c.visitDate);
  }
  // 추가 필터: 복용 상태
  if (filterSupplement) {
    result = result.filter((c) => c.supplementStatus === filterSupplement);
  }
  // 추가 필터: 관계 태그
  if (filterRelation === "regular") {
    result = result.filter((c) => getRelationTag(c) === "regular");
  }

  // 정렬 우선순위 (단골 영향 없음):
  //  1) 🔥 답장 필요 (24시간 미답변)
  //  2) 읽지 않은 새 메시지 (unreadCount > 0)
  //  3) 마지막 대화 시간순 (최신이 위)
  result = [...result].sort((a, b) => {
    const urgentA = (needsUrgentReply(a) || needsAcceptUrgent(a)) ? 0 : 1;
    const urgentB = (needsUrgentReply(b) || needsAcceptUrgent(b)) ? 0 : 1;
    if (urgentA !== urgentB) return urgentA - urgentB;

    const unreadA = a.unreadCount > 0 ? 0 : 1;
    const unreadB = b.unreadCount > 0 ? 0 : 1;
    if (unreadA !== unreadB) return unreadA - unreadB;

    if (sortBy === "unread") return b.unreadCount - a.unreadCount;

    // 마지막 대화 시각 desc (최신이 위)
    return sortableLastMsgTs(b) - sortableLastMsgTs(a);
  });

  // 통계
  const totalRequested = consults.filter((c) => c.patientStatus === "requested" && !c.isRejected).length;
  const totalVisitToday = consults.filter((c) => c.nextVisitDate === TODAY_STR).length;
  const totalManaging = consults.filter((c) => c.patientStatus === "managing").length;
  const totalUrgent = consults.filter((c) => needsUrgentReply(c) || needsAcceptUrgent(c)).length;

  const DATE_RANGE_OPTIONS: { key: DateRangeKey; label: string }[] = [
    { key: "all", label: "전체" },
    { key: "1w", label: "1주" },
    { key: "1m", label: "1개월" },
    { key: "3m", label: "3개월" },
    { key: "custom", label: "직접 입력" },
  ];

  return (
    <div className="dash-page" style={{ paddingBottom: 80 }}>
      <style>{`
        @keyframes dashUnreadPulse {
          0%, 100% { background-color: #E02020; }
          50% { background-color: #A01010; }
        }
      `}</style>
      <nav>
        <button className="nav-back" onClick={() => router.back()} aria-label="뒤로가기">
          ←
        </button>
        <div className="nav-title">약사 대시보드</div>
      </nav>

      <div
        className="dash-container"
        style={
          (chatPanelId && windowWidth > 0 && windowWidth < 1500)
            ? { marginLeft: "auto", marginRight: 400, transition: "margin 0.25s ease" }
            : { transition: "margin 0.25s ease" }
        }
      >
        {/* DB 실시간 상담 요청 섹션 */}
        <section
          style={{
            background: "#fff",
            borderRadius: 14,
            border: "1px solid rgba(94,125,108,0.14)",
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "#2C3630",
                fontFamily: "'Gothic A1', sans-serif",
              }}
            >
              🔔 새 상담 요청{" "}
              {dbPendingCount !== null && (
                <span style={{ color: "#B06D00" }}>{dbPendingCount}</span>
              )}
            </div>
          </div>

          {dbPendingLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[0, 1].map((i) => (
                <div
                  key={i}
                  style={{
                    height: 84,
                    borderRadius: 10,
                    background: "linear-gradient(90deg, #F4F6F3 0%, #ECEFEB 50%, #F4F6F3 100%)",
                    backgroundSize: "200% 100%",
                    animation: "dash-skel 1.4s ease-in-out infinite",
                  }}
                />
              ))}
              <style>{`@keyframes dash-skel { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
            </div>
          ) : !dbPendingList || dbPendingList.length === 0 ? (
            <div
              style={{
                padding: "20px 12px",
                textAlign: "center",
                fontSize: 14,
                color: "#3D4A42",
                background: "#F8F9F7",
                borderRadius: 10,
              }}
            >
              새 상담 요청이 없어요
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {dbPendingList.map((r) => {
                const age = r.patient_profile?.birth_year
                  ? new Date().getFullYear() - r.patient_profile.birth_year
                  : null;
                // 안전 정규화 — 배열이 아닌 값(string/null/undefined)이 와도 .slice/.map/.join 보호
                const rawSymptoms: unknown = r.questionnaire?.symptoms;
                const symptoms: string[] = Array.isArray(rawSymptoms)
                  ? (rawSymptoms.filter((x) => typeof x === "string" && x.trim()) as string[])
                  : typeof rawSymptoms === "string" && rawSymptoms.trim()
                    ? [rawSymptoms.trim()]
                    : [];
                const elapsedMs = Date.now() - new Date(r.created_at).getTime();
                const elapsedHr = Math.max(0, Math.floor(elapsedMs / (1000 * 60 * 60)));
                const elapsedMin = Math.max(0, Math.floor(elapsedMs / (1000 * 60)));
                const elapsedLabel =
                  elapsedHr >= 1 ? `${elapsedHr}시간 전` : `${elapsedMin}분 전`;
                const isActing = actingId === r.id;
                const isExpanded = expandedPendingId === r.id;
                const q = r.questionnaire;
                return (
                  <div
                    key={r.id}
                    style={{
                      padding: 14,
                      borderRadius: 12,
                      background: "#FFF8E1",
                      border: "1px solid #F5DCA0",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 8,
                      }}
                    >
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background: "#fff",
                          border: "1px solid #E8D5A0",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 16,
                          flexShrink: 0,
                        }}
                        aria-hidden="true"
                      >
                        👤
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: "#2C3630",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            flexWrap: "wrap",
                          }}
                        >
                          <span>{r.patient?.name?.trim() || "이름 없음"}</span>
                          {age !== null && (
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 500,
                                color: "#3D4A42",
                              }}
                            >
                              {age}세
                              {r.patient_profile?.gender ? ` · ${r.patient_profile.gender}` : ""}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 13, color: "#7A5300", marginTop: 2 }}>
                          {elapsedLabel}
                        </div>
                      </div>
                    </div>
                    {symptoms.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 6,
                          marginBottom: 10,
                        }}
                      >
                        {symptoms.slice(0, 5).map((s) => (
                          <span
                            key={s}
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              padding: "3px 8px",
                              borderRadius: 6,
                              background: "#fff",
                              color: "#7A5300",
                              border: "1px solid #F5DCA0",
                            }}
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                    {q?.free_text && !isExpanded && (
                      <div
                        style={{
                          fontSize: 13,
                          color: "#3D4A42",
                          lineHeight: 1.5,
                          marginBottom: 10,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {q.free_text}
                      </div>
                    )}
                    {/* 상세 보기 토글 (접힘 상태) */}
                    {!isExpanded && (
                      <button
                        type="button"
                        onClick={() => setExpandedPendingId(r.id)}
                        style={{
                          width: "100%",
                          minHeight: 44,
                          padding: "10px 0",
                          borderRadius: 10,
                          background: "#fff",
                          color: "#7A5300",
                          fontSize: 14,
                          fontWeight: 600,
                          border: "1px solid #F5DCA0",
                          cursor: "pointer",
                          fontFamily: "'Noto Sans KR', sans-serif",
                        }}
                      >
                        상세 보기 ▾
                      </button>
                    )}
                    {/* 펼침: 문답 전체 + 수락/거절 */}
                    {isExpanded && (
                      <div
                        style={{
                          marginTop: 4,
                          padding: 14,
                          background: "#fff",
                          borderRadius: 10,
                          border: "1px solid #F0E1B4",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: "#2C3630",
                            marginBottom: 10,
                            fontFamily: "'Gothic A1', sans-serif",
                          }}
                        >
                          문답 전체
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "100px 1fr",
                            rowGap: 8,
                            columnGap: 12,
                            fontSize: 14,
                            color: "#2C3630",
                            lineHeight: 1.5,
                          }}
                        >
                          {(() => {
                            // detailed_answers 폴백 — 컬럼이 비어 있어도 원본 답변에서 추출
                            const da = (q?.detailed_answers ?? {}) as Record<string, unknown>;

                            // 비어 있음 판정: null/undefined/빈 문자열/빈 배열/빈 객체 모두 빈 것으로 처리
                            const isEmpty = (v: unknown): boolean => {
                              if (v === null || v === undefined) return true;
                              if (typeof v === "string") return v.trim().length === 0;
                              if (Array.isArray(v)) return v.length === 0;
                              if (typeof v === "object") {
                                try {
                                  return Object.keys(v as Record<string, unknown>).length === 0;
                                } catch {
                                  return true;
                                }
                              }
                              return false;
                            };
                            // 안전 정규화: 어떤 값이 와도 string 배열로 변환
                            // - 배열이면 string 항목만 추림 (객체/빈 항목은 제외)
                            // - 문자열이면 단일 항목 배열
                            // - 그 외(null/undefined/숫자/객체)는 빈 배열
                            const toStrArr = (v: unknown): string[] => {
                              if (Array.isArray(v)) {
                                return v
                                  .map((x) => {
                                    if (typeof x === "string") return x.trim();
                                    if (typeof x === "number" && Number.isFinite(x)) return String(x);
                                    return "";
                                  })
                                  .filter((s): s is string => s.length > 0);
                              }
                              if (typeof v === "string" && v.trim()) return [v.trim()];
                              return [];
                            };
                            // 안전 정규화: 어떤 값이 와도 string 또는 null
                            // - 문자열이면 그대로 (빈 문자열은 null)
                            // - 배열이면 join (빈 배열은 null)
                            // - 숫자는 String()
                            // - 객체/그 외는 null (JSON 출력 금지 — 사람이 읽을 수 있는 값만)
                            const toStrOrNull = (v: unknown): string | null => {
                              if (isEmpty(v)) return null;
                              if (typeof v === "string") {
                                const t = v.trim();
                                return t ? t : null;
                              }
                              if (Array.isArray(v)) {
                                const arr = toStrArr(v);
                                return arr.length > 0 ? arr.join(", ") : null;
                              }
                              if (typeof v === "number" && Number.isFinite(v)) return String(v);
                              return null;
                            };

                            const daStr = (k: string): string | null => toStrOrNull(da[k]);
                            const daArr = (k: string): string[] => toStrArr(da[k]);

                            // 배열/문자열 어느 쪽이든 안전하게 join — string 또는 string[]
                            // 어느 것이 와도 "—" 폴백까지 일관 처리
                            const fmtList = (value: unknown, fallbackKey?: string): string => {
                              const arr = toStrArr(value);
                              if (arr.length > 0) return arr.join(", ");
                              // 단일 문자열로 들어왔지만 trim 후 비어 있을 수도 있음
                              const single = toStrOrNull(value);
                              if (single) return single;
                              if (fallbackKey) {
                                const fbArr = daArr(fallbackKey);
                                if (fbArr.length > 0) return fbArr.join(", ");
                                const fbStr = daStr(fallbackKey);
                                if (fbStr) return fbStr;
                              }
                              return "—";
                            };
                            const fmtTxt = (value: unknown, fallbackKey?: string): string => {
                              const s = toStrOrNull(value);
                              if (s) return s;
                              if (fallbackKey) {
                                const fb = daStr(fallbackKey);
                                if (fb) return fb;
                              }
                              return "—";
                            };
                            const fmtNum = (
                              value: unknown,
                              suffix: string,
                              fallbackKey?: string,
                            ): string => {
                              if (typeof value === "number" && Number.isFinite(value)) {
                                return `${value}${suffix}`;
                              }
                              if (fallbackKey) {
                                const fb = daStr(fallbackKey);
                                if (fb) return fb; // 라벨 형태는 그대로 표시
                              }
                              return "—";
                            };

                            const rows: { label: string; value: string }[] = [
                              { label: "증상", value: fmtList(q?.symptoms, "symptoms") },
                              { label: "기간", value: fmtTxt(q?.symptom_duration, "duration") },
                              { label: "심각도", value: fmtTxt(q?.severity, "severity") },
                              { label: "직업", value: fmtTxt(q?.occupation, "occupation") },
                              { label: "수면", value: fmtNum(q?.sleep_hours, "시간", "sleep_hours") },
                              { label: "물 섭취", value: fmtNum(q?.water_intake, "잔", "water_amount") },
                              { label: "식사 패턴", value: fmtList(q?.meal_pattern, "meal_pattern") },
                              { label: "간식", value: fmtTxt(q?.snack_frequency, "meal_amount") },
                              { label: "운동 빈도", value: fmtTxt(q?.exercise_frequency, "exercise") },
                              { label: "운동 종류", value: fmtList(q?.exercise_types, "exercise_type") },
                              { label: "음주", value: fmtTxt(q?.alcohol, "alcohol") },
                              { label: "카페인", value: fmtTxt(q?.caffeine, "caffeine") },
                              { label: "흡연", value: fmtTxt(q?.smoking, "smoking") },
                              { label: "복용 영양제", value: fmtList(q?.current_supplements, "supplements") },
                              { label: "복용 약", value: fmtList(q?.current_medications, "current_medications") },
                              { label: "알레르기", value: fmtList(q?.allergies, "allergies") },
                              {
                                label: "예산(월)",
                                value:
                                  typeof q?.monthly_budget === "number" &&
                                  Number.isFinite(q.monthly_budget)
                                    ? `${q.monthly_budget.toLocaleString()}원`
                                    : (daStr("budget") ?? "—"),
                              },
                            ];
                            return rows.map((row) => (
                              <React.Fragment key={row.label}>
                                <div
                                  style={{
                                    color: "#5E7D6C",
                                    fontWeight: 600,
                                    fontSize: 13,
                                  }}
                                >
                                  {row.label}
                                </div>
                                <div
                                  style={{
                                    color: "#2C3630",
                                    wordBreak: "break-word",
                                    overflowWrap: "anywhere",
                                    minWidth: 0,
                                  }}
                                >
                                  {row.value}
                                </div>
                              </React.Fragment>
                            ));
                          })()}
                        </div>
                        {q?.free_text && q.free_text.trim() && (
                          <div style={{ marginTop: 12 }}>
                            <div
                              style={{
                                color: "#5E7D6C",
                                fontWeight: 600,
                                fontSize: 13,
                                marginBottom: 4,
                              }}
                            >
                              자유 서술
                            </div>
                            <div
                              style={{
                                fontSize: 14,
                                color: "#2C3630",
                                lineHeight: 1.6,
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                                overflowWrap: "anywhere",
                                width: "100%",
                                maxWidth: "100%",
                                background: "#FBF7E9",
                                padding: 10,
                                borderRadius: 8,
                                border: "1px solid #F0E1B4",
                                boxSizing: "border-box",
                              }}
                            >
                              {q.free_text}
                            </div>
                          </div>
                        )}
                        {/* 수락/거절 버튼 (상세 안에 배치) */}
                        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                          <button
                            type="button"
                            onClick={() => setExpandedPendingId(null)}
                            disabled={isActing}
                            style={{
                              flex: "0 0 auto",
                              minHeight: 44,
                              padding: "10px 14px",
                              borderRadius: 10,
                              background: "#fff",
                              color: "#5E7D6C",
                              fontSize: 14,
                              fontWeight: 600,
                              border: "1px solid #D5DCD7",
                              cursor: isActing ? "default" : "pointer",
                              opacity: isActing ? 0.6 : 1,
                            }}
                          >
                            접기
                          </button>
                          <button
                            type="button"
                            onClick={() => updatePendingStatus(r.id, "rejected")}
                            disabled={isActing}
                            style={{
                              flex: 1,
                              minHeight: 44,
                              padding: "10px 0",
                              borderRadius: 10,
                              background: "#fff",
                              color: "#993C1D",
                              fontSize: 14,
                              fontWeight: 600,
                              border: "1px solid #E8C9BD",
                              cursor: isActing ? "default" : "pointer",
                              opacity: isActing ? 0.6 : 1,
                            }}
                          >
                            거절
                          </button>
                          <button
                            type="button"
                            onClick={() => updatePendingStatus(r.id, "accepted")}
                            disabled={isActing}
                            style={{
                              flex: 1,
                              minHeight: 44,
                              padding: "10px 0",
                              borderRadius: 10,
                              background: "#4A6355",
                              color: "#fff",
                              fontSize: 14,
                              fontWeight: 700,
                              border: "none",
                              cursor: isActing ? "default" : "pointer",
                              opacity: isActing ? 0.7 : 1,
                            }}
                          >
                            {isActing ? "처리 중..." : "수락"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 진행 중 상담 (DB) */}
        <section
          style={{
            background: "#fff",
            borderRadius: 14,
            border: "1px solid rgba(94,125,108,0.14)",
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#2C3630",
              fontFamily: "'Gothic A1', sans-serif",
              marginBottom: 12,
            }}
          >
            💬 진행 중 상담{" "}
            {dbActiveList !== null && (
              <span style={{ color: "#4A6355" }}>{dbActiveList.length}</span>
            )}
          </div>

          {dbActiveLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[0, 1].map((i) => (
                <div
                  key={i}
                  style={{
                    height: 72,
                    borderRadius: 10,
                    background:
                      "linear-gradient(90deg, #F4F6F3 0%, #ECEFEB 50%, #F4F6F3 100%)",
                    backgroundSize: "200% 100%",
                    animation: "dash-skel 1.4s ease-in-out infinite",
                  }}
                />
              ))}
            </div>
          ) : !dbActiveList || dbActiveList.length === 0 ? (
            <div
              style={{
                padding: "20px 12px",
                textAlign: "center",
                fontSize: 14,
                color: "#3D4A42",
                background: "#F8F9F7",
                borderRadius: 10,
              }}
            >
              진행 중인 상담이 없어요
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {dbActiveList.map((r) => {
                const age = r.patient_profile?.birth_year
                  ? new Date().getFullYear() - r.patient_profile.birth_year
                  : null;
                // 안전 정규화 — 배열이 아닌 값(string/null/undefined)이 와도 .slice/.map/.join 보호
                const rawSymptoms: unknown = r.questionnaire?.symptoms;
                const symptoms: string[] = Array.isArray(rawSymptoms)
                  ? (rawSymptoms.filter((x) => typeof x === "string" && x.trim()) as string[])
                  : typeof rawSymptoms === "string" && rawSymptoms.trim()
                    ? [rawSymptoms.trim()]
                    : [];
                const lastIso = r.last_message_at ?? r.created_at;
                const elapsedMs = Date.now() - new Date(lastIso).getTime();
                const elapsedHr = Math.max(0, Math.floor(elapsedMs / (1000 * 60 * 60)));
                const elapsedMin = Math.max(0, Math.floor(elapsedMs / (1000 * 60)));
                const elapsedLabel =
                  elapsedHr >= 24
                    ? `${Math.floor(elapsedHr / 24)}일 전`
                    : elapsedHr >= 1
                      ? `${elapsedHr}시간 전`
                      : `${elapsedMin}분 전`;
                const statusLabel =
                  r.status === "chatting"
                    ? "상담 중"
                    : r.status === "visit_scheduled"
                      ? "방문 예정"
                      : "수락됨";
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => router.push(`/chat/${r.id}?role=pharmacist`)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: 14,
                      borderRadius: 12,
                      background: "#EDF4F0",
                      border: "1px solid rgba(74,99,85,0.18)",
                      cursor: "pointer",
                      textAlign: "left",
                      width: "100%",
                      fontFamily: "'Noto Sans KR', sans-serif",
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        background: "#fff",
                        border: "1px solid #B3CCBE",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 16,
                        flexShrink: 0,
                      }}
                      aria-hidden="true"
                    >
                      👤
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: "#2C3630",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          flexWrap: "wrap",
                        }}
                      >
                        <span>{r.patient?.name?.trim() || "이름 없음"}</span>
                        {age !== null && (
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 500,
                              color: "#3D4A42",
                            }}
                          >
                            {age}세
                            {r.patient_profile?.gender ? ` · ${r.patient_profile.gender}` : ""}
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            padding: "2px 8px",
                            borderRadius: 6,
                            background: "#fff",
                            color: "#4A6355",
                            border: "1px solid #B3CCBE",
                          }}
                        >
                          {statusLabel}
                        </span>
                      </div>
                      {symptoms.length > 0 && (
                        <div
                          style={{
                            fontSize: 13,
                            color: "#3D4A42",
                            marginTop: 4,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {symptoms.slice(0, 3).join(" · ")}
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#5E7D6C",
                        flexShrink: 0,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {elapsedLabel}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* 환자 직접 등록 버튼 */}
        <button
          type="button"
          onClick={() => router.push("/chart/new")}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            width: "100%", padding: "12px 0", borderRadius: 12,
            fontSize: 15, fontWeight: 700,
            background: "#E8F0F5", color: "#5A8BA8",
            border: "1.5px dashed #B3D1E0", cursor: "pointer",
            marginBottom: 16,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5A8BA8" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          환자 직접 등록
        </button>

        {/* 요약 카드 */}
        <div className="dash-stats-row">
          <div className="dash-stat-card">
            <div style={{ display: "inline-flex", alignItems: "baseline", gap: 8, justifyContent: "center" }}>
              <span className="dash-stat-num" style={{ color: "#B06D00" }}>🔔 {dbPendingCount ?? totalRequested}</span>
              {totalUrgent > 0 && (
                <span
                  title="24시간 이상 미답변 환자"
                  style={{
                    fontSize: 13, fontWeight: 700,
                    color: "#E05A1A", background: "#FFF0E6",
                    padding: "2px 8px", borderRadius: 8,
                    whiteSpace: "nowrap",
                  }}
                >🔥 {totalUrgent}</span>
              )}
            </div>
            <div className="dash-stat-label" style={{ fontSize: 13 }}>새 상담 요청</div>
          </div>
          <div className="dash-stat-card">
            <div className="dash-stat-num" style={{ color: "#5A8BA8" }}>🗓️ {totalVisitToday}</div>
            <div className="dash-stat-label" style={{ fontSize: 13 }}>오늘 방문 예정</div>
          </div>
          <div className="dash-stat-card">
            <div className="dash-stat-num" style={{ color: "var(--sage-deep)" }}>💊 {totalManaging}</div>
            <div className="dash-stat-label" style={{ fontSize: 13 }}>사후 관리 중</div>
          </div>
        </div>

        {/* 검색 모드 토글 */}
        <div style={{ display: "flex", gap: 0, marginBottom: 8 }}>
          <button
            type="button"
            onClick={() => { setAiSearchMode(false); setAiSearched(false); setAiSearchQuery(""); }}
            style={{
              padding: "6px 16px", fontSize: 14, fontWeight: 600,
              borderRadius: "8px 0 0 8px",
              background: !aiSearchMode ? "var(--sage-deep, #4A6355)" : "#fff",
              color: !aiSearchMode ? "#fff" : "var(--text-mid, #3D4A42)",
              border: !aiSearchMode ? "1.5px solid var(--sage-deep, #4A6355)" : "1px solid var(--border, rgba(94,125,108,0.14))",
              cursor: "pointer", transition: "all 0.15s",
            }}
          >일반 검색</button>
          <button
            type="button"
            onClick={() => { setAiSearchMode(true); setSearch(""); }}
            style={{
              padding: "6px 16px", fontSize: 14, fontWeight: 600,
              borderRadius: "0 8px 8px 0",
              background: aiSearchMode ? "var(--sage-deep, #4A6355)" : "#fff",
              color: aiSearchMode ? "#fff" : "var(--text-mid, #3D4A42)",
              border: aiSearchMode ? "1.5px solid var(--sage-deep, #4A6355)" : "1px solid var(--border, rgba(94,125,108,0.14))",
              borderLeft: aiSearchMode ? "1.5px solid var(--sage-deep, #4A6355)" : "none",
              cursor: "pointer", transition: "all 0.15s",
            }}
          ><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><svg width="16" height="16" viewBox="0 0 24 24" fill={aiSearchMode ? "#fff" : "var(--sage-deep, #4A6355)"} xmlns="http://www.w3.org/2000/svg"><path d="M12 0 L14.5 9.5 L24 12 L14.5 14.5 L12 24 L9.5 14.5 L0 12 L9.5 9.5 Z"/></svg>AI 검색</span></button>
        </div>

        {/* 검색 입력 */}
        <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
          <div style={{ flex: 1, position: "relative" }}>
            {aiSearchMode ? (
              <input
                type="text"
                className="dash-search-input"
                style={{ width: "100%" }}
                placeholder="자연어로 검색 (예: 3주 전 50대 여자 마그네슘)"
                value={aiSearchQuery}
                onChange={(e) => { setAiSearchQuery(e.target.value); setAiSearched(false); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && aiSearchQuery.trim()) setAiSearched(true);
                }}
              />
            ) : (
              <input
                type="text"
                className="dash-search-input"
                style={{ width: "100%" }}
                placeholder="환자명, 증상, 구매한 약으로 검색"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              if (aiSearchMode && aiSearchQuery.trim()) setAiSearched(true);
            }}
            style={{
              padding: "0 16px", borderRadius: 12, fontSize: 14, fontWeight: 700,
              background: "var(--sage-deep, #4A6355)", color: "#fff",
              border: "1.5px solid var(--sage-deep, #4A6355)",
              cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
              display: "flex", alignItems: "center", gap: 4,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            검색
          </button>
        </div>

        {/* AI 검색 결과 안내 */}
        {aiSearchMode && aiSearched && (
          <div style={{
            margin: "10px 0 0", padding: "12px 16px", borderRadius: 12,
            background: "var(--sage-pale)", border: "1px solid var(--sage-light)",
            fontSize: 14, color: "var(--sage-deep)", fontWeight: 500,
            textAlign: "center", lineHeight: 1.6,
          }}>
            AI 검색은 백엔드 연결 후 사용 가능합니다.
          </div>
        )}

        {/* 날짜 범위 필터 */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
          marginTop: 12,
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-mid)", marginRight: 2 }}>기간</span>
          {DATE_RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setDateRange(opt.key)}
              style={{
                padding: "4px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: dateRange === opt.key ? "var(--sage-deep)" : "var(--sage-bg, #F8F9F7)",
                color: dateRange === opt.key ? "#fff" : "var(--text-mid)",
                border: dateRange === opt.key ? "1.5px solid var(--sage-deep)" : "1px solid var(--border, rgba(94,125,108,0.14))",
                cursor: "pointer", transition: "all 0.15s",
              }}
            >{opt.label}</button>
          ))}
        </div>

        {/* 직접 입력 날짜 선택 */}
        {dateRange === "custom" && (
          <div style={{
            display: "flex", gap: 8, alignItems: "center", marginTop: 8,
            flexWrap: "wrap",
          }}>
            <input
              type="date"
              value={customDateFrom}
              onChange={(e) => setCustomDateFrom(e.target.value)}
              style={{
                padding: "6px 10px", borderRadius: 8, fontSize: 13,
                border: "1.5px solid var(--sage-light)", color: "var(--text-dark)",
                outline: "none", fontFamily: "'Noto Sans KR', sans-serif",
              }}
            />
            <span style={{ fontSize: 13, color: "var(--text-mid)" }}>~</span>
            <input
              type="date"
              value={customDateTo}
              onChange={(e) => setCustomDateTo(e.target.value)}
              style={{
                padding: "6px 10px", borderRadius: 8, fontSize: 13,
                border: "1.5px solid var(--sage-light)", color: "var(--text-dark)",
                outline: "none", fontFamily: "'Noto Sans KR', sans-serif",
              }}
            />
          </div>
        )}

        {/* 필터 + 정렬 */}
        <div className="dash-filter-row">
          <div className="dash-filters">
            {([
              ["all", "전체"],
              ["managing", "💊 사후 관리"],
              ["visit_scheduled", "🗓️ 방문 예정"],
              ["unread", "💬 새 메시지"],
              ["rejected", "❌ 거절 이력"],
            ] as [FilterKey, string][]).map(([key, label]) => (
              <button
                key={key}
                className={`dash-filter-tab${filter === key ? " active" : ""}`}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <select
            className="dash-sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
          >
            <option value="recent">최신순</option>
            <option value="unread">안 읽은 메시지순</option>
          </select>
        </div>

        {/* 추가 필터: 등록 경로 · 방문 · 복용 상태 */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {/* 등록 경로 */}
          {([
            { key: "app" as const, label: "📱 약사톡", bg: "#E6F1FB", color: "#185FA5", borderColor: "#B8D4F0" },
            { key: "offline" as const, label: "🏥 워크인", bg: "#FAEEDA", color: "#854F0B", borderColor: "#E8D5B8" },
          ]).map((opt) => {
            const active = filterSource === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setFilterSource(active ? null : opt.key)}
                style={{
                  padding: "4px 10px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: active ? opt.bg : "#F8F9F7",
                  color: active ? opt.color : "var(--text-mid, #3D4A42)",
                  border: active ? `1.5px solid ${opt.color}` : "1px solid var(--border, rgba(94,125,108,0.14))",
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >{opt.label}</button>
            );
          })}
          <span style={{ width: 1, height: 20, background: "var(--border, rgba(94,125,108,0.14))", alignSelf: "center", flexShrink: 0 }} />
          {/* 방문 여부 */}
          {([
            { key: "no_visit" as const, label: "방문 전" },
            { key: "has_visit" as const, label: "방문일자 있음" },
          ]).map((opt) => {
            const active = filterVisit === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setFilterVisit(active ? null : opt.key)}
                style={{
                  padding: "4px 10px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: active ? "var(--sage-pale, #EDF4F0)" : "#F8F9F7",
                  color: active ? "var(--sage-deep, #4A6355)" : "var(--text-mid, #3D4A42)",
                  border: active ? "1.5px solid var(--sage-deep, #4A6355)" : "1px solid var(--border, rgba(94,125,108,0.14))",
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >{opt.label}</button>
            );
          })}
          <span style={{ width: 1, height: 20, background: "var(--border, rgba(94,125,108,0.14))", alignSelf: "center", flexShrink: 0 }} />
          {/* 복용 상태 */}
          {([
            { key: "taking" as const, label: "복용 중", bg: "#EAF3DE", color: "#3B6D11", borderColor: "#C0D9A8" },
            { key: "not_taking" as const, label: "미복용", bg: "#F0F0F0", color: "#666666", borderColor: "#CCCCCC" },
            { key: "completed" as const, label: "복용 완료", bg: "#F0F0F0", color: "#666666", borderColor: "#CCCCCC" },
          ]).map((opt) => {
            const active = filterSupplement === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setFilterSupplement(active ? null : opt.key)}
                style={{
                  padding: "4px 10px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: active ? opt.bg : "#F8F9F7",
                  color: active ? opt.color : "var(--text-mid, #3D4A42)",
                  border: active ? `1.5px solid ${opt.color}` : "1px solid var(--border, rgba(94,125,108,0.14))",
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >{opt.label}</button>
            );
          })}
          <span style={{ width: 1, height: 20, background: "var(--border, rgba(94,125,108,0.14))", alignSelf: "center", flexShrink: 0 }} />
          {/* 관계 태그 필터 */}
          {(() => {
            const active = filterRelation === "regular";
            return (
              <button
                type="button"
                onClick={() => setFilterRelation(active ? null : "regular")}
                style={{
                  padding: "4px 10px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: active ? "#FAECE7" : "#F8F9F7",
                  color: active ? "#C06B45" : "var(--text-mid, #3D4A42)",
                  border: active ? "1.5px solid #C06B45" : "1px solid var(--border, rgba(94,125,108,0.14))",
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >💚 단골</button>
            );
          })()}
          {/* 단골 설명 ⓘ */}
          <div style={{ position: "relative", display: "inline-flex", alignSelf: "center" }}>
            <button
              type="button"
              onClick={() => setShowRelationTooltip(!showRelationTooltip)}
              onMouseEnter={() => setShowRelationTooltip(true)}
              onMouseLeave={() => setShowRelationTooltip(false)}
              aria-label="단골 태그 설명"
              style={{
                width: 22, height: 22, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "var(--sage-pale, #EDF4F0)", border: "1px solid var(--sage-light, #B3CCBE)",
                cursor: "pointer", fontSize: 12, fontWeight: 700, color: "var(--sage-deep, #4A6355)",
                padding: 0, lineHeight: 1,
              }}
            >
              i
            </button>
            {showRelationTooltip && (
              <div style={{
                position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)",
                width: 200, padding: "10px 14px", borderRadius: 12,
                background: "#fff", border: "1px solid var(--sage-light, #B3CCBE)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                fontSize: 13, lineHeight: 1.7, color: "var(--text-mid, #3D4A42)",
                zIndex: 50,
              }}>
                <div>💚 <b>단골</b>: 영양제 구매 이력 있음</div>
                <div style={{
                  position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%) rotate(45deg)",
                  width: 10, height: 10, background: "#fff",
                  borderRight: "1px solid var(--sage-light, #B3CCBE)",
                  borderBottom: "1px solid var(--sage-light, #B3CCBE)",
                }} />
              </div>
            )}
          </div>
        </div>

        {/* 뷰 토글 */}
        <div style={{ display: "flex", gap: 0, marginTop: 12 }}>
          <button
            type="button"
            onClick={() => setViewMode("card")}
            aria-label="카드 뷰"
            style={{
              width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: "8px 0 0 8px",
              background: viewMode === "card" ? "var(--sage-deep, #4A6355)" : "#fff",
              border: "1.5px solid var(--sage-deep, #4A6355)",
              cursor: "pointer", transition: "all 0.15s",
            }}
          >
            {/* 2x2 그리드 아이콘 */}
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect x="1" y="1" width="6.5" height="6.5" rx="1.5" stroke={viewMode === "card" ? "#fff" : "#4A6355"} strokeWidth="1.8" />
              <rect x="10.5" y="1" width="6.5" height="6.5" rx="1.5" stroke={viewMode === "card" ? "#fff" : "#4A6355"} strokeWidth="1.8" />
              <rect x="1" y="10.5" width="6.5" height="6.5" rx="1.5" stroke={viewMode === "card" ? "#fff" : "#4A6355"} strokeWidth="1.8" />
              <rect x="10.5" y="10.5" width="6.5" height="6.5" rx="1.5" stroke={viewMode === "card" ? "#fff" : "#4A6355"} strokeWidth="1.8" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            aria-label="리스트 뷰"
            style={{
              width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: "0 8px 8px 0",
              background: viewMode === "list" ? "var(--sage-deep, #4A6355)" : "#fff",
              border: "1.5px solid var(--sage-deep, #4A6355)",
              borderLeft: "none",
              cursor: "pointer", transition: "all 0.15s",
            }}
          >
            {/* 가로 3줄 아이콘 */}
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <line x1="1" y1="4" x2="17" y2="4" stroke={viewMode === "list" ? "#fff" : "#4A6355"} strokeWidth="2" strokeLinecap="round" />
              <line x1="1" y1="9" x2="17" y2="9" stroke={viewMode === "list" ? "#fff" : "#4A6355"} strokeWidth="2" strokeLinecap="round" />
              <line x1="1" y1="14" x2="17" y2="14" stroke={viewMode === "list" ? "#fff" : "#4A6355"} strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* 환자 목록 */}
        {showEmptyState ? (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", padding: "48px 20px", textAlign: "center",
          }}>
            <div style={{ fontSize: 48, marginBottom: 12, lineHeight: 1 }}>📋</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-dark)", marginBottom: 6 }}>아직 배정된 상담이 없어요</div>
            <div style={{ fontSize: 14, color: "var(--text-mid)", lineHeight: 1.6, marginBottom: 20 }}>개선 사례를 올리면 환자가 먼저 찾아와요</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
              <button type="button" onClick={() => router.push("/feed/new")} style={{
                padding: "11px 24px", borderRadius: 12, fontSize: 14, fontWeight: 700,
                background: "var(--sage-deep)", color: "#fff", border: "none", cursor: "pointer",
              }}>개선 사례 올리기</button>
              <button type="button" onClick={() => router.push("/feed/recommend")} style={{
                padding: "11px 24px", borderRadius: 12, fontSize: 14, fontWeight: 700,
                background: "#fff", color: "var(--sage-deep)", border: "1.5px solid var(--sage-light)", cursor: "pointer",
              }}>약사의 이야기 올리기</button>
            </div>
          </div>
        ) : result.length === 0 ? (
          <div className="dash-empty">
            {search ? "검색 결과가 없습니다." : "해당 조건의 상담이 없습니다."}
          </div>
        ) : viewMode === null ? (
          /* sessionStorage 복원 전까지 렌더 보류 (깜빡임 방지) */
          <div aria-hidden="true" style={{ minHeight: 240 }} />
        ) : (
          viewMode === "card" ? (
          <div className="dash-list">
            {result.map((c) => (
              <div key={c.id}>
                <PatientCard
                  data={c}
                  expanded={expandedId === c.id}
                  onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
                  onOpenChat={handleOpenChat}
                  chatOpen={chatPanelId !== null}
                  onAccept={handleAccept}
                  onReject={openRejectModal}
                />
              </div>
            ))}
          </div>
          ) : (
          /* 리스트 뷰 — 테이블 */
          <div style={{ borderRadius: 12, border: "1px solid var(--border, rgba(94,125,108,0.14))", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, tableLayout: "fixed" }}>
              <thead>
                <tr style={{ background: "var(--sage-pale, #EDF4F0)" }}>
                  <th style={{ minWidth: 70, padding: "10px 12px", textAlign: "left", fontWeight: 700, color: "var(--text-dark, #2C3630)", fontSize: 13, whiteSpace: "nowrap" }}>이름</th>
                  <th style={{ width: 45, padding: "10px 6px", textAlign: "left", fontWeight: 700, color: "var(--text-dark, #2C3630)", fontSize: 13, whiteSpace: "nowrap" }}>나이</th>
                  <th className="dash-list-gender-col" style={{ width: 35, padding: "10px 4px", textAlign: "left", fontWeight: 700, color: "var(--text-dark, #2C3630)", fontSize: 13, whiteSpace: "nowrap" }}>성별</th>
                  <th style={{ width: 80, padding: "10px 6px", textAlign: "left", fontWeight: 700, color: "var(--text-dark, #2C3630)", fontSize: 13, whiteSpace: "nowrap" }}>상태</th>
                  <th className="dash-list-visit-col" style={{ width: 80, minWidth: 65, padding: "10px 6px", textAlign: "left", fontWeight: 700, color: "var(--text-dark, #2C3630)", fontSize: 13, whiteSpace: "nowrap" }}>방문</th>
                  <th className="dash-list-action-col" style={{ width: 70, minWidth: 70, padding: "10px 6px", textAlign: "left", fontWeight: 700, color: "var(--text-dark, #2C3630)", fontSize: 13, whiteSpace: "nowrap" }}>액션</th>
                </tr>
              </thead>
              <tbody>
                {result.map((c) => {
                  const stCfg = PATIENT_STATUS_CONFIG[c.patientStatus];
                  const showSt = c.patientStatus !== "inactive" && !c.isRejected;
                  const rTag = getRelationTag(c);
                  const isOver = rTag === "over";
                  const listAge = CURRENT_YEAR - c.birthYear;
                  const visitLabel = c.nextVisitDate
                    ? `예약 ${c.nextVisitDate.slice(5).replace(".", "/")}`
                    : "방문전";
                  const visitTitle = c.nextVisitDate
                    ? `방문 예정 ${c.nextVisitDate.slice(5).replace(".", "/")}`
                    : c.visitDate
                      ? `최근 방문 ${c.visitDate.slice(5).replace(".", "/")}`
                      : "방문 이력 없음";
                  const isReqRow = c.patientStatus === "requested" && !c.isRejected;
                  const rowHours = hoursOfLastPatientMsg(c);
                  const actionBtnStyle: React.CSSProperties = {
                    width: 28, height: 24, padding: 0, borderRadius: 6,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700, cursor: "pointer", lineHeight: 1,
                  };
                  return (
                    <tr
                      key={c.id}
                      onClick={() => router.push(`/chart/${c.id}`)}
                      style={{ cursor: "pointer", borderBottom: "1px solid var(--border, rgba(94,125,108,0.14))", transition: "background 0.15s", background: isOver ? "#FAFAFA" : "transparent" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--sage-pale, #EDF4F0)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = isOver ? "#FAFAFA" : "transparent"; }}
                    >
                      <td
                        style={{
                          minWidth: 70,
                          padding: "12px", fontWeight: 700,
                          color: "#2C3630",
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        }}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", minWidth: 0 }}>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{c.patientName}</span>
                          {rTag === "regular" && <span aria-hidden="true" style={{ marginLeft: 4, flexShrink: 0 }}>💚</span>}
                          {c.unreadCount > 0 && (
                            <span
                              className="dash-unread-badge"
                              style={{ flexShrink: 0, marginLeft: 6, ...getUnreadBadgeStyle(rowHours) }}
                            >
                              {c.unreadCount}
                            </span>
                          )}
                        </span>
                      </td>
                      <td style={{ padding: "12px 6px", color: "var(--text-mid, #3D4A42)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{listAge}세</td>
                      <td className="dash-list-gender-col" style={{ padding: "12px 4px", color: "var(--text-mid, #3D4A42)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.patientGender}</td>
                      <td style={{ padding: "12px 6px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                          {c.isRejected ? (
                            <span
                              title="거절됨"
                              style={{
                                display: "inline-flex", alignItems: "center", justifyContent: "center",
                                padding: "3px 8px", borderRadius: 8,
                                fontSize: 14, background: "#FFE5E5",
                              }}
                            >❌</span>
                          ) : showSt ? (
                            <span
                              title={stCfg.label}
                              style={{
                                display: "inline-flex", alignItems: "center", justifyContent: "center",
                                padding: "3px 8px", borderRadius: 8,
                                fontSize: 14, background: stCfg.bg,
                              }}
                            >{stCfg.emoji}</span>
                          ) : (
                            <span style={{ fontSize: 13, color: "var(--text-mid, #3D4A42)" }}>-</span>
                          )}
                          {(c.previousRejections?.length ?? 0) > 0 && (
                            <span
                              title={`이전 거절 이력 ${c.previousRejections!.length}건`}
                              style={{
                                display: "inline-flex", alignItems: "center", justifyContent: "center",
                                padding: "3px 6px", borderRadius: 8,
                                fontSize: 13, fontWeight: 600,
                                background: "#FFF8E1", color: "#B06D00",
                              }}
                            >⚠️</span>
                          )}
                        </span>
                      </td>
                      <td className="dash-list-visit-col" title={visitTitle} style={{ padding: "12px 6px", color: "var(--text-mid, #3D4A42)", whiteSpace: "nowrap", fontSize: 14, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {visitLabel}
                      </td>
                      <td className="dash-list-action-col" style={{ padding: "12px 6px", whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                        {c.isRejected ? (
                          <span style={{ fontSize: 12, color: "var(--text-mid, #3D4A42)" }}>-</span>
                        ) : isReqRow ? (
                          <span style={{ display: "inline-flex", gap: 4, flexShrink: 0 }}>
                            <button
                              type="button"
                              title="수락"
                              aria-label="수락"
                              onClick={(e) => { e.stopPropagation(); handleAccept(c.id); }}
                              style={{
                                ...actionBtnStyle,
                                flexShrink: 0,
                                background: "var(--sage-deep, #4A6355)", color: "#fff",
                                border: "none",
                              }}
                            >✓</button>
                            <button
                              type="button"
                              title="거절"
                              aria-label="거절"
                              onClick={(e) => { e.stopPropagation(); openRejectModal(c.id); }}
                              style={{
                                ...actionBtnStyle,
                                flexShrink: 0,
                                background: "#fff", color: "#D32F2F",
                                border: "1.5px solid #D32F2F",
                              }}
                            >✕</button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            title="채팅창 열기"
                            aria-label="채팅창 열기"
                            onClick={(e) => { e.stopPropagation(); handleOpenChat(c.id); }}
                            style={{
                              ...actionBtnStyle,
                              background: "var(--sage-pale, #EDF4F0)", color: "var(--sage-deep, #4A6355)",
                              border: "1px solid var(--sage-light, #B3CCBE)",
                            }}
                          >💬</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* 모바일 컬럼 조정 */}
            <style>{`
              @media (max-width: 600px) {
                .dash-list-gender-col { display: none !important; }
              }
            `}</style>
          </div>
          )
        )}
      </div>

      {/* 채팅 사이드 패널 (데스크톱 1200px+) */}
      {chatPanelPatient && (
        <ChatSidePanel
          key={chatPanelPatient.id}
          patient={chatPanelPatient}
          onClose={() => setChatPanelId(null)}
        />
      )}

      {/* 토스트 */}
      {/* 공용 거절 사유 선택 모달 (카드뷰/리스트뷰 공통) */}
      {rejectTargetId && (
        <div
          onClick={closeRejectModal}
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: 14, padding: 22,
              maxWidth: 340, width: "92%",
              boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-dark, #2C3630)", marginBottom: 6 }}>정말 거절하시겠어요?</div>
            <div style={{ fontSize: 14, color: "var(--text-mid, #3D4A42)", marginBottom: 14, lineHeight: 1.5 }}>
              거절 사유를 선택해 주세요 (선택 사항)
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
              {(["전문 분야 아님", "상담 여유 없음", "기타"] as const).map((r) => (
                <label key={r} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 12px", borderRadius: 8,
                  background: rejectModalReason === r ? "var(--sage-pale, #EDF4F0)" : "#F8F9F7",
                  border: rejectModalReason === r ? "1.5px solid var(--sage-deep, #4A6355)" : "1px solid var(--border, rgba(94,125,108,0.14))",
                  cursor: "pointer", fontSize: 14, color: "var(--text-dark, #2C3630)",
                }}>
                  <input
                    type="radio"
                    name="reject-reason-shared"
                    checked={rejectModalReason === r}
                    onChange={() => setRejectModalReason(r)}
                    style={{ margin: 0 }}
                  />
                  {r}
                </label>
              ))}
            </div>
            {rejectModalReason === "기타" && (
              <input
                type="text"
                value={rejectModalCustom}
                onChange={(e) => setRejectModalCustom(e.target.value)}
                placeholder="사유를 입력해 주세요"
                style={{
                  width: "100%", padding: "8px 10px", borderRadius: 8,
                  border: "1.5px solid var(--sage-light, #B3CCBE)",
                  fontSize: 14, color: "var(--text-dark)", outline: "none",
                  marginBottom: 12, fontFamily: "'Noto Sans KR', sans-serif",
                  boxSizing: "border-box",
                }}
              />
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={closeRejectModal}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 8,
                  fontSize: 14, fontWeight: 600,
                  background: "#F8F9F7", color: "var(--text-mid, #3D4A42)",
                  border: "1px solid var(--border, rgba(94,125,108,0.14))",
                  cursor: "pointer",
                }}
              >취소</button>
              <button
                type="button"
                onClick={confirmRejectModal}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 8,
                  fontSize: 14, fontWeight: 700,
                  background: "#D32F2F", color: "#fff",
                  border: "none", cursor: "pointer",
                }}
              >거절하기</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          style={{
            position: "fixed", left: "50%", bottom: 40,
            transform: "translateX(-50%)",
            background: "rgba(50,55,52,0.95)", color: "#fff",
            padding: "12px 22px", borderRadius: 24,
            fontSize: 14, fontWeight: 600,
            boxShadow: "0 6px 24px rgba(0,0,0,0.18)",
            zIndex: 500, whiteSpace: "nowrap",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

export default function DashboardClient() {
  return (
    <Suspense>
      <DashboardContent />
    </Suspense>
  );
}
