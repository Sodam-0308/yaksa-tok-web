"use client";

import { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { useRouter } from "next/navigation";
import Footer from "@/components/ui/Footer";
import PhotoLightbox from "@/components/PhotoLightbox";
import {
  SymptomIcon,
  SYMPTOM_META,
  TAG_LABEL_TO_KEY,
  type SymptomKey,
} from "@/components/SymptomIcon";

/* ══════════════════════════════════════════
   타입 & 상수 — 개선 사례
   ══════════════════════════════════════════ */

type TagVariant = "sage" | "terra" | "lavender" | "rose" | "blue";

interface ScoreChange {
  label: string;
  before: number;
  after: number;
}

interface CaseStudy {
  id: string;
  authorType: "pharmacist" | "patient";
  showHealthScore: boolean;
  authorLabel?: string;
  createdAt: string;
  images?: string[];
  pharmacist: {
    id: string;
    name: string;
    avatar: string;
    pharmacyName: string;
    location: string;
    distance: string | null;
  };
  tags: { label: string; variant: TagVariant }[];
  patientInfo: string;
  summary: string;
  scores: ScoreChange[];
  durationWeeks: number;
  likesCount: number;
}

const FILTER_TABS_DEFAULT = [
  { key: "all", label: "전체" },
  { key: "fatigue", label: "만성피로" },
  { key: "digestion", label: "소화장애" },
  { key: "sleep", label: "불면/수면" },
  { key: "women", label: "여성건강/생리통" },
  { key: "skin", label: "피부" },
  { key: "rhinitis", label: "비염/알레르기" },
  { key: "gut", label: "변비/장건강" },
  { key: "mood", label: "우울/불안/스트레스" },
  { key: "hair", label: "탈모" },
  { key: "weight", label: "체중 관리/붓기" },
  { key: "antiaging", label: "항노화/항산화" },
  { key: "immune", label: "면역력저하" },
] as const;

const FILTER_TABS_MORE = [
  { key: "headache", label: "두통/목어깨결림" },
  { key: "coldlimbs", label: "수족냉증" },
  { key: "dryeye", label: "안구건조" },
  { key: "joint", label: "관절/뼈" },
  { key: "liver", label: "간 건강" },
  { key: "menopause", label: "갱년기" },
  { key: "men", label: "남성건강" },
] as const;

type FilterKey =
  | (typeof FILTER_TABS_DEFAULT)[number]["key"]
  | (typeof FILTER_TABS_MORE)[number]["key"];

/* 필터 칩 전용 컬러 (카드 헤더 아이콘 컬러와 일치. 확장 7개는 중립 그레이) */
const CHIP_COLORS: Record<string, { bg: string; fg: string }> = {
  // 초록
  fatigue:   { bg: "#EAF3DE", fg: "#3B6D11" },
  weight:    { bg: "#EAF3DE", fg: "#3B6D11" },
  // 앰버
  digestion: { bg: "#FAEEDA", fg: "#854F0B" },
  gut:       { bg: "#FAEEDA", fg: "#854F0B" },
  // 파랑
  sleep:     { bg: "#E6F1FB", fg: "#185FA5" },
  // 코랄
  women:     { bg: "#FAECE7", fg: "#993C1D" },
  skin:      { bg: "#FAECE7", fg: "#993C1D" },
  hair:      { bg: "#FAECE7", fg: "#993C1D" },
  antiaging: { bg: "#FAECE7", fg: "#993C1D" },
  // 틸
  rhinitis:  { bg: "#E1F5EE", fg: "#0F6E56" },
  immune:    { bg: "#E1F5EE", fg: "#0F6E56" },
  // 퍼플
  mood:      { bg: "#EEEDFE", fg: "#534AB7" },
  // 중립 (확장)
  headache:  { bg: "#F0F0F0", fg: "#555555" },
  coldlimbs: { bg: "#F0F0F0", fg: "#555555" },
  dryeye:    { bg: "#F0F0F0", fg: "#555555" },
  joint:     { bg: "#F0F0F0", fg: "#555555" },
  liver:     { bg: "#F0F0F0", fg: "#555555" },
  menopause: { bg: "#F0F0F0", fg: "#555555" },
  men:       { bg: "#F0F0F0", fg: "#555555" },
};

const MOCK_CASES: CaseStudy[] = [
  {
    id: "case-1",
    authorType: "pharmacist", showHealthScore: true,
    createdAt: "2026-03-23T10:30:00", images: [],
    pharmacist: { id: "kim-seoyeon", name: "김서연 약사", avatar: "👩‍⚕️", pharmacyName: "초록숲 약국", location: "서울 강남", distance: "1.2km" },
    tags: [{ label: "만성피로", variant: "terra" }, { label: "수면장애", variant: "lavender" }],
    patientInfo: "30대 여성 · 증상 1년 이상",
    summary: "오후만 되면 극심한 피로감으로 업무가 힘들었고, 밤에 잠들기까지 2시간 이상 걸렸습니다. 혈액검사에서는 이상 없다는 말만 들었는데, 환자분 식단을 꼼꼼히 확인해 보니 아침을 거르고 카페인으로 버티는 패턴이 6개월 넘게 지속되고 있었습니다. 혈중 비타민D 수치가 낮을 가능성이 높고 마그네슘·B군도 함께 부족해 보여 해당 성분 복합 영양제로 방향을 잡았습니다. 오전 단백질 섭취, 점심 이후 카페인 차단, 취침 1시간 전 디지털 디톡스 루틴을 함께 진행했고 4주 차부터 오후 집중력이 돌아오기 시작했습니다. 8주 차에는 야간 수면 유지 시간이 평균 2시간 늘어났고 아침 기상 컨디션도 크게 개선되었습니다.",
    scores: [{ label: "에너지", before: 3, after: 7 }, { label: "수면", before: 2, after: 6 }],
    durationWeeks: 8, likesCount: 47,
  },
  {
    id: "case-2",
    authorType: "pharmacist", showHealthScore: true,
    createdAt: "2026-03-28T14:12:00", images: [],
    pharmacist: { id: "park-junho", name: "박준호 약사", avatar: "👨‍⚕️", pharmacyName: "자연담은 약국", location: "서울 서초", distance: "2.8km" },
    tags: [{ label: "소화장애", variant: "sage" }, { label: "장건강", variant: "sage" }],
    patientInfo: "40대 남성 · 증상 6개월",
    summary: "식후 더부룩함과 가스가 심해서 식사가 두려울 정도였습니다. 유산균 종류를 바꾸고, 소화효소 보충 + 식사 순서 조절을 병행하니 2주 만에 식후 불편감이 절반으로 줄었습니다.",
    scores: [{ label: "소화", before: 2, after: 7 }, { label: "식욕", before: 4, after: 8 }],
    durationWeeks: 6, likesCount: 32,
  },
  {
    id: "case-3",
    authorType: "pharmacist", showHealthScore: true,
    createdAt: "2026-04-02T09:45:00", images: [],
    pharmacist: { id: "lee-eunji", name: "이은지 약사", avatar: "👩‍⚕️", pharmacyName: "하늘빛 약국", location: "부산 해운대", distance: null },
    tags: [{ label: "비염", variant: "blue" }, { label: "면역력", variant: "blue" }],
    patientInfo: "20대 남성 · 증상 3년 이상",
    summary: "환절기마다 코막힘과 재채기가 심해 일상이 힘들었습니다. 면역 체계가 장 환경과 긴밀하게 연결된다는 점을 설명드리고 프로바이오틱스와 비타민C·아연 조합으로 장 면역 개선에 초점을 맞췄습니다. 식단에서는 정제 당과 유제품 비중을 잠시 낮추고 발효 식품을 늘리는 방향을 제안드렸습니다. 실내 공기와 침구 관리, 수분 섭취량 증가 등 생활습관도 함께 조정했습니다. 4주 차부터 아침 코막힘 빈도가 줄기 시작했고 8주 차에는 재채기 횟수가 절반 이하로 감소했습니다. 12주 차 환절기 구간에도 증상이 경미한 수준에 머물러 복용 리듬을 유지 가이드로 전환했습니다.",
    scores: [{ label: "코막힘", before: 8, after: 3 }, { label: "면역력", before: 3, after: 7 }],
    durationWeeks: 12, likesCount: 58,
  },
  {
    id: "case-4",
    authorType: "pharmacist", showHealthScore: true,
    createdAt: "2026-04-07T16:20:00", images: [],
    pharmacist: { id: "choi-minsoo", name: "최민수 약사", avatar: "👨‍⚕️", pharmacyName: "온누리 약국", location: "서울 마포", distance: "4.1km" },
    tags: [{ label: "불면", variant: "lavender" }],
    patientInfo: "50대 여성 · 증상 2년",
    summary: "새벽 3~4시에 꼭 깨서 다시 잠들기 어려웠습니다. 마그네슘 글리시네이트와 테아닌 조합, 취침 전 루틴 개선을 함께 진행했더니 수면 유지 시간이 확연히 늘었습니다.",
    scores: [{ label: "수면", before: 3, after: 7 }, { label: "피로", before: 7, after: 3 }],
    durationWeeks: 6, likesCount: 41,
  },
  {
    id: "case-5",
    authorType: "pharmacist", showHealthScore: true,
    createdAt: "2026-04-12T11:05:00", images: [],
    pharmacist: { id: "kim-seoyeon", name: "김서연 약사", avatar: "👩‍⚕️", pharmacyName: "초록숲 약국", location: "서울 강남", distance: "1.2km" },
    tags: [{ label: "피부트러블", variant: "rose" }, { label: "소화장애", variant: "sage" }],
    patientInfo: "20대 여성 · 증상 8개월",
    summary: "턱 라인에 반복되는 트러블이 스트레스였는데, 장 상태와 연관이 있을 수 있다는 분석을 드렸습니다. 식사 일기와 배변 패턴을 2주간 기록해 보니 유제품과 고당 간식 뒤에 트러블이 잦아지는 연관성이 뚜렷하게 보였습니다. 그래서 장 건강 리셋 단계에서 프로바이오틱스와 식이섬유 보충을 시작하고, 아연·오메가3를 추가했습니다. 세안·스킨케어 루틴은 과한 각질 제거를 멈추고 보습 중심으로 조정해 드렸습니다. 4주 차부터 새 트러블 발생 빈도가 줄기 시작했고 10주 차에는 기존 자국도 많이 옅어졌습니다. 재발을 막기 위해 현재는 장 건강 유지 용량과 생활 가이드만 따라가도록 단계를 낮춰 드린 상태입니다.",
    scores: [{ label: "피부", before: 3, after: 7 }, { label: "소화", before: 4, after: 7 }],
    durationWeeks: 10, likesCount: 63,
  },
  {
    id: "case-6",
    authorType: "pharmacist", showHealthScore: true,
    createdAt: "2026-04-17T13:40:00", images: [],
    pharmacist: { id: "lee-eunji", name: "이은지 약사", avatar: "👩‍⚕️", pharmacyName: "하늘빛 약국", location: "부산 해운대", distance: null },
    tags: [{ label: "만성피로", variant: "terra" }, { label: "면역력", variant: "blue" }],
    patientInfo: "30대 남성 · 증상 1년",
    summary: "감기를 달고 살면서 항상 몸이 무거웠습니다. 비타민D 수치 확인 후 고용량 보충과 함께 아연·셀레늄 관리를 시작했더니, 3개월 만에 감기 빈도가 확연히 줄고 컨디션이 안정되었습니다.",
    scores: [{ label: "에너지", before: 3, after: 6 }, { label: "면역력", before: 2, after: 7 }],
    durationWeeks: 12, likesCount: 39,
  },
  {
    id: "case-p1",
    authorType: "patient", showHealthScore: true,
    authorLabel: "30대 여성 · 만성피로",
    createdAt: "2026-04-21T09:15:00",
    images: [
      "https://picsum.photos/seed/yaksa-p1-a/600/600",
      "https://picsum.photos/seed/yaksa-p1-b/600/600",
      "https://picsum.photos/seed/yaksa-p1-c/600/600",
    ],
    pharmacist: { id: "kim-seoyeon", name: "김서연 약사", avatar: "👩‍⚕️", pharmacyName: "초록숲 약국", location: "서울 강남", distance: "1.2km" },
    tags: [{ label: "만성피로", variant: "terra" }],
    patientInfo: "30대 여성 · 증상 1년",
    summary: "오전 출근만 해도 녹초가 되었는데, 김서연 약사님께 상담받은 뒤 비타민D와 마그네슘, B군 조합을 꾸준히 챙겼습니다. 생활습관 코칭도 함께 받아서 3개월 만에 오후 집중이 완전히 달라졌어요.",
    scores: [{ label: "에너지", before: 3, after: 7 }],
    durationWeeks: 12, likesCount: 18,
  },
  {
    id: "case-p2",
    authorType: "patient", showHealthScore: false,
    authorLabel: "40대 남성 · 소화장애",
    createdAt: "2026-04-19T20:30:00", images: [],
    pharmacist: { id: "park-junho", name: "박준호 약사", avatar: "👨‍⚕️", pharmacyName: "자연담은 약국", location: "서울 서초", distance: "2.8km" },
    tags: [{ label: "소화장애", variant: "sage" }],
    patientInfo: "40대 남성 · 증상 8개월",
    summary: "식후 더부룩함이 심해 회식 자리가 부담스러웠는데, 약사님이 제 식습관을 꼼꼼히 물어보시고 유산균 종류와 소화효소 조합을 바꿔주셨습니다. 한 달 정도 지나니 식사가 편해지고 회사 생활이 훨씬 가벼워졌어요.",
    scores: [],
    durationWeeks: 8, likesCount: 12,
  },
  {
    id: "case-p3",
    authorType: "patient", showHealthScore: true,
    authorLabel: "50대 여성 · 불면",
    createdAt: "2026-04-14T22:10:00",
    images: [
      "https://picsum.photos/seed/yaksa-p3-a/600/600",
      "https://picsum.photos/seed/yaksa-p3-b/600/600",
      "https://picsum.photos/seed/yaksa-p3-c/600/600",
      "https://picsum.photos/seed/yaksa-p3-d/600/600",
    ],
    pharmacist: { id: "choi-minsoo", name: "최민수 약사", avatar: "👨‍⚕️", pharmacyName: "온누리 약국", location: "서울 마포", distance: "4.1km" },
    tags: [{ label: "불면", variant: "lavender" }, { label: "수면장애", variant: "lavender" }],
    patientInfo: "50대 여성 · 증상 3년",
    summary: "잠들기까지 한참 걸리고 새벽에도 자주 깼어요. 약사님과 상담하고 마그네슘 글리시네이트와 테아닌 조합을 시작하면서 취침 루틴도 함께 잡았더니 두 달 만에 아침 컨디션이 달라졌습니다.",
    scores: [{ label: "수면", before: 2, after: 6 }],
    durationWeeks: 10, likesCount: 24,
  },
  {
    id: "case-p4",
    authorType: "patient", showHealthScore: false,
    authorLabel: "30대 여성 · 피부",
    createdAt: "2026-04-07T18:00:00", images: [],
    pharmacist: { id: "lee-eunji", name: "이은지 약사", avatar: "👩‍⚕️", pharmacyName: "하늘빛 약국", location: "부산 해운대", distance: null },
    tags: [{ label: "피부트러블", variant: "rose" }],
    patientInfo: "30대 여성 · 증상 6개월",
    summary: "턱 주변 트러블이 반복됐는데 약사님이 장 상태와의 연결을 설명해주셨습니다. 아연·오메가3와 장 건강 관리를 같이 챙긴 덕분에 3개월 차부터 피부 컨디션이 안정됐어요.",
    scores: [],
    durationWeeks: 12, likesCount: 9,
  },
];

/* ══════════════════════════════════════════
   3줄 말줄임 + [더 보기]/[접기] 토글
   ══════════════════════════════════════════ */

function ExpandableText({
  text,
  clampLines = 3,
  textStyle,
}: {
  text: string;
  clampLines?: number;
  textStyle?: React.CSSProperties;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (expanded) return;
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      setIsOverflowing(el.scrollHeight > el.clientHeight + 1);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [text, clampLines, expanded]);

  const clampStyle: React.CSSProperties = expanded
    ? {}
    : {
        display: "-webkit-box",
        WebkitLineClamp: clampLines,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      };

  return (
    <div style={{ marginBottom: 14 }}>
      <p
        ref={ref}
        style={{
          fontSize: 14,
          lineHeight: 1.7,
          color: "#3D4A42",
          margin: 0,
          wordBreak: "keep-all",
          ...clampStyle,
          ...textStyle,
        }}
      >
        {text}
      </p>
      {isOverflowing && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            background: "none",
            border: "none",
            padding: "6px 0 0",
            fontSize: 14,
            color: "#5E7D6C",
            fontWeight: 600,
            cursor: "pointer",
            display: "inline-block",
          }}
        >
          {expanded ? "접기" : "더 보기"}
        </button>
      )}
    </div>
  );
}

