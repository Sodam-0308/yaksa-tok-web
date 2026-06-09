"use client";

import { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { CaseStudyRow, ScoreSnapshot, PharmacistStoryRow } from "@/types/database";
import Footer from "@/components/ui/Footer";
import PhotoLightbox from "@/components/PhotoLightbox";

// 카테고리 key → 한글 라벨 (작성 폼 CATEGORY_OPTIONS 와 동일 9개)
const CATEGORY_LABELS: Record<string, string> = {
  digestion: "소화·장", sleep: "수면·마음", fatigue: "피로·기력",
  skin: "피부", pain: "통증·염증", women: "여성건강",
  circulation: "체중관리·순환", growth: "소아·성장", etc: "기타",
};

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
  authorId?: string;
  title?: string;
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
  tags: { label: string; variant: TagVariant; key?: string }[];
  categories?: string[];
  patientInfo: string;
  summary: string;
  scores: ScoreChange[];
  durationWeeks: number;
  likesCount: number;
}

/* ── case_studies Row → 화면 표시용 CaseStudy 매핑 ── */
type CaseRow = CaseStudyRow & { created_at?: string; categories?: string[]; author_id?: string };

const SCORE_LABEL: Record<string, string> = {
  energy: "에너지", sleep: "수면", digestion: "소화", mood: "기분", discomfort: "불편도",
};

// before/after 점수 스냅샷(jsonb) → ScoreChange[]. show_health_score 꺼졌거나 한쪽 없으면 빈 배열.
function buildScores(show: boolean, before: ScoreSnapshot | null, after: ScoreSnapshot | null): ScoreChange[] {
  if (!show || !before || !after) return [];
  const out: ScoreChange[] = [];
  for (const key of Object.keys(after)) {
    const b = before[key];
    const a = after[key];
    if (typeof b === "number" && typeof a === "number") {
      out.push({ label: SCORE_LABEL[key] ?? key, before: b, after: a });
    }
  }
  return out;
}

function mapCaseRow(row: CaseRow): CaseStudy {
  const categories: string[] = Array.isArray(row.categories) ? row.categories : [];
  const photos = Array.isArray(row.photos) ? row.photos : [];
  return {
    id: row.id,
    authorId: row.author_id ?? row.pharmacist_id ?? "",
    title: row.title ?? "",
    authorType: row.author_type,
    showHealthScore: !!row.show_health_score,
    createdAt: row.created_at ?? "",
    images: photos,
    // 약사 이름·약국명·위치·거리·아바타는 case_studies 에 컬럼 없음 → pharmacist_profiles JOIN 필요(다음 단계). 기본값 처리.
    pharmacist: { id: row.pharmacist_id ?? "", name: "", avatar: "👩‍⚕️", pharmacyName: "", location: "", distance: null },
    tags: categories.map((key) => ({ label: CATEGORY_LABELS[key] ?? key, variant: "sage" as const, key })),
    categories,
    patientInfo: [row.patient_age_group, row.patient_gender].filter(Boolean).join(" "),
    summary: row.description ?? "",
    scores: buildScores(!!row.show_health_score, row.before_scores, row.after_scores),
    durationWeeks: row.duration_weeks ?? 0,
    likesCount: row.likes_count ?? 0,
  };
}

// 디자인 참조용 mock — case_studies 실데이터 전환 후 렌더 미사용(보존). 약사의 이야기 연동 단계에서 함께 정리 예정.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

/* ══════════════════════════════════════════
   약사의 이야기 더미 데이터
   ══════════════════════════════════════════ */

interface StoryChange { before: string; after: string }

interface StoryPost {
  id: string;
  authorId?: string;
  createdAt?: string;
  pharmacist: { name: string; pharmacy: string; career: string; avatar: string; id: string };
  target: string;
  tags: { label: string; variant: TagVariant; key?: string }[];
  categories?: string[];
  title: string;
  description?: string;
  changes: StoryChange[];
  duration: string;
  likes: number;
  filterKey?: string;
}

/* ── pharmacist_stories Row → 화면 표시용 StoryPost 매핑 ── */
type StoryRow = PharmacistStoryRow & { created_at?: string; categories?: string[] };

