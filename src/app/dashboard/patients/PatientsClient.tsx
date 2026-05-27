"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import {
  type PatientConsult,
  fetchAllConsultations,
  getRelationTag,
} from "@/lib/pharmacistConsults";
import {
  type FilterKey,
  type DateRangeKey,
  applyFilters,
  getLatestActivityTs,
} from "@/lib/dashboardFilters";

/** 헤더 클릭 정렬 컬럼 키. "recent" = 페이지 초기 진입 기본(getLatestActivityTs desc). */
type SortColumn = "recent" | "name" | "birth" | "gender" | "visit" | "supplement" | "chat";
type SortDir = "asc" | "desc";
import { usePharmacistGuard } from "@/lib/usePharmacistGuard";

const DATE_RANGE_OPTIONS: { key: DateRangeKey; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "today", label: "오늘" },
  { key: "1w", label: "1주" },
  { key: "1m", label: "1개월" },
  { key: "3m", label: "3개월" },
  { key: "custom", label: "직접 입력" },
];

function PatientsContent() {
  const router = useRouter();
  usePharmacistGuard();
  const { user: authUser } = useAuth();

  // 환자 목록 — lib/pharmacistConsults 의 fetchAllConsultations 로 로드.
  const [consults, setConsults] = useState<PatientConsult[]>([]);
  useEffect(() => {
    if (!authUser) {
      setConsults([]);
      return;
    }
    (async () => {
      const list = await fetchAllConsultations(supabase, authUser.id);
      setConsults(list);
    })();
  }, [authUser]);

  // 검색 — 일반/AI 토글. AI 는 백엔드 미연동 안내만(대시보드와 동일).
  const [search, setSearch] = useState("");
  const [aiSearchMode, setAiSearchMode] = useState(false);
  const [aiSearchQuery, setAiSearchQuery] = useState("");
  const [aiSearched, setAiSearched] = useState(false);

  // 필터 state — 리스트 전용(거절 이력 포함, 카드뷰 전용 키 미사용).
  const [filter, setFilter] = useState<FilterKey>("all");
  const [dateRange, setDateRange] = useState<DateRangeKey>("all");
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const [filterSource, setFilterSource] = useState<"app" | "offline" | null>(null);
  const [filterVisit, setFilterVisit] = useState<"no_visit" | "has_visit" | null>(null);
  const [filterSupplement, setFilterSupplement] = useState<"taking" | "not_taking" | "completed" | null>(null);
  const [filterRelation, setFilterRelation] = useState<"regular" | null>(null);
  const [showRelationTooltip, setShowRelationTooltip] = useState(false);

  // 정렬 state — 초기값 "recent" (페이지 진입 시 최근 활동순 desc). 헤더 클릭 시 해당 컬럼 모드로 전환.
  const [sortColumn, setSortColumn] = useState<SortColumn>("recent");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  /** 헤더 클릭 — 같은 컬럼이면 방향 토글, 다른 컬럼이면 그 컬럼 + asc(이름/성별/복용은 asc 시작)
   *  또는 desc(날짜 계열은 최신순 시작). */
  const handleSortClick = (col: Exclude<SortColumn, "recent">) => {
    if (sortColumn === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      // 날짜·복용은 desc(최신/복용중 위), 이름·생년월일·성별은 asc(가나다·과거→최근·여→남) 시작.
      setSortDir(col === "visit" || col === "chat" || col === "supplement" ? "desc" : "asc");
    }
  };

  // 필터 적용 후 컬럼별 정렬.
  const filtered = applyFilters(consults, {
    filter, search,
    dateRange, customDateFrom, customDateTo,
    filterSource, filterVisit, filterSupplement, filterRelation,
  });

  // 컬럼별 비교 함수 — null/없음 값은 항상 맨 밑(현재 정렬 방향과 무관하게)으로 두고 나머지 값에만 dir 적용.
  //   visit/chat 의 "없음(맨 밑)" 규칙은 사용자 지시. asc/desc 토글로 nullsLast 위치도 반대로 옮김(방문 없는 환자 맨 위).
  const dirMul = sortDir === "asc" ? 1 : -1;
  const compareName = (a: PatientConsult, b: PatientConsult) =>
    a.patientName.localeCompare(b.patientName, "ko") * dirMul;
  const birthSortKey = (c: PatientConsult): number => {
    if (c.birthDate) {
      const t = new Date(c.birthDate).getTime();
      if (!Number.isNaN(t)) return t;
    }
    if (c.birthYear > 0) return new Date(c.birthYear, 0, 1).getTime();
    return Number.NEGATIVE_INFINITY;
  };
  const compareBirth = (a: PatientConsult, b: PatientConsult) =>
    (birthSortKey(a) - birthSortKey(b)) * dirMul;
  const genderOrder = (g: string): number => {
    if (g === "여성") return 0;
    if (g === "남성") return 1;
    if (g === "기타") return 2;
    return 3; // 빈값 맨 뒤
  };
  const compareGender = (a: PatientConsult, b: PatientConsult) =>
    (genderOrder(a.patientGender) - genderOrder(b.patientGender)) * dirMul;
  const visitTs = (c: PatientConsult): number => {
    if (!c.visitDate) return Number.NEGATIVE_INFINITY;
    const m = c.visitDate.match(/^(\d{4})\.(\d{2})\.(\d{2})$/);
    if (!m) return Number.NEGATIVE_INFINITY;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
  };
  const compareVisit = (a: PatientConsult, b: PatientConsult) => {
    const va = visitTs(a);
    const vb = visitTs(b);
    // 방문 없는 환자는 항상 정렬 그룹 끝(desc=맨 밑, asc=맨 위) 으로 — 사용자 지시.
    const aNone = va === Number.NEGATIVE_INFINITY;
    const bNone = vb === Number.NEGATIVE_INFINITY;
    if (aNone && bNone) return 0;
    if (aNone) return sortDir === "desc" ? 1 : -1;
    if (bNone) return sortDir === "desc" ? -1 : 1;
    return (va - vb) * dirMul;
  };
  const supplementOrder = (s: PatientConsult["supplementStatus"]): number => {
    if (s === "taking") return 0;
    if (s === "completed") return 1;
    return 2; // not_taking 맨 뒤
  };
  const compareSupplement = (a: PatientConsult, b: PatientConsult) => {
    // dir desc(기본) = 복용중→완료→없음, asc = 그 역순.
    const diff = supplementOrder(a.supplementStatus) - supplementOrder(b.supplementStatus);
    return sortDir === "desc" ? diff : -diff;
  };
  const chatTs = (c: PatientConsult): number => {
    if (!c.lastMessageAtIso) return Number.NEGATIVE_INFINITY;
    const t = new Date(c.lastMessageAtIso).getTime();
    return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
  };
  const compareChat = (a: PatientConsult, b: PatientConsult) => {
    const ca = chatTs(a);
    const cb = chatTs(b);
    const aNone = ca === Number.NEGATIVE_INFINITY;
    const bNone = cb === Number.NEGATIVE_INFINITY;
    if (aNone && bNone) return 0;
    if (aNone) return sortDir === "desc" ? 1 : -1;
    if (bNone) return sortDir === "desc" ? -1 : 1;
    return (ca - cb) * dirMul;
  };

  const result = [...filtered].sort((a, b) => {
    if (sortColumn === "name") return compareName(a, b);
    if (sortColumn === "birth") return compareBirth(a, b);
    if (sortColumn === "gender") return compareGender(a, b);
    if (sortColumn === "visit") return compareVisit(a, b);
    if (sortColumn === "supplement") return compareSupplement(a, b);
    if (sortColumn === "chat") return compareChat(a, b);
    // recent — 기본: 4기준 최근 활동 desc(헤더와 무관, 페이지 첫 진입 전용 모드).
    return getLatestActivityTs(b) - getLatestActivityTs(a);
  });

  /** 헤더에 현재 정렬 화살표 추가용. */
  const sortArrow = (col: Exclude<SortColumn, "recent">): string =>
    sortColumn === col ? (sortDir === "asc" ? " ▲" : " ▼") : "";

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
        <div className="nav-title">환자 목록</div>
      </nav>

      {/* dash-container 기본 max-width:560px 는 모바일 퍼스트 — 6컬럼 표를 위해 데스크톱 폭 확장.
          인라인 override 로 1100px 까지 늘림(globals.css 미수정). 검색/필터/표 모두 같이 넓어짐. */}
      <div className="dash-container" style={{ maxWidth: 1100 }}>
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

        {/* 필터 + 정렬 — 리스트 전용 2개. "사후 관리/방문 예정/새 메시지" 는 대시보드 카드 "지금 처리할 일"
            과 의미가 겹쳐 환자 목록에선 제거. 거절 이력만 유지. */}
        <div className="dash-filter-row">
          <div className="dash-filters">
            {([
              ["all", "전체"],
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
          {/* 정렬 드롭다운 제거 — 컬럼 헤더 클릭으로 정렬(아래 테이블 thead 참고). 기본 진입은 최근 활동순. */}
        </div>

        {/* 추가 필터: 경로/방문/복용/단골 */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
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

        {/* 빈 결과 안내 */}
        {result.length === 0 ? (
          <div className="dash-empty" style={{ marginTop: 16 }}>
            {search ? "검색 결과가 없습니다." : "해당 조건의 환자가 없습니다."}
          </div>
        ) : (
          /* 리스트 테이블 — 6컬럼: 이름 / 생년월일(나이) / 성별 / 방문 / 복용 / 마지막 대화. 행 1줄 높이 유지.
             폭 배분: colgroup % 비율 합 100% (table-layout: fixed). th/td 에는 width 안 줌.
             모바일 600px↓: 성별·마지막 대화 col display:none → fixed 가 나머지 col 비율 그대로 100% 채움. */
          <div style={{ marginTop: 16, borderRadius: 12, border: "1px solid var(--border, rgba(94,125,108,0.14))", overflow: "hidden", boxSizing: "border-box" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, tableLayout: "fixed" }}>
              <colgroup>
                {/* 데스크톱 1100px 기준 폭 배분 — 마지막 대화 헤더(6자+화살표) 말줄임 방지 위해
                    25% 확보. 이름/생년월일/성별 폭은 좁히고, 방문/복용은 유지. 합 100%. */}
                <col style={{ width: "20%" }} />{/* 이름 */}
                <col style={{ width: "18%" }} />{/* 생년월일 */}
                <col className="pat-col-gender" style={{ width: "8%" }} />{/* 성별 */}
                <col style={{ width: "16%" }} />{/* 방문 */}
                <col style={{ width: "13%" }} />{/* 복용 */}
                <col className="pat-col-chat" style={{ width: "25%" }} />{/* 마지막 대화 */}
              </colgroup>
              <thead>
                <tr style={{ background: "var(--sage-pale, #EDF4F0)" }}>
                  {/* 6컬럼 헤더 — 전부 클릭 정렬. 활성 컬럼에 ▲/▼. 폭은 colgroup 이 결정. */}
                  {(() => {
                    const baseTh: React.CSSProperties = {
                      padding: "10px 8px", textAlign: "left", fontWeight: 700,
                      color: "var(--text-dark, #2C3630)", fontSize: 13, whiteSpace: "nowrap",
                      cursor: "pointer", userSelect: "none",
                      overflow: "hidden", textOverflow: "ellipsis",
                    };
                    return (
                      <>
                        <th style={{ ...baseTh, padding: "10px 12px" }}
                            onClick={() => handleSortClick("name")}>
                          이름{sortArrow("name")}
                        </th>
                        <th style={baseTh}
                            onClick={() => handleSortClick("birth")}>
                          생년월일{sortArrow("birth")}
                        </th>
                        <th className="pat-list-gender-col" style={{ ...baseTh, padding: "10px 4px" }}
                            onClick={() => handleSortClick("gender")}>
                          성별{sortArrow("gender")}
                        </th>
                        <th style={baseTh}
                            onClick={() => handleSortClick("visit")}>
                          방문{sortArrow("visit")}
                        </th>
                        <th style={baseTh}
                            onClick={() => handleSortClick("supplement")}>
                          복용{sortArrow("supplement")}
                        </th>
                        <th className="pat-list-chat-col" style={baseTh}
                            onClick={() => handleSortClick("chat")}>
                          마지막 대화{sortArrow("chat")}
                        </th>
                      </>
                    );
                  })()}
                </tr>
              </thead>
              <tbody>
                {result.map((c) => {
                  const rTag = getRelationTag(c);
                  const isOver = rTag === "over";
                  const age = c.birthYear > 0 ? new Date().getFullYear() - c.birthYear : null;

                  // 생년월일 표시 — birth_date 있으면 "YYMMDD (XX세)", 연도만 있으면 "YY년생 (XX세)", 둘 다 없으면 "-".
                  let birthLabel: string;
                  if (c.birthDate) {
                    const m = c.birthDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                    if (m) {
                      const yy = m[1].slice(2);
                      birthLabel = `${yy}${m[2]}${m[3]}${age != null ? ` (${age}세)` : ""}`;
                    } else {
                      birthLabel = age != null ? `${age}세` : "-";
                    }
                  } else if (c.birthYear > 0) {
                    const yy = String(c.birthYear).slice(2);
                    birthLabel = `${yy}년생${age != null ? ` (${age}세)` : ""}`;
                  } else {
                    birthLabel = "-";
                  }

                  // 방문 셀 — 완료 방문일을 "YY.MM.DD" 로(예: 26.05.26). 없으면 "방문 전".
                  //   visitDate 는 "YYYY.MM.DD" 형식이라 앞 2자리만 잘라 연도 단축.
                  const visitLabel = c.visitDate ? c.visitDate.slice(2) : "방문 전";

                  // 복용 셀 — supplementStatus 배지.
                  type SuppCfg = { label: string; bg: string; color: string };
                  const suppCfg: SuppCfg = c.supplementStatus === "taking"
                    ? { label: "복용중", bg: "#EAF3DE", color: "#3B6D11" }
                    : c.supplementStatus === "completed"
                      ? { label: "복용 완료", bg: "#EDF4F0", color: "#4A6355" }
                      : { label: "없음", bg: "#F0F0F0", color: "#3D4A42" };

                  // 마지막 대화 셀 — lastMessageAtIso 를 "YY.MM.DD" 로(예: 26.05.26). 없으면 "-".
                  let chatLabel = "-";
                  if (c.lastMessageAtIso) {
                    const d = new Date(c.lastMessageAtIso);
                    if (!Number.isNaN(d.getTime())) {
                      const yy = String(d.getFullYear()).slice(2);
                      const mm = String(d.getMonth() + 1).padStart(2, "0");
                      const dd = String(d.getDate()).padStart(2, "0");
                      chatLabel = `${yy}.${mm}.${dd}`;
                    }
                  }

                  return (
                    <tr
                      key={c.id}
                      onClick={() => router.push(`/chart/${c.id}`)}
                      style={{ cursor: "pointer", borderBottom: "1px solid var(--border, rgba(94,125,108,0.14))", transition: "background 0.15s", background: isOver ? "#FAFAFA" : "transparent" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--sage-pale, #EDF4F0)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = isOver ? "#FAFAFA" : "transparent"; }}
                    >
                      <td style={{
                        padding: "12px",
                        fontWeight: 700, color: "#2C3630",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>
                        <span style={{ display: "inline-flex", alignItems: "center", minWidth: 0 }}>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{c.patientName}</span>
                          {rTag === "regular" && <span aria-hidden="true" style={{ marginLeft: 4, flexShrink: 0 }}>💚</span>}
                        </span>
                      </td>
                      <td style={{
                        padding: "12px 6px", color: "var(--text-mid, #3D4A42)",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>{birthLabel}</td>
                      <td className="pat-list-gender-col" style={{
                        padding: "12px 4px", color: "var(--text-mid, #3D4A42)",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>{c.patientGender || "-"}</td>
                      <td style={{
                        padding: "12px 6px", color: "var(--text-mid, #3D4A42)",
                        whiteSpace: "nowrap", fontSize: 14, overflow: "hidden", textOverflow: "ellipsis",
                      }}>{visitLabel}</td>
                      <td style={{ padding: "12px 6px", whiteSpace: "nowrap" }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          padding: "3px 8px", borderRadius: 8,
                          fontSize: 13, fontWeight: 600,
                          background: suppCfg.bg, color: suppCfg.color,
                        }}>{suppCfg.label}</span>
                      </td>
                      <td className="pat-list-chat-col" style={{
                        padding: "12px 6px", color: "var(--text-mid, #3D4A42)",
                        whiteSpace: "nowrap", fontSize: 14, overflow: "hidden", textOverflow: "ellipsis",
                      }}>{chatLabel}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* 모바일 컬럼 조정 — 600px↓ 에서 성별·마지막 대화 숨김(이름·생년월일·방문·복용 우선).
                col + th + td 3 layer 모두 숨겨야 fixed layout 가 나머지 4컬럼에 잔여 비율 재분배. */}
            <style>{`
              @media (max-width: 600px) {
                .pat-col-gender { display: none !important; }
                .pat-col-chat { display: none !important; }
                .pat-list-gender-col { display: none !important; }
                .pat-list-chat-col { display: none !important; }
              }
            `}</style>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PatientsClient() {
  return (
    <Suspense>
      <PatientsContent />
    </Suspense>
  );
}
