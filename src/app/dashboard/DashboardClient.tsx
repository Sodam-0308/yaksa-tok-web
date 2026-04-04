"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/* ── 타입 ── */
type ConsultStatus = "waiting" | "chatting" | "visit_scheduled" | "visited" | "completed" | "rejected";

type SymptomCategory = "digestion" | "fatigue" | "sleep" | "skin" | "immune";

interface PatientConsult {
  id: string;
  patientName: string;
  patientGender: string;
  patientAge: string;
  status: ConsultStatus;
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
}

/* ── 상수 ── */
const STATUS_CONFIG: Record<ConsultStatus, { label: string; dot: string; color: string }> = {
  waiting:         { label: "답변 대기", dot: "🟡", color: "var(--terra)" },
  chatting:        { label: "상담 중",   dot: "🟢", color: "var(--sage-deep)" },
  visit_scheduled: { label: "방문 예약", dot: "🔵", color: "#5A8BA8" },
  visited:         { label: "방문 완료", dot: "✅", color: "var(--sage-bright)" },
  completed:       { label: "상담 완료", dot: "✅", color: "var(--text-muted)" },
  rejected:        { label: "거절",     dot: "🔴", color: "var(--error, #D4544C)" },
};

const SYMPTOM_TAG_CLASS: Record<SymptomCategory, string> = {
  digestion: "dash-tag-digestion",
  fatigue:   "dash-tag-fatigue",
  sleep:     "dash-tag-sleep",
  skin:      "dash-tag-skin",
  immune:    "dash-tag-immune",
};

type FilterKey = "all" | ConsultStatus;
type SortKey = "recent" | "unread";

/* ── 더미 데이터 ── */
const MOCK_CONSULTS: PatientConsult[] = [
  {
    id: "c-1",
    patientName: "김○○",
    patientGender: "여",
    patientAge: "30대",
    status: "waiting",
    consultType: "local",
    symptoms: [
      { label: "만성피로", category: "fatigue" },
      { label: "수면장애", category: "sleep" },
    ],
    aiSummary: "6개월 이상 오후 피로감 심화, 입면 장애 동반. 비타민D·마그네슘 부족 가능성.",
    freeText: "아침에 일어나기가 너무 힘들고 오후 3시쯤 되면 정말 아무것도 할 수가 없어요. 커피를 3잔 이상 마시는데도 효과가 없습니다. 밤에 잠들려면 2시간은 걸려요.",
    unreadCount: 2,
    lastMessageAt: "2시간 전",
    createdAt: "2026.04.03",
    prevConsultCount: 0,
  },
  {
    id: "c-2",
    patientName: "박○○",
    patientGender: "남",
    patientAge: "40대",
    status: "chatting",
    consultType: "local",
    symptoms: [
      { label: "소화장애", category: "digestion" },
    ],
    aiSummary: "식후 더부룩함, 가스 과다. 브리스톨 척도 1~2형. 유산균 변경 검토 필요.",
    freeText: "식사 후 30분이면 배가 빵빵해지고 가스가 많이 찹니다. 변비도 있어서 2~3일에 한 번 정도 화장실에 갑니다.",
    unreadCount: 5,
    lastMessageAt: "어제",
    createdAt: "2026.04.01",
    prevConsultCount: 1,
    healthScores: [
      { label: "소화", before: 2, after: 5 },
      { label: "에��지", before: 4, after: 6 },
    ],
  },
  {
    id: "c-3",
    patientName: "이○○",
    patientGender: "여",
    patientAge: "50대",
    status: "visited",
    consultType: "local",
    symptoms: [
      { label: "관절통", category: "immune" },
      { label: "면역력 저하", category: "immune" },
    ],
    aiSummary: "무릎·손가락 관절 불편감 2년. 감기 잦음. 오메가3·비타민D 부족 의심.",
    freeText: "무릎이 시리고 아침에 손가락이 뻣뻣합니다. 감기도 자주 걸리고 낫는 데 오래 걸려요. 병원에서는 큰 이상 없다고 합니다.",
    unreadCount: 0,
    lastMessageAt: "3일 전",
    createdAt: "2026.03.28",
    prevConsultCount: 2,
    healthScores: [
      { label: "���절", before: 3, after: 6 },
      { label: "면역력", before: 2, after: 5 },
    ],
  },
  {
    id: "c-4",
    patientName: "최○○",
    patientGender: "남",
    patientAge: "20대",
    status: "waiting",
    consultType: "remote",
    symptoms: [
      { label: "여드름", category: "skin" },
      { label: "소화장애", category: "digestion" },
    ],
    aiSummary: "턱 라인 트러블 반복 8개월. 장 건강 연관 가능성. 아연·프로바이오틱스 검토.",
    freeText: "턱 쪽에 큰 트러블이 반복적으로 올라옵니다. 피부과에서 약도 먹어봤는데 끊으면 다시 나요. 장이 안 좋은 것과 관련 있을 수 있다고 해서 상담 신청합니다.",
    unreadCount: 1,
    lastMessageAt: "5시간 전",
    createdAt: "2026.04.03",
    prevConsultCount: 0,
  },
  {
    id: "c-5",
    patientName: "정○○",
    patientGender: "여",
    patientAge: "30대",
    status: "completed",
    consultType: "local",
    symptoms: [
      { label: "불면", category: "sleep" },
    ],
    aiSummary: "새벽 각성 패턴. 마그네슘+테아닌 조합 후 수면 유지 시간 개선.",
    freeText: "새벽 3시에 꼭 깹니다. 다시 잠들기 너무 힘들어요.",
    unreadCount: 0,
    lastMessageAt: "1주 전",
    createdAt: "2026.03.20",
    prevConsultCount: 1,
    healthScores: [
      { label: "수면", before: 3, after: 7 },
      { label: "피로", before: 7, after: 3 },
    ],
  },
  {
    id: "c-6",
    patientName: "한○○",
    patientGender: "남",
    patientAge: "60대",
    status: "visit_scheduled",
    consultType: "local",
    symptoms: [
      { label: "만성피로", category: "fatigue" },
      { label: "면역력 저하", category: "immune" },
    ],
    aiSummary: "만성 피로감 1년+, 잦은 감기. 비타민D·아연·셀레늄 복합 보충 검토.",
    freeText: "항상 몸이 무겁고 기운이 없습니다. 감기도 달고 살고요. 영양제를 여러 개 먹고 있는데 뭐가 맞는 건지 모르겠어요.",
    unreadCount: 0,
    lastMessageAt: "1일 전",
    createdAt: "2026.04.02",
    prevConsultCount: 0,
  },
];