/* 작성일 포맷 */
function formatRelativeDate(iso: string): string {
  const now = new Date();
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();
  if (diffMs < 0) return "방금 전";
  const diffMin = diffMs / (1000 * 60);
  const diffHour = diffMin / 60;
  const diffDay = diffHour / 24;
  if (diffHour < 1) return "방금 전";
  if (diffHour < 24) return `${Math.floor(diffHour)}시간 전`;
  if (diffDay < 7) return `${Math.floor(diffDay)}일 전`;
  const y = then.getFullYear();
  const m = String(then.getMonth() + 1).padStart(2, "0");
  const d = String(then.getDate()).padStart(2, "0");
  return `${y}.${m}.${d}`;
}

/* ══════════════════════════════════════════
   약사의 이야기 더미 데이터
   ══════════════════════════════════════════ */

interface StoryChange { before: string; after: string }

interface StoryPost {
  id: string;
  pharmacist: { name: string; pharmacy: string; career: string; avatar: string; id: string };
  target: string;
  tags: { label: string; variant: TagVariant }[];
  title: string;
  description?: string;
  changes: StoryChange[];
  duration: string;
  likes: number;
  filterKey: string;
}

const STORY_FILTERS = [
  { key: "all", label: "전체" },
  { key: "skin", label: "피부·아토피" },
  { key: "fatigue", label: "피로·에너지" },
  { key: "sleep", label: "수면·스트레스" },
  { key: "digestion", label: "소화·장" },
  { key: "immune", label: "면역" },
  { key: "women", label: "여성건강" },
  { key: "growth", label: "성장·발달" },
] as const;

