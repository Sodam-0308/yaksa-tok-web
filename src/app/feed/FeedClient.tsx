"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
import Footer from "@/components/ui/Footer";

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

const FILTER_TABS = [
  { key: "all", label: "전체" },
  { key: "fatigue", label: "만성피로" },
  { key: "digestion", label: "소화장애" },
  { key: "sleep", label: "불면" },
  { key: "rhinitis", label: "비염" },
  { key: "headache", label: "두통" },
  { key: "menstrual", label: "생리통" },
  { key: "acne", label: "여드름" },
  { key: "atopy", label: "아토피" },
  { key: "anxiety", label: "우울·불안" },
  { key: "dryeye", label: "안구건조" },
  { key: "coldlimbs", label: "수족냉증" },
  { key: "edema", label: "붓기" },
] as const;

type FilterKey = (typeof FILTER_TABS)[number]["key"];

const TAG_TO_FILTER: Record<string, FilterKey> = {
  만성피로: "fatigue",
  에너지부족: "fatigue",
  소화장애: "digestion",
  장건강: "digestion",
  불면: "sleep",
  수면장애: "sleep",
  비염: "rhinitis",
  알레르기: "rhinitis",
  두통: "headache",
  생리통: "menstrual",
  여드름: "acne",
  피부트러블: "acne",
  아토피: "atopy",
  "우울·불안": "anxiety",
  안구건조: "dryeye",
  수족냉증: "coldlimbs",
  붓기: "edema",
};

