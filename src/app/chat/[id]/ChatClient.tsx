"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter, useParams } from "next/navigation";

interface Message {
  id: string;
  sender: "patient" | "pharmacist";
  content: string;
  time: string;
  isRead: boolean;
  sessionId?: string;
  pharmacistOnly?: boolean;
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
];

const PHARMACIST_INFO = {
  name: "김서연 약사",
  pharmacy: "초록숲 약국",
  avatar: "👩‍⚕️",
  status: "online" as const,
};

interface Template {
  id: number;
  title: string;
  content: string;
}

const TEMPLATES: Template[] = [
  { id: 1, title: "첫 인사", content: "안녕하세요, 초록숲 약국 김서연 약사입니다. 문답 내용 잘 확인했어요. 궁금한 점 편하게 물어봐 주세요!" },
  { id: 2, title: "방문 안내", content: "약국에 방문하시면 더 자세한 상담이 가능해요.\n\n📍 초록숲 약국\n⏰ 평일 10시~19시, 토요일 10시~14시\n\n편하신 시간에 오세요!" },
  { id: 3, title: "복약 가이드", content: "말씀드린 영양제는 아래와 같이 드시면 좋아요.\n\n💊 아침 식후: 비타민B군, 비타민D\n💊 취침 전: 마그네슘\n\n2주 후 경과를 알려주세요." },
  { id: 4, title: "경과 확인", content: "안녕하세요! 지난번 상담 이후 경과가 궁금해요.\n\n혹시 수면이나 소화 쪽으로 변화가 있으셨나요? 편하게 말씀해 주세요." },
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
  startDate: string; // "MM.DD" 형태
}

const CONSULT_SESSIONS: ConsultSession[] = [
  { id: "s1", startDate: "03.15" },
  { id: "s2", startDate: "04.11" },
];

