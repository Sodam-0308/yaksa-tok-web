/**
 * 약사 대시보드·환자 목록 공유 필터·정렬 순수 함수.
 *
 * DashboardContent 본문에 인라인으로 있던 result.filter 체인 + sort 를 추출(2026-05-27).
 * 기간 필터의 "now" 는 mock 고정값(new Date(2026,3,10)) 대신 실제 현재 시각(new Date()) 사용.
 */
import {
  type PatientConsult,
  getRelationTag,
  needsUrgentReply,
  needsAcceptUrgent,
  sortableLastMsgTs,
} from "./pharmacistConsults";
import { getTodayLocalISO } from "./nearThresholds";

export type FilterKey =
  | "all"
  | "requested"
  | "managing"
  | "med_ending_soon"
  | "visit_scheduled"
  | "unread"
  | "rejected";
export type SortKey = "recent" | "unread";
export type DateRangeKey = "all" | "today" | "1w" | "1m" | "3m" | "custom";

export interface ApplyFiltersOptions {
  filter: FilterKey;
  search: string;
  dateRange: DateRangeKey;
  customDateFrom: string;
  customDateTo: string;
  filterSource: "app" | "offline" | null;
  filterVisit: "no_visit" | "has_visit" | null;
  filterSupplement: "taking" | "not_taking" | "completed" | null;
  filterRelation: "regular" | null;
}

/** "YYYY.MM.DD" → Date. 잘못된 입력은 Invalid Date 반환(getLatestDate 안에서만 사용). */
function parseDate(str: string): Date {
  const [y, m, d] = str.split(".").map(Number);
  return new Date(y, m - 1, d);
}

/** 기간 필터·"최근 활동" 정렬 공용 기준일.
 *  네 시점 중 최댓값(null/Invalid 제외):
 *   (1) lastMessageAtIso (마지막 채팅)
 *   (2) visitDate (마지막 완료 방문)
 *   (3) lastPurchaseAtIso (우리 약국 가이드 영양제 마지막 등록일 = 구매 근사)
 *   (4) createdAt (첫 상담 — 최후 폴백)
 *  반환값은 timestamp(ms). 아무 것도 없으면 0. */
export function getLatestActivityTs(c: PatientConsult): number {
  let max = 0;
  const consider = (t: number) => {
    if (Number.isFinite(t) && t > max) max = t;
  };
  if (c.lastMessageAtIso) consider(new Date(c.lastMessageAtIso).getTime());
  if (c.visitDate) consider(parseDate(c.visitDate).getTime());
  if (c.lastPurchaseAtIso) consider(new Date(c.lastPurchaseAtIso).getTime());
  if (c.createdAt) consider(parseDate(c.createdAt).getTime());
  return max;
}

/** 기간 필터 비교용 기준일 — visitDate(완료 방문일) 만. 방문 없는 환자는 null 로 → 기간 필터 != 'all' 일 때 제외.
 *  (정렬용 4기준 최댓값은 getLatestActivityTs 그대로 — 정렬과 기간 필터는 별개 의미.) */
function getVisitDateOrNull(c: PatientConsult): Date | null {
  if (!c.visitDate) return null;
  const dt = parseDate(c.visitDate);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** 통합 환자 목록에 필터·검색·기간·칩을 모두 적용한 결과 반환. consults 원본은 변경하지 않음. */
export function applyFilters(
  consults: PatientConsult[],
  opts: ApplyFiltersOptions,
): PatientConsult[] {
  const {
    filter, search,
    dateRange, customDateFrom, customDateTo,
    filterSource, filterVisit, filterSupplement, filterRelation,
  } = opts;

  // 통합 목록은 모든 상태를 포함(pending 포함). 옛 dbPending 박스 제거(2단계)로 pending 별도 제외 불필요.
  //   각 탭은 아래 if-체인에서 자기 술어로 좁힘. "전체"는 원본 패스스루.
  let result = consults;

  if (filter === "managing") {
    result = result.filter((c) => c.patientStatus === "managing");
  } else if (filter === "requested") {
    result = result.filter((c) => c.patientStatus === "requested" && !c.isRejected);
  } else if (filter === "med_ending_soon") {
    result = result.filter((c) => c.isMedEndingSoon === true);
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

  // 기간 필터 — "오늘"은 getTodayLocalISO() 자정 기준(시·분·초 미포함).
  //   비교 대상 getLatestDate(c) 도 createdAt/visitDate 자정 Date 라 자정끼리 비교돼 경계 오차 없음.
  if (dateRange !== "all") {
    const todayIso = getTodayLocalISO();
    const [ty, tm, td] = todayIso.split("-").map(Number);
    const now = new Date(ty, tm - 1, td);
    let fromDate: Date | null = null;
    let toDate: Date | null = null;

    if (dateRange === "today") {
      // 오늘 자정 ≤ latest ≤ 내일 자정 직전 — fromDate=오늘 자정, toDate=내일 자정 -1ms.
      fromDate = new Date(now);
      toDate = new Date(now);
      toDate.setDate(toDate.getDate() + 1);
      toDate.setMilliseconds(-1);
    } else if (dateRange === "1w") {
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
      // 기간 필터는 완료 방문일(visitDate) 기준 — 방문 없는 환자는 제외(dateRange != "all" 시).
      const visit = getVisitDateOrNull(c);
      if (!visit) return false;
      if (fromDate && visit < fromDate) return false;
      if (toDate && visit > toDate) return false;
      return true;
    });
  }

  if (filterSource) {
    result = result.filter((c) => c.registrationSource === filterSource);
  }
  if (filterVisit === "no_visit") {
    result = result.filter((c) => !c.visitDate);
  } else if (filterVisit === "has_visit") {
    result = result.filter((c) => !!c.visitDate);
  }
  if (filterSupplement) {
    result = result.filter((c) => c.supplementStatus === filterSupplement);
  }
  if (filterRelation === "regular") {
    result = result.filter((c) => getRelationTag(c) === "regular");
  }

  return result;
}

/** 정렬 우선순위 — 새 배열 반환(원본 미변경). sortBy 가 실제로 결과를 바꾸도록 분기 명확화.
 *   - 공통 1순위: 🔥 답장 필요 / 수락 지연(긴급 환자는 어떤 정렬이든 위)
 *   - sortBy === "unread" : unreadCount desc → lastMessageAtIso desc(최신 보조)
 *   - sortBy === "recent" : lastMessageAtIso desc (unreadCount 무관, 순수 최신순)
 *
 *  의도된 동작 차이: 이전엔 두 sortBy 모두 unread>0 카드가 자동 위로 와서 select 가 사실상 무력했음.
 *  이제 "최신순" 은 진짜 최신, "안 읽은 메시지순" 은 진짜 안 읽음 우선. 긴급 환자는 양쪽 다 최상위 보장. */
export function sortConsults(consults: PatientConsult[], sortBy: SortKey): PatientConsult[] {
  return [...consults].sort((a, b) => {
    const urgentA = (needsUrgentReply(a) || needsAcceptUrgent(a)) ? 0 : 1;
    const urgentB = (needsUrgentReply(b) || needsAcceptUrgent(b)) ? 0 : 1;
    if (urgentA !== urgentB) return urgentA - urgentB;

    if (sortBy === "unread") {
      if (b.unreadCount !== a.unreadCount) return b.unreadCount - a.unreadCount;
      return sortableLastMsgTs(b) - sortableLastMsgTs(a);
    }

    return sortableLastMsgTs(b) - sortableLastMsgTs(a);
  });
}