function mapStoryRow(row: StoryRow): StoryPost {
  const categories: string[] = Array.isArray(row.categories) ? row.categories : [];
  // 저장 시 줄바꿈 join 했던 before/after_description 을 다시 전·후 변화 쌍으로 복원.
  const befores = (row.before_description ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
  const afters = (row.after_description ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
  const pairCount = Math.max(befores.length, afters.length);
  const changes: StoryChange[] = [];
  for (let i = 0; i < pairCount; i++) {
    changes.push({ before: befores[i] ?? "", after: afters[i] ?? "" });
  }
  return {
    id: row.id,
    authorId: row.pharmacist_id ?? "",
    createdAt: row.created_at ?? "",
    // 약사 이름·약국명·경력·아바타는 pharmacist_stories 에 컬럼 없음 → pharmacist_profiles JOIN 필요(다음 단계). 기본값 처리.
    pharmacist: { name: "", pharmacy: "", career: "", avatar: "약", id: row.pharmacist_id ?? "" },
    target: row.subject_relation ?? "",
    tags: categories.map((key) => ({ label: CATEGORY_LABELS[key] ?? key, variant: "sage" as const, key })),
    categories,
    title: row.title ?? "",
    description: row.story ?? undefined,
    changes,
    duration: row.duration_text ?? "",
    likes: row.likes_count ?? 0,
  };
}

const STORY_FILTERS = [
  { key: "all", label: "전체" },
  { key: "digestion", label: "소화·장" },
  { key: "sleep", label: "수면·마음" },
  { key: "fatigue", label: "피로·기력" },
  { key: "skin", label: "피부" },
  { key: "pain", label: "통증" },
  { key: "women", label: "여성건강" },
  { key: "circulation", label: "체중관리·순환" },
  { key: "etc", label: "기타" },
] as const;

// 디자인 참조용 mock — pharmacist_stories 실데이터 전환 후 렌더 미사용(보존).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
   통합 피드 카드 (개선 사례 + 약사의 이야기 공통 — 약사의 이야기 레이아웃 기준)
   ══════════════════════════════════════════ */

interface FeedExperience {
  kind: "case" | "story";
  id: string;
  authorId: string;   // 글 작성자 profile id (본인 판별용). case=author_id 우선, 없으면 pharmacist_id. story=pharmacist_id.
  createdAt: string;
  title: string;
  // 약사 프로필(이름·약국명) — pharmacist_profiles 에서 주입. 약사 없는 사례(환자 작성/미상)는 null.
  pharmacist: { name: string; pharmacy: string; id: string } | null;
  relationLabel: string;
  categories: string[]; // 카테고리 칩 키 목록(STORY_FILTERS). 빈 배열이면 전체에서만.
  tags: { label: string; variant: TagVariant; key?: string }[];
  body: string;
  changes?: StoryChange[];
  scores?: ScoreChange[];
  showHealthScore?: boolean;
  durationText: string;
  images?: string[];
  likes: number;
}

type PharmacistInfo = Record<string, { name: string; pharmacy: string }>;

/* CaseStudy → 통합 카드 모델 (pmap: pharmacist_id → 이름/약국명) */
function normalizeCase(c: CaseStudy, pmap: PharmacistInfo): FeedExperience {
  const primaryLabel = c.tags[0]?.label ?? "건강 관리";
  const pid = c.pharmacist.id;
  const prof = pid ? pmap[pid] : undefined;
  return {
    kind: "case",
    id: c.id,
    authorId: c.authorId ?? "",
    createdAt: c.createdAt,
    title: c.title?.trim() ? c.title : primaryLabel,
    pharmacist: pid ? { name: prof?.name ?? "", pharmacy: prof?.pharmacy ?? "", id: pid } : null,
    relationLabel: c.authorType === "pharmacist" ? "약사의 상담사례" : "직접 남긴 경험",
    categories: c.categories ?? [],
    tags: c.tags,
    body: c.summary,
    scores: c.scores,
    showHealthScore: c.showHealthScore,
    durationText: c.durationWeeks > 0 ? `${c.durationWeeks}주 관리` : "",
    images: c.images,
    likes: c.likesCount,
  };
}

/* StoryPost → 통합 카드 모델 (pmap: pharmacist_id → 이름/약국명) */
function normalizeStory(s: StoryPost, pmap: PharmacistInfo): FeedExperience {
  const pid = s.pharmacist.id;
  const prof = pid ? pmap[pid] : undefined;
  return {
    kind: "story",
    id: s.id,
    authorId: s.authorId ?? "",
    createdAt: s.createdAt ?? "",
    title: s.title,
    pharmacist: pid ? { name: prof?.name ?? "", pharmacy: prof?.pharmacy ?? "", id: pid } : null,
    relationLabel: s.target,
    categories: s.categories ?? [],
    tags: s.tags,
    body: s.description ?? "",
    changes: s.changes,
    durationText: s.duration,
    likes: s.likes,
  };
}

/* 작성일 yy.mm.dd (예: 26.06.04). 빈/잘못된 값은 "". */
function formatYmd(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}.${mm}.${dd}`;
}

function FeedExperienceCard({
  item, index, onRef, liked, onToggleLike, onConsult, onOpenLightbox, isOwner, onDelete, onEdit,
}: {
  item: FeedExperience;
  index: number;
  onRef: (el: HTMLElement | null) => void;
  liked: boolean;
  onToggleLike: () => void;
  onConsult: () => void;
  onOpenLightbox: (images: string[], start: number) => void;
  isOwner?: boolean;
  onDelete?: () => void;
  onEdit?: () => void;
}) {
  const images = item.images ?? [];
  const ph = item.pharmacist;
  // 이니셜 원형 아바타 — 약사 이름 첫 글자, 약사 미상이면 중립 사람 아이콘(깨진 이미지 금지).
  const avatarText = ph?.name?.trim() ? ph.name.trim().charAt(0) : "👤";
  const likeCount = liked ? item.likes + 1 : item.likes;
  const dateStr = formatYmd(item.createdAt);
  // 관계 라벨 분리: 유형 키워드(헤더 오른쪽) + 괄호 상세(본문 위). 예 "약사 가족 (10대 딸)" → "약사 가족" / "(10대 딸)".
  const relMatch = item.relationLabel.match(/^(.*?)\s*(\(.*\))\s*$/);
  const typeLabel = relMatch ? relMatch[1].trim() : item.relationLabel;
  const detailLabel = relMatch ? relMatch[2].trim() : "";
  return (
    <article
      className="reveal"
      ref={onRef}
      style={{
        animationDelay: `${0.1 * index}s`,
        background: "#fff",
        borderRadius: 16,
        border: "1px solid rgba(94,125,108,0.1)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        padding: 20,
        marginBottom: 16,
      }}
    >
      {/* 약사 프로필 — 왼쪽 [아바타+이름+약국명] / 오른쪽 끝 [유형 라벨 + 대상 상세] */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 44, height: 44, borderRadius: "50%",
          background: C.sagePale, display: "flex",
          alignItems: "center", justifyContent: "center",
          fontSize: 18, fontWeight: 700, color: C.sageDeep, flexShrink: 0,
        }}>
          {avatarText}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {ph?.name?.trim() && (
            <div style={{ fontSize: 15, fontWeight: 700, color: C.textDark, fontFamily: "'Gothic A1', sans-serif" }}>
              {ph.name}
            </div>
          )}
          {ph?.pharmacy?.trim() && (
            <div style={{ fontSize: 14, color: "#3D4A42", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {ph.pharmacy}
            </div>
          )}
        </div>
        {(typeLabel || detailLabel) && (
          <div style={{ flexShrink: 0, marginLeft: 8, textAlign: "right" }}>
            {typeLabel && (
              <div style={{ fontSize: 13, color: C.sageMid, fontWeight: 500, whiteSpace: "nowrap" }}>
                {typeLabel}
              </div>
            )}
            {detailLabel && (
              <div style={{ fontSize: 12, color: C.sageMid, fontWeight: 500, whiteSpace: "nowrap", marginTop: 2 }}>
                {detailLabel}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 본인 글 수정·삭제 (작성자에게만, 수정은 개선 사례만) */}
      {isOwner && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
            style={{ background: "none", border: "none", color: "#9CA3A8", fontSize: 13, cursor: "pointer", padding: "2px 4px", marginRight: 4 }}
          >
            수정
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
            style={{ background: "none", border: "none", color: "#9CA3A8", fontSize: 13, cursor: "pointer", padding: "2px 4px" }}
          >
            삭제
          </button>
        </div>
      )}

      {/* 증상 태그 */}
      {item.tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {item.tags.map((t) => (
            <span key={t.label} className={`feed-tag feed-tag-${t.variant}`} style={{ fontSize: 13, padding: "5px 11px" }}>{t.label}</span>
          ))}
        </div>
      )}

      {/* 제목 */}
      {item.title && (
        <div style={{
          fontSize: 17, fontWeight: 700, color: C.textDark,
          lineHeight: 1.5, marginBottom: 12,
          fontFamily: "'Gothic A1', sans-serif",
        }}>
          {item.title}
        </div>
      )}

      {/* 본문 */}
      {item.body && <ExpandableText text={item.body} />}

      {/* 사진 (case 에만) — 썸네일 직접 노출 금지, 라이트박스 */}
      {images.length > 0 && (
        <button
          type="button"
          onClick={() => onOpenLightbox(images, 0)}
          style={{
            background: "none", border: "none", padding: 0,
            margin: "8px 0 0", fontSize: 14, color: C.sageMid,
            cursor: "pointer", display: "inline-block",
          }}
        >
          📷 사진 {images.length}장 보기
        </button>
      )}

      {/* 전/후 변화 (story changes) */}
      {item.changes && item.changes.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12, marginBottom: 12 }}>
          {item.changes.map((ch, ci) => (
            <div key={ci} style={{ padding: "10px 14px", borderRadius: 10, background: C.sagePale, fontSize: 14, lineHeight: 1.6 }}>
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
      )}

      {/* 개선 결과 (case 의 건강점수) — 데이터 있을 때만 */}
      {item.showHealthScore && item.scores && item.scores.length > 0 && (
        <div style={{ background: C.sagePale, borderRadius: 12, padding: 16, margin: "12px 0", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.sageDeep, letterSpacing: "0.02em" }}>개선 결과</div>
          {item.scores.map((s) => {
            const improved = s.after > s.before;
            const diff = Math.abs(s.after - s.before);
            return (
              <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ minWidth: 52, fontSize: 14, color: C.textMid, fontWeight: 500 }}>{s.label}</span>
                <span style={{ fontSize: 13, color: "#3D4A42", minWidth: 16, textAlign: "right" }}>{s.before}</span>
                <div style={{ flex: 1, height: 8, background: "#E0E0E0", borderRadius: 4, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${s.after * 10}%`, background: C.sageDeep, borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: 14, color: C.sageDeep, fontWeight: 700, minWidth: 16, textAlign: "right" }}>{s.after}</span>
                <span style={{ fontSize: 13, color: C.sageDeep, fontWeight: 700, minWidth: 40, textAlign: "right" }}>{improved ? `+${diff}↑` : `-${diff}↓`}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* 기간 */}
      {item.durationText && (
        <div style={{ fontSize: 14, color: "#3D4A42", marginTop: 12, marginBottom: 14 }}>
          🗓 <span style={{ fontWeight: 500 }}>{item.durationText}</span>
        </div>
      )}

      {/* 하단: 좋아요 + 작성일 / 상담 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <button
            type="button"
            onClick={onToggleLike}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 14, fontWeight: 600,
              color: liked ? "#E0574F" : C.textMid,
              display: "flex", alignItems: "center", gap: 5, padding: "4px 0",
            }}
          >
            {liked ? "❤️" : "🤍"} {likeCount}
          </button>
          {dateStr && (
            <span style={{ fontSize: 12, color: C.sageMid, flexShrink: 0 }}>{dateStr}</span>
          )}
        </div>
        {ph && (
          <button
            type="button"
            onClick={onConsult}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 14, fontWeight: 700, color: C.terra, padding: "4px 0",
            }}
          >
            이 약사에게 상담받기 →
          </button>
        )}
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
}

/* ══════════════════════════════════════════
   메인 피드
   ══════════════════════════════════════════ */

function FeedContent() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  // 약사 판별 — 기존 프로젝트 패턴(usePharmacistGuard/FeedNewClient 동일) 재사용. 글쓰기 진입은 약사만.
  const isPharmacist = profile?.role === "pharmacist";

  /* ── 통합 목록 필터/검색 상태 ── */
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showWriteSheet, setShowWriteSheet] = useState(false); // 글쓰기 종류 선택 시트
  const [deleteTarget, setDeleteTarget] = useState<FeedExperience | null>(null); // 삭제 확인 대상
  const [deleting, setDeleting] = useState(false);
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const [lightboxImages, setLightboxImages] = useState<string[] | null>(null);
  const [lightboxStart, setLightboxStart] = useState(0);
  const revealRefs = useRef<(HTMLElement | null)[]>([]);

  /* ── 개선 사례 실데이터 (case_studies) ── */
  const [cases, setCases] = useState<CaseStudy[]>([]);
  const [casesLoading, setCasesLoading] = useState(true);
  // 게시본 공개 조회 — RLS: is_published = true 는 환자 포함 누구나 SELECT 가능.
  //   단 세션 복원이 끝난 뒤(authLoading=false) 실행 — 익명 컨텍스트로 미리 나가 빈 결과를 받는 race 방지.
  //   비로그인도 봐야 하므로 user 유무로 막지 않고, "세션 확정 여부"만 기다린다.
  //   user 가 null→실값으로 바뀌면(onAuthStateChange) 의존성에 의해 재실행 → JWT 실린 재쿼리.
  useEffect(() => {
    if (authLoading) return; // 세션 복원 미완료 — casesLoading=true 유지하며 대기
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("case_studies")
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (error) {
        console.error("[feed] case_studies load failed:", error);
        setCasesLoading(false);
        return;
      }
      const rows = (data ?? []) as unknown as CaseRow[];
      setCases(rows.map(mapCaseRow));
      setCasesLoading(false);
    })();
    return () => { cancelled = true; };
  }, [authLoading, user]);

  /* ── 약사의 이야기 실데이터 (pharmacist_stories) ── 개선 사례와 동일 패턴(세션 확정 후 SELECT). */
  const [stories, setStories] = useState<StoryPost[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(true);
  useEffect(() => {
    if (authLoading) return; // 세션 복원 미완료 — storiesLoading=true 유지하며 대기
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("pharmacist_stories")
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (error) {
        console.error("[feed] pharmacist_stories load failed:", error);
        setStoriesLoading(false);
        return;
      }
      const rows = (data ?? []) as unknown as StoryRow[];
      setStories(rows.map(mapStoryRow));
      setStoriesLoading(false);
    })();
    return () => { cancelled = true; };
  }, [authLoading, user]);

  /* ── 약사 프로필(이름·약국명) — case_studies/pharmacist_stories 엔 컬럼 없어 pharmacist_profiles 에서 주입 ── */
  const [pharmacistMap, setPharmacistMap] = useState<PharmacistInfo>({});
  useEffect(() => {
    const ids = Array.from(new Set([
      ...cases.map((c) => c.pharmacist.id),
      ...stories.map((s) => s.pharmacist.id),
    ].filter(Boolean)));
    if (ids.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("pharmacist_profiles")
        .select("id, license_name, pharmacy_name")
        .in("id", ids);
      if (cancelled) return;
      if (error) {
        console.error("[feed] pharmacist_profiles load failed:", error);
        return;
      }
      const rows = (data ?? []) as unknown as { id: string; license_name: string | null; pharmacy_name: string | null }[];
      const map: PharmacistInfo = {};
      for (const r of rows) {
        map[r.id] = { name: (r.license_name ?? "").trim(), pharmacy: (r.pharmacy_name ?? "").trim() };
      }
      setPharmacistMap(map);
    })();
    return () => { cancelled = true; };
  }, [cases, stories]);

  // Scroll reveal
  //   의존성에 casesLoading·cases.length 포함 — case_studies 가 비동기로 늦게 채워져 카드가
  //   옵저버 마지막 실행 이후 마운트돼도, 로드 완료(casesLoading false)·카드 수 변화(0→N) 시
  //   옵저버가 재실행되어 새 카드를 관찰 → .visible 부여(투명하게 남는 문제 방지).
  //   (filtered 는 이 effect 아래에서 useMemo 로 선언돼 여기선 참조 불가 → cases.length 로 대체.)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("visible");
        });
      },
      { threshold: 0.15 },
    );
    // null 걸러서 현재 DOM 요소만 관찰 (배열은 비우지 않음 — 카드 재push 보장 없음).
    revealRefs.current.filter(Boolean).forEach((el) => observer.observe(el!));
    return () => observer.disconnect();
  }, [activeCategory, searchQuery, casesLoading, storiesLoading, cases.length, stories.length]);

  const addRevealRef = (el: HTMLElement | null) => {
    if (el && !revealRefs.current.includes(el)) revealRefs.current.push(el);
  };

  // 통합 목록 — 개선 사례 + 약사 이야기를 한 배열로 정규화 → 카테고리·검색 필터 → createdAt 최신순.
  const items = useMemo<FeedExperience[]>(() => {
    const all = [
      ...cases.map((c) => normalizeCase(c, pharmacistMap)),
      ...stories.map((s) => normalizeStory(s, pharmacistMap)),
    ];
    const byCat = activeCategory === "all" ? all : all.filter((x) => x.categories.includes(activeCategory));
    const q = searchQuery.trim().toLowerCase();
    const bySearch = q === "" ? byCat : byCat.filter((x) => {
      const fields = [x.title, x.body, x.pharmacist?.pharmacy ?? "", ...x.tags.map((t) => t.label)];
      return fields.some((f) => f.toLowerCase().includes(q));
    });
    return [...bySearch].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [cases, stories, pharmacistMap, activeCategory, searchQuery]);

  function openLightbox(images: string[], start: number) {
    setLightboxImages(images);
    setLightboxStart(start);
  }

  function toggleLike(id: string) { setLikedSet((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); }

  const handleDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    const table = deleteTarget.kind === "case" ? "case_studies" : "pharmacist_stories";
    const { error } = await supabase.from(table).delete().eq("id", deleteTarget.id);
    setDeleting(false);
    if (error) {
      console.error("[feed] delete failed:", error);
      alert("삭제에 실패했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }
    // 화면에서 제거 — kind 에 따라 cases/stories state 에서 해당 id 제거.
    if (deleteTarget.kind === "case") {
      setCases((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    } else {
      setStories((prev) => prev.filter((s) => s.id !== deleteTarget.id));
    }
    setDeleteTarget(null);
  };

  return (
    <div className="feed-page" style={{ paddingBottom: 80 }}>
      {/* Nav */}
      <nav>
        <button className="nav-back" onClick={() => router.back()} aria-label="뒤로가기">←</button>
        <div className="nav-title">피드</div>
      </nav>

      {(casesLoading || storiesLoading) ? (
        <div style={{
          minHeight: "calc(100vh - 200px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "40px 24px", textAlign: "center", fontSize: 15, color: C.textMid,
        }}>
          불러오는 중이에요…
        </div>
      ) : (
      <>
      {/* ── 검색창 ── */}
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "12px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, height: 44, padding: "0 14px", background: "#F8F9F7", border: `1px solid ${C.border}`, borderRadius: 22 }}>
          <span aria-hidden="true" style={{ fontSize: 16, color: C.sageMid, lineHeight: 1 }}>🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="증상, 약국, 키워드 검색"
            aria-label="피드 검색"
            style={{ flex: 1, height: "100%", border: "none", background: "transparent", outline: "none", fontSize: 14, color: C.textDark }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="검색어 지우기"
              style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(94,125,108,0.12)", color: C.textMid, border: "none", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, lineHeight: 1 }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── 카테고리 필터 (단색 8개) ── */}
      <div className="feed-filter-bar">
        <div className="feed-filter-scroll">
          {STORY_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveCategory(f.key)}
              className={`feed-filter-tab${activeCategory === f.key ? " active" : ""}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 통합 피드 목록 (개선 사례 + 약사 이야기, 최신순) ── */}
      <div className="feed-container" style={{ minHeight: "calc(100vh - 240px)" }}>
        {items.length === 0 ? (
          (cases.length === 0 && stories.length === 0) ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 12, lineHeight: 1 }}>📝</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.textDark, marginBottom: 6 }}>아직 등록된 글이 없어요</div>
              <div style={{ fontSize: 14, color: C.textMid, lineHeight: 1.6, marginBottom: isPharmacist ? 16 : 0 }}>첫 경험을 올려보세요!</div>
              {isPharmacist && (
                <button type="button" onClick={() => setShowWriteSheet(true)} style={{
                  padding: "11px 24px", borderRadius: 12, fontSize: 14, fontWeight: 700,
                  background: C.sageDeep, color: "#fff", border: "none", cursor: "pointer",
                }}>글쓰기</button>
              )}
            </div>
          ) : (
            <div className="feed-empty">조건에 맞는 글이 아직 없습니다.</div>
          )
        ) : (
          <div className="feed-list">
            {items.map((item, i) => (
              <FeedExperienceCard
                key={item.id}
                item={item}
                index={i}
                onRef={addRevealRef}
                liked={likedSet.has(item.id)}
                onToggleLike={() => toggleLike(item.id)}
                onConsult={() => { if (item.pharmacist) router.push(`/pharmacist/${item.pharmacist.id}`); }}
                onOpenLightbox={openLightbox}
                isOwner={!!user && item.authorId === user.id}
                onDelete={() => setDeleteTarget(item)}
                onEdit={() => router.push(item.kind === "case" ? `/feed/new?edit=${item.id}` : `/feed/recommend?edit=${item.id}`)}
              />
            ))}
          </div>
        )}
      </div>
      </>
      )}

      <Footer />

      {/* 사진 라이트박스 */}
      {lightboxImages && (
        <PhotoLightbox
          images={lightboxImages}
          startIndex={lightboxStart}
          onClose={() => setLightboxImages(null)}
        />
      )}

      {/* ── 글쓰기 FAB (약사만) ── */}
      {isPharmacist && (
        <button
          type="button"
          onClick={() => setShowWriteSheet(true)}
          aria-label="글쓰기"
          style={{
            position: "fixed",
            right: 20,
            bottom: "calc(76px + env(safe-area-inset-bottom, 0px))", // 하단 네비 위
            zIndex: 80,
            display: "flex", alignItems: "center", gap: 6,
            height: 52, padding: "0 20px",
            borderRadius: 26,
            background: C.sageDeep, color: "#fff",
            border: "none", cursor: "pointer",
            fontSize: 15, fontWeight: 700,
            fontFamily: "'Gothic A1', sans-serif",
            boxShadow: "0 6px 20px rgba(74,99,85,0.35)",
          }}
        >
          <span style={{ fontSize: 20, lineHeight: 1 }}>＋</span> 글쓰기
        </button>
      )}

      {/* ── 글쓰기 종류 선택 모달 (중앙, 약사만) ── */}
      {isPharmacist && showWriteSheet && (
        <div
          onClick={() => setShowWriteSheet(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0,0,0,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 400,
              background: "#fff",
              borderRadius: 20,
              padding: 20,
              boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.textDark, fontFamily: "'Gothic A1', sans-serif" }}>어떤 글을 올릴까요?</div>
              <button
                type="button"
                onClick={() => setShowWriteSheet(false)}
                aria-label="닫기"
                style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(94,125,108,0.12)", color: C.textMid, border: "none", fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            <button
              type="button"
              onClick={() => { setShowWriteSheet(false); router.push("/feed/new"); }}
              style={{
                width: "100%", textAlign: "left",
                padding: "14px 16px", marginBottom: 10,
                borderRadius: 12, border: `1px solid ${C.border}`,
                background: "#F8F9F7", cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, color: C.textDark, marginBottom: 4 }}>환자 사례</div>
              <div style={{ fontSize: 13, color: C.textMid, lineHeight: 1.5 }}>상담한 환자의 개선 경험을 약사가 기록</div>
            </button>

            <button
              type="button"
              onClick={() => { setShowWriteSheet(false); router.push("/feed/recommend"); }}
              style={{
                width: "100%", textAlign: "left",
                padding: "14px 16px",
                borderRadius: 12, border: `1px solid ${C.border}`,
                background: "#F8F9F7", cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, color: C.textDark, marginBottom: 4 }}>내 경험·가족</div>
              <div style={{ fontSize: 13, color: C.textMid, lineHeight: 1.5 }}>약사 본인 또는 가족의 개선 경험</div>
            </button>
          </div>
        </div>
      )}

      {/* ── 삭제 확인 팝업 ── */}
      {deleteTarget && (
        <div
          onClick={() => !deleting && setDeleteTarget(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 16, padding: "26px 22px 18px", width: "min(92vw, 360px)", boxShadow: "0 10px 40px rgba(0,0,0,0.2)" }}
          >
            <h3 style={{ fontSize: 17, fontWeight: 700, color: "#2C3630", textAlign: "center", margin: "0 0 8px" }}>이 글을 삭제할까요?</h3>
            <p style={{ fontSize: 14, color: "#3D4A42", textAlign: "center", lineHeight: 1.5, margin: "0 0 18px" }}>삭제한 글은 되돌릴 수 없어요.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1px solid #DDE3DF", background: "#fff", color: "#3D4A42", fontSize: 15, fontWeight: 600, cursor: "pointer" }}
              >취소</button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{ flex: 1, padding: "12px", borderRadius: 10, border: "none", background: "#C0392B", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
              >
                {deleting ? "삭제 중..." : "삭제하기"}
              </button>
            </div>
          </div>
        </div>
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
