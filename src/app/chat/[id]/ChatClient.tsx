"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter, useParams } from "next/navigation";
import {
  type Template as ChatTemplate,
  INITIAL_TEMPLATES as TEMPLATE_ITEMS,
} from "@/data/templatesMock";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";
import { questions as ALL_QUESTIONS, type Question } from "@/lib/questions";

type MessageInsert = Database["public"]["Tables"]["messages"]["Insert"];

/** severity 표시값 — severity 컬럼 우선, 없으면 detailed_answers.severity(number) 폴백.
 *  legacy questionnaire(컬럼은 NULL 인데 detailed_answers 에는 값 있음) 대응. */
function getSeverityDisplay(pq: {
  severity: string | null;
  detailed_answers: Record<string, unknown> | null;
}): string {
  const direct = pq.severity?.toString().trim();
  if (direct) return direct;
  const fromDetailed = pq.detailed_answers?.severity;
  if (typeof fromDetailed === "number") return String(fromDetailed);
  if (typeof fromDetailed === "string" && fromDetailed.trim()) return fromDetailed;
  return "—";
}

/** 약사 측 23문항 사이드 패널 — 환자 답변을 질문 타입별로 보기 좋게 포매팅. */
function formatQuestionAnswer(q: Question, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  switch (q.type) {
    case "single":
    case "bristol":
      return typeof value === "string" && value.trim() ? value : "—";
    case "multi":
      if (Array.isArray(value)) {
        const arr = (value as unknown[]).filter((x) => typeof x === "string" && x.trim());
        return arr.length > 0 ? (arr as string[]).join(", ") : "—";
      }
      return "—";
    case "slider":
      return typeof value === "number" ? String(value) : "—";
    case "input_row": {
      if (typeof value !== "object" || value === null) return "—";
      const obj = value as Record<string, string>;
      const parts = (q.inputs ?? [])
        .map((inp) => {
          const v = obj[inp.key];
          if (!v || !String(v).trim()) return null;
          return `${inp.label} ${v}${inp.unit ?? ""}`;
        })
        .filter((p): p is string => !!p);
      return parts.length > 0 ? parts.join(" · ") : "—";
    }
    case "textarea":
      return typeof value === "string" && value.trim() ? value : "—";
    default:
      return "—";
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface DbMessageRow {
  id: string;
  consultation_id: string;
  sender_id: string;
  content: string;
  message_type: string;
  is_read: boolean;
  created_at: string;
  round_id: string | null;
}

interface DbRound {
  id: string;
  round_number: number;
  questionnaire_id: string | null;
  started_at: string;
  ended_at: string | null;
  status: string | null;
}

/** 시스템 메시지 회색 알약 본문 토큰 치환.
 *  메시지 리스트(시간순 이력)에서 raw 토큰이 노출되지 않도록 자연어로 변환.
 *  ChatListClient.formatPreview 와 별도로 유지 — 미리보기(짧은 한 줄)와 본문(시간순 이력) 은 용도 다름.
 *  향후 새 시스템 토큰 추가 시: 미리보기 문구는 ChatListClient.formatPreview, 메시지 리스트 본문은 이 함수에 추가.
 *  [CONSULT_REJECTED] role 별 분리 사유: 환자 측은 부드럽고 누구 탓도 아닌 톤("진행되지 않았습니다"),
 *  약사 측은 자기 행위에 대한 시스템적 명확 표현("거절하였습니다"). 안내 카드 헤딩 톤과 일관. */
function formatSystemMessageContent(content: string, role: "patient" | "pharmacist"): string {
  if (content === "[CONSULT_REJECTED]") {
    return role === "patient" ? "상담이 진행되지 않았습니다" : "상담을 거절하였습니다";
  }
  if (content.startsWith("[시스템] ")) return content.replace("[시스템] ", "");
  return content;
}

function fmtChatTime(iso: string): string {
  const d = new Date(iso);
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours < 12 ? "오전" : "오후";
  const h = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${ampm} ${h}:${String(minutes).padStart(2, "0")}`;
}

interface Message {
  id: string;
  sender: "patient" | "pharmacist";
  content: string;
  time: string;
  isRead: boolean;
  sessionId?: string;
  pharmacistOnly?: boolean;
  // DB 모드 차수 분리용 (consultation_rounds.id). null 이면 옛 메시지 → 첫 round 에 포함시켜 표시
  round_id?: string | null;
  // DB 모드 messages.message_type 보존 — 'system' 이면 시스템 메시지 렌더 분기.
  // mock 모드에서는 미설정 → "[시스템]" prefix 폴백 사용.
  message_type?: string;
  // DB 모드 messages.created_at 보존 — 회차 구분자 라벨에 날짜 표시용.
  created_at?: string;
}

const DEMO_MESSAGES: Message[] = [
  {
    id: "1",
    sender: "pharmacist",
    content: "안녕하세요, 김서연 약사입니다. 문답 내용 잘 확인했어요. 만성피로와 소화불량이 주요 증상이시군요.",
    time: "오전 10:02",
    isRead: true,
    sessionId: "s1",
  },
  {
    id: "2",
    sender: "patient",
    content: "네, 맞아요. 아침에 일어나기가 너무 힘들고 밥 먹으면 항상 더부룩해요.",
    time: "오전 10:05",
    isRead: true,
    sessionId: "s1",
  },
  {
    id: "3",
    sender: "pharmacist",
    content: "혹시 현재 복용 중인 영양제가 있으신가요? 그리고 평소 식사는 규칙적으로 하시는 편인지 궁금해요.",
    time: "오전 10:08",
    isRead: true,
    sessionId: "s1",
  },
  {
    id: "4",
    sender: "patient",
    content: "종합비타민이랑 유산균 먹고 있어요. 식사는 아침은 거의 못 먹고 점심, 저녁만 먹어요.",
    time: "오전 10:12",
    isRead: true,
    sessionId: "s1",
  },
  {
    id: "5",
    sender: "pharmacist",
    content: "아, 그러시군요. 아침 공복이 길면 소화 기능이 더 약해질 수 있어요. 현재 드시는 유산균 종류도 한번 확인해 볼게요. 약국에 방문하시면 더 자세히 상담드릴 수 있어요.",
    time: "오전 10:15",
    isRead: true,
    sessionId: "s1",
  },
  {
    id: "6",
    sender: "patient",
    content: "네! 이번 주 토요일에 방문해도 될까요?",
    time: "오전 10:18",
    isRead: false,
    sessionId: "s1",
  },
  {
    id: "visit-demo-1",
    sender: "pharmacist",
    content: "[방문안내] 2026년 4월 12일\n오전\n9시-10시가 한가해요",
    time: "오전 10:22",
    isRead: true,
    sessionId: "s1",
  },
  {
    id: "qset-demo-1",
    sender: "pharmacist",
    content: "[추가질문] set-3",
    time: "오전 10:25",
    isRead: true,
    sessionId: "s1",
  },
];

const PHARMACIST_INFO = {
  name: "김서연 약사",
  pharmacy: "초록숲 약국",
  avatar: "👩‍⚕️",
};


/* 추가 질문 세트 — 약사가 채팅에서 전송 */
type QSetQuestionType = "객관식" | "주관식" | "다중 선택";
interface QSetQuestion {
  text: string;
  type: QSetQuestionType;
  choices?: string[];
}
interface QuestionnaireSet {
  id: string;
  name: string;
  isDefault: boolean;
  questions: QSetQuestion[];
}

const QUESTIONNAIRE_SETS: QuestionnaireSet[] = [
  {
    id: "set-1", name: "소화 문제용", isDefault: true,
    questions: [
      { text: "식후 더부룩함이 얼마나 자주 있나요?", type: "객관식", choices: ["거의 없음", "가끔", "자주", "매일"] },
      { text: "배변 주기는 어떻게 되나요?", type: "객관식", choices: ["매일", "2~3일에 한 번", "일주일에 2~3회", "일주일에 한 번 이하"] },
      { text: "소화에 도움이 되는 음식이 있다면 자유롭게 적어주세요.", type: "주관식" },
      { text: "평소 불편한 증상을 모두 선택해주세요.", type: "다중 선택", choices: ["속쓰림", "더부룩함", "가스 참", "메스꺼움", "복통"] },
      { text: "하루 수분 섭취량은 어느 정도인가요?", type: "객관식", choices: ["500mL 이하", "500mL~1L", "1L~2L", "2L 이상"] },
    ],
  },
  {
    id: "set-2", name: "수면 문제용", isDefault: false,
    questions: [
      { text: "잠드는 데까지 걸리는 시간은?", type: "객관식", choices: ["10분 이내", "10~30분", "30분~1시간", "1시간 이상"] },
      { text: "자다가 깨는 횟수는?", type: "객관식", choices: ["없음", "1회", "2~3회", "4회 이상"] },
      { text: "수면 관련 더 말씀하고 싶은 내용이 있다면 적어주세요.", type: "주관식" },
    ],
  },
  {
    id: "set-3", name: "피로·무기력용", isDefault: false,
    questions: [
      { text: "오전과 오후 중 언제 더 피곤함을 느끼나요?", type: "객관식", choices: ["오전", "오후", "하루종일", "특별히 없음"] },
      { text: "피로와 함께 오는 증상을 모두 선택해주세요.", type: "다중 선택", choices: ["두통", "소화불량", "집중력 저하", "근육통", "없음"] },
      { text: "최근 운동 빈도는?", type: "객관식", choices: ["안 함", "주 1~2회", "주 3~4회", "매일"] },
      { text: "평소 스트레스 요인이 있다면 적어주세요.", type: "주관식" },
    ],
  },
];

/* ══════════════════════════════════════════
   방문전 리포트 — 타입 & 초기값
   ══════════════════════════════════════════ */
interface RptNutrition { id: string; label: string; checked: boolean; }
interface RptLifestyleItem { label: string; checked: boolean; }
interface RptLifestyleCategory { id: string; title: string; selected: boolean; items: RptLifestyleItem[]; }

const RPT_NUTRITION_INIT: RptNutrition[] = [
  { id: "vitamin", label: "비타민류", checked: false },
  { id: "mineral", label: "미네랄", checked: false },
  { id: "gut", label: "장 건강", checked: false },
  { id: "antioxidant", label: "항산화", checked: false },
  { id: "sleep-relax", label: "수면/이완", checked: false },
  { id: "joint", label: "관절/연골", checked: false },
  { id: "immune-nutr", label: "면역", checked: false },
];

const RPT_LIFESTYLE_INIT: RptLifestyleCategory[] = [
  { id: "sleep", title: "수면", selected: false, items: [
    { label: "매일 같은 시간에 취침", checked: false },
    { label: "취침 1시간 전 스마트폰 내려놓기", checked: false },
    { label: "카페인 오후 2시 이후 자제", checked: false },
    { label: "침실 온도 18~20도", checked: false },
  ]},
  { id: "water", title: "수분", selected: false, items: [
    { label: "하루 물 1.5L 이상", checked: false },
    { label: "카페인 음료 줄이기", checked: false },
    { label: "아침 기상 후 물 한잔", checked: false },
    { label: "식사 중 과도한 수분 자제", checked: false },
  ]},
  { id: "meal", title: "식사", selected: false, items: [
    { label: "아침 식사 챙기기", checked: false },
    { label: "단백질 매끼 포함", checked: false },
    { label: "채소 충분히", checked: false },
    { label: "야식 줄이기", checked: false },
    { label: "가공식품 줄이기", checked: false },
  ]},
  { id: "exercise", title: "운동", selected: false, items: [
    { label: "주 3회 이상 30분 걷기", checked: false },
    { label: "계단 이용하기", checked: false },
    { label: "스트레칭 매일 10분", checked: false },
    { label: "과격한 운동 자제", checked: false },
  ]},
];

export default function ChatClient() {
  return (
    <Suspense>
      <ChatContent />
    </Suspense>
  );
}

interface FollowUp {
  date: string; // "2026.04.23" 형태
  time: string; // "오전 10시" 형태
  message: string;
}

interface VisitGuide {
  date: string;       // "2026-04-12"
  timeSlot: string;   // "오전" | "오후" | "종일" | 직접 입력 텍스트
  memo: string;
}

const VISIT_TIME_SLOTS = ["오전", "오후", "종일", "직접 입력"];

/* ── 상담 차수 ── */
interface ConsultSession {
  id: string;
  startDate: string;       // "MM.DD" 형태
  aiSummary: string;       // AI 문답 요약
  symptomTags: string[];   // 증상 태그
}

const CONSULT_SESSIONS: ConsultSession[] = [
  {
    id: "s1", startDate: "03.15",
    aiSummary: "만성피로 + 소화불량 복합. 6개월 이상 지속, 오후 졸음·식후 더부룩함 호소.",
    symptomTags: ["만성피로", "소화불량"],
  },
  {
    id: "s2", startDate: "04.11",
    aiSummary: "수면장애 재발. 입면 어려움, 새벽 각성. 카페인 섭취 증가와 연관 가능성.",
    symptomTags: ["수면장애", "스트레스"],
  },
];

/** 가장 최근 차수 id (가장 뒤의 항목) */
const LATEST_SESSION_ID = CONSULT_SESSIONS[CONSULT_SESSIONS.length - 1].id;

const SESSION2_SYSTEM_MSG: Message = {
  id: "session2-start",
  sender: "pharmacist",
  content: "[시스템] 새로운 상담이 시작되었습니다",
  time: "오전 9:00",
  isRead: true,
  sessionId: "s2",
};

/** 2차 상담 추가 메시지 (Mock) */
const SESSION2_EXTRA_MSGS: Message[] = [
  {
    id: "s2-1",
    sender: "patient",
    content: "약사님 안녕하세요, 지난달에 한 번 상담받았었는데 요즘 다시 잠이 잘 안 와서 AI 문답 다시 제출했어요.",
    time: "오전 9:15",
    isRead: true,
    sessionId: "s2",
  },
  {
    id: "s2-2",
    sender: "pharmacist",
    content: "네 알겠습니다. 증상 확인했어요. 카페인 섭취량이 좀 늘어난 것 같은데 최근 생활 패턴 어떠세요?",
    time: "오전 9:40",
    isRead: true,
    sessionId: "s2",
  },
  {
    id: "s2-3",
    sender: "patient",
    content: "요즘 업무가 많아서 오후에 커피 한 잔 더 마시게 됐어요. 그게 영향인 것 같기도 하고...",
    time: "오전 10:02",
    isRead: false,
    sessionId: "s2",
  },
];

function formatVisitDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일`;
}

function formatVisitDateShort(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${m}월 ${d}일`;
}

const FOLLOWUP_DEFAULT_MSG = "안녕하세요! 지난번 상담 이후 경과가 궁금해요. 혹시 수면이나 소화 쪽으로 변화가 있으셨나요? 편하게 말씀해 주세요.";

const FU_TIME_OPTIONS = [
  "오전 9시", "오전 10시", "오후 12시", "오후 5시", "직접 입력",
];

function formatFollowUpLabel(dateStr: string): string {
  const [, m, d] = dateStr.split(".");
  return `${Number(m)}월 ${Number(d)}일`;
}

function calcDaysLeft(dateStr: string): string {
  const [y, m, d] = dateStr.split(".").map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return "오늘";
  if (diff === 1) return "내일";
  if (diff === 2) return "이틀 뒤";
  return `${diff}일 뒤`;
}

function ChatContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const chatId = params.id as string;
  const role = searchParams.get("role") === "pharmacist" ? "pharmacist" : "patient";
  const isEmbedded = searchParams.get("embedded") === "true";

  const isDbConsultation = UUID_RE.test(chatId);
  const { user, loading: authLoading } = useAuth();

  const [messages, setMessages] = useState<Message[]>(
    isDbConsultation ? [] : [...DEMO_MESSAGES, SESSION2_SYSTEM_MSG, ...SESSION2_EXTRA_MSGS],
  );
  const [dbConsultation, setDbConsultation] = useState<{
    patient_id: string;
    pharmacist_id: string | null;
    status: string | null;
    questionnaire_id: string | null;
  } | null>(null);
  // 약사 측 pending 환자 정보 — rounds 없는 시점 ai_questionnaires 직접 fetch 결과.
  // accepted 전환되면 rounds 기반 questionnaireById 가 데이터 소스가 되므로 더 이상 사용 안 함.
  const [pendingQuestionnaire, setPendingQuestionnaire] = useState<{
    symptoms: string[] | null;
    symptom_duration: string | null;
    severity: string | null;
    free_text: string | null;
    ai_summary: string | null;
    detailed_answers: Record<string, unknown> | null;
  } | null>(null);
  // 차수 목록 + 활성 차수 (DB 모드 전용; mock 모드에선 빈 배열 + null)
  const [rounds, setRounds] = useState<DbRound[]>([]);
  const [activeRoundId, setActiveRoundId] = useState<string | null>(null);
  // 차수별 questionnaire 콘텐츠 — DB 모드 박스 렌더에 사용
  interface QuestionnaireContent {
    symptoms: string[] | null;
    ai_summary: string | null;
    free_text: string | null;
    completed_at: string | null;
  }
  const [questionnaireById, setQuestionnaireById] = useState<Map<string, QuestionnaireContent>>(
    new Map(),
  );
  // 상대방 표시 이름 (DB 모드) — 환자 측에선 약사 license_name + 약국, 약사 측에선 환자 profiles.name
  const [dbCounterpartName, setDbCounterpartName] = useState<string | null>(null);
  const [dbCounterpartPharmacy, setDbCounterpartPharmacy] = useState<string | null>(null);
  const [dbCounterpartLicenseName, setDbCounterpartLicenseName] = useState<string | null>(null);
  const [dbCounterpartAvatarUrl, setDbCounterpartAvatarUrl] = useState<string | null>(null);
  const [dbLoading, setDbLoading] = useState(isDbConsultation);
  const [dbError, setDbError] = useState<string | null>(null);
  // 종료 액션 상태 (환자 측 "상담 종료" 버튼 → 모달 → UPDATE)
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [endingConsult, setEndingConsult] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);
  // 약사 측 거절 액션 상태 (pending UI 거절 버튼 → 사유 선택 모달 → UPDATE)
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);
  // 약사 측 수락 액션 상태 (pending UI 수락 버튼 → 진행 중 상담 안내 모달 → UPDATE + round INSERT)
  const [showAcceptConfirm, setShowAcceptConfirm] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [pendingActiveCount, setPendingActiveCount] = useState(0);
  const [input, setInput] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /* ── 상담 차수 ── */
  const [activeSession, setActiveSession] = useState(LATEST_SESSION_ID);
  const isLatestSession = activeSession === LATEST_SESSION_ID;
  const activeSessionData = CONSULT_SESSIONS.find((s) => s.id === activeSession);
  const sessionTabRef = useRef<HTMLDivElement>(null);

  /* ── 팔로업 (차수별) ── */
  const [followUpMap, setFollowUpMap] = useState<Record<string, FollowUp | null>>({
    s1: { date: "2026.04.23", time: "오전 10시", message: FOLLOWUP_DEFAULT_MSG },
    s2: null,
  });
  const followUp = followUpMap[activeSession] ?? null;
  const setFollowUp = (val: FollowUp | null) => setFollowUpMap((prev) => ({ ...prev, [activeSession]: val }));
  const [showFollowUpPanel, setShowFollowUpPanel] = useState(false);
  const [fuInterval, setFuInterval] = useState<string>("2w");
  const [fuCustomDate, setFuCustomDate] = useState("");
  const [fuTime, setFuTime] = useState("오전 10시");
  const [fuCustomTime, setFuCustomTime] = useState("10:00");
  const [fuMessage, setFuMessage] = useState(FOLLOWUP_DEFAULT_MSG);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  /* ── 방문 안내 (차수별) ── */
  const [visitGuideMap, setVisitGuideMap] = useState<Record<string, VisitGuide | null>>({
    s1: { date: "2026-04-12", timeSlot: "오전", memo: "9시-10시가 한가해요" },
    s2: null,
  });
  const visitGuide = visitGuideMap[activeSession] ?? null;
  const setVisitGuide = (val: VisitGuide | null) => setVisitGuideMap((prev) => ({ ...prev, [activeSession]: val }));
  const [activeVisitMsgIdMap, setActiveVisitMsgIdMap] = useState<Record<string, string | null>>({
    s1: "visit-demo-1",
    s2: null,
  });
  const activeVisitMsgId = activeVisitMsgIdMap[activeSession] ?? null;
  const setActiveVisitMsgId = (val: string | null) => setActiveVisitMsgIdMap((prev) => ({ ...prev, [activeSession]: val }));
  const [showVisitPanel, setShowVisitPanel] = useState(false);
  const [visitDate, setVisitDate] = useState("");
  const [visitTimeSlot, setVisitTimeSlot] = useState("오전");
  const [visitCustomTime, setVisitCustomTime] = useState("");
  const [visitMemo, setVisitMemo] = useState("");
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTimeSlot, setRescheduleTimeSlot] = useState("오전");
  const [rescheduleCustomTime, setRescheduleCustomTime] = useState("");
  const [cancelledVisitIds, setCancelledVisitIds] = useState<Set<string>>(new Set());
  const [showReplacePrevVisit, setShowReplacePrevVisit] = useState(false);

  /* ── 환자 차트 사이드 패널 ── */
  const [showChartPanel, setShowChartPanel] = useState(false);

  /* ── 추가 질문 세트 전송 ── */
  const [showQSetPicker, setShowQSetPicker] = useState(false);
  const [selectedQSetId, setSelectedQSetId] = useState<string | null>(null);
  const [expandedQSetMsgs, setExpandedQSetMsgs] = useState<Set<string>>(new Set());

  /* ── 환자 답변 상태 ── */
  // 답변 완료된 원본 질문 메시지 id
  const [answeredQSetMsgIds, setAnsweredQSetMsgIds] = useState<Set<string>>(new Set());
  // 메시지 id → 답변 배열 (질문 index 순)
  const [qSetAnswers, setQSetAnswers] = useState<Record<string, string[]>>({});
  // 답변 폼 상태
  const [answeringMsg, setAnsweringMsg] = useState<{ msgId: string; setId: string } | null>(null);
  const [answerDraft, setAnswerDraft] = useState<string[]>([]);

  const handleQSendClick = () => {
    const set = QUESTIONNAIRE_SETS.find((s) => s.id === selectedQSetId);
    if (!set) return;
    const now = new Date();
    const h = now.getHours(); const m = now.getMinutes();
    const ampm = h < 12 ? "오전" : "오후";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const timeStr = `${ampm} ${h12}:${String(m).padStart(2, "0")}`;
    setMessages((prev) => [...prev, {
      id: `qset-${Date.now()}`,
      sender: "pharmacist",
      content: `[추가질문] ${set.id}`,
      time: timeStr,
      isRead: false,
      sessionId: activeSession,
    }]);
    setShowQSetPicker(false);
    setSelectedQSetId(null);
  };

  const toggleQSetPreview = (msgId: string) => {
    setExpandedQSetMsgs((prev) => {
      const next = new Set(prev);
      next.has(msgId) ? next.delete(msgId) : next.add(msgId);
      return next;
    });
  };

  const openAnswerForm = (msgId: string, setId: string) => {
    const set = QUESTIONNAIRE_SETS.find((s) => s.id === setId);
    if (!set) return;
    let initial = set.questions.map(() => "");
    if (typeof window !== "undefined") {
      try {
        const stored = window.sessionStorage.getItem(`questionnaire-answers-${msgId}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length === set.questions.length) {
            initial = parsed.map((v) => (typeof v === "string" ? v : ""));
          }
        }
      } catch { /* ignore */ }
    }
    setAnsweringMsg({ msgId, setId });
    setAnswerDraft(initial);
  };

  const closeAnswerForm = () => {
    setAnsweringMsg(null);
    setAnswerDraft([]);
  };

  // 답변 중간 저장 — answerDraft 변경 시 sessionStorage에 자동 저장
  useEffect(() => {
    if (!answeringMsg) return;
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(
        `questionnaire-answers-${answeringMsg.msgId}`,
        JSON.stringify(answerDraft)
      );
    } catch { /* ignore */ }
  }, [answeringMsg, answerDraft]);

  const updateAnswerDraft = (idx: number, value: string) => {
    setAnswerDraft((prev) => prev.map((v, i) => (i === idx ? value : v)));
  };

  const toggleMultiAnswer = (idx: number, choice: string) => {
    setAnswerDraft((prev) => prev.map((v, i) => {
      if (i !== idx) return v;
      const cur = v ? v.split(",").filter(Boolean) : [];
      const has = cur.includes(choice);
      const next = has ? cur.filter((c) => c !== choice) : [...cur, choice];
      return next.join(",");
    }));
  };

  const submitAnswer = () => {
    if (!answeringMsg) return;
    const { msgId, setId } = answeringMsg;
    setAnsweredQSetMsgIds((prev) => { const next = new Set(prev); next.add(msgId); return next; });
    setQSetAnswers((prev) => ({ ...prev, [msgId]: [...answerDraft] }));
    if (typeof window !== "undefined") {
      try { window.sessionStorage.removeItem(`questionnaire-answers-${msgId}`); } catch { /* ignore */ }
    }

    const now = new Date();
    const h = now.getHours(); const m = now.getMinutes();
    const ampm = h < 12 ? "오전" : "오후";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const timeStr = `${ampm} ${h12}:${String(m).padStart(2, "0")}`;
    setMessages((prev) => [...prev, {
      id: `qans-${Date.now()}`,
      sender: "patient",
      content: `[추가질문답변] ${setId}::${msgId}`,
      time: timeStr,
      isRead: false,
      sessionId: activeSession,
    }]);
    closeAnswerForm();
  };

  /* ── 환자 23문항 전체 보기 패널 (약사 측 pending UI [전체 보기 →]) ── */
  const [showQuestionnairePanel, setShowQuestionnairePanel] = useState(false);

  /* ── 방문전 리포트 패널 ── */
  const [showReportPanel, setShowReportPanel] = useState(false);
  const [rptNutritionEnabled, setRptNutritionEnabled] = useState(true);
  const [rptNutrition, setRptNutrition] = useState<RptNutrition[]>(RPT_NUTRITION_INIT);
  const [rptNutritionEtc, setRptNutritionEtc] = useState(false);
  const [rptNutritionEtcText, setRptNutritionEtcText] = useState("");
  const [rptLifestyle, setRptLifestyle] = useState<RptLifestyleCategory[]>(RPT_LIFESTYLE_INIT);
  const [rptLifestyleEtcTexts, setRptLifestyleEtcTexts] = useState<Record<string, string>>({});
  const [rptLifestyleEtc, setRptLifestyleEtc] = useState(false);
  const [rptLifestyleEtcItems, setRptLifestyleEtcItems] = useState<string[]>([""]);
  const [rptComment, setRptComment] = useState("");
  const [rptShowConfirm, setRptShowConfirm] = useState(false);
  const [rptSent, setRptSent] = useState(false);
  /** 전송 직후 3.5초간만 상단 뱃지 노출 (버튼 disabled 상태는 rptSent로 유지) */
  const [rptBadgeVisible, setRptBadgeVisible] = useState(false);
  /** 하단 자동 포함 안내 문구 (편집 가능) */
  const [rptAutoText, setRptAutoText] = useState("약국 방문 시 체질에 맞는 제품과 용량을 안내해드릴게요.");

  const rptToggleNutrition = (id: string) =>
    setRptNutrition((prev) => prev.map((n) => n.id === id ? { ...n, checked: !n.checked } : n));
  const rptToggleLifestyle = (id: string) =>
    setRptLifestyle((prev) => prev.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c)));
  const rptToggleLifestyleItem = (catId: string, itemIdx: number) =>
    setRptLifestyle((prev) => prev.map((c) =>
      c.id === catId ? { ...c, items: c.items.map((it, i) => i === itemIdx ? { ...it, checked: !it.checked } : it) } : c));
  const rptAddLifestyleEtcItem = () => setRptLifestyleEtcItems((prev) => [...prev, ""]);
  const rptUpdateLifestyleEtcItem = (idx: number, val: string) =>
    setRptLifestyleEtcItems((prev) => prev.map((v, i) => (i === idx ? val : v)));
  const rptRemoveLifestyleEtcItem = (idx: number) =>
    setRptLifestyleEtcItems((prev) => prev.filter((_, i) => i !== idx));

  const handleReportBtnClick = () => {
    // 모든 화면 크기에서 사이드 패널을 연다 (모바일은 전체 화면 오버레이로 확장)
    setShowReportPanel((prev) => !prev);
  };

  const handleRptSend = () => {
    setRptShowConfirm(false);
    setRptSent(true);
    setRptBadgeVisible(true);
    setTimeout(() => setRptBadgeVisible(false), 3500);
  };

  const getNowTimeStr = () => {
    const now = new Date();
    const h = now.getHours(); const m = now.getMinutes();
    const ampm = h < 12 ? "오전" : "오후";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${ampm} ${h12}:${String(m).padStart(2, "0")}`;
  };

  const handleVisitBtnClick = () => {
    setShowVisitPanel(true);
  };

  const sendVisitGuide = () => {
    if (!visitDate) return;
    // 기존 방문 안내가 있으면 취소 처리
    if (activeVisitMsgId) {
      setCancelledVisitIds(prev => new Set(prev).add(activeVisitMsgId));
    }
    const ts = visitTimeSlot === "직접 입력" ? (visitCustomTime || "오전") : visitTimeSlot;
    const guide: VisitGuide = { date: visitDate, timeSlot: ts, memo: visitMemo };
    setVisitGuide(guide);
    setShowVisitPanel(false);
    const timeStr = getNowTimeStr();
    const newId = `visit-${Date.now()}`;
    setActiveVisitMsgId(newId);
    setMessages(prev => [...prev, {
      id: newId, sender: role, time: timeStr, isRead: true,
      content: `[방문안내] ${formatVisitDate(visitDate)}\n${ts}${visitMemo ? `\n${visitMemo}` : ""}`,
      sessionId: activeSession,
    }]);
  };

  const handleReschedule = () => {
    if (!rescheduleDate) return;
    setShowReschedule(false);
    const timeStr = getNowTimeStr();
    const [, rm, rd] = rescheduleDate.split("-").map(Number);
    const rts = rescheduleTimeSlot === "직접 입력" ? (rescheduleCustomTime || "오전") : rescheduleTimeSlot;
    setMessages(prev => [...prev, {
      id: `resched-${Date.now()}`, sender: "patient", time: timeStr, isRead: false,
      content: `[시스템] ${rm}월 ${rd}일 ${rts}(으)로 일정 변경을 요청했습니다.`,
      sessionId: activeSession,
    }]);
    if (visitGuide) setVisitGuide({ ...visitGuide, date: rescheduleDate, timeSlot: rts });
    setRescheduleDate("");
    setRescheduleTimeSlot("오전");
    setRescheduleCustomTime("");
  };

  const handleDeclineVisit = () => {
    const timeStr = getNowTimeStr();
    setMessages(prev => [...prev, {
      id: `decline-${Date.now()}`, sender: "patient", time: timeStr, isRead: false,
      content: `[시스템] 일정을 취소했습니다. 다음에 다시 예약해주세요.`,
      sessionId: activeSession,
    }]);
    setVisitGuide(null);
    setActiveVisitMsgId(null);
  };

  const calcFollowUpDate = (interval: string): string => {
    const d = new Date();
    if (interval === "1w") d.setDate(d.getDate() + 7);
    else if (interval === "2w") d.setDate(d.getDate() + 14);
    else if (interval === "1m") d.setMonth(d.getMonth() + 1);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  };

  const getEffectiveFuTime = (): string => {
    if (fuTime === "직접 입력") {
      const [hh, mm] = fuCustomTime.split(":").map(Number);
      const ampm = hh < 12 ? "오전" : "오후";
      const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
      return mm === 0 ? `${ampm} ${h12}시` : `${ampm} ${h12}시 ${mm}분`;
    }
    return fuTime;
  };

  const confirmFollowUp = () => {
    const date = fuInterval === "custom" ? fuCustomDate.replace(/-/g, ".") : calcFollowUpDate(fuInterval);
    if (!date) return;
    const effectiveTime = getEffectiveFuTime();
    setFollowUp({ date, time: effectiveTime, message: fuMessage });
    setShowFollowUpPanel(false);
    // 시스템 메시지 추가
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours < 12 ? "오전" : "오후";
    const h = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    const timeStr = `${ampm} ${h}:${String(minutes).padStart(2, "0")}`;
    const sysMsg: Message = {
      id: `fu-${Date.now()}`,
      sender: "pharmacist",
      content: `[시스템] 팔로업이 설정되었습니다 (${formatFollowUpLabel(date)} ${effectiveTime})`,
      time: timeStr,
      isRead: true,
      sessionId: activeSession,
      pharmacistOnly: true,
    };
    setMessages((prev) => [...prev, sysMsg]);
  };

  const cancelFollowUp = () => {
    setFollowUp(null);
    setShowCancelConfirm(false);
    const timeStr = getNowTimeStr();
    setMessages((prev) => [...prev, {
      id: `fu-cancel-${Date.now()}`,
      sender: "pharmacist",
      content: "[시스템] 팔로업이 취소되었습니다",
      time: timeStr,
      isRead: true,
      sessionId: activeSession,
      pharmacistOnly: true,
    }]);
  };

  // Scroll to bottom on messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  /* ── DB 채팅: consultation + 메시지 로드 + Realtime 구독 ── */
  useEffect(() => {
    if (!isDbConsultation) return;
    if (authLoading) return;

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      setDbLoading(true);
      setDbError(null);

      // 1) consultation + 양쪽 profile JOIN — 한 번의 쿼리로 환자/약사 표시 이름까지 확보.
      //    예전엔 consultation SELECT → setDbConsultation → 별도 profiles fetch 순이라
      //    첫 렌더 시점에 dbCounterpartName 이 null 이었고, 헤더/액션박스의 이름이 폴백으로 표시됨.
      //    JOIN 결과를 한 번에 받아 setDbCounterpartName 까지 같은 await 사이클에 처리해
      //    첫 렌더부터 정상 이름이 표시되도록 함.
      const consResp = await supabase
        .from("consultations")
        .select(
          `
          patient_id, pharmacist_id, status, questionnaire_id,
          patient:profiles!consultations_patient_id_fkey(name, avatar_url),
          pharmacist:profiles!consultations_pharmacist_id_fkey(name, avatar_url)
        `,
        )
        .eq("id", chatId)
        .maybeSingle<{
          patient_id: string;
          pharmacist_id: string | null;
          status: string | null;
          questionnaire_id: string | null;
          patient: { name: string | null; avatar_url: string | null } | null;
          pharmacist: { name: string | null; avatar_url: string | null } | null;
        }>();
      if (cancelled) return;
      if (consResp.error || !consResp.data) {
        console.error("[chat] consultation fetch failed:", consResp.error);
        setDbError("상담을 불러오지 못했어요.");
        setDbLoading(false);
        return;
      }
      const cons = consResp.data;
      // dbConsultation state 에는 row 본체만 — JOIN 결과는 별도 setter 로 처리
      setDbConsultation({
        patient_id: cons.patient_id,
        pharmacist_id: cons.pharmacist_id,
        status: cons.status,
        questionnaire_id: cons.questionnaire_id,
      });

      // 1.2) 상대방 표시 이름/아바타 — JOIN 결과에서 즉시 추출해 첫 렌더부터 표시.
      //      role==='patient' 인 경우 약사 license_name + pharmacy_name 은 별도 테이블이라
      //      추가 fetch 유지.
      if (user) {
        const counterpartIsPharmacist = user.id === cons.patient_id;
        const counterpartProf = counterpartIsPharmacist ? cons.pharmacist : cons.patient;
        if (!cancelled) {
          setDbCounterpartName(counterpartProf?.name?.trim() || null);
          setDbCounterpartAvatarUrl(counterpartProf?.avatar_url?.trim() || null);
        }
        const counterpartId =
          user.id === cons.patient_id ? cons.pharmacist_id : cons.patient_id;
        if (counterpartId && counterpartIsPharmacist) {
          const ppResp = await supabase
            .from("pharmacist_profiles")
            .select("license_name, pharmacy_name")
            .eq("id", counterpartId)
            .maybeSingle<{ license_name: string | null; pharmacy_name: string | null }>();
          if (!cancelled) {
            if (ppResp.error) {
              console.error("[chat] counterpart pharmacist_profiles fetch failed:", ppResp.error);
            }
            setDbCounterpartLicenseName(ppResp.data?.license_name?.trim() || null);
            setDbCounterpartPharmacy(ppResp.data?.pharmacy_name?.trim() || null);
          }
        }
      }

      // 1.5) consultation_rounds 로드 — 차수 탭 + 메시지 필터용
      const roundsResp = await supabase
        .from("consultation_rounds")
        .select("id, round_number, questionnaire_id, started_at, ended_at, status")
        .eq("consultation_id", chatId)
        .order("round_number", { ascending: true });
      if (cancelled) return;
      let loadedRounds: DbRound[] = [];
      if (roundsResp.error) {
        console.error("[chat] consultation_rounds load failed:", roundsResp.error);
      } else {
        loadedRounds = ((roundsResp.data ?? []) as unknown) as DbRound[];
      }
      setRounds(loadedRounds);
      // 활성 차수 기본값 = 가장 최근 round (round_number 가 가장 큼). rounds 가 빈 배열이면 null → 통합 뷰 폴백
      const latestRoundId = loadedRounds.length > 0 ? loadedRounds[loadedRounds.length - 1].id : null;
      setActiveRoundId(latestRoundId);

      // 1.6) ai_questionnaires 콘텐츠 IN 쿼리 — 차수별 박스 렌더용
      const qIds = Array.from(
        new Set(
          loadedRounds
            .map((r) => r.questionnaire_id)
            .filter((id): id is string => !!id),
        ),
      );
      if (qIds.length > 0) {
        const qResp = await supabase
          .from("ai_questionnaires")
          .select("id, symptoms, ai_summary, free_text, completed_at")
          .in("id", qIds);
        if (!cancelled) {
          if (qResp.error) {
            // RLS 에러 가능성 — ai_questionnaires SELECT 정책이 환자/약사 본인 row 허용하는지 확인 필요
            console.error("[chat] ai_questionnaires load failed:", qResp.error);
          } else {
            const map = new Map<string, QuestionnaireContent>();
            for (const q of (qResp.data ?? []) as Array<
              { id: string } & QuestionnaireContent
            >) {
              map.set(q.id, {
                symptoms: q.symptoms,
                ai_summary: q.ai_summary,
                free_text: q.free_text,
                completed_at: q.completed_at,
              });
            }
            setQuestionnaireById(map);
          }
        }
      }

      const mapRow = (row: DbMessageRow): Message => ({
        id: row.id,
        sender: row.sender_id === cons.patient_id ? "patient" : "pharmacist",
        content: row.content,
        time: fmtChatTime(row.created_at),
        isRead: row.is_read,
        round_id: row.round_id ?? null,
        message_type: row.message_type,
        created_at: row.created_at,
      });

      // 상대방이 보낸 미읽음 메시지 일괄 읽음 처리
      //  - DB: messages.is_read=true, read_at=NOW()
      //  - 로컬 state: 상대방 sender 의 isRead 를 true 로 동기화 (채팅 목록 unread 배지 즉시 0)
      //  - 에러는 console.error 만 (사용자 노출 X)
      const markCounterpartRead = async (): Promise<void> => {
        if (!user) return;
        const upResp = await (supabase
          .from("messages") as unknown as {
            update: (p: { is_read: boolean; read_at: string }) => {
              eq: (col: string, val: string) => {
                neq: (col: string, val: string) => {
                  eq: (col: string, val: boolean) => Promise<{ error: { message: string } | null }>;
                };
              };
            };
          })
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq("consultation_id", chatId)
          .neq("sender_id", user.id)
          .eq("is_read", false);
        if (upResp.error) {
          console.error("[chat] mark-read UPDATE failed:", upResp.error);
          return;
        }
        if (cancelled) return;
        const counterpartRole: "patient" | "pharmacist" =
          user.id === cons.patient_id ? "pharmacist" : "patient";
        setMessages((prev) =>
          prev.map((m) =>
            m.sender === counterpartRole && !m.isRead ? { ...m, isRead: true } : m,
          ),
        );
      };

      // 2) 기존 메시지 로드 (round_id 포함)
      const msgResp = await supabase
        .from("messages")
        .select("id, consultation_id, sender_id, content, message_type, is_read, created_at, round_id")
        .eq("consultation_id", chatId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (msgResp.error) {
        console.error("[chat] messages load failed:", msgResp.error);
        setDbError("메시지를 불러오지 못했어요.");
        setDbLoading(false);
        return;
      }
      const rows = (msgResp.data ?? []) as unknown as DbMessageRow[];
      setMessages(rows.map(mapRow));
      setDbLoading(false);

      // 2.5) 진입 시점에 상대방 미읽음 메시지 읽음 처리
      void markCounterpartRead();

      // 3) Realtime 구독
      channel = supabase
        .channel(`consult:${chatId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `consultation_id=eq.${chatId}`,
          },
          (payload) => {
            const row = payload.new as DbMessageRow;
            setMessages((prev) => {
              if (prev.some((m) => m.id === row.id)) return prev; // 옵티미스틱 중복 방지
              return [...prev, mapRow(row)];
            });
            // [ROUND_START] 가 realtime 으로 도착 = 약사가 방금 수락한 시점.
            //   consultation.status 를 'accepted' 로 로컬 갱신 → 수락 대기 잠금 해제.
            //   (초기 로드된 legacy [ROUND_START] 는 이 콜백을 통하지 않으므로 영향 없음.)
            if (row.content === "[ROUND_START]") {
              setDbConsultation((prev) =>
                prev && prev.status === "pending"
                  ? { ...prev, status: "accepted" }
                  : prev,
              );
            }
            // [CONSULT_REJECTED] 가 realtime 으로 도착 = 약사가 방금 거절한 시점.
            //   consultation.status 를 'rejected' 로 로컬 갱신 → 환자 측 거절 안내 카드 자동 노출.
            //   약사 본인은 이미 /dashboard 로 라우팅되어 이 콜백 영향 없음.
            if (row.content === "[CONSULT_REJECTED]") {
              setDbConsultation((prev) =>
                prev && prev.status === "pending"
                  ? { ...prev, status: "rejected" }
                  : prev,
              );
            }
            // 상대방이 보낸 메시지면 즉시 읽음 처리 (채팅방 열려있는 동안 배지 누적 방지)
            if (user && row.sender_id !== user.id) {
              void markCounterpartRead();
            }
          },
        )
        // consultations UPDATE 구독 — status 변경(수락/거절/종료 등) 직접 감지.
        //   messages INSERT echo 가 RLS race 로 누락되어도 status 자동 갱신 보장 → 환자 측 거절 안내 카드 즉시 노출.
        //   환자/약사 양쪽 모두 동작; 약사는 거절 직후 /dashboard 로 떠나므로 영향 미미하지만 무해.
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "consultations",
            filter: `id=eq.${chatId}`,
          },
          (payload) => {
            const newRow = payload.new as {
              patient_id: string;
              pharmacist_id: string | null;
              status: string | null;
              questionnaire_id: string | null;
            };
            setDbConsultation((prev) =>
              prev
                ? {
                    patient_id: newRow.patient_id ?? prev.patient_id,
                    pharmacist_id: newRow.pharmacist_id,
                    status: newRow.status,
                    questionnaire_id: newRow.questionnaire_id,
                  }
                : prev,
            );
          },
        )
        .subscribe(() => {});
    })();

    return () => {
      cancelled = true;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [isDbConsultation, chatId, user?.id, authLoading]);

  /* ── 약사 측 pending 환자 정보 fetch ──
   * pending 시점엔 consultation_rounds 가 없어 위의 rounds 기반 ai_questionnaires
   * IN 쿼리(L818-849 부근)가 skip 됨. 약사가 수락/거절 결정을 위해서는 환자 문답이
   * 필요하므로 consultations.questionnaire_id 로 단일 row 를 별도 fetch.
   * accepted 전환 후엔 rounds 기반 questionnaireById 가 데이터 소스라 이 effect 는
   * 더 이상 트리거되지 않음(상호 충돌 없음).
   */
  useEffect(() => {
    if (role !== "pharmacist") {
      return;
    }
    if (!isDbConsultation) {
      return;
    }
    if (!dbConsultation) {
      return;
    }
    if (dbConsultation.status !== "pending") {
      return;
    }
    if (!dbConsultation.questionnaire_id) {
      return;
    }
    const qid = dbConsultation.questionnaire_id;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("ai_questionnaires")
        .select("symptoms, symptom_duration, severity, free_text, ai_summary, detailed_answers")
        .eq("id", qid)
        .maybeSingle<{
          symptoms: string[] | null;
          symptom_duration: string | null;
          severity: string | null;
          free_text: string | null;
          ai_summary: string | null;
          detailed_answers: Record<string, unknown> | null;
        }>();
      if (cancelled) return;
      if (error) {
        console.error("[chat-pharm-pending] questionnaire fetch failed:", error);
        return;
      }
      setPendingQuestionnaire(data);
    })();
    return () => { cancelled = true; };
  }, [role, isDbConsultation, dbConsultation]);

  /* ── 환자 측 상담 종료 ──
   * 헬퍼로 분리해 추후 약사 측 동일 액션에서 재사용 가능하게 함.
   *  1) consultations.status='completed' + completed_at=now() UPDATE
   *  2) messages 시스템 메시지 INSERT (sender 역할 라벨로 약사 측에도 명확히 노출)
   *  3) /mypage 로 이동
   */
  const endConsultation = async (
    actorRole: "patient" | "pharmacist",
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!isDbConsultation) {
      return { ok: false, error: "DB 상담이 아닙니다" };
    }
    if (!user) {
      return { ok: false, error: "로그인이 필요해요" };
    }
    type ConsUpdate = { status: string; completed_at: string };
    const upPayload: ConsUpdate = {
      status: "completed",
      completed_at: new Date().toISOString(),
    };
    const upResp = await (supabase
      .from("consultations") as unknown as {
        update: (p: ConsUpdate) => {
          eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
        };
      })
      .update(upPayload)
      .eq("id", chatId);
    if (upResp.error) {
      console.error("[chat] end-consultation UPDATE failed:", upResp.error);
      return { ok: false, error: upResp.error.message };
    }
    // 1) 종료 안내 메시지 INSERT 먼저 (작별 인사/시스템 알림이 위에, 회차 종료 구분자가 아래에 표시되도록).
    //    actorRole 별로 의미가 달라 분기:
    //      환자 종료 → 시스템 알림 (가운데 박스, is_read=true)
    //      약사 종료 → 환자에게 보내는 작별 인사 (약사 메시지 버블, is_read=false 로 환자 목록 unread 표시)
    if (actorRole === "patient") {
      const sysPayload: MessageInsert = {
        consultation_id: chatId,
        sender_id: user.id,
        content: "환자가 상담을 종료했습니다",
        message_type: "system",
        round_id: activeRoundId,
        is_read: true,
      };
      const msgResp = await (supabase
        .from("messages") as unknown as {
          insert: (p: MessageInsert) => Promise<{ error: { message: string } | null }>;
        })
        .insert(sysPayload);
      if (msgResp.error) {
        console.warn("[chat] end-consultation system message INSERT failed (UPDATE 는 성공):", msgResp.error);
      }
    } else {
      const farewellPayload: MessageInsert = {
        consultation_id: chatId,
        sender_id: user.id,
        content:
          "이번 상담은 여기서 마무리할게요. 또 궁금한 점이 생기면 언제든 상담 요청 해주세요 :)",
        message_type: "text",
        round_id: activeRoundId,
        is_read: false,
      };
      const msgResp = await (supabase
        .from("messages") as unknown as {
          insert: (p: MessageInsert) => Promise<{ error: { message: string } | null }>;
        })
        .insert(farewellPayload);
      if (msgResp.error) {
        console.warn("[chat] end-consultation farewell INSERT failed (UPDATE 는 성공):", msgResp.error);
      }
    }
    // 2) 회차 종료 구분자 시스템 메시지 — [ROUND_END] 마커. is_read=true 로 unread 제외.
    //    위 작별 인사/시스템 알림이 먼저 INSERT 됐으므로 created_at 순서상 구분자가 마지막에 표시됨.
    if (activeRoundId) {
      const dividerPayload: MessageInsert = {
        consultation_id: chatId,
        sender_id: user.id,
        content: "[ROUND_END]",
        message_type: "system",
        round_id: activeRoundId,
        is_read: true,
      };
      const dividerResp = await (supabase
        .from("messages") as unknown as {
          insert: (p: MessageInsert) => Promise<{ error: { message: string } | null }>;
        })
        .insert(dividerPayload);
      if (dividerResp.error) {
        console.warn("[chat] end-consultation round divider INSERT failed:", dividerResp.error);
      }
    }
    // 3) consultation_rounds.status='completed' + ended_at=NOW() UPDATE.
    //    이 호출이 빠져 있으면 다음 매칭 시 새 round 생성이 (DB 제약/스키마에 따라) 실패할 수 있음.
    //    activeRoundId 가 없으면 (옛 데이터) 스킵 — 멱등성 유지.
    if (activeRoundId) {
      type RoundUpdate = { status: string; ended_at: string };
      const roundUpPayload: RoundUpdate = {
        status: "completed",
        ended_at: new Date().toISOString(),
      };
      const roundUpResp = await (supabase
        .from("consultation_rounds") as unknown as {
          update: (p: RoundUpdate) => {
            eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
          };
        })
        .update(roundUpPayload)
        .eq("id", activeRoundId);
      if (roundUpResp.error) {
        console.warn("[chat] consultation_rounds end UPDATE failed:", roundUpResp.error);
      }
    }
    return { ok: true };
  };

  const handlePatientEndClick = () => {
    setEndError(null);
    setShowEndConfirm(true);
  };
  const confirmPatientEnd = async () => {
    if (endingConsult) return;
    setEndingConsult(true);
    setEndError(null);
    const result = await endConsultation("patient");
    setEndingConsult(false);
    if (!result.ok) {
      setEndError(result.error || "상담 종료에 실패했어요");
      return;
    }
    setShowEndConfirm(false);
    // 로컬 state 도 즉시 갱신 (입력창 잠금 즉시 반영, /mypage 이동 전 깜빡임 방지)
    setDbConsultation((prev) => (prev ? { ...prev, status: "completed" } : prev));
    router.push("/mypage");
  };

  /* ── 약사 측 상담 종료 ──
   * 환자 측 핸들러와 동일 모달(showEndConfirm) 재사용.
   * endConsultation 헬퍼 호출, 종료 후 /dashboard 로 라우팅.
   */
  const handlePharmacistEndClick = () => {
    setEndError(null);
    setShowEndConfirm(true);
  };
  const confirmPharmacistEnd = async () => {
    if (endingConsult) return;
    setEndingConsult(true);
    setEndError(null);
    const result = await endConsultation("pharmacist");
    setEndingConsult(false);
    if (!result.ok) {
      setEndError(result.error || "상담 종료에 실패했어요");
      return;
    }
    setShowEndConfirm(false);
    setDbConsultation((prev) => (prev ? { ...prev, status: "completed" } : prev));
    router.push("/dashboard");
  };

  /* ── 약사 측 상담 요청 거절 ──
   * pending 상태 consultation 에 대해 status='rejected' UPDATE + 거절 사유 기록.
   * UPDATE 성공 후 [CONSULT_REJECTED] 시스템 메시지 INSERT — 환자 측 realtime 이
   * 이 메시지를 받아 로컬 status='rejected' 로 갱신, 거절 안내 카드 자동 노출.
   * 거절 사유는 메시지 content 에 절대 담지 않음 (환자 노출 금지).
   */
  const rejectConsultation = async () => {
    if (rejecting) return;
    if (!isDbConsultation) {
      setRejectError("DB 상담이 아닙니다");
      return;
    }
    if (!user) {
      setRejectError("로그인이 필요해요");
      return;
    }
    if (!rejectReason) {
      setRejectError("사유를 선택해 주세요");
      return;
    }
    setRejecting(true);
    setRejectError(null);
    type ConsRejectUpdate = {
      status: string;
      rejected_reason: string;
      rejected_at: string;
      pharmacist_id: string;
    };
    const upPayload: ConsRejectUpdate = {
      status: "rejected",
      rejected_reason: rejectReason,
      rejected_at: new Date().toISOString(),
      pharmacist_id: user.id,
    };
    const upResp = await (supabase
      .from("consultations") as unknown as {
        update: (p: ConsRejectUpdate) => {
          eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
        };
      })
      .update(upPayload)
      .eq("id", chatId);
    if (upResp.error) {
      setRejecting(false);
      console.error("[chat] reject UPDATE failed:", upResp.error);
      setRejectError(upResp.error.message || "거절 처리에 실패했어요");
      return;
    }
    // 시스템 메시지 INSERT — 환자 측 realtime trigger. 실패해도 UPDATE 는 성공이므로 라우팅은 그대로 진행.
    const rejectMsgPayload: MessageInsert = {
      consultation_id: chatId,
      sender_id: user.id,
      content: "[CONSULT_REJECTED]",
      message_type: "system",
      is_read: true,
    };
    const msgResp = await (supabase
      .from("messages") as unknown as {
        insert: (p: MessageInsert) => Promise<{ error: { message: string } | null }>;
      })
      .insert(rejectMsgPayload);
    if (msgResp.error) {
      console.error("[chat] reject system message INSERT failed (UPDATE 는 성공):", msgResp.error);
    }
    setRejecting(false);
    setShowRejectConfirm(false);
    setDbConsultation((prev) => (prev ? { ...prev, status: "rejected" } : prev));
    router.push("/dashboard");
  };

  /* ── 약사 측 상담 요청 수락 ──
   * pending 상태 consultation 에 대해:
   *  (a) consultations.status='accepted' + pharmacist_id=본인 UPDATE
   *  (b) max(round_number)+1 계산 (consultation_rounds)
   *  (c) consultation_rounds INSERT (status='active') → 새 round id 확보
   *  (d) [ROUND_START] 시스템 메시지 INSERT (round_id=새 round)
   * 다른 환자 상담 자동 종료 없음 — 비즈니스 룰상 약사 1명이 여러 환자 동시 상담 가능.
   * 성공 시 채팅방 유지 (router push 없음). status='accepted' 로 로컬 갱신되면
   * 수락 대기 잠금 해제 + [ROUND_START] divider 가 메시지 리스트에 자동 노출.
   */
  const acceptConsultation = async () => {
    if (accepting) return;
    if (!isDbConsultation) {
      setAcceptError("DB 상담이 아닙니다");
      return;
    }
    if (!user) {
      setAcceptError("로그인이 필요해요");
      return;
    }
    setAccepting(true);
    setAcceptError(null);

    // (a) consultations UPDATE
    type ConsAcceptUpdate = { status: string; pharmacist_id: string };
    const upPayload: ConsAcceptUpdate = {
      status: "accepted",
      pharmacist_id: user.id,
    };
    const upResp = await (supabase
      .from("consultations") as unknown as {
        update: (p: ConsAcceptUpdate) => {
          eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
        };
      })
      .update(upPayload)
      .eq("id", chatId);
    if (upResp.error) {
      setAccepting(false);
      console.error("[chat] accept consultations UPDATE failed:", upResp.error);
      setAcceptError(upResp.error.message || "수락 처리에 실패했어요");
      return;
    }

    // (b) max(round_number) 조회
    const maxResp = await supabase
      .from("consultation_rounds")
      .select("round_number")
      .eq("consultation_id", chatId)
      .order("round_number", { ascending: false })
      .limit(1)
      .maybeSingle<{ round_number: number }>();
    if (maxResp.error) {
      console.error("[chat] accept max round_number lookup failed:", maxResp.error);
    }
    const nextRoundNumber =
      typeof maxResp.data?.round_number === "number"
        ? maxResp.data.round_number + 1
        : 1;

    // (c) consultation_rounds INSERT
    type RoundInsert = {
      consultation_id: string;
      round_number: number;
      questionnaire_id: string | null;
      status: string;
      started_at: string;
    };
    const roundPayload: RoundInsert = {
      consultation_id: chatId,
      round_number: nextRoundNumber,
      questionnaire_id: dbConsultation?.questionnaire_id ?? null,
      status: "active",
      started_at: new Date().toISOString(),
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
      setAccepting(false);
      console.error("[chat] accept round insert failed:", roundResp.error);
      setAcceptError(roundResp.error?.message || "회차 생성에 실패했어요");
      return;
    }
    const newRoundId = roundResp.data.id;

    // (d) [ROUND_START] 시스템 메시지 INSERT
    const sysPayload: MessageInsert = {
      consultation_id: chatId,
      sender_id: user.id,
      content: "[ROUND_START]",
      message_type: "system",
      is_read: true,
      round_id: newRoundId,
    };
    const sysResp = await (supabase
      .from("messages") as unknown as {
        insert: (p: MessageInsert) => {
          select: (cols: string) => {
            maybeSingle: () => Promise<{
              data: { id: string; created_at: string } | null;
              error: { message: string } | null;
            }>;
          };
        };
      })
      .insert(sysPayload)
      .select("id, created_at")
      .maybeSingle();
    if (sysResp.error) {
      console.error("[chat] accept [ROUND_START] INSERT failed (round 까지는 성공):", sysResp.error);
    }
    // INSERT 결과로 옵티미스틱 append — realtime echo 누락/지연 대응.
    //   realtime 핸들러(1012-1042) 의 id 기반 dedup 으로 echo 도착 시 자동 무시 → 중복 안전.
    //   mapRow 는 SELECT effect closure 내부 로컬 함수라 외부 접근 불가 → Message 객체 직접 생성.
    const insertedSys = sysResp.data;
    if (insertedSys) {
      const optimisticMsg: Message = {
        id: insertedSys.id,
        sender: user.id === dbConsultation?.patient_id ? "patient" : "pharmacist",
        content: "[ROUND_START]",
        time: fmtChatTime(insertedSys.created_at),
        isRead: true,
        round_id: newRoundId,
        message_type: "system",
        created_at: insertedSys.created_at,
      };
      setMessages((prev) =>
        prev.some((m) => m.id === optimisticMsg.id) ? prev : [...prev, optimisticMsg],
      );
    }

    setAccepting(false);
    setShowAcceptConfirm(false);
    // 로컬 state 즉시 갱신 — 수락 대기 잠금 해제, realtime echo 대기 없이 입력란 활성
    setDbConsultation((prev) =>
      prev ? { ...prev, status: "accepted", pharmacist_id: user.id } : prev,
    );
    // 신규 round / questionnaire state 즉시 동기화 — SELECT effect 재실행 없이 "현재 차수" 박스 렌더.
    //   필드 구성은 SELECT effect 1.5단계 (884-897) 의 DbRound row 구조와 동일.
    const newRound: DbRound = {
      id: newRoundId,
      round_number: nextRoundNumber,
      questionnaire_id: dbConsultation?.questionnaire_id ?? null,
      started_at: roundPayload.started_at,
      ended_at: null,
      status: "active",
    };
    setRounds((prev) => [...prev, newRound]);
    setActiveRoundId(newRoundId);
    // questionnaireById 갱신: 이미 약사 측 pending UI 에서 fetch 한 pendingQuestionnaire 재활용.
    //   QuestionnaireContent 필드 중 completed_at 만 누락이지만 렌더(2002-2014) 에서 미사용 → null.
    //   pendingQuestionnaire 가 null 인 race 케이스는 skip — 채팅방 재진입 시 SELECT effect 가 채움.
    const qId = dbConsultation?.questionnaire_id ?? null;
    if (qId && pendingQuestionnaire) {
      const pq = pendingQuestionnaire;
      setQuestionnaireById((prev) => {
        const next = new Map(prev);
        next.set(qId, {
          symptoms: pq.symptoms,
          ai_summary: pq.ai_summary,
          free_text: pq.free_text,
          completed_at: null,
        });
        return next;
      });
    }
  };

  /* 약사 측 [수락] 버튼 클릭 — 본인 진행 중 active round 가 있으면 안내 모달, 없으면 곧장 acceptConsultation. */
  const handleAcceptClick = async () => {
    if (accepting) return;
    setShowQuestionnairePanel(false);
    setAcceptError(null);
    if (!user) {
      // 로그인 안 된 상태에서도 모달로 통일 — acceptConsultation 안에서 다시 가드.
      setPendingActiveCount(0);
      setShowAcceptConfirm(true);
      return;
    }
    // 본인 명의의 다른 active round 개수 조회 — 현재 consultation 은 아직 pending 이라 제외 불필요하나 안전 차원에서 .neq.
    const countResp = await supabase
      .from("consultation_rounds")
      .select("id, consultation_id, consultations!inner(pharmacist_id)", { count: "exact", head: true })
      .eq("status", "active")
      .eq("consultations.pharmacist_id", user.id)
      .neq("consultation_id", chatId);
    if (countResp.error) {
      console.error("[chat] accept active-round count failed:", countResp.error);
      // 방어적으로 모달 표시 (count=0 로 두고 사용자가 직접 결정).
      setPendingActiveCount(0);
      setShowAcceptConfirm(true);
      return;
    }
    const count = countResp.count ?? 0;
    setPendingActiveCount(count);
    if (count > 0) {
      setShowAcceptConfirm(true);
      return;
    }
    // 진행 중 상담 없음 — 모달 없이 곧장 수락.
    await acceptConsultation();
  };

  /* 거절 상태 — 약사가 pending 요청을 거절하면 status='rejected'. 환자 측 안내 박스 분기용. */
  const consultationRejected =
    isDbConsultation &&
    !!dbConsultation &&
    dbConsultation.status === "rejected";
  /* 종료 잠금 판정 — DB 모드에서 status가 completed/cancelled/rejected 면 입력 차단.
   * 'rejected' 는 안내 박스 문구가 다르므로 consultationRejected 로 별도 분기. */
  const consultationLocked =
    isDbConsultation &&
    !!dbConsultation &&
    (dbConsultation.status === "completed" ||
      dbConsultation.status === "cancelled" ||
      dbConsultation.status === "rejected");
  /* 수락 대기 잠금 — DB 모드에서 status='pending' 이면 약사 수락 전.
   * 환자가 매칭에서 요청 직후 진입한 채팅방. 약사가 수락하면 realtime 으로
   * [ROUND_START] 메시지가 도착하며 status 도 'accepted' 로 갱신됨 (아래 콜백). */
  const consultationPending =
    isDbConsultation &&
    !!dbConsultation &&
    dbConsultation.status === "pending";
  /* 입력 차단 통합 플래그 — 종료 잠금 또는 수락 대기 둘 다 입력 막음 */
  const inputLocked = consultationLocked || consultationPending;

  const sendMessage = () => {
    const text = input.trim();
    if (!text) return;
    if (inputLocked) {
      console.warn("[chat] input locked — cannot send (status:", dbConsultation?.status, ")");
      return;
    }

    // DB 모드: messages 테이블 INSERT (Realtime echo로 화면 반영)
    if (isDbConsultation) {
      if (!user) {
        console.warn("[chat] not logged in — cannot send");
        return;
      }
      if (!dbConsultation) {
        console.warn("[chat] consultation not loaded yet");
        return;
      }
      const payload: MessageInsert = {
        consultation_id: chatId,
        sender_id: user.id,
        content: text,
        message_type: "text",
        // 활성 차수가 있으면 그 차수에 귀속, 없으면 null (통합 뷰 폴백)
        round_id: activeRoundId,
      };
      setInput("");
      if (inputRef.current) inputRef.current.style.height = "auto";

      (async () => {
        const { data, error } = await (supabase
          .from("messages") as unknown as {
            insert: (p: MessageInsert) => {
              select: (cols: string) => {
                maybeSingle: () => Promise<{
                  data: DbMessageRow | null;
                  error: { message: string; code?: string; details?: string; hint?: string } | null;
                }>;
              };
            };
          })
          .insert(payload)
          .select("id, consultation_id, sender_id, content, message_type, is_read, created_at")
          .maybeSingle();

        if (error) {
          console.error("[chat] message insert failed:", {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
          });
          // 실패 시 입력값 복원
          setInput(text);
          return;
        }
        // Realtime echo가 곧 도착하지만, 즉시 옵티미스틱 추가 (구독 echo는 dedupe됨)
        if (data) {
          const row = data;
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [
              ...prev,
              {
                id: row.id,
                sender:
                  row.sender_id === dbConsultation.patient_id ? "patient" : "pharmacist",
                content: row.content,
                time: fmtChatTime(row.created_at),
                isRead: row.is_read,
              },
            ];
          });
        }
      })();
      return;
    }


    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours < 12 ? "오전" : "오후";
    const h = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    const timeStr = `${ampm} ${h}:${String(minutes).padStart(2, "0")}`;

    const newMsg: Message = {
      id: String(Date.now()),
      sender: role,
      content: text,
      time: timeStr,
      isRead: false,
      sessionId: activeSession,
    };

    setMessages((prev) => [...prev, newMsg]);
    setInput("");

    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey) {
      e.preventDefault();
      sendMessage();
    }
  };


  /* ── 검색 ── */
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchIndex, setSearchIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // DB 모드에서는 세션(차수) 분리가 없으므로 sessionId 필터를 건너뜀
  const visibleMessages = messages.filter((m) =>
    !(m.pharmacistOnly && role !== "pharmacist") &&
    (isDbConsultation || m.sessionId === activeSession),
  );
  const searchResults = debouncedQuery
    ? visibleMessages.filter(
        (m) =>
          !m.content.startsWith("[시스템]") &&
          !m.content.startsWith("[방문안내]") &&
          m.content.toLowerCase().includes(debouncedQuery.toLowerCase()),
      )
    : [];

  const lastPatientMsgId = role === "pharmacist"
    ? (visibleMessages.filter(m => m.sender === "patient" && !m.content.startsWith("[시스템]")).at(-1)?.id ?? null)
    : null;

  useEffect(() => { setSearchIndex(0); }, [debouncedQuery]);

  /* ── AI 답변 초안 (약사 전용) ── */
  const [showAiDraftModal, setShowAiDraftModal] = useState(false);
  const [aiDraftText, setAiDraftText] = useState("");
  const [aiDraftLoading, setAiDraftLoading] = useState(false);
  const [aiDraftPatientMsg, setAiDraftPatientMsg] = useState("");

  /* ── AI 답변 초안 생성 (약사 전용) ── */
  const AI_DRAFT_MAP: Record<string, string> = {
    "비타민": "비타민은 종류에 따라 복용 시간과 용량이 달라요.\n\n비타민D는 지용성이라 식사와 함께 드시는 것이 흡수율이 높고, 비타민B군은 아침 식후에 드시는 것이 좋아요. 현재 드시는 제품의 함량을 확인해봐야 적정 용량을 안내드릴 수 있어요.\n\n약국에 방문하시면 제품 성분을 확인하고 맞춤 가이드를 안내해드릴게요.",
    "마그네슘": "마그네슘은 수면의 질 개선과 근육 이완에 도움이 되는 미네랄이에요.\n\n취침 30분~1시간 전에 복용하시는 것이 좋고, 구연산마그네슘이나 글리시네이트 형태가 흡수율이 높아요. 현재 드시는 제품이 있으시면 약국 방문 시 가져오시면 확인해드릴게요.",
    "종합비타민": "현재 드시는 종합비타민의 성분 함량에 따라 추가로 필요한 영양소가 달라질 수 있어요.\n\n종합비타민은 식후에 드시는 것이 흡수에 좋고, 다른 영양제와의 조합도 중요해요. 약국에 방문하시면 현재 제품 성분을 분석하고 부족한 부분을 안내해드릴게요.",
    "유산균": "유산균은 장 건강의 기본이 되는 영양제예요.\n\n제품에 따라 식전/식후 복용법이 다를 수 있어요. 현재 소화 상태를 고려하면, 장 유형에 맞는 균주를 추천해드릴 수 있어요. 현재 드시는 제품명을 알려주시면 더 정확한 안내가 가능해요.",
    "피로": "만성피로는 여러 원인이 복합적으로 작용하는 경우가 많아요.\n\n비타민B군, 철분, 비타민D 등이 부족하면 피로감이 심해질 수 있어요. 식습관과 수면 패턴도 중요한 요소예요. 약국에 방문하시면 문답 결과를 바탕으로 맞춤 영양 가이드를 안내해드릴게요.",
    "수면": "수면 문제는 마그네슘, 테아닌, GABA 등의 영양소가 도움이 될 수 있어요.\n\n수면 패턴이나 스트레스 수준에 따라 적합한 성분이 달라요. 약국 방문 시 좀 더 자세한 상담을 통해 맞춤 가이드를 안내해드릴게요.",
    "소화": "소화 기능 개선에는 유산균, 소화효소, 식이섬유 등이 도움이 될 수 있어요.\n\n아침 식사를 거르시는 경우 공복 시간이 길어져 소화 기능이 더 약해질 수 있어요. 약국 방문 시 현재 식습관과 증상을 고려한 맞춤 가이드를 안내해드릴게요.",
    "방문": "네, 편하신 시간에 방문해 주세요!\n\n방문하실 때 현재 드시는 영양제가 있으시면 함께 가져오시면 좋겠어요. 제품 성분을 확인하고 체질에 맞는 조합을 안내해드릴게요.",
  };

  const getAiDraftResponse = (question: string): string => {
    const q = question.toLowerCase();
    for (const [keyword, response] of Object.entries(AI_DRAFT_MAP)) {
      if (q.includes(keyword)) return response;
    }
    return "문답 내용을 종합적으로 살펴봤어요.\n\n현재 증상과 생활 패턴을 고려하면, 약국에 방문하셔서 직접 상담을 받으시는 것이 가장 정확한 안내를 드릴 수 있어요. 방문 시 현재 드시는 영양제가 있다면 함께 가져오시면 좋겠어요.\n\n편하신 시간에 방문해 주세요!";
  };

  const openAiDraft = (patientMsg: string) => {
    setAiDraftPatientMsg(patientMsg);
    setShowAiDraftModal(true);
    setAiDraftLoading(true);
    setAiDraftText("");
    setTimeout(() => {
      setAiDraftText(getAiDraftResponse(patientMsg));
      setAiDraftLoading(false);
    }, 1500);
  };

  const sendAiDraft = () => {
    const text = aiDraftText.trim();
    if (!text) return;
    const timeStr = getNowTimeStr();
    const newMsg: Message = {
      id: String(Date.now()),
      sender: "pharmacist",
      content: text,
      time: timeStr,
      isRead: false,
      sessionId: activeSession,
    };
    setMessages((prev) => [...prev, newMsg]);
    setShowAiDraftModal(false);
    setAiDraftText("");
  };

  useEffect(() => {
    if (searchResults.length > 0 && searchResults[searchIndex]) {
      const el = document.getElementById(`msg-${searchResults[searchIndex].id}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [searchIndex, searchResults]);

  const openSearch = () => { setShowSearch(true); setTimeout(() => searchInputRef.current?.focus(), 50); };
  const closeSearch = () => { setShowSearch(false); setSearchQuery(""); setDebouncedQuery(""); setSearchIndex(0); };

  const highlightText = useCallback((text: string) => {
    if (!debouncedQuery) return text;
    const idx = text.toLowerCase().indexOf(debouncedQuery.toLowerCase());
    if (idx === -1) return text;
    const before = text.slice(0, idx);
    const match = text.slice(idx, idx + debouncedQuery.length);
    const after = text.slice(idx + debouncedQuery.length);
    return <>{before}<mark style={{ background: "#FFF3CD", borderRadius: 2, padding: "0 1px" }}>{match}</mark>{after}</>;
  }, [debouncedQuery]);

  return (
    <div className="chat-page" style={{ height: isEmbedded ? "100dvh" : "calc(100dvh - 56px)" }}>
      {isEmbedded && (
        <style>{`
          html, body { margin: 0 !important; padding: 0 !important; }
          body { padding-top: 0 !important; }
          .bnav-mobile-bar, .bnav-mobile-spacer, .dh-wrap { display: none !important; }
          .chat-nav { display: none !important; }
        `}</style>
      )}
      {/* Header */}
      <nav className="chat-nav">
        <button
          className="nav-back"
          onClick={() => router.back()}
          aria-label="뒤로가기"
        >
          ←
        </button>
        <div className="chat-nav-center">
          <div className="chat-avatar">
            {(() => {
              // 아바타 결정: role==='patient' 이면 약사 아바타, role==='pharmacist' 이면 환자 아바타
              // DB 모드 + avatar_url 있으면 <img>, 없으면 폴백:
              //   - 환자가 보는 화면(role=patient): 약사 이모지 👩‍⚕️
              //   - 약사가 보는 화면(role=pharmacist): 환자 SVG (sage-mid 톤, 검은 이모지 회피)
              if (isDbConsultation && dbCounterpartAvatarUrl) {
                // eslint-disable-next-line @next/next/no-img-element
                return (
                  <img
                    src={dbCounterpartAvatarUrl}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                  />
                );
              }
              if (role === "patient") return "👩‍⚕️";
              // 약사 측 폴백: sage-mid 색상의 사용자 SVG (이모지 검정 실루엣 회피)
              return (
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#5E7D6C"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21c0-3.3 3.6-6 8-6s8 2.7 8 6" />
                </svg>
              );
            })()}
          </div>
          <div
            className="chat-nav-info"
            style={{
              // height/flex 강제 제거 — 자연 높이로 두고 부모 .chat-nav-center 의
              // align-items: center 가 avatar 와 가운데 정렬하게 둠.
              minWidth: 0,
            }}
          >
            <div
              className="chat-nav-name"
              // 빈 상태에서도 라인 높이 유지 — NBSP + minHeight 이중 안전장치
              style={{ minHeight: "1.4em" }}
            >
              {(() => {
                if (isDbConsultation) {
                  // DB 모드 — 로드 전엔 폴백 텍스트("약사"/"환자") 절대 노출 금지.
                  // 빈 영역이 layout shift 를 일으키지 않도록 NBSP 로 라인 높이 유지.
                  if (role === "patient") {
                    const base = dbCounterpartLicenseName || dbCounterpartName || "";
                    return base ? `${base} 약사` : " ";
                  }
                  return dbCounterpartName ? `${dbCounterpartName} 님` : " ";
                }
                return role === "patient" ? PHARMACIST_INFO.name : "홍길동 님";
              })()}
            </div>
            {!(isDbConsultation && role === "pharmacist") && (
            <div
              className="chat-nav-pharmacy"
              style={{ minHeight: "1.3em" }}
            >
              {isDbConsultation
                ? role === "patient"
                  ? (dbCounterpartPharmacy || " ")
                  : " " /* 약사 측: 환자 증상 라벨 별도 데이터원 필요 — 일단 NBSP 로 영역 유지 */
                : role === "patient"
                  ? PHARMACIST_INFO.pharmacy
                  : "만성피로 · 소화불량"}
            </div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* 환자 측 상담 종료 버튼 — DB 상담이고 아직 잠금 안 된 상태에서만 노출 */}
          {role === "patient" && isDbConsultation && !inputLocked && (
            <button
              type="button"
              onClick={handlePatientEndClick}
              aria-label="상담 종료"
              style={{
                background: "transparent",
                border: "none",
                padding: "4px 6px",
                fontSize: 13,
                color: "#5E7D6C",
                textDecoration: "underline",
                cursor: "pointer",
                fontFamily: "'Noto Sans KR', sans-serif",
                flexShrink: 0,
              }}
            >
              상담 종료
            </button>
          )}
          {/* 약사 측 상담 종료 버튼 — DB 상담이고 잠금 안 된 상태에서만 노출 */}
          {role === "pharmacist" && isDbConsultation && !inputLocked && (
            <button
              type="button"
              onClick={handlePharmacistEndClick}
              aria-label="상담 종료"
              style={{
                background: "transparent",
                border: "none",
                padding: "4px 6px",
                fontSize: 13,
                color: "#5E7D6C",
                textDecoration: "underline",
                cursor: "pointer",
                fontFamily: "'Noto Sans KR', sans-serif",
                flexShrink: 0,
              }}
            >
              상담 종료
            </button>
          )}
          {role === "pharmacist" && (
            <button
              type="button"
              onClick={() => setShowChartPanel((v) => !v)}
              aria-label="환자 차트 보기"
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "6px 10px", borderRadius: 8,
                fontSize: 12, fontWeight: 700,
                background: showChartPanel ? "#4A6355" : "#EDF4F0",
                color: showChartPanel ? "#fff" : "#4A6355",
                border: showChartPanel ? "none" : "1px solid #B3CCBE",
                cursor: "pointer", flexShrink: 0,
              }}
            >
              📋 차트 보기
            </button>
          )}
          <button
            type="button"
            onClick={showSearch ? closeSearch : openSearch}
            aria-label="메시지 검색"
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: 6, lineHeight: 0, flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3D4A42" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        </div>
      </nav>

      {/* 검색 바 */}
      {showSearch && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 12px", background: "#fff",
          borderBottom: "1px solid rgba(94,125,108,0.14)",
          flexShrink: 0,
        }}>
          <div style={{
            flex: 1, display: "flex", alignItems: "center",
            background: "#F4F5F3", borderRadius: 8, padding: "6px 10px",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7A8A80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginRight: 6 }}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="메시지 검색"
              style={{
                flex: 1, border: "none", outline: "none", background: "transparent",
                fontSize: 14, color: "#2C3630", fontFamily: "'Noto Sans KR', sans-serif",
              }}
            />
          </div>
          {debouncedQuery && searchResults.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: "#3D4A42", whiteSpace: "nowrap", fontWeight: 600 }}>
                {searchIndex + 1}/{searchResults.length}
              </span>
              <button type="button" onClick={() => setSearchIndex((i) => (i - 1 + searchResults.length) % searchResults.length)}
                aria-label="이전 결과"
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, lineHeight: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3D4A42" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
              </button>
              <button type="button" onClick={() => setSearchIndex((i) => (i + 1) % searchResults.length)}
                aria-label="다음 결과"
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, lineHeight: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3D4A42" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
              </button>
            </div>
          )}
          {debouncedQuery && searchResults.length === 0 && (
            <span style={{ fontSize: 13, color: "#3D4A42", whiteSpace: "nowrap" }}>결과 없음</span>
          )}
          <button type="button" onClick={closeSearch} aria-label="검색 닫기"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4, fontSize: 16, color: "#3D4A42", lineHeight: 1 }}>
            ✕
          </button>
        </div>
      )}

      {/* 환자 측 안내 박스 — 베이지/살구 톤. 로딩 중에는 노출 X (rejected 깜빡임 방지). */}
      {role === "patient" && !dbLoading && !consultationRejected && (
        <div
          className="chat-status-banner waiting"
          style={{ padding: "12px 16px" }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.4 }}>
            약사님이 확인 중입니다
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 400,
              marginTop: 4,
              lineHeight: 1.5,
              color: "var(--color-text-mid)",
            }}
          >
            약사님은 약국 근무중이라 답변에 시간이 걸릴 수 있어요.
          </div>
        </div>
      )}
      {/* 차수별 AI 문답 요약 카드 (활성 차수)
       *  DB 모드: rounds + ai_questionnaires 콘텐츠 기반
       *  mock 모드: CONSULT_SESSIONS 기존 그대로
       */}
      {(() => {
        // ── DB 모드 분기 — 박스 자체는 항상 노출, 내부 콘텐츠만 데이터 유무에 따라 분기 ──
        if (isDbConsultation) {
          const activeRound = activeRoundId
            ? rounds.find((r) => r.id === activeRoundId)
            : null;
          // rounds 가 없거나 활성 차수 없으면 "현재 차수" 라벨만 표시 (레거시 consultation 안전 처리)
          const isLatestRound = activeRound
            ? rounds[rounds.length - 1]?.id === activeRoundId
            : true;
          const fmtMD = (iso: string | null | undefined): string => {
            if (!iso) return "";
            const d = new Date(iso);
            if (Number.isNaN(d.getTime())) return "";
            return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
          };
          const startLabel = activeRound ? fmtMD(activeRound.started_at) : "";
          const q = activeRound?.questionnaire_id
            ? questionnaireById.get(activeRound.questionnaire_id)
            : null;
          const symptoms = Array.isArray(q?.symptoms)
            ? (q!.symptoms as string[]).filter((s) => typeof s === "string" && s.trim())
            : [];
          const summary: string | null = (() => {
            if (q?.ai_summary && q.ai_summary.trim()) return q.ai_summary.trim();
            if (q?.free_text && q.free_text.trim()) {
              const txt = q.free_text.trim();
              return txt.length > 80 ? `${txt.slice(0, 80)}...` : txt;
            }
            return null;
          })();
          return (
            <div style={{
              margin: "0 16px", marginTop: role === "patient" ? 0 : 8,
              padding: "12px 14px",
              background: isLatestRound ? "#EDF4F0" : "#F4F5F3",
              border: `1px solid ${isLatestRound ? "#B3CCBE" : "rgba(94,125,108,0.18)"}`,
              borderRadius: 12,
              flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: isLatestRound ? "#4A6355" : "#D1D5D3", color: "#fff" }}>
                  {isLatestRound ? "현재 차수" : "지난 차수"}
                </span>
                {startLabel && (
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#4A6355" }}>
                    {startLabel}~ 상담
                  </span>
                )}
                {symptoms.length > 0 && symptoms.map((t) => (
                  <span key={t} style={{
                    fontSize: 12, fontWeight: 600,
                    padding: "2px 8px", borderRadius: 100,
                    background: "#fff", color: "#4A6355",
                    border: "1px solid rgba(94,125,108,0.14)",
                  }}>
                    {t}
                  </span>
                ))}
              </div>
              {summary && (
                <div style={{ fontSize: 14, color: "#2C3630", lineHeight: 1.55, fontWeight: 500 }}>
                  📋 {summary}
                </div>
              )}
              {!isLatestRound && (
                <div style={{ fontSize: 12, color: "#5E7D6C", marginTop: 6, fontWeight: 600 }}>
                  지난 상담 기록입니다. 메시지 전송은 현재 차수에서만 가능합니다.
                </div>
              )}
            </div>
          );
        }
        // ── mock 모드 분기 (기존 그대로) ──
        if (!activeSessionData) return null;
        return (
          <div style={{
            margin: "0 16px", marginTop: role === "patient" ? 0 : 8,
            padding: "12px 14px",
            background: isLatestSession ? "#EDF4F0" : "#F4F5F3",
            border: `1px solid ${isLatestSession ? "#B3CCBE" : "rgba(94,125,108,0.18)"}`,
            borderRadius: 12,
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: isLatestSession ? "#4A6355" : "#D1D5D3", color: "#fff" }}>
                {isLatestSession ? "현재 차수" : "지난 차수"}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#4A6355" }}>
                {activeSessionData.startDate}~ 상담
              </span>
              {activeSessionData.symptomTags.map((t) => (
                <span key={t} style={{
                  fontSize: 12, fontWeight: 600,
                  padding: "2px 8px", borderRadius: 100,
                  background: "#fff", color: "#4A6355",
                  border: "1px solid rgba(94,125,108,0.14)",
                }}>
                  {t}
                </span>
              ))}
            </div>
            <div style={{ fontSize: 14, color: "#2C3630", lineHeight: 1.55, fontWeight: 500 }}>
              📋 {activeSessionData.aiSummary}
            </div>
            {!isLatestSession && (
              <div style={{ fontSize: 12, color: "#5E7D6C", marginTop: 6, fontWeight: 600 }}>
                지난 상담 기록입니다. 메시지 전송은 현재 차수에서만 가능합니다.
              </div>
            )}
          </div>
        );
      })()}

      {/* 상담 차수 탭 (책갈피) — mock 모드 전용. DB 모드는 통합 채팅창(탭 없음). */}
      {!isDbConsultation && (
      <div
        ref={sessionTabRef}
        className="chat-session-tabs"
        style={{
          display: "flex", alignItems: "flex-end",
          gap: 4, padding: "0 12px",
          overflowX: "auto", overflowY: "hidden",
          background: "#F0F0F0", flexShrink: 0,
          scrollbarWidth: "none", msOverflowStyle: "none",
          WebkitOverflowScrolling: "touch",
          paddingTop: 6,
        }}
      >
        <style>{`
          .chat-session-tabs::-webkit-scrollbar { display: none; }
        `}</style>
        {CONSULT_SESSIONS.map((session) => {
          const active = session.id === activeSession;
          return (
            <button
              key={session.id}
              type="button"
              onClick={() => setActiveSession(session.id)}
              style={{
                padding: "8px 16px",
                fontSize: 14,
                fontWeight: active ? 700 : 500,
                color: active ? "#fff" : "#888",
                fontFamily: "'Noto Sans KR', sans-serif",
                background: active ? "#4A6355" : "#E5E5E5",
                border: "none",
                borderRadius: "8px 8px 0 0",
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
                transition: "color 0.15s, background 0.15s",
                lineHeight: 1.3,
                position: "relative",
              }}
            >
              {session.startDate} ~
            </button>
          );
        })}
      </div>
      )}

      {/* 팔로업 예정 배너 */}
      {role === "pharmacist" && followUp && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 16px", gap: 8,
          background: "#FBF5F1",
          borderBottom: "1px solid #F5E6DC",
          fontSize: 13, color: "#C06B45", fontWeight: 600,
          flexShrink: 0,
        }}>
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>팔로업 예정: {formatFollowUpLabel(followUp.date)} {followUp.time} ({calcDaysLeft(followUp.date)})</span>
          <button
            type="button"
            onClick={() => setShowCancelConfirm(true)}
            style={{
              padding: "3px 10px", borderRadius: 6,
              fontSize: 12, fontWeight: 600,
              background: "transparent", color: "#C06B45",
              border: "1px solid #C06B45", cursor: "pointer",
              flexShrink: 0, marginLeft: 8,
            }}
          >
            취소하기
          </button>
        </div>
      )}

      {/* Messages — 3분기:
            (1) dbLoading: 빈 영역 (메시지/카드 둘 다 안 보임 → rejected 깜빡임 방지)
            (2) !dbLoading + rejected + patient: 거절 안내 카드 (정중앙)
            (3) 그 외: 기존 메시지 리스트 */}
      <div className="chat-messages" style={{ borderTop: "none" }}>
        {dbLoading ? null : !dbLoading && consultationRejected && role === "patient" ? (
          /* 거절 안내 카드 — 채팅 영역 정중앙. 메시지 리스트는 숨김.
             거절 사유는 환자에게 노출 X. */
          <div
            role="status"
            aria-live="polite"
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              flex: 1,
              padding: "20px",
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 320,
                padding: "16px 18px",
                borderRadius: 12,
                background: "#EDF4F0",
                border: "1px solid rgba(94,125,108,0.18)",
                color: "#2C3630",
                fontFamily: "'Noto Sans KR', sans-serif",
              }}
            >
              <div style={{
                fontSize: 15, fontWeight: 700, color: "#2C3630",
                textAlign: "center", lineHeight: 1.5,
              }}>
                이번에는 상담이 어려운 상황이에요
              </div>
              <div style={{
                fontSize: 14, color: "#3D4A42",
                textAlign: "center", marginTop: 6, lineHeight: 1.6,
              }}>
                다른 약사님께 상담 요청을 보내보시겠어요?
              </div>
              <button
                type="button"
                onClick={() => router.push("/match")}
                style={{
                  width: "100%",
                  height: 44,
                  marginTop: 12,
                  borderRadius: 10,
                  background: "#4A6355",
                  color: "#fff",
                  border: "none",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "'Noto Sans KR', sans-serif",
                }}
              >
                매칭 페이지로
              </button>
            </div>
          </div>
        ) : (
          <>
        {!isDbConsultation && (
          <div className="chat-date-divider">
            <span>{activeSession === "s1" ? "오늘" : "2026년 4월 11일"}</span>
          </div>
        )}
        {/* (수락 대기 안내 박스는 입력 영역 바로 위로 이동 — 메시지 누적 시 묻히지 않도록) */}
        {messages.filter((m) => {
          if (m.pharmacistOnly && role !== "pharmacist") return false;
          // mock 모드: 기존 sessionId 필터 보존
          if (!isDbConsultation) return m.sessionId === activeSession;
          // DB 모드: 회차 무관 통합 뷰 — 모든 메시지 시간순 노출
          return true;
        }).map((msg) => {
          // 시스템 메시지 판정:
          //   DB 모드 → message_type === 'system'
          //   mock 모드 → "[시스템]" prefix 폴백 (mock 메시지에 message_type 미설정)
          const isSystem =
            msg.message_type === "system" || msg.content.startsWith("[시스템]");
          const isVisitCard = msg.content.startsWith("[방문안내]");
          const isQSetCard = msg.content.startsWith("[추가질문]") && !msg.content.startsWith("[추가질문답변]");
          const isQAnsCard = msg.content.startsWith("[추가질문답변]");
          // 회차 구분자:
          //   신규 형식 → "[ROUND_START]" / "[ROUND_END]"
          //   레거시 형식 → "--- N차 상담 시작/종료 ---" (이전 데이터 보존용 호환)
          //   .startsWith 로는 끝까지 일치 보장 못 하므로 정규식으로 정확히 매칭.
          const isRoundStart =
            msg.content === "[ROUND_START]" ||
            /^--- \d+차 상담 시작 ---$/.test(msg.content);
          const isRoundEnd =
            msg.content === "[ROUND_END]" ||
            /^--- \d+차 상담 종료 ---$/.test(msg.content);
          const isRoundDivider = isRoundStart || isRoundEnd;

          if (isQSetCard) {
            const setId = msg.content.replace("[추가질문] ", "").trim();
            const set = QUESTIONNAIRE_SETS.find((s) => s.id === setId);
            if (!set) return null;
            const count = set.questions.length;
            const isExpanded = expandedQSetMsgs.has(msg.id);
            const isMe = msg.sender === role;
            const isAnswered = answeredQSetMsgIds.has(msg.id);
            const showAnswerBtn = role === "patient" && !isAnswered;
            const showAnswered = role === "patient" && isAnswered;
            return (
              <div key={msg.id} style={{
                display: "flex", flexDirection: "column",
                alignItems: isMe ? "flex-end" : "flex-start",
                padding: "6px 16px", gap: 4,
              }}>
                <div style={{
                  width: "100%", maxWidth: 360, borderRadius: 16,
                  border: "1.5px solid #B3CCBE",
                  background: "#EDF4F0", overflow: "hidden",
                }}>
                  <div style={{ padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <span style={{ fontSize: 22, lineHeight: 1 }}>📋</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#2C3630", marginBottom: 4 }}>
                        {role === "pharmacist" ? "추가 질문을 보냈습니다" : "추가 질문에 답변해주세요"}
                      </div>
                      <div style={{ fontSize: 13, color: "#4A6355", fontWeight: 600 }}>
                        {role === "pharmacist" ? `${set.name} · 질문 ${count}개` : `질문 ${count}개`}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleQSetPreview(msg.id)}
                    style={{
                      width: "100%",
                      padding: "8px 14px",
                      background: "#fff",
                      border: "none", borderTop: "1px solid #B3CCBE",
                      cursor: "pointer",
                      fontSize: 13, fontWeight: 600,
                      color: "#4A6355",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                    }}
                  >
                    {isExpanded ? "접기 ▲" : "질문 보기 ▼"}
                  </button>
                  {isExpanded && (
                    <div style={{ background: "#fff", padding: "4px 14px 12px 14px", borderBottom: showAnswerBtn || showAnswered ? "1px solid #B3CCBE" : undefined }}>
                      <ol style={{ margin: 0, paddingLeft: 22, display: "flex", flexDirection: "column", gap: 6 }}>
                        {set.questions.map((q, i) => (
                          <li key={i} style={{ fontSize: 13, color: "#2C3630", lineHeight: 1.55 }}>{q.text}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {showAnswerBtn && (
                    <button
                      type="button"
                      onClick={() => openAnswerForm(msg.id, setId)}
                      style={{
                        width: "100%",
                        padding: "12px 14px",
                        background: "#4A6355",
                        color: "#fff",
                        border: "none",
                        cursor: "pointer",
                        fontSize: 15, fontWeight: 700,
                      }}
                    >
                      답변하기
                    </button>
                  )}
                  {showAnswered && (
                    <div style={{
                      width: "100%",
                      padding: "12px 14px",
                      background: "#fff",
                      borderTop: "1px solid #B3CCBE",
                      color: "#4A6355",
                      fontSize: 14, fontWeight: 700,
                      textAlign: "center",
                    }}>
                      ✓ 답변 완료
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 11, color: "#7A8A80", paddingRight: isMe ? 4 : 0, paddingLeft: isMe ? 0 : 4 }}>{msg.time}</span>
              </div>
            );
          }

          if (isQAnsCard) {
            const body = msg.content.replace("[추가질문답변] ", "").trim();
            const [setId, originalMsgId] = body.split("::");
            const set = QUESTIONNAIRE_SETS.find((s) => s.id === setId);
            if (!set) return null;
            const answers = qSetAnswers[originalMsgId] ?? [];
            const isExpanded = expandedQSetMsgs.has(msg.id);
            const isMe = msg.sender === role;
            const answeredCount = answers.filter((a) => a && a.trim().length > 0).length;
            return (
              <div key={msg.id} style={{
                display: "flex", flexDirection: "column",
                alignItems: isMe ? "flex-end" : "flex-start",
                padding: "6px 16px", gap: 4,
              }}>
                <div style={{
                  width: "100%", maxWidth: 360, borderRadius: 16,
                  border: "1.5px solid #F5E6DC",
                  background: "#FBF5F1", overflow: "hidden",
                }}>
                  <div style={{ padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <span style={{ fontSize: 22, lineHeight: 1 }}>📋</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#2C3630", marginBottom: 4 }}>
                        추가 질문에 답변했습니다
                      </div>
                      <div style={{ fontSize: 13, color: "#C06B45", fontWeight: 600 }}>
                        {set.name} · {answeredCount}/{set.questions.length}개 답변
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleQSetPreview(msg.id)}
                    style={{
                      width: "100%",
                      padding: "8px 14px",
                      background: "#fff",
                      border: "none", borderTop: "1px solid #F5E6DC",
                      cursor: "pointer",
                      fontSize: 13, fontWeight: 600,
                      color: "#C06B45",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                    }}
                  >
                    {isExpanded ? "접기 ▲" : "답변 보기 ▼"}
                  </button>
                  {isExpanded && (
                    <div style={{ background: "#fff", padding: "8px 14px 12px 14px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {set.questions.map((q, i) => {
                          const ans = answers[i] ?? "";
                          return (
                            <div key={i}>
                              <div style={{ fontSize: 13, color: "#3D4A42", marginBottom: 3 }}>
                                Q{i + 1}. {q.text}
                              </div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "#2C3630", lineHeight: 1.55, paddingLeft: 8, borderLeft: "3px solid #F5E6DC" }}>
                                {ans && ans.trim() ? ans : "(답변 없음)"}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 11, color: "#7A8A80", paddingRight: isMe ? 4 : 0, paddingLeft: isMe ? 0 : 4 }}>{msg.time}</span>
              </div>
            );
          }

          if (isSystem) {
            // 회차 구분자: 가운데 라벨 + 양쪽 가로줄, sage 배경 (시각적으로 두드러짐).
            // 라벨은 role + 날짜 기반 — DB content (마커) 자체는 사용자에게 노출되지 않음.
            if (isRoundDivider) {
              const dateLabel = (() => {
                const iso = msg.created_at;
                if (!iso) return "";
                const d = new Date(iso);
                if (Number.isNaN(d.getTime())) return "";
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, "0");
                const dd = String(d.getDate()).padStart(2, "0");
                return `${y}.${m}.${dd}`;
              })();
              const baseLabel = isRoundStart
                ? role === "patient"
                  ? "상담이 수락되었습니다"
                  : "상담 시작"
                : "상담 종료";
              const label = dateLabel ? `${baseLabel} · ${dateLabel}` : baseLabel;
              return (
                <div
                  key={msg.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "18px 16px",
                  }}
                >
                  <div style={{ flex: 1, height: 1, background: "#B3CCBE" }} />
                  <span
                    style={{
                      padding: "6px 16px", borderRadius: 999,
                      background: "#EDF4F0", color: "#2C3630",
                      fontSize: 15, fontWeight: 700,
                      whiteSpace: "nowrap",
                      border: "1px solid #B3CCBE",
                      fontFamily: "'Gothic A1', sans-serif",
                    }}
                  >
                    {label}
                  </span>
                  <div style={{ flex: 1, height: 1, background: "#B3CCBE" }} />
                </div>
              );
            }
            // 일반 시스템 메시지: 회색 알약 (회차 구분자보다 약하게)
            return (
              <div key={msg.id} style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                padding: "8px 0", gap: 4,
              }}>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "7px 18px", borderRadius: 100,
                  background: "#F4F5F3",
                  border: "1px solid rgba(94, 125, 108, 0.14)",
                  fontSize: 15, color: "#3D4A42", fontWeight: 600,
                }}>
                  {role === "pharmacist" && msg.pharmacistOnly && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3D4A42" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0110 0v4" />
                    </svg>
                  )}
                  {formatSystemMessageContent(msg.content, role)}
                </div>
                {role === "pharmacist" && msg.pharmacistOnly && (
                  <span style={{ fontSize: 11, color: "#9AA8A0" }}>내부 메모 (환자에게 안 보임)</span>
                )}
              </div>
            );
          }

          if (isVisitCard) {
            const bodyText = msg.content.replace("[방문안내] ", "");
            const lines = bodyText.split("\n");
            const isCancelled = cancelledVisitIds.has(msg.id);
            const isActive = msg.id === activeVisitMsgId && !isCancelled;
            return (
              <div key={msg.id} style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                padding: "8px 16px", gap: 6,
                opacity: isCancelled ? 0.5 : 1,
              }}>
                <div style={{
                  width: "100%", maxWidth: 360, borderRadius: 14,
                  border: isCancelled ? "1.5px solid #D1D5D3" : "1.5px solid #B3CCBE",
                  background: "#fff", overflow: "hidden", position: "relative",
                }}>
                  <div style={{
                    padding: "14px 16px",
                    background: isCancelled ? "#F0F0F0" : "#EDF4F0",
                    display: "flex", alignItems: "flex-start", gap: 8,
                  }}>
                    <span style={{ fontSize: 20 }}>📅</span>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: 14, fontWeight: 700,
                        color: isCancelled ? "#999" : "#2C3630",
                        textDecoration: isCancelled ? "line-through" : "none",
                      }}>
                        방문 안내
                        {isCancelled && (
                          <span style={{
                            marginLeft: 8, fontSize: 11, fontWeight: 600,
                            color: "#C06B45", textDecoration: "none",
                            display: "inline-block",
                          }}>취소됨</span>
                        )}
                      </div>
                      {lines.map((line, li) => (
                        <div key={li} style={{
                          fontSize: 13, marginTop: li === 0 ? 2 : 1,
                          color: isCancelled ? "#999" : "#3D4A42",
                          textDecoration: isCancelled ? "line-through" : "none",
                        }}>{line}</div>
                      ))}
                    </div>
                  </div>
                  {!isCancelled && isActive && role === "patient" && visitGuide && (
                    <>
                      <div style={{ display: "flex", borderTop: "1px solid #B3CCBE" }}>
                        <button type="button" onClick={() => setShowReschedule(true)} style={{
                          flex: 1, padding: "10px", fontSize: 13, fontWeight: 600,
                          color: "#4A6355", background: "transparent", border: "none",
                          borderRight: "1px solid #B3CCBE", cursor: "pointer",
                        }}>일정 변경</button>
                        <button type="button" onClick={handleDeclineVisit} style={{
                          flex: 1, padding: "10px", fontSize: 13, fontWeight: 600,
                          color: "#C06B45", background: "transparent", border: "none",
                          cursor: "pointer",
                        }}>다음에 다시 잡을게요</button>
                      </div>
                      <div style={{
                        padding: "6px 16px 8px", fontSize: 11, color: "#9AA8A0",
                        textAlign: "center", lineHeight: 1.4,
                      }}>
                        방문이 어려우시면 미리 일정 변경 또는 취소를 부탁드려요.
                      </div>
                    </>
                  )}
                </div>
                <span style={{ fontSize: 11, color: "#9AA8A0" }}>{msg.time}</span>
              </div>
            );
          }

          const isMine = msg.sender === role;
          const isCurrentResult = debouncedQuery && searchResults[searchIndex]?.id === msg.id;
          return (
            <div
              key={msg.id}
              id={`msg-${msg.id}`}
              className={`chat-bubble-wrap${isMine ? " mine" : " theirs"}`}
              style={isCurrentResult ? { background: "rgba(255,243,205,0.35)", borderRadius: 12, transition: "background 0.2s" } : undefined}
            >
              {!isMine && (
                <div className="bubble-avatar">
                  {(() => {
                    if (isDbConsultation && dbCounterpartAvatarUrl) {
                      // eslint-disable-next-line @next/next/no-img-element
                      return (
                        <img
                          src={dbCounterpartAvatarUrl}
                          alt=""
                          style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                        />
                      );
                    }
                    if (role === "patient") return "👩‍⚕️";
                    return (
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#5E7D6C"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="8" r="4" />
                        <path d="M4 21c0-3.3 3.6-6 8-6s8 2.7 8 6" />
                      </svg>
                    );
                  })()}
                </div>
              )}
              <div className="bubble-col">
                {!isMine && (
                  <div className="bubble-name">
                    {(() => {
                      if (isDbConsultation) {
                        if (role === "patient") {
                          const base = dbCounterpartLicenseName || dbCounterpartName || "";
                          return base ? `${base} 약사` : " ";
                        }
                        return dbCounterpartName || " ";
                      }
                      return role === "patient" ? PHARMACIST_INFO.name : "홍길동";
                    })()}
                  </div>
                )}
                <div className="bubble-row">
                  {isMine && (
                    <div className="bubble-meta mine-meta">
                      {msg.isRead && (
                        <span className="read-receipt">읽음</span>
                      )}
                      <span className="bubble-time">{msg.time}</span>
                    </div>
                  )}
                  <div className={`chat-bubble${isMine ? " mine" : " theirs"}`} style={{ whiteSpace: "pre-wrap" }}>
                    {debouncedQuery && msg.content.toLowerCase().includes(debouncedQuery.toLowerCase())
                      ? highlightText(msg.content)
                      : msg.content}
                  </div>
                  {!isMine && (
                    <div className="bubble-meta">
                      <span className="bubble-time">{msg.time}</span>
                    </div>
                  )}
                </div>
                {msg.id === lastPatientMsgId && (
                  <div style={{ marginTop: 6 }}>
                    <button
                      type="button"
                      onClick={() => openAiDraft(msg.content)}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "6px 14px", borderRadius: 16,
                        fontSize: 13, fontWeight: 600,
                        background: "linear-gradient(135deg, #EDF4F0 0%, #F5E6DC 100%)",
                        color: "#4A6355",
                        border: "1px solid rgba(94,125,108,0.18)",
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ fontSize: 14 }}>🤖</span>
                      AI 답변 초안 받기
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* 새 상담 요청 액션 박스 (sage 톤) — 약사 측, 도구 버튼 줄 바로 위.
          순서: [새 상담 요청 박스] → [도구 버튼] → [기타 상태 안내] → [입력란]. */}
      {consultationPending && role === "pharmacist" && pendingQuestionnaire && (() => {
        const patientName = dbCounterpartName || "환자";
        const mainSymptom = (() => {
          const s = pendingQuestionnaire.symptoms;
          if (Array.isArray(s) && s.length > 0 && typeof s[0] === "string" && s[0].trim()) {
            return s[0];
          }
          return "—";
        })();
        const severity = getSeverityDisplay(pendingQuestionnaire);
        const duration = pendingQuestionnaire.symptom_duration?.trim() || "—";
        const labelStyle: React.CSSProperties = {
          color: "#5E7D6C", fontWeight: 600, marginRight: 8,
          display: "inline-block", minWidth: 44,
        };
        return (
          <div
            role="region"
            aria-label="새 상담 요청"
            style={{
              margin: "8px 16px 0",
              padding: "14px 16px",
              borderRadius: 10,
              background: "#EDF4F0",
              border: "1px solid rgba(94, 125, 108, 0.18)",
              color: "#2C3630",
              fontFamily: "'Noto Sans KR', sans-serif",
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, textAlign: "center" }}>
              새 상담 요청이 도착했어요
            </div>
            <div
              style={{
                background: "#fff",
                borderRadius: 8,
                padding: "10px 12px",
                marginBottom: 10,
                fontSize: 14,
                lineHeight: 1.7,
                border: "1px solid rgba(94, 125, 108, 0.10)",
              }}
            >
              <div><span style={labelStyle}>환자</span>{patientName}</div>
              <div><span style={labelStyle}>증상</span>{mainSymptom}</div>
              <div><span style={labelStyle}>불편도</span>{severity}</div>
              <div><span style={labelStyle}>기간</span>{duration}</div>
              <div style={{ textAlign: "right", marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setShowQuestionnairePanel(true)}
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#5E7D6C",
                    cursor: "pointer",
                    fontFamily: "'Noto Sans KR', sans-serif",
                  }}
                >
                  전체 보기 →
                </button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => { setShowQuestionnairePanel(false); setRejectReason(""); setRejectError(null); setShowRejectConfirm(true); }}
                style={{
                  flex: 1,
                  minHeight: 44,
                  padding: "10px 0",
                  borderRadius: 10,
                  background: "#fff",
                  color: "#3D4A42",
                  border: "1px solid rgba(94, 125, 108, 0.28)",
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "'Noto Sans KR', sans-serif",
                }}
              >
                거절
              </button>
              <button
                type="button"
                onClick={handleAcceptClick}
                style={{
                  flex: 1,
                  minHeight: 44,
                  padding: "10px 0",
                  borderRadius: 10,
                  background: "#4A6355",
                  color: "#fff",
                  border: "none",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "'Noto Sans KR', sans-serif",
                }}
              >
                수락
              </button>
            </div>
          </div>
        );
      })()}

      {/* Template + Followup buttons (pharmacist only, 최신 차수만) */}
      {role === "pharmacist" && isLatestSession && (() => {
        // pending 상태에서는 약사 도구 5종 모두 비활성. 회색 톤 + disabled + cursor:not-allowed.
        const toolsDisabled = consultationPending;
        const disabledBtnStyle: React.CSSProperties = {
          background: "#F4F5F3",
          color: "#9CA3AF",
          border: "1px solid rgba(94,125,108,0.18)",
          cursor: "not-allowed",
        };
        return (
        <div style={{
          padding: "6px 16px",
          background: "rgba(248,249,247,0.95)",
          borderTop: "1px solid rgba(94,125,108,0.10)",
          display: "flex", gap: 6, flexWrap: "wrap",
        }}>
          <button
            type="button"
            onClick={() => setShowTemplates(true)}
            disabled={toolsDisabled}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "6px 8px", borderRadius: 20,
              fontSize: 13, fontWeight: 600,
              ...(toolsDisabled
                ? disabledBtnStyle
                : { background: "#EDF4F0", color: "#4A6355", border: "1px solid #B3CCBE", cursor: "pointer" }),
            }}
          >
            템플릿
          </button>
          <button
            type="button"
            onClick={() => { setSelectedQSetId(QUESTIONNAIRE_SETS.find((s) => s.isDefault)?.id ?? null); setShowQSetPicker(true); }}
            disabled={toolsDisabled}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "6px 8px", borderRadius: 20,
              fontSize: 13, fontWeight: 600,
              ...(toolsDisabled
                ? disabledBtnStyle
                : { background: "#EEEDFE", color: "#534AB7", border: "1px solid #D6D3F3", cursor: "pointer" }),
            }}
          >
            추가문답
          </button>
          <button
            type="button"
            onClick={() => {
              setFuMessage(followUp?.message ?? FOLLOWUP_DEFAULT_MSG);
              setShowFollowUpPanel(true);
            }}
            disabled={toolsDisabled}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "6px 8px", borderRadius: 20,
              fontSize: 13, fontWeight: 600,
              ...(toolsDisabled
                ? disabledBtnStyle
                : { background: "#FBF5F1", color: "#C06B45", border: "1px solid #F5E6DC", cursor: "pointer" }),
            }}
          >
            팔로업 설정
          </button>
          <button
            type="button"
            onClick={handleVisitBtnClick}
            disabled={toolsDisabled}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "6px 8px", borderRadius: 20,
              fontSize: 13, fontWeight: 600,
              ...(toolsDisabled
                ? disabledBtnStyle
                : { background: "#E8F0F5", color: "#5A8BA8", border: "1px solid #B3D1E0", cursor: "pointer" }),
            }}
          >
            방문안내
          </button>
          <button
            type="button"
            onClick={handleReportBtnClick}
            disabled={toolsDisabled}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "6px 8px", borderRadius: 20,
              fontSize: 13, fontWeight: 600,
              ...(toolsDisabled
                ? disabledBtnStyle
                : { background: "#F5E6DC", color: "#C06B45", border: "1px solid #E8D5C8", cursor: "pointer" }),
            }}
          >
            방문전 리포트
          </button>
        </div>
        );
      })()}

      {/* 상태 안내 박스 — 입력란 바로 위. consultationLocked / consultationPending / consultationRejected 는 상호 배타. */}
      {/* 종료된 상담 안내 (회색 톤) — rejected 는 별도 박스에서 분기 처리하므로 제외 */}
      {consultationLocked && !consultationRejected && (
        <div
          role="status"
          style={{
            margin: "8px 16px 0",
            padding: "12px 16px",
            borderRadius: 10,
            background: "#F4F6F3",
            border: "1px solid rgba(94,125,108,0.18)",
            color: "#3D4A42",
            fontSize: 15,
            lineHeight: 1.5,
            textAlign: "center",
          }}
        >
          이 상담은 종료되었습니다
        </div>
      )}
      {/* 수락 대기 안내 (sage 톤) — 환자 측에서만, status='pending' 일 때 */}
      {consultationPending && role === "patient" && (() => {
        const pharmName =
          dbCounterpartLicenseName || dbCounterpartName || "";
        const labelPrefix = pharmName ? `${pharmName} 약사님이 ` : "약사님이 ";
        return (
          <div
            role="status"
            aria-live="polite"
            style={{
              margin: "8px 16px 0",
              padding: "14px 16px",
              borderRadius: 10,
              background: "#EDF4F0",
              border: "1px solid rgba(94, 125, 108, 0.18)",
              color: "#2C3630",
              fontSize: 15,
              lineHeight: 1.5,
              textAlign: "center",
              fontFamily: "'Noto Sans KR', sans-serif",
            }}
          >
            <div style={{ marginBottom: 4 }}>
              <span style={{ marginRight: 6 }}>⏳</span>
              <span style={{ fontWeight: 700 }}>
                {labelPrefix}수락하면 채팅이 시작돼요
              </span>
            </div>
            <div style={{ fontSize: 13, color: "#3D4A42", fontWeight: 500 }}>
              수락되면 자동으로 채팅이 시작돼요
            </div>
          </div>
        );
      })()}
      {/* Input — 최신 차수에서만 + 종료/수락대기 잠금 아닌 상담에서만 입력 가능 */}
      <div className="chat-input-bar">
        <textarea
          ref={inputRef}
          className="chat-input"
          placeholder={
            consultationRejected
              ? "다른 약사님께 상담을 요청해 주세요"
              : consultationLocked
                ? "종료된 상담은 메시지를 보낼 수 없어요"
                : consultationPending
                  ? "약사 수락 대기 중이에요"
                  : isLatestSession
                    ? "메시지를 입력하세요..."
                    : "이전 차수는 읽기 전용입니다"
          }
          value={isLatestSession && !inputLocked ? input : ""}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={!isLatestSession || inputLocked}
          style={
            !isLatestSession || inputLocked
              ? { background: "#F4F5F3", cursor: "not-allowed" }
              : undefined
          }
        />
        <button
          className="chat-send-btn"
          onClick={sendMessage}
          disabled={!isLatestSession || inputLocked || !input.trim()}
          aria-label="전송"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>

      {/* Template bottom sheet */}
      {showTemplates && (
        <>
          <style>{`
            @keyframes tmpl-slide-up {
              from { transform: translateY(100%); }
              to { transform: translateY(0); }
            }
            .tmpl-sheet-overlay {
              position: fixed; inset: 0;
              background: rgba(0,0,0,0.3);
              display: flex; align-items: flex-end; justify-content: center;
              z-index: 100;
            }
            .tmpl-sheet {
              background: #fff;
              display: flex; flex-direction: column;
              width: 100%;
              max-height: 70vh;
              border-radius: 20px 20px 0 0;
              animation: tmpl-slide-up 0.3s ease;
              overflow: hidden;
            }
            @media (min-width: 768px) {
              .tmpl-sheet-overlay { align-items: center; }
              .tmpl-sheet {
                max-width: 480px;
                max-height: 60vh;
                border-radius: 16px;
              }
            }
          `}</style>
          <div
            className="tmpl-sheet-overlay"
            onClick={() => setShowTemplates(false)}
          >
            <div
              className="tmpl-sheet"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-label="답변 템플릿 선택"
            >
              {/* 헤더 */}
              <div style={{ padding: "16px 20px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(94,125,108,0.1)", flexShrink: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 600, color: "#2C3630", fontFamily: "'Gothic A1', sans-serif" }}>
                  답변 템플릿
                </div>
                <button
                  type="button"
                  onClick={() => setShowTemplates(false)}
                  aria-label="닫기"
                  style={{
                    width: 40, height: 40, minWidth: 40, minHeight: 40,
                    borderRadius: 10,
                    background: "#F8F9F7", color: "#3D4A42",
                    border: "1px solid rgba(94,125,108,0.14)",
                    cursor: "pointer",
                    fontSize: 16, fontWeight: 600,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: 0, lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              </div>

              {/* 템플릿 목록 (카테고리 통합) */}
              <div style={{ flex: 1, overflowY: "auto", padding: "4px 0 16px" }}>
                {TEMPLATE_ITEMS.length === 0 ? (
                  <div style={{ padding: "40px 20px", textAlign: "center" }}>
                    <div style={{ fontSize: 15, color: "#3D4A42", marginBottom: 16 }}>
                      아직 템플릿이 없어요
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowTemplates(false);
                        router.push("/pharmacist/templates");
                      }}
                      style={{
                        minHeight: 48,
                        padding: "12px 20px",
                        borderRadius: 10,
                        border: "1px solid #4A6355",
                        background: "transparent",
                        color: "#4A6355",
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      템플릿 관리하기 →
                    </button>
                  </div>
                ) : (
                  TEMPLATE_ITEMS.map((t: ChatTemplate, idx) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setInput((prev) => (prev.trim() ? `${prev}\n\n${t.content}` : t.content));
                        setShowTemplates(false);
                        setTimeout(() => inputRef.current?.focus(), 100);
                      }}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "14px 20px",
                        minHeight: 56,
                        background: "transparent",
                        border: "none",
                        borderTop: idx === 0 ? "none" : "1px solid rgba(94,125,108,0.1)",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                        <span
                          style={{
                            fontSize: 12,
                            padding: "2px 8px",
                            borderRadius: 4,
                            background: "#EDF4F0",
                            color: "#4A6355",
                            fontWeight: 500,
                            flexShrink: 0,
                          }}
                        >
                          {t.category}
                        </span>
                        <span style={{ fontSize: 15, fontWeight: 600, color: "#2C3630" }}>
                          {t.title}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          color: "#3D4A42",
                          lineHeight: 1.5,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {t.content}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* 팔로업 설정 패널 */}
      {showFollowUpPanel && (
        <div
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.35)",
            backdropFilter: "blur(4px)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
            zIndex: 100,
          }}
          onClick={() => setShowFollowUpPanel(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "20px 20px 0 0",
              padding: "20px 20px 32px",
              width: "100%", maxWidth: 560,
              maxHeight: "80dvh", overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              width: 36, height: 4, borderRadius: 2,
              background: "#D1D5D3", margin: "0 auto 16px",
            }} />
            <div style={{ fontSize: 17, fontWeight: 700, color: "#2C3630", marginBottom: 4, fontFamily: "'Gothic A1', sans-serif" }}>
              팔로업 설정
            </div>
            <div style={{ fontSize: 14, color: "#3D4A42", marginBottom: 20, lineHeight: 1.5 }}>
              설정한 날짜에 환자에게 경과 확인 메시지가 자동 발송됩니다.
            </div>

            {/* 간격 선택 */}
            <div style={{ fontSize: 14, fontWeight: 700, color: "#2C3630", marginBottom: 10 }}>간격 선택</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {([
                { value: "1w", label: "1주 후" },
                { value: "2w", label: "2주 후" },
                { value: "1m", label: "한 달 후" },
                { value: "custom", label: "직접 입력" },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFuInterval(opt.value)}
                  style={{
                    padding: "8px 16px", borderRadius: 10,
                    fontSize: 14, fontWeight: 600,
                    background: fuInterval === opt.value ? "#4A6355" : "#F8F9F7",
                    color: fuInterval === opt.value ? "#fff" : "#3D4A42",
                    border: fuInterval === opt.value ? "1.5px solid #4A6355" : "1px solid rgba(94,125,108,0.14)",
                    cursor: "pointer",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* 직접 입력 날짜 */}
            {fuInterval === "custom" && (
              <div style={{ marginBottom: 16 }}>
                <input
                  type="date"
                  value={fuCustomDate}
                  onChange={(e) => setFuCustomDate(e.target.value)}
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: 10,
                    border: "1.5px solid #B3CCBE", fontSize: 14, color: "#2C3630",
                    outline: "none", fontFamily: "'Noto Sans KR', sans-serif",
                  }}
                />
              </div>
            )}

            {/* 예정 날짜 미리보기 */}
            {fuInterval !== "custom" && (
              <div style={{
                padding: "10px 14px", borderRadius: 10,
                background: "#EDF4F0", marginBottom: 16,
                fontSize: 14, color: "#4A6355", fontWeight: 600,
              }}>
                예정 날짜: {formatFollowUpLabel(calcFollowUpDate(fuInterval))} {fuTime === "직접 입력" ? getEffectiveFuTime() : fuTime}
              </div>
            )}

            {/* 시간 선택 */}
            <div style={{ fontSize: 14, fontWeight: 700, color: "#2C3630", marginBottom: 10 }}>시간 선택</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: fuTime === "직접 입력" ? 8 : 16 }}>
              {FU_TIME_OPTIONS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFuTime(t)}
                  style={{
                    padding: "7px 14px", borderRadius: 10,
                    fontSize: 13, fontWeight: 600,
                    background: fuTime === t ? "#4A6355" : "#F8F9F7",
                    color: fuTime === t ? "#fff" : "#3D4A42",
                    border: fuTime === t ? "1.5px solid #4A6355" : "1px solid rgba(94,125,108,0.14)",
                    cursor: "pointer",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
            {fuTime === "직접 입력" && (
              <div style={{ marginBottom: 16 }}>
                <input
                  type="time"
                  value={fuCustomTime}
                  onChange={(e) => setFuCustomTime(e.target.value)}
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: 10,
                    border: "1.5px solid #B3CCBE", fontSize: 14, color: "#2C3630",
                    outline: "none", fontFamily: "'Noto Sans KR', sans-serif",
                  }}
                />
              </div>
            )}

            {/* 메시지 작성 */}
            <div style={{ fontSize: 14, fontWeight: 700, color: "#2C3630", marginBottom: 10 }}>메시지 내용</div>
            <textarea
              value={fuMessage}
              onChange={(e) => setFuMessage(e.target.value)}
              rows={4}
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 12,
                border: "1.5px solid #B3CCBE", fontSize: 14, color: "#2C3630",
                outline: "none", resize: "vertical",
                fontFamily: "'Noto Sans KR', sans-serif", lineHeight: 1.6,
              }}
            />

            {/* 설정 완료 버튼 */}
            <button
              type="button"
              onClick={confirmFollowUp}
              disabled={fuInterval === "custom" && !fuCustomDate}
              style={{
                width: "100%", padding: "14px 0", borderRadius: 12,
                fontSize: 15, fontWeight: 700, marginTop: 16,
                background: (fuInterval === "custom" && !fuCustomDate) ? "#B3CCBE" : "#4A6355",
                color: "#fff", border: "none", cursor: "pointer",
              }}
            >
              설정 완료
            </button>
          </div>
        </div>
      )}

      {/* 팔로업 취소 확인 */}
      {showCancelConfirm && (
        <div
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 200,
          }}
          onClick={() => setShowCancelConfirm(false)}
        >
          <div
            style={{
              background: "#fff", borderRadius: 16, padding: 24,
              maxWidth: 320, width: "90%", textAlign: "center",
              boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: "#2C3630", marginBottom: 8 }}>
              팔로업을 취소하시겠습니까?
            </div>
            <div style={{ fontSize: 14, color: "#3D4A42", marginBottom: 20, lineHeight: 1.5 }}>
              설정된 팔로업 메시지가 발송되지 않습니다.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowCancelConfirm(false)}
                style={{
                  flex: 1, padding: "12px", borderRadius: 10,
                  fontSize: 14, fontWeight: 600,
                  background: "#F8F9F7", color: "#3D4A42",
                  border: "1px solid rgba(94,125,108,0.14)", cursor: "pointer",
                }}
              >
                아니오
              </button>
              <button
                type="button"
                onClick={cancelFollowUp}
                style={{
                  flex: 1, padding: "12px", borderRadius: 10,
                  fontSize: 14, fontWeight: 700,
                  background: "#C06B45", color: "#fff",
                  border: "none", cursor: "pointer",
                }}
              >
                취소하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 이전 방문 안내 취소 확인 */}
      {/* 방문 안내 설정 패널 */}
      {showVisitPanel && (
        <div
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.35)",
            backdropFilter: "blur(4px)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
            zIndex: 100,
            paddingBottom: 16,
          }}
          onClick={() => setShowVisitPanel(false)}
        >
          <div
            style={{
              background: "#fff", borderRadius: 16,
              padding: "20px 20px 24px",
              width: "calc(100% - 32px)", maxWidth: 560,
              maxHeight: "80dvh", overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "#D1D5D3", margin: "0 auto 16px" }} />
            <div style={{ fontSize: 17, fontWeight: 700, color: "#2C3630", marginBottom: 4 }}>방문 안내</div>
            <div style={{ fontSize: 14, color: "#3D4A42", marginBottom: 16, lineHeight: 1.5 }}>
              환자에게 약국 방문 일정을 안내합니다.
            </div>

            {/* 이전 방문 안내 내역 */}
            {visitGuide && (
              <div style={{
                padding: "12px 14px", borderRadius: 10, marginBottom: 16,
                background: "#F4F5F3", border: "1px solid rgba(94,125,108,0.10)",
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#3D4A42", marginBottom: 6 }}>이전 방문 안내</div>
                <div style={{ fontSize: 14, color: "#3D4A42", lineHeight: 1.5 }}>
                  {formatVisitDate(visitGuide.date)} ({visitGuide.timeSlot}){visitGuide.memo ? ` · ${visitGuide.memo}` : ""}
                </div>
              </div>
            )}

            {/* 이전 안내 자동 취소 안내 배너 */}
            {visitGuide && (
              <div style={{
                display: "flex", alignItems: "flex-start", gap: 8,
                padding: "10px 12px", borderRadius: 8,
                background: "#FFF8E7", marginBottom: 16,
              }}>
                <span style={{ fontSize: 16, lineHeight: 1.2, flexShrink: 0 }}>⚠️</span>
                <span style={{ fontSize: 14, color: "#854F0B", lineHeight: 1.45 }}>
                  새 방문 안내를 보내면 이전 안내는 자동으로 취소됩니다.
                </span>
              </div>
            )}

            {/* AI 제안 영역 */}
            <div style={{
              padding: "14px 16px", borderRadius: 12, marginBottom: 16,
              background: "#F4F5F3", border: "1px solid rgba(94,125,108,0.12)",
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#4A6355", marginBottom: 6 }}>
                (AI) 대화 내용을 보니 이번 주 토요일 오전은 어떨까요?
              </div>
              <button type="button" onClick={() => {
                const sat = new Date();
                const day = sat.getDay();
                sat.setDate(sat.getDate() + (6 - day));
                const iso = `${sat.getFullYear()}-${String(sat.getMonth() + 1).padStart(2, "0")}-${String(sat.getDate()).padStart(2, "0")}`;
                setVisitDate(iso);
                setVisitTimeSlot("오전");
              }} style={{
                padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: "#4A6355", color: "#fff", border: "none", cursor: "pointer",
                marginBottom: 4,
              }}>이대로 설정</button>
              <div style={{ fontSize: 13, color: "#3D4A42", marginTop: 4 }}>
                (백엔드 연결 후 실제 AI가 제안합니다)
              </div>
            </div>

            {/* 날짜 선택 */}
            <div style={{ fontSize: 14, fontWeight: 700, color: "#2C3630", marginBottom: 10 }}>날짜 선택</div>
            <input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} style={{
              width: "100%", padding: "10px 12px", borderRadius: 10,
              border: "1.5px solid #B3CCBE", fontSize: 14, color: "#2C3630",
              outline: "none", fontFamily: "'Noto Sans KR', sans-serif", marginBottom: 16,
            }} />

            {/* 시간대 선택 */}
            <div style={{ fontSize: 14, fontWeight: 700, color: "#2C3630", marginBottom: 10 }}>시간대 선택</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: visitTimeSlot === "직접 입력" ? 8 : 16 }}>
              {VISIT_TIME_SLOTS.map((t) => (
                <button key={t} type="button" onClick={() => setVisitTimeSlot(t)} style={{
                  padding: "8px 16px", borderRadius: 10, fontSize: 14, fontWeight: 600,
                  background: visitTimeSlot === t ? "#4A6355" : "#F8F9F7",
                  color: visitTimeSlot === t ? "#fff" : "#3D4A42",
                  border: visitTimeSlot === t ? "1.5px solid #4A6355" : "1px solid rgba(94,125,108,0.14)",
                  cursor: "pointer",
                }}>{t}</button>
              ))}
            </div>
            {visitTimeSlot === "직접 입력" && (
              <input type="text" value={visitCustomTime} onChange={(e) => setVisitCustomTime(e.target.value)}
                placeholder="예: 9시-10시" style={{
                  width: "100%", padding: "10px 12px", borderRadius: 10,
                  border: "1.5px solid #B3CCBE", fontSize: 14, color: "#2C3630",
                  outline: "none", fontFamily: "'Noto Sans KR', sans-serif", marginBottom: 16,
                }} />
            )}

            {/* 메모 */}
            <div style={{ fontSize: 14, fontWeight: 700, color: "#2C3630", marginBottom: 10 }}>메모</div>
            <input type="text" value={visitMemo} onChange={(e) => setVisitMemo(e.target.value)}
              placeholder="예: 9시-10시가 한가해요" style={{
                width: "100%", padding: "10px 12px", borderRadius: 10,
                border: "1.5px solid #B3CCBE", fontSize: 14, color: "#2C3630",
                outline: "none", fontFamily: "'Noto Sans KR', sans-serif", marginBottom: 16,
              }} />

            <button type="button" onClick={sendVisitGuide} disabled={!visitDate} style={{
              width: "100%", padding: "14px 0", borderRadius: 12, fontSize: 15, fontWeight: 700,
              background: !visitDate ? "#B3CCBE" : "#5A8BA8", color: "#fff",
              border: "none", cursor: "pointer",
            }}>방문 안내 보내기</button>
          </div>
        </div>
      )}

      {/* 일정 변경 (환자용) */}
      {showReschedule && (
        <div
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 200,
          }}
          onClick={() => setShowReschedule(false)}
        >
          <div
            style={{
              background: "#fff", borderRadius: 16, padding: 24,
              maxWidth: 340, width: "90%",
              boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: "#2C3630", marginBottom: 12 }}>
              일정 변경
            </div>
            <div style={{ fontSize: 14, color: "#3D4A42", marginBottom: 12 }}>
              원하시는 날짜와 시간대를 선택해주세요.
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#2C3630", marginBottom: 8 }}>날짜</div>
            <input type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} style={{
              width: "100%", padding: "10px 12px", borderRadius: 10,
              border: "1.5px solid #B3CCBE", fontSize: 14, color: "#2C3630",
              outline: "none", fontFamily: "'Noto Sans KR', sans-serif", marginBottom: 14,
            }} />
            <div style={{ fontSize: 13, fontWeight: 700, color: "#2C3630", marginBottom: 8 }}>시간대</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: rescheduleTimeSlot === "직접 입력" ? 8 : 14 }}>
              {VISIT_TIME_SLOTS.map((t) => (
                <button key={t} type="button" onClick={() => setRescheduleTimeSlot(t)} style={{
                  padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: rescheduleTimeSlot === t ? "#4A6355" : "#F8F9F7",
                  color: rescheduleTimeSlot === t ? "#fff" : "#3D4A42",
                  border: rescheduleTimeSlot === t ? "1.5px solid #4A6355" : "1px solid rgba(94,125,108,0.14)",
                  cursor: "pointer",
                }}>{t}</button>
              ))}
            </div>
            {rescheduleTimeSlot === "직접 입력" && (
              <input type="text" value={rescheduleCustomTime} onChange={(e) => setRescheduleCustomTime(e.target.value)}
                placeholder="예: 9시-10시" style={{
                  width: "100%", padding: "10px 12px", borderRadius: 10,
                  border: "1.5px solid #B3CCBE", fontSize: 14, color: "#2C3630",
                  outline: "none", fontFamily: "'Noto Sans KR', sans-serif", marginBottom: 14,
                }} />
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => setShowReschedule(false)} style={{
                flex: 1, padding: "12px", borderRadius: 10, fontSize: 14, fontWeight: 600,
                background: "#F8F9F7", color: "#3D4A42",
                border: "1px solid rgba(94,125,108,0.14)", cursor: "pointer",
              }}>취소</button>
              <button type="button" onClick={handleReschedule} disabled={!rescheduleDate} style={{
                flex: 1, padding: "12px", borderRadius: 10, fontSize: 14, fontWeight: 700,
                background: !rescheduleDate ? "#B3CCBE" : "#4A6355", color: "#fff",
                border: "none", cursor: "pointer",
              }}>변경 요청</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
         방문전 리포트 사이드 패널 (데스크톱 전용)
         ══════════════════════════════════════════ */}
      {showReportPanel && (
        <>
          <style>{`
            .chat-report-panel {
              display: flex; flex-direction: column;
              position: fixed; top: 0; right: 0; left: 0; bottom: 0;
              width: 100%; height: 100dvh;
              background: #fff; z-index: 150;
              overflow: hidden;
            }
            @media (min-width: 1200px) {
              .chat-report-panel {
                top: 60px; left: auto; bottom: auto;
                width: 400px; height: calc(100vh - 60px);
                box-shadow: -4px 0 24px rgba(0,0,0,0.10);
                border-left: 1px solid rgba(94,125,108,0.14);
              }
            }
            @media (min-width: 1600px) {
              .chat-report-panel { width: 500px; }
            }
          `}</style>
          <aside className="chat-report-panel">
            {/* 헤더 */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "12px 16px", borderBottom: "1px solid #E5E7E3",
              flexShrink: 0, background: "#F8F9F7",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 16, color: "#4A6355", fontFamily: "'Gothic A1', sans-serif" }}>
                  방문전 리포트
                </span>
                {rptBadgeVisible && (
                  <span style={{
                    padding: "2px 10px", borderRadius: 100, fontSize: 12, fontWeight: 700,
                    background: "#4A6355", color: "#fff",
                  }}>✓ 전송 완료</span>
                )}
              </div>
              <button type="button" onClick={() => { setShowReportPanel(false); setRptSent(false); setRptBadgeVisible(false); setRptShowConfirm(false); }} aria-label="닫기"
                style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#3D4A42", padding: 8, lineHeight: 1 }}>
                ✕
              </button>
            </div>

            {/* 리포트 내용 */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px", fontFamily: "'Noto Sans KR', sans-serif" }}>

              {/* 환자 정보 요약 */}
              <div style={{
                background: "linear-gradient(135deg, #EDF4F0 0%, #fff 100%)",
                borderRadius: 14, padding: "14px 16px",
                border: "1px solid #B3CCBE", marginBottom: 16,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: "#4A6355", fontFamily: "'Gothic A1', sans-serif" }}>김○○</span>
                  <span style={{ fontSize: 14, color: "#3D4A42" }}>여성 · 30대</span>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "2px 8px", borderRadius: 100,
                    fontSize: 12, fontWeight: 600, background: "#EDF4F0", color: "#4A6355",
                    marginLeft: "auto",
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4CAF50" }} />
                    상담 중
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                  {["만성피로", "수면장애", "소화불량"].map((s) => (
                    <span key={s} style={{
                      padding: "3px 10px", borderRadius: 100,
                      fontSize: 12, fontWeight: 600,
                      background: "#EDF4F0", color: "#4A6355",
                    }}>{s}</span>
                  ))}
                </div>
                <div style={{ fontSize: 13, color: "#5E7D6C" }}>6개월 이상 · 불편 정도 4/5</div>
              </div>

              {/* 영양 성분 방향 */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: rptNutritionEnabled ? 8 : 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#2C3630" }}>영양 성분 방향</div>
                  <button type="button" role="switch" aria-checked={rptNutritionEnabled}
                    onClick={() => setRptNutritionEnabled((v) => !v)}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                    <span style={{
                      position: "relative", display: "block", width: 40, height: 22, borderRadius: 11,
                      background: rptNutritionEnabled ? "#4A6355" : "#C4C4C4", transition: "background 0.2s",
                    }}>
                      <span style={{
                        position: "absolute", top: 2, left: rptNutritionEnabled ? 20 : 2,
                        width: 18, height: 18, borderRadius: "50%", background: "#fff",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s",
                      }} />
                    </span>
                  </button>
                </div>
                {rptNutritionEnabled ? (
                  <>
                    <p style={{ fontSize: 13, color: "#3D4A42", marginBottom: 8 }}>
                      도움이 될 영양 성분 영역을 선택해주세요.
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {rptNutrition.map((n) => (
                        <button key={n.id} type="button" onClick={() => rptToggleNutrition(n.id)}
                          style={{
                            padding: "8px 14px", borderRadius: 10, fontSize: 14, fontWeight: 600,
                            border: n.checked ? "1.5px solid #4A6355" : "1.5px solid rgba(94,125,108,0.14)",
                            background: n.checked ? "#EDF4F0" : "#fff",
                            color: n.checked ? "#4A6355" : "#3D4A42",
                            cursor: "pointer", transition: "all 0.15s",
                          }}>
                          {n.checked && <span style={{ marginRight: 4 }}>✓</span>}
                          {n.label}
                        </button>
                      ))}
                      <button type="button" onClick={() => setRptNutritionEtc(!rptNutritionEtc)}
                        style={{
                          padding: "8px 14px", borderRadius: 10, fontSize: 14, fontWeight: 600,
                          border: rptNutritionEtc ? "1.5px solid #4A6355" : "1.5px solid rgba(94,125,108,0.14)",
                          background: rptNutritionEtc ? "#EDF4F0" : "#fff",
                          color: rptNutritionEtc ? "#4A6355" : "#3D4A42",
                          cursor: "pointer", transition: "all 0.15s",
                        }}>
                        {rptNutritionEtc && <span style={{ marginRight: 4 }}>✓</span>}기타
                      </button>
                    </div>
                    {rptNutritionEtc && (
                      <input type="text" value={rptNutritionEtcText}
                        onChange={(e) => setRptNutritionEtcText(e.target.value)}
                        placeholder="직접 입력 (예: 오메가3)"
                        style={{
                          marginTop: 8, width: "100%", padding: "10px 12px", borderRadius: 10,
                          border: "1.5px solid rgba(94,125,108,0.14)", fontSize: 14,
                          color: "#2C3630", background: "#fff", outline: "none", boxSizing: "border-box",
                        }} />
                    )}
                  </>
                ) : (
                  <p style={{ fontSize: 14, color: "#3D4A42", marginTop: 6 }}>코멘트만 전송합니다</p>
                )}
              </div>

              <div style={{ height: 1, background: "#E5E7E3", marginBottom: 16 }} />

              {/* 생활 습관 추천 */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#2C3630", marginBottom: 8 }}>생활 습관 추천</div>
                <p style={{ fontSize: 13, color: "#3D4A42", marginBottom: 10 }}>
                  카테고리를 선택 후 세부 항목을 체크해주세요.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                  {rptLifestyle.map((cat) => (
                    <button key={cat.id} type="button" onClick={() => rptToggleLifestyle(cat.id)}
                      style={{
                        padding: "8px 14px", borderRadius: 10, fontSize: 14, fontWeight: 600,
                        border: cat.selected ? "1.5px solid #4A6355" : "1.5px solid rgba(94,125,108,0.14)",
                        background: cat.selected ? "#EDF4F0" : "#fff",
                        color: cat.selected ? "#4A6355" : "#3D4A42",
                        cursor: "pointer", transition: "all 0.15s",
                      }}>
                      {cat.title}
                    </button>
                  ))}
                  <button type="button" onClick={() => setRptLifestyleEtc(!rptLifestyleEtc)}
                    style={{
                      padding: "8px 14px", borderRadius: 10, fontSize: 14, fontWeight: 600,
                      border: rptLifestyleEtc ? "1.5px solid #4A6355" : "1.5px solid rgba(94,125,108,0.14)",
                      background: rptLifestyleEtc ? "#EDF4F0" : "#fff",
                      color: rptLifestyleEtc ? "#4A6355" : "#3D4A42",
                      cursor: "pointer", transition: "all 0.15s",
                    }}>
                    {rptLifestyleEtc && <span style={{ marginRight: 4 }}>✓</span>}기타
                  </button>
                </div>

                {rptLifestyle.filter((c) => c.selected).map((cat) => (
                  <div key={cat.id} style={{
                    padding: "12px 14px", borderRadius: 12,
                    background: "#F8F9F7", border: "1px solid rgba(94,125,108,0.14)",
                    marginBottom: 8,
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#4A6355", marginBottom: 8 }}>{cat.title}</div>
                    {cat.items.map((item, ii) => (
                      <label key={ii} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, cursor: "pointer" }}>
                        <input type="checkbox" checked={item.checked} onChange={() => rptToggleLifestyleItem(cat.id, ii)}
                          style={{ display: "none" }} />
                        <span style={{
                          width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          border: item.checked ? "none" : "1.5px solid rgba(94,125,108,0.25)",
                          background: item.checked ? "#4A6355" : "#fff",
                        }}>
                          {item.checked && (
                            <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                              <path d="M1 5L4.5 8.5L11 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                        <span style={{ fontSize: 14, color: "#3D4A42" }}>{item.label}</span>
                      </label>
                    ))}
                    <input type="text" value={rptLifestyleEtcTexts[cat.id] || ""}
                      onChange={(e) => setRptLifestyleEtcTexts((prev) => ({ ...prev, [cat.id]: e.target.value }))}
                      placeholder="기타 — 직접 입력"
                      style={{
                        marginTop: 4, width: "100%", padding: "8px 10px", borderRadius: 8,
                        border: "1.5px solid rgba(94,125,108,0.14)", fontSize: 13,
                        color: "#2C3630", background: "#fff", outline: "none", boxSizing: "border-box",
                      }} />
                  </div>
                ))}

                {rptLifestyleEtc && (
                  <div style={{
                    padding: "12px 14px", borderRadius: 12,
                    background: "#F8F9F7", border: "1px solid rgba(94,125,108,0.14)", marginTop: 4,
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#4A6355", marginBottom: 8 }}>기타</div>
                    {rptLifestyleEtcItems.map((item, idx) => (
                      <div key={idx} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                        <input type="text" value={item}
                          onChange={(e) => rptUpdateLifestyleEtcItem(idx, e.target.value)}
                          placeholder="직접 입력"
                          style={{
                            flex: 1, padding: "8px 10px", borderRadius: 8,
                            border: "1.5px solid rgba(94,125,108,0.14)", fontSize: 13,
                            color: "#2C3630", background: "#fff", outline: "none", boxSizing: "border-box",
                          }} />
                        {rptLifestyleEtcItems.length > 1 && (
                          <button type="button" onClick={() => rptRemoveLifestyleEtcItem(idx)}
                            style={{
                              width: 26, height: 26, borderRadius: "50%",
                              background: "rgba(0,0,0,0.08)", color: "#3D4A42",
                              border: "none", fontSize: 13, cursor: "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              flexShrink: 0, padding: 0,
                            }} aria-label="삭제">✕</button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={rptAddLifestyleEtcItem}
                      style={{
                        width: "100%", padding: "6px 0", borderRadius: 8, fontSize: 13,
                        fontWeight: 600, background: "none", color: "#4A6355",
                        border: "1px dashed #B3CCBE", cursor: "pointer",
                      }}>+ 항목 추가</button>
                  </div>
                )}
              </div>

              <div style={{ height: 1, background: "#E5E7E3", marginBottom: 16 }} />

              {/* 약사 코멘트 */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#2C3630", marginBottom: 8 }}>
                  약사 코멘트 <span style={{ fontSize: 13, fontWeight: 500, color: "#3D4A42" }}>(선택)</span>
                </div>
                <textarea
                  value={rptComment}
                  onChange={(e) => setRptComment(e.target.value)}
                  placeholder="예: 수면 패턴 개선이 가장 우선이에요. 2주 후 경과를 알려주세요."
                  maxLength={300}
                  rows={3}
                  style={{
                    width: "100%", padding: "12px 14px", borderRadius: 12,
                    border: "1.5px solid rgba(94,125,108,0.14)", fontSize: 14,
                    color: "#2C3630", outline: "none", resize: "vertical",
                    fontFamily: "'Noto Sans KR', sans-serif", boxSizing: "border-box",
                  }}
                />
                <div style={{ fontSize: 12, color: "#3D4A42", textAlign: "right", marginTop: 4 }}>
                  {rptComment.length}/300
                </div>
              </div>

              {/* 자동 포함 안내 — 편집 가능 */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 15, lineHeight: 1 }}>📋</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#4A6355" }}>자동 포함 안내 문구</span>
                </div>
                <textarea
                  value={rptAutoText}
                  onChange={(e) => { if (e.target.value.length <= 100) setRptAutoText(e.target.value); }}
                  rows={2}
                  style={{
                    width: "100%", padding: 10,
                    border: "1px solid rgba(94,125,108,0.14)",
                    borderRadius: 10,
                    fontSize: 14, color: "#3D4A42",
                    minHeight: 50, outline: "none",
                    resize: "vertical",
                    fontFamily: "'Noto Sans KR', sans-serif",
                    lineHeight: 1.55,
                    boxSizing: "border-box",
                  }}
                />
                <div style={{ fontSize: 12, color: "#3D4A42", textAlign: "right", marginTop: 4 }}>
                  {rptAutoText.length}/100
                </div>
              </div>

              {/* 전송 버튼 */}
              <button type="button"
                onClick={rptSent ? undefined : () => setRptShowConfirm(true)}
                disabled={rptSent}
                style={{
                  width: "100%", padding: "14px 0", borderRadius: 12,
                  fontSize: 15, fontWeight: 700,
                  background: rptSent ? "#B3CCBE" : "#4A6355", color: "#fff",
                  border: "none", cursor: rptSent ? "default" : "pointer", marginBottom: 24,
                }}>
                {rptSent ? "전송 완료 ✓" : "리포트 전송"}
              </button>
            </div>

            {/* 전송 확인 — 패널 내부 overlay */}
            {rptShowConfirm && (
              <div style={{
                position: "absolute", inset: 0, zIndex: 20,
                background: "rgba(0,0,0,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }} onClick={() => setRptShowConfirm(false)}>
                <div style={{
                  background: "#fff", borderRadius: 16, padding: "28px 24px 24px",
                  maxWidth: 300, width: "85%", textAlign: "center",
                  boxShadow: "0 6px 24px rgba(0,0,0,0.15)",
                }} onClick={(e) => e.stopPropagation()}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>📋</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#2C3630", marginBottom: 6, fontFamily: "'Noto Sans KR', sans-serif" }}>
                    리포트를 전송하시겠습니까?
                  </div>
                  <div style={{ fontSize: 13, color: "#3D4A42", lineHeight: 1.6, marginBottom: 18 }}>
                    전송 후에는 수정이 어렵습니다. 내용을 다시 한번 확인해주세요.
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" onClick={() => setRptShowConfirm(false)} style={{
                      flex: 1, padding: "11px", borderRadius: 10, fontSize: 14, fontWeight: 600,
                      background: "#F8F9F7", color: "#3D4A42", border: "1px solid rgba(94,125,108,0.14)", cursor: "pointer",
                    }}>취소</button>
                    <button type="button" onClick={handleRptSend} style={{
                      flex: 1, padding: "11px", borderRadius: 10, fontSize: 14, fontWeight: 700,
                      background: "#4A6355", color: "#fff", border: "none", cursor: "pointer",
                    }}>전송하기</button>
                  </div>
                </div>
              </div>
            )}
          </aside>
        </>
      )}

      {/* ══════════════════════════════════════════
         환자 23문항 전체 보기 사이드 패널 (약사 전용 — pending 시)
         ══════════════════════════════════════════ */}
      {showQuestionnairePanel && consultationPending && role === "pharmacist" && pendingQuestionnaire && (
        <>
          <style>{`
            .chat-questionnaire-panel {
              display: flex; flex-direction: column;
              position: fixed; top: 0; right: 0; left: 0; bottom: 0;
              width: 100%; height: 100dvh;
              background: #fff; z-index: 150;
              overflow: hidden;
            }
            @media (min-width: 1200px) {
              .chat-questionnaire-panel {
                top: 60px; left: auto; bottom: auto;
                width: 400px; height: calc(100vh - 60px);
                box-shadow: -4px 0 24px rgba(0,0,0,0.10);
                border-left: 1px solid rgba(94,125,108,0.14);
              }
            }
            @media (min-width: 1600px) {
              .chat-questionnaire-panel { width: 500px; }
            }
          `}</style>
          <aside className="chat-questionnaire-panel">
            {/* 헤더 */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "12px 16px", borderBottom: "1px solid #E5E7E3",
              flexShrink: 0, background: "#F8F9F7",
            }}>
              <span style={{
                fontWeight: 700, fontSize: 16, color: "#4A6355",
                fontFamily: "'Gothic A1', sans-serif",
              }}>
                환자 문답 전체 보기
              </span>
              <button
                type="button"
                onClick={() => setShowQuestionnairePanel(false)}
                aria-label="닫기"
                style={{
                  background: "none", border: "none", fontSize: 20,
                  cursor: "pointer", color: "#3D4A42", padding: 8, lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            {/* 본문 — scrollable */}
            <div style={{
              flex: 1, overflowY: "auto",
              padding: "16px",
              fontFamily: "'Noto Sans KR', sans-serif",
            }}>
              {(() => {
                const detailed = pendingQuestionnaire.detailed_answers;

                // AI 요약 (있을 때만 상단에 강조)
                const aiSummary = pendingQuestionnaire.ai_summary?.trim();

                // detailed_answers 가 비어있으면 (legacy) 폴백: 컬럼화된 필드 4개만 간단 표시
                if (!detailed || Object.keys(detailed).length === 0) {
                  const symptomsArr = Array.isArray(pendingQuestionnaire.symptoms)
                    ? pendingQuestionnaire.symptoms
                    : [];
                  const fallback: Array<{ label: string; value: string }> = [
                    { label: "주요 증상", value: symptomsArr.length > 0 ? symptomsArr.join(", ") : "—" },
                    { label: "증상 기간", value: pendingQuestionnaire.symptom_duration?.trim() || "—" },
                    { label: "불편도", value: getSeverityDisplay(pendingQuestionnaire) },
                    { label: "약사에게 전하고 싶은 말", value: pendingQuestionnaire.free_text?.trim() || "—" },
                  ];
                  return (
                    <>
                      {aiSummary && (
                        <div style={{
                          background: "#EDF4F0",
                          border: "1px solid rgba(94,125,108,0.18)",
                          borderRadius: 12,
                          padding: "12px 14px",
                          marginBottom: 16,
                          fontSize: 15, color: "#3D4A42", lineHeight: 1.6,
                        }}>
                          <div style={{
                            fontSize: 13, fontWeight: 700, color: "#4A6355",
                            marginBottom: 6,
                          }}>
                            AI 요약
                          </div>
                          {aiSummary}
                        </div>
                      )}
                      <div style={{
                        fontSize: 13, color: "#7A8A80", marginBottom: 10,
                      }}>
                        문답 상세가 누락된 옛 데이터 — 요약 정보만 표시합니다.
                      </div>
                      {fallback.map((row) => (
                        <div
                          key={row.label}
                          style={{
                            padding: "12px 14px",
                            borderRadius: 10,
                            border: "1px solid rgba(94,125,108,0.14)",
                            marginBottom: 10,
                          }}
                        >
                          <div style={{
                            fontSize: 13, fontWeight: 700, color: "#4A6355",
                            marginBottom: 4,
                          }}>
                            {row.label}
                          </div>
                          <div style={{
                            fontSize: 14, color: "#2C3630", lineHeight: 1.5,
                            whiteSpace: "pre-wrap",
                          }}>
                            {row.value}
                          </div>
                        </div>
                      ))}
                    </>
                  );
                }

                // 일반 흐름: 23문항 카드 리스트
                const visibleQuestions = ALL_QUESTIONS.filter(
                  (q) => !q.condition || q.condition(detailed),
                );
                return (
                  <>
                    {aiSummary && (
                      <div style={{
                        background: "#EDF4F0",
                        border: "1px solid rgba(94,125,108,0.18)",
                        borderRadius: 12,
                        padding: "12px 14px",
                        marginBottom: 16,
                        fontSize: 15, color: "#3D4A42", lineHeight: 1.6,
                      }}>
                        <div style={{
                          fontSize: 13, fontWeight: 700, color: "#4A6355",
                          marginBottom: 6,
                        }}>
                          AI 요약
                        </div>
                        {aiSummary}
                      </div>
                    )}
                    {visibleQuestions.map((q, idx) => {
                      const ans = formatQuestionAnswer(q, detailed[q.id]);
                      // q.title 은 <br/> 포함된 HTML — 패널에선 평문으로 변환
                      const titleText = q.title.replace(/<br\s*\/?>/gi, " ");
                      return (
                        <div
                          key={q.id}
                          style={{
                            padding: "12px 14px",
                            borderRadius: 10,
                            border: "1px solid rgba(94,125,108,0.14)",
                            marginBottom: 10,
                            background: "#fff",
                          }}
                        >
                          <div style={{
                            fontSize: 13, fontWeight: 700, color: "#4A6355",
                            marginBottom: 4,
                          }}>
                            Q{idx + 1}. {titleText}
                          </div>
                          <div style={{
                            fontSize: 14, color: "#2C3630", lineHeight: 1.5,
                            whiteSpace: "pre-wrap",
                          }}>
                            {ans}
                          </div>
                        </div>
                      );
                    })}
                  </>
                );
              })()}
            </div>
          </aside>
        </>
      )}

      {/* ══════════════════════════════════════════
         환자 차트 사이드 패널 (약사 전용)
         ══════════════════════════════════════════ */}
      {showChartPanel && role === "pharmacist" && (
        <>
          <style>{`
            .chat-patient-chart-panel { display: none; }
            @media (min-width: 1200px) {
              .chat-patient-chart-panel {
                display: flex; flex-direction: column;
                position: fixed; top: 60px; right: 0;
                width: 400px; height: calc(100vh - 60px);
                background: #fff; z-index: 100;
                box-shadow: -4px 0 24px rgba(0,0,0,0.10);
                border-left: 1px solid rgba(94,125,108,0.14);
                overflow: hidden;
              }
            }
            @media (min-width: 1600px) {
              .chat-patient-chart-panel { width: 500px; }
            }
          `}</style>
          <aside className="chat-patient-chart-panel">
            {/* 헤더 */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "12px 16px", borderBottom: "1px solid #E5E7E3",
              flexShrink: 0, background: "#F8F9F7",
            }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: "#4A6355", fontFamily: "'Gothic A1', sans-serif" }}>
                환자 차트
              </span>
              <button type="button" onClick={() => setShowChartPanel(false)} aria-label="닫기"
                style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#3D4A42", padding: 8, lineHeight: 1 }}>
                ✕
              </button>
            </div>

            {/* 내용 */}
            <div style={{ flex: 1, overflowY: "auto", padding: 16, fontFamily: "'Noto Sans KR', sans-serif" }}>
              {/* 기본 정보 */}
              <div style={{
                background: "linear-gradient(135deg, #EDF4F0 0%, #fff 100%)",
                borderRadius: 14, padding: "14px 16px",
                border: "1px solid #B3CCBE", marginBottom: 14,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 17, fontWeight: 800, color: "#4A6355", fontFamily: "'Gothic A1', sans-serif" }}>김○○</span>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "2px 8px", borderRadius: 100,
                    fontSize: 12, fontWeight: 600, background: "#EDF4F0", color: "#4A6355",
                    marginLeft: "auto",
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4CAF50" }} />
                    상담 중
                  </span>
                </div>
                <div style={{ fontSize: 14, color: "#3D4A42", lineHeight: 1.6 }}>
                  여성 · 1993년생 (33세) · 162cm · 54kg
                </div>
                <div style={{ fontSize: 12, color: "#5E7D6C", marginTop: 4 }}>
                  기록: 2026.04.18
                </div>
              </div>

              {/* 예산 */}
              <div style={{ marginBottom: 14, padding: "10px 14px", background: "#F8F9F7", borderRadius: 10, border: "1px solid rgba(94,125,108,0.14)" }}>
                <div style={{ fontSize: 12, color: "#5E7D6C", marginBottom: 2 }}>예산</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#2C3630" }}>월 5~10만원</div>
              </div>

              {/* 증상 */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#4A6355", marginBottom: 8 }}>증상 (3)</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {[
                    { label: "만성피로", status: "개선 중", bg: "#EAF3DE", color: "#3B6D11", duration: "약 6개월째" },
                    { label: "불면/수면", status: "상담 중", bg: "#E6F1FB", color: "#185FA5", duration: "약 2개월째" },
                    { label: "소화장애", status: "해결됨", bg: "#FAEEDA", color: "#854F0B", duration: "2026.04.08" },
                  ].map((s, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "8px 12px", borderRadius: 10,
                      background: s.status === "해결됨" ? "#F8F9F7" : "#fff",
                      border: "1px solid rgba(94,125,108,0.14)",
                      flexWrap: "wrap",
                    }}>
                      <span style={{ padding: "3px 10px", borderRadius: 100, fontSize: 12, fontWeight: 600, background: s.bg, color: s.color }}>{s.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: s.status === "해결됨" ? "#3D4A42" : "#C06B45" }}>· {s.status}</span>
                      <span style={{ fontSize: 12, color: "#5E7D6C", marginLeft: "auto" }}>{s.duration}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 상세 정보 */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#4A6355", marginBottom: 8 }}>상세 정보</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    { label: "직업", value: "사무직 (야근 잦음)" },
                    { label: "생활습관", value: "운동 거의 안 함" },
                    { label: "식습관", value: "불규칙, 점심·저녁 위주" },
                    { label: "수면", value: "평균 5~6시간, 새벽 각성" },
                    { label: "음주", value: "주 2회" },
                    { label: "흡연", value: "비흡연" },
                    { label: "카페인", value: "하루 2~3잔 (민감)" },
                  ].map((d) => (
                    <div key={d.label} style={{ padding: "10px 12px", background: "#F8F9F7", borderRadius: 8, border: "1px solid rgba(94,125,108,0.10)" }}>
                      <div style={{ fontSize: 12, color: "#5E7D6C", marginBottom: 2 }}>{d.label}</div>
                      <div style={{ fontSize: 14, color: "#2C3630", lineHeight: 1.5 }}>{d.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 방문 기록 */}
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#4A6355", marginBottom: 8 }}>방문 기록</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {[
                    { date: "2026.04.12", summary: "비타민B군, 마그네슘 · 30일치" },
                    { date: "2026.03.20", summary: "유산균, 소화효소 · 30일치" },
                  ].map((v, i) => (
                    <div key={i} style={{ padding: "10px 12px", borderRadius: 8, background: "#F4F6F3", border: "1px solid rgba(94,125,108,0.14)" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#2C3630" }}>{v.date}</div>
                      <div style={{ fontSize: 13, color: "#3D4A42", marginTop: 2 }}>{v.summary}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </>
      )}

      {/* 추가 질문 답변 오버레이 (환자 전용) */}
      {answeringMsg && (() => {
        const set = QUESTIONNAIRE_SETS.find((s) => s.id === answeringMsg.setId);
        if (!set) return null;
        const allAnswered = set.questions.every((q, i) => {
          const a = answerDraft[i] ?? "";
          return a.trim().length > 0;
        });
        return (
          <div style={{
            position: "fixed", inset: 0, zIndex: 210,
            background: "#fff",
            display: "flex", flexDirection: "column",
            fontFamily: "'Noto Sans KR', sans-serif",
          }}>
            {/* 헤더 */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "12px 16px",
              borderBottom: "1px solid rgba(94,125,108,0.14)",
              background: "#F8F9F7",
              flexShrink: 0,
            }}>
              <button
                type="button"
                onClick={closeAnswerForm}
                aria-label="닫기"
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: 20, color: "#2C3630", padding: 6, lineHeight: 1,
                }}
              >✕</button>
              <div style={{ flex: 1, fontSize: 16, fontWeight: 700, color: "#2C3630", fontFamily: "'Gothic A1', sans-serif" }}>
                추가 질문 답변
              </div>
              <div style={{ fontSize: 13, color: "#4A6355", fontWeight: 600 }}>
                {set.questions.filter((_, i) => (answerDraft[i] ?? "").trim().length > 0).length}/{set.questions.length}
              </div>
            </div>

            {/* 질문 목록 */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px 120px" }}>
              <div style={{ maxWidth: 560, margin: "0 auto" }}>
                <div style={{
                  padding: "12px 14px", background: "#EDF4F0", borderRadius: 10,
                  border: "1px solid #B3CCBE", marginBottom: 20,
                  fontSize: 14, color: "#4A6355", fontWeight: 600,
                }}>
                  {set.name} · 질문 {set.questions.length}개
                </div>

                {set.questions.map((q, i) => {
                  const ans = answerDraft[i] ?? "";
                  const multiAnsSet = new Set(ans ? ans.split(",").filter(Boolean) : []);
                  return (
                    <div key={i} style={{ marginBottom: 24 }}>
                      {/* 질문 헤더 */}
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                        <span style={{
                          width: 28, height: 28, borderRadius: "50%",
                          background: "#4A6355", color: "#fff",
                          fontSize: 14, fontWeight: 700,
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0,
                        }}>{i + 1}</span>
                        <div style={{ flex: 1, fontSize: 16, fontWeight: 600, color: "#2C3630", lineHeight: 1.55, paddingTop: 3 }}>
                          {q.text}
                        </div>
                      </div>

                      {/* 답변 입력 */}
                      {q.type === "주관식" && (
                        <textarea
                          value={ans}
                          onChange={(e) => updateAnswerDraft(i, e.target.value)}
                          placeholder="답변을 입력해주세요"
                          rows={3}
                          style={{
                            width: "100%", padding: 12,
                            borderRadius: 12,
                            border: "1px solid rgba(94,125,108,0.14)",
                            fontSize: 15, color: "#2C3630",
                            background: "#fff", outline: "none",
                            resize: "vertical", minHeight: 80,
                            fontFamily: "'Noto Sans KR', sans-serif",
                            lineHeight: 1.6, boxSizing: "border-box",
                          }}
                        />
                      )}

                      {q.type === "객관식" && q.choices && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {q.choices.map((choice) => {
                            const selected = ans === choice;
                            return (
                              <button
                                key={choice}
                                type="button"
                                onClick={() => updateAnswerDraft(i, choice)}
                                style={{
                                  width: "100%", padding: "12px 16px",
                                  borderRadius: 12,
                                  border: `1px solid ${selected ? "#4A6355" : "rgba(94,125,108,0.14)"}`,
                                  background: selected ? "#EDF4F0" : "#fff",
                                  color: "#2C3630",
                                  fontSize: 15, fontWeight: selected ? 700 : 500,
                                  cursor: "pointer", textAlign: "left",
                                  transition: "all 0.15s",
                                  fontFamily: "'Noto Sans KR', sans-serif",
                                }}
                              >{choice}</button>
                            );
                          })}
                        </div>
                      )}

                      {q.type === "다중 선택" && q.choices && (
                        <>
                          <div style={{ fontSize: 12, color: "#5E7D6C", marginBottom: 6 }}>여러 개 선택할 수 있어요</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {q.choices.map((choice) => {
                              const selected = multiAnsSet.has(choice);
                              return (
                                <button
                                  key={choice}
                                  type="button"
                                  onClick={() => toggleMultiAnswer(i, choice)}
                                  style={{
                                    width: "100%", padding: "12px 16px",
                                    borderRadius: 12,
                                    border: `1px solid ${selected ? "#4A6355" : "rgba(94,125,108,0.14)"}`,
                                    background: selected ? "#EDF4F0" : "#fff",
                                    color: "#2C3630",
                                    fontSize: 15, fontWeight: selected ? 700 : 500,
                                    cursor: "pointer", textAlign: "left",
                                    transition: "all 0.15s",
                                    fontFamily: "'Noto Sans KR', sans-serif",
                                    display: "flex", alignItems: "center", gap: 10,
                                  }}
                                >
                                  <span style={{
                                    width: 18, height: 18, borderRadius: 4,
                                    border: `1.5px solid ${selected ? "#4A6355" : "#B3CCBE"}`,
                                    background: selected ? "#4A6355" : "#fff",
                                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                                    color: "#fff", fontSize: 12, fontWeight: 700,
                                    flexShrink: 0,
                                  }}>{selected ? "✓" : ""}</span>
                                  {choice}
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 하단 제출 바 */}
            <div style={{
              position: "fixed", bottom: 0, left: 0, right: 0,
              padding: "14px 16px",
              background: "rgba(255,255,255,0.96)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              borderTop: "1px solid rgba(94,125,108,0.14)",
              zIndex: 1,
            }}>
              <div style={{ maxWidth: 560, margin: "0 auto" }}>
                <button
                  type="button"
                  onClick={submitAnswer}
                  disabled={!allAnswered}
                  style={{
                    width: "100%", padding: "14px 0", borderRadius: 12,
                    fontSize: 15, fontWeight: 700,
                    background: allAnswered ? "#4A6355" : "#B3CCBE",
                    color: "#fff", border: "none",
                    cursor: allAnswered ? "pointer" : "default",
                    fontFamily: "'Noto Sans KR', sans-serif",
                  }}
                >
                  제출하기
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 상담 종료 확인 모달 (환자/약사 공용 — role 로 본문/액션 분기) */}
      {showEndConfirm && (
        <div
          onClick={() => {
            // 약사 모드: 외부 클릭으로 닫히지 않음 (실수 방지)
            if (role === "pharmacist") return;
            if (!endingConsult) { setShowEndConfirm(false); setEndError(null); }
          }}
          style={{
            position: "fixed", inset: 0, zIndex: 300,
            background: "rgba(0,0,0,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: 16, padding: "28px 24px 24px",
              maxWidth: 320, width: "100%", textAlign: "center",
              boxShadow: "0 6px 24px rgba(0,0,0,0.15)",
              fontFamily: "'Noto Sans KR', sans-serif",
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 10 }}>👋</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#2C3630", marginBottom: 8 }}>
              상담을 종료하시겠습니까?
            </div>
            <div style={{ fontSize: 14, color: "#3D4A42", lineHeight: 1.6, marginBottom: 18 }}>
              {role === "pharmacist"
                ? "환자에게는 시스템 메시지로 종료 안내가 표시됩니다."
                : "종료 후에는 같은 약사님과 새로 상담 요청해야 해요."}
            </div>
            {endError && (
              <div style={{
                fontSize: 13, color: "#D02F2F", background: "#FFF3F3",
                border: "1px solid #F5C8C8", padding: "8px 10px",
                borderRadius: 8, marginBottom: 12, lineHeight: 1.5,
              }}>
                {endError}
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => { if (!endingConsult) { setShowEndConfirm(false); setEndError(null); } }}
                disabled={endingConsult}
                style={{
                  flex: 1, padding: "11px", borderRadius: 10, fontSize: 14, fontWeight: 600,
                  background: "#F8F9F7", color: "#3D4A42",
                  border: "1px solid rgba(94,125,108,0.14)",
                  cursor: endingConsult ? "default" : "pointer",
                  opacity: endingConsult ? 0.6 : 1,
                }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={role === "pharmacist" ? confirmPharmacistEnd : confirmPatientEnd}
                disabled={endingConsult}
                style={{
                  flex: 1, padding: "11px", borderRadius: 10, fontSize: 14, fontWeight: 700,
                  background: "#4A6355", color: "#fff", border: "none",
                  cursor: endingConsult ? "default" : "pointer",
                  opacity: endingConsult ? 0.7 : 1,
                }}
              >
                {endingConsult ? "종료 중..." : "종료"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 거절 사유 선택 모달 (약사 전용 — pending 상담 거절) */}
      {showRejectConfirm && role === "pharmacist" && (() => {
        const reasons = [
          "일정이 어려워요",
          "전문 영역이 아니에요",
          "기타",
        ];
        return (
          <div
            // 약사 모드: 외부 클릭으로 닫히지 않음 (실수 방지) — endConfirm 약사 패턴 차용
            style={{
              position: "fixed", inset: 0, zIndex: 300,
              background: "rgba(0,0,0,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 20,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "#fff", borderRadius: 16, padding: "24px 22px 22px",
                maxWidth: 360, width: "100%",
                boxShadow: "0 6px 24px rgba(0,0,0,0.15)",
                fontFamily: "'Noto Sans KR', sans-serif",
              }}
            >
              <div style={{
                fontSize: 16, fontWeight: 700, color: "#2C3630",
                marginBottom: 8, textAlign: "center",
              }}>
                상담 요청을 거절할까요?
              </div>
              <div style={{
                fontSize: 14, color: "#3D4A42", lineHeight: 1.6,
                marginBottom: 16, textAlign: "center",
              }}>
                선택하신 사유는 서비스 개선에만 사용되고, 환자에게는 전달되지 않아요.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                {reasons.map((label) => {
                  const checked = rejectReason === label;
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setRejectReason(label)}
                      disabled={rejecting}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        width: "100%", minHeight: 48,
                        padding: "12px 14px",
                        background: checked ? "#EDF4F0" : "#fff",
                        border: checked
                          ? "1.5px solid #4A6355"
                          : "1px solid rgba(94, 125, 108, 0.14)",
                        borderRadius: 12,
                        cursor: rejecting ? "default" : "pointer",
                        textAlign: "left",
                        fontFamily: "'Noto Sans KR', sans-serif",
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          width: 18, height: 18, borderRadius: "50%",
                          border: checked ? "5px solid #4A6355" : "1.5px solid rgba(94, 125, 108, 0.35)",
                          background: "#fff",
                          flexShrink: 0,
                          boxSizing: "border-box",
                        }}
                      />
                      <span style={{
                        fontSize: 14, color: "#2C3630", fontWeight: checked ? 600 : 500,
                      }}>
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
              {rejectError && (
                <div style={{
                  fontSize: 14, color: "#C06B45",
                  marginBottom: 12, lineHeight: 1.5,
                }}>
                  {rejectError}
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => { if (!rejecting) { setShowRejectConfirm(false); setRejectError(null); } }}
                  disabled={rejecting}
                  style={{
                    flex: 1, padding: "12px", borderRadius: 10,
                    fontSize: 14, fontWeight: 600,
                    background: "#fff", color: "#3D4A42",
                    border: "1px solid rgba(94, 125, 108, 0.28)",
                    cursor: rejecting ? "default" : "pointer",
                    opacity: rejecting ? 0.6 : 1,
                    fontFamily: "'Noto Sans KR', sans-serif",
                  }}
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={rejectConsultation}
                  disabled={rejectReason === "" || rejecting}
                  style={{
                    flex: 1, padding: "12px", borderRadius: 10,
                    fontSize: 14, fontWeight: 700,
                    background: "#4A6355", color: "#fff", border: "none",
                    cursor: (rejectReason === "" || rejecting) ? "default" : "pointer",
                    opacity: (rejectReason === "" || rejecting) ? 0.55 : 1,
                    fontFamily: "'Noto Sans KR', sans-serif",
                  }}
                >
                  {rejecting ? "거절하는 중..." : "거절 보내기"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 수락 확인 모달 (약사 전용 — 본인 진행 중 active round 가 있을 때만 노출) */}
      {showAcceptConfirm && role === "pharmacist" && (
        <div
          // 약사 모드: 외부 클릭으로 닫히지 않음 (실수 방지)
          style={{
            position: "fixed", inset: 0, zIndex: 300,
            background: "rgba(0,0,0,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: 16, padding: "24px 22px 22px",
              maxWidth: 360, width: "100%",
              boxShadow: "0 6px 24px rgba(0,0,0,0.15)",
              fontFamily: "'Noto Sans KR', sans-serif",
            }}
          >
            <div style={{
              fontSize: 16, fontWeight: 700, color: "#2C3630",
              marginBottom: 10, textAlign: "center",
            }}>
              상담을 수락할까요?
            </div>
            <div style={{
              fontSize: 14, color: "#3D4A42", lineHeight: 1.6,
              marginBottom: 16, textAlign: "center",
            }}>
              이미 진행 중인 상담이 {pendingActiveCount}건 있어요. 새 환자와 동시에 상담하시겠습니까?
            </div>
            {acceptError && (
              <div style={{
                fontSize: 14, color: "#C06B45",
                marginBottom: 12, lineHeight: 1.5,
              }}>
                {acceptError}
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => { if (!accepting) { setShowAcceptConfirm(false); setAcceptError(null); } }}
                disabled={accepting}
                style={{
                  flex: 1, padding: "12px", borderRadius: 10,
                  fontSize: 14, fontWeight: 600,
                  background: "#fff", color: "#3D4A42",
                  border: "1px solid rgba(94, 125, 108, 0.28)",
                  cursor: accepting ? "default" : "pointer",
                  opacity: accepting ? 0.6 : 1,
                  fontFamily: "'Noto Sans KR', sans-serif",
                }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={acceptConsultation}
                disabled={accepting}
                style={{
                  flex: 1, padding: "12px", borderRadius: 10,
                  fontSize: 14, fontWeight: 700,
                  background: "#4A6355", color: "#fff", border: "none",
                  cursor: accepting ? "default" : "pointer",
                  opacity: accepting ? 0.7 : 1,
                  fontFamily: "'Noto Sans KR', sans-serif",
                }}
              >
                {accepting ? "수락하는 중..." : "수락하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 추가 질문 세트 선택 모달 (약사 전용) */}
      {showQSetPicker && role === "pharmacist" && (
        <div
          onClick={() => { setShowQSetPicker(false); setSelectedQSetId(null); }}
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
              background: "#fff", borderRadius: 16,
              padding: "22px 20px 20px",
              maxWidth: 420, width: "100%", maxHeight: "85vh", overflowY: "auto",
              boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
              fontFamily: "'Noto Sans KR', sans-serif",
            }}
          >
            <div style={{ fontSize: 17, fontWeight: 700, color: "#2C3630", marginBottom: 14, fontFamily: "'Gothic A1', sans-serif" }}>
              어떤 질문 세트를 보낼까요?
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              {QUESTIONNAIRE_SETS.map((s) => {
                const isSelected = selectedQSetId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedQSetId(s.id)}
                    style={{
                      textAlign: "left", width: "100%",
                      padding: 16, borderRadius: 12,
                      border: isSelected ? "1.5px solid #4A6355" : "1px solid rgba(94,125,108,0.14)",
                      background: isSelected ? "#F8F9F7" : "#fff",
                      cursor: "pointer", transition: "all 0.15s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 16, fontWeight: 600, color: "#2C3630" }}>{s.name}</span>
                      {s.isDefault && (
                        <span style={{
                          padding: "2px 8px", borderRadius: 8,
                          fontSize: 13, fontWeight: 700,
                          background: "#FFF8E1", color: "#F59E0B",
                        }}>
                          ★ 기본
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 14, color: "#3D4A42" }}>질문 {s.questions.length}개</div>
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => { setShowQSetPicker(false); setSelectedQSetId(null); }}
                style={{
                  flex: 1, padding: "12px 0", borderRadius: 10,
                  fontSize: 14, fontWeight: 600,
                  background: "#fff", color: "#3D4A42",
                  border: "1px solid rgba(94,125,108,0.14)",
                  cursor: "pointer",
                }}
              >취소</button>
              <button
                type="button"
                onClick={handleQSendClick}
                disabled={!selectedQSetId}
                style={{
                  flex: 1, padding: "12px 0", borderRadius: 10,
                  fontSize: 14, fontWeight: 700,
                  background: selectedQSetId ? "#4A6355" : "#B3CCBE",
                  color: "#fff", border: "none",
                  cursor: selectedQSetId ? "pointer" : "default",
                }}
              >전송</button>
            </div>
          </div>
        </div>
      )}

      {/* AI 답변 초안 모달 (약사 전용) */}
      {showAiDraftModal && (
        <div
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 200,
          }}
          onClick={() => setShowAiDraftModal(false)}
        >
          <div
            style={{
              background: "#fff", borderRadius: 20, padding: 24,
              maxWidth: 480, width: "90%", maxHeight: "80dvh",
              display: "flex", flexDirection: "column",
              boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: "linear-gradient(135deg, #4A6355, #7FA48E)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <span style={{ fontSize: 18 }}>🤖</span>
                </span>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#2C3630", fontFamily: "'Gothic A1', sans-serif" }}>
                    AI 답변 초안
                  </div>
                  <div style={{ fontSize: 13, color: "#5E7D6C" }}>환자 메시지를 분석하여 초안을 생성했어요</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAiDraftModal(false)}
                style={{
                  width: 32, height: 32, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "#F0F0F0", border: "none", cursor: "pointer",
                  fontSize: 16, color: "#666", flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>

            {/* 환자 메시지 */}
            <div style={{
              padding: "12px 14px", borderRadius: 12,
              background: "#F8F9F7", border: "1px solid rgba(94,125,108,0.14)",
              marginBottom: 16,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#3D4A42", marginBottom: 6 }}>환자 메시지</div>
              <div style={{ fontSize: 14, color: "#2C3630", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {aiDraftPatientMsg}
              </div>
            </div>

            {/* 답변 초안 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#2C3630", marginBottom: 8 }}>답변 초안</div>
              {aiDraftLoading ? (
                <div style={{
                  padding: "32px 16px", borderRadius: 12,
                  background: "#EDF4F0", border: "1.5px solid #B3CCBE",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
                }}>
                  <style>{`@keyframes ai-draft-spin { to { transform: rotate(360deg); } }`}</style>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%",
                    border: "3px solid #B3CCBE", borderTopColor: "#4A6355",
                    animation: "ai-draft-spin 0.8s linear infinite",
                  }} />
                  <div style={{ fontSize: 14, color: "#4A6355", fontWeight: 600 }}>AI가 초안을 작성 중이에요...</div>
                </div>
              ) : (
                <textarea
                  value={aiDraftText}
                  onChange={(e) => setAiDraftText(e.target.value)}
                  rows={7}
                  style={{
                    width: "100%", padding: "14px 16px", borderRadius: 12,
                    border: "1.5px solid #B3CCBE", fontSize: 14, color: "#2C3630",
                    outline: "none", resize: "vertical",
                    fontFamily: "'Noto Sans KR', sans-serif", lineHeight: 1.7,
                    background: "#fff", boxSizing: "border-box",
                  }}
                />
              )}
            </div>

            {/* 면책 */}
            <div style={{
              fontSize: 12, color: "#5E7D6C", textAlign: "center",
              padding: "6px 12px", borderRadius: 8,
              background: "#F8F9F7", marginBottom: 16,
            }}>
              AI 초안은 참고용이며, 전송 전 반드시 내용을 확인해주세요
            </div>

            {/* 액션 버튼 */}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  setShowAiDraftModal(false);
                  setTimeout(() => inputRef.current?.focus(), 100);
                }}
                style={{
                  flex: 1, padding: "12px", borderRadius: 12,
                  fontSize: 14, fontWeight: 600,
                  background: "#F8F9F7", color: "#3D4A42",
                  border: "1px solid rgba(94,125,108,0.14)", cursor: "pointer",
                }}
              >
                직접 작성
              </button>
              <button
                type="button"
                onClick={() => {
                  setInput(aiDraftText);
                  setShowAiDraftModal(false);
                  setTimeout(() => inputRef.current?.focus(), 100);
                }}
                disabled={aiDraftLoading}
                style={{
                  flex: 1, padding: "12px", borderRadius: 12,
                  fontSize: 14, fontWeight: 600,
                  background: aiDraftLoading ? "#B3CCBE" : "#EDF4F0", color: "#4A6355",
                  border: aiDraftLoading ? "none" : "1px solid #B3CCBE",
                  cursor: aiDraftLoading ? "default" : "pointer",
                }}
              >
                수정 후 전송
              </button>
              <button
                type="button"
                onClick={sendAiDraft}
                disabled={aiDraftLoading || !aiDraftText.trim()}
                style={{
                  flex: 1, padding: "12px", borderRadius: 12,
                  fontSize: 14, fontWeight: 700,
                  background: (aiDraftLoading || !aiDraftText.trim()) ? "#B3CCBE" : "#4A6355",
                  color: "#fff",
                  border: "none",
                  cursor: (aiDraftLoading || !aiDraftText.trim()) ? "default" : "pointer",
                }}
              >
                바로 전송
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