const MOCK_STORIES: StoryPost[] = [
  {
    id: "story-1",
    pharmacist: { name: "김서연 약사", pharmacy: "그린약국", career: "15년차", avatar: "김", id: "kim-seoyeon" },
    target: "약사 가족 (10대 딸)",
    tags: [{ label: "아토피", variant: "rose" }],
    title: "태어날 때부터 아토피였던 딸, 6개월 만에 연고를 끊었어요",
    description: "딸 아이가 돌 전부터 아토피로 고생했습니다. 스테로이드 연고를 바르는 주기가 점점 짧아지면서 약사로서도 이대로는 안 되겠다는 생각이 들어 식단과 장 건강을 근본부터 다시 들여다봤습니다. 아이의 장 상태를 세밀하게 관리하는 프로바이오틱스 조합과 오메가3, 비타민D, 아연을 성장 단계에 맞춰 조절했습니다. 밀가루와 유제품 비중을 낮추고 수분·채소 섭취를 늘리는 식단 루틴을 아이가 부담스럽지 않게 가족 전체가 함께 따라갔습니다. 4개월 차부터 가려움이 눈에 띄게 줄었고, 6개월 차에는 연고 없이 밤에 잘 수 있게 되어 저와 아이 모두 큰 변화를 체감했어요.",
    changes: [{ before: "긁어서 피가 날 정도였어요", after: "연고 없이 지내요" }],
    duration: "6개월 관리",
    likes: 287,
    filterKey: "skin",
  },
  {
    id: "story-2",
    pharmacist: { name: "박민수 약사", pharmacy: "건강한약국", career: "8년차", avatar: "박", id: "park-minsoo" },
    target: "약사 가족 (고3 아들)",
    tags: [{ label: "만성피로", variant: "terra" }, { label: "집중력 저하", variant: "terra" }],
    title: "오후만 되면 멍했던 고3 아들, 2주 만에 달라졌어요",
    changes: [{ before: "오후만 되면 머리가 멍했어요", after: "야자시간까지 집중돼요" }],
    duration: "2주 관리",
    likes: 156,
    filterKey: "fatigue",
  },
  {
    id: "story-3",
    pharmacist: { name: "이하은 약사", pharmacy: "미소약국", career: "12년차", avatar: "이", id: "lee-haeun" },
    target: "약사 가족 (63세 어머니)",
    tags: [{ label: "관절통", variant: "blue" }, { label: "불면", variant: "lavender" }],
    title: "계단도 못 오르시던 어머니, 3개월 만에 산책 다시 시작하셨어요",
    description: "어머니께서 무릎이 시큰거려 일상 동작마저 조심스러워지셨고, 통증 때문에 밤에 자주 깨시면서 수면의 질까지 함께 무너졌습니다. 관절 자체보다 염증 관리와 근육 긴장 완화, 그리고 깊은 수면을 받쳐 줄 환경을 동시에 잡아야 한다고 판단했습니다. 오메가3 고용량과 글루코사민, 마그네슘 글리시네이트, 비타민D3를 용량과 시간대에 맞춰 나눠 드시도록 구성했습니다. 낮에는 짧은 산책과 가벼운 스트레칭을 유도하고, 저녁에는 족욕과 따뜻한 수건으로 무릎을 풀어 주는 루틴을 부탁드렸습니다. 2개월 차부터 통증 강도가 낮아지며 수면이 이어졌고, 3개월 차에는 매일 산책을 다니실 정도로 활동량이 돌아오셨습니다.",
    changes: [
      { before: "계단 오르기도 힘드셨어요", after: "매일 산책 다니세요" },
      { before: "밤에 5번씩 깼어요", after: "새벽까지 푹 자요" },
    ],
    duration: "3개월 관리",
    likes: 203,
    filterKey: "sleep",
  },
  {
    id: "story-4",
    pharmacist: { name: "김서연 약사", pharmacy: "그린약국", career: "15년차", avatar: "김", id: "kim-seoyeon" },
    target: "약사 본인",
    tags: [{ label: "난임", variant: "rose" }],
    title: "약사인 저 자신의 2년 난임, 8개월 만에 기쁜 소식을 들었어요",
    changes: [{ before: "2년간 기다림의 연속", after: "8개월 만에 기쁜 소식" }],
    duration: "8개월 관리",
    likes: 312,
    filterKey: "women",
  },
];