/* ── 환자 카드 컴포넌트 ── */
function PatientCard({
  data,
  expanded,
  onToggle,
}: {
  data: PatientConsult;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [memo, setMemo] = useState(data.memo ?? "");
  const [showMemo, setShowMemo] = useState(false);
  const status = STATUS_CONFIG[data.status];

  return (
    <article className="dash-card">
      {/* 상단: 환자 정보 + 상태 */}
      <div className="dash-card-top" onClick={onToggle}>
        <div className="dash-card-info">
          <div className="dash-card-name-row">
            <span className="dash-card-name">
              {data.patientName} ({data.patientGender}, {data.patientAge})
            </span>
            {data.consultType === "remote" && (
              <span className="dash-badge-remote">원격</span>
            )}
          </div>
          <div className="dash-card-tags">
            {data.symptoms.map((s) => (
              <span key={s.label} className={`dash-tag ${SYMPTOM_TAG_CLASS[s.category]}`}>
                {s.label}
              </span>
            ))}
          </div>
        </div>
        <div className="dash-card-status-area">
          <div className="dash-card-status" style={{ color: status.color }}>
            <span className="dash-status-dot">{status.dot}</span> {status.label}
          </div>
          <div className="dash-card-time">{data.lastMessageAt}</div>
          {data.unreadCount > 0 && (
            <span className="dash-unread-badge">{data.unreadCount}</span>
          )}
        </div>
      </div>

      {/* 핵심 요약 카드 (항상 보임) */}
      <div className="dash-summary-card">
        <div className="dash-summary-label">AI 요약</div>
        <div className="dash-summary-text">{data.aiSummary}</div>
      </div>

      {/* 접기/펼치기 상세 */}
      {expanded && (
        <div className="dash-detail">
          {/* 자유 서술 */}
          <div className="dash-detail-section">
            <div className="dash-detail-title">자유 서술</div>
            <div className="dash-detail-text">{data.freeText}</div>
          </div>

          {/* 몸 상태 변화 */}
          {data.healthScores && data.healthScores.length > 0 && (
            <div className="dash-detail-section">
              <div className="dash-detail-title">몸 상태 변화</div>
              <div className="dash-scores">
                {data.healthScores.map((s) => {
                  const improved = s.after > s.before;
                  return (
                    <div key={s.label} className="dash-score-row">
                      <span className="dash-score-label">{s.label}</span>
                      <span className="dash-score-before">{s.before}</span>
                      <div className="dash-score-bar">
                        <div className="dash-score-fill" style={{ width: `${s.after * 10}%` }} />
                      </div>
                      <span className="dash-score-after">{s.after}</span>
                      <span className={`dash-score-diff ${improved ? "up" : "down"}`}>
                        {improved ? `↑${s.after - s.before}` : `↓${s.before - s.after}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 이전 상담 */}
          {data.prevConsultCount > 0 && (
            <div className="dash-detail-section">
              <div className="dash-prev-link">
                이전 상담 {data.prevConsultCount}건 →
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
          <div className="dash-actions">
            <Link href={`/chat/${data.id}?role=pharmacist`} className="dash-action-btn primary">
              답변 작성
            </Link>
            <button className="dash-action-btn secondary">템플릿 불러오기</button>
          </div>
        </div>
      )}

      {/* 펼치기/접기 버튼 */}
      <button className="dash-expand-btn" onClick={onToggle}>
        {expanded ? "접기 ▲" : "상세보기 ▼"}
      </button>
    </article>
  );
}

/* ── 대시보드 메인 ── */
function DashboardContent() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sortBy, setSortBy] = useState<SortKey>("recent");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const revealRefs = useRef<(HTMLElement | null)[]>([]);

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
  }, [filter, search]);

  const addRevealRef = (el: HTMLElement | null) => {
    if (el && !revealRefs.current.includes(el)) {
      revealRefs.current.push(el);
    }
  };

  // 필터 + 검색
  let result = MOCK_CONSULTS;
  if (filter !== "all") {
    result = result.filter((c) => c.status === filter);
  }
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    result = result.filter(
      (c) =>
        c.patientName.includes(q) ||
        c.symptoms.some((s) => s.label.includes(q)),
    );
  }

  // 정렬
  if (sortBy === "unread") {
    result = [...result].sort((a, b) => b.unreadCount - a.unreadCount);
  }

  // 통계
  const totalWaiting = MOCK_CONSULTS.filter((c) => c.status === "waiting").length;
  const totalChatting = MOCK_CONSULTS.filter((c) => c.status === "chatting").length;
  const totalUnread = MOCK_CONSULTS.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <div className="dash-page">
      <nav>
        <button className="nav-back" onClick={() => router.back()} aria-label="뒤로가기">
          ←
        </button>
        <div className="nav-title">약사 대시보드</div>
      </nav>

      <div className="dash-container">
        {/* 요약 카드 */}
        <div className="dash-stats-row">
          <div className="dash-stat-card">
            <div className="dash-stat-num" style={{ color: "var(--terra)" }}>{totalWaiting}</div>
            <div className="dash-stat-label">답변 대기</div>
          </div>
          <div className="dash-stat-card">
            <div className="dash-stat-num" style={{ color: "var(--sage-deep)" }}>{totalChatting}</div>
            <div className="dash-stat-label">상담 중</div>
          </div>
          <div className="dash-stat-card">
            <div className="dash-stat-num" style={{ color: "var(--terra)" }}>{totalUnread}</div>
            <div className="dash-stat-label">미읽은 메시지</div>
          </div>
        </div>

        {/* 검색 */}
        <div className="dash-search-wrap">
          <input
            type="text"
            className="dash-search-input"
            placeholder="환자명 또는 증상으로 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* 필터 + 정렬 */}
        <div className="dash-filter-row">
          <div className="dash-filters">
            {([
              ["all", "전체"],
              ["waiting", "답변 대기"],
              ["chatting", "상담 중"],
              ["visit_scheduled", "방문 예약"],
              ["visited", "방문 완료"],
              ["completed", "완료"],
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
            <option value="unread">미읽은 메시지순</option>
          </select>
        </div>

        {/* 환자 목록 */}
        {result.length === 0 ? (
          <div className="dash-empty">
            {search ? "검색 결과가 없습니다." : "해당 상태의 상담이 없습니다."}
          </div>
        ) : (
          <div className="dash-list">
            {result.map((c) => (
              <div key={c.id} className="reveal" ref={addRevealRef}>
                <PatientCard
                  data={c}
                  expanded={expandedId === c.id}
                  onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
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
