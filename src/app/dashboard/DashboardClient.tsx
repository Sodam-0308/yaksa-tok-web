"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import {
  type PatientConsult,
  PATIENT_STATUS_CONFIG,
  SYMPTOM_TAG_CLASS,
  fetchAllConsultations,
  getRelationTag,
  getUnreadBadgeStyle,
  hoursOfLastPatientMsg,
  needsUrgentReply,
  needsAcceptUrgent,
  upsertChartMemo,
} from "@/lib/pharmacistConsults";
import {
  type FilterKey,
  type SortKey,
  applyFilters,
  sortConsults,
} from "@/lib/dashboardFilters";
import { usePharmacistGuard } from "@/lib/usePharmacistGuard";

interface ChatMsg {
  id: string;
  sender: string;
  text: string;
  time: string;
}

/* ── 상태 뱃지 (아이콘만 + 툴팁) ── */
/** 카드 헤더의 상태 알약(이모지 + 호버 시 툴팁).
 *  툴팁은 브라우저 기본 title 하나만 — 커스텀 말풍선이 title 과 겹쳐 보이던 문제 회피. */
function StatusBadge({
  emoji, tooltip, bg, borderColor,
}: {
  emoji: string; tooltip: string; bg: string; borderColor?: string;
}) {
  return (
    <span
      title={tooltip}
      style={{
        display: "inline-flex",
        alignItems: "center", justifyContent: "center",
        width: 28, height: 28, borderRadius: 14,
        background: bg, border: borderColor ? `1px solid ${borderColor}` : "none",
        fontSize: 16, lineHeight: 1, flexShrink: 0, cursor: "default",
      }}
    >
      {emoji}
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
// 디자인 참조용 mock 데이터 — fetchAllConsultations 도입 후 라이브 소스로는 쓰지 않음.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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


/* ── 환자 카드 컴포넌트 ── */
function PatientCard({
  data,
  expanded,
  onToggle,
  onOpenChat,
  chatOpen,
  onAccept,
  onReject,
  onMemoSaved,
}: {
  data: PatientConsult;
  expanded: boolean;
  onToggle: () => void;
  onOpenChat: (id: string) => void;
  chatOpen: boolean;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onMemoSaved: (memo: string) => void;
}) {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const statusCfg = PATIENT_STATUS_CONFIG[data.patientStatus];
  const relationTag = getRelationTag(data);
  const isOverConsult = relationTag === "over";
  const age = new Date().getFullYear() - data.birthYear;
  const isRequested = data.patientStatus === "requested" && !data.isRejected;
  const isUrgent = needsUrgentReply(data);         // managing + 24h (답장 필요)
  const isAcceptUrgent = needsAcceptUrgent(data);  // requested + 24h (수락 필요)
  const [rejectionHistoryExpanded, setRejectionHistoryExpanded] = useState(false);
  // 약사 메모 — 차트(pharmacist_charts.pharmacist_memo)와 단일 소스. data.memo = 표시값/편집 시작값.
  const [editingMemo, setEditingMemo] = useState(false);
  const [draftMemo, setDraftMemo] = useState(data.memo ?? "");
  const [isSavingMemo, setIsSavingMemo] = useState(false);
  const saveMemo = async () => {
    if (isSavingMemo) return;
    if (!authUser) { alert("로그인이 필요합니다"); return; }
    const normalized = draftMemo.trim() || null;
    setIsSavingMemo(true);
    const { error } = await upsertChartMemo(supabase, {
      pharmacistId: authUser.id,
      consultationId: data.id,
      patientId: data.patientId ?? null,
      patientName: data.patientName,
      memo: normalized,
    });
    setIsSavingMemo(false);
    if (error) {
      console.error("[dashboard] 메모 저장 실패:", error);
      alert("메모 저장 실패");
      return; // 편집 모드 유지 — 재시도 가능
    }
    onMemoSaved(normalized ?? "");
    setEditingMemo(false);
  };
  const hasPrevRejections = (data.previousRejections?.length ?? 0) > 0;

  const badgeIsApp = data.hasAppAccount;

  // 펼침 "해야 할 일" 신호 배지 — 접힌 헤더에서 옮겨온 7종(+거절). 공통 pill 스타일.
  const signalPillBase: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 4,
    height: 28, padding: "0 10px", borderRadius: 14,
    fontSize: 13, fontWeight: 600, lineHeight: 1,
    whiteSpace: "nowrap", cursor: "default", boxSizing: "border-box",
  };
  const noShowMd = (() => {
    if (!data.noShowDate) return "";
    const m = data.noShowDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${Number(m[2])}/${Number(m[3])}` : "";
  })();
  const hasAnySignal =
    isRequested ||
    (!!data.isMedEndingSoon && !data.isRejected) ||
    (!!data.isNoShow && !data.isRejected) ||
    (!!data.needsPurchaseList && !data.isRejected) ||
    (!!data.needsDosageGuide && !data.isRejected) ||
    data.unreadCount > 0 ||
    !!data.isRejected;

  // 접힘 신호 아이콘 — 복용중 칩 우측에 이어 붙임. 펼침 그룹과 같은 신호(사후관리 제외), 이모지+짧은 숫자/날짜만.
  //   복용 임박(💊)과 복용법 발송(💊)은 같은 이모지라 색으로 분리: 임박=terra, 발송=sage.
  const iconPillBase: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 2,
    padding: "1px 6px", borderRadius: 999, fontSize: 12, fontWeight: 600,
    lineHeight: 1.5, whiteSpace: "nowrap", flexShrink: 0, cursor: "default",
  };

  // 펼침 직후 카드가 뷰포트에 들어오게 스크롤(접을 땐 이동 안 함).
  //   rAF 로 한 프레임 미뤄야 펼친 본문이 DOM 에 들어간 뒤 정확한 위치로 스크롤.
  const articleRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!expanded) return;
    const id = requestAnimationFrame(() => {
      articleRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    return () => cancelAnimationFrame(id);
  }, [expanded]);

  return (
    <article ref={articleRef} style={{
      padding: 16, background: isOverConsult ? "#FAFAFA" : "#fff",
      border: "1px solid var(--border, rgba(94,125,108,0.14))",
      borderRadius: 12,
    }}>
      {/* 카드 헤더 — 클릭 토글 제거(L1348 [상세보기 ▼] 버튼만 토글). 내부 액션 버튼은 stopPropagation 그대로. */}
      <div>
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
          </div>
          {/* 오른쪽 */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 12 }}>
            <span style={{ fontSize: 13, color: "var(--text-mid, #3D4A42)", whiteSpace: "nowrap", lineHeight: 1.5 }}>마지막 대화: {data.lastMessageAt}</span>
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
          {/* 왼쪽 — 복용중 칩 + 신호 아이콘 줄(같은 row, 줄바꿈 허용). 아이콘 분기는 칩 조건 밖이라 미복용 환자도 노출. */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap", flex: 1, minWidth: 0, overflow: "visible" }}>
            {data.supplementStatus === "taking" && (
              <span style={{
                display: "inline-block", padding: "4px 10px", borderRadius: 12, fontSize: 13, fontWeight: 500, lineHeight: "18px",
                background: "#EAF3DE", color: "#3B6D11",
                whiteSpace: "nowrap", flexShrink: 0,
              }}>
                복용 중
              </span>
            )}
            {isRequested && (
              <span title="새 상담 요청" style={{ ...iconPillBase, background: statusCfg.bg, color: statusCfg.color }}>🔔</span>
            )}
            {data.isMedEndingSoon && (
              <span title="복용 임박" style={{ ...iconPillBase, background: "#F5E6DC", color: "#C06B45" }}>
                💊{data.minRemainingDays != null ? ` D-${data.minRemainingDays}` : ""}
              </span>
            )}
            {data.isNoShow && (
              <span title="미방문" style={{ ...iconPillBase, background: "#FFF0E6", color: "#E05A1A" }}>
                ⚠️{noShowMd ? ` ${noShowMd}` : ""}
              </span>
            )}
            {data.needsPurchaseList && (
              <span title="구매내역 작성" style={{ ...iconPillBase, background: "#F5E6DC", color: "#C06B45" }}>📝</span>
            )}
            {data.needsDosageGuide && (
              <span title="복용법 발송" style={{ ...iconPillBase, background: "#EDF4F0", color: "#4A6355" }}>💊</span>
            )}
            {data.unreadCount > 0 && (
              <span title="새 메시지" style={{ ...iconPillBase, ...getUnreadBadgeStyle(hoursOfLastPatientMsg(data)) }}>
                💬 {data.unreadCount}
              </span>
            )}
            {data.isRejected && (
              <span title="거절" style={{ ...iconPillBase, background: "#FFE5E5", color: "#D32F2F" }}>❌</span>
            )}
          </div>
          {/* 오른쪽 — 거절 / 최근 방문 (방문 예정 라벨은 펼침 신호 그룹으로 이동) */}
          <div style={{ flexShrink: 0, marginLeft: 12, textAlign: "right" }}>
            {data.isRejected ? (
              <span style={{ fontSize: 13, color: "#D32F2F", fontWeight: 600, whiteSpace: "nowrap" }}>
                거절: {data.rejectedAt?.slice(5).replace(".", "/")}
              </span>
            ) : data.visitDate ? (
              <div style={{ fontSize: 14, color: "var(--text-mid, #3D4A42)", whiteSpace: "nowrap" }}>
                최근 방문: {data.visitDate.slice(5).replace(".", "/")}
              </div>
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

          {/* 해야 할 일 — 접힌 헤더에서 옮겨온 신호 배지 7종(+거절).
              환자에게 해당하는 것만, 여러 개 동시 노출. 0개면 섹션 전체 미렌더. */}
          {hasAnySignal && (
            <div className="dash-detail-section">
              <div className="dash-detail-title">해야 할 일</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {isRequested && (
                  <span style={{ ...signalPillBase, background: statusCfg.bg, color: statusCfg.color }}>
                    <span aria-hidden style={{ fontSize: 14 }}>🔔</span>
                    <span>새 상담 요청</span>
                  </span>
                )}
                {data.isMedEndingSoon && !data.isRejected && (
                  <span style={{ ...signalPillBase, background: "#F5E6DC", color: "#C06B45" }}>
                    <span aria-hidden style={{ fontSize: 14 }}>💊</span>
                    <span>복용 임박{data.minRemainingDays != null ? ` D-${data.minRemainingDays}` : ""}</span>
                  </span>
                )}
                {data.isNoShow && !data.isRejected && (
                  <span style={{ ...signalPillBase, background: "#FFF0E6", color: "#E05A1A" }}>
                    <span aria-hidden style={{ fontSize: 14 }}>⚠️</span>
                    <span>{noShowMd ? `미방문 ${noShowMd}` : "미방문"}</span>
                  </span>
                )}
                {data.needsPurchaseList && !data.isRejected && (
                  <span style={{ ...signalPillBase, background: "#F5E6DC", color: "#C06B45" }}>
                    <span aria-hidden style={{ fontSize: 14 }}>📝</span>
                    <span>구매내역 작성</span>
                  </span>
                )}
                {data.needsDosageGuide && !data.isRejected && (
                  <span style={{ ...signalPillBase, background: "#F5E6DC", color: "#C06B45" }}>
                    <span aria-hidden style={{ fontSize: 14 }}>💊</span>
                    <span>복용법 발송</span>
                  </span>
                )}
                {data.unreadCount > 0 && (
                  <span style={{ ...signalPillBase, ...getUnreadBadgeStyle(hoursOfLastPatientMsg(data)) }}>
                    <span aria-hidden style={{ fontSize: 14 }}>💬</span>
                    <span>새 메시지 {data.unreadCount}</span>
                  </span>
                )}
                {data.isRejected && (
                  <span style={{ ...signalPillBase, background: "#FFE5E5", color: "#D32F2F" }}>
                    <span aria-hidden style={{ fontSize: 14 }}>❌</span>
                    <span>거절</span>
                  </span>
                )}
              </div>
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

          {/* 증상 — 접힌 카드에서 옮겨온 항목. 헤더 단순화 + 펼침에서 한 번에 조회. */}
          {data.symptoms.length > 0 && (
            <div className="dash-detail-section">
              <div className="dash-detail-title">증상</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {data.symptoms.map((s) => (
                  <span
                    key={s.label}
                    className={`dash-tag ${SYMPTOM_TAG_CLASS[s.category]}`}
                    style={{
                      fontSize: 14, fontWeight: 500,
                      color: "var(--text-dark, #2C3630)",
                      padding: "4px 10px",
                    }}
                  >
                    {s.label}
                  </span>
                ))}
              </div>
            </div>
          )}

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

          {/* 약사 메모 — 차트(pharmacist_charts.pharmacist_memo)와 단일 소스. 편집/보기 토글. */}
          <div className="dash-detail-section">
            <div className="dash-detail-title" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>내 메모</span>
              {!editingMemo && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setDraftMemo(data.memo ?? ""); setEditingMemo(true); }}
                  style={{
                    padding: "4px 12px", borderRadius: 6, fontSize: 13, fontWeight: 600,
                    background: "#fff", color: "var(--sage-deep, #4A6355)",
                    border: "1px solid var(--sage-light, #B3CCBE)", cursor: "pointer",
                    fontFamily: "'Noto Sans KR', sans-serif",
                  }}
                >수정</button>
              )}
            </div>
            {editingMemo ? (
              <div>
                <textarea
                  value={draftMemo}
                  onChange={(e) => setDraftMemo(e.target.value)}
                  placeholder="환자에게 보이지 않는 내부 메모입니다."
                  rows={4}
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: 8,
                    border: "1.5px solid var(--sage-light, #B3CCBE)", fontSize: 14,
                    color: "var(--text-dark, #2C3630)", outline: "none", resize: "vertical",
                    fontFamily: "'Noto Sans KR', sans-serif", boxSizing: "border-box",
                    background: "#fff", lineHeight: 1.65,
                  }}
                />
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setEditingMemo(false); }}
                    disabled={isSavingMemo}
                    style={{
                      padding: "6px 14px", borderRadius: 6, fontSize: 13, fontWeight: 600,
                      background: "transparent", color: "var(--text-mid, #3D4A42)",
                      border: "1px solid var(--border, rgba(94,125,108,0.14))",
                      cursor: isSavingMemo ? "default" : "pointer", opacity: isSavingMemo ? 0.6 : 1,
                    }}
                  >취소</button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); saveMemo(); }}
                    disabled={isSavingMemo}
                    style={{
                      padding: "6px 14px", borderRadius: 6, fontSize: 13, fontWeight: 700,
                      background: isSavingMemo ? "var(--sage-light, #B3CCBE)" : "var(--sage-deep, #4A6355)",
                      color: "#fff", border: "none", cursor: isSavingMemo ? "default" : "pointer",
                    }}
                  >{isSavingMemo ? "저장 중..." : "저장"}</button>
                </div>
              </div>
            ) : (
              <div style={{
                fontSize: 14, lineHeight: 1.65, whiteSpace: "pre-wrap",
                color: data.memo ? "var(--text-dark, #2C3630)" : "var(--text-placeholder, #7A8A80)",
                padding: "10px 14px", borderRadius: 10,
                background: "var(--sage-bg, #F8F9F7)", border: "1px solid var(--border, rgba(94,125,108,0.14))",
              }}>
                {data.memo || "메모를 추가하세요"}
              </div>
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
                onClick={(e) => { e.stopPropagation(); router.push(`/chart/${data.id}?role=pharmacist${chatOpen ? "&chatOpen=true" : ""}`); }}
                style={{
                  flex: 1, padding: "12px 0", borderRadius: 10,
                  fontSize: 14, fontWeight: 700,
                  background: "#fff", color: "var(--sage-deep, #4A6355)",
                  border: "1.5px solid var(--sage-light, #B3CCBE)", cursor: "pointer",
                }}
              >차트 열기</button>
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
            <span style={{ fontSize: 10, color: "#9AA8A0" }}>내부 메모 (환자에게 안 보임)</span>
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
  // 카드 전용 확장 키 — "visit_check"(예정일 지난 미처리 방문) / "post_visit"(방문 후 구매리스트·복용가이드 미처리)
  //   은 lib 의 FilterKey 에 없으므로 여기서 union 으로 확장. applyFilters 호출 시 둘만 특수 처리.
  type CardFilterKey = FilterKey | "visit_check" | "post_visit";
  const [filter, setFilter] = useState<CardFilterKey>("all");
  const [sortBy, setSortBy] = useState<SortKey>("recent");
  const [search, setSearch] = useState("");

  const { user: authUser } = useAuth();

  // 약사 페이지 접근 가드 — 비로그인/환자/면허없음 리다이렉트. checking=true 동안 본문 대신 로딩 화면.
  //   /dashboard 와 /dashboard/patients 등 약사 전용 페이지가 동일 hook 호출로 일관 적용.
  const { checking, failed } = usePharmacistGuard();

  const [actingId, setActingId] = useState<string | null>(null);



  /** 통합 환자 목록 로더 — src/lib/pharmacistConsults 의 fetchAllConsultations 를 호출해 setConsults 적용.
   *  본문(쿼리·매핑) 은 모두 lib 으로 이동(2026-05-27). dashboard·환자 목록 페이지에서 공유. */
  const loadConsults = async (pharmacistId: string) => {
    const list = await fetchAllConsultations(supabase, pharmacistId);
    setConsults(list);
  };



  // 통합 환자 목록(consults state) — pharmacistId 확정 시 fetch. 미로그인이면 빈 배열.
  useEffect(() => {
    if (!authUser) {
      setConsults([]);
      return;
    }
    loadConsults(authUser.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

  // 차트에서 메모 수정 후 대시보드 복귀 시 stale 방지 — 탭이 visible 로 돌아오면 재fetch.
  //   (같은 탭 SPA 내부 이동은 안 잡힐 수 있음 — 부족하면 다음 단계에서 pathname 감지로 보강)
  useEffect(() => {
    if (!authUser) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") loadConsults(authUser.id);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

  // 4단계: 리스트뷰 분리(/dashboard/patients) 이후 카드 전용. viewMode/sessionStorage/리스트 전용 필터 제거.
  const [filterSource, setFilterSource] = useState<"app" | "offline" | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  /* AI 검색 */
  const [aiSearchMode, setAiSearchMode] = useState(false);
  const [aiSearchQuery, setAiSearchQuery] = useState("");
  const [aiSearched, setAiSearched] = useState(false);

  /* 환자 데이터 — fetchAllConsultations 결과로 채워짐. MOCK_CONSULTS 정의는 디자인 참조용으로 보존(라이브 사용 안 함). */
  const [consults, setConsults] = useState<PatientConsult[]>([]);

  /* 토스트 */
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2200);
  };

  const handleAccept = async (id: string) => {
    if (actingId) return; // 중복 클릭 가드
    if (!authUser) { showToast("로그인이 필요해요"); return; }
    setActingId(id);

    // (공통) consultations UPDATE — status=accepted, 본인을 담당 약사로 배정
    type Patch = { status: string; pharmacist_id: string };
    const patch: Patch = { status: "accepted", pharmacist_id: authUser.id };
    const { error } = await (supabase
      .from("consultations") as unknown as {
        update: (p: Patch) => {
          eq: (col: string, val: string) => Promise<{ error: Error | null }>;
        };
      })
      .update(patch)
      .eq("id", id);
    if (error) {
      console.error("[dashboard] consultation accept failed:", error);
      setActingId(null);
      showToast("수락 처리에 실패했어요. 다시 시도해주세요");
      return;
    }

    // (수락 전용) 회차(round) 부트스트랩 — 옛 updatePendingStatus 와 동일.
    //   기존 active round 닫기 → max(round_number)+1 → questionnaire_id 조회 →
    //   consultation_rounds INSERT(active) → [ROUND_START] 시스템 메시지 INSERT.
    //   부분 실패는 console.error 만, 수락 자체는 성공으로 간주.
    try {
      // (a) 기존 active round 닫기
      type RoundUpdate = { status: string; ended_at: string };
      const closePrevResp = await (supabase
        .from("consultation_rounds") as unknown as {
          update: (p: RoundUpdate) => {
            eq: (col: string, val: string) => {
              eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
            };
          };
        })
        .update({ status: "completed", ended_at: new Date().toISOString() })
        .eq("consultation_id", id)
        .eq("status", "active");
      if (closePrevResp.error) {
        console.error("[ACCEPT] close previous active rounds failed:", closePrevResp.error);
      }

      // (b) 다음 round_number 계산
      const maxResp = await supabase
        .from("consultation_rounds")
        .select("round_number")
        .eq("consultation_id", id)
        .order("round_number", { ascending: false })
        .limit(1)
        .maybeSingle<{ round_number: number }>();
      if (maxResp.error) {
        console.error("[ACCEPT] max round_number lookup failed:", maxResp.error);
      }
      const nextRoundNumber =
        typeof maxResp.data?.round_number === "number"
          ? maxResp.data.round_number + 1
          : 1;

      // (c) consultations.questionnaire_id 조회
      const consResp = await supabase
        .from("consultations")
        .select("questionnaire_id")
        .eq("id", id)
        .maybeSingle<{ questionnaire_id: string | null }>();
      if (consResp.error) {
        console.error("[ACCEPT] consultation questionnaire_id lookup failed:", consResp.error);
      }
      const qId = consResp.data?.questionnaire_id ?? null;

      // (d) consultation_rounds INSERT
      type RoundInsert = {
        consultation_id: string;
        round_number: number;
        questionnaire_id: string | null;
        status: string;
      };
      const roundPayload: RoundInsert = {
        consultation_id: id,
        round_number: nextRoundNumber,
        questionnaire_id: qId,
        status: "active",
      };
      const roundResp = await (supabase
        .from("consultation_rounds") as unknown as {
          insert: (p: RoundInsert) => {
            select: (cols: string) => {
              maybeSingle: () => Promise<{
                data: { id: string } | null;
                error: { message: string } | null;
              }>;
            };
          };
        })
        .insert(roundPayload)
        .select("id")
        .maybeSingle();

      if (roundResp.error || !roundResp.data?.id) {
        console.error("[ACCEPT] round insert failed:", roundResp.error);
      } else {
        // (e) 회차 시작 시스템 메시지 INSERT
        type SysMsgInsert = {
          consultation_id: string;
          round_id: string;
          sender_id: string;
          content: string;
          message_type: string;
          is_read: boolean;
        };
        const sysPayload: SysMsgInsert = {
          consultation_id: id,
          round_id: roundResp.data.id,
          sender_id: authUser.id,
          content: "[ROUND_START]",
          message_type: "system",
          is_read: true,
        };
        const sysResp = await (supabase
          .from("messages") as unknown as {
            insert: (p: SysMsgInsert) => Promise<{ error: { message: string } | null }>;
          })
          .insert(sysPayload);
        if (sysResp.error) {
          console.error("[ACCEPT] round-start system message INSERT failed:", sysResp.error);
        }
      }
    } catch (roundErr) {
      console.error("[ACCEPT] round bootstrap threw:", roundErr);
    }

    setActingId(null);
    // 낙관적 패치(즉시 반영) + 서버 최신화(loadConsults)
    setConsults((prev) => prev.map((c) => c.id === id ? { ...c, patientStatus: "managing" } : c));
    await loadConsults(authUser.id);
    showToast("✓ 수락됨");
  };

  const handleReject = async (id: string, reason: string) => {
    if (actingId) return; // 중복 클릭 가드
    if (!authUser) { showToast("로그인이 필요해요"); return; }
    setActingId(id);

    // consultations UPDATE — status=rejected, rejected_at. 거절은 차수/메시지 처리 없음(옛 코드와 동일).
    type Patch = { status: string; rejected_at: string };
    const patch: Patch = { status: "rejected", rejected_at: new Date().toISOString() };
    const { error } = await (supabase
      .from("consultations") as unknown as {
        update: (p: Patch) => {
          eq: (col: string, val: string) => Promise<{ error: Error | null }>;
        };
      })
      .update(patch)
      .eq("id", id);
    if (error) {
      console.error("[dashboard] consultation reject failed:", error);
      setActingId(null);
      showToast("거절 처리에 실패했어요. 다시 시도해주세요");
      return;
    }

    setActingId(null);
    // 거절일 — mock 시각 상수 제거 후 실제 오늘 날짜로 "YYYY.MM.DD" 형식 채움.
    const today = (() => {
      const d = new Date();
      return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
    })();
    // 낙관적 패치(즉시 반영) + 서버 최신화(loadConsults)
    setConsults((prev) => prev.map((c) => c.id === id ? { ...c, isRejected: true, rejectedReason: reason, rejectedAt: today, patientStatus: "inactive" } : c));
    await loadConsults(authUser.id);
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

  // 필터 + 검색 + 정렬 — 카드 전용. 리스트 전용 필터(dateRange/filterVisit/filterSupplement/filterRelation)는
  //   환자 목록 페이지(/dashboard/patients) 로 이전됨. 여기선 카드 키워드 + 경로 칩만 적용.
  //   "visit_check" 는 lib FilterKey 에 없는 카드 전용 키 — applyFilters 에는 "all" 로 호출 후 isNoShow 만 후처리.
  const result = sortConsults(
    filter === "visit_check"
      ? applyFilters(consults, {
          filter: "all", search,
          dateRange: "all", customDateFrom: "", customDateTo: "",
          filterSource, filterVisit: null, filterSupplement: null, filterRelation: null,
        }).filter((c) => c.isNoShow === true)
      : filter === "post_visit"
      ? applyFilters(consults, {
          filter: "all", search,
          dateRange: "all", customDateFrom: "", customDateTo: "",
          filterSource, filterVisit: null, filterSupplement: null, filterRelation: null,
        }).filter((c) => c.needsPurchaseList || c.needsDosageGuide)
      : applyFilters(consults, {
          filter, search,
          dateRange: "all", customDateFrom: "", customDateTo: "",
          filterSource, filterVisit: null, filterSupplement: null, filterRelation: null,
        }),
    sortBy,
  );

  // 통계
  // 통계 카드 소스 — consults(통합 환자 목록) 기반. dbPendingCount 폴백은 통합 도입으로 제거.
  const totalRequested = consults.filter((c) => c.patientStatus === "requested" && !c.isRejected).length;
  const totalVisitToday = consults.filter((c) => c.hasVisitToday).length;
  const totalUrgent = consults.filter((c) => needsUrgentReply(c) || needsAcceptUrgent(c)).length;
  // "방문 체크" 탭 카운트 — 예정일 지났는데 [방문 완료] 미처리 환자 수.
  const totalNoShow = consults.filter((c) => c.isNoShow === true).length;
  // "방문 후 처리" 탭 카운트 — 구매리스트 미작성 또는 복용가이드 미발송 환자 수.
  const totalPostVisit = consults.filter((c) => c.needsPurchaseList || c.needsDosageGuide).length;

  // 필터 칩 카운트 배지 — 각 칩을 눌렀을 때 나오는 목록 개수와 일치하도록 applyFilters 의 탭별 술어를
  //   그대로 사용(dashboardFilters.ts if-체인 기준). "전체"(all)는 개수 의미가 약해 배지 미부착(키 없음).
  //   주의: 통계 카드용 totalUrgent(needsUrgentReply‖needsAcceptUrgent)·totalVisitToday(hasVisitToday)는
  //   med_ending_soon(isMedEndingSoon)·visit_scheduled(nextVisitDate) 탭 술어와 달라 칩 카운트로 재사용하지 않음.
  const chipCount: Partial<Record<CardFilterKey, number>> = {
    requested: totalRequested,
    med_ending_soon: consults.filter((c) => c.isMedEndingSoon === true).length,
    visit_scheduled: consults.filter((c) => !!c.nextVisitDate).length,
    visit_check: totalNoShow,
    post_visit: totalPostVisit,
    unread: consults.filter((c) => c.unreadCount > 0).length,
  };

  // 판정 실패(재시도까지 소진) — 영구 "확인 중" 멈춤 대신 안내 + 새로고침.
  if (failed) {
    return (
      <div style={{
        minHeight: "60vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        fontFamily: "'Noto Sans KR', sans-serif",
      }}>
        <div style={{ fontSize: 15, color: "#3D4A42" }}>정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.</div>
        <button
          type="button"
          onClick={() => location.reload()}
          style={{
            marginTop: 16, padding: "10px 24px", borderRadius: 100,
            background: "#4A6355", color: "#fff", fontSize: 14, fontWeight: 600,
            border: "none", cursor: "pointer",
          }}
        >새로고침</button>
      </div>
    );
  }

  // 가드 통과 확정 전(로딩/리다이렉트 진행 중)에는 본문 대신 로딩 화면 — 비로그인/환자에게 약사 본문 깜빡임 방지.
  if (checking) {
    return (
      <div style={{
        minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 15, color: "#3D4A42", fontFamily: "'Noto Sans KR', sans-serif",
      }}>
        확인 중…
      </div>
    );
  }

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
              <span className="dash-stat-num" style={{ color: "#B06D00" }}>🔔 {totalRequested}</span>
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

        {/* 필터 + 정렬 — 카드 전용 6탭. 기간/거절이력은 환자 목록 페이지(/dashboard/patients) 로 분리됨. */}
        <div className="dash-filter-row">
          <div className="dash-filters">
            {([
              ["all", "전체"],
              ["requested", "🔔 새 상담 요청"],
              ["med_ending_soon", "💊 복용 임박"],
              ["visit_scheduled", "🗓️ 방문 예정"],
              ["visit_check", "⚠️ 방문 체크"],
              ["post_visit", "📝 방문 후 처리"],
              ["unread", "💬 새 메시지"],
            ] as [CardFilterKey, string][]).map(([key, label]) => (
              <button
                key={key}
                className={`dash-filter-tab${filter === key ? " active" : ""}`}
                onClick={() => setFilter(key)}
              >
                {label}
                {(chipCount[key] ?? 0) > 0 && (
                  <span style={{
                    marginLeft: 6, display: "inline-flex", alignItems: "center", justifyContent: "center",
                    minWidth: 18, height: 18, padding: "0 6px", borderRadius: 9,
                    background: "#FFF0E6", color: "#E05A1A",
                    fontSize: 11, fontWeight: 700, lineHeight: 1,
                  }}>{chipCount[key]}</span>
                )}
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
        </div>

        {/* 환자 카드 목록 — 카드 뷰 전용. 리스트 뷰는 /dashboard/patients 페이지로 분리됨. */}
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
        ) : (
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
                  onMemoSaved={(memo) => setConsults((prev) => prev.map((x) => (x.id === c.id ? { ...x, memo } : x)))}
                />
              </div>
            ))}
          </div>
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