/* ══════════════════════════════════════════
   컬러 상수
   ══════════════════════════════════════════ */

const C = {
  sageBg: "#F8F9F7", sagePale: "#EDF4F0", sageLight: "#B3CCBE",
  sageMid: "#5E7D6C", sageDeep: "#4A6355",
  terra: "#C06B45", terraDark: "#A35A39", terraLight: "#F5E6DC",
  textDark: "#2C3630", textMid: "#3D4A42",
  border: "rgba(94, 125, 108, 0.14)", white: "#fff",
};

/* ══════════════════════════════════════════
   메인 피드
   ══════════════════════════════════════════ */

function FeedContent() {
  const router = useRouter();
  const showEmptyState = false;
  const [mainTab, setMainTab] = useState<"cases" | "recs">("cases");

  /* ── 개선 사례 상태 ── */
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedCase, setSelectedCase] = useState<CaseStudy | null>(null);
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const [lightboxImages, setLightboxImages] = useState<string[] | null>(null);
  const [lightboxStart, setLightboxStart] = useState(0);
  const revealRefs = useRef<(HTMLElement | null)[]>([]);

  /* ── 약사의 이야기 상태 ── */
  const [storyFilter, setStoryFilter] = useState("all");
  const [storyLiked, setStoryLiked] = useState<Set<string>>(new Set());

  // Scroll reveal
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("visible");
        });
      },
      { threshold: 0.15 },
    );
    revealRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [activeFilter, mainTab, searchQuery]);

  const addRevealRef = (el: HTMLElement | null) => {
    if (el && !revealRefs.current.includes(el)) revealRefs.current.push(el);
  };

  const filtered = useMemo(() => {
    const byFilter = activeFilter === "all"
      ? MOCK_CASES
      : MOCK_CASES.filter((c) => c.tags.some((t) => TAG_LABEL_TO_KEY[t.label] === activeFilter));
    const q = searchQuery.trim().toLowerCase();
    const bySearch = q === "" ? byFilter : byFilter.filter((c) => {
      const fields = [
        c.summary,
        c.pharmacist.name,
        c.pharmacist.pharmacyName,
        c.pharmacist.location,
        c.patientInfo,
        c.authorLabel ?? "",
        ...c.tags.map((t) => t.label),
      ];
      return fields.some((f) => f.toLowerCase().includes(q));
    });
    return [...bySearch].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [activeFilter, searchQuery]);

  function openLightbox(images: string[], start: number) {
    setLightboxImages(images);
    setLightboxStart(start);
  }

  function handleConsult(c: CaseStudy) { setSelectedCase(c); setShowModal(true); }
  function handleConfirm() { if (!selectedCase) return; router.push(`/pharmacist/${selectedCase.pharmacist.id}`); }
  function toggleLike(id: string) { setLikedSet((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); }

  const isNearby = selectedCase?.pharmacist.distance !== null;

  const filteredStories = storyFilter === "all" ? MOCK_STORIES : MOCK_STORIES.filter((s) => s.filterKey === storyFilter);

  return (
    <div className="feed-page" style={{ paddingBottom: 80 }}>
      {/* Nav */}
      <nav>
        <button className="nav-back" onClick={() => router.back()} aria-label="뒤로가기">←</button>
        <div className="nav-title">피드</div>
      </nav>

      {/* ── 메인 탭 ── */}
      <div style={{ position: "sticky", top: 56, zIndex: 40, background: C.sageBg, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", maxWidth: 560, margin: "0 auto", padding: "0 24px" }}>
          {([["cases", "개선 사례"], ["recs", "약사의 이야기"]] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMainTab(key)}
              style={{
                flex: 1,
                padding: "14px 0",
                background: "none",
                border: "none",
                borderBottom: mainTab === key ? `2.5px solid ${C.sageDeep}` : "2.5px solid transparent",
                cursor: "pointer",
                fontSize: 15,
                fontWeight: mainTab === key ? 700 : 500,
                color: mainTab === key ? C.sageDeep : C.sageMid,
                fontFamily: "'Gothic A1', sans-serif",
                transition: "all 0.15s",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════ 탭 1: 개선 사례 ══════════════ */}
      {mainTab === "cases" && (
        <>
          {/* 검색창 */}
          <div style={{ maxWidth: 560, margin: "0 auto", padding: "12px 20px 0" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                height: 44,
                padding: "0 14px",
                background: "#F8F9F7",
                border: `1px solid ${C.border}`,
                borderRadius: 22,
              }}
            >
              <span aria-hidden="true" style={{ fontSize: 16, color: C.sageMid, lineHeight: 1 }}>🔍</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="증상, 약국, 키워드 검색"
                aria-label="피드 검색"
                style={{
                  flex: 1,
                  height: "100%",
                  border: "none",
                  background: "transparent",
                  outline: "none",
                  fontSize: 14,
                  color: C.textDark,
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="검색어 지우기"
                  style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: "rgba(94,125,108,0.12)", color: C.textMid,
                    border: "none", fontSize: 13, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: 0, lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* 필터 칩 */}
          <div
            style={{
              maxWidth: 560,
              margin: "0 auto",
              padding: "10px 20px",
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              {[...FILTER_TABS_DEFAULT, ...(showMoreFilters ? FILTER_TABS_MORE : [])].map((tab) => {
                const isActive = activeFilter === tab.key;
                const isAll = tab.key === "all";
                const chip = CHIP_COLORS[tab.key];
                let bg: string;
                let fg: string;
                if (isAll) {
                  bg = isActive ? C.sageDeep : "#F8F9F7";
                  fg = isActive ? "#fff" : "#3D4A42";
                } else if (chip) {
                  bg = isActive ? chip.fg : chip.bg;
                  fg = isActive ? "#fff" : chip.fg;
                } else {
                  bg = isActive ? C.sageDeep : "#F0F0F0";
                  fg = isActive ? "#fff" : "#555";
                }
                const border = isAll && !isActive ? "1px solid rgba(94,125,108,0.2)" : "none";
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveFilter(tab.key)}
                    style={{
                      height: 40,
                      padding: "0 16px",
                      border,
                      borderRadius: 20,
                      background: bg,
                      color: fg,
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      fontFamily: "'Gothic A1', sans-serif",
                      lineHeight: 1,
                      transition: "background 0.15s, color 0.15s",
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setShowMoreFilters((v) => !v)}
                style={{
                  height: 40,
                  padding: "0 16px",
                  border: "1px dashed rgba(94,125,108,0.3)",
                  borderRadius: 20,
                  background: "transparent",
                  color: "#5E7D6C",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  fontFamily: "'Gothic A1', sans-serif",
                  lineHeight: 1,
                }}
              >
                더보기 {showMoreFilters ? "↑" : "↓"}
              </button>
            </div>
          </div>

          {/* 피드 컨테이너 */}
          <div className="feed-container">
            {showEmptyState ? (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", padding: "48px 20px", textAlign: "center",
              }}>
                <div style={{ fontSize: 48, marginBottom: 12, lineHeight: 1 }}>📝</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.textDark, marginBottom: 6 }}>아직 개선 사례가 없어요</div>
                <div style={{ fontSize: 14, color: C.textMid, lineHeight: 1.6, marginBottom: 16 }}>첫 번째 사례를 올려보세요!</div>
                <button type="button" onClick={() => router.push("/feed/new")} style={{
                  padding: "11px 24px", borderRadius: 12, fontSize: 14, fontWeight: 700,
                  background: C.sageDeep, color: "#fff", border: "none", cursor: "pointer",
                }}>개선 사례 올리기</button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="feed-empty">해당 증상의 개선 사례가 아직 없습니다.</div>
            ) : (
              <div className="feed-list">
                {filtered.map((c, i) => {
                  const liked = likedSet.has(c.id);
                  const isPatient = c.authorType === "patient";
                  const dateStr = formatRelativeDate(c.createdAt);
                  const images = c.images ?? [];

                  const primaryTag = c.tags[0];
                  const restTags = c.tags.slice(1);
                  const symKey = primaryTag ? TAG_LABEL_TO_KEY[primaryTag.label] : undefined;
                  const meta = symKey ? SYMPTOM_META[symKey] : undefined;
                  const accent = meta?.accent ?? C.sageDeep;
                  const lightBg = meta?.bg ?? C.sagePale;
                  const primaryLabel = primaryTag?.label ?? "건강 관리";

                  const authorBadgeStyle: React.CSSProperties = {
                    display: "inline-block",
                    fontSize: 12,
                    fontWeight: 500,
                    padding: "3px 8px",
                    borderRadius: 4,
                    background: isPatient ? "#F5E6DC" : "#EDF4F0",
                    color: isPatient ? "#C06B45" : "#4A6355",
                    letterSpacing: "0.01em",
                    flexShrink: 0,
                  };

                  return (
                    <article
                      key={c.id}
                      className="reveal"
                      ref={addRevealRef}
                      style={{
                        animationDelay: `${0.1 * i}s`,
                        background: "#fff",
                        borderRadius: 16,
                        border: "1px solid rgba(94,125,108,0.1)",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                        overflow: "hidden",
                        marginBottom: 16,
                      }}
                    >
                      {/* 상단 액센트 라인 */}
                      <div style={{ height: 3, background: accent }} />

                      {/* 증상 헤더: 아이콘 + 증상명 + 작성자 뱃지 */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "16px 20px 10px",
                        }}
                      >
                        {symKey ? (
                          <SymptomIcon keyId={symKey} size={40} />
                        ) : (
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: "50%",
                              background: lightBg,
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <div
                          style={{
                            flex: 1,
                            fontSize: 17,
                            fontWeight: 700,
                            color: C.textDark,
                            fontFamily: "'Gothic A1', sans-serif",
                            minWidth: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {primaryLabel}
                        </div>
                        <span style={authorBadgeStyle}>
                          {isPatient ? "환자 작성" : "약사 작성"}
                        </span>
                      </div>

                      {/* 추가 증상 태그 */}
                      {restTags.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "0 20px 12px" }}>
                          {restTags.map((t) => (
                            <span key={t.label} className={`feed-tag feed-tag-${t.variant}`}>
                              {t.label}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* 작성자 정보 */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "0 20px 14px",
                          borderBottom: `1px solid ${C.border}`,
                          marginBottom: 14,
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            background: isPatient ? C.terraLight : C.sagePale,
                            color: isPatient ? C.terra : C.sageDeep,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 16,
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                          aria-hidden="true"
                        >
                          {isPatient ? "👤" : c.pharmacist.avatar}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {isPatient ? (
                            <>
                              <div style={{ fontSize: 14, fontWeight: 600, color: C.textDark, lineHeight: 1.4 }}>
                                {c.authorLabel}
                              </div>
                              <div style={{ fontSize: 13, color: "#3D4A42", lineHeight: 1.4 }}>
                                {dateStr}
                              </div>
                            </>
                          ) : (
                            <>
                              <div style={{ fontSize: 14, fontWeight: 600, color: C.textDark, lineHeight: 1.4 }}>
                                {c.pharmacist.name}
                              </div>
                              <div style={{ fontSize: 13, color: "#3D4A42", lineHeight: 1.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {c.pharmacist.pharmacyName} · {c.pharmacist.location}
                                {c.pharmacist.distance && ` · ${c.pharmacist.distance}`}
                                {` · ${dateStr}`}
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* 본문 */}
                      <div style={{ padding: "0 20px 20px" }}>
                        {!isPatient && (
                          <div style={{ fontSize: 14, color: C.textMid, marginBottom: 8 }}>
                            {c.patientInfo}
                          </div>
                        )}
                        <ExpandableText text={c.summary} />

                        {/* 사진 힌트 */}
                        {images.length > 0 && (
                          <button
                            type="button"
                            onClick={() => openLightbox(images, 0)}
                            style={{
                              background: "none",
                              border: "none",
                              padding: 0,
                              margin: "0 0 14px",
                              fontSize: 14,
                              color: C.sageMid,
                              cursor: "pointer",
                              display: "inline-block",
                              textDecoration: "none",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.textDecoration = "underline";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.textDecoration = "none";
                            }}
                          >
                            📷 사진 {images.length}장 보기
                          </button>
                        )}

                        {/* 개선 결과 */}
                        {c.showHealthScore && c.scores.length > 0 && (
                          <div
                            style={{
                              background: lightBg,
                              borderRadius: 12,
                              padding: 16,
                              marginBottom: 14,
                              display: "flex",
                              flexDirection: "column",
                              gap: 10,
                            }}
                          >
                            <div style={{ fontSize: 13, fontWeight: 700, color: accent, letterSpacing: "0.02em" }}>
                              개선 결과
                            </div>
                            {c.scores.map((s) => {
                              const improved = s.after > s.before;
                              const diff = Math.abs(s.after - s.before);
                              return (
                                <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span style={{ minWidth: 52, fontSize: 14, color: C.textMid, fontWeight: 500 }}>
                                    {s.label}
                                  </span>
                                  <span style={{ fontSize: 13, color: "#3D4A42", minWidth: 16, textAlign: "right" }}>
                                    {s.before}
                                  </span>
                                  <div
                                    style={{
                                      flex: 1,
                                      height: 8,
                                      background: "#E0E0E0",
                                      borderRadius: 4,
                                      position: "relative",
                                      overflow: "hidden",
                                    }}
                                  >
                                    <div
                                      style={{
                                        position: "absolute",
                                        left: 0,
                                        top: 0,
                                        bottom: 0,
                                        width: `${s.after * 10}%`,
                                        background: accent,
                                        borderRadius: 4,
                                      }}
                                    />
                                  </div>
                                  <span style={{ fontSize: 14, color: accent, fontWeight: 700, minWidth: 16, textAlign: "right" }}>
                                    {s.after}
                                  </span>
                                  <span style={{ fontSize: 13, color: accent, fontWeight: 700, minWidth: 40, textAlign: "right" }}>
                                    {improved ? `+${diff}↑` : `-${diff}↓`}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* 관리 기간 */}
                        <div style={{ fontSize: 14, color: "#3D4A42", marginBottom: 14 }}>
                          🗓 <span style={{ fontWeight: 500 }}>{c.durationWeeks}주 관리</span>
                        </div>

                        {/* 하단: 좋아요 + 상담 */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            paddingTop: 14,
                            borderTop: `1px solid ${C.border}`,
                          }}
                        >
                          <button
                            className={`feed-like-btn${liked ? " liked" : ""}`}
                            onClick={() => toggleLike(c.id)}
                          >
                            {liked ? "❤️" : "🤍"} {liked ? c.likesCount + 1 : c.likesCount}
                          </button>
                          <button className="feed-consult-btn" onClick={() => handleConsult(c)}>
                            이 약사에게 상담받기
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ══════════════ 탭 2: 약사의 이야기 ══════════════ */}
      {mainTab === "recs" && (
        <>
          {/* 필터 */}
          <div className="feed-filter-bar">
            <div className="feed-filter-scroll">
              {STORY_FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setStoryFilter(f.key)}
                  className={`feed-filter-tab${storyFilter === f.key ? " active" : ""}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* 카드 리스트 */}
          <div className="feed-container">
            {showEmptyState ? (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", padding: "48px 20px", textAlign: "center",
              }}>
                <div style={{ fontSize: 48, marginBottom: 12, lineHeight: 1 }}>💊</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.textDark, marginBottom: 6 }}>아직 약사의 이야기가 없어요</div>
                <div style={{ fontSize: 14, color: C.textMid, lineHeight: 1.6 }}>약사 선생님들의 경험이 곧 올라올 예정이에요</div>
              </div>
            ) : filteredStories.length === 0 ? (
              <div className="feed-empty">해당 분야의 이야기가 아직 없습니다.</div>
            ) : (
              <div className="feed-list">
                {filteredStories.map((s, i) => {
                  const liked = storyLiked.has(s.id);
                  const likeCount = liked ? s.likes + 1 : s.likes;
                  return (
                    <article
                      key={s.id}
                      className="reveal"
                      ref={addRevealRef}
                      style={{
                        animationDelay: `${0.1 * i}s`,
                        background: "#fff",
                        borderRadius: 16,
                        border: "1px solid rgba(94,125,108,0.1)",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                        padding: 20,
                        marginBottom: 16,
                      }}
                    >
                      {/* 약사 프로필 */}
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                        <div
                          style={{
                            width: 44, height: 44, borderRadius: "50%",
                            background: C.sagePale, display: "flex",
                            alignItems: "center", justifyContent: "center",
                            fontSize: 18, fontWeight: 700, color: C.sageDeep, flexShrink: 0,
                          }}
                        >
                          {s.pharmacist.avatar}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: C.textDark, fontFamily: "'Gothic A1', sans-serif" }}>
                            {s.pharmacist.name}
                          </div>
                          <div style={{ fontSize: 14, color: "#3D4A42", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {s.pharmacist.pharmacy} · {s.pharmacist.career}
                          </div>
                        </div>
                      </div>

                      {/* 대상 */}
                      <div style={{ fontSize: 14, color: C.sageMid, fontWeight: 500, marginBottom: 6 }}>
                        {s.target}
                      </div>

                      {/* 증상 태그 */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                        {s.tags.map((t) => (
                          <span key={t.label} className={`feed-tag feed-tag-${t.variant}`}>{t.label}</span>
                        ))}
                      </div>

                      {/* 제목 */}
                      <div
                        style={{
                          fontSize: 17, fontWeight: 700, color: C.textDark,
                          lineHeight: 1.5, marginBottom: 12,
                          fontFamily: "'Gothic A1', sans-serif",
                        }}
                      >
                        {s.title}
                      </div>

                      {/* 본문 (description이 있을 때) */}
                      {s.description && <ExpandableText text={s.description} />}

                      {/* 전/후 변화 */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                        {s.changes.map((ch, ci) => (
                          <div key={ci} style={{
                            padding: "10px 14px", borderRadius: 10,
                            background: C.sagePale, fontSize: 14, lineHeight: 1.6,
                          }}>
                            <div style={{ color: C.textMid }}>
                              <span style={{ marginRight: 6 }}>😫</span>
                              <span style={{ fontWeight: 500 }}>{ch.before}</span>
                            </div>
                            <div style={{ color: C.sageDeep, marginTop: 4 }}>
                              <span style={{ marginRight: 6 }}>😊</span>
                              <span style={{ fontWeight: 600 }}>{ch.after}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* 기간 */}
                      <div style={{ fontSize: 14, color: "#3D4A42", marginBottom: 14 }}>
                        🗓 <span style={{ fontWeight: 500 }}>{s.duration}</span>
                      </div>

                      {/* 하단: 좋아요 + 상담 */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                          <button
                            type="button"
                            onClick={() => {
                              setStoryLiked((prev) => {
                                const n = new Set(prev);
                                n.has(s.id) ? n.delete(s.id) : n.add(s.id);
                                return n;
                              });
                            }}
                            style={{
                              background: "none", border: "none", cursor: "pointer",
                              fontSize: 14, fontWeight: 600,
                              color: liked ? "#E0574F" : C.textMid,
                              display: "flex", alignItems: "center", gap: 5, padding: "4px 0",
                            }}
                          >
                            {liked ? "❤️" : "🤍"} {likeCount}
                          </button>
                          <button
                            type="button"
                            onClick={() => router.push(`/pharmacist/${s.pharmacist.id}`)}
                            style={{
                              background: "none", border: "none", cursor: "pointer",
                              fontSize: 14, fontWeight: 700, color: C.terra, padding: "4px 0",
                            }}
                          >
                            이 약사에게 상담받기 →
                          </button>
                        </div>

                      {/* 면책 문구 */}
                      <div style={{
                        fontSize: 12, color: C.sageMid, marginTop: 12,
                        padding: "8px 12px", background: C.sageBg,
                        borderRadius: 8, lineHeight: 1.5, textAlign: "center",
                      }}>
                        개인의 경험이며, 같은 증상이라도 사람마다 원인이 다릅니다.
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      <Footer />

      {/* 상담 안내 모달 (개선 사례 탭용) */}
      {showModal && selectedCase && (
        <div className="feed-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="feed-modal animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="feed-modal-pharmacist">
              <div className="feed-modal-avatar">{selectedCase.pharmacist.avatar}</div>
              <div>
                <div className="feed-modal-name">{selectedCase.pharmacist.name}</div>
                <div className="feed-modal-pharmacy">{selectedCase.pharmacist.pharmacyName} · {selectedCase.pharmacist.location}</div>
              </div>
            </div>
            {isNearby ? (
              <>
                <div className="feed-modal-info nearby">
                  <div className="feed-modal-info-title">무료 상담 요청</div>
                  <p>근처 약국이에요! AI 문답 후 약사에게 무료 상담을 요청할 수 있습니다. 약국 방문 시 맞춤 분석을 받아보세요.</p>
                </div>
                <button className="feed-modal-btn nearby" onClick={handleConfirm}>무료 상담 요청하기</button>
              </>
            ) : (
              <>
                <div className="feed-modal-info remote">
                  <div className="feed-modal-info-title">원격 상담 (유료)</div>
                  <p>멀리 있는 약사입니다. 온라인 채팅으로 전문 상담을 받을 수 있으며, 상담료가 발생합니다.</p>
                  <div className="feed-modal-fee">상담료: 9,900원~19,900원</div>
                </div>
                <button className="feed-modal-btn remote" onClick={handleConfirm}>원격 상담 신청하기</button>
              </>
            )}
            <button className="feed-modal-cancel" onClick={() => setShowModal(false)}>취소</button>
          </div>
        </div>
      )}

      {/* 사진 라이트박스 */}
      {lightboxImages && (
        <PhotoLightbox
          images={lightboxImages}
          startIndex={lightboxStart}
          onClose={() => setLightboxImages(null)}
        />
      )}
    </div>
  );
}

export default function FeedClient() {
  return (
    <Suspense>
      <FeedContent />
    </Suspense>
  );
}