const MOCK_CASES: CaseStudy[] = [
  {
    id: "case-1",
    pharmacist: { id: "kim-seoyeon", name: "김서연 약사", avatar: "👩‍⚕️", pharmacyName: "초록숲 약국", location: "서울 강남", distance: "1.2km" },
    tags: [{ label: "만성피로", variant: "terra" }, { label: "수면장애", variant: "lavender" }],
    patientInfo: "30대 여성 · 증상 1년 이상",
    summary: "오후만 되면 극심한 피로감으로 업무가 힘들었고, 밤에 잠들기까지 2시간 이상 걸렸습니다. 혈액검사에서는 이상 없다는 말만 들었는데, 비타민D·마그네슘·B군 복합 영양제와 생활습관 조절로 오후 에너지가 눈에 띄게 좋아졌습니다.",
    scores: [{ label: "에너지", before: 3, after: 7 }, { label: "수면", before: 2, after: 6 }],
    durationWeeks: 8, likesCount: 47,
  },
  {
    id: "case-2",
    pharmacist: { id: "park-junho", name: "박준호 약사", avatar: "👨‍⚕️", pharmacyName: "자연담은 약국", location: "서울 서초", distance: "2.8km" },
    tags: [{ label: "소화장애", variant: "sage" }, { label: "장건강", variant: "sage" }],
    patientInfo: "40대 남성 · 증상 6개월",
    summary: "식후 더부룩함과 가스가 심해서 식사가 두려울 정도였습니다. 유산균 종류를 바꾸고, 소화효소 보충 + 식사 순서 조절을 병행하니 2주 만에 식후 불편감이 절반으로 줄었습니다.",
    scores: [{ label: "소화", before: 2, after: 7 }, { label: "식욕", before: 4, after: 8 }],
    durationWeeks: 6, likesCount: 32,
  },
  {
    id: "case-3",
    pharmacist: { id: "lee-eunji", name: "이은지 약사", avatar: "👩‍⚕️", pharmacyName: "하늘빛 약국", location: "부산 해운대", distance: null },
    tags: [{ label: "비염", variant: "blue" }, { label: "면역력", variant: "blue" }],
    patientInfo: "20대 남성 · 증상 3년 이상",
    summary: "환절기마다 코막힘과 재채기가 심해 일상이 힘들었습니다. 장 면역 개선에 초점을 맞춰 프로바이오틱스와 비타민C·아연 조합으로 관리한 결과, 올해 환절기에는 증상이 눈에 띄게 줄었습니다.",
    scores: [{ label: "코막힘", before: 8, after: 3 }, { label: "면역력", before: 3, after: 7 }],
    durationWeeks: 12, likesCount: 58,
  },
  {
    id: "case-4",
    pharmacist: { id: "choi-minsoo", name: "최민수 약사", avatar: "👨‍⚕️", pharmacyName: "온누리 약국", location: "서울 마포", distance: "4.1km" },
    tags: [{ label: "불면", variant: "lavender" }],
    patientInfo: "50대 여성 · 증상 2년",
    summary: "새벽 3~4시에 꼭 깨서 다시 잠들기 어려웠습니다. 마그네슘 글리시네이트와 테아닌 조합, 취침 전 루틴 개선을 함께 진행했더니 수면 유지 시간이 확연히 늘었습니다.",
    scores: [{ label: "수면", before: 3, after: 7 }, { label: "피로", before: 7, after: 3 }],
    durationWeeks: 6, likesCount: 41,
  },
  {
    id: "case-5",
    pharmacist: { id: "kim-seoyeon", name: "김서연 약사", avatar: "👩‍⚕️", pharmacyName: "초록숲 약국", location: "서울 강남", distance: "1.2km" },
    tags: [{ label: "피부트러블", variant: "rose" }, { label: "소화장애", variant: "sage" }],
    patientInfo: "20대 여성 · 증상 8개월",
    summary: "턱 라인에 반복되는 트러블이 스트레스였는데, 장 상태와 연관이 있을 수 있다는 분석을 받았습니다. 장 건강 개선 + 아연·오메가3 보충 후 피부 트러블 빈도가 크게 줄었습니다.",
    scores: [{ label: "피부", before: 3, after: 7 }, { label: "소화", before: 4, after: 7 }],
    durationWeeks: 10, likesCount: 63,
  },
  {
    id: "case-6",
    pharmacist: { id: "lee-eunji", name: "이은지 약사", avatar: "👩‍⚕️", pharmacyName: "하늘빛 약국", location: "부산 해운대", distance: null },
    tags: [{ label: "만성피로", variant: "terra" }, { label: "면역력", variant: "blue" }],
    patientInfo: "30대 남성 · 증상 1년",
    summary: "감기를 달고 살면서 항상 몸이 무거웠습니다. 비타민D 수치 확인 후 고용량 보충과 함께 아연·셀레늄 관리를 시작했더니, 3개월 만에 감기 빈도가 확연히 줄고 컨디션이 안정되었습니다.",
    scores: [{ label: "에너지", before: 3, after: 6 }, { label: "면역력", before: 2, after: 7 }],
    durationWeeks: 12, likesCount: 39,
  },
];

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
  const [showModal, setShowModal] = useState(false);
  const [selectedCase, setSelectedCase] = useState<CaseStudy | null>(null);
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
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
  }, [activeFilter, mainTab]);

  const addRevealRef = (el: HTMLElement | null) => {
    if (el && !revealRefs.current.includes(el)) revealRefs.current.push(el);
  };

  const filtered = activeFilter === "all" ? MOCK_CASES : MOCK_CASES.filter((c) => c.tags.some((t) => TAG_TO_FILTER[t.label] === activeFilter));

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
          {/* 필터 탭 */}
          <div className="feed-filter-bar">
            <div className="feed-filter-scroll">
              {FILTER_TABS.map((tab) => (
                <button key={tab.key} onClick={() => setActiveFilter(tab.key)} className={`feed-filter-tab${activeFilter === tab.key ? " active" : ""}`}>
                  {tab.label}
                </button>
              ))}
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
                  return (
                    <article key={c.id} className="feed-card reveal" ref={addRevealRef} style={{ animationDelay: `${0.1 * i}s` }}>
                      <div className="feed-card-header">
                        <div className="feed-card-avatar">{c.pharmacist.avatar}</div>
                        <div className="feed-card-pharmacist">
                          <div className="feed-card-name">{c.pharmacist.name}</div>
                          <div className="feed-card-pharmacy">
                            {c.pharmacist.pharmacyName} · {c.pharmacist.location}
                            {c.pharmacist.distance && <span className="feed-card-distance"> · {c.pharmacist.distance}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="feed-card-body">
                        <div className="feed-card-tags">
                          {c.tags.map((t) => <span key={t.label} className={`feed-tag feed-tag-${t.variant}`}>{t.label}</span>)}
                        </div>
                        <div className="feed-card-patient">{c.patientInfo}</div>
                        <p className="feed-card-summary">{c.summary}</p>
                        <div className="feed-scores">
                          <div className="feed-scores-title">개선 결과</div>
                          {c.scores.map((s) => {
                            const improved = s.after > s.before;
                            return (
                              <div key={s.label} className="feed-score-row">
                                <span className="feed-score-label">{s.label}</span>
                                <span className="feed-score-before">{s.before}</span>
                                <div className="feed-score-bar">
                                  <div className="feed-score-fill-bg" style={{ width: `${s.before * 10}%` }} />
                                  <div className="feed-score-fill" style={{ width: `${s.after * 10}%` }} />
                                </div>
                                <span className="feed-score-after">{s.after}</span>
                                <span className={`feed-score-diff ${improved ? "up" : "down"}`}>{improved ? `↑${s.after - s.before}` : `↓${s.before - s.after}`}</span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="feed-card-duration">🗓 <span>{c.durationWeeks}주 관리</span></div>
                        <div className="feed-card-bottom">
                          <button className={`feed-like-btn${liked ? " liked" : ""}`} onClick={() => toggleLike(c.id)}>
                            {liked ? "❤️" : "🤍"} {liked ? c.likesCount + 1 : c.likesCount}
                          </button>
                          <button className="feed-consult-btn" onClick={() => handleConsult(c)}>이 약사에게 상담받기</button>
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
                      className="feed-card reveal"
                      ref={addRevealRef}
                      style={{ animationDelay: `${0.1 * i}s` }}
                    >
                      {/* 약사 프로필 */}
                      <div className="feed-card-header">
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
                        <div className="feed-card-pharmacist">
                          <div className="feed-card-name">{s.pharmacist.name}</div>
                          <div className="feed-card-pharmacy">
                            {s.pharmacist.pharmacy} · {s.pharmacist.career}
                          </div>
                        </div>
                      </div>

                      <div className="feed-card-body">
                        {/* 대상 */}
                        <div style={{ fontSize: 14, color: C.sageMid, fontWeight: 500, marginBottom: 6 }}>
                          {s.target}
                        </div>

                        {/* 증상 태그 */}
                        <div className="feed-card-tags">
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
                        <div className="feed-card-duration">
                          🗓 <span>{s.duration}</span>
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