const SESSION2_SYSTEM_MSG: Message = {
  id: "session2-start",
  sender: "pharmacist",
  content: "[시스템] 새로운 상담이 시작되었습니다",
  time: "오전 9:00",
  isRead: true,
  sessionId: "s2",
};

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

  const [messages, setMessages] = useState<Message[]>([...DEMO_MESSAGES, SESSION2_SYSTEM_MSG]);
  const [input, setInput] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /* ── 상담 차수 ── */
  const [activeSession, setActiveSession] = useState("s1");
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

  const sendMessage = () => {
    const text = input.trim();
    if (!text) return;

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

  const toggleRole = () => {
    const newRole = role === "patient" ? "pharmacist" : "patient";
    router.replace(`/chat/${chatId}?role=${newRole}`);
  };

  const hasUnreadByPharmacist = messages.some((m) => m.sender === "patient" && !m.isRead);

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

  const visibleMessages = messages.filter(
    (m) => m.sessionId === activeSession && !(m.pharmacistOnly && role !== "pharmacist"),
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
          <div className="chat-avatar">{PHARMACIST_INFO.avatar}</div>
          <div className="chat-nav-info">
            <div className="chat-nav-name">
              {role === "patient" ? PHARMACIST_INFO.name : "홍길동 님"}
            </div>
            <div className="chat-nav-pharmacy">
              {role === "patient" ? PHARMACIST_INFO.pharmacy : "만성피로 · 소화불량"}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
          <div className="chat-nav-status">
            <span className="status-dot online" />
            <span className="status-label">접속 중</span>
          </div>
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
            <span style={{ fontSize: 12, color: "#7A8A80", whiteSpace: "nowrap" }}>결과 없음</span>
          )}
          <button type="button" onClick={closeSearch} aria-label="검색 닫기"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4, fontSize: 16, color: "#3D4A42", lineHeight: 1 }}>
            ✕
          </button>
        </div>
      )}

      {/* Role toggle (demo) */}
      <div className="chat-role-toggle">
        <button
          className={`role-btn${role === "patient" ? " active" : ""}`}
          onClick={() => role !== "patient" && toggleRole()}
        >
          환자 화면
        </button>
        <button
          className={`role-btn${role === "pharmacist" ? " active" : ""}`}
          onClick={() => role !== "pharmacist" && toggleRole()}
        >
          약사 화면
        </button>
      </div>

      {/* Status banner */}
      {role === "patient" && (
        <div className={`chat-status-banner${hasUnreadByPharmacist ? " waiting" : " read"}`}>
          {hasUnreadByPharmacist
            ? "약사가 확인 중입니다"
            : "약사가 읽었습니다"}
          {hasUnreadByPharmacist && (
            <p style={{ color: "var(--text-mid)", fontSize: "14px", textAlign: "center", margin: "6px 0 0" }}>
              약사 선생님은 약국 근무 중이라 답변에 시간이 걸릴 수 있어요. 보통 24시간 이내에 답변드려요.
            </p>
          )}
        </div>
      )}
      {role === "pharmacist" && (
        <div className="chat-status-banner pharmacist-banner">
          환자의 AI 문답 요약을 확인하고 상담을 시작하세요
        </div>
      )}

      {/* 상담 차수 탭 (책갈피) */}
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

      {/* Messages */}
      <div className="chat-messages" style={{ borderTop: "none" }}>
        <div className="chat-date-divider">
          <span>{activeSession === "s1" ? "오늘" : "2026년 4월 11일"}</span>
        </div>
        {messages.filter((m) => m.sessionId === activeSession && !(m.pharmacistOnly && role !== "pharmacist")).map((msg) => {
          const isSystem = msg.content.startsWith("[시스템]");
          const isVisitCard = msg.content.startsWith("[방문안내]");

          if (isSystem) {
            return (
              <div key={msg.id} style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                padding: "8px 0", gap: 4,
              }}>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "6px 16px", borderRadius: 100,
                  background: "#EDF4F0", border: "1px solid #B3CCBE",
                  fontSize: 13, color: "#4A6355", fontWeight: 600,
                }}>
                  {role === "pharmacist" && msg.pharmacistOnly && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4A6355" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0110 0v4" />
                    </svg>
                  )}
                  {msg.content.replace("[시스템] ", "")}
                </div>
                {role === "pharmacist" && msg.pharmacistOnly && (
                  <span style={{ fontSize: 11, color: "#9AA8A0" }}>약사님만 보이는 메세지입니다.</span>
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
                  {role === "patient" ? PHARMACIST_INFO.avatar : "🙂"}
                </div>
              )}
              <div className="bubble-col">
                {!isMine && (
                  <div className="bubble-name">
                    {role === "patient" ? PHARMACIST_INFO.name : "홍길동"}
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
      </div>

      {/* Template + Followup buttons (pharmacist only) */}
      {role === "pharmacist" && (
        <div style={{
          padding: "6px 16px",
          background: "rgba(248,249,247,0.95)",
          borderTop: "1px solid rgba(94,125,108,0.10)",
          display: "flex", gap: 8, flexWrap: "wrap",
        }}>
          <button
            type="button"
            onClick={() => setShowTemplates(true)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "6px 14px", borderRadius: 20,
              fontSize: 13, fontWeight: 600,
              background: "#EDF4F0", color: "#4A6355",
              border: "1px solid #B3CCBE", cursor: "pointer",
            }}
          >
            템플릿
          </button>
          <button
            type="button"
            onClick={() => {
              setFuMessage(followUp?.message ?? FOLLOWUP_DEFAULT_MSG);
              setShowFollowUpPanel(true);
            }}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "6px 14px", borderRadius: 20,
              fontSize: 13, fontWeight: 600,
              background: "#FBF5F1", color: "#C06B45",
              border: "1px solid #F5E6DC", cursor: "pointer",
            }}
          >
            팔로업 설정
          </button>
          <button
            type="button"
            onClick={handleVisitBtnClick}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "6px 14px", borderRadius: 20,
              fontSize: 13, fontWeight: 600,
              background: "#E8F0F5", color: "#5A8BA8",
              border: "1px solid #B3D1E0", cursor: "pointer",
            }}
          >
            방문 안내
          </button>
          <button
            type="button"
            onClick={handleReportBtnClick}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "6px 14px", borderRadius: 20,
              fontSize: 13, fontWeight: 600,
              background: "#F5E6DC", color: "#C06B45",
              border: "1px solid #E8D5C8", cursor: "pointer",
            }}
          >
            방문전 리포트
          </button>
        </div>
      )}

      {/* Input */}
      <div className="chat-input-bar">
        <textarea
          ref={inputRef}
          className="chat-input"
          placeholder="메시지를 입력하세요..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        <button
          className="chat-send-btn"
          onClick={sendMessage}
          disabled={!input.trim()}
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
        <div
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.35)",
            backdropFilter: "blur(4px)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
            zIndex: 100,
          }}
          onClick={() => setShowTemplates(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 20,
              padding: "20px 20px 32px",
              width: "100%", maxWidth: 560,
              maxHeight: "70dvh", overflowY: "auto",
              marginBottom: 56,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              width: 36, height: 4, borderRadius: 2,
              background: "#D1D5D3", margin: "0 auto 16px",
            }} />
            <div style={{ fontSize: 17, fontWeight: 700, color: "#2C3630", marginBottom: 16, fontFamily: "'Gothic A1', sans-serif" }}>
              답변 템플릿
            </div>
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setInput(t.content);
                  setShowTemplates(false);
                  setTimeout(() => inputRef.current?.focus(), 100);
                }}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "14px 16px", borderRadius: 12,
                  background: "#F8F9F7", marginBottom: 8,
                  border: "1px solid rgba(94,125,108,0.14)",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 600, color: "#2C3630", marginBottom: 4 }}>{t.title}</div>
                <div style={{
                  fontSize: 14, color: "#3D4A42", lineHeight: 1.5,
                  display: "-webkit-box", WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical" as const, overflow: "hidden",
                }}>{t.content}</div>
              </button>
            ))}
          </div>
        </div>
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
                <div style={{ fontSize: 12, fontWeight: 600, color: "#7A8A80", marginBottom: 6 }}>이전 방문 안내</div>
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
              <div style={{ fontSize: 11, color: "#7A8A80", marginTop: 4 }}>
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
                {rptSent && (
                  <span style={{
                    padding: "2px 8px", borderRadius: 100, fontSize: 12, fontWeight: 700,
                    background: "#4A6355", color: "#fff",
                  }}>전송됨</span>
                )}
              </div>
              <button type="button" onClick={() => { setShowReportPanel(false); setRptSent(false); setRptShowConfirm(false); }} aria-label="닫기"
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
                  약사 코멘트 <span style={{ fontSize: 13, fontWeight: 500, color: "#7A8A80" }}>(선택)</span>
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
                <div style={{ fontSize: 12, color: "#7A8A80", textAlign: "right", marginTop: 4 }}>
                  {rptComment.length}/300
                </div>
              </div>

              {/* 자동 포함 안내 */}
              <div style={{
                display: "flex", gap: 10, padding: "12px 14px", borderRadius: 12,
                background: "#F8F9F7", border: "1px solid rgba(94,125,108,0.14)", marginBottom: 16,
              }}>
                <span style={{ fontSize: 18, lineHeight: 1 }}>📋</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#4A6355", marginBottom: 2 }}>하단에 자동 포함:</div>
                  <div style={{ fontSize: 14, color: "#3D4A42", lineHeight: 1.5 }}>
                    약국 방문 시 체질에 맞는 제품과 용량을 안내해드릴게요.
                  </div>
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
              <div style={{ fontSize: 12, fontWeight: 600, color: "#7A8A80", marginBottom: 6 }}>환자 메시지</div>
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
